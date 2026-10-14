import { BALANCE } from './config';
import { Random } from './types';
import { HAIKU } from './haiku';

export const PHRASES = [
  'a', 'go', 'sun', 'lake', 'water', 'little', 'ripples',
  'calm lake', 'soft rain', 'blue sky', 'a quiet day', 'gentle wind', 'clear water', 'golden light',
  'a little ripple', 'the water is calm', 'cast into the lake', 'watch the clouds drift',
  'the reeds sway in the wind', 'a silver ripple crosses the lake', 'sunlight dances on the water',
  'a small bird rests beside the dock', 'the quiet shore is a good place to be',
  'we follow the trail down to the water', 'take a deep breath and enjoy the view',
  'the little boat drifts past the tall reeds', 'a warm breeze moves through the willow trees',
  'the lake reflects the hills and the open sky', 'we sit by the water and watch the day unfold',
  'the sun shines through the clouds above the lake', 'there is always something new beyond the shore',
  'we pack a simple lunch and spend the day by the lake', 'a bright dragonfly rests on a reed beside the water',
  'the soft sound of rain makes the whole lake feel peaceful', 'the best part of the trip is sharing a quiet moment',
  'we rest beside the lake and listen to the wind in the tall trees',
  'the light changes slowly as the clouds float over the distant hills',
  'a small ring on the surface grows wider until it meets another ripple',
  'we find a shady spot beside the lake and listen to the birds in the trees',
  'the water turns golden in the evening and the little boats head back to shore',
  'a gentle breeze passes through the trees while the clouds drift across the blue sky',
  'we follow the winding path through the forest and stop to watch the sunlight on the water',
  'the lake is still and the air is fresh as we settle in for another quiet day beside the water',
  'a little patience can lead to a wonderful surprise when you spend a peaceful afternoon by the lake',
  'we watch the birds fly above the distant trees while the warm afternoon light dances across the water',
  'the sky begins to clear after the rain and every leaf along the shore catches a little bit of sunlight',
  'we take our time on the path beside the lake and stop to enjoy the view before heading back to the old dock',
];
// Natural complete clauses give thousands of readable alternatives, indexed once.
const openings = ['the lake is calm', 'the sky is clear', 'the sun is warm', 'the wind is soft', 'the reeds sway', 'the birds sing', 'a boat drifts', 'the clouds move', 'we cast our line', 'we watch the lake', 'we wait quietly', 'the rain falls gently', 'the water shines', 'the shore is quiet', 'we take our time'];
const endings = ['as the day begins', 'beside the old dock', 'in the morning light', 'near the willow trees', 'under the open sky', 'on a quiet afternoon', 'while the clouds drift', 'as the sun goes down', 'and all is peaceful', 'with the hills beyond', 'as we enjoy the view', 'near the grassy shore', 'in the golden light', 'and a new day unfolds'];
const extras = ['we have time to enjoy the view', 'a soft breeze moves through the trees', 'the little ripples spread across the water', 'a bird flies past the distant shore', 'we listen to the soft sounds of the lake'];
const pool = new Set(PHRASES);
openings.forEach(a => endings.forEach(b => { pool.add(`${a} ${b}`); extras.forEach(c => { pool.add(`${a} ${b} and ${c}`); extras.filter(d => d !== c).forEach(d => pool.add(`${a} ${b} and ${c} while ${d}`)); }); }));
export const PHRASE_INDEX = new Map<number, string[]>();
Array.from(pool).forEach(p => PHRASE_INDEX.set(p.length, [...(PHRASE_INDEX.get(p.length) || []), p]));
const lengths = Array.from(PHRASE_INDEX.keys()).sort((a, b) => a - b);
// Give complete poems half the encounters where they fit the existing budget.
export const HAIKU_CHANCE = 0.5;
const haikuTargets = new Map<number, string[]>();
HAIKU.forEach(({ text }) => {
  for (let n = Math.max(1, text.length - BALANCE.phraseTolerance); n <= text.length + BALANCE.phraseTolerance; n++) {
    haikuTargets.set(n, [...(haikuTargets.get(n) || []), text]);
  }
});
export function targetCharacters(wpm: number) { return Math.max(1, Math.round(wpm * 5 * BALANCE.challengeMs / 60000)); }
export function selectPhrase(wpm: number, random: Random): string {
  const target = targetCharacters(wpm);
  const poems = haikuTargets.get(target);
  if (poems?.length && random() < HAIKU_CHANCE) {
    return poems[Math.min(poems.length - 1, Math.floor(random() * poems.length))];
  }
  const nearest = lengths.reduce((best, n) => Math.abs(n - target) < Math.abs(best - target) ? n : best, lengths[0]);
  const candidates = PHRASE_INDEX.get(nearest)!;
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
}
