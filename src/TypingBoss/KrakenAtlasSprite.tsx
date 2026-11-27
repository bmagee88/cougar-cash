import BossIdleSprite from './BossIdleSprite';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Box} from '@mui/material';
import {CombatAnimation} from './combatAnimation';
import {TypingBossBoss} from './types';
import {KRAKEN_ANIMATIONS,KrakenAction} from './krakenAnimationRules';
import './krakenAtlases.css';
const ASSETS=`${(process.env.PUBLIC_URL || '').replace(/\/$/,'')}/assets/typing-boss`;
export function krakenSpriteAction(pose:CombatAnimation,now:number,cast?:TypingBossBoss['krakenCast'],quiet=false){
  if(quiet || pose.state==='defeated' || pose.state==='death')return null;
  if(cast && cast.at<=now && now<cast.until)return {kind:'special' as KrakenAction,id:cast.id,at:cast.at,duration:cast.until-cast.at};
  if(pose.hurtTier==='power' || pose.hurtTier==='critical')return null;
  const action=pose.action || pose;
  const kind=action.krakenAttack || (action.state==='bite'?'tentacleStrike':action.state==='tailWhip'?'tentacleSweep':action.state==='weakAttack' || action.state==='strongAttack'?'tidalWave':null);
  if(!kind || now<action.at || now>=action.at+action.duration)return null;
  return {kind,id:action.id,at:action.at,duration:action.duration};
}
export default function KrakenAtlasSprite({width,pose,clock,cast,quiet=false,inspectFrame}:{width:number|string|{xs:number;md:number};pose:CombatAnimation;clock?:React.MutableRefObject<number>;cast?:TypingBossBoss['krakenCast'];quiet?:boolean;inspectFrame?:number}){
  const fallback=useRef(0),time=clock || fallback;
  const [,redraw]=useState(0),[loaded,setLoaded]=useState<Set<string>>(()=>new Set());
  const now=Date.now()+time.current,sampleAt=inspectFrame===undefined?now:cast?cast.at:pose.action?.at ?? pose.at;
  const action=krakenSpriteAction(pose,sampleAt,cast,quiet);
  const kind=action?.kind || 'tentacleStrike',config=KRAKEN_ANIMATIONS[kind],ready=loaded.has(kind);
  const id=action?.id,at=action?.at,duration=action?.duration || config.duration;
  // Cache the phase for this event. Loading an atlas catches up once; HP and
  // layout updates keep the same CSS delay instead of replaying its first frame.
  const delay=useMemo(()=>!ready || !id || at===undefined?0:-Math.max(0,Math.min(duration,Date.now()+time.current-at)),[id,at,duration,time,ready]);
  const end=action? action.at+action.duration : undefined;
  useEffect(()=>{if(end===undefined || inspectFrame!==undefined)return;const timer=setTimeout(()=>redraw(n=>n+1),Math.max(1,end-Date.now()-time.current)+8);return()=>clearTimeout(timer);},[end,time,inspectFrame]);
  const frame=inspectFrame===undefined? action?undefined:0:Math.max(0,Math.min(config.frames-1,Math.trunc(inspectFrame)));
  const position=(index:number)=>`${(index%config.columns)/(config.columns-1)*100}% ${Math.floor(index/config.columns)/(config.rows-1)*100}%`;
  return <Box className={`kraken-sprite kraken-atlas-sprite kraken-pose-${quiet?'idle':pose.state}`} data-testid="kraken-animation" data-animation={quiet?'idle':pose.state} data-kraken-action={action?.kind || 'idle'} sx={{width,aspectRatio:'384 / 216',flexShrink:0}}>
    {Object.entries(KRAKEN_ANIMATIONS).filter(([key])=>!quiet || key==='tentacleStrike').map(([key,value])=><img key={key} className="kraken-atlas-preload" data-testid={`kraken-preload-${key}`} src={`${ASSETS}/kraken/${value.file}.webp`} alt="" aria-hidden="true" onLoad={()=>setLoaded(previous=>new Set([...previous,key]))}/>)}
    {!action && !['death','defeated','hit'].includes(pose.state)?<BossIdleSprite bossId="kraken" inspectFrame={inspectFrame}/>:ready?<span className="kraken-atlas-viewport"><span key={`${id || 'idle'}:${kind}`} data-testid="kraken-atlas-cell" data-frame-count={config.frames} data-action={action?.kind || 'idle'}
      className={`kraken-atlas-cell kraken-sheet-${kind}`} style={{backgroundImage:`url("${ASSETS}/kraken/${config.file}.webp")`,backgroundSize:`${config.columns*100}% ${config.rows*100}%`,
        animationDuration:`${duration}ms`,animationDelay:`${delay}ms`,animationName:frame===undefined?undefined:'none',backgroundPosition:frame===undefined?undefined:position(frame),
        '--kraken-still-position':position(Math.min(config.frames-1,Math.floor(config.impact/config.duration*config.frames))),
      } as React.CSSProperties}/></span>:<img className="kraken-static-fallback" src={`${ASSETS}/kraken-concept-v1/kraken-clean-v2.png`} alt="" draggable={false}/>}
    {action?.kind==='special' && <span data-testid="kraken-special-glow" data-frames="20" className="kraken-special-status" aria-hidden="true" style={{animationDelay:`${delay}ms`}}/>}
  </Box>;
}
