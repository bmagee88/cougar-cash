import { BALANCE, SPECIES } from './config';
import { selectPhrase } from './phrases';
import { fishingMultiplier } from './feeding';
import { normalizeTackle } from './tackle';
import { Encounter, EncounterOverrides, FishingConditions, Quality, QUALITIES, Random, Rarity, Weather } from './types';

export function castDistance(weather?: Weather) {
  return weather === 'wind' ? 1.2 : weather === 'thunderstorm' ? 1.35 : weather === 'blizzard' ? 1.5 : weather === 'hurricane' ? 1.65 : 1;
}

export function seededRandom(seed: number): Random {
  return () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function weighted<T>(values: T[], weight: (item: T) => number, random: Random): T {
  let roll = random() * values.reduce((sum, item) => sum + weight(item), 0);
  return values.find(item => (roll -= weight(item)) < 0) || values[values.length - 1];
}
// A split bell curve has its mode at zero, a long easy side, and a short hard side.
// Every integer offset has positive mass, including both requested endpoints.
export const WPM_CURVE = Array.from({ length: BALANCE.adjustmentMax - BALANCE.adjustmentMin + 1 }, (_, i) => {
  const adjustment = BALANCE.adjustmentMin + i;
  const sigma = (adjustment < 0 ? -BALANCE.adjustmentMin : BALANCE.adjustmentMax) / 3;
  return { adjustment, weight: Math.exp(-0.5 * Math.pow(adjustment / sigma, 2)) };
});
export function difficulty(rarity: Rarity, quality: Quality, isAlbino: boolean, random: Random, forcedAdjustment?: number) {
  const wpmAdjustment = forcedAdjustment === undefined ? weighted(WPM_CURVE, point => point.weight, random).adjustment : Math.max(BALANCE.adjustmentMin, Math.min(BALANCE.adjustmentMax, Math.round(forcedAdjustment)));
  const base = BALANCE.baseWpm[rarity] + BALANCE.qualityBonus[quality] + (isAlbino ? BALANCE.albinoBonus : 0);
  return { wpmAdjustment, targetWpm: Math.max(BALANCE.minWpm, Math.min(BALANCE.maxWpm, base + wpmAdjustment)) };
}
let encounterSequence = 0;
export function generateEncounter(random: Random = Math.random, overrides: EncounterOverrides = {}, conditions?: FishingConditions): Encounter {
  const population = overrides.rarity ? SPECIES.filter(f => f.rarity === overrides.rarity) : SPECIES;
  const species = SPECIES.find(f => f.id === overrides.speciesId) || weighted(population, f => f.encounterWeight * (conditions ? fishingMultiplier(f.id, conditions) : 1), random);
  const quality = overrides.quality || weighted(Object.keys(BALANCE.qualityWeights) as Quality[], q => BALANCE.qualityWeights[q], random);
  const isAlbino = overrides.isAlbino ?? random() < BALANCE.albinoChance;
  const result = difficulty(species.rarity, quality, isAlbino, random, overrides.wpmAdjustment);
  const baseWpm = overrides.targetWpm === undefined ? result.targetWpm : Math.max(BALANCE.minWpm, Math.min(BALANCE.maxWpm, overrides.targetWpm));
  const distance = overrides.castDistance ?? castDistance(conditions?.weather);
  const targetWpm = Math.max(1, baseWpm * distance * Math.max(.15, Math.min(1, overrides.lineRemaining ?? 1)));
  const size = Math.max(0, Math.min(1, [0.12, 0.32, 0.52, 0.73, 0.92][QUALITIES.indexOf(quality)] + (random() - 0.5) * 0.22));
  return { id: `fish-${Date.now()}-${++encounterSequence}-${Math.floor(random() * 1e9)}`, species, quality, isAlbino, targetWpm,
    wpmAdjustment: result.wpmAdjustment, castDistance: distance, ...(conditions ? { conditions: { season: conditions.season, period: conditions.period, moonPhase: conditions.moonPhase,
      ...(conditions.weather ? { weather: conditions.weather } : {}), ...(conditions.stormAgeMs !== undefined ? { stormAgeMs: conditions.stormAgeMs } : {}),
      ...(conditions.weatherDurationMs !== undefined ? { weatherDurationMs: conditions.weatherDurationMs } : {}),
      ...(conditions.observedRetrieve ? { observedRetrieve: conditions.observedRetrieve } : {}),
      ...(conditions.tackle ? { tackle: normalizeTackle(conditions.tackle) } : {}) } } : {}), phrase: selectPhrase(targetWpm, random),
    lengthCm: +(species.lengthCm[0] + size * (species.lengthCm[1] - species.lengthCm[0])).toFixed(1),
    weightKg: +(species.weightKg[0] + Math.pow(size, 2.7) * (species.weightKg[1] - species.weightKg[0])).toFixed(2) };
}
