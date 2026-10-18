import {advancePlantStems,getPlantWorld,newYorkMidnight,plantCalendar,plantGenerationStats,plantRandom,plantSnapshot,PlantStem,PlantWorld,PLANT_CHECKPOINT_KEY,PLANT_WORLD_KEY,stemIdentity} from '../engine/plantLifecycle';
import {PLANT_ANCHORS_V1,plantSpecies} from '../engine/plantSpecies';
import {WORLD,worldAt} from '../engine/world';

declare const test:any,expect:any,jest:any,beforeEach:any,afterEach:any;
const world:PlantWorld={seed:'plant-lifecycle-test-world',generationVersion:1};
const date=(day:number)=>worldAt(WORLD.epoch+day*WORLD.dayMs+1);
function fresh(){let module:any;jest.isolateModules(()=>{module=require('../engine/plantLifecycle');});return module;}
beforeEach(()=>localStorage.clear());afterEach(()=>jest.restoreAllMocks());
const stem=(plantId:string,slot:number,bornDay:number,stage:PlantStem['stage']):PlantStem=>({id:stemIdentity(plantId,slot,bornDay),slot,bornDay,stage});
const successfulDay=(id:string,namespace:string,start=2)=>{let day=start;while(plantRandom(world,namespace,id,day)>=.6)day++;return day;};

test('world identity persists with its generation version and never writes fishing progress',()=>{
  const saved='{"balance":1234,"catches":["keep me"],"weather":"natural"}';localStorage.setItem('fishing-progress',saved);
  const a=fresh().getPlantWorld(),b=fresh().getPlantWorld();expect(a).toEqual(b);expect(a.seed.length).toBeGreaterThan(0);expect(a.generationVersion).toBe(1);
  expect(localStorage.getItem('fishing-progress')).toBe(saved);
  localStorage.setItem(PLANT_WORLD_KEY,JSON.stringify({seed:'future-world',generationVersion:99}));
  const module=fresh();expect(module.getPlantWorld()).toEqual({seed:'future-world',generationVersion:99});
  expect(module.plantSnapshot('dock',date(10)).unsupported).toBe(true);expect(JSON.parse(localStorage.getItem(PLANT_WORLD_KEY)!).generationVersion).toBe(99);
});

test('daily birth and stage advancement rates are 90% and 65%, with no birthday advancement',()=>{
  const plant={id:'birth-test',speciesId:'cornflower'};
  const original=stem(plant.id,0,0,'stem');
  let births=0,advances=0;
  for(let day=1;day<=10000;day++){
    const grown=advancePlantStems(world,plant,[],day,'summer');expect(grown.length).toBeLessThanOrEqual(1);
    if(grown.length){births++;expect(grown[0]).toMatchObject({bornDay:day,stage:'stem'});}
    if(advancePlantStems(world,plant,[original],day,'summer').find(s=>s.id===original.id)!.stage==='bud')advances++;
  }
  expect(births/10000).toBeGreaterThan(.88);expect(births/10000).toBeLessThan(.92);
  expect(advances/10000).toBeGreaterThan(.63);expect(advances/10000).toBeLessThan(.67);
  const newborn=stem(plant.id,0,4,'stem');expect(advancePlantStems(world,plant,[newborn],4,'summer').find(s=>s.id===newborn.id)!.stage).toBe('stem');
});

test('five active stems include withering, and removal frees a slot before the birth attempt',()=>{
  const plant={id:'capacity-test',speciesId:'aster'},full=Array.from({length:5},(_,n)=>stem(plant.id,n,0,'stem'));
  for(let day=1;day<40;day++)expect(advancePlantStems(world,plant,full,day,'spring')).toEqual(full);
  const old=stem(plant.id,2,0,'withering'),day=successfulDay(old.id,'advance');
  const grown=advancePlantStems(world,plant,[old],day,'autumn');expect(grown.some(s=>s.id===old.id)).toBe(false);
  expect(grown.length).toBeLessThanOrEqual(1);grown.forEach(s=>{expect(s.bornDay).toBe(day);expect(s.id).not.toBe(old.id);});
});

