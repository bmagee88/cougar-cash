import { configureButterflyFlight, createFlight, isPerched, planPerch, startleFlight, stepFlight } from '../scene/butterflyFlight';
import { stepOdonate } from '../scene/odonateFlight';
import { LOCATION_PLANTS, MappedPlant, planPlantVisit, plantsForLocation, visiblePlantPerches } from '../scene/plantMap';
import { blankEntry, saveNotebookEntry } from '../engine/notebook';
import { deserializeSave, emptySave } from '../engine/storage';
import { butterflyPoseAsset } from '../engine/butterflies';

declare const test:any,expect:any,jest:any,afterEach:any;
afterEach(()=>jest.restoreAllMocks());
const rect=(left=0,top=0,width=800,height=600)=>({left,top,right:left+width,bottom:top+height,x:left,y:top,width,height,toJSON:()=>({})} as DOMRect);

test('every location has mapped nectar, leaves and stalks; responsive crop and hidden cutouts filter destinations',()=>{
  Object.values(LOCATION_PLANTS).forEach(plants=>{
    expect(new Set(plants.map(plant=>plant.id)).size).toBe(plants.length);
    expect(new Set(plants.map(plant=>plant.kind)).size).toBe(1);
    plants.forEach(plant=>{expect(plant.z).toBeLessThan(1.05);expect(plant.x).toBeGreaterThan(0);expect(plant.y).toBeLessThan(1);});
  });
  const scene=document.createElement('div'),bank=document.createElement('img');bank.dataset.layer='cove-seat';scene.appendChild(bank);
  jest.spyOn(bank,'getBoundingClientRect').mockReturnValue(rect(-100,-200,1200,800));
  const projected=visiblePlantPerches(scene,'cove',rect());
  expect(projected.map(plant=>plant.id)).not.toContain('cove-left-flowers');
  expect(projected.find(plant=>plant.id==='cove-ledge-flowers')).toBeUndefined();
  expect(projected.find(plant=>plant.id==='cove-bank-stalk')).toBeUndefined();
  const leaf=projected.find(plant=>plant.id==='cove-root-leaves')!;
  expect(leaf.x).toBeCloseTo((-100+1200*.16)/800);expect(leaf.y).toBeCloseTo((-200+800*.61)/600);
  bank.style.display='none';expect(visiblePlantPerches(scene,'cove',rect())).toHaveLength(0);
});

test('butterfly flap-and-glide phases hold the wings during a shallow glide; species use different flight styles',()=>{
  const f={...createFlight(()=>.5),x:.5,y:.4,turnIn:10,modeIn:.01};configureButterflyFlight(f,'monarch',()=>.5);
  stepFlight(f,.02,800,600,()=>.1);expect(f.mode).toBe('glide');expect(f.wingFrame).toBe(0);
  const height=f.y;for(let i=0;i<15;i++)stepFlight(f,.02,800,600,()=>.5);
  expect(f.mode).toBe('glide');expect(f.wingFrame).toBe(0);expect(f.y).toBeGreaterThan(height);
  f.modeIn=0;stepFlight(f,.02,800,600,()=>.99);expect(f.mode).toBe('flap');
  for(const [id,pattern] of [['pearl-crescent','flutter'],['silver-spotted-skipper','skip'],['luna-moth','moth'],['hummingbird-clearwing','hover']]){
    configureButterflyFlight(f,id,()=>.5);expect(f.pattern).toBe(pattern);
  }
});

test('floating has repeated rises and dips and stays consistent at 30, 60 and 120 updates per second',()=>{
  const finish=(hz:number)=>{
    const f={...createFlight(()=>.5),x:.5,y:.4,z:.3,vx:0,vy:0,vz:0,turnIn:100,modeIn:100};configureButterflyFlight(f,'monarch',()=>.5);
    const heights:number[]=[];for(let i=0;i<hz*2;i++){stepFlight(f,1/hz,800,600,()=>.5);heights.push(f.y);}
    let turns=0;for(let i=1;i<heights.length-1;i++)if((heights[i]-heights[i-1])*(heights[i+1]-heights[i])<0)turns++;
    expect(turns).toBeGreaterThan(3);return f.y;
  };
  expect(finish(30)).toBeCloseTo(finish(120),8);expect(finish(60)).toBeCloseTo(finish(120),8);
});

