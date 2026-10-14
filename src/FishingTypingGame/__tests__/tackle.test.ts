import { BALANCE, SPECIES } from '../engine/config';
import { generateEncounter, seededRandom } from '../engine/encounters';
import { biteWaitRange, encounterOdds } from '../engine/feeding';
import { cast, tick, triggerBite } from '../engine/game';
import { awardCatch, deserializeSave, emptySave } from '../engine/storage';
import { allowedRetrieves, ambientLight, DEFAULT_TACKLE, LURES, normalizeTackle, recommendTackle, tackleFactors } from '../engine/tackle';
import { DAY_PERIODS, FishingConditions, MOON_PHASES, SEASONS, TackleSetup, WEATHERS } from '../engine/types';

declare const test: (name: string, fn: () => void) => void;
declare const expect: any;
const daylight: FishingConditions = { season: 'summer', period: 'morning', moonPhase: 'full', weather: 'sunny', tackle: DEFAULT_TACKLE };
const oddsFor = (id: string, c: FishingConditions) => encounterOdds(c).find(row => row.species.id === id)!.chance;

test('all conditions and lure types produce normalized odds and bounded positive waits', () => {
  SEASONS.forEach(season => DAY_PERIODS.forEach(period => MOON_PHASES.forEach(moonPhase => WEATHERS.forEach(weather => LURES.forEach(lure => {
    const c = { season, period, moonPhase, weather, tackle: normalizeTackle({ lure: lure.id }) };
    const odds = encounterOdds(c); const range = biteWaitRange(c);
    expect(odds.every(row => row.chance > 0 && Number.isFinite(row.chance))).toBe(true);
    expect(odds.reduce((sum, row) => sum + row.chance, 0)).toBeCloseTo(1,10);
    expect(range[0]).toBeGreaterThanOrEqual(4500); expect(range[1]).toBeLessThanOrEqual(season==='winter' ? 100000 : 50000); expect(range[1]).toBeGreaterThan(range[0]);
  })))));
});
test('lure type and rig favor appropriate species instead of changing quality or albino rolls', () => {
  const muskie = { ...daylight, season: 'autumn' as const, tackle: normalizeTackle({ lure: 'bucktail', retrieve: 'figure-eight' }) };
  expect(oddsFor('muskie', muskie)).toBeGreaterThan(oddsFor('muskie', daylight) * 10);
  expect(oddsFor('bluegill', daylight)).toBeGreaterThan(oddsFor('bluegill', muskie) * 10);
  const bottom = { ...daylight, tackle: normalizeTackle({ ...DEFAULT_TACKLE, rig: 'bottom' }) };
  expect(oddsFor('sturgeon', bottom)).toBeGreaterThan(oddsFor('sturgeon', daylight) * 5);
  const rng = seededRandom(31), counts: Record<string, number> = {}, qualities: Record<string, number> = {}; let albinos = 0; const n = 40000;
  for (let i = 0; i < n; i++) { const e = generateEncounter(rng, {}, muskie); counts[e.species.id] = (counts[e.species.id] || 0) + 1; qualities[e.quality] = (qualities[e.quality] || 0) + 1; albinos += Number(e.isAlbino); }
  encounterOdds(muskie).forEach(row => expect(Math.abs((counts[row.species.id] || 0) / n - row.chance)).toBeLessThan(.009));
  Object.entries(BALANCE.qualityWeights).forEach(([q,w]) => expect(Math.abs(qualities[q] / n - w / 100)).toBeLessThan(.009));
  expect(Math.abs(albinos / n - BALANCE.albinoChance)).toBeLessThan(.001);
});
test('time, season, moon, weather, color and cadence influence the engine and wait', () => {
  const winter = { ...daylight, season: 'winter' as const };
  expect(biteWaitRange(winter)[0]).toBeGreaterThan(biteWaitRange(daylight)[0]);
  expect(biteWaitRange({ ...daylight, period: 'late-night' })[0]).toBeGreaterThan(biteWaitRange(daylight)[0]);
  const base = { ...daylight, tackle: normalizeTackle({ lure: 'spinnerbait', color: 'silver', retrieve: 'burn' }) };
  expect(oddsFor('bass', { ...base, weather: 'overcast' })).not.toBe(oddsFor('bass', base));
  const slow = { ...winter, tackle: normalizeTackle({ lure: 'spinnerbait', color: 'chartreuse', retrieve: 'slow-roll' }) };
  const fast = { ...slow, tackle: { ...slow.tackle, retrieve: 'burn' as const } };
  expect(biteWaitRange(slow)[0]).toBeLessThan(biteWaitRange(fast)[0]);
  expect(tackleFactors('bass', slow).total).toBeGreaterThan(tackleFactors('bass', fast).total);
  const night = { ...base, period: 'late-night' as const };
  expect(ambientLight(night)).toBeGreaterThan(ambientLight({ ...night, moonPhase: 'new' }));
  expect(tackleFactors('bass', night).color).not.toBe(tackleFactors('bass', { ...night, moonPhase: 'new' }).color);
  expect(oddsFor('muskie', night)).not.toBe(oddsFor('muskie', { ...night, moonPhase: 'new' }));
  expect(ambientLight({ ...daylight, weather: 'thunderstorm', stormAgeMs: 25000 })).toBe(ambientLight(daylight));
  expect(ambientLight({ ...daylight, weather: 'thunderstorm', stormAgeMs: 85000 })).toBeLessThan(ambientLight(daylight));
});
test('normalization rejects impossible combinations and preserves only valid saved tackle', () => {
  expect(normalizeTackle(null)).toEqual(DEFAULT_TACKLE);
  expect(normalizeTackle({ lure: 'not-a-lure', rig: 'texas', color: 'black', retrieve: 'burn' })).toEqual(DEFAULT_TACKLE);
  expect(normalizeTackle({ lure: 'crankbait', rig: 'texas', retrieve: 'still' })).toMatchObject({ rig: 'direct', retrieve: 'steady' });
  expect(normalizeTackle({ lure: 'minnow', color: 'chartreuse' }).color).toBe('natural');
  expect(allowedRetrieves('worm','float')).not.toContain('slow-drag');
  const saved = emptySave(); saved.tackle = normalizeTackle({ lure: 'large-crankbait', retrieve: 'twitch-pause' });
  expect(deserializeSave(JSON.stringify(saved)).tackle).toEqual(saved.tackle);
  const legacy: any = { ...saved }; delete legacy.tackle;
  expect(deserializeSave(JSON.stringify(legacy)).tackle).toEqual(DEFAULT_TACKLE);
});
test('recommendations stay compatible and change for cold-water bass and autumn muskie', () => {
  SPECIES.forEach(s => recommendTackle(s.id, daylight).forEach(r => expect(normalizeTackle(r.setup)).toEqual(r.setup)));
  expect(recommendTackle('sturgeon', daylight)[0].setup).toMatchObject({ lure: 'worm', rig: 'bottom' });
  expect(recommendTackle('bass', { ...daylight, season: 'winter' })[0].setup.lure).not.toBe('popper');
  expect(recommendTackle('muskie', { ...daylight, season: 'autumn' })[0].setup.rig).toBe('leader');
  expect(recommendTackle('bass', { ...daylight, season: 'winter' })).not.toEqual(recommendTackle('bass', { ...daylight, period: 'dusk' }));
});
test('cast fixes its tackle and wait while sampling fresh environmental conditions at bite', () => {
  const gear: TackleSetup = { ...DEFAULT_TACKLE }; const c = { ...daylight, tackle: gear };
  const state = cast({ phase: 'idle' }, 100, () => 0, c);
  expect(state.phase).toBe('casting'); if (state.phase !== 'casting') return;
  expect(state.biteAt).toBe(100 + BALANCE.castMs + biteWaitRange(c)[0]);
  gear.rig = 'bottom';
  const waiting = tick(state, state.waitAt); expect(waiting.phase).toBe('waiting');
  const fresh = { ...c, season: 'winter' as const, weather: 'rain' as const, tackle: normalizeTackle({ lure: 'spoon' }) };
  const bite = triggerBite(waiting, state.biteAt, seededRandom(10), {}, fresh);
  expect(bite.phase).toBe('typing'); if (bite.phase !== 'typing') return;
  expect(bite.encounter.conditions).toMatchObject({ season: 'winter', weather: 'rain', tackle: DEFAULT_TACKLE });
  const saved = awardCatch(emptySave(), bite.encounter, { wpm: 40, accuracy: 100, correctCharacters: 20, timeRemaining: 2 });
  expect(deserializeSave(JSON.stringify(saved)).livewell[0].conditions).toEqual(bite.encounter.conditions);
  fresh.tackle.color = 'black'; expect(bite.encounter.conditions!.tackle!.color).toBe('natural');
});
