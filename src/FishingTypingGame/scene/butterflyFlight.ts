import { Random } from '../engine/types';
import type { PlantPerch } from './plantMap';
import {advanceSceneDepth,changeSceneDepth,DepthObstruction,depthAtWaterline,depthScale,DepthPerspective,foregroundDepth,perspectiveRatio,SceneDepthFrame,SCENE_DEPTH,waterlineAtDepth} from './sceneDepth';

// Coordinates are fractions of the visible scene. The simulation is twice its
// width and height, allowing an individual to leave the view and loop back.
export const FLIGHT_BOUNDS={left:-.5,right:1.5,top:-.5,bottom:1.5};
export const FOREGROUND_DEPTH=SCENE_DEPTH.foreground, MAX_FLIGHT_DEPTH=SCENE_DEPTH.shore;
export const INSECT_DEPTH_SPEED=.30;
export const advanceFlightDepth=(z:number,velocity:number,dt:number,perspective?:DepthPerspective)=>advanceSceneDepth(z,velocity*INSECT_DEPTH_SPEED,dt,perspective);
export interface FlightPointer {x:number;y:number;previousX:number;previousY:number;speed:number}
export interface ButterflyPerch {
  x:number;y:number;startAt:number;remaining:number;landed:boolean;finished:boolean;
  frame:number;nextFrameIn:number;fast:boolean;
  plantId?:string;z?:number;repeats?:number;visits?:number;restFrame?:number;hoverFeed?:boolean;
  sideways?:boolean;facing?:number;
}
export type ButterflyPattern = 'float' | 'flutter' | 'skip' | 'moth' | 'hover';
export interface FlightState {
  x:number;y:number;z:number;vx:number;vy:number;vz:number;age:number;turnIn:number;
  speed:number;heading:number;exitSide:number;departAt:number;fleeing:boolean;
  behindForeground:boolean;closeRadius:number;alarmRadius:number;speedTolerance:number;perch?:ButterflyPerch;
  facing?:number;
  pattern?:ButterflyPattern;mode?:'flap'|'glide'|'hover'|'patrol'|'dart';modeIn?:number;
  wingPhase?:number;wingFrame?:number;phase?:number;plants?:PlantPerch[];
  motionVx?:number;motionVy?:number;
  escapeAngle?:number;scaredAt?:number;evadeUntil?:number;plantSearchAt?:number;
  flowerWait?:{plantId:string;until:number;x:number;y:number};
  perspective?:SceneDepthFrame;
}
const between=(random:Random,min:number,max:number)=>min+random()*(max-min);
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
export const flightScale=depthScale;
// Perspective puts the water surface at the screen bottom nearby and at the
// measured far shoreline at the back of the flight volume.
export const flightBottom=waterlineAtDepth;
// Keep close flight lively while making a distant patrol almost stationary
// on screen (about 2% of close movement at the far shore).
export const flightMovementScale=(z:number,perspective?:DepthPerspective)=>Math.pow(Math.min(1,perspectiveRatio(z,perspective)/perspectiveRatio(SCENE_DEPTH.arrival,perspective)),1.65);
export const flightOpacity=(z:number)=>clamp((MAX_FLIGHT_DEPTH-z)/.08,0,1);
export const flightExpired=(flight:FlightState)=>flight.z>=MAX_FLIGHT_DEPTH||flight.x<FLIGHT_BOUNDS.left||flight.x>FLIGHT_BOUNDS.right||flight.y<FLIGHT_BOUNDS.top||flight.y>FLIGHT_BOUNDS.bottom;
export const isPerched=(flight:FlightState)=>!!flight.perch?.landed&&!flight.perch.finished;
export function planPerch(flight:FlightState,x:number,y:number,random:Random,options:Partial<ButterflyPerch>={}):void {
  const butterfly=flight.pattern!==undefined&&flight.pattern!=='moth'&&flight.pattern!=='hover';
  flight.perch={x,y,startAt:flight.age+between(random,2.5,5.5),remaining:between(random,6,13),landed:false,finished:false,frame:0,nextFrameIn:between(random,.3,1),fast:random()<.4,sideways:butterfly&&random()<.5,...options};
}
export function stepPerchedWings(perch:ButterflyPerch,dt:number,random:Random):void {
  perch.nextFrameIn-=dt;
  if(perch.nextFrameIn>0)return;
  perch.frame=(perch.frame+1)%8;
  if(perch.frame===0)perch.fast=random()<.4;
  const hold=(perch.frame===0||perch.frame===3)&&random()<.45?between(random,.3,1.7):0;
  perch.nextFrameIn=(perch.fast?between(random,.035,.09):between(random,.16,.48))+hold;
}
export function createFlight(random:Random,delay=0):FlightState {
  const side=random()<.5?-1:1;
  return {x:side<0?-.09:1.09,y:between(random,.2,.78),z:between(random,.025,.10),
    // Enter sideways before choosing a depth course; an immediate approach
    // would project the offscreen starting point farther outside the view.
    vx:-side*between(random,170,260),vy:between(random,-45,45),vz:0,
    age:-delay,turnIn:.6,speed:between(random,140,250),heading:0,exitSide:-side,
    departAt:between(random,24,42),fleeing:false,behindForeground:false,
    closeRadius:between(random,2.5,6),alarmRadius:between(random,65,135),speedTolerance:between(random,160,430),phase:random()*Math.PI*2,wingPhase:random()*8,mode:'flap',modeIn:between(random,1.5,3.5)};
}
export function configureButterflyFlight(flight:FlightState,id:string,random:Random) {
  flight.pattern=id==='hummingbird-clearwing'?'hover':id==='silver-spotted-skipper'?'skip':id==='monarch'||id.includes('swallowtail')?'float':id.includes('moth')||id.includes('sphinx')?'moth':'flutter';
  flight.speed=flight.pattern==='float'?between(random,110,175):flight.pattern==='skip'?between(random,180,250):flight.pattern==='moth'?between(random,145,210):between(random,100,165);
}
export function stepFlightWings(flight:FlightState,dt:number,hz=5) {
  if(isPerched(flight)&&!flight.perch?.hoverFeed){flight.wingFrame=flight.perch!.frame;return;}
  if(flight.mode==='glide'){flight.wingFrame=0;return;}
  flight.wingPhase=((flight.wingPhase??0)+dt*hz*8)%8;
  flight.wingFrame=Math.floor(flight.wingPhase);
}