test('dragonflies and jewelwings land, hunt, and return twice to their own mapped perch with correct resting wings',()=>{
  for(const kind of ['dragonfly','damselfly'] as const){
    const f={...createFlight(()=>.5),x:.5,y:.7,z:.3,departAt:100};
    const plants=plantsForLocation('cove').map(plant=>({...plant,x:.5,y:.7}));
    planPlantVisit(f,plants,kind,()=>.5);f.perch!.startAt=0;f.perch!.remaining=.1;
    const home=f.perch!.plantId,landings=new Set<number>(),rests:{plantId?:string;x:number;y:number;frame:number}[]=[];let airborne=false;
    for(let i=0;i<2200;i++){
      stepOdonate(f,kind,.02,800,600,()=>.5);
      if(isPerched(f)){
        landings.add(f.perch!.visits!);rests.push({plantId:f.perch!.plantId,x:f.x,y:f.y,frame:f.perch!.frame});
      }else if(f.perch?.visits)airborne=true;
    }
    expect(airborne).toBe(true);expect(Array.from(landings)).toEqual([1,2,3]);
    rests.forEach(rest=>expect(rest).toEqual({plantId:home,x:.5,y:.7,frame:kind==='dragonfly'?0:3}));
  }
});

test('butterflies visit another compatible plant and a startled perched insect abandons its return route',()=>{
  const f={...createFlight(()=>.5),x:.3,y:.7,z:.3,departAt:100};
  // Retargeting needs two nectar destinations, regardless of today's garden.
  const flowers:MappedPlant[]=[
    {id:'aster-a',label:'Aster A',layer:'aster-a',x:.3,y:.7,z:.06,kind:'flower',uses:['butterfly']},
    {id:'aster-b',label:'Aster B',layer:'aster-b',x:.5,y:.7,z:.06,kind:'flower',uses:['butterfly']},
  ];
  planPlantVisit(f,flowers,'butterfly',()=>.5);f.x=f.perch!.x;f.y=f.perch!.y;f.perch!.startAt=0;
  stepFlight(f,.02,800,600,()=>.5);const first=f.perch!.plantId;f.perch!.remaining=.01;
  stepFlight(f,.02,800,600,()=>.5);expect(f.perch!.plantId).not.toBe(first);
  planPerch(f,.5,.7,()=>.5,{repeats:2,startAt:0});f.x=.5;f.y=.7;
  stepOdonate(f,'dragonfly',.02,800,600,()=>.5);expect(isPerched(f)).toBe(true);
  expect(startleFlight(f,{x:400,y:420,previousX:400,previousY:420,speed:0},800,600)).toBe(true);
  expect(f.perch!.finished).toBe(true);expect(isPerched(f)).toBe(false);
});

test('sideways wing poses persist through journal recording and reload without changing old pose sources',()=>{
  const pose={frame:5,rotation:.25,flipped:true,view:'side' as const};
  const entry=blankEntry('side-flight',new Date().toISOString(),'birch',{kind:'butterfly',speciesId:'monarch',wingspanMm:100,pose});
  const saved=saveNotebookEntry(emptySave(),entry.id,{title:'Gliding over the flowers'},entry);
  expect(deserializeSave(JSON.stringify(saved)).notebook![0].image).toEqual(entry.image);
  expect(butterflyPoseAsset('monarch',5,'side')).toMatch(/side-small-pose-5.webp$/);
  expect(butterflyPoseAsset('monarch',5)).toMatch(/\/pose-5.webp$/);
});
