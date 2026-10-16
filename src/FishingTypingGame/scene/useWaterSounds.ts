import { RefObject, useEffect, useRef } from 'react';
import { GameState } from '../engine/types';
import { LakeSoundControls } from '../audio/sounds';

/** Audio follows game events, not animation frames or the environmental render rate. */
export function useWaterSounds(game: GameState, progress: number, struggling: boolean, rain: number, scene: RefObject<HTMLDivElement>, audio?: LakeSoundControls) {
  const phase = game.phase;
  const weight = useRef(1), position = useRef({ depth: .5, pan: .15 });
  const currentPhase = useRef(phase); currentPhase.current = phase;
  if (phase === 'casting') weight.current = 1;
  if (phase === 'typing' || phase === 'landing') weight.current = game.encounter.weightKg;
  position.current = { depth: (1 - progress) * .68, pan: .22 - progress * .44 };
  const previous = useRef({ phase, nibble: '', jolt: '', errors: 0, reeled: 0, typed: 0 });
  useEffect(() => {
    const last = previous.current;
    const nibble = phase === 'retrieving' && game.retrieve.nibble ? `${game.retrieve.nibble.speciesId}:${game.retrieve.nibble.resolvesAt}` : '';
    const jolt = phase === 'typing' && game.fight?.jolt ? `${game.fight.jolt.ability}:${game.fight.jolt.endsAt}` : '';
    const errors = phase === 'typing' ? game.typing.errors : 0;
    const reeled = phase === 'retrieving' ? game.retrieve.maxReeled : 0;
    const typed = phase === 'typing' ? Math.floor(progress * game.typing.phrase.length / 12) : 0;
    if (audio) {
      const options = { ...position.current, weightKg: weight.current };
      if (phase !== last.phase) {
        if (phase === 'typing') audio.play('bite', options);
        else if (phase === 'landing') audio.play('landing', { depth: .05, pan: -.22, weightKg: weight.current });
        else if (phase === 'result' && game.outcome === 'escaped') audio.play('escape', options);
        else if (phase === 'retrieved') audio.play('lure', { depth: 0, pan: -.22 });
      }
      if (nibble && nibble !== last.nibble) audio.play('nibble', options);
      if ((jolt && jolt !== last.jolt) || errors > last.errors) audio.play('thrash', options);
      if (phase === 'retrieving' && Math.floor(reeled / 7) > Math.floor(last.reeled / 7) && !nibble) audio.play('lure', { ...position.current, volume: .7 });
      if (phase === 'typing' && typed > last.typed && last.phase === 'typing' && !struggling) audio.play('lure', { ...options, volume: .5 });
    }
    previous.current = { phase, nibble, jolt, errors, reeled, typed };
  }, [audio, game, phase, progress, struggling]);

  useEffect(() => {
    if (!audio || phase !== 'casting') return;
    // Match the splash at the end of the bobber's flight, including reduced motion.
    const timer = window.setTimeout(() => { if (currentPhase.current === 'casting') audio.play('cast', { depth: .62, pan: .2 }); }, 620);
    return () => window.clearTimeout(timer);
  }, [audio, phase]);

  useEffect(() => {
    if (!audio || !struggling) return;
    const timer = window.setInterval(() => audio.play('thrash', { ...position.current, weightKg: weight.current, volume: .7 }), 1150);
    return () => window.clearInterval(timer);
  }, [audio, struggling]);

  useEffect(() => { audio?.rain(rain); }, [audio, rain]);
  useEffect(() => () => audio?.rain(0), [audio]);
  useEffect(() => {
    const element = scene.current;
    if (!audio || !element) return;
    const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(entries => audio.visible(entries[0]?.isIntersecting ?? true));
    observer?.observe(element);
    return () => { observer?.disconnect(); audio.visible(true); };
  }, [audio, scene]);
}
