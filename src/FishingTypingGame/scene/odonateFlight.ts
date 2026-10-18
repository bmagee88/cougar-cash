import { Random } from '../engine/types';
import {advanceSceneDepth,changeSceneDepth,DepthObstruction,foregroundDepth} from './sceneDepth';
import { FlightPointer, FlightState, flightBottom, flightMovementScale, startleFlight, steerEvasion, stepFlightWings, stepPerch } from './butterflyFlight';

/** Dragonflies alternate patrols and stationary hover/dart hunting; broad-winged
 * jewelwings flutter in short, slower bouts close to shoreline vegetation. */
export function stepOdonate(f:FlightState,kind:'dragonfly'|'damselfly',dt:number,width:number,height:number,random:Random,pointer?:FlightPointer,horizon=.5,obstructed?:DepthObstruction):void {
  f.age+=dt;if(f.age<0)return;
  if(pointer)startleFlight(f,pointer,width,height);
  const leaving=f.fleeing||f.age>f.departAt;
  const evading=f.fleeing||f.age<(f.evadeUntil??0);
  if(stepPerch(f,dt,width,height,random,horizon)){stepFlightWings(f,dt);return;}
  f.motionVx??=f.vx;f.motionVy??=f.vy;
  f.turnIn-=dt;
  if(f.turnIn<=0){
    const inside=f.x>.08&&f.x<.92;
    const hover=kind==='dragonfly'&&inside&&!leaving&&random()<.36;
    f.turnIn=hover?.5+random()*1.3:kind==='dragonfly'?.35+random()*.75:.2+random()*.45;
    if(evading)steerEvasion(f,kind,random);
    else if(leaving){f.vx=f.exitSide*240;f.facing=f.exitSide;f.vy=-20;f.vz=0;}
    else if(hover){f.vx=(random()-.5)*12;f.vy=(random()-.5)*9;f.vz=(random()-.5)*.08/3.8;f.mode='hover';}
    else {
      const inward=f.x<.08?1:f.x>.92?-1:random()<.4?-1:1;
      const backward=kind==='dragonfly'&&inside&&f.facing!==undefined&&random()<.25;
      f.facing=backward?f.facing:inward;
      f.vx=backward?-f.facing!*(45+random()*55):inward*(kind==='dragonfly'?170+random()*190:45+random()*55);
      f.vy=(random()-.5)*(kind==='dragonfly'?170:90);
      if(f.y<(kind==='damselfly'?horizon-.1:.2))f.vy=Math.abs(f.vy);if(f.y>flightBottom(f.z,horizon,f.perspective)-.12)f.vy=-Math.abs(f.vy);
      f.vz=(random()-.45)*(kind==='dragonfly'?.6:.25)/3.8;
      f.mode=kind==='dragonfly'?'dart':'flap';
    }
    const home=f.perch;
    if(!leaving&&!evading&&home&&!home.finished){
      f.vz=((home.z??.06)-f.z)*.8;
      // Small hunting loops stay in the plant's neighborhood, then the shared
      // landing controller takes over at the scheduled return time.
      if(home.visits){
        const dx=(home.x-f.x)*width,dy=(home.y-f.y)*height;
        const radius=kind==='dragonfly'?Math.min(190,width*.25):Math.min(85,width*.14);
        if(Math.hypot(dx,dy)>radius){
          const angle=Math.atan2(dy,dx)+(kind==='dragonfly'?.32:.15);
          f.vx=Math.cos(angle)*(kind==='dragonfly'?210:75);f.vy=Math.sin(angle)*(kind==='dragonfly'?210:75);f.facing=f.vx<0?-1:1;
        }
      }
    }
  }
  const movement=flightMovementScale(f.z,f.perspective);
  const flutter=kind==='damselfly'&&(!leaving||evading)?(Math.sin(f.age*14+(f.phase??0))-Math.sin((f.age-dt)*14+(f.phase??0)))*2.5:0;
  const steering=1-Math.exp(-dt*(kind==='dragonfly'?12:6));
  f.motionVx+=(f.vx-f.motionVx)*steering;f.motionVy+=(f.vy-f.motionVy)*steering;
  f.x+=f.motionVx*movement*dt/Math.max(1,width);f.y+=(f.motionVy*dt+flutter)*movement/Math.max(1,height);
  if(changeSceneDepth(f,advanceSceneDepth(f.z,f.vz,dt,f.perspective),horizon,obstructed,f.perspective)){f.vz=0;f.turnIn=0;}
  const bottom=flightBottom(f.z,horizon,f.perspective);
  if(f.y>bottom){f.y=bottom;f.vy=-Math.abs(f.vy);}
  f.behindForeground=f.z>=foregroundDepth(f.perspective);
  // Hover/backward corrections retain the body's direction; a dart banks gently.
  if(Math.abs(f.vx)>30)f.heading=Math.max(-.4,Math.min(.4,f.vy/450))*(f.vx<0?-1:1);
  stepFlightWings(f,dt,kind==='dragonfly'?16:7);
}
