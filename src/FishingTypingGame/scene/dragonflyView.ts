import { FlightState, isPerched } from './butterflyFlight';

export type DragonflyView='left'|'right'|'front'|'back';
export type DragonflyDirection={view:DragonflyView;pending?:DragonflyView;pendingFor?:number};

/** Follow travel rather than the patrol's intended facing (which can differ
 * during a backward correction). Hovering keeps the last stable view. */
export function stepDragonflyView(previous:DragonflyDirection|undefined,flight:FlightState,dt:number):DragonflyDirection {
  const idle:DragonflyDirection=previous??{view:(flight.facing??flight.vx)<0?'left':'right'};
  if(isPerched(flight)||flight.age<0)return {...idle,pending:undefined,pendingFor:0};
  const x=flight.motionVx??flight.vx;
  // Positive depth is away. Convert depth units to the same approximate
  // screen-motion scale as velocity; upward/downward travel adds its cue.
  const toward=(flight.motionVy??flight.vy)-flight.vz*1064;
  const scores={left:Math.max(0,-x),right:Math.max(0,x),front:Math.max(0,toward),back:Math.max(0,-toward)};
  const candidate:DragonflyView=Math.abs(x)>=Math.abs(toward)?x<0?'left':'right':toward<0?'back':'front';
  if(scores[candidate]<18||candidate===idle.view||scores[candidate]<scores[idle.view]*1.25)return {...idle,pending:undefined,pendingFor:0};
  if(!previous)return {view:candidate};
  const pendingFor=(idle.pending===candidate?idle.pendingFor??0:0)+dt;
  return pendingFor>=.12?{view:candidate}:{...idle,pending:candidate,pendingFor};
}
