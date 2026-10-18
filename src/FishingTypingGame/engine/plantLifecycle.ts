import {Season,SEASONS,WorldConditions} from './types';
import {WORLD,worldAt} from './world';
import {PLANT_ANCHORS_V1,PLANT_SPECIES_V1,PlantAnchor,PlantKind,PlantLocation,PlantRoot,plantLocation,plantSpecies} from './plantSpecies';

export const PLANT_GENERATION_VERSION=1;
export const PLANT_WORLD_KEY='stillwater.plant-world.v1';
export const PLANT_CHECKPOINT_KEY='stillwater.plant-checkpoints.v1';
export const PLANT_GROWTH_CHANCE={birth:.90,advance:.65} as const;
export const STEM_STAGES=['stem','bud','bloom','seed','withering'] as const;
export type StemStage=typeof STEM_STAGES[number];
export interface PlantWorld {seed:string;generationVersion:number}
export interface PlantStem {id:string;slot:number;bornDay:number;stage:StemStage}
export interface PlantSlot {x:number;y:number;scale:number;angle:number;flipped:boolean;leaf:number}
export interface PlantBase extends PlantRoot {id:string;anchor:PlantAnchor;speciesId:string;kind:PlantKind;scale:number;lean:number;flipped:boolean;slots:readonly PlantSlot[]}
export interface GrowingPlant extends PlantBase {stems:readonly PlantStem[];visible:boolean;maturity:'spring'|'summer'|'autumn'}
export interface PlantCalendar {cycle:string;season:Season;gameDay:number;startDay:number;endDay:number;boundaries:number[];seasonDate:string}
export interface PlantSnapshot {key:string;world:PlantWorld;calendar:PlantCalendar;location:PlantLocation;plants:readonly GrowingPlant[];unsupported?:boolean}
type WorldDate=Pick<WorldConditions,'gameDay'|'seasonDate'|'season'>;
interface Checkpoint {day:number;stems:PlantStem[][];checksum:string}
const snapshots=new Map<string,PlantSnapshot>(),bases=new Map<string,readonly PlantBase[]>(),checkpoints=new Map<string,Checkpoint[]>();
const counters={locationsGenerated:0,daysReplayed:0,dailyPlantSteps:0,cacheHits:0};
export const plantGenerationStats=()=>({...counters,snapshots:snapshots.size,baseLayouts:bases.size,checkpointGroups:checkpoints.size});
let persistentWorld:PlantWorld|undefined;
const trim=<T>(cache:Map<string,T>,limit:number)=>{while(cache.size>limit)cache.delete(cache.keys().next().value!);};
const mod=(n:number,d:number)=>((n%d)+d)%d;
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n));
export function plantHash(key:string):number {
  let hash=2166136261;
  for(let i=0;i<key.length;i++)hash=Math.imul(hash^key.charCodeAt(i),16777619);
  hash=Math.imul(hash^(hash>>>16),0x85ebca6b);hash=Math.imul(hash^(hash>>>13),0xc2b2ae35);
  return (hash^(hash>>>16))>>>0;
}
/** Stateless, independently namespaced outcomes. Nothing consumes a shared RNG. */
export const plantRandom=(world:PlantWorld,...parts:(string|number)[])=>plantHash(JSON.stringify([world.generationVersion,world.seed,...parts]))/4294967296;
export function getPlantWorld():PlantWorld {
  if(persistentWorld)return persistentWorld;
  const fallback={seed:'stillwater-storage-unavailable-v1',generationVersion:1};
  try {
    const saved=JSON.parse(localStorage.getItem(PLANT_WORLD_KEY)||'null');
    if(typeof saved?.seed==='string'&&saved.seed.length>0&&saved.seed.length<=128&&Number.isInteger(saved.generationVersion)&&saved.generationVersion>=1)
      return persistentWorld=Object.freeze({seed:saved.seed,generationVersion:saved.generationVersion});
    const values=new Uint32Array(4);
    if(typeof crypto!=='undefined'&&crypto.getRandomValues)crypto.getRandomValues(values);
    else for(let i=0;i<4;i++)values[i]=Math.floor(Math.random()*4294967296); // world creation only
    const world={seed:Array.from(values,n=>n.toString(16).padStart(8,'0')).join(''),generationVersion:PLANT_GENERATION_VERSION};
    localStorage.setItem(PLANT_WORLD_KEY,JSON.stringify(world));return persistentWorld=Object.freeze(world);
  }catch{return persistentWorld=Object.freeze(fallback);}
}