test('bloom seasons gate stem and bud advancement, without an automatic season-boundary jump',()=>{
  const plant={id:'fall-aster',speciesId:'aster'},original=stem(plant.id,0,0,'stem');
  let states=[original];for(let day=1;day<40;day++)states=advancePlantStems(world,plant,states,day,'summer');
  expect(states.every(s=>s.stage==='stem')).toBe(true);
  let failed=40;while(plantRandom(world,'advance',original.id,failed)<.65)failed++;
  expect(advancePlantStems(world,plant,[original],failed,'autumn').find(s=>s.id===original.id)!.stage).toBe('stem');
  const passed=successfulDay(original.id,'advance',failed+1),bud=advancePlantStems(world,plant,[original],passed,'autumn').find(s=>s.id===original.id)!;
  expect(bud.stage).toBe('bud');expect(advancePlantStems(world,plant,[bud],passed+1,'summer').find(s=>s.id===bud.id)!.stage).toBe('bud');
});

test('ordinary perennials retain failed stages and skip successful pre-withering stages directly to withering',()=>{
  const plant={id:'winter-aster',speciesId:'aster'};
  for(const stage of ['stem','bud','bloom','seed'] as const){
    const original=stem(plant.id,0,0,stage),passed=successfulDay(original.id,'advance',90);
    expect(advancePlantStems(world,plant,[original],passed,'winter')).toEqual([{...original,stage:'withering'}]);
    let failed=90;while(plantRandom(world,'advance',original.id,failed)<.65)failed++;
    expect(advancePlantStems(world,plant,[original],failed,'winter')).toEqual([original]);
  }
  for(let day=90;day<130;day++)expect(advancePlantStems(world,plant,[],day,'winter')).toEqual([]);
  const original=stem(plant.id,0,0,'withering');expect(advancePlantStems(world,plant,[original],successfulDay(original.id,'advance',90),'winter')).toEqual([]);
});

test('nonperennials disappear in winter while winter bloomers can be born and bloom normally',()=>{
  expect(advancePlantStems(world,{id:'annual',speciesId:'cornflower'},[stem('annual',0,0,'bloom')],90,'winter')).toEqual([]);
  let states:PlantStem[]=[];
  for(let day=90;day<105;day++)states=advancePlantStems(world,{id:'winter-bloomer',speciesId:'hellebore'},states,day,'winter');
  expect(states.length).toBeGreaterThan(0);expect(states.some(s=>s.stage==='bloom'||s.stage==='bud')).toBe(true);
});

test('lazy planting has all three kinds, five slots, stable identities and species through the cycle',()=>{
  const module=fresh(),spring=module.plantSnapshot('dock',date(0),world);
  expect(module.plantGenerationStats().locationsGenerated).toBe(1);expect(spring.plants).toHaveLength(PLANT_ANCHORS_V1.dock.length);
  expect(new Set(spring.plants.map((p:any)=>p.kind))).toEqual(new Set(['flower','reed','lily']));
  spring.plants.forEach((plant:any)=>{expect(plant.slots).toHaveLength(5);expect(plant.stems).toEqual([]);});
  const identity=(snapshot:any)=>snapshot.plants.map((p:any)=>[p.id,p.speciesId,p.x,p.y,p.slots]);
  for(const day of [30,60,90])expect(identity(module.plantSnapshot('dock',date(day),world))).toEqual(identity(spring));
  const winter=module.plantSnapshot('dock',date(90),world);winter.plants.forEach((p:any)=>{
    expect(p.maturity).toBe('autumn');expect(p.visible).toBe(plantSpecies(p.speciesId).perennial);
  });
  expect(module.plantGenerationStats().locationsGenerated).toBe(1);
});

