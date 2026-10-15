import { NotebookEntry, SaveData } from './types';

export function blankEntry(id:string,caughtAt:string,location:string):NotebookEntry {
  return {id,caughtAt,location,name:'',notes:''};
}
export function readNotebook(raw:unknown):NotebookEntry[] {
  if(!Array.isArray(raw))return [];
  const ids=new Set<string>();
  return raw.flatMap(value=>{
    if(!value||typeof value.id!=='string'||!value.id||ids.has(value.id)||typeof value.caughtAt!=='string'||!Number.isFinite(Date.parse(value.caughtAt)))return [];
    ids.add(value.id);
    const measurement=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>0?n:undefined;
    return [{id:value.id,caughtAt:value.caughtAt,location:typeof value.location==='string'?value.location:'dock',name:typeof value.name==='string'?value.name.slice(0,100):'',notes:typeof value.notes==='string'?value.notes.slice(0,4000):'',
      ...(measurement(value.weightKg)!==undefined?{weightKg:value.weightKg}:{}),...(measurement(value.lengthCm)!==undefined?{lengthCm:value.lengthCm}:{})}];
  });
}
export function notebookEntries(save:SaveData):NotebookEntry[] {
  const entries=[...(save.notebook??[])];
  const ids=new Set(entries.map(e=>e.id));
  save.livewell.forEach(c=>{if(!ids.has(c.id)){entries.push(blankEntry(c.id,c.caughtAt,c.location));ids.add(c.id);}});
  return entries;
}
export function saveNotebookEntry(save:SaveData,id:string,patch:Partial<Pick<NotebookEntry,'name'|'notes'|'weightKg'|'lengthCm'>>):SaveData {
  const entries=notebookEntries(save),entry=entries.find(e=>e.id===id);
  if(!entry)return save;
  const [normalized]=readNotebook([{...entry,...patch}]);
  return normalized?{...save,notebook:entries.map(e=>e.id===id?normalized:e)}:save;
}
let noteSequence=0;
export function addNotebookEntry(save:SaveData):SaveData {
  const at=new Date().toISOString();
  return {...save,notebook:[...notebookEntries(save),blankEntry(`note-${Date.now()}-${++noteSequence}`,at,save.location)]};
}
