import React, { useLayoutEffect, useRef } from 'react';
import { Button } from '@mui/material';
import { HAIKU_BY_TEXT, HAIKU_SOURCE } from '../engine/haiku';
import { RHYTHM_LABELS } from '../engine/interactive';
import { RETRIEVES } from '../engine/tackle';
import { Retrieve, RetrieveState } from '../engine/types';

export default function RetrieveChallenge({ retrieve, presentation, onKey, onReelIn }: { retrieve: RetrieveState; presentation: Retrieve; onKey: (key:string)=>void; onReelIn:()=>void }) {
  const input=useRef<HTMLInputElement>(null);
  useLayoutEffect(()=>{input.current?.focus({preventScroll:true});},[]);
  const r=retrieve; const poem=HAIKU_BY_TEXT.get(r.typing.phrase)!;
  const mistake=r.typing.typed!==r.typing.phrase.slice(0,r.typing.typed.length);
  const grass=!!r.cover[r.maxReeled]; const reeled=r.maxReeled/r.typing.phrase.length;
  return <section className={`f-challenge f-retrieve ${r.nibble ? 'f-retrieve-nibble' : ''}`} aria-labelledby="f-retrieve-title" onClick={()=>input.current?.focus()}>
    <div className="f-challenge-top"><span id="f-retrieve-title">{r.nibble ? '◌ Nibble — hold still' : 'Retrieve your haiku'}</span><span>{Math.round(reeled*100)}<small>% reeled</small></span></div>
    <div className="f-retrieve-meta"><strong>{RHYTHM_LABELS[r.rhythm]}</strong><span>{RETRIEVES[presentation].name}</span>{grass && <span className="f-cover-badge">Grass cover · rarity +1</span>}</div>
    <div className="f-countdown" role="progressbar" aria-label="Line reeled in" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(reeled*100)}><div style={{transform:`scaleX(${reeled})`}} /></div>
    <div className="f-phrase" aria-hidden="true">{Array.from(r.typing.phrase).map((char,i)=>{
      const typed=i<r.typing.typed.length; const wrong=typed && r.typing.typed[i]!==char;
      return <span key={i} className={`${r.cover[i] ? 'f-char-grass' : ''} ${typed ? wrong ? 'f-char-wrong' : 'f-char-correct' : ''} ${i===r.typing.typed.length ? 'f-caret' : ''}`}>{char}</span>;
    })}</div>
    <input ref={input} className="f-keyboard-input" aria-label={`Retrieve this haiku: ${r.typing.phrase}`} value={r.typing.typed} onChange={()=>{}} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
      onPaste={e=>e.preventDefault()} onDrop={e=>e.preventDefault()} onKeyDown={e=>{
        if(e.ctrlKey || e.metaKey || e.altKey || e.nativeEvent.isComposing) return;
        if(e.key.length===1 || e.key==='Backspace'){e.preventDefault();onKey(e.key);}
      }} />
    <div className="f-haiku-credit">Haiku · {poem.author} <span>translated by {HAIKU_SOURCE.translator}</span></div>
    <div className="f-challenge-help" role="status">{mistake ? 'Wrong key — press Backspace to correct it' : r.nibble ? 'Stop typing for 5–10 seconds. This nibble may become a bite.' : r.notice ?? (grass ? 'Pause here for 5 seconds to dead stick in grass cover.' : 'Type steadily, in bursts, or pause for 5 seconds.')}</div>
    <div className="f-retrieve-footer"><small>Green = grass · no timer</small><Button size="small" onClick={e=>{e.stopPropagation();onReelIn();}}>Reel in &amp; recast</Button></div>
  </section>;
}