test('continuous observation, arbitrary visit order, reload and cold skipped-day reconstruction agree',()=>{
  const continuous=fresh();let expected:any;
  for(let day=0;day<=113;day++)expected=continuous.plantSnapshot('birch',date(day),world);
  const reconstructed=fresh().plantSnapshot('birch',date(113),world);expect(reconstructed).toEqual(expected);
  localStorage.removeItem(PLANT_CHECKPOINT_KEY);
  const visits=fresh();visits.plantSnapshot('dock',date(90),world);visits.plantSnapshot('birch',date(34),world);visits.plantSnapshot('cove',date(70),world);
  expect(visits.plantSnapshot('birch',date(113),world)).toEqual(expected);
  localStorage.removeItem(PLANT_CHECKPOINT_KEY);expect(fresh().plantSnapshot('birch',date(113),world)).toEqual(expected);
});

test('the next spring clears every species and stem, including surviving winter bloomers',()=>{
  const module=fresh(),winter=module.plantSnapshot('cove',date(119),world),spring=module.plantSnapshot('cove',date(120),world);
  expect(winter.plants.some((p:any)=>p.speciesId==='hellebore'&&p.visible)).toBe(true);
  const oldIds=new Set(winter.plants.map((p:any)=>p.id));expect(spring.calendar.cycle).not.toBe(winter.calendar.cycle);
  spring.plants.forEach((p:any)=>{expect(p.stems).toEqual([]);expect(oldIds.has(p.id)).toBe(false);expect(p.maturity).toBe('spring');});
});

test('checkpoints are optional, bounded, validated caches; corrupting them cannot change a world',()=>{
  const expected=fresh().plantSnapshot('dock',date(89),world),saved=JSON.parse(localStorage.getItem(PLANT_CHECKPOINT_KEY)!);
  expect(Object.keys(saved.locations)).toEqual(['dock']);expect(saved.locations.dock.entries.length).toBeLessThanOrEqual(4);
  saved.locations.dock.entries[0].stems[0]=[{id:'corrupted',slot:0,bornDay:1,stage:'bloom'}];
  localStorage.setItem(PLANT_CHECKPOINT_KEY,JSON.stringify(saved));expect(fresh().plantSnapshot('dock',date(89),world)).toEqual(expected);
  localStorage.setItem(PLANT_CHECKPOINT_KEY,'invalid JSON');expect(fresh().plantSnapshot('dock',date(89),world)).toEqual(expected);
});

test('repeated clock renders use cached results and long absences process at most one cycle',()=>{
  const module=fresh(),far=worldAt(Date.parse('2048-04-18T20:00:00Z')),first=module.plantSnapshot('birch',far,world),before=module.plantGenerationStats();
  for(let n=0;n<200;n++)expect(module.plantSnapshot('birch',{...far,hour:n} as any,world)).toBe(first);
  const after=module.plantGenerationStats();expect(after.daysReplayed).toBe(before.daysReplayed);expect(after.cacheHits-before.cacheHits).toBe(200);
  expect(after.daysReplayed).toBeLessThanOrEqual(130);expect(after.dailyPlantSteps).toBeLessThanOrEqual(130*17);
});

test('New York midnight and independent game days remain deterministic across daylight saving changes',()=>{
  expect(newYorkMidnight('2026-11-01')).toBe(Date.parse('2026-11-01T00:00:00-04:00'));
  expect(newYorkMidnight('2026-11-02')).toBe(Date.parse('2026-11-02T00:00:00-05:00'));
  expect(newYorkMidnight('2027-03-14')).toBe(Date.parse('2027-03-14T00:00:00-05:00'));
  expect(newYorkMidnight('2027-03-15')).toBe(Date.parse('2027-03-15T00:00:00-04:00'));
  const module=fresh();
  for(const timestamp of ['2026-11-01T05:55:00Z','2026-11-01T06:05:00Z','2027-03-14T06:55:00Z','2027-03-14T07:05:00Z']){
    const now=worldAt(Date.parse(timestamp)),snapshot=module.plantSnapshot('cove',now,world);localStorage.removeItem(PLANT_CHECKPOINT_KEY);
    expect(fresh().plantSnapshot('cove',now,world)).toEqual(snapshot);
    expect(snapshot.calendar.gameDay).toBe(now.gameDay);expect(plantCalendar(now).season).toBe(now.season);
  }
});