const calendarEpoch=Date.parse('2026-10-10T00:00:00Z'),calendarDayMs=86400000;
const offsetFormatter=new Intl.DateTimeFormat('en-US',{timeZone:WORLD.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
const midnightCache=new Map<string,number>();
const dateAtOrdinal=(ordinal:number)=>new Date(calendarEpoch+ordinal*calendarDayMs).toISOString().slice(0,10);
export function newYorkMidnight(date:string):number {
  const cached=midnightCache.get(date);if(cached!==undefined)return cached;
  const utc=Date.parse(`${date}T00:00:00Z`);let at=utc;
  for(let pass=0;pass<3;pass++){
    const parts=offsetFormatter.formatToParts(at),value=(type:string)=>Number(parts.find(part=>part.type===type)!.value);
    const offset=Date.UTC(value('year'),value('month')-1,value('day'),value('hour'),value('minute'),value('second'))-Math.floor(at/1000)*1000;
    at=utc-offset;
  }
  midnightCache.set(date,at);trim(midnightCache,32);return at;
}
/** Seasons follow New York calendar dates; growth follows the independent
 * 48-minute game-day boundaries, including both daylight-saving transitions. */
export function plantCalendar(date:WorldDate,dayPreview?:number):PlantCalendar {
  const raw=Date.parse(`${date.seasonDate}T00:00:00Z`),ordinal=Number.isFinite(raw)?Math.round((raw-calendarEpoch)/calendarDayMs):0;
  const cycleOrdinal=ordinal-mod(ordinal,4),cycle=dateAtOrdinal(cycleOrdinal);
  const boundaries=Array.from({length:5},(_,n)=>newYorkMidnight(dateAtOrdinal(cycleOrdinal+n)));
  const season=SEASONS.includes(date.season)?date.season:SEASONS[mod(ordinal,4)],index=SEASONS.indexOf(season);
  const first=Math.floor((boundaries[index]-WORLD.epoch)/WORLD.dayMs),last=Math.ceil((boundaries[index+1]-WORLD.epoch)/WORLD.dayMs)-1;
  const naturalFirst=Math.floor((newYorkMidnight(dateAtOrdinal(ordinal))-WORLD.epoch)/WORLD.dayMs);
  const within=dayPreview!==undefined&&Number.isFinite(dayPreview)?Math.floor(dayPreview):date.gameDay-naturalFirst;
  return {cycle,season,gameDay:clamp(first+within,first,last),startDay:Math.floor((boundaries[0]-WORLD.epoch)/WORLD.dayMs),
    endDay:Math.ceil((boundaries[4]-WORLD.epoch)/WORLD.dayMs)-1,boundaries,seasonDate:dateAtOrdinal(cycleOrdinal+index)};
}
function seasonOnDay(calendar:PlantCalendar,day:number):Season {
  const at=WORLD.epoch+day*WORLD.dayMs;
  return SEASONS[Math.max(0,calendar.boundaries.slice(0,4).filter(boundary=>at>=boundary).length-1)];
}
function baseLayout(world:PlantWorld,location:PlantLocation,cycle:string):readonly PlantBase[] {
  const key=JSON.stringify([world,location,cycle]),cached=bases.get(key);if(cached)return cached;
  const flowerStart=Math.floor(plantRandom(world,'species',location,cycle)*4),flowerDirection=plantRandom(world,'species-direction',location,cycle)<.5?1:-1;
  let flowerIndex=0,lilyIndex=0;
  const layout=PLANT_ANCHORS_V1[location].map(anchor=>{
    const id=`v1-${plantHash(world.seed).toString(36)}:${cycle}:${anchor.id}`;
    const random=(name:string,n=0)=>plantRandom(world,'plant',id,name,n);
    const root=anchor.choices[Math.floor(random('root')*anchor.choices.length)];
    const speciesId=anchor.kind==='flower'?PLANT_SPECIES_V1[mod(flowerStart+flowerDirection*flowerIndex++,4)].id:
      anchor.kind==='reed'?(location==='dock'?'cattail':location==='cove'?'rush':'sedge'):
      ['water-lily','lotus'][mod(lilyIndex++ + Math.floor(plantRandom(world,'lily-species',location,cycle)*2),2)];
    const slots=Array.from({length:5},(_,n)=>{
      const waterX=[.23,.48,.73,.33,.70],waterY=[.39,.31,.47,.68,.71];
      return Object.freeze({x:anchor.kind==='lily'?waterX[n]+(random('slot-x',n)-.5)*.06:anchor.kind==='reed'?.16+n*.17+(random('slot-x',n)-.5)*.04:.5+(n-2)*.055+(random('slot-x',n)-.5)*.035,
        y:anchor.kind==='lily'?waterY[n]+(random('slot-y',n)-.5)*.06:.96+(random('slot-y',n)-.5)*.025,
        scale:.78+random('slot-scale',n)*.4,angle:random('slot-angle',n)*360,flipped:random('slot-flip',n)<.5,leaf:Math.floor(random('leaf',n)*6)});
    });
    return Object.freeze({...root,id,anchor,speciesId,kind:anchor.kind,scale:.86+random('scale')*.25,lean:(random('lean')-.5)*10,flipped:random('flip')<.5,slots:Object.freeze(slots)});
  });
  counters.locationsGenerated++;bases.set(key,Object.freeze(layout));trim(bases,6);return layout;
}
export const stemIdentity=(plantId:string,slot:number,bornDay:number)=>`${plantId}:slot-${slot}:born-${bornDay}`;
/** Existing stems advance first. A birth gets a new identity and cannot advance
 * in this call. Failed daily opportunities are never rerolled by a later visit. */
export function advancePlantStems(world:PlantWorld,plant:Pick<PlantBase,'id'|'speciesId'>,existing:readonly PlantStem[],day:number,season:Season):PlantStem[] {
  const species=plantSpecies(plant.speciesId),winter=season==='winter';
  if(winter&&!species.perennial)return [];
  const forcedWinter=winter&&!species.winterBlooming;
  const stems=existing.flatMap(stem=>{
    const index=STEM_STAGES.indexOf(stem.stage);
    // A seasonal gate makes the daily outcome irrelevant. Stateless seed
    // namespaces let us skip that work without changing any later outcome.
    if(stem.bornDay>=day||(!forcedWinter&&index<2&&!species.bloomSeasons.includes(season)))return [{...stem}];
    if(plantRandom(world,'advance',stem.id,day)>=PLANT_GROWTH_CHANCE.advance)return [{...stem}];
    if(index===4)return [];
    if(forcedWinter)return [{...stem,stage:'withering' as const}];
    return [{...stem,stage:STEM_STAGES[index+1]}];
  });
  const birthAllowed=!winter||(species.winterBlooming&&species.bloomSeasons.includes('winter'));
  if(birthAllowed&&stems.length<5&&plantRandom(world,'birth',plant.id,day)<PLANT_GROWTH_CHANCE.birth){
    const empty=[0,1,2,3,4].filter(slot=>!stems.some(stem=>stem.slot===slot));
    const slot=empty[Math.floor(plantRandom(world,'birth-slot',plant.id,day)*empty.length)];
    stems.push({id:stemIdentity(plant.id,slot,day),slot,bornDay:day,stage:'stem'});
  }
  return stems.sort((a,b)=>a.slot-b.slot);
}
const copyStems=(stems:readonly (readonly PlantStem[])[])=>stems.map(group=>group.map(stem=>({...stem})));
const checkpointHash=(key:string,day:number,stems:PlantStem[][])=>plantHash(`${key}:${PLANT_GROWTH_CHANCE.birth}:${PLANT_GROWTH_CHANCE.advance}:${day}:${JSON.stringify(stems)}`).toString(36);
function validCheckpoint(value:any,key:string,layout:readonly PlantBase[],calendar:PlantCalendar):value is Checkpoint {
  return Number.isInteger(value?.day)&&value.day>=calendar.startDay&&value.day<=calendar.endDay&&Array.isArray(value.stems)&&value.stems.length===layout.length&&
    value.stems.every((group:any,index:number)=>Array.isArray(group)&&group.length<=5&&new Set(group.map((stem:any)=>stem?.slot)).size===group.length&&group.every((stem:any)=>
      Number.isInteger(stem?.slot)&&stem.slot>=0&&stem.slot<5&&Number.isInteger(stem.bornDay)&&stem.bornDay>calendar.startDay&&stem.bornDay<=value.day&&
      STEM_STAGES.includes(stem.stage)&&stem.id===stemIdentity(layout[index].id,stem.slot,stem.bornDay)))&&value.checksum===checkpointHash(key,value.day,value.stems);
}
function loadCheckpoints(world:PlantWorld,location:PlantLocation,calendar:PlantCalendar,layout:readonly PlantBase[],key:string) {
  const cached=checkpoints.get(key);if(cached)return cached;
  let entries:Checkpoint[]=[];
  try {
    const saved=JSON.parse(localStorage.getItem(PLANT_CHECKPOINT_KEY)||'null'),slot=saved?.locations?.[location];
    if(saved?.seed===world.seed&&saved?.generationVersion===world.generationVersion&&slot?.cycle===calendar.cycle&&Array.isArray(slot.entries))
      entries=slot.entries.slice(-4).filter((entry:unknown)=>validCheckpoint(entry,key,layout,calendar));
  }catch{/* A missing/invalid cache just replays this bounded four-season cycle. */}
  checkpoints.set(key,entries);trim(checkpoints,6);return entries;
}
function saveCheckpoints(world:PlantWorld,location:PlantLocation,calendar:PlantCalendar,entries:Checkpoint[]) {
  try {
    const previous=JSON.parse(localStorage.getItem(PLANT_CHECKPOINT_KEY)||'null');
    const locations=previous?.seed===world.seed&&previous?.generationVersion===world.generationVersion?previous.locations??{}:{};
    const saved:Record<string,unknown>={};for(const id of ['dock','cove','birch'])if(locations[id])saved[id]=locations[id];
    saved[location]={cycle:calendar.cycle,entries:entries.slice(-4)};
    localStorage.setItem(PLANT_CHECKPOINT_KEY,JSON.stringify({seed:world.seed,generationVersion:world.generationVersion,locations:saved}));
  }catch{/* Checkpoints are an optimization, never the source of plant outcomes. */}
}
export function plantSnapshot(location:string,date:WorldDate=worldAt(Date.now()),world:PlantWorld=getPlantWorld(),dayPreview?:number):PlantSnapshot {
  const spot=plantLocation(location),calendar=plantCalendar(date,dayPreview),groupKey=JSON.stringify([world,spot,calendar.cycle]);
  const key=`${groupKey}:${calendar.season}:${calendar.gameDay}`,cached=snapshots.get(key);
  if(cached){counters.cacheHits++;return cached;}
  if(world.generationVersion!==1)return {key,world,calendar,location:spot,plants:[],unsupported:true};
  const layout=baseLayout(world,spot,calendar.cycle),entries=loadCheckpoints(world,spot,calendar,layout,groupKey);
  const checkpoint=entries.filter(entry=>entry.day<=calendar.gameDay).sort((a,b)=>b.day-a.day)[0];
  let stems=checkpoint?copyStems(checkpoint.stems):layout.map(()=>[] as PlantStem[]);
  const from=checkpoint?.day??calendar.startDay;
  for(let day=from+1;day<=calendar.gameDay;day++){
    const season=seasonOnDay(calendar,day);counters.daysReplayed++;
    const previousDay=stems;
    stems=layout.map((plant,index)=>{counters.dailyPlantSteps++;return advancePlantStems(world,plant,previousDay[index],day,season);});
    if((day-calendar.startDay)%8===0||day===calendar.gameDay){
      const state=copyStems(stems);entries.push({day,stems:state,checksum:checkpointHash(groupKey,day,state)});
      entries.sort((a,b)=>a.day-b.day);while(entries.length>8)entries.shift();
    }
  }
  if(from<calendar.gameDay)saveCheckpoints(world,spot,calendar,entries);
  const maturity=calendar.season==='winter'?'autumn':calendar.season;
  const plants=layout.map((plant,index)=>{
    const visible=calendar.season!=='winter'||plantSpecies(plant.speciesId).perennial;
    return Object.freeze({...plant,visible,maturity,stems:Object.freeze((visible?stems[index]:[]).map(stem=>Object.freeze({...stem})))});
  });
  const snapshot=Object.freeze({key,world,calendar,location:spot,plants:Object.freeze(plants)});
  snapshots.set(key,snapshot);trim(snapshots,24);return snapshot;
}
export function stemAppearance(world:PlantWorld,stem:PlantStem) {
  return {scale:.76+plantRandom(world,'stem-height',stem.id)*.4,lean:(plantRandom(world,'stem-lean',stem.id)-.5)*16,flipped:plantRandom(world,'stem-flip',stem.id)<.5};
}
