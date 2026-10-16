import React from 'react';
import { act, render, renderHook } from '@testing-library/react';
import { LakeAudio, MAX_SPLASH_VOICES } from '../audio/LakeAudio';
import { LakeSoundControls, readSoundVolume, soundVariation, WaterSound } from '../audio/sounds';
import { useLakeAudio } from '../audio/useLakeAudio';
import { useWaterSounds } from '../scene/useWaterSounds';
import { deserializeSave, emptySave } from '../engine/storage';
import { generateEncounter } from '../engine/encounters';
import { createTyping } from '../engine/typing';
import { GameState } from '../engine/types';
import { DEFAULT_TACKLE } from '../engine/tackle';
import { beginFight } from '../engine/fishFight';

declare const test: any, expect: any, jest: any, beforeEach: any, afterEach: any;
const param = () => ({ value: 0, setTargetAtTime: jest.fn() });
const node = () => ({ connect: jest.fn(), disconnect: jest.fn() });
let contexts: any[], sources: any[], original: typeof AudioContext, originalFetch: typeof fetch;
beforeEach(() => {
  jest.useFakeTimers(); contexts = []; sources = [];
  original = window.AudioContext; originalFetch = global.fetch;
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  const Constructor = jest.fn().mockImplementation(() => {
    const context: any = {
      state: 'suspended', currentTime: 0, destination: {},
      createGain: jest.fn(() => ({ ...node(), gain: param() })),
      createDynamicsCompressor: jest.fn(() => ({ ...node(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() })),
      createStereoPanner: jest.fn(() => ({ ...node(), pan: param() })),
      createBufferSource: jest.fn(() => {
        const source: any = { ...node(), buffer: null, playbackRate: param(), onended: null, start: jest.fn(), stop: jest.fn(), loop: false };
        sources.push(source); return source;
      }),
      decodeAudioData: jest.fn(async () => ({ duration: .7 })),
    };
    context.resume = jest.fn(async () => { context.state = 'running'; });
    context.suspend = jest.fn(async () => { context.state = 'suspended'; });
    context.close = jest.fn(async () => { context.state = 'closed'; });
    contexts.push(context); return context;
  });
  Object.defineProperty(window, 'AudioContext', { configurable: true, writable: true, value: Constructor });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(16) });
});
afterEach(() => { window.AudioContext = original; global.fetch = originalFetch; jest.restoreAllMocks(); jest.useRealTimers(); });

test('audio is lazy until input, shares one context, and disconnects short-lived voices', async () => {
  const audio = new LakeAudio(() => .2);
  audio.configure(true, .55);
  await audio.play('cast'); expect(contexts).toHaveLength(0); expect(global.fetch).not.toHaveBeenCalled();
  audio.unlock(); audio.unlock();
  expect(await audio.preview('cast')).toBe(true);
  expect(contexts).toHaveLength(1); expect(sources).toHaveLength(1);
  expect((global.fetch as any).mock.calls[0][0]).toMatch(/\/audio\/cast-0\.wav$/);
  const first = sources[0]; first.onended();
  expect(first.disconnect).toHaveBeenCalled(); expect(first.buffer).toBeNull();
  audio.dispose(); expect(contexts[0].close).toHaveBeenCalledTimes(1);
});

test('pitch changes stay subtle and adjacent sample variants never repeat', () => {
  let previous: number | undefined;
  for (let i = 0; i < 200; i++) {
    const value = soundVariation(Math.random, previous);
    expect(value.variant).not.toBe(previous); expect(value.pitch).toBeGreaterThan(.968); expect(value.pitch).toBeLessThan(1.033);
    previous = value.variant;
  }
  expect(soundVariation(() => .5, undefined, 15).pitch).toBeLessThan(soundVariation(() => .5, undefined, 1).pitch);
});

test('distance softens splashes, stereo follows their location, and rapid cues are throttled', async () => {
  const audio = new LakeAudio(() => .5); audio.configure(true, .5); audio.unlock();
  await audio.play('lake', { depth: 0, pan: -.7 }); const near = contexts[0].createGain.mock.results[1].value;
  await audio.play('lake', { depth: 1, pan: .7 }); expect(sources).toHaveLength(1);
  act(() => jest.advanceTimersByTime(450));
  await audio.play('lake', { depth: 1, pan: .7 });
  const far = contexts[0].createGain.mock.results[2].value;
  expect(far.gain.value).toBeLessThan(near.gain.value * .15);
  expect(contexts[0].createStereoPanner.mock.results[0].value.pan.value).toBe(-.7);
  expect(contexts[0].createStereoPanner.mock.results[1].value.pan.value).toBe(.7);
  audio.dispose();
});

test('voice and decoded-asset limits stay bounded and mute closes the context immediately', async () => {
  const audio = new LakeAudio(() => 0); audio.configure(true, .6); audio.unlock();
  await audio.play('cast', {}, true);
  for (const kind of ['bite', 'thrash', 'release', 'landing'] as WaterSound[]) for (let i = 0; i < 3; i++) await audio.play(kind, {}, true);
  expect(sources.filter(source => source.start.mock.calls.length && !source.stop.mock.calls.length)).toHaveLength(MAX_SPLASH_VOICES);
  for (let i = 0; i < 3; i++) await audio.play('cast', {}, true);
  expect((global.fetch as any).mock.calls.filter(([url]: string[]) => url.endsWith('cast-0.wav'))).toHaveLength(2);
  audio.configure(false, .6);
  expect(sources.every(source => source.stop.mock.calls.length > 0)).toBe(true);
  expect(contexts[0].close).toHaveBeenCalledTimes(1);
  await audio.play('bite'); expect(contexts).toHaveLength(1);
  expect(await audio.preview('bite')).toBe(false); expect(contexts).toHaveLength(1);
  audio.dispose();
});

