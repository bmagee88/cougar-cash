import { skyRandom } from './astronomy';
import { WORLD } from './world';
import { TreeFrame, TreePoint, treePerch, mappedTreesForLocation } from '../scene/treeMap';
import {depthScale,perspectiveRatio} from '../scene/sceneDepth';

export const GAME_MINUTE_MS = WORLD.dayMs / (24 * 60);
// Independent jittered clocks. Consecutive gaps are 10–30 game minutes for
// each solo stream, and 24–48 real minutes for the flock. No catch-up bursts.
export const TREE_BIRD_STREAMS = [
  { id: 'single-a', baseMs: 20 * GAME_MINUTE_MS, jitterMs: 10 * GAME_MINUTE_MS, offset: 0, count: 1 },
  { id: 'single-b', baseMs: 20 * GAME_MINUTE_MS, jitterMs: 10 * GAME_MINUTE_MS, offset: 13 * GAME_MINUTE_MS, count: 1 },
  { id: 'flock', baseMs: 36 * 60000, jitterMs: 12 * 60000, offset: 7 * 60000, count: 10 },
] as const;
export type TreeBirdStream = typeof TREE_BIRD_STREAMS[number];
export interface TreeBirdRoute {
  from: TreePoint; to: TreePoint; fromTree: string; toTree?: string;
  fromFrame?: TreeFrame; toFrame?: TreeFrame;
  delayMs: number; durationMs: number; lift: number; bounds: number; amplitude: number; phase: number;
}
export interface TreeBirdVisit { id: string; stream: string; startAt: number; endAt: number; birds: TreeBirdRoute[]; location: string }
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const locationSalt = (location: string) => location === 'birch' ? 83177 : location === 'cove' ? 57163 : 17389;

export function treeBirdDeparture(stream: TreeBirdStream, index: number, location: string) {
  const seed = Math.imul(index, 1009) + locationSalt(location) + TREE_BIRD_STREAMS.indexOf(stream) * 33391;
  return WORLD.epoch + stream.offset + index * stream.baseMs + skyRandom(seed) * stream.jitterMs;
}

export function makeTreeBirdVisit(id: string, stream: string, startAt: number, seed: number, location: string, count = 1): TreeBirdVisit {
  let roll = 0; const random = () => skyRandom(seed + ++roll * 7919);
  const trees = mappedTreesForLocation(location), source = trees[Math.floor(random() * trees.length)];
  // Prefer a different bank/part of the shoreline, so portrait crops still see
  // a crossing even when one or both trees are beyond their horizontal edges.
  // Foreground and landscape x/y belong to different artwork frames. A close
  // tree always connects to the distant bank rather than another close trunk.
  const candidates = trees.filter(tree => tree.id !== source.id &&
    (tree.frame !== source.frame || (tree.frame !== 'foreground' && Math.abs(tree.top.x - source.top.x) > .15)));
  const target = candidates[Math.floor(random() * candidates.length)];
  const exits = count > 1 && random() < .48;
  const toRight = target.top.x > source.top.x;
  const pace = .052 + random() * .032;
  const birds = Array.from({ length: count }, (_, index) => {
    const from = treePerch(source, random);
    const to = exits ? { x: toRight ? 1.10 : -.10, y: Math.max(.10, from.y - .07 + random() * .08), z: .57 + random() * .43 } : treePerch(target, random);
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const durationMs = Math.max(3200, Math.min(14500, distance / pace * 1000)) * (.96 + random() * .08);
    const bounds = Math.max(3, Math.round(durationMs / (850 + random() * 250)));
    return { from, to, fromTree: source.id, toTree: exits ? undefined : target.id,
      fromFrame: source.frame, toFrame: exits ? 'landscape' as const : target.frame,
      delayMs: index * (85 + random() * 70), durationMs, bounds, phase: random(),
      lift: .022 + distance * .045 + random() * .012, amplitude: .003 + random() * .005 };
  });
  return { id, stream, location, startAt, endAt: startAt + Math.max(...birds.map(bird => bird.delayMs + bird.durationMs)), birds };
}

/** Perspective interpolation plus a long arc and smaller rise/dip bounds.
 * Exact endpoints are in each tree's upper third, never on the water. */
export function treeBirdPose(route: TreeBirdRoute, progress: number) {
  const t = clamp(progress), p = smooth((t - .025) / .93);
  const z = mix(route.from.z, route.to.z, p), horizon = .52;
  const fromDistance=1/perspectiveRatio(route.from.z),toDistance=1/perspectiveRatio(route.to.z),distance=mix(fromDistance,toDistance,p);
  const x = .5 + mix((route.from.x - .5) * fromDistance, (route.to.x - .5) * toDistance, p) / distance;
  const baseline = horizon + mix((route.from.y - horizon) * fromDistance, (route.to.y - horizon) * toDistance, p) / distance;
  const envelope = Math.sin(p * Math.PI);
  const arc = -route.lift * 4 * p * (1 - p) - route.amplitude * Math.sin(p * route.bounds * Math.PI * 2) * envelope;
  // Birds share the camera's perspective curve; their larger physical size
  // supplies a species multiplier rather than flattening growth near a tree.
  return { x, y: baseline + arc, z, blend: p * toDistance / distance, arc,
    scale: 3*depthScale(z), opacity: smooth(t / .035) * smooth((1 - t) / .045) };
}

/** At most two solos plus one ten-bird flock; one sleeping timer services all. */
export function treeBirdSchedule(now: number, location: string) {
  const visits: TreeBirdVisit[] = [], deadlines: number[] = [];
  TREE_BIRD_STREAMS.forEach((stream, streamIndex) => {
    const current = Math.floor((now - WORLD.epoch - stream.offset) / stream.baseMs);
    for (let index = current - 1; index <= current + 1; index++) {
      const startAt = treeBirdDeparture(stream, index, location);
      if (startAt > now) { deadlines.push(startAt); continue; }
      const seed = Math.imul(index, 19397) + locationSalt(location) + streamIndex * 77417;
      const visit = makeTreeBirdVisit(`tree-birds-${location}-${stream.id}-${index}`, stream.id, startAt, seed, location, stream.count);
      if (now < visit.endAt) { visits.push(visit); deadlines.push(visit.endAt); }
    }
  });
  return { visits, nextAt: Math.min(...deadlines) };
}

export function previewTreeBirdVisit(now: number, location: string, sequence: number, flock: boolean) {
  const visit = makeTreeBirdVisit(`tree-birds-preview-${flock ? 'flock' : 'solo'}-${sequence}`, flock ? 'preview-flock' : 'preview-solo', now, sequence * 19397 + (flock ? 3191 : 7717), location, flock ? 10 : 1);
  const age = (visit.endAt - visit.startAt) * .18;
  return { ...visit, startAt: now - age, endAt: visit.endAt - age };
}
