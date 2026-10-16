import React, { useLayoutEffect, useRef } from 'react';
import { Button } from '@mui/material';
import { fightGap, fightTension } from '../engine/fishFight';
import { FishFightState, TypingState } from '../engine/types';
import { HAIKU_BY_TEXT, HAIKU_SOURCE } from '../engine/haiku';
import PromptInput from './PromptInput';

export default function FishFightChallenge({typing,fight,onKey,onReady,onRelease}:{typing:TypingState;fight:FishFightState;onKey:(key:string)=>void;onReady:()=>void;onRelease:()=>void}){
  const input=useRef<HTMLInputElement>(null);
  useLayoutEffect(()=>{onReady();input.current?.focus({preventScroll:true});},[onReady]);
  const gap=fightGap(typing,fight),tension=Math.min(1,fightTension(typing,fight));
  const color=`hsl(${48*(1-tension)} 88% 65%)`,poem=HAIKU_BY_TEXT.get(typing.phrase);
  const wrong=typing.typed!==typing.phrase.slice(0,typing.typed.length);
  return <section className={`f-challenge f-fish-fight ${fight.jolt?'f-fight-jolting':''}`} aria-labelledby="f-fight-title" onClick={()=>input.current?.focus({preventScroll:true})} style={{'--fight-color':color} as React.CSSProperties}>
    <div className="f-challenge-top"><span id="f-fight-title">{fight.jolt?'Fish jolting · ease the line':'Fish Fight · reel gently'}</span><span>{fight.testLb}<small> lb test</small></span></div>
    <div className="f-fight-meters"><label>Tension <strong>{Math.round(tension*100)}%</strong><progress aria-label="Line tension" value={tension} max={1}/></label><label>Fish stamina <strong>{Math.ceil(fight.stamina)} / {Math.ceil(fight.maxStamina)}</strong><progress aria-label="Fish stamina" value={fight.stamina} max={fight.maxStamina}/></label></div>
    <div className="f-phrase" aria-hidden="true">{Array.from(typing.phrase).map((char,i)=>{
      const typed=i<typing.typed.length,fishCursor=i===fight.fishCursor;
      return <span key={i} className={`${typed?typing.typed[i]===char?'f-char-correct':'f-char-wrong':''} ${i===typing.typed.length?'f-caret':''} ${fishCursor?'f-fish-caret':''} ${fight.jolt&&i>=fight.fishCursor&&i<typing.typed.length?'f-char-tension':''}`}>{char}</span>;
    })}<span className={`${typing.typed.length===typing.phrase.length?'f-caret':''} ${fight.fishCursor===typing.phrase.length?'f-fish-caret':''}`}>&#8203;</span></div>
    <PromptInput ref={input} label={`Fight this fish with the same haiku: ${typing.phrase}`} value={typing.typed} onKey={onKey}/>
    {poem&&<div className="f-haiku-credit">Haiku · {poem.author} <span>translated by {HAIKU_SOURCE.translator}</span></div>}
    <div className="f-challenge-help" role="status">{wrong?'Wrong key — Backspace to correct it.':fight.jolt?`${gap} characters under tension. Backspace to give line; red means close to snapping.`:'The line is slack. Keep typing your haiku until the fish is landed.'}</div>
    <div className="f-retrieve-footer"><small>{fight.wordCheckpoint?'Word checkpoints on':'No word checkpoints'} · {fight.spoolM.toFixed(0)} m on spool · no timer</small><Button size="small" onClick={e=>{e.stopPropagation();onRelease();}}>Let fish go</Button></div>
  </section>;
}
