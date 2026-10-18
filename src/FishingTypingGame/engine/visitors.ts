import { artwork } from './artwork';
import { ButterflyPose, SaveData, Season, Weather } from './types';
import { WORLD } from './world';

export const ODONATES = [
  {id:'green-darner',name:'Common green darner',scientificName:'Anax junius',kind:'dragonfly',wingspanMm:[80,100] as const,description:'A powerful patrol flier: long purposeful runs, sudden darts, hovering, and short backward corrections.',source:'https://mdc.mo.gov/discover-nature/field-guide/common-green-darner'},
  {id:'ebony-jewelwing',name:'Ebony jewelwing',scientificName:'Calopteryx maculata',kind:'damselfly',wingspanMm:[58,76] as const,description:'A delicate, fluttering damselfly with broad black wings and a metallic green body. It stays low near waterside vegetation.',source:'https://mdc.mo.gov/discover-nature/field-guide/ebony-jewelwing'},
] as const;
export const SANTA={id:'santa',name:'Santa Claus',description:'A tiny sleigh silhouette passing through the late-night sky. Appears once on December 25, by your real local calendar.'};
export const visitorById=(id:unknown)=>ODONATES.find(species=>species.id===id);
// Revision applies to stills and the sampled flight sheet together, including
// previously recorded journal poses, so cached opaque wings are not reused.
const ODONATE_ART_REVISION='directional-clear-wings-4';
export const ODONATE_SPRITE={width:96,height:112,canvasSize:160};
export const ODONATE_DISPLAY_SCALE=.3;
// Foot-contact pixels in the original resting frames. Land around these pixels,
// rather than placing the canvas/thorax center directly on a stem.
export const visitorPerchContact=(id:string)=>id==='green-darner'?{x:67,y:74}:id==='ebony-jewelwing'?{x:67,y:82}:undefined;
export const hasDirectionalVisitor=(id:string)=>visitorById(id)?.kind==='dragonfly';
const viewPrefix=(id:string,view?:ButterflyPose['view'])=>hasDirectionalVisitor(id)&&(view==='front'||view==='back')?`${view}-`:'';
export const visitorAsset=(id:string,frame?:number,view?:ButterflyPose['view'])=>`${artwork(`visitors/${id}/${viewPrefix(id,view)}${frame===undefined?'adult':`pose-${Math.max(0,Math.min(7,Math.round(frame)))}`}.webp`)}?v=${ODONATE_ART_REVISION}`;
export const visitorSheet=(id:string,view?:ButterflyPose['view'])=>`${artwork(`visitors/${id}/${viewPrefix(id,view)}flight-sheet.webp`)}?v=${ODONATE_ART_REVISION}`;
export const santaAsset=()=>artwork('visitors/santa.webp');
export const santaSkyAsset=()=>artwork('visitors/santa-sky.webp');
export const SANTA_SPRITE={width:64,height:28};
export function readVisitorDiscoveries(raw:unknown):string[]{return Array.isArray(raw)?Array.from(new Set(raw.filter(id=>id===SANTA.id||!!visitorById(id)))):[];}
export function discoverVisitor(save:SaveData,id:string,now=new Date()):SaveData {
  if(id!==SANTA.id&&!visitorById(id))return save;
  const discoveries=Array.from(new Set([...(save.visitorDiscoveries??[]),id]));
  return {...save,visitorDiscoveries:discoveries,...(id===SANTA.id&&now.getMonth()===11&&now.getDate()===25?{santaYears:Array.from(new Set([...(save.santaYears??[]),now.getFullYear()]))}:{})};
}
export function odonateActivity(season:Season,hour:number,weather:Weather):number {
  return season==='winter'||hour<7||hour>=19||!['sunny','overcast','heatwave'].includes(weather)?0:season==='summer'?1:.65;
}
export const gooseDirection=(season:Season)=>season==='spring'?1:season==='autumn'?-1:0;
// Choose once among late-night starts on the real local Christmas date. The
// entire flyby fits inside a natural 00:00–04:00 game-sky period, without rerolls.
export const SANTA_VISIT_MS=90000;
let santaSchedule:{year:number;start:number}|undefined;
export function santaVisitStart(year:number):number {
  if(santaSchedule?.year===year)return santaSchedule.start;
  let seed=Math.imul(year^0x53414e54,0x45d9f3b);seed^=seed>>>16;
  const dayStart=new Date(year,11,25).getTime(),dayEnd=new Date(year,11,26).getTime();
  const windows:{start:number;seconds:number}[]=[];
  for(let cycle=WORLD.epoch+Math.floor((dayStart-WORLD.epoch)/WORLD.dayMs)*WORLD.dayMs;cycle<dayEnd;cycle+=WORLD.dayMs){
    const start=Math.max(dayStart,cycle),last=Math.min(dayEnd,cycle+WORLD.dayMs/6)-SANTA_VISIT_MS;
    if(last>=start)windows.push({start,seconds:Math.floor((last-start)/1000)+1});
  }
  let offset=(seed>>>0)%windows.reduce((total,window)=>total+window.seconds,0);
  for(const window of windows){
    if(offset<window.seconds){const start=window.start+offset*1000;santaSchedule={year,start};return start;}
    offset-=window.seconds;
  }
  throw new Error('Christmas has no late-night visit window');
}
export function santaVisit(now:number,years:readonly number[]=[]):{year:number;progress:number}|undefined {
  const date=new Date(now),year=date.getFullYear();
  if(date.getMonth()!==11||date.getDate()!==25||years.includes(year))return;
  const elapsed=now-santaVisitStart(year);
  return elapsed>=0&&elapsed<SANTA_VISIT_MS?{year,progress:elapsed/SANTA_VISIT_MS}:undefined;
}
export function nextSantaCheck(now:number):number {
  const year=new Date(now).getFullYear(),start=santaVisitStart(year);
  return Math.min(2147483647,Math.max(1000,(now<start?start:santaVisitStart(year+1))-now));
}
export const splashScale=(depth:number)=>.16+.84*Math.max(0,Math.min(1,depth));
