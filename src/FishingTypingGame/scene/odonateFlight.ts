import { Random } from '../engine/types';
import { FlightPointer, FlightState, flightBottom, flightMovementScale, FOREGROUND_DEPTH, startleFlight } from './butterflyFlight';

/** Dragonflies alternate patrols and stationary hover/dart hunting; broad-winged
 * jewelwings flutter in short, slower bouts close to shoreline vegetation. */
export function stepOdonate(f:FlightState,kind:'dragonfly'|'damselfly',dt:number,width:number,height:number,random:Random,pointer?:FlightPointer,horizon=.5):void {
  f.age+=dt;if(f.age<0)return;
  if(pointer)startleFlight(f,pointer,width,height);
  const leaving=f.fleeing||f.age>f.departAt;
  f.turnIn-=dt;
  if(f.turnIn<=0){
    const inside=f.x>.08&&f.x<.92;
    const hover=kind==='dragonfly'&&inside&&!leaving&&random()<.36;
    f.turnIn=hover?.5+random()*1.3:kind==='dragonfly'?.35+random()*.75:.2+random()*.45;
    if(leaving){f.vx=f.exitSide*(f.fleeing?480:240);f.facing=f.exitSide;f.vy=-20;f.vz=f.fleeing?.5:0;}
    else if(hover){f.vx=(random()-.5)*12;f.vy=(random()-.5)*9;f.vz=(random()-.5)*.08;}
    else {
      const inward=f.x<.08?1:f.x>.92?-1:random()<.4?-1:1;
      const backward=kind==='dragonfly'&&inside&&f.facing!==undefined&&random()<.25;
      f.facing=backward?f.facing:inward;
      f.vx=backward?-f.facing!*(45+random()*55):inward*(kind==='dragonfly'?170+random()*190:45+random()*55);
      f.vy=(random()-.5)*(kind==='dragonfly'?170:90);
      if(f.y<(kind==='damselfly'?horizon-.1:.2))f.vy=Math.abs(f.vy);if(f.y>flightBottom(f.z,horizon)-.12)f.vy=-Math.abs(f.vy);
      f.vz=(random()-.45)*(kind==='dragonfly'?.6:.25);
    }
  }
  const bottomBefore=flightBottom(f.z,horizon),movement=flightMovementScale(f.z);
  const flutter=kind==='damselfly'&&!leaving?Math.sin(f.age*12)*12:0;
  f.x+=f.vx*movement*dt/Math.max(1,width);f.y+=(f.vy+flutter)*movement*dt/Math.max(1,height);
  f.z=Math.max(f.behindForeground?FOREGROUND_DEPTH+.015:.05,f.z+f.vz*dt);
  const bottom=flightBottom(f.z,horizon);
  if(f.y>horizon&&bottomBefore>horizon)f.y=horizon+(f.y-horizon)*(bottom-horizon)/(bottomBefore-horizon);
  if(f.y>bottom){f.y=bottom;f.vy=-Math.abs(f.vy);}
  if(f.z>=FOREGROUND_DEPTH)f.behindForeground=true;
  // Hover/backward corrections retain the body's direction; a dart banks gently.
  if(Math.abs(f.vx)>30)f.heading=Math.max(-.4,Math.min(.4,f.vy/450))*(f.vx<0?-1:1);
}