/** Shared eased landing and resting, including repeated odonate hunting sorties.
 * A mapped home remains the same plant between takeoff and return. */
export function stepPerch(flight:FlightState,dt:number,width:number,height:number,random:Random,horizon:number):boolean {
  const perch=flight.perch;
  if(!perch||perch.finished)return false;
  if(flight.fleeing||flight.age>flight.departAt||flight.behindForeground){perch.finished=true;return false;}
  if(flight.age<(flight.evadeUntil??0))return false;
  if(flight.age<perch.startAt)return false;
  if(!perch.landed){
    const dx=(perch.x-flight.x)*width,dy=(perch.y-flight.y)*height,distance=Math.hypot(dx,dy);
    const speed=Math.min(flight.speed*1.2,Math.max(14,distance*2.4)),travel=Math.min(distance,speed*dt);
    flight.x+=dx/(distance||1)*travel/Math.max(1,width);flight.y+=dy/(distance||1)*travel/Math.max(1,height);
    if(flight.pattern){
      const wave=(t:number)=>Math.sin(t*10+(flight.phase??0))*4;
      flight.y+=(wave(flight.age)-wave(flight.age-dt))*Math.min(1,distance/80)/Math.max(1,height);
      flight.mode='flap';
    }
    if(perch.z!==undefined)flight.z+=(perch.z-flight.z)*Math.min(1,dt*3);
    if(flight.y>horizon&&horizon<1)flight.z=Math.min(flight.z,depthAtWaterline(flight.y,horizon,flight.perspective));
    flight.vx=dx/(distance||1)*speed;flight.vy=dy/(distance||1)*speed;flight.vz=0;flight.heading=clamp(flight.vy/450,-.55,.55);
    if(distance<=travel+2){
      // Preserve the approach direction after landing zeros the flight velocity.
      perch.facing=(Math.abs(dx)>.01?dx:flight.facing??flight.motionVx??flight.vx)<0?-1:1;
      perch.landed=true;perch.visits=(perch.visits??0)+1;flight.x=perch.x;flight.y=perch.y;flight.vx=0;flight.vy=0;flight.heading=-.14;
      if(perch.z!==undefined)flight.z=perch.z;
      if(perch.restFrame!==undefined)perch.frame=perch.restFrame;
    }
  }else{
    perch.remaining-=dt;
    if(perch.restFrame===undefined&&!perch.hoverFeed)stepPerchedWings(perch,dt,random);
    if(perch.remaining<=0){
      if((perch.repeats??0)>0){
        perch.repeats=(perch.repeats??0)-1;perch.landed=false;perch.startAt=flight.age+between(random,4,7);perch.remaining=between(random,4,8);flight.mode='patrol';flight.turnIn=0;
        const away=flight.x<.5?1:-1;flight.vx=away*flight.speed;flight.facing=away;flight.vy=-45;
      }else if(perch.restFrame===undefined&&flight.plants&&flight.age<flight.departAt-5){
        const next=flight.plants.filter(plant=>plant.id!==perch.plantId);
        const plant=next[Math.floor(random()*next.length)];
        if(plant){planPerch(flight,plant.x,plant.y-(perch.hoverFeed?.018:0),random,{plantId:plant.id,z:plant.z,startAt:flight.age+.35,remaining:between(random,3,7),hoverFeed:perch.hoverFeed});}
        else perch.finished=true;
      }else perch.finished=true;
      flight.turnIn=0;
    }
  }
  return !perch.finished&&(perch.landed||flight.age>=perch.startAt);
}
function segmentDistance(x:number,y:number,pointer:FlightPointer):number {
  const dx=pointer.x-pointer.previousX,dy=pointer.y-pointer.previousY;
  const t=clamp(((x-pointer.previousX)*dx+(y-pointer.previousY)*dy)/(dx*dx+dy*dy||1),0,1);
  return Math.hypot(x-pointer.previousX-t*dx,y-pointer.previousY-t*dy);
}
export function startleFlight(flight:FlightState,pointer:FlightPointer,width:number,height:number):boolean {
  if(flight.fleeing||flight.age<0||flight.x<0||flight.x>1||flight.y<0||flight.y>1)return false;
  const x=flight.x*width,y=flight.y*height,scale=flightScale(flight.z,flight.perspective);
  const close=Math.hypot(pointer.x-x,pointer.y-y)<flight.closeRadius*scale;
  const fast=pointer.speed>flight.speedTolerance&&segmentDistance(x,y,pointer)<flight.alarmRadius*scale;
  if(!close&&!fast)return false;
  const dx=x-pointer.x,dy=y-pointer.y,distance=Math.hypot(dx,dy)||1;
  flight.fleeing=true;flight.exitSide=dx<0?-1:1;
  if(flight.perch)flight.perch.finished=true;
  flight.vx=(Math.abs(dx)<1?flight.exitSide:dx/distance)*540;
  flight.vy=(Math.abs(dx)+Math.abs(dy)<1?-1:dy/distance)*400;
  flight.vz=Math.max(.55/3.8,flight.vz);flight.turnIn=0;
  flight.escapeAngle=Math.atan2(flight.vy,flight.vx);flight.scaredAt=flight.age;flight.flowerWait=undefined;
  flight.motionVx=flight.vx;flight.motionVy=flight.vy;
  return true;
}
/** Escape keeps the animal's normal steering rhythm and wing/body behavior.
 * Every turn stays in the away-facing half-plane, rather than becoming a beam. */
