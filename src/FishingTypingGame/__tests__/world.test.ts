import { SPECIES, BALANCE } from '../engine/config';
import { generateEncounter, seededRandom } from '../engine/encounters';
import { encounterOdds, feedingMultiplier, moonMultiplier } from '../engine/feeding';
import { cast, tick } from '../engine/game';
import { awardCatch, emptySave, deserializeSave } from '../engine/storage';
import { DAY_PERIODS, MOON_PHASES, SEASONS } from '../engine/types';
import { celestialPosition, gameClock, lightingAt, moonlightAt, MOON_LIGHT, periodAt, WORLD, worldAt } from '../engine/world';

declare const test: (name: string, fn: () => void) => void;
declare const expect: any;

test('seasons rotate at New York midnight, remain stable across DST, and ignore reloads', () => {
  const before = worldAt(Date.parse('2026-10-12T23:59:59-04:00'));
  const after = worldAt(Date.parse('2026-10-13T00:00:00-04:00'));
  expect(before.season).toBe('autumn'); expect(after.season).toBe('winter');
  expect(worldAt(Date.parse('2026-10-14T00:00:00-04:00')).season).toBe('spring');
  expect(worldAt(Date.parse('2026-10-15T00:00:00-04:00')).season).toBe('summer');
  expect(worldAt(Date.parse('2026-11-01T01:30:00-04:00')).season).toBe(worldAt(Date.parse('2026-11-01T01:30:00-05:00')).season);
  expect(worldAt(WORLD.epoch)).toEqual(worldAt(WORLD.epoch));
});
test('a 48-minute day has six eight-minute periods and one moon phase per day in the specified order', () => {
  expect(WORLD.dayMs).toBe(48 * 60000);
  expect([0,4,8,12,16,20].map(periodAt)).toEqual(['late-night', ...DAY_PERIODS.slice(0,5)]);
  expect(periodAt(3.999)).toBe('late-night'); expect(periodAt(24)).toBe('late-night');
  MOON_PHASES.forEach((phase, i) => {
    expect(worldAt(WORLD.epoch + i * WORLD.dayMs).moonPhase).toBe(phase);
    expect(worldAt(WORLD.epoch + (i + 1) * WORLD.dayMs - 1).moonPhase).toBe(phase);
  });
  expect(worldAt(WORLD.epoch + WORLD.dayMs * 8).moonPhase).toBe('full');
  expect(worldAt(WORLD.epoch + WORLD.dayMs / 2).hour).toBe(12);
  expect(worldAt(WORLD.epoch + WORLD.dayMs - 1).hour).toBeLessThan(24);
  expect(gameClock(14.5)).toBe('14:30');
});
test('celestial arcs cross the sky, daylight is brighter, late night has stars, and preview overrides stay local', () => {
  expect(celestialPosition(6).x).toBeLessThan(celestialPosition(12).x);
  expect(celestialPosition(12).x).toBeLessThan(celestialPosition(17).x);
  expect(celestialPosition(12).y).toBeLessThan(celestialPosition(6).y);
  expect(celestialPosition(2).visible).toBe(false);
  expect(celestialPosition(2, true).visible).toBe(true);
  expect(celestialPosition(12, true).visible).toBe(false);
  expect(lightingAt(12, 'full').brightness).toBeGreaterThan(lightingAt(2, 'full').brightness);
  expect(lightingAt(2, 'full').stars).toBe(1);
  expect(lightingAt(12, 'full').stars).toBe(0);
  expect(lightingAt(2, 'full').brightness).toBeGreaterThan(lightingAt(2, 'new').brightness);
  const real = worldAt(WORLD.epoch); const preview = worldAt(WORLD.epoch, { hour: 18, season: 'winter', moonPhase: 'waxing-half' });
  expect(preview).toMatchObject({ hour: 18, period: 'dusk', season: 'winter', moonPhase: 'waxing-half' });
  expect(worldAt(WORLD.epoch)).toEqual(real);
});
test('all season/time/moon combinations keep every species possible and odds normalized', () => {
  SEASONS.forEach(season => DAY_PERIODS.forEach(period => MOON_PHASES.forEach(moonPhase => {
    const odds = encounterOdds({ season, period, moonPhase });
    expect(odds).toHaveLength(SPECIES.length);
    expect(odds.every(row => row.chance > 0 && Number.isFinite(row.chance))).toBe(true);
    expect(odds.reduce((sum, row) => sum + row.chance, 0)).toBeCloseTo(1, 10);
  })));
  expect(feedingMultiplier('bluegill', { season: 'summer', period: 'dusk', moonPhase: 'full' })).toBeGreaterThan(feedingMultiplier('bluegill', { season: 'summer', period: 'late-night', moonPhase: 'full' }));
  expect(feedingMultiplier('bass', { season: 'summer', period: 'dusk', moonPhase: 'new' })).toBeGreaterThan(feedingMultiplier('bass', { season: 'winter', period: 'dusk', moonPhase: 'new' }));
  ['bluegill','perch','crappie','bass','sturgeon'].forEach(id => MOON_PHASES.forEach(moonPhase => expect(moonMultiplier(id, { season: 'summer', period: 'late-night', moonPhase })).toBe(1)));
});

