import React,{useEffect,useMemo,useState} from 'react';
import {Box} from '@mui/material';
import {CombatAnimation} from './combatAnimation';
import {TypingBossBoss,TypingBossPlayer,TypingBossSessionSnapshot} from './types';
import {WYRM_ACTIONS} from './wyrmRules';
import {useCombatClock,CombatEffects} from './CombatCharacter';
import {useBattleCountdown} from './BattleCountdown';
import './wyrm.css';
const assets=`${process.env.PUBLIC_URL || ''}/assets/typing-boss/wyrm`;
export function WyrmScenery(){return <img className="wyrm-desert" src={`${assets}/desert.webp`} alt="" aria-hidden="true"/>;}
export function wyrmVisual(boss:Pick<TypingBossBoss,'wyrmAction'|'wyrmBurrowed'|'wyrmSpitAt'>,pose:CombatAnimation,now:number) {
  if(pose.state==='death' || pose.state==='defeated')return {row:11,state:'death',at:pose.at,duration:pose.duration || 1800,held:pose.state==='defeated'};
  const action=boss.wyrmAction;
  if(boss.wyrmSpitAt!==undefined && boss.wyrmSpitAt!==null && now>=boss.wyrmSpitAt && now<boss.wyrmSpitAt+1800 && !(action?.kind==='overrun' && now<action.until))
    return {row:7,state:'spitOut',at:boss.wyrmSpitAt,duration:1800,deadline:boss.wyrmSpitAt+1800};
  if(action && now<action.until && now>=action.at) {
    const elapsed=now-action.at;
    if(action.kind==='overrun')return elapsed<2000?{row:3,state:'overrun',at:action.at,duration:2000,deadline:action.at+2000}:
      elapsed<5500?{row:3,state:'offscreen',at:action.at,duration:5500,deadline:action.at+5500}:
      {row:5,state:'emerge',at:action.at+5500,duration:2500,deadline:action.until};
    if(!pose.hurtTier || action.kind==='burrow')return {row:WYRM_ACTIONS[action.kind].row,state:action.kind,at:action.at,duration:action.until-action.at,deadline:action.until};
  }
  if(boss.wyrmBurrowed)return {row:4,state:'underground',at:0,duration:1,held:true};
  if(pose.hurtTier)return {row:pose.hurtTier==='critical'?10:pose.hurtTier==='power'?9:8,state:`hurt-${pose.hurtTier}`,at:pose.at,duration:pose.duration};
  return {row:0,state:pose.state==='dodge'?'dodge':pose.state==='block'?'block':'idle',at:0,duration:1500};
}
export default function WyrmSprite({boss,pose,width,clock,inspection}:{boss:Pick<TypingBossBoss,'wyrmAction'|'wyrmBurrowed'|'wyrmSpitAt'>;pose:CombatAnimation;width:number|{xs:number;md:number};clock?:React.MutableRefObject<number>;inspection?:{row:number;frame:number}}) {
  const local=useCombatClock(),time=clock || local,[,redraw]=useState(0),now=Date.now()+time.current;
  const visual=inspection?{row:Math.max(0,Math.min(11,inspection.row)),state:'inspection',at:0,duration:1500,deadline:undefined,held:false}:wyrmVisual(boss,pose,now),deadline=visual.deadline;
  const delay=useMemo(()=>visual.state==='idle' || !visual.at?0:-Math.max(0,Date.now()+time.current-visual.at),[visual.state,visual.at,time]);
  useEffect(()=>{if(deadline===undefined)return;const timer=setTimeout(()=>redraw(n=>n+1),Math.max(1,deadline-Date.now()-time.current)+8);return()=>clearTimeout(timer);},[deadline,time]);
  return <Box className={`wyrm-sprite wyrm-${visual.state}`} data-testid="wyrm-animation" data-animation={visual.state} data-sprite-row={visual.row} sx={{width,aspectRatio:'1',position:'relative'}}>
    <span key={`${visual.state}:${visual.at}`} className="wyrm-motion" style={{animationDelay:`${delay}ms`}}>
      <span className="wyrm-frames" style={{backgroundImage:`url("${assets}/combat-v2.webp")`,backgroundPositionY:`${visual.row/11*100}%`,backgroundPositionX:inspection?`${Math.max(0,Math.min(5,inspection.frame))/5*100}%`:visual.held?'100%':undefined,
        animationDuration:`${visual.duration}ms`,animationDelay:`${delay}ms`,animationIterationCount:visual.state==='idle'?'infinite':1,animationName:inspection || visual.held?'none':undefined}}/>
      {(visual.state==='overrun' || visual.state==='emerge' || visual.state==='burrow') && <i className="wyrm-dust"/>}
    </span>
    <CombatEffects pose={pose} clock={time}/>
  </Box>;
}
export function ConsumeNotice({player,serverNow,active}:{player:TypingBossPlayer;serverNow?:number;active:boolean}) {
  const seconds=useBattleCountdown(active?player.consumedUntil:null,serverNow);
  return seconds>0?<div className="consume-notice" role="status">Consumed · {seconds}s · Keep typing! Damage arrives every 3 seconds.</div>:null;
}
export function WyrmSceneEffects({session,positions}:{session:TypingBossSessionSnapshot;positions:Map<string,{x:number;y:number}>}) {
  const clock=useCombatClock(session.serverNow),[,redraw]=useState(0),now=Date.now()+clock.current,action=session.boss.wyrmAction;
  const end=action?.until;
  const actionAt=action?.at,actionId=action?.id;
  const delay=useMemo(()=>!actionId || actionAt===undefined?0:-Math.max(0,Date.now()+clock.current-actionAt),[actionAt,actionId,clock]);
  useEffect(()=>{if(!end || end<=Date.now()+clock.current)return;const timer=setTimeout(()=>redraw(n=>n+1),end-Date.now()-clock.current+8);return()=>clearTimeout(timer);},[end,clock]);
  if(session.boss.id!=='giantSandWyrm' || !action || action.kind!=='consume' || now>=action.until)return null;
  const point=positions.get(action.targetCode || '');if(!point)return null;
  return <div key={action.id} className="wyrm-sand-vortex" data-testid="sand-vortex" aria-hidden="true" style={{left:`${point.x}%`,top:`${point.y+4}%`,animationDelay:`${delay}ms`}}><i/><i/><i/></div>;
}
