import { FishingConditions, LureColor, LureType, RigType, Retrieve, TackleSetup } from './types';
import { MOON_LIGHT } from './world';
import { MOON_PHASES } from './types';

export const COLORS: Record<LureColor, { name: string; swatch: string }> = {
  natural: { name: 'Natural bait', swatch: '#b89a70' }, silver: { name: 'Silver / pearl', swatch: '#d5e3df' },
  perch: { name: 'Natural perch', swatch: '#b2a253' }, chartreuse: { name: 'Chartreuse / white', swatch: '#d3e452' },
  black: { name: 'Black / blue', swatch: '#262e4a' }, 'green-pumpkin': { name: 'Green pumpkin', swatch: '#728053' },
};
export const RIGS: Record<RigType, { name: string; detail: string }> = {
  float: { name: 'Shallow fixed float', detail: 'Small hook and split shot; suspend the bait in the shallow shoreline water.' },
  'slip-float': { name: 'Adjustable slip float', detail: 'Bobber stop and split shot; suspend bait above deeper cover or a reef.' },
  bottom: { name: 'Slip-sinker bottom rig', detail: 'Sliding sinker and leader; present fresh bait at the bottom. A worm bundle uses a larger hook for sturgeon.' },
  jighead: { name: 'Open jighead', detail: 'Let the weighted head fall, then work the bait at the chosen depth.' },
  texas: { name: 'Weedless Texas rig', detail: 'Bullet weight and buried worm hook for fishing shoreline vegetation.' },
  carolina: { name: 'Carolina bottom rig', detail: 'Sliding weight, swivel and leader; drag the plastic behind the weight along deeper structure.' },
  direct: { name: 'Direct tie', detail: 'Tie the lure to the main line; work it at its intended running depth.' },
  leader: { name: 'Tooth-resistant leader', detail: 'Steel or heavy fluorocarbon leader ahead of the lure for pike and muskie.' },
};
export const RETRIEVES: Record<Retrieve, { name: string; detail: string }> = {
  still: { name: 'Hold still', detail: 'Let the bait move naturally; keep it suspended or resting near the bottom.' },
  'lift-pause': { name: 'Small lifts and pauses', detail: 'Lift gently, let the jig fall and pause. Keep the movements subtle for nearby fish.' },
  'slow-drag': { name: 'Slow bottom drag', detail: 'Move the bait slowly along bottom, pausing between short pulls.' },
  'slow-roll': { name: 'Slow steady retrieve', detail: 'Reel just fast enough for the blade or lure action to work; keep the bait deeper.' },
  steady: { name: 'Steady swimming retrieve', detail: 'Use a moderate, even retrieve to imitate swimming prey.' },
  burn: { name: 'Fast retrieve', detail: 'A quick moving presentation for active predators in warmer water.' },
  'twitch-pause': { name: 'Twitch, twitch, pause', detail: 'Short rod twitches imitate an injured minnow; pause between bursts.' },
  'long-pause': { name: 'Twitch with longer pauses', detail: 'Allow the suspending lure to hover between short twitches in cold water.' },
  'pop-pause': { name: 'Pop and pause', detail: 'Make a small surface splash, then pause before the next pop.' },
  'figure-eight': { name: 'Steady retrieve + figure eight', detail: 'Retrieve toward the bank, then sweep a submerged figure eight beside the ledge to tempt a following muskie.' },
};
interface Lure { id: LureType; name: string; size: string; description: string; colors: LureColor[]; rigs: RigType[]; retrieves: Retrieve[]; affinity: number[] }
const bait: LureColor[] = ['natural'];
const fishColors: LureColor[] = ['silver', 'perch', 'chartreuse', 'black'];
// Affinities follow SPECIES order: bluegill, perch, crappie, bass, walleye, pike, muskie, sturgeon.
// These are deliberately nonzero game estimates, not real-world catch probabilities.
export const LURES: Lure[] = [
  { id: 'worm', name: 'Earthworm / nightcrawler', size: 'Small piece; whole crawler or bundle on bottom', description: 'Small pieces for bluegill and perch; a whole crawler for walleye, or fresh worms on bottom for sturgeon.', colors: bait, rigs: ['float','slip-float','bottom'], retrieves: ['still','lift-pause','slow-drag'], affinity: [2.1,1.65,.7,.6,1.2,.08,.02,2.8] },
  { id: 'minnow', name: 'Live minnow', size: 'Small fathead or shiner', description: 'Small live fish for crappie, perch and walleye; present naturally near cover.', colors: bait, rigs: ['float','slip-float','bottom'], retrieves: ['still','lift-pause','slow-drag'], affinity: [.55,1.8,2.3,.8,1.8,.7,.15,.15] },
  { id: 'panfish-jig', name: 'Small soft-plastic jig', size: '1/32–1/8 oz · small grub or tube', description: 'A small profile for bluegill, perch and crappie, worked gently through the water column.', colors: [...fishColors,'green-pumpkin'], rigs: ['jighead','slip-float'], retrieves: ['lift-pause','slow-roll','still'], affinity: [1.65,1.7,2.2,.6,.7,.12,.025,.025] },
  { id: 'minnow-jig', name: 'Minnow-tipped jig', size: '1/8–3/8 oz', description: 'A jig heavy enough to feel bottom, tipped with a fresh minnow; especially useful for spring walleye.', colors: fishColors, rigs: ['jighead'], retrieves: ['lift-pause','slow-drag'], affinity: [.3,1.7,1.6,.7,2.4,.5,.08,.08] },
  { id: 'plastic-worm', name: 'Soft-plastic worm', size: '4–6 in', description: 'A bass presentation for weeds and bottom structure; the Texas rig hides the hook in the plastic.', colors: ['green-pumpkin','black','chartreuse'], rigs: ['texas','carolina'], retrieves: ['slow-drag','lift-pause'], affinity: [.05,.15,.2,2.7,.25,.2,.04,.015] },
  { id: 'crankbait', name: 'Diving crankbait', size: '2–3 in · minnow / perch profile', description: 'A wobbling baitfish imitation for bass and walleye; let the bill bring it down before retrieving.', colors: fishColors, rigs: ['direct','leader'], retrieves: ['steady','slow-roll','twitch-pause'], affinity: [.08,.45,.6,2,1.8,1.45,.5,.015] },
  { id: 'jerkbait', name: 'Suspending jerkbait', size: '4–5 in', description: 'An injured baitfish imitation. Longer pauses are a useful cold-water starting point.', colors: fishColors, rigs: ['direct','leader'], retrieves: ['twitch-pause','long-pause'], affinity: [.015,.12,.2,1.9,1.4,2.2,1.1,.01] },
  { id: 'spinnerbait', name: 'Spinnerbait', size: '3/8–1/2 oz', description: 'Blade flash and vibration help bass and pike locate a moving bait.', colors: ['silver','perch','chartreuse','black'], rigs: ['direct','leader'], retrieves: ['slow-roll','steady','burn'], affinity: [.025,.12,.15,2.2,.45,2.1,1,.01] },
  { id: 'spoon', name: 'Casting spoon', size: '2–4 in', description: 'A flashing, wobbling prey imitation for pike; keep the retrieve slow enough to wobble instead of spin.', colors: fishColors, rigs: ['direct','leader'], retrieves: ['slow-roll','steady','twitch-pause'], affinity: [.04,.4,.25,.85,1,2.6,1.2,.01] },
  { id: 'popper', name: 'Surface popper', size: '2–3 in', description: 'A floating bass lure for calmer warm-water mornings and evenings.', colors: ['silver','perch','black'], rigs: ['direct','leader'], retrieves: ['pop-pause'], affinity: [.015,.025,.05,2.5,.05,.85,.45,.005] },
  { id: 'bucktail', name: 'Large bucktail spinner', size: '6–10 in', description: 'A large blade-and-hair lure for muskie and pike. Finish with a submerged figure eight for following fish.', colors: ['perch','chartreuse','black'], rigs: ['leader'], retrieves: ['slow-roll','steady','burn','figure-eight'], affinity: [.005,.015,.015,.4,.15,2.4,3.3,.005] },
  { id: 'large-crankbait', name: 'Large diving crankbait', size: '6–10 in', description: 'A large wobbling prey imitation for muskie and pike, particularly in autumn.', colors: fishColors, rigs: ['leader'], retrieves: ['slow-roll','steady','twitch-pause'], affinity: [.005,.01,.01,.3,.3,2.1,3.1,.005] },
];
export const DEFAULT_TACKLE: TackleSetup = { lure: 'worm', color: 'natural', rig: 'slip-float', retrieve: 'still' };
export const lureFor = (id: LureType) => LURES.find(lure => lure.id === id) || LURES[0];
export function allowedRetrieves(lure: LureType, rig: RigType) {
  const options = lureFor(lure).retrieves;
  if (rig === 'float' || rig === 'slip-float') return options.filter(r => r === 'still' || r === 'lift-pause');
  if (rig === 'jighead') return options.filter(r => r !== 'still');
  return options;
}
export function normalizeTackle(value: unknown): TackleSetup {
  const input = (value && typeof value === 'object' ? value : {}) as Partial<TackleSetup>;
  const lure = LURES.find(l => l.id === input.lure) || lureFor(DEFAULT_TACKLE.lure);
  const rig = lure.rigs.includes(input.rig!) ? input.rig! : lure.id === DEFAULT_TACKLE.lure ? DEFAULT_TACKLE.rig : lure.rigs[0];
  const retrieves = allowedRetrieves(lure.id, rig);
  return { lure: lure.id, color: lure.colors.includes(input.color!) ? input.color! : lure.colors[0], rig,
    retrieve: retrieves.includes(input.retrieve!) ? input.retrieve! : retrieves[0] };
}
const speciesOrder = ['bluegill','perch','crappie','bass','walleye','pike','muskie','sturgeon'];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export function ambientLight(c: FishingConditions) {
  const night = c.period === 'early-night' || c.period === 'late-night';
  const daylight = night ? .08 + .24 * MOON_LIGHT[MOON_PHASES.indexOf(c.moonPhase)] : c.period === 'dawn' || c.period === 'dusk' ? .45 : 1;
  const stormCover = c.weather === 'thunderstorm' ? clamp(((c.stormAgeMs ?? 85000) - 40000) / 40000, 0, 1) : 0;
  const cloud = c.weather === 'overcast' || c.weather === 'snowfall' ? .58 : c.weather === 'rain' ? .48 : c.weather === 'fog' ? .68 : c.weather === 'cold-front' ? .65 : c.weather === 'hurricane' || c.weather === 'blizzard' ? .25 : c.weather === 'thunderstorm' ? 1 - stormCover * .7 : 1;
  return daylight * cloud;
}
export function weatherMultiplier(speciesId: string, c: FishingConditions) {
  if (!c.weather || c.weather === 'sunny') return 1;
  const predator = ['bass','walleye','pike','muskie'].includes(speciesId);
  if (c.weather === 'overcast') return predator ? 1.18 : 1.03;
  if (c.weather === 'rain') return predator ? 1.1 : .98;
  if (c.weather === 'wind') return predator ? 1.12 : 1.02;
  if (c.weather === 'fog') return speciesId === 'walleye' ? 1.12 : 1;
  if (c.weather === 'heatwave') {
    const bright=['morning','afternoon'].includes(c.period);
    if (['pike','muskie','walleye'].includes(speciesId)) return bright ? .5 : .8;
    return bright ? .72 : 1.05;
  }
  if (c.weather === 'cold-front') return ['perch','walleye','sturgeon'].includes(speciesId) ? .85 : .7;
  if (c.weather === 'hurricane') return ['walleye','sturgeon'].includes(speciesId) ? .5 : .4;
  if (c.weather === 'blizzard') return ['perch','walleye','sturgeon'].includes(speciesId) ? .7 : .5;
  if (c.weather === 'snowfall') return ['perch','crappie','walleye'].includes(speciesId) ? 1.08 : .9;
  // A conservative fictional storm response; no universal barometric-pressure bonus.
  return (c.stormAgeMs ?? 85000) < 40000 ? predator ? 1.1 : 1 : .78;
}
export function tackleFactors(speciesId: string, c: FishingConditions, setup = c.tackle ?? DEFAULT_TACKLE) {
  const t = normalizeTackle(setup); const lure = lureFor(t.lure); const light = ambientLight(c);
  const movement = c.observedRetrieve ?? t.retrieve;
  const index = speciesOrder.indexOf(speciesId); const affinity = lure.affinity[index] ?? .01;
  const cold = c.season === 'winter' || ['cold-front','snowfall','blizzard'].includes(c.weather ?? 'sunny'); const shoulder = c.season === 'spring' || c.season === 'autumn';
  let color = 1, rig = 1, retrieve = 1, seasonal = 1;
  // Water clarity stays unchanged by weather; these are small light/contrast preferences.
  if (t.color !== 'natural') {
    if (t.color === 'black') color = light < .22 ? 1.16 : light < .65 ? 1.1 : .94;
    if (t.color === 'chartreuse') color = light < .65 ? 1.12 : .97;
    if (t.color === 'silver' || t.color === 'perch' || t.color === 'green-pumpkin') color = light > .65 ? 1.12 : light > .22 ? 1.02 : .96;
    if (t.lure === 'popper' && t.color === 'black' && light < .45) color = 1.18;
    // Sturgeon bottom feeding should not depend on artificial lure paint.
    if (speciesId === 'sturgeon') color = 1;
  }
  const deep = cold || c.weather === 'heatwave' || (c.season === 'summer' && ['morning','afternoon'].includes(c.period));
  if (t.rig === 'float') rig = deep ? .65 : 1.15;
  if (t.rig === 'slip-float') rig = deep ? 1.22 : 1.05;
  if (t.rig === 'bottom' || t.rig === 'carolina') rig = ['perch','walleye','sturgeon'].includes(speciesId) ? 1.32 : speciesId === 'crappie' ? .62 : deep ? 1.15 : .9;
  if (speciesId === 'sturgeon' && t.rig !== 'bottom') rig *= .12;
  if (t.rig === 'texas' && speciesId === 'bass') rig = deep ? 1.02 : 1.25;
  if (t.rig === 'leader') rig = ['pike','muskie'].includes(speciesId) ? 1.15 : .97;
  if (t.rig === 'direct' && ['pike','muskie'].includes(speciesId)) rig = .72;
  const slow = ['still','slow-drag','lift-pause','slow-roll','long-pause'].includes(movement);
  if (cold) retrieve = slow ? 1.25 : movement === 'burn' ? .35 : .65;
  else if (shoulder) retrieve = slow || movement === 'twitch-pause' ? 1.12 : movement === 'burn' ? .78 : 1;
  else retrieve = movement === 'burn' ? 1.12 : movement === 'long-pause' ? .82 : 1.05;
  if (movement === 'figure-eight' && speciesId === 'muskie') retrieve *= 1.35;
  if (movement === 'long-pause' && t.lure === 'jerkbait' && cold) retrieve *= 1.2;
  if (c.observedRetrieve && !allowedRetrieves(t.lure,t.rig).includes(movement)) retrieve *= movement === 'still' ? .35 : .55;
  if (t.lure === 'minnow-jig' && speciesId === 'walleye' && c.season === 'spring') seasonal *= 1.3;
  if (t.lure === 'large-crankbait' && speciesId === 'muskie' && c.season === 'autumn') seasonal *= 1.3;
  if (t.lure === 'crankbait' && speciesId === 'walleye' && c.season === 'autumn') seasonal *= 1.25;
  if (t.lure === 'plastic-worm' && speciesId === 'bass' && c.season === 'summer' && c.period === 'afternoon') seasonal *= 1.22;
  if (t.lure === 'popper') {
    seasonal *= cold ? .12 : c.season === 'spring' ? .65 : 1;
    seasonal *= ['dawn','morning','dusk','early-night'].includes(c.period) ? 1.25 : .65;
    if (['wind','thunderstorm','cold-front','hurricane','blizzard'].includes(c.weather ?? 'sunny')) seasonal *= .55;
    if (c.weather === 'heatwave' && ['morning','afternoon'].includes(c.period)) seasonal *= .55;
  }
  if (['spinnerbait','bucktail'].includes(t.lure) && ['wind','overcast','rain'].includes(c.weather ?? 'sunny')) seasonal *= 1.16;
  return { affinity, color, rig, retrieve, seasonal, total: affinity * color * rig * retrieve * seasonal };
}
export function tackleMultiplier(speciesId: string, c: FishingConditions) { return c.tackle ? tackleFactors(speciesId, c).total : 1; }
export function setupLabel(t: TackleSetup) { const value = normalizeTackle(t); return `${lureFor(value.lure).name} · ${COLORS[value.color].name} · ${RIGS[value.rig].name} · ${RETRIEVES[value.retrieve].name}`; }
export function recommendTackle(speciesId: string, c: FishingConditions) {
  return LURES.map(lure => {
    const options: { setup: TackleSetup; score: number }[] = [];
    lure.colors.forEach(color => lure.rigs.forEach(rig => allowedRetrieves(lure.id, rig).forEach(retrieve => {
      const setup: TackleSetup = { lure: lure.id, color, rig, retrieve };
      options.push({ setup, score: tackleFactors(speciesId, c, setup).total });
    })));
    return options.sort((a,b) => b.score - a.score)[0];
  }).sort((a,b) => b.score - a.score).slice(0,3);
}
export const TACKLE_SOURCES = [
  { label: 'Panfish bait and rigs · Minnesota DNR', url: 'https://www.dnr.state.mn.us/gofishing/how-catch-sunfish.html' },
  { label: 'Yellow perch tackle · Minnesota DNR', url: 'https://www.dnr.state.mn.us/minnaqua/speciesprofile/yellowperch.html' },
  { label: 'Crappie jigs and minnows · Minnesota DNR', url: 'https://www.dnr.state.mn.us/gofishing/how-catch-crappie.html' },
  { label: 'Bass soft plastics and surface lures · Minnesota DNR', url: 'https://www.dnr.state.mn.us/gofishing/how-catch-largemouth-bass.html' },
  { label: 'Walleye seasonal presentations · Minnesota DNR', url: 'https://www.dnr.state.mn.us/gofishing/how-catch-walleye.html' },
  { label: 'Pike prey and leaders · Minnesota DNR', url: 'https://www.dnr.state.mn.us/gofishing/how-catch-northern-pike.html' },
  { label: 'Muskie lures and figure eights · Minnesota DNR', url: 'https://www.dnr.state.mn.us/gofishing/how-catch-muskellunge.html' },
  { label: 'Sturgeon bottom bait · Wisconsin DNR 2026 report', url: 'https://dnr.wisconsin.gov/topic/Fishing/outreach/wifishingreport' },
  { label: 'Cold-water retrieves · Rapala pro guidance', url: 'https://blog.rapala.com/tips/rapala-pros-provide-cool-tips-for-best-cold-water-baits/' },
  { label: 'Light and lure color · Berkley', url: 'https://berkleyfishing.eu/pages/sick-softbaits' },
  { label: 'Limits of color rules · Berkley', url: 'https://www.berkley-fishing.com/blogs/news/do-bass-have-a-favorite-color' },
];
