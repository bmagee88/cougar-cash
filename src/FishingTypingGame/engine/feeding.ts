import { SPECIES } from './config';
import { DAY_PERIODS, FishingConditions, MOON_PHASES, Season } from './types';
import { tackleMultiplier, weatherMultiplier } from './tackle';

type DayWeights = [number, number, number, number, number, number];
type Activity = Record<Season, DayWeights>;
// Relative game weights inferred from DNR guidance and published studies.
// They are NOT measured feeding probabilities. Sources and limits: feeding-research.md.
export const FEEDING: Record<string, Activity> = {
  bluegill: { spring: [1.2,1.35,.95,1.3,.2,.12], summer: [1.3,1.4,.7,1.45,.2,.12], autumn: [.95,1.1,1.3,1.05,.2,.12], winter: [.65,.8,.95,.7,.15,.1] },
  perch: { spring: [1.2,1.35,1.25,1.3,.15,.1], summer: [1.3,1.25,.8,1.35,.15,.1], autumn: [1.2,1.35,1.25,1.3,.15,.1], winter: [1,1.25,1.15,1.1,.15,.1] },
  crappie: { spring: [1.4,1.25,1.2,1.55,1.1,.8], summer: [1.2,.75,.6,1.4,1.1,.9], autumn: [1.2,.9,.8,1.4,1.15,.9], winter: [1,.8,.8,1.25,1.1,.9] },
  bass: { spring: [1.25,1.35,1.1,1.35,.75,.55], summer: [1.4,1.2,.65,1.5,1.05,.8], autumn: [1.15,1.2,1.3,1.25,.65,.45], winter: [.4,.55,.65,.45,.25,.2] },
  walleye: { spring: [1.5,1,.7,1.65,1.5,1.2], summer: [1.4,.8,.5,1.6,1.55,1.3], autumn: [1.55,1.15,.85,1.75,1.55,1.3], winter: [1.1,.8,.7,1.35,1.15,.95] },
  pike: { spring: [1.4,1.4,1.2,1.55,.25,.15], summer: [1.2,1,.65,1.3,.2,.12], autumn: [1.4,1.35,1.25,1.6,.25,.15], winter: [1,1.1,1,1.1,.2,.12] },
  muskie: { spring: [.9,1.1,1.2,1.05,.65,.45], summer: [1.4,1.15,.85,1.55,1.1,.8], autumn: [1.4,1.35,1.65,1.6,1.15,.85], winter: [.5,.6,.75,.65,.4,.3] },
  sturgeon: { spring: [.85,.65,.7,1.1,1.25,1.4], summer: [1,.7,.7,1.2,1.5,1.6], autumn: [.95,.65,.7,1.2,1.45,1.5], winter: [.55,.4,.45,.7,.85,.9] },
};
export const FEEDING_NOTES: Record<string, string> = {
  bluegill: 'Sight feeder: early and late daylight in spring and summer; warmer afternoons in autumn.',
  perch: 'Feeds by day, often near shore morning and evening; remains active in winter.',
  crappie: 'Strong spring shore activity; feeding near dawn and dusk later in the year; active in winter.',
  bass: 'Morning and dusk shallows; spring and autumn shore activity; slower winter activity.',
  walleye: 'Low-light feeder: dawn, dusk and night. Modest gibbous-moon weighting.',
  pike: 'Mostly daylight feeding, especially morning and dusk; stays active in cold water.',
  muskie: 'Dawn and dusk, summer and autumn. Cool-season afternoons can be productive.',
  sturgeon: 'Adult activity is often nocturnal; winter feeding can slow. Movement is a feeding proxy.',
};
export const FEEDING_SOURCES = [
  { label: 'Bluegill · Minnesota DNR', url: 'https://www.dnr.state.mn.us/gofishing/how-catch-sunfish.html' },
  { label: 'Yellow perch · Michigan DNR', url: 'https://www.michigan.gov/dnr/education/michigan-species/fish-species/yellow-perch' },
  { label: 'Crappie · Minnesota DNR', url: 'https://www.dnr.state.mn.us/gofishing/how-catch-crappie.html' },
  { label: 'Bass · Minnesota DNR', url: 'https://www.dnr.state.mn.us/gofishing/how-catch-largemouth-bass.html' },
  { label: 'Walleye · Minnesota DNR', url: 'https://www.dnr.state.mn.us/gofishing/how-catch-walleye.html' },
  { label: 'Pike · Minnesota DNR', url: 'https://www.dnr.state.mn.us/gofishing/how-catch-northern-pike.html' },
  { label: 'Muskellunge · Minnesota DNR', url: 'https://www.dnr.state.mn.us/gofishing/how-catch-muskellunge.html' },
  { label: 'Winter fishing · Wisconsin DNR', url: 'https://dnr.wisconsin.gov/topic/Fishing/outreach/hookyourcatch.html' },
  { label: 'Bass lunar telemetry · Hanson et al. 2008', url: 'https://doi.org/10.1111/j.1365-2400.2008.00634.x' },
  { label: 'Pike lunar catch study · Kuparinen et al. 2010', url: 'https://www.agrar.hu-berlin.de/de/institut/departments/dntw/jp_bfm/publ_html/kuparinen-et-al-2010' },
  { label: 'Muskellunge lunar catch study · Vinson & Angradi 2014', url: 'https://doi.org/10.1371/journal.pone.0098046' },
  { label: 'Walleye and muskie lunar study · 2021', url: 'https://doi.org/10.1371/journal.pone.0257882' },
  { label: 'Lake sturgeon night activity · Kough et al. 2018', url: 'https://doi.org/10.1016/j.jglr.2017.10.008' },
  { label: 'Lake sturgeon ecology · Peterson et al. 2007', url: 'https://doi.org/10.1007/s11160-006-9018-6' },
];
export function moonMultiplier(speciesId: string, conditions: FishingConditions) {
  const index = MOON_PHASES.indexOf(conditions.moonPhase);
  if (speciesId === 'walleye') return [1.02,1.08,.97,1,1.02,1,.97,1.08][index];
  if (speciesId === 'pike') return [1.08,1.04,1,1.04,1.08,1.04,1,1.04][index];
  if (speciesId === 'muskie') {
    const night = conditions.period === 'early-night' || conditions.period === 'late-night';
    return (night ? [1.2,1.1,1,1,1.03,1,1,1.1] : [1.05,1.025,1,1.025,1.05,1.025,1,1.025])[index];
  }
  // No reliable phase-specific feeding relationship located for these species.
  // Sturgeon lunar spawning cues are not treated as feeding evidence.
  return 1;
}
export function feedingMultiplier(speciesId: string, conditions: FishingConditions) {
  return (FEEDING[speciesId]?.[conditions.season][DAY_PERIODS.indexOf(conditions.period)] ?? 1) * moonMultiplier(speciesId, conditions);
}
export function fishingMultiplier(speciesId: string, conditions: FishingConditions) {
  return feedingMultiplier(speciesId, conditions) * weatherMultiplier(speciesId, conditions) * tackleMultiplier(speciesId, conditions);
}
export function encounterOdds(conditions: FishingConditions) {
  const weights = SPECIES.map(species => ({ species, activity: fishingMultiplier(species.id, conditions), weight: species.encounterWeight * fishingMultiplier(species.id, conditions) }));
  const total = weights.reduce((sum, row) => sum + row.weight, 0);
  return weights.map(row => ({ ...row, chance: row.weight / total }));
}
// The same unnormalized bite weights drive the wait and the species roll.
// Square-root scaling keeps targeting scarce predators playable. Global wait x2;
// winter stacks another x2. Spring moving-lure bonus is a requested game rule.
export function springRetrieveBonus(conditions?: FishingConditions) {
  return conditions?.season === 'spring' && conditions.tackle && ['crankbait','spinnerbait','spoon','bucktail','large-crankbait'].includes(conditions.tackle.lure)
    && ['steady','burn','figure-eight'].includes(conditions.observedRetrieve ?? conditions.tackle.retrieve) ? .75 : 1;
}
export function biteWaitRange(conditions?: FishingConditions): [number, number] {
  if (!conditions) return [10000,20000];
  const total = encounterOdds(conditions).reduce((sum, row) => sum + row.weight, 0);
  const rate = Math.max(.4, Math.min(1.65, Math.sqrt(total / 100)));
  const scale = 2 * (conditions.season === 'winter' ? 2 : 1) * springRetrieveBonus(conditions);
  return [Math.round(5 / rate) * 1000 * scale, Math.round(10 / rate) * 1000 * scale];
}
