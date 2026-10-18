import { Random } from '../engine/types';
import { FlightPointer, FlightState, isPerched, planPerch, startleFlight, stepFlightWings } from './butterflyFlight';

const gardens=new WeakMap<HTMLElement,Set<FlightState>>();
export function registerGardenFlights(scene:HTMLElement,flights:FlightState[]) {
  if(!flights.length)return ()=>{};
  let garden=gardens.get(scene);if(!garden){garden=new Set();gardens.set(scene,garden);}
  flights.forEach(flight=>garden!.add(flight));
  return ()=>{flights.forEach(flight=>garden!.delete(flight));if(!garden!.size&&gardens.get(scene)===garden)gardens.delete(scene);};
}
export const gardenFlights=(scene:HTMLElement):FlightState[]=>Array.from(gardens.get(scene)??[]);

function retarget(flight:FlightState,peers:readonly FlightState[],random:Random,delay=.3) {
  const previous=flight.perch;
  const choices=(flight.plants??[]).filter(plant=>plant.id!==previous?.plantId);
  const free=choices.filter(plant=>!peers.some(peer=>peer!==flight&&isPerched(peer)&&peer.perch?.plantId===plant.id));
  const plant=(free.length?free:choices)[Math.floor(random()*(free.length||choices.length))];
  flight.flowerWait=undefined;flight.turnIn=0;
  if(!plant){if(previous)previous.finished=true;flight.plantSearchAt=flight.age+2;return;}
  planPerch(flight,plant.x,plant.y-(previous?.hoverFeed?.018:0),random,{plantId:plant.id,z:plant.z,startAt:flight.age+delay,
    repeats:previous?.repeats,restFrame:previous?.restFrame,hoverFeed:previous?.hoverFeed});
  flight.plantSearchAt=undefined;
}

/** Both visitor families share the same scene registry. No occupancy timers or
 * permanent claims: departing, hidden, caught and unmounted insects release it. */
export function stepGardenEncounter(flight:FlightState,dt:number,width:number,height:number,peers:readonly FlightState[],random:Random,pointer?:FlightPointer):boolean {
  if(pointer)startleFlight(flight,pointer,width,height);
  if(flight.fleeing||flight.age<0||flight.behindForeground||flight.age>flight.departAt){flight.flowerWait=undefined;return false;}
  if(flight.plantSearchAt!==undefined&&flight.age>=flight.plantSearchAt)retarget(flight,peers,random);
  const perch=flight.perch;
  if(!perch||perch.finished||perch.landed||flight.age<perch.startAt||!perch.plantId){flight.flowerWait=undefined;return false;}
  const plant=flight.plants?.find(candidate=>candidate.id===perch.plantId);
  if(!plant||(plant.kind!=='flower'&&perch.restFrame===undefined)){flight.flowerWait=undefined;return false;}
  const distance=(candidate:FlightState)=>Math.hypot((candidate.x-perch.x)*width,(candidate.y-perch.y)*height);
  if(distance(flight)>58&&!flight.flowerWait)return false;
  const contenders=peers.filter(peer=>peer!==flight&&!peer.fleeing&&peer.age>=0&&!peer.perch?.finished&&peer.perch?.plantId===perch.plantId);
  const occupant=contenders.find(isPerched);
  // A closer arriving visitor reserves the last few pixels of the approach.
  // Stable registry order breaks ties, so two insects cannot land together.
  const order=peers.indexOf(flight);
  const arriving=contenders.find(peer=>!peer.flowerWait&&distance(peer)<32&&(distance(peer)<distance(flight)-1||
    (Math.abs(distance(peer)-distance(flight))<=1&&peers.indexOf(peer)<order)));
  const blocked=occupant??arriving;
  if(!blocked){flight.flowerWait=undefined;return false;}
  if(!flight.flowerWait){
    if(occupant&&random()<.35){
      const angle=Math.atan2((occupant.y-flight.y)*height,(occupant.x-flight.x)*width);
      retarget(occupant,peers,random,1.1);
      occupant.escapeAngle=angle;occupant.scaredAt=occupant.age;occupant.evadeUntil=occupant.age+1;
      occupant.mode='flap';occupant.turnIn=0;occupant.vx=Math.cos(angle)*occupant.speed*1.5;occupant.vy=Math.sin(angle)*occupant.speed*1.5;
      return false;
    }
    const side=flight.x<perch.x?-1:1;
    flight.flowerWait={plantId:perch.plantId,until:flight.age+2.2+random()*1.8,
      x:Math.max(.03,Math.min(.97,perch.x+side*32/Math.max(1,width))),y:Math.max(.04,perch.y-26/Math.max(1,height))};
  }
  const wait=flight.flowerWait;
  if(flight.age>=wait.until){retarget(flight,peers,random);return false;}
  const ease=1-Math.exp(-dt*5),beforeX=flight.x,beforeY=flight.y;
  const bob=Math.sin((flight.age+dt)*10+(flight.phase??0))*2.5/Math.max(1,height);
  flight.x+=(wait.x-flight.x)*ease;flight.y+=(wait.y+bob-flight.y)*ease;
  flight.z+=((perch.z??flight.z)-flight.z)*ease;flight.mode='hover';
  flight.vx=(flight.x-beforeX)*width/Math.max(.001,dt);flight.vy=(flight.y-beforeY)*height/Math.max(.001,dt);
  flight.motionVx=flight.vx;flight.motionVy=flight.vy;flight.age+=dt;
  stepFlightWings(flight,dt,flight.pattern==='skip'?10:6);
  return true;
}
