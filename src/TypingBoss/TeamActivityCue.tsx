import React, {useEffect,useRef,useState} from 'react';
import {Typography} from '@mui/material';
import {TypingBossSessionSnapshot} from './types';

export default React.memo(function TeamActivityCue({activity}:{activity:TypingBossSessionSnapshot['teamActivity']}) {
  const previous=useRef(activity);
  const [cue,setCue]=useState<{id:number;text:string}|null>(null);
  useEffect(()=>{
    const before=previous.current;previous.current=activity;
    if(!before || !activity)return;
    const damage=Math.max(0,activity.damage-before.damage),healing=Math.max(0,activity.healing-before.healing),revives=Math.max(0,activity.revives-before.revives);
    const num=(value:number)=>Number(value.toFixed(2)).toLocaleString();
    const parts=[damage>0?`Team dealt ${num(damage)} damage`:'',healing>0?`Team healed ${num(healing)} HP`:'',revives>0?`Team revived ${num(revives)}`:''].filter(Boolean);
    if(parts.length)setCue({id:Date.now(),text:parts.join(' · ')});
  },[activity]);
  useEffect(()=>{
    if(!cue)return;
    const timer=setTimeout(()=>setCue(null),1400);return()=>clearTimeout(timer);
  },[cue]);
  return <Typography key={cue?.id || 'quiet'} role="status" aria-live="polite" className={cue?'typing-team-cue typing-team-cue-active':'typing-team-cue'}
    sx={{height:20,lineHeight:'20px',fontSize:12,color:'#c4b5fd',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',opacity:cue?1:0}}>{cue?.text || ''}</Typography>;
});