export function steerEvasion(flight:FlightState,kind:'butterfly'|'dragonfly'|'damselfly',random:Random) {
  const pattern=flight.pattern??'flutter',age=flight.age-(flight.scaredAt??flight.age);
  const floating=kind==='butterfly'&&pattern==='float';
  const wave=Math.sin(age*(floating?5.5:kind==='dragonfly'?8:12)+(flight.phase??0));
  const angle=(flight.escapeAngle??(flight.exitSide<0?Math.PI:0))+wave*(floating?.52:kind==='dragonfly'?.65:.85)+between(random,-.12,.12);
  const speed=kind==='dragonfly'?between(random,260,410):kind==='damselfly'?between(random,95,160):flight.speed*between(random,1.45,1.95);
  flight.vx=Math.cos(angle)*speed;flight.vy=Math.sin(angle)*speed;
  flight.turnIn=kind==='dragonfly'?between(random,.18,.48):floating?between(random,.35,.7):between(random,.14,.34);
  flight.vz=flight.fleeing?between(random,.20,.42)/3.8:((flight.perch?.z??flight.z)-flight.z)*.8;
  flight.mode=floating&&age>.8&&random()<.18?'glide':kind==='dragonfly'?'dart':'flap';
  if(flight.mode==='glide')flight.turnIn=Math.min(flight.turnIn,.35);
  if(kind==='butterfly')flight.facing=undefined;else flight.facing=flight.vx<0?-1:1;
}
/** Advance in seconds. Velocity is in CSS pixels/second, independent of aspect ratio. */
export function stepFlight(flight:FlightState,dt:number,width:number,height:number,random:Random,pointer?:FlightPointer,horizon=.5,obstructed?:DepthObstruction):void {
  flight.age+=dt;if(flight.age<0)return;
  if(pointer)startleFlight(flight,pointer,width,height);
  const leaving=flight.fleeing||flight.age>flight.departAt;
  const evading=flight.fleeing||flight.age<(flight.evadeUntil??0);
  if(stepPerch(flight,dt,width,height,random,horizon)){stepFlightWings(flight,dt,flight.pattern==='hover'?18:5);return;}
  flight.motionVx??=flight.vx;flight.motionVy??=flight.vy;
  const pattern=flight.pattern??'flutter';
  flight.modeIn=(flight.modeIn??2)-dt;
  if(!leaving&&!evading&&flight.modeIn<=0){
    const glide=(pattern==='float'||pattern==='flutter')&&flight.mode!=='glide'&&random()<(pattern==='float'?.75:.25);
    flight.mode=glide?'glide':pattern==='hover'&&random()<.6?'hover':'flap';
    flight.modeIn=glide?between(random,.6,1.8):between(random,1.2,3.4);flight.turnIn=0;
  }
  if(leaving&&!evading)flight.mode='flap';
  flight.turnIn-=dt;
  if(flight.turnIn<=0){
    flight.turnIn=between(random,pattern==='float'?.65:.22,pattern==='float'?1.6:.65);
    if(evading)steerEvasion(flight,'butterfly',random);
    else if(leaving){
      flight.vx=flight.exitSide*between(random,230,340);
      flight.vy=clamp(flight.vy+between(random,-100,100),-240,240);
      flight.vz=flight.fleeing?between(random,.35,.8)/3.8:0;
    }else{
      let heading=Math.atan2(flight.vy,flight.vx)+between(random,pattern==='float'?-.65:-1.7,pattern==='float'?.65:1.7);
      // Gently favor the open scene at its outer edges; do not wrap or respawn.
      if(flight.x<.06)heading=between(random,-.85,.85);
      if(flight.x>.94)heading=Math.PI+between(random,-.85,.85);
      flight.vx=Math.cos(heading)*flight.speed;
      flight.vy=Math.sin(heading)*flight.speed*.8;
      if(flight.y<.12)flight.vy=Math.abs(flight.vy)+45;
      if(flight.y>flightBottom(flight.z,horizon,flight.perspective)-.08)flight.vy=-Math.abs(flight.vy)-45;
      flight.vz=between(random,-.65,.85)/3.8;
      if(flight.mode==='glide'){flight.vy=between(random,6,24);flight.vz=0;flight.turnIn=flight.modeIn;}
      if(flight.mode==='hover'){flight.vx=between(random,-9,9);flight.vy=between(random,-7,7);flight.vz=0;}
      if(flight.perch&&!flight.perch.finished&&flight.perch.z!==undefined)flight.vz=(flight.perch.z-flight.z)*.8;
    }
  }
  const movement=flightMovementScale(flight.z,flight.perspective);
  const phase=flight.phase??0;
  // Analytic displacement keeps bobbing independent of frame rate and smaller
  // with distance. Glides have a shallow sink instead of a frozen wingbeat bob.
  const wave=(t:number)=>Math.sin(t*(pattern==='float'?9:15)+phase)*(pattern==='float'?6:3)+Math.sin(t*3.1+phase)*7;
  const bob=(!leaving||evading)&&flight.mode==='flap'?(wave(flight.age)-wave(flight.age-dt))*movement*(evading?1.2:1):0;
  const steering=1-Math.exp(-dt*(leaving&&!evading?16:pattern==='float'?3.5:8));
  flight.motionVx+=(flight.vx-flight.motionVx)*steering;flight.motionVy+=(flight.vy-flight.motionVy)*steering;
  flight.x+=flight.motionVx*movement*dt/Math.max(1,width);flight.y+=(flight.motionVy*movement*dt+bob)/Math.max(1,height);
  if(changeSceneDepth(flight,advanceFlightDepth(flight.z,flight.vz,dt,flight.perspective),horizon,obstructed,flight.perspective)){flight.vz=0;flight.turnIn=0;}
  const bottom=flightBottom(flight.z,horizon,flight.perspective);
  if(flight.y>bottom){flight.y=bottom;flight.vy=-Math.abs(flight.vy);}
  flight.behindForeground=flight.z>=foregroundDepth(flight.perspective);
  flight.heading=clamp(flight.vy/450,-.55,.55)*(flight.vx<0?-1:1);
  stepFlightWings(flight,dt,pattern==='skip'||pattern==='hover'?10:pattern==='float'?5:7);
}

/** The same canvas pixels are used for painting and picking, including rotation. */
export function paintedPixelAt(canvas:HTMLCanvasElement,clientX:number,clientY:number):boolean {
  const rect=canvas.getBoundingClientRect();
  if(!rect.width||!rect.height)return false;
  const x=Math.floor((clientX-rect.left)/rect.width*canvas.width),y=Math.floor((clientY-rect.top)/rect.height*canvas.height);
  if(x<0||y<0||x>=canvas.width||y>=canvas.height)return false;
  return (canvas.getContext('2d',{willReadFrequently:true})?.getImageData(x,y,1,1).data[3]??0)>0;
}
