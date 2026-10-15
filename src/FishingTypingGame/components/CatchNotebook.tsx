import React, { useEffect, useRef, useState } from 'react';
import { Button, TextField } from '@mui/material';
import { MeasurementSystem, NotebookEntry } from '../engine/types';
import { CM_PER_IN, KG_PER_LB, formatLength, formatWeight, lengthUnit, lengthValue, weightUnit, weightValue } from '../engine/specimens';
import { LOCATIONS } from '../engine/config';

export type NotePatch=Partial<Pick<NotebookEntry,'name'|'notes'|'weightKg'|'lengthCm'>>;
export type SaveNote=(id:string,patch:NotePatch)=>void;
function draftOf(entry:NotebookEntry,units:MeasurementSystem) {
  return {name:entry.name,notes:entry.notes,weight:entry.weightKg===undefined?'':Number(weightValue(entry.weightKg,units).toFixed(4)).toString(),length:entry.lengthCm===undefined?'':Number(lengthValue(entry.lengthCm,units).toFixed(3)).toString()};
}
export function RecordedMeasurements({entry,units}:{entry?:NotebookEntry;units:MeasurementSystem}) {
  return <div className="f-recorded-measurements"><span>{entry?.weightKg===undefined?'Unweighed':formatWeight(entry.weightKg,units)}</span><span>{entry?.lengthCm===undefined?'Unmeasured':formatLength(entry.lengthCm,units)}</span></div>;
}
export function NotebookEditor({entry,units,onSave,heading='My field notes'}:{entry:NotebookEntry;units:MeasurementSystem;onSave:SaveNote;heading?:string}) {
  const [draft,setDraft]=useState(()=>draftOf(entry,units));
  const [errors,setErrors]=useState<Record<string,string>>({});const [status,setStatus]=useState('');
  const dirty=useRef(new Set<keyof typeof draft>()),form=useRef<HTMLFormElement>(null);
  useEffect(()=>{if(!form.current?.contains(document.activeElement)){setDraft(draftOf(entry,units));dirty.current.clear();}},[entry.name,entry.notes,entry.weightKg,entry.lengthCm,units]);
  const change=(field:keyof typeof draft,value:string)=>{dirty.current.add(field);setDraft(d=>({...d,[field]:value}));setStatus('');};
  const commit=(fields:(keyof typeof draft)[])=>{
    const patch:NotePatch={},nextErrors:Record<string,string>={};
    fields.filter(field=>dirty.current.has(field)).forEach(field=>{
      if(field==='name'||field==='notes'){patch[field]=draft[field];return;}
      const text=draft[field].trim(),value=Number(text),converted=value*(field==='weight'?(units==='imperial'?KG_PER_LB:1):(units==='imperial'?CM_PER_IN:1));
      if(text&&(!Number.isFinite(converted)||converted<=0)){nextErrors[field]='Use a positive number.';return;}
      patch[field==='weight'?'weightKg':'lengthCm']=text?converted:undefined;
    });
    setErrors(previous=>({...previous,...Object.fromEntries(fields.map(field=>[field,nextErrors[field]??'']))}));
    if(Object.keys(patch).length){onSave(entry.id,patch);fields.forEach(field=>{if(!nextErrors[field])dirty.current.delete(field);});setStatus('Saved to your notebook');}
    return !Object.keys(nextErrors).length;
  };
  return <form ref={form} className="f-paper f-notebook-editor" aria-label={heading} onSubmit={e=>{e.preventDefault();if(commit(['name','weight','length','notes']))setStatus('Saved to your notebook');}}>
    <span className="f-paper-kicker">STILLWATER FIELD BOOK</span><h3>{heading}</h3>
    <RecordedMeasurements entry={entry} units={units}/>
    <TextField label="Fish type" placeholder="Your identification" value={draft.name} inputProps={{maxLength:100}} onChange={e=>change('name',e.target.value)} onBlur={()=>commit(['name'])} fullWidth size="small"/>
    <div className="f-notebook-measure-fields"><TextField label={`Weight (${weightUnit(units)})`} placeholder="Unweighed" value={draft.weight} type="number" inputProps={{min:0,step:'any',inputMode:'decimal'}} error={!!errors.weight} helperText={errors.weight} onChange={e=>change('weight',e.target.value)} onBlur={()=>commit(['weight'])} size="small"/><TextField label={`Length (${lengthUnit(units)})`} placeholder="Unmeasured" value={draft.length} type="number" inputProps={{min:0,step:'any',inputMode:'decimal'}} error={!!errors.length} helperText={errors.length} onChange={e=>change('length',e.target.value)} onBlur={()=>commit(['length'])} size="small"/></div>
    <TextField label="Notes" placeholder="What did you notice?" value={draft.notes} multiline minRows={2} inputProps={{maxLength:4000}} onChange={e=>change('notes',e.target.value)} onBlur={()=>commit(['notes'])} fullWidth size="small"/>
    <div className="f-notebook-save"><Button type="submit" size="small">Save entry</Button><small role="status">{status||'Only your observations are recorded.'}</small></div>
  </form>;
}
export default function CatchNotebook({entries,units,onSave,onAdd}:{entries:NotebookEntry[];units:MeasurementSystem;onSave:SaveNote;onAdd:()=>void}) {
  const [spread,setSpread]=useState(0);const last=Math.max(0,Math.ceil(entries.length/2)-1),page=Math.min(spread,last);
  const [direction,setDirection]=useState('rest');
  const turn=(next:number)=>{setDirection(next>page?'next':'previous');setSpread(next);};
  return <section className="f-field-notebook" aria-label="Your handwritten lake notebook"><div className="f-notebook-toolbar"><p>Your observations stay here, even after a release.</p><Button onClick={()=>{onAdd();setDirection('next');setSpread(Math.floor(entries.length/2));}}>New entry</Button></div>
    <small className="f-notebook-swipe-hint">Swipe across the book to read the facing page.</small>
    <div key={`${page}-${entries.length}`} className={`f-open-notebook f-page-turn-${direction}`}>
      {[0,1].map(side=>{const index=page*2+side,entry=entries[index];return <article className="f-notebook-page f-paper" key={side} aria-label={`Notebook page ${index+1}`}>
        {entry?<><div className="f-page-dateline"><time>{new Date(entry.caughtAt).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</time><span>{LOCATIONS.find(l=>l.id===entry.location)?.spot??'Cedar Lake'}</span></div><NotebookEditor key={`${entry.id}-${units}`} entry={entry} units={units} onSave={onSave} heading={`Observation ${index+1}`}/></>:<div className="f-blank-page"><span>≈</span><h3>A fresh page</h3><p>A fish, a place, a little detail worth remembering.</p><Button onClick={()=>{onAdd();setSpread(Math.floor(entries.length/2));}}>Write an entry</Button></div>}
        <span className="f-page-number">{index+1}</span>
      </article>;})}
    </div>
    <nav className="f-notebook-pagination" aria-label="Turn notebook pages"><Button disabled={page===0} onClick={()=>turn(page-1)}>← Previous pages</Button><span>Pages {page*2+1}–{page*2+2}</span><Button disabled={page>=last} onClick={()=>turn(page+1)}>Next pages →</Button></nav>
  </section>;
}
