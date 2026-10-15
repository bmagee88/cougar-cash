import { Random } from '../engine/types';

// Coordinates are fractions of the visible scene. The simulation is twice its
// width and height, allowing an individual to leave the view and loop back.
export const FLIGHT_BOUNDS={left:-.5,right:1.5,top:-.5,bottom:1.5};
export const FOREGROUND_DEPTH=1.05, MAX_FLIGHT_DEPTH=3.8;
export interface FlightPointer {x:number;y:number;previousX:number;previousY:number;speed:number}
export interface ButterflyPerch {
  x:number;y:number;startAt:number;remaining:number;landed:boolean;finished:boolean;
  frame:number;nextFrameIn:number;fast:boolean;
}
export interface FlightState {
  x:number;y:number;z:number;vx:number;vy:number;vz:number;age:number;turnIn:number;
  speed:number;heading:number;exitSide:number;departAt:number;fleeing:boolean;
  behindForeground:boolean;closeRadius:number;alarmRadius:number;speedTolerance:number;perch?:ButterflyPerch;
}
const between=(random:Random,min:number,max:number)=>min+random()*(max-min);
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
export const flightScale=(z:number)=>1/(.7+z*.85);
export const flightOpacity=(z:number)=>clamp((MAX_FLIGHT_DEPTH-z)/.7,0,1);
export const flightExpired=(flight:FlightState)=>flight.z>=MAX_FLIGHT_DEPTH||flight.x<FLIGHT_BOUNDS.left||flight.x>FLIGHT_BOUNDS.right||flight.y<FLIGHT_BOUNDS.top||flight.y>FLIGHT_BOUNDS.bottom;
export const isPerched=(flight:FlightState)=>!!flight.perch?.landed&&!flight.perch.finished;
export function planPerch(flight:FlightState,x:number,y:number,random:Random):void {
  flight.perch={x,y,startAt:between(random,2.5,5.5),remaining:between(random,6,13),landed:false,finished:false,frame:0,nextFrameIn:between(random,.3,1),fast:random()<.4};
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
  return {x:side<0?-.09:1.09,y:between(random,.2,.78),z:between(random,.18,.62),
    vx:-side*between(random,150,230),vy:between(random,-45,45),vz:between(random,-.2,.25),
    age:-delay,turnIn:.6,speed:between(random,140,250),heading:0,exitSide:-side,
    departAt:between(random,24,42),fleeing:false,behindForeground:false,
    closeRadius:between(random,2.5,6),alarmRadius:between(random,65,135),speedTolerance:between(random,160,430)};
}
function segmentDistance(x:number,y:number,pointer:FlightPointer):number {
  const dx=pointer.x-pointer.previousX,dy=pointer.y-pointer.previousY;
  const t=clamp(((x-pointer.previousX)*dx+(y-pointer.previousY)*dy)/(dx*dx+dy*dy||1),0,1);
  return Math.hypot(x-pointer.previousX-t*dx,y-pointer.previousY-t*dy);
}
export function startleFlight(flight:FlightState,pointer:FlightPointer,width:number,height:number):boolean {
  if(flight.fleeing||flight.age<0||flight.x<0||flight.x>1||flight.y<0||flight.y>1)return false;
  const x=flight.x*width,y=flight.y*height,scale=flightScale(flight.z);
  const close=Math.hypot(pointer.x-x,pointer.y-y)<flight.closeRadius*scale;
  const fast=pointer.speed>flight.speedTolerance&&segmentDistance(x,y,pointer)<flight.alarmRadius*scale;
  if(!close&&!fast)return false;
  const dx=x-pointer.x,dy=y-pointer.y,distance=Math.hypot(dx,dy)||1;
  flight.fleeing=true;flight.exitSide=dx<0?-1:1;
  if(flight.perch)flight.perch.finished=true;
  flight.vx=(Math.abs(dx)<1?flight.exitSide:dx/distance)*540;
  flight.vy=(Math.abs(dx)+Math.abs(dy)<1?-1:dy/distance)*400;
  flight.vz=Math.max(.55,flight.vz);flight.turnIn=0;
  return true;
}
/** Advance in seconds. Velocity is in CSS pixels/second, independent of aspect ratio. */
export function stepFlight(flight:FlightState,dt:number,width:number,height:number,random:Random,pointer?:FlightPointer):void {
  flight.age+=dt;if(flight.age<0)return;
  if(pointer)startleFlight(flight,pointer,width,height);
  const leaving=flight.fleeing||flight.age>flight.departAt;
  const perch=flight.perch;
  if(perch&&!perch.finished){
    if(leaving||flight.behindForeground)perch.finished=true;
    else if(flight.age>=perch.startAt){
      if(!perch.landed){
        const dx=(perch.x-flight.x)*width,dy=(perch.y-flight.y)*height,distance=Math.hypot(dx,dy),speed=flight.speed*1.4;
        const travel=Math.min(distance,speed*dt);
        flight.x+=dx/(distance||1)*travel/Math.max(1,width);flight.y+=dy/(distance||1)*travel/Math.max(1,height);
        flight.vx=dx/(distance||1)*speed;flight.vy=dy/(distance||1)*speed;flight.vz=0;flight.heading=clamp(flight.vy/450,-.55,.55);
        if(distance<=travel+2){perch.landed=true;flight.x=perch.x;flight.y=perch.y;flight.vx=0;flight.vy=0;flight.heading=-.14;}
      }else{
        perch.remaining-=dt;stepPerchedWings(perch,dt,random);
        if(perch.remaining<=0){perch.finished=true;flight.turnIn=0;}
      }
      if(!perch.finished)return;
    }
  }
  flight.turnIn-=dt;
  if(flight.turnIn<=0){
    flight.turnIn=between(random,.12,.36);
    if(leaving){
      flight.vx=flight.exitSide*between(random,flight.fleeing?430:230,flight.fleeing?670:340);
      flight.vy=clamp(flight.vy+between(random,-100,100),-240,240);
      flight.vz=flight.fleeing?between(random,.35,.8):0;
    }else{
      let heading=between(random,-Math.PI,Math.PI);
      // Gently favor the open scene at its outer edges; do not wrap or respawn.
      if(flight.x<.06)heading=between(random,-.85,.85);
      if(flight.x>.94)heading=Math.PI+between(random,-.85,.85);
      flight.vx=Math.cos(heading)*flight.speed;
      flight.vy=Math.sin(heading)*flight.speed*.8;
      if(flight.y<.12)flight.vy=Math.abs(flight.vy)+45;
      if(flight.y>.86)flight.vy=-Math.abs(flight.vy)-45;
      flight.vz=between(random,-.65,.85);
    }
  }
  flight.x+=flight.vx*dt/Math.max(1,width);flight.y+=flight.vy*dt/Math.max(1,height);
  flight.z=Math.max(flight.behindForeground?FOREGROUND_DEPTH+.015:.05,flight.z+flight.vz*dt);
  if(flight.z>=FOREGROUND_DEPTH)flight.behindForeground=true;
  flight.heading=clamp(flight.vy/450,-.55,.55)*(flight.vx<0?-1:1);
}

/** The same canvas pixels are used for painting and picking, including rotation. */
export function paintedPixelAt(canvas:HTMLCanvasElement,clientX:number,clientY:number):boolean {
  const rect=canvas.getBoundingClientRect();
  if(!rect.width||!rect.height)return false;
  const x=Math.floor((clientX-rect.left)/rect.width*canvas.width),y=Math.floor((clientY-rect.top)/rect.height*canvas.height);
  if(x<0||y<0||x>=canvas.width||y>=canvas.height)return false;
  return (canvas.getContext('2d',{willReadFrequently:true})?.getImageData(x,y,1,1).data[3]??0)>0;
}
