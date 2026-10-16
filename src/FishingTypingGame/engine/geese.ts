import { skyRandom } from './astronomy';
import { Season } from './types';
import { WORLD } from './world';
import { gooseDirection } from './visitors';

export type GooseFormation = 'v' | 'echelon-left' | 'echelon-right';
export type GooseBird = { x: number; y: number; phase: number };
export interface GooseVisit {
  id: string; startAt: number; endAt: number; durationMs: number; direction: number;
  shape: GooseFormation; birds: GooseBird[]; width: number; height: number;
  startScale: number; endScale: number; seed: number;
}
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Integral of inverse distance: the same world-speed projects faster nearby. */
function projectedTravel(startScale: number, endScale: number, progress: number) {
  const start = 1 / startScale, difference = 1 / endScale - start;
  return Math.abs(difference) < .00001 ? progress / start : Math.log((start + difference * progress) / start) / difference;
}

export function goosePose(visit: GooseVisit, progress: number) {
  const t = clamp(progress), scale = 1 / mix(1 / visit.startScale, 1 / visit.endScale, t);
  const travel = projectedTravel(visit.startScale, visit.endScale, t) / projectedTravel(visit.startScale, visit.endScale, 1);
  return { x: visit.direction > 0 ? -48 + 196 * travel : 148 - 196 * travel,
    y: 7.8 + scale * 11.2, scale, depth: clamp((1.02 - scale) / .78) };
}

export function makeGooseVisit(id: string, startAt: number, seed: number, season: Season): GooseVisit {
  const random = (salt: number) => skyRandom(seed + salt * 7919);
  const shape: GooseFormation = random(1) < .4 ? 'v' : random(1) < .7 ? 'echelon-left' : 'echelon-right';
  const count = 4 + Math.floor(random(2) * 10), mode = random(3);
  const far = .26 + random(4) * .18, near = .72 + random(5) * .3;
  const parallel = .3 + random(6) * .6;
  const startScale = mode < .33 ? far : mode < .66 ? near : parallel;
  const endScale = mode < .33 ? near : mode < .66 ? far : Math.min(1.02, Math.max(.26, parallel + (random(7) - .5) * .12));
  const spacing = .82 + random(8) * .14, slope = .32 + random(9) * .10;
  const raw = Array.from({ length: count }, (_, index) => {
    const rank = shape === 'v' ? Math.ceil(index / 2) : index;
    const side = shape === 'v' ? (index % 2 ? -1 : 1) : shape === 'echelon-left' ? -1 : 1;
    return { x: -rank * spacing + (index ? (random(index + 20) - .5) * .09 : 0),
      y: rank * side * slope + (index ? (random(index + 50) - .5) * .09 : 0), phase: Math.floor(random(index + 80) * 3) * 4 };
  });
  const minX = Math.min(...raw.map(b => b.x)) - .5, maxX = Math.max(...raw.map(b => b.x)) + .5;
  const minY = Math.min(...raw.map(b => b.y)) - .5, maxY = Math.max(...raw.map(b => b.y)) + .5;
  const durationMs = Math.round(24000 / projectedTravel(startScale, endScale, 1));
  return { id, seed, startAt, endAt: startAt + durationMs, durationMs, direction: gooseDirection(season), shape,
    birds: raw.map(b => ({ ...b, x: b.x - (minX + maxX) / 2, y: b.y - (minY + maxY) / 2 })),
    width: maxX - minX, height: maxY - minY, startScale, endScale };
}

/** One or two absolute windows per 48-minute lake day, stable across reloads. */
export function gooseVisits(gameDay: number, season: Season): GooseVisit[] {
  if (!gooseDirection(season)) return [];
  const seed = Math.imul(gameDay, 1009) + 0x47454553;
  const twice = skyRandom(seed) < .55;
  const hours = twice ? [7 + skyRandom(seed + 1) * 4.5, 15 + skyRandom(seed + 2) * 5.5] : [7 + skyRandom(seed + 3) * 13.5];
  return hours.map((hour, index) => makeGooseVisit(`geese-${gameDay}-${index}`, WORLD.epoch + (gameDay + hour / 24) * WORLD.dayMs, seed + index * 19397, season));
}

export function gooseVisitAt(now: number, season: Season) {
  const day = Math.floor((now - WORLD.epoch) / WORLD.dayMs);
  return gooseVisits(day, season).find(visit => now >= visit.startAt && now < visit.endAt);
}

export function nextGooseChange(now: number, season: Season) {
  const day = Math.floor((now - WORLD.epoch) / WORLD.dayMs);
  const times = [...gooseVisits(day, season), ...gooseVisits(day + 1, season)].flatMap(visit => [visit.startAt, visit.endAt]).filter(at => at > now);
  return times.length ? Math.min(...times) : now + WORLD.dayMs;
}

/** Preview visits do not consume or change the natural schedule. */
export function previewGooseVisit(now: number, season: Season, sequence: number) {
  const visit = makeGooseVisit(`geese-preview-${sequence}`, now, Math.imul(sequence, 19397) + 27191, season);
  const age = visit.durationMs * .36;
  return { ...visit, startAt: now - age, endAt: now + visit.durationMs - age };
}
