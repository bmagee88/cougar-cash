import React, { useState } from 'react';
import { Button, Checkbox, FormControlLabel, MenuItem, TextField } from '@mui/material';
import { SPECIES } from '../engine/config';
import { FishCheck } from '../engine/types';
import { RETRIEVES } from '../engine/tackle';
import { RHYTHM_LABELS } from '../engine/interactive';
import { MOON_LABELS, PERIOD_LABELS, SEASON_LABELS } from '../engine/world';
import { WEATHER_NAMES } from '../engine/weather';

export const CHECK_LABELS={letter:'Typed letter','dead-stick':'Dead-stick check',nibble:'Nibble decision',standard:'Standard bite',forced:'Developer-triggered bite'};
const fishName=(id?:string)=>SPECIES.find(f=>f.id===id)?.name;
const percent=(n:number)=>(n*100).toFixed(n>0 && n<.001 ? 5 : 3)+'%';
export default function FishCheckInspector({checks,clear,show,onShow}:{checks:FishCheck[];clear:()=>void;show:boolean;onShow:(value:boolean)=>void}) {
  const [selected,setSelected]=useState('latest');
  const check=checks.find(c=>String(c.id)===selected) ?? checks[0];
  let cumulative=0;
  return <details className="f-check-inspector" open><summary>Live fish checks</summary>
    <div className="f-check-toolbar"><FormControlLabel control={<Checkbox checked={show} onChange={e=>onShow(e.target.checked)} />} label="Show checks at the lure" /><Button size="small" onClick={()=>{clear();setSelected('latest');}}>Clear check history</Button></div>
    <p>Checks roll at the lure’s current position. Fish are selected on contact; there are no preplaced fish. Green letters show cover. This inspector is available in development only and keeps the last 40 checks for this session.</p>
    {!check ? <p role="status">No fish checks yet. Cast in Interactive mode and type, or pause for five seconds. Standard records its species roll when the bite arrives.</p> : <>
      <TextField select size="small" label="Inspect fish check" value={checks.some(c=>String(c.id)===selected) ? selected : 'latest'} onChange={e=>setSelected(e.target.value)}><MenuItem value="latest">Follow latest check</MenuItem>{checks.map(c=><MenuItem key={c.id} value={String(c.id)}>#{c.id} · {CHECK_LABELS[c.source]} · {c.outcome}{c.speciesId ? ` · ${fishName(c.speciesId)}` : ''}</MenuItem>)}</TextField>
      <div className="f-check-result" role="status">#{check.id} · {CHECK_LABELS[check.source]} → <strong>{check.outcome==='none' ? 'No fish' : check.outcome==='nibble-lost' ? 'Nibble lost' : check.outcome==='bite' ? 'Bite' : 'Nibble'}</strong>{check.speciesId && ` · ${fishName(check.speciesId)}`}{check.forced && ' · override / forced check'}</div>
      <p>{SEASON_LABELS[check.conditions.season]} · {PERIOD_LABELS[check.conditions.period]} · {MOON_LABELS[check.conditions.moonPhase]} · {WEATHER_NAMES[check.conditions.weather ?? 'sunny']}{check.rhythm && ` · ${RHYTHM_LABELS[check.rhythm]}`}{check.conditions.observedRetrieve && ` · ${RETRIEVES[check.conditions.observedRetrieve].name}`}</p>
      <p>At {(check.at/1000).toFixed(2)}s since page load{check.cursor!==undefined && ` · cursor ${check.cursor+1}`}{check.reeled!==undefined && ` · ${(check.reeled*100).toFixed(1)}% reeled`}{check.grass ? ' · grass (+1 rarity tier)' : ' · open water'}{check.elapsedMs!==undefined && ` · ${check.elapsedMs.toFixed(0)}ms probability window`}</p>
      <p><strong>Contact {percent(check.contactChance)} · No fish / lost nibble {percent(check.noFish)}</strong></p>
      <p className="f-check-rolls">{check.rolls && Object.entries(check.rolls).length ? Object.entries(check.rolls).map(([label,value])=>`${label} draw = ${value?.toFixed(6)}`).join(' · ') : 'No random draw: forced bite or nibble cancelled by movement.'}</p>
      <div className="f-activity-table-wrap"><table className="f-activity-table f-check-table"><caption>Probability table for check #{check.id} · absolute nibble/bite odds per check</caption><thead><tr><th>Species</th><th>Weight</th><th>Species roll band</th><th>Base fish</th><th>After cover</th><th>Nibble</th><th>Bite</th></tr></thead><tbody>{check.rows.map(row=>{
        const start=cumulative;cumulative+=row.chance;
        return <tr key={row.speciesId} className={row.speciesId===check.speciesId ? 'f-check-selected-fish' : ''}><th scope="row">{fishName(row.speciesId)}</th><td>{row.weight.toFixed(4)}</td><td>{start.toFixed(5)}–{cumulative.toFixed(5)}</td><td>{percent(row.chance)}</td><td>{percent(row.candidateChance)}</td><td>{percent(row.nibble)}</td><td>{percent(row.bite)}</td></tr>;
      })}</tbody></table></div>
      <p className="f-footnote">Contact draw must be below Contact. The species draw uses the base roll bands; grass then rolls within the next rarity tier. After cover shows the combined candidate odds. A contact splits 60% nibble / 40% immediate bite. Nibble decisions retain one candidate and use the bite draw against Contact. Forced checks bypass ordinary contact odds. Quality and albino are separate rolls.</p>
    </>}
  </details>;
}