test('mute and hidden scenes abort pending loads without replaying a stale sound', async () => {
  let resolve: (value: unknown) => void = () => {};
  global.fetch = jest.fn(() => new Promise(done => { resolve = done; }));
  const audio = new LakeAudio(); audio.configure(true, .6); audio.unlock();
  const pending = audio.play('bite');
  const signal = (global.fetch as any).mock.calls[0][1].signal;
  audio.setVisible(false); expect(signal.aborted).toBe(true); expect(contexts[0].suspend).toHaveBeenCalledTimes(1);
  resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
  await pending; audio.setVisible(true);
  expect(sources).toHaveLength(0); audio.dispose();
});

test('rain uses one lazy loop and updates its volume without repeatedly restarting', async () => {
  const audio = new LakeAudio(); audio.configure(true, .6); audio.setRain(.4);
  expect(global.fetch).not.toHaveBeenCalled();
  audio.unlock();
  await act(async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); });
  expect(sources).toHaveLength(1); expect(sources[0].loop).toBe(true);
  audio.setRain(.5); audio.setRain(.55); expect(sources).toHaveLength(1);
  expect(contexts[0].createGain.mock.results[1].value.gain.setTargetAtTime).toHaveBeenCalledWith(.28 * .55, 0, .4);
  audio.setRain(0); expect(sources[0].stop).toHaveBeenCalledWith(.25);
  audio.dispose();
});

test('settings volume survives loading old saves and safely clamps malformed values', () => {
  const save = emptySave(); delete save.settings.soundVolume;
  expect(deserializeSave(JSON.stringify(save)).settings.soundVolume).toBe(.55);
  save.settings.soundVolume = .23; expect(deserializeSave(JSON.stringify(save)).settings.soundVolume).toBe(.23);
  expect(readSoundVolume(NaN)).toBe(.55); expect(readSoundVolume(-1)).toBe(0); expect(readSoundVolume(3)).toBe(1);
});

test('game splash cues follow casts, nibbles, jolts, landings, and escapes without replaying on render', () => {
  const audio: LakeSoundControls = { play: jest.fn(), rain: jest.fn(), visible: jest.fn(), unlock: jest.fn(), preview: jest.fn() };
  const encounter = generateEncounter(() => .5), typing = createTyping(encounter.phrase, Date.now());
  const ref = React.createRef<HTMLDivElement>();
  const hook = renderHook(({ game, struggling }: { game: GameState; struggling: boolean }) => useWaterSounds(game, .3, struggling, 0, ref, audio), { initialProps: { game: { phase: 'idle' } as GameState, struggling: false } });
  const change = (game: GameState, struggling = false) => hook.rerender({ game, struggling });
  change({ phase: 'casting', biteAt: 10000, waitAt: 1000 });
  act(() => jest.advanceTimersByTime(619)); expect(audio.play).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(1)); expect(audio.play).toHaveBeenLastCalledWith('cast', expect.any(Object));
  const retrieving: GameState = { phase: 'retrieving', tackle: DEFAULT_TACKLE, castDistance: 1, retrieve: {
    typing, cover: [], keys: [], rhythm: 'steady', lastKeyAt: 0, lastRollAt: 0, maxReeled: 0,
    nibble: { speciesId: encounter.species.id, resolvesAt: 5000, grass: false },
  } };
  change(retrieving); expect(audio.play).toHaveBeenLastCalledWith('nibble', expect.any(Object));
  change({ phase: 'typing', encounter, typing }); expect(audio.play).toHaveBeenLastCalledWith('bite', expect.any(Object));
  const count = (audio.play as any).mock.calls.length;
  change({ phase: 'typing', encounter, typing: { ...typing } }); expect(audio.play).toHaveBeenCalledTimes(count);
  change({ phase: 'typing', encounter, typing: { ...typing, errors: 1 } }, true);
  expect(audio.play).toHaveBeenLastCalledWith('thrash', expect.any(Object));
  act(() => jest.advanceTimersByTime(1150)); expect(audio.play).toHaveBeenCalledTimes(count + 2);
  const fight = beginFight(encounter, typing, { testLb: 10, spoolM: 100, wordCheckpoint: false }, Date.now(), () => .5);
  fight.fight!.jolt = { ability: 'surge', endsAt: Date.now() + 2000, nextAt: Date.now() + 300, remaining: 3, intervalMs: 300 };
  change(fight, true); expect(audio.play).toHaveBeenLastCalledWith('thrash', expect.any(Object));
  change({ phase: 'landing', encounter, performance: {} as any, resultAt: 9000 }); expect(audio.play).toHaveBeenLastCalledWith('landing', expect.any(Object));
  change({ phase: 'result', outcome: 'escaped', performance: {} as any }); expect(audio.play).toHaveBeenLastCalledWith('escape', expect.any(Object));
  hook.unmount(); expect(jest.getTimerCount()).toBe(0);
});

test('the audio hook releases its context and listeners when the game unmounts', async () => {
  function Player() {
    const root = React.useRef<HTMLDivElement>(null), audio = useLakeAudio(root, true, .5);
    return <div ref={root}><button onClick={() => audio.preview('cast')}>Preview</button></div>;
  }
  const view = render(<Player />);
  await act(async () => { view.container.querySelector('button')!.click(); });
  expect(contexts).toHaveLength(1); view.unmount(); expect(contexts[0].close).toHaveBeenCalledTimes(1);
});
