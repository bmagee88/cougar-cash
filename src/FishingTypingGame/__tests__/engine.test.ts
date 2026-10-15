import { BALANCE, LOCATIONS, SPECIES } from '../engine/config';
import { difficulty, generateEncounter, seededRandom, WPM_CURVE } from '../engine/encounters';
import { applyKey, cast, createTyping, tick, triggerBite, typeKey } from '../engine/game';
import { PHRASE_INDEX, selectPhrase, targetCharacters } from '../engine/phrases';
import { awardCatch, awardEscape, deserializeSave, emptySave, persistSave, readSave, releaseFish, SAVE_KEY, travel } from '../engine/storage';
import { ANGLER_OUTFITS, CEDAR_SCENE, COVE_SCENES, FISHING_ART, MOON_ART, SEASON_ART } from '../scene/manifest';
import { characterState } from '../scene/FishingScene';
import { GameState, QUALITIES, RARITIES } from '../engine/types';
import { CLOUD_ART } from '../scene/CloudSystem';

declare const test: (name: string, fn: () => void) => void;
declare const expect: any;
const performance = { wpm: 35, accuracy: 98, timeRemaining: 2, correctCharacters: 25 };
test('seeded encounter population follows species weights and independent quality and albino rates', () => {
  const random = seededRandom(1729); const n = 100000; const species: Record<string, number> = {}; const qualities: Record<string, number> = {}; let albinos = 0;
  for (let i = 0; i < n; i++) { const e = generateEncounter(random); species[e.species.id] = (species[e.species.id] || 0) + 1; qualities[e.quality] = (qualities[e.quality] || 0) + 1; albinos += Number(e.isAlbino); }
  SPECIES.forEach(s => expect(Math.abs((species[s.id] || 0) / n - s.encounterWeight / 100)).toBeLessThan(0.007));
  QUALITIES.forEach(q => expect(Math.abs(qualities[q] / n - BALANCE.qualityWeights[q] / 100)).toBeLessThan(0.007));
  expect(Math.abs(albinos / n - BALANCE.albinoChance)).toBeLessThan(0.0006);
});
test('quality and albino bonuses raise ordinary difficulty by the configured amount', () => {
  const base = difficulty('Rare', 'C', false, seededRandom(50), 0).targetWpm;
  expect(difficulty('Rare', 'SS', false, seededRandom(50), 0).targetWpm - base).toBeCloseTo(24);
  expect(difficulty('Rare', 'C', true, seededRandom(50), 0).targetWpm - base).toBeCloseTo(12);
  expect(difficulty('Ultra-Rare', 'SS', true, () => 0.25, 0).targetWpm).toBeCloseTo(110);
});
test('every rarity quality and albino combination is possible without a speed prerequisite', () => {
  RARITIES.forEach(rarity => QUALITIES.forEach(quality => [false, true].forEach(isAlbino => {
    const e = generateEncounter(seededRandom(2), { rarity, quality, isAlbino });
    expect([e.species.rarity, e.quality, e.isAlbino]).toEqual([rarity, quality, isAlbino]);
    expect(e.lengthCm).toBeGreaterThanOrEqual(e.species.lengthCm[0]); expect(e.weightKg).toBeLessThanOrEqual(e.species.weightKg[1]);
  })));
});
test('equivalent encounters roll the bell curve independently and vary their text lengths', () => {
  const rng = seededRandom(7); const wpms = new Set<number>(); const phrases = new Set<string>();
  for (let i = 0; i < 100; i++) { const e = generateEncounter(rng, { rarity: 'Rare', quality: 'B', isAlbino: false }); wpms.add(e.targetWpm); phrases.add(e.phrase); }
  expect(wpms.size).toBeGreaterThan(20); expect(phrases.size).toBeGreaterThan(20);
});
test('the split bell curve peaks at zero, reaches both requested tails, and floors at one WPM', () => {
  const mode = WPM_CURVE.find(p => p.adjustment === 0)!;
  expect(WPM_CURVE.every(p => p.weight > 0 && p.weight <= mode.weight)).toBe(true);
  expect(WPM_CURVE.filter(p => p.weight === mode.weight)).toHaveLength(1);
  expect(difficulty('Rare', 'C', false, () => 0).wpmAdjustment).toBe(-50);
  expect(difficulty('Rare', 'C', false, () => 1 - Number.EPSILON).wpmAdjustment).toBe(10);
  expect(difficulty('Common', 'C', false, Math.random, -50).targetWpm).toBe(1);
  expect(difficulty('Ultra-Rare', 'SS', true, Math.random, -50).targetWpm).toBe(60);
  expect(difficulty('Ultra-Rare', 'SS', true, Math.random, 10).targetWpm).toBe(120);
  const rng = seededRandom(17); const counts = new Map<number, number>();
  for (let i = 0; i < 100000; i++) { const offset = difficulty('Rare', 'C', false, rng).wpmAdjustment; counts.set(offset, (counts.get(offset) || 0) + 1); }
  const total = WPM_CURVE.reduce((sum, p) => sum + p.weight, 0);
  WPM_CURVE.forEach(p => expect(Math.abs((counts.get(p.adjustment) || 0) / 100000 - p.weight / total)).toBeLessThan(.003));
});
test('curated complete phrases approximate character targets across the supported WPM range', () => {
  expect(Array.from(PHRASE_INDEX.values()).reduce((n, p) => n + p.length, 0)).toBeGreaterThan(1000);
  for (let wpm = 1; wpm <= 130; wpm++) { const text = selectPhrase(wpm, seededRandom(wpm)); expect(Math.abs(text.length - targetCharacters(wpm))).toBeLessThanOrEqual(BALANCE.phraseTolerance); expect(text).toMatch(/^[a-z]+(?: [a-z]+)*$/); }
  expect(selectPhrase(1, seededRandom(1))).toHaveLength(1);
});
test('typing the exact phrase before the monotonic deadline guarantees a catch', () => {
  const e = generateEncounter(seededRandom(9)); let state: GameState = { phase: 'typing', encounter: e, typing: createTyping(e.phrase, 100) };
  Array.from(e.phrase).forEach((key, i) => { state = typeKey(state, key, 101 + i * 20); });
  expect(state.phase).toBe('landing'); expect((state as any).encounter.id).toBe(e.id);
  const result = tick(state, 20000); expect(result.phase).toBe('result'); expect((result as any).outcome).toBe('caught');
});
test('expiration and input at or after the deadline escape and never reveal the fish', () => {
  const e = generateEncounter(seededRandom(9)); const state: GameState = { phase: 'typing', encounter: e, typing: createTyping('a', 0) };
  [tick(state, 10000), typeKey(state, 'a', 10000), typeKey(state, 'a', 15000)].forEach(result => { expect(result).toMatchObject({ phase: 'result', outcome: 'escaped' }); expect('encounter' in result).toBe(false); });
});
test('a wrong character blocks progress until Backspace corrects it and accuracy includes errors', () => {
  let state = applyKey(createTyping('lake', 0), 'x', 10);
  state = applyKey(state, 'l', 20); expect(state.typed).toBe('x'); expect(state.finishedAt).toBeUndefined();
  state = applyKey(state, 'Backspace', 30); 'lake'.split('').forEach((key, i) => { state = applyKey(state, key, 40 + i); });
  expect(state.typed).toBe('lake'); expect(state.finishedAt).toBeDefined(); expect(state.errors).toBe(2);
});
test('persistent catches reload, awards are idempotent, and release preserves lifetime records', () => {
  localStorage.removeItem(SAVE_KEY); const e = generateEncounter(seededRandom(10)); const saved = awardCatch(emptySave(), e, performance);
  expect(awardCatch(saved, e, performance)).toBe(saved); expect(persistSave(saved)).toBe(true); expect(readSave()).toEqual(saved);
  const released = releaseFish(readSave(), e.id); persistSave(released); const reloaded = readSave();
  expect(reloaded.livewell).toHaveLength(0); expect(reloaded.stats.caught).toBe(1); expect(reloaded.stats.discovered).toContain(e.species.id); expect(reloaded.stats.byQuality[e.quality]).toBe(1);
  const escaped = awardEscape(reloaded, { ...performance, wpm: 50 }); expect(escaped.stats.bestWpm).toBe(50); expect(escaped.stats.totalWpm).toBe(85); expect(escaped.stats.escaped).toBe(1); expect(escaped.stats.currentStreak).toBe(0); expect(escaped.stats.discovered).toEqual(reloaded.stats.discovered);
  expect(deserializeSave('{bad')).toEqual(emptySave()); expect(deserializeSave('{"version":1,"livewell":[],"stats":{},"awardedIds":[]}')).toEqual(emptySave());
});
test('travel spends coins on scenery and the same seeded population applies to both spots', () => {
  const dock = emptySave(); const cove = travel(dock, 'cove'); expect(cove.balance).toBe(dock.balance - LOCATIONS[1].cost);
  expect(travel({ ...dock, balance: 0 }, 'cove')).toEqual({ ...dock, balance: 0 });
  const a = seededRandom(81), b = seededRandom(81);
  for (let i = 0; i < 1000; i++) { const x = generateEncounter(a); const y = generateEncounter(b); expect([x.species.id, x.quality, x.isAlbino, x.targetWpm, x.phrase]).toEqual([y.species.id, y.quality, y.isAlbino, y.targetWpm, y.phrase]); }
});
test('all gameplay phases advance on deadlines without waiting for animations and duplicate casts are ignored', () => {
  const now = 10; const state = cast({ phase: 'idle' }, now, () => 0);
  expect(cast(state, now + 1)).toBe(state); expect(tick(state, now + BALANCE.castMs).phase).toBe('waiting');
  const bitten = tick(state, now + BALANCE.castMs + 10000, seededRandom(1)); expect(bitten.phase).toBe('typing'); expect(tick(bitten, now + BALANCE.castMs + 20000).phase).toBe('result');
  expect(triggerBite(bitten, now)).toBe(bitten);
  expect(characterState({ phase: 'idle' })).toBe('idle'); expect(characterState(state)).toBe('casting'); expect(characterState(bitten)).toBe('reeling');
});
test('all manifests and species illustrations reference bundled local files', () => {
  const fs = require('fs'); const path = require('path');
  const files = [...[...CEDAR_SCENE, ...Object.values(COVE_SCENES).flat()].filter(l => l.src).map(l => l.src!), ...Object.values(CLOUD_ART), ...Object.values(FISHING_ART), ...Object.values(ANGLER_OUTFITS), MOON_ART, ...Object.values(SEASON_ART).flatMap(Object.values), ...SPECIES.flatMap(s => [s.artwork, s.albinoArtwork])];
  files.forEach(src => { expect(src).toMatch(/^\/assets\/fishing\//); expect(fs.existsSync(path.join(__dirname, '../../../public', src))).toBe(true); });
});
