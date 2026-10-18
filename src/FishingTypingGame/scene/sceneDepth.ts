import {ANGLER_RIG} from './manifest';

/** Scene coordinates: projected x/y in 0–1, z=0 at the viewer and z=1 at
 * the far shoreline. CSS z-index is a separate compositing order. */
export const SCENE_DEPTH={near:0,foreground:.14,shore:1,arrival:.06,clearance:.001} as const;
export type DepthObstruction=(x:number,y:number)=>boolean;
const FOCAL_DEPTH=24;
export interface DepthPerspective {focalDepth:number;foreground:number}
export interface SceneDepthFrame extends DepthPerspective {horizon:number;feet?:{x:number;y:number}}
export const clampDepth=(z:number)=>Math.max(0,Math.min(1,z));
export const perspectiveRatio=(z:number,perspective?:DepthPerspective)=>1/(1+(perspective?.focalDepth??FOCAL_DEPTH)*clampDepth(z));
export const depthScale=(z:number,perspective?:DepthPerspective)=>1.8*perspectiveRatio(z,perspective);
export const waterlineAtDepth=(z:number,horizon=.5,perspective?:DepthPerspective)=>horizon+(1-horizon)*perspectiveRatio(z,perspective);
export function depthAtWaterline(y:number,horizon=.5,perspective?:DepthPerspective):number {
  return clampDepth(((1-horizon)/Math.max(.001,y-horizon)-1)/(perspective?.focalDepth??FOCAL_DEPTH));
}
/** Derive the foreground plane from the painted boot contact. Keep distance
 * linear: moving toward the horizon then naturally loses apparent speed. */
export function groundPerspective(horizon:number,feetY:number):DepthPerspective {
  return {focalDepth:FOCAL_DEPTH,foreground:Number.isFinite(feetY)&&feetY>horizon+.01?
    depthAtWaterline(Math.min(.995,feetY),horizon):SCENE_DEPTH.foreground};
}
export const foregroundDepth=(perspective?:DepthPerspective)=>perspective?.foreground??SCENE_DEPTH.foreground;
export const foregroundClearance=(perspective?:DepthPerspective)=>Math.min(SCENE_DEPTH.clearance,foregroundDepth(perspective)*.25);
/** Integrate in a distance metric that gets progressively more expensive past
 * the foreground. Its analytic inverse keeps R/F and frame rates consistent. */
export function advanceSceneDepth(z:number,velocity:number,dt:number,perspective?:DepthPerspective):number {
  const plane=foregroundDepth(perspective),far=Math.max(0,z-plane);
  const travel=z+1.5*far*far+velocity*dt;
  return clampDepth(travel<=plane?travel:plane+(Math.sqrt(1+6*(travel-plane))-1)/3);
}
/** Reproject the same world point when only depth changes. This contracts both
 * axes toward the vanishing point and is reversible when moving closer. */
export function changeSceneDepth(point:{x:number;y:number;z:number},z:number,horizon=.5,obstructed?:DepthObstruction,perspective?:DepthPerspective) {
  let next=clampDepth(z);
  const plane=foregroundDepth(perspective),clearance=foregroundClearance(perspective);
  // Test the swept ray at the foreground plane, even if a long step would
  // otherwise finish entirely on the other side. A thousandth is one Z unit.
  if(obstructed&&next!==point.z&&Math.min(point.z,next)<=plane&&Math.max(point.z,next)>=plane){
    const atPlane=perspectiveRatio(plane,perspective)/perspectiveRatio(point.z,perspective);
    if(obstructed(.5+(point.x-.5)*atPlane,horizon+(point.y-horizon)*atPlane))
      next=plane+(next>point.z?-clearance:clearance);
  }
  const ratio=perspectiveRatio(next,perspective)/perspectiveRatio(point.z,perspective);
  point.x=.5+(point.x-.5)*ratio;point.y=horizon+(point.y-horizon)*ratio;point.z=next;
  return next!==clampDepth(z);
}
export function sceneHorizon(scene:HTMLElement,location:string,bounds:DOMRect):number {
  const art=scene.querySelector<HTMLElement>('[data-layer="lake-background"],[data-layer="cove-landscape"],[data-layer="birch-treeline-water"]');
  if(!art||!bounds.height)return .5;
  const rect=art.getBoundingClientRect(),waterline=location==='cove'?.555:.5;
  return Math.max(.15,Math.min(.85,(rect.top-bounds.top+rect.height*waterline)/bounds.height));
}

/** Read stable layout geometry only on scenery load/resize. The shadow rig
 * shares the seated character's layout without its breathing/casting motion. */
export function sceneDepthFrame(scene:HTMLElement,location:string,bounds:DOMRect):SceneDepthFrame {
  const horizon=sceneHorizon(scene,location,bounds);
  const rigs=[scene.querySelector<HTMLElement>('.f-angler-shadow-rig'),scene.querySelector<HTMLElement>('.f-character')];
  const rig=rigs.find(node=>node&&node.getBoundingClientRect().height>0);
  if(!rig||!bounds.height)return {horizon,focalDepth:FOCAL_DEPTH,foreground:SCENE_DEPTH.foreground};
  const rect=rig.getBoundingClientRect(),feet={x:(rect.left-bounds.left+rect.width*ANGLER_RIG.feet.x)/Math.max(1,bounds.width),
    y:(rect.top-bounds.top+rect.height*ANGLER_RIG.feet.y)/bounds.height};
  return {horizon,feet,...groundPerspective(horizon,feet.y)};
}

/** Keep a flying world point continuous when the responsive camera changes. */
export function reframeSceneDepth(point:{x:number;y:number;z:number},from:SceneDepthFrame,to:SceneDepthFrame) {
  const ratio=perspectiveRatio(point.z,to)/perspectiveRatio(point.z,from);
  point.x=.5+(point.x-.5)*ratio;point.y=to.horizon+(point.y-from.horizon)*ratio;
}
