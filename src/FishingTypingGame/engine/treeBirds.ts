import { skyRandom } from './astronomy';
import { WORLD } from './world';
import { DistantTree, TreeFrame, TreePoint, treePerch, mappedTreesForLocation, treesForLocation, behindViewerTreesForLocation } from '../scene/treeMap';
import {perspectiveRatio} from '../scene/sceneDepth';
import { TREE_BIRD_SPECIES, TreeBirdSpeciesId, TreeBirdDirection } from './birds';
export { TREE_BIRD_SPECIES, TREE_BIRD_DIRECTIONS, TREE_BIRD_SPRITE } from './birds';
export type { TreeBirdSpeciesId, TreeBirdDirection } from './birds';

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
  species?:TreeBirdSpeciesId;
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

export function makeTreeBirdVisit(id: string, stream: string, startAt: number, seed: number, location: string, count = 1, endpoints?:{source:DistantTree;target:DistantTree}): TreeBirdVisit {
  let roll = 0; const random = () => skyRandom(seed + ++roll * 7919);
  // A separate seeded choice leaves every existing route RNG draw untouched.
  const eligible=TREE_BIRD_SPECIES.filter(species=>count===1||species.canFlock);
  const species=eligible[Math.floor(skyRandom(seed+59243)*eligible.length)].id;
  const trees = mappedTreesForLocation(location), source = endpoints?.source??trees[Math.floor(random() * trees.length)];
  // Prefer a different bank/part of the shoreline, so portrait crops still see
  // a crossing even when one or both trees are beyond their horizontal edges.
  // Foreground and landscape x/y belong to different artwork frames. A close
  // tree always connects to the distant bank rather than another close trunk.
  const candidates = trees.filter(tree => tree.id !== source.id &&
    (source.frame!=='landscape'?tree.frame==='landscape':tree.frame!=='landscape'||Math.abs(tree.top.x-source.top.x)>.15));
  const target = endpoints?.target??candidates[Math.floor(random() * candidates.length)];
  const exits = count > 1 && random() < .48 && !source.hidden && !target.hidden;
  const toRight = target.top.x > source.top.x;
  const pace = .052 + random() * .032;
  const birds = Array.from({ length: count }, (_, index) => {
    const from = treePerch(source, random);
    const to = exits ? { x: toRight ? 1.10 : -.10, y: Math.max(.10, from.y - .07 + random() * .08), z: .57 + random() * .43 } : treePerch(target, random);
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const originalDurationMs = Math.max(3200, Math.min(14500, distance / pace * 1000)) * (.96 + random() * .08);
    const durationMs = originalDurationMs * (source.hidden || target.hidden ? 4 : 1);
    const bounds = Math.max(3, Math.round(originalDurationMs / (850 + random() * 250)));
    return { from, to, species, fromTree: source.id, toTree: exits ? undefined : target.id,
      fromFrame: source.frame, toFrame: exits ? 'landscape' as const : target.frame,
      delayMs: index * (85 + random() * 70), durationMs, bounds, phase: random(),
      lift: .022 + distance * .045 + random() * .012, amplitude: .003 + random() * .005 };
  });
  return { id, stream, location, startAt, endAt: startAt + Math.max(...birds.map(bird => bird.delayMs + bird.durationMs)), birds };
}

/** Near perches and camera crossings use painted, collectible species art. */
export const usesSpeciesBirdArt=(route:TreeBirdRoute)=>!!route.species&&(route.fromFrame==='foreground'||route.toFrame==='foreground'||route.from.z<0||route.to.z<0);

/** Depth distinguishes facing toward/away; small lateral courses stay head-on.
 * Keep the selected view for the route so a bounding dip cannot flip the bird. */
export function treeBirdDirection(route:TreeBirdRoute):TreeBirdDirection {
  const facing=route.to.z<route.from.z?'front':'back',dx=route.to.x-route.from.x;
  return Math.abs(dx)<.10?facing:`${facing}-${dx<0?'left':'right'}`;
}

/** Perspective interpolation plus a long arc and smaller rise/dip bounds.
 * Exact endpoints are in each tree's upper third, never on the water. */
export function treeBirdPose(route: TreeBirdRoute, progress: number) {
  const t = clamp(progress), p = smooth((t - .025) / .93);
  const z = mix(route.from.z, route.to.z, p), horizon = .52;
  const envelope = Math.sin(p * Math.PI);
  const arc = -route.lift * 4 * p * (1 - p) - route.amplitude * Math.sin(p * route.bounds * Math.PI * 2) * envelope;
  const throughViewer=route.from.z<0||route.to.z<0;
  const timeOpacity=smooth(t/.035)*smooth((1-t)/.045);
  if(throughViewer){
    // The hidden anchor describes the passing direction. Calibrate its ray to
    // the visible tree, then project with signed camera distance. Clip at z=0;
    // never reflect a behind-camera point back into the lake or divide by zero.
    const frontFrom=route.from.z>=0,front=frontFrom?route.from:route.to;
    const passing=.18*clamp(1-z/Math.max(.001,front.z))/(24*Math.max(.001,z));
    const fromWeight=frontFrom?1:passing,toWeight=frontFrom?passing:1,centerWeight=-passing;
    const originalDistance=Math.max(.001,z)*4.2;
    const sizeDistance=originalDistance>=1.4?originalDistance:1.4*Math.pow(originalDistance/1.4,.35);
    return {x:route.from.x*fromWeight+route.to.x*toWeight+.5*centerWeight,
      y:route.from.y*fromWeight+route.to.y*toWeight+horizon*centerWeight+arc,
      z,blend:p,arc,fromWeight,toWeight,centerWeight,
      scale:Math.max(.35,Math.min(8,1.9/sizeDistance)),opacity:timeOpacity*smooth(z/.002),
      layer:z>0&&z<.03?11:4};
  }
  const fromDistance=1/perspectiveRatio(route.from.z),toDistance=1/perspectiveRatio(route.to.z),distance=mix(fromDistance,toDistance,p);
  const x = .5 + mix((route.from.x - .5) * fromDistance, (route.to.x - .5) * toDistance, p) / distance;
  const baseline = horizon + mix((route.from.y - horizon) * fromDistance, (route.to.y - horizon) * toDistance, p) / distance;
  // Preserve the original silhouette sizes in the normalized depth frame.
  const originalDistance=z*4.2;
  const sizeDistance=originalDistance>=1.4?originalDistance:1.4*Math.pow(originalDistance/1.4,.35);
  const blend=p*toDistance/distance;
  return { x, y: baseline + arc, z, blend, arc,fromWeight:1-blend,toWeight:blend,centerWeight:0,layer:4,
    scale: Math.max(.35,Math.min(3.2,1.9/sizeDistance)), opacity: timeOpacity };
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

/** Alternate left/right fly-pasts and return flights, without shifting clocks. */
export function previewTreeBirdFlyby(now:number,location:string,sequence:number):TreeBirdVisit {
  const hidden=behindViewerTreesForLocation(location)[Math.floor((sequence-1)/2)%2];
  const far=[...treesForLocation(location)].sort((a,b)=>hidden.top.x<0?b.top.x-a.top.x:a.top.x-b.top.x)[2];
  const toward=sequence%2===1;
  return makeTreeBirdVisit(`tree-birds-preview-flyby-${sequence}`,'preview-flyby',now,sequence*19397+7717,location,1,
    {source:toward?far:hidden,target:toward?hidden:far});
}
