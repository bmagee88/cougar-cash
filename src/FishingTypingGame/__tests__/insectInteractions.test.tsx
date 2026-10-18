import { configureButterflyFlight,createFlight,isPerched,planPerch,startleFlight,stepFlight } from '../scene/butterflyFlight';
import { stepOdonate } from '../scene/odonateFlight';
import { gardenFlights,registerGardenFlights,stepGardenEncounter } from '../scene/insectGarden';
import { PlantPerch } from '../scene/plantMap';

declare const test:any,expect:any;
const plants:PlantPerch[]=[
  {id:'flower-a',label:'A',layer:'flowers',x:.5,y:.7,z:.25,kind:'flower',uses:['butterfly']},
  {id:'flower-b',label:'B',layer:'flowers',x:.8,y:.7,z:.25,kind:'flower',uses:['butterfly']},
];
function visitor(landed=false){
  const f={...createFlight(()=>.5),x:.49,y:.68,z:.25,plants,departAt:100};
  configureButterflyFlight(f,'monarch',()=>.5);
  planPerch(f,.5,.7,()=>.5,{plantId:'flower-a',z:.25,startAt:0,landed});
  if(landed){f.x=.5;f.y=.7;f.vx=0;f.vy=0;}
  return f;
}

test('an arriving butterfly waits near an occupied flower, then moves to another station after a few seconds',()=>{
  const resident=visitor(true),incoming=visitor(),peers=[resident,incoming];
  expect(stepGardenEncounter(incoming,.02,800,600,peers,()=>.9)).toBe(true);
  expect(incoming.flowerWait?.plantId).toBe('flower-a');expect(incoming.perch!.landed).toBe(false);
  for(let i=0;i<210;i++)if(!stepGardenEncounter(incoming,.02,800,600,peers,()=>.9))stepFlight(incoming,.02,800,600,()=>.5);
  expect(incoming.perch!.plantId).toBe('flower-b');expect(incoming.flowerWait).toBeUndefined();expect(isPerched(resident)).toBe(true);
});

test('a waiting butterfly immediately resumes its approach when the occupant leaves',()=>{
  const resident=visitor(true),incoming=visitor(),peers=[resident,incoming];
  stepGardenEncounter(incoming,.02,800,600,peers,()=>.9);resident.perch!.finished=true;
  expect(stepGardenEncounter(incoming,.02,800,600,peers,()=>.9)).toBe(false);
  expect(incoming.flowerWait).toBeUndefined();expect(incoming.perch!.plantId).toBe('flower-a');
});

test('a displaced occupant keeps its flight style and seeks another plant rather than permanently fleeing',()=>{
  const resident=visitor(true),incoming=visitor(),peers=[resident,incoming];
  expect(stepGardenEncounter(incoming,.02,800,600,peers,()=>0)).toBe(false);
  expect(resident.perch!.plantId).toBe('flower-b');expect(isPerched(resident)).toBe(false);
  expect(resident.fleeing).toBe(false);expect(resident.evadeUntil).toBeGreaterThan(resident.age);
  expect(resident.pattern).toBe('float');expect(incoming.perch!.plantId).toBe('flower-a');
});

test('simultaneous arrivals cannot both occupy the same flower',()=>{
  const first=visitor(),second=visitor();first.x=second.x=.5;first.y=second.y=.7;
  const peers=[first,second];
  if(!stepGardenEncounter(first,.02,800,600,peers,()=>.9))stepFlight(first,.02,800,600,()=>.5);
  stepGardenEncounter(second,.02,800,600,peers,()=>.9);
  expect(peers.filter(isPerched)).toHaveLength(1);expect(second.flowerWait).toBeDefined();
});

test('a cursor scare cancels flower waiting and escape paths retain curved, species-specific motion',()=>{
  for(const kind of ['butterfly','dragonfly','damselfly'] as const){
    const f=visitor();f.x=.5;f.y=.4;f.perch!.finished=true;
    configureButterflyFlight(f,kind==='butterfly'?'monarch':'cabbage-white',()=>.5);
    f.flowerWait={plantId:'flower-a',x:.4,y:.5,until:10};
    expect(startleFlight(f,{x:390,y:240,previousX:390,previousY:240,speed:900},800,600)).toBe(true);
    expect(f.flowerWait).toBeUndefined();const heights:number[]=[];
    for(let i=0;i<120;i++){
      if(kind==='butterfly')stepFlight(f,1/60,800,600,()=>.5);else stepOdonate(f,kind,1/60,800,600,()=>.5);
      heights.push(f.y);
    }
    expect(f.x).toBeGreaterThan(.5);expect((Math.max(...heights)-Math.min(...heights))*600).toBeGreaterThan(5);
    expect(f.fleeing).toBe(true);
  }
});

test('visitor families share occupancy, and caught or unmounted visitors release their registration',()=>{
  const scene=document.createElement('div'),a=visitor(),b=visitor();
  const empty=registerGardenFlights(scene,[]),releaseA=registerGardenFlights(scene,[a]),releaseB=registerGardenFlights(scene,[b]);
  empty();expect(gardenFlights(scene)).toEqual([a,b]);releaseA();expect(gardenFlights(scene)).toEqual([b]);
  releaseB();expect(gardenFlights(scene)).toEqual([]);
});

test('odonates cannot land together on a dedicated reed tip',()=>{
  const reed={...plants[0],id:'reed',kind:'stem' as const,uses:['dragonfly' as const],dedicated:true};
  const resident=visitor(true),incoming=visitor();
  for(const flight of [resident,incoming]){flight.plants=[reed];flight.perch!.plantId=reed.id;flight.perch!.restFrame=0;}
  expect(stepGardenEncounter(incoming,.02,800,600,[resident,incoming],()=>.9)).toBe(true);
  expect(isPerched(incoming)).toBe(false);expect(incoming.flowerWait?.plantId).toBe('reed');
  resident.perch!.finished=true;
  expect(stepGardenEncounter(incoming,.02,800,600,[resident,incoming],()=>.9)).toBe(false);
});
