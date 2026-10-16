import React, { useEffect, useRef, useState } from 'react';
import { Button, IconButton, TextField } from '@mui/material';
import { MeasurementSystem, NotebookEntry } from '../engine/types';
import { CM_PER_IN, KG_PER_LB, formatLength, formatWeight, lengthUnit, lengthValue, weightUnit, weightValue } from '../engine/specimens';
import { LOCATIONS } from '../engine/config';
import { blankEntry } from '../engine/notebook';
import { Discoveries, FieldGuideButton } from './FieldGuide';
import NotebookIllustration from './NotebookIllustration';

export type NotePatch=Partial<Pick<NotebookEntry,'title'|'name'|'notes'|'weightKg'|'lengthCm'>>;
export type SaveNote=(id:string,patch:NotePatch,context?:Pick<NotebookEntry,'caughtAt'|'location'|'image'>)=>void;
function draftOf(entry:NotebookEntry,units:MeasurementSystem) {
  return {title:entry.title,name:entry.name,notes:entry.notes,weight:entry.weightKg===undefined?'':Number(weightValue(entry.weightKg,units).toFixed(4)).toString(),length:entry.lengthCm===undefined?'':Number(lengthValue(entry.lengthCm,units).toFixed(3)).toString()};
}
export function RecordedMeasurements({entry,units}:{entry?:NotebookEntry;units:MeasurementSystem}) {
  return <div className="f-recorded-measurements"><span>{entry?.weightKg===undefined?'Unweighed':formatWeight(entry.weightKg,units)}</span><span>{entry?.lengthCm===undefined?'Unmeasured':formatLength(entry.lengthCm,units)}</span></div>;
}
export function NotebookEditor({entry,units,onSave,discoveries}:{entry:NotebookEntry;units:MeasurementSystem;onSave:SaveNote;discoveries?:Discoveries}) {
  const [draft,setDraft]=useState(()=>draftOf(entry,units));
  const [errors,setErrors]=useState<Record<string,string>>({});const [status,setStatus]=useState('');
  const dirty=useRef(new Set<keyof typeof draft>()),form=useRef<HTMLFormElement>(null);
useEffect(() => {
  if (!form.current?.contains(document.activeElement)) {
    setDraft(draftOf({id:entry.id,title:entry.title,name:entry.name,notes:entry.notes,weightKg:entry.weightKg,lengthCm:entry.lengthCm,caughtAt:'',location:''}, units));
    dirty.current.clear();
  }
}, [entry.id, entry.title, entry.name, entry.notes, entry.weightKg, entry.lengthCm, units]);
  const change=(field:keyof typeof draft,value:string)=>{dirty.current.add(field);setDraft(d=>({...d,[field]:value}));setStatus('');};
  const commit=(fields:(keyof typeof draft)[])=>{
    const patch:NotePatch={},nextErrors:Record<string,string>={};
    fields.filter(field=>dirty.current.has(field)).forEach(field=>{
      if(field==='title'||field==='name'||field==='notes'){patch[field]=draft[field];return;}
      const text=draft[field].trim(),value=Number(text),converted=value*(field==='weight'?(units==='imperial'?KG_PER_LB:1):(units==='imperial'?CM_PER_IN:1));
      if(text&&(!Number.isFinite(converted)||converted<=0)){nextErrors[field]='Use a positive number.';return;}
      patch[field==='weight'?'weightKg':'lengthCm']=text?converted:undefined;
    });
    setErrors(previous=>({...previous,...Object.fromEntries(fields.map(field=>[field,nextErrors[field]??'']))}));
    if(!Object.keys(nextErrors).length){onSave(entry.id,patch,entry);dirty.current.clear();setStatus('Recorded in your notebook');}
    return !Object.keys(nextErrors).length;
  };
  return <form ref={form} className="f-paper f-notebook-editor" aria-label="My field notes" onSubmit={e=>{e.preventDefault();if(commit(['title','name','weight','length','notes']))setStatus('Recorded in your notebook');}}>
    <span className="f-paper-kicker">STILLWATER FIELD BOOK</span>
    <TextField className="f-notebook-title" label="Entry title" placeholder="Title this entry" value={draft.title} inputProps={{maxLength:100}} InputLabelProps={{shrink:true}} onChange={e=>change('title',e.target.value)} fullWidth variant="standard"/>
    {entry.image&&<NotebookIllustration image={entry.image} units={units}/>}
    <FieldGuideButton discoveries={discoveries} initialTab={entry.image?.kind==='visitor'?entry.image.speciesId==='santa'?'special':'odonates':entry.image?.kind==='butterfly'?'butterflies':'fish'}/>
    <TextField label="Subject" placeholder="Your identification" value={draft.name} inputProps={{maxLength:100}} onChange={e=>change('name',e.target.value)} fullWidth size="small"/>
    <div className="f-notebook-measure-fields"><TextField label={`Weight (${weightUnit(units)})`} placeholder="Unweighed" value={draft.weight} type="number" inputProps={{min:0,step:'any',inputMode:'decimal'}} error={!!errors.weight} helperText={errors.weight} onChange={e=>change('weight',e.target.value)} size="small"/><TextField label={`Length (${lengthUnit(units)})`} placeholder="Unmeasured" value={draft.length} type="number" inputProps={{min:0,step:'any',inputMode:'decimal'}} error={!!errors.length} helperText={errors.length} onChange={e=>change('length',e.target.value)} size="small"/></div>
    <TextField label="Notes" placeholder="What did you notice?" value={draft.notes} multiline minRows={2} inputProps={{maxLength:4000}} onChange={e=>change('notes',e.target.value)} fullWidth size="small"/>
    <div className="f-notebook-save"><Button type="submit" size="small">Record entry</Button><small role="status">{status||'Draft · choose Record entry to keep this page.'}</small></div>
  </form>;
}
export default function CatchNotebook({entries,units,onSave,onDelete,location='dock',discoveries}:{entries:NotebookEntry[];units:MeasurementSystem;onSave:SaveNote;onDelete:(id:string)=>void;location?:string;discoveries?:Discoveries}) {
  const [spread,setSpread]=useState(0),[draft,setDraft]=useState<NotebookEntry>(),[removed,setRemoved]=useState<NotebookEntry>(),[ripping,setRipping]=useState<string>();
  const ripTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useEffect(()=>()=>clearTimeout(ripTimer.current),[]);
  const pages=draft?[...entries,draft]:entries;
  const last=Math.max(0,Math.ceil(pages.length/2)-1),page=Math.min(spread,last);
  const [direction,setDirection]=useState('rest');
  const turn=(next:number)=>{setDirection(next>page?'next':'previous');setSpread(next);};
  const startDraft=()=>{if(!draft)setDraft(blankEntry(`note-${Date.now()}`,new Date().toISOString(),location));setDirection('next');setSpread(Math.floor(entries.length/2));};
  const record:SaveNote=(id,patch,context)=>{onSave(id,patch,context);if(id===draft?.id)setDraft(undefined);};
  const rip=(entry:NotebookEntry)=>{
    if(ripping)return;setRipping(entry.id);
    ripTimer.current=setTimeout(()=>{setRemoved(entry);onDelete(entry.id);setRipping(undefined);},450);
  };
  return <section className="f-field-notebook" aria-label="Your handwritten lake notebook"><div className="f-notebook-toolbar"><p>Only entries you choose to record stay here, even after a release.</p><Button onClick={startDraft}>New entry</Button></div>
    {removed&&<div className="f-page-removed" role="status">Page removed. <Button size="small" onClick={()=>{onSave(removed.id,removed,removed);setRemoved(undefined);}}>Undo</Button></div>}
    <small className="f-notebook-swipe-hint">Swipe across the book to read the facing page.</small>
    <div key={`${page}-${pages.length}`} className={`f-open-notebook f-page-turn-${direction}`}>
      {[0,1].map(side=>{const index=page*2+side,entry=pages[index],isDraft=!!entry&&entry.id===draft?.id;return <article className={`f-notebook-page f-paper ${entry&&ripping===entry.id?'f-page-ripping':''}`} key={entry?.id??side} aria-label={`Notebook page ${index+1}`}>
        {entry?<><div className="f-page-dateline"><time>{new Date(entry.caughtAt).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</time><span>{LOCATIONS.find(l=>l.id===entry.location)?.spot??'Cedar Lake'}</span></div>
          <IconButton className="f-rip-page" aria-label={isDraft?'Discard draft page':`Rip out page ${index+1}`} title={isDraft?'Discard draft':'Rip out this page'} onClick={()=>isDraft?setDraft(undefined):rip(entry)} disabled={!!ripping}>
            <svg viewBox="0 0 28 28" aria-hidden="true"><path className="f-page-outline" d="M6 3h12l4 4v18H6zM18 3v5h4"/><path className="f-page-tear" d="m16 3-5 7 5 2-6 7 4 2-3 4"/></svg>
          </IconButton>
          <NotebookEditor key={`${entry.id}-${units}`} entry={entry} units={units} onSave={record} discoveries={discoveries}/></>:<div className="f-blank-page"><span>≈</span><h3>A fresh page</h3><p>A fish, a place, a little detail worth remembering.</p><Button onClick={startDraft}>Write an entry</Button></div>}
        <span className="f-page-number">{index+1}{isDraft?' · draft':''}</span>
      </article>;})}
    </div>
    <nav className="f-notebook-pagination" aria-label="Turn notebook pages"><Button disabled={page===0} onClick={()=>turn(page-1)}>← Previous pages</Button><span>Pages {page*2+1}–{page*2+2}</span><Button disabled={page>=last} onClick={()=>turn(page+1)}>Next pages →</Button></nav>
  </section>;
}
