import { ASSET_BASE } from './artwork';
import { ButterflyPose, Random, SaveData, Season, Weather } from './types';

export interface ButterflySpecies {
  id:string; name:string; scientificName:string; kind:'butterfly'|'skipper'|'moth';
  wingspanMm:[number,number]; active:'day'|'night'; pupaLabel:string; weight:number;
  description:string; caterpillar:string; pupa:string; source:string; lifeSource:string;
}
export const BUTTERFLIES:readonly ButterflySpecies[]=require('../data/butterflies.json');
export const butterflyById=(id?:string)=>BUTTERFLIES.find(species=>species.id===id);
export const butterflyAsset=(id:string,stage:'flight'|'adult'|'caterpillar'|'pupa'|'rest')=>`${ASSET_BASE}/butterflies/${id}/${stage}.${stage==='flight'?'gif':'webp'}`;
export const SIDE_FLIGHT_SPECIES=BUTTERFLIES.map(species=>species.id);
export const SIDE_BUTTERFLY_SPRITE={width:96,height:112,canvasSize:160};
export const butterflySideSheet=(id:string)=>`${ASSET_BASE}/butterflies/${id}/flight-side-small-sheet.webp`;
export const butterflyPoseAsset=(id:string,frame:number,view?:'side')=>`${ASSET_BASE}/butterflies/${id}/${view==='side'&&SIDE_FLIGHT_SPECIES.includes(id)?'side-small-pose':'pose'}-${frame}.webp`;
export const caterpillarAnimation=(id:string)=>`${ASSET_BASE}/butterflies/${id}/caterpillar-crawl.gif`;
export function readButterflyPose(value:any):ButterflyPose|undefined {
  return Number.isInteger(value?.frame)&&value.frame>=0&&value.frame<8&&typeof value.rotation==='number'&&Number.isFinite(value.rotation)&&Math.abs(value.rotation)<=Math.PI&&typeof value.flipped==='boolean'?{frame:value.frame,rotation:value.rotation,flipped:value.flipped,...(value.view==='side'?{view:'side' as const}:{})}:undefined;
}
export const butterflyTime=(hour:number):'day'|'night'=>hour>=6&&hour<18?'day':'night';
export function eligibleButterflies(season:Season,hour:number,weather:Weather):readonly ButterflySpecies[] {
  if(season==='winter'||!['sunny','overcast','heatwave'].includes(weather))return [];
  if(hour>=6&&hour<7)return [];
  return BUTTERFLIES.filter(species=>species.active===butterflyTime(hour));
}
export function chooseButterfly(random:Random,season:Season,hour:number,weather:Weather):ButterflySpecies|undefined {
  const species=eligibleButterflies(season,hour,weather),total=species.reduce((sum,item)=>sum+item.weight,0);
  let roll=random()*total;
  return species.find(item=>(roll-=item.weight)<0)??species[species.length-1];
}
export function butterflyWingspan(species:ButterflySpecies,random:Random):number {
  return Math.round((species.wingspanMm[0]+random()*(species.wingspanMm[1]-species.wingspanMm[0]))*10)/10;
}
// All generated open-wing sprites span 160 pixels on a 192-pixel canvas.
export const butterflyDisplayWidth=(wingspanMm:number)=>wingspanMm*.45*(192/160);
export function readButterflyDiscoveries(raw:unknown):string[] {
  return Array.isArray(raw)?Array.from(new Set(raw.filter((id):id is string=>typeof id==='string'&&!!butterflyById(id)))):[];
}
export function discoverButterfly(save:SaveData,id:string):SaveData {
  if(!butterflyById(id)||(save.butterflyDiscoveries??[]).includes(id))return save;
  return {...save,butterflyDiscoveries:[...(save.butterflyDiscoveries??[]),id]};
}