test('night brightness is halved for every moon phase while daylight and twilight remain continuous', () => {
  MOON_PHASES.forEach((phase, i) => {
    expect(lightingAt(2, phase).brightness).toBeCloseTo((.43 + MOON_LIGHT[i] * .07) / 2, 10);
    expect(lightingAt(20, phase).brightness).toBeCloseTo((.48 + MOON_LIGHT[i] * .07) / 2, 10);
    expect(lightingAt(12, phase).brightness).toBe(1.02);
    [4,6,18,20,24].forEach(hour => {
      const before = lightingAt(Math.max(0, hour - .0001), phase).brightness;
      const after = lightingAt(Math.min(24, hour + .0001), phase).brightness;
      expect(Math.abs(before - after)).toBeLessThan(.0001);
    });
  });
});

test('the moonlight wash follows phase, elevation, actual night and visible sky', () => {
  expect(moonlightAt(0, 'full')).toBe(1);
  expect(moonlightAt(0, 'waning-three-quarter')).toBe(.75);
  expect(moonlightAt(0, 'waning-half')).toBe(.5);
  expect(moonlightAt(0, 'waning-quarter')).toBe(.25);
  expect(moonlightAt(0, 'new')).toBe(0);
  expect(moonlightAt(0, 'waxing-half')).toBe(moonlightAt(0, 'waning-half'));
  [6,12,14,18].forEach(hour => expect(moonlightAt(hour, 'full')).toBe(0));
  expect(moonlightAt(19, 'full')).toBeLessThan(moonlightAt(22, 'full'));
  expect(moonlightAt(5, 'full')).toBeLessThan(moonlightAt(2, 'full'));
  expect(moonlightAt(2, 'full', .25)).toBeCloseTo(moonlightAt(2, 'full') * .25, 10);
  expect(moonlightAt(2, 'full', 0)).toBe(0);
  expect(moonlightAt(2, 'full', 3)).toBe(moonlightAt(2, 'full'));
});
test('feeding-weighted populations match displayed odds while quality and albino rolls remain independent', () => {
  const conditions = { season: 'summer', period: 'late-night', moonPhase: 'full' } as const;
  const rng = seededRandom(4711); const n = 60000; const counts: Record<string, number> = {}; const quality: Record<string, number> = {}; let albino = 0;
  for (let i = 0; i < n; i++) { const fish = generateEncounter(rng, {}, conditions); counts[fish.species.id] = (counts[fish.species.id] || 0) + 1; quality[fish.quality] = (quality[fish.quality] || 0) + 1; albino += Number(fish.isAlbino); }
  encounterOdds(conditions).forEach(row => expect(Math.abs((counts[row.species.id] || 0) / n - row.chance)).toBeLessThan(.008));
  Object.entries(BALANCE.qualityWeights).forEach(([q, weight]) => expect(Math.abs(quality[q] / n - weight / 100)).toBeLessThan(.008));
  expect(Math.abs(albino / n - BALANCE.albinoChance)).toBeLessThan(.001);
});
test('conditions are sampled at bite, frozen through the challenge, and retained with catches in old compatible saves', () => {
  const conditions = worldAt(WORLD.epoch + WORLD.dayMs);
  const state = tick(cast({ phase: 'idle' }, 0, () => 0), 10900, seededRandom(1), {}, conditions);
  expect(state.phase).toBe('typing'); if (state.phase !== 'typing') return;
  expect(state.encounter.conditions).toEqual({ season: conditions.season, period: conditions.period, moonPhase: conditions.moonPhase });
  const saved = awardCatch(emptySave(), state.encounter, { wpm: 25, accuracy: 100, correctCharacters: 20, timeRemaining: 1 });
  expect(deserializeSave(JSON.stringify(saved)).livewell[0].conditions).toEqual(state.encounter.conditions);
  delete saved.livewell[0].conditions;
  expect(deserializeSave(JSON.stringify(saved)).livewell).toHaveLength(1);
});
