import { CatchRecord, NotebookEntry, NotebookImage, SaveData } from './types';
import { SPECIES } from './config';
import { butterflyById, readButterflyPose } from './butterflies';
import { SANTA, visitorById } from './visitors';
import { birdById, readBirdPose } from './birds';

export function catchImage(record:Pick<CatchRecord,'speciesId'|'lengthCm'|'weightKg'|'isAlbino'>):NotebookImage {
  return {kind:'fish',speciesId:record.speciesId,lengthCm:record.lengthCm,weightKg:record.weightKg,isAlbino:record.isAlbino};
}
export function blankEntry(id:string,caughtAt:string,location:string,image?:NotebookImage):NotebookEntry {
  return {id,caughtAt,location,title:'',name:'',notes:'',...(image?{image}:{})};
}
function readImage(value:any):NotebookImage|undefined {
  if(value?.kind==='bird'){
    const species=birdById(value.speciesId),pose=readBirdPose(value.pose);
    return species?{kind:'bird',speciesId:species.id,...(pose?{pose}:{})}:undefined;
  }
  if(value?.kind==='visitor'&&(value.speciesId===SANTA.id||visitorById(value.speciesId))){
    const pose=readButterflyPose(value.pose);
    return {kind:'visitor',speciesId:value.speciesId,...(pose?{pose}:{})};
  }
  if(value?.kind==='butterfly'){
    const species=butterflyById(value.speciesId),span=value.wingspanMm,pose=species?readButterflyPose(value.pose):undefined;
    return {kind:'butterfly',...(species?{speciesId:species.id}:{}),...(species&&typeof span==='number'&&Number.isFinite(span)&&span>=species.wingspanMm[0]&&span<=species.wingspanMm[1]?{wingspanMm:span}:{}),...(pose?{pose}:{})};
  }
  if(value?.kind==='fish'&&SPECIES.some(s=>s.id===value.speciesId)&&typeof value.lengthCm==='number'&&Number.isFinite(value.lengthCm)&&value.lengthCm>0&&typeof value.weightKg==='number'&&Number.isFinite(value.weightKg)&&value.weightKg>0&&typeof value.isAlbino==='boolean')return catchImage(value);
  return undefined;
}
export function readNotebook(raw:unknown):NotebookEntry[] {
  if(!Array.isArray(raw))return [];
  const ids=new Set<string>();
  return raw.flatMap(value=>{
    if(!value||typeof value.id!=='string'||!value.id||ids.has(value.id)||typeof value.caughtAt!=='string'||!Number.isFinite(Date.parse(value.caughtAt)))return [];
    ids.add(value.id);
    const measurement=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>0?n:undefined;
    const image=readImage(value.image);
    return [{id:value.id,caughtAt:value.caughtAt,location:typeof value.location==='string'?value.location:'dock',title:typeof value.title==='string'?value.title.slice(0,100):'',name:typeof value.name==='string'?value.name.slice(0,100):'',notes:typeof value.notes==='string'?value.notes.slice(0,4000):'',
      ...(measurement(value.weightKg)!==undefined?{weightKg:value.weightKg}:{}),...(measurement(value.lengthCm)!==undefined?{lengthCm:value.lengthCm}:{}),...(image?{image}:{})}];
  });
}
export function notebookEntries(save:SaveData):NotebookEntry[] {
  return (save.notebook??[]).map(entry=>{
    const record=!entry.image&&save.livewell.find(c=>c.id===entry.id);
    return record?{...entry,image:catchImage(record)}:entry;
  });
}
export function saveNotebookEntry(save:SaveData,id:string,patch:Partial<Pick<NotebookEntry,'title'|'name'|'notes'|'weightKg'|'lengthCm'>>,context?:Pick<NotebookEntry,'caughtAt'|'location'|'image'>):SaveData {
  const entries=notebookEntries(save),record=save.livewell.find(c=>c.id===id),meta=record??context;
  const entry=entries.find(e=>e.id===id)??(meta?blankEntry(id,meta.caughtAt,meta.location):undefined);
  if(!entry)return save;
  const image=entry.image??(record?catchImage(record):context?.image);
  const [normalized]=readNotebook([{...entry,...patch,...(image?{image}:{})}]);
  return normalized?{...save,notebook:entries.some(e=>e.id===id)?entries.map(e=>e.id===id?normalized:e):[...entries,normalized]}:save;
}
export function deleteNotebookEntry(save:SaveData,id:string):SaveData {
  return {...save,notebook:notebookEntries(save).filter(entry=>entry.id!==id)};
}
let noteSequence=0;
export function addNotebookEntry(save:SaveData):SaveData {
  const at=new Date().toISOString();
  return {...save,notebook:[...notebookEntries(save),blankEntry(`note-${Date.now()}-${++noteSequence}`,at,save.location)]};
}
