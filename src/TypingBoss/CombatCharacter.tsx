import React, { useEffect, useMemo, useRef, useState } from "react";
import { CombatAnimation, CombatAnimationEvent, POSE_ROW, selectCombatAnimation } from "./combatAnimation";
import { TypingBossClassId } from "./types";
import "./characterAnimation.css";

const ASSETS = `${(process.env.PUBLIC_URL || "").replace(/\/$/, "")}/assets/typing-boss`;
const idle = {
  cleric:{src:`${ASSETS}/cleric-idle-sprite.png`,aspect:1},
  barbarian:{src:`${ASSETS}/barbarian-idle-sprite.png`,aspect:32/34},
  paladin:{src:`${ASSETS}/paladin-idle-sprite.png`,aspect:48/64},
  rogue:{src:`${ASSETS}/characters/rogue-idle.webp`,aspect:1},
  necromancer:{src:`${ASSETS}/characters/necromancer-idle.webp`,aspect:1},
  monk:{src:`${ASSETS}/characters/monk-idle.webp`,aspect:1},
};
const preloaded = new Map<TypingBossClassId,{ready:boolean;promise:Promise<void>;failedAt?:number}>();
function preloadAtlas(classId:TypingBossClassId,src:string) {
  const existing=preloaded.get(classId);
  if(existing && (existing.failedAt===undefined || Date.now()-existing.failedAt<5000))return existing;
  const record:{ready:boolean;promise:Promise<void>;failedAt?:number}={ready:false,promise:Promise.resolve()};
  record.promise=new Promise<void>((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>{record.ready=true;resolve();};
    image.onerror=()=>{record.failedAt=Date.now();reject(new Error("Character atlas did not load"));};
    image.src=src;
  });
  preloaded.set(classId,record);
  return record;
}
export function useCombatClock(serverNow?:number) {
  const clock=useRef(0),previous=useRef<number | undefined>(undefined);
  if (serverNow && previous.current!==serverNow) {clock.current=serverNow-Date.now();previous.current=serverNow;}
  return clock;
}
export function useCombatAnimation(events:readonly CombatAnimationEvent[], defeated:boolean, clock:React.MutableRefObject<number>) {
  const [,tick]=useState(0);
  const pose=selectCombatAnimation(events,Date.now()+clock.current,defeated);
  const deadline=pose.nextAt;
  useEffect(()=>{
    if(deadline===undefined)return;
    const timer=window.setTimeout(()=>tick(value=>value+1),Math.max(1,deadline-Date.now()-clock.current)+8);
    return ()=>window.clearTimeout(timer);
  },[deadline,clock]);
  return pose;
}

function CombatEffect({event,clock}:{event:CombatAnimationEvent;clock:React.MutableRefObject<number>}) {
  const delay=useMemo(()=>event.id ? Math.max(0,Date.now()+clock.current-event.at):0,[event.id,event.at,clock]);
  return <i aria-hidden="true" data-testid="recipient-reaction" className={`actor-effect actor-effect-${event.state}`}
    style={{"--pose-ms":`${event.duration}ms`,animationDelay:`-${delay}ms`} as React.CSSProperties} />;
}
function ConcurrentCast({event,clock}:{event:CombatAnimationEvent;clock:React.MutableRefObject<number>}) {
  const delay=useMemo(()=>event.id?Math.max(0,Date.now()+clock.current-event.at):0,[event.id,event.at,clock]);
  return <i aria-hidden="true" data-testid="concurrent-cast" className={`actor-action-cue actor-action-${event.state}`}
    style={{"--pose-ms":`${event.duration}ms`,animationDelay:`-${delay}ms`} as React.CSSProperties}/>;
}
export function CombatEffects({pose,clock}:{pose:CombatAnimation;clock:React.MutableRefObject<number>}) {
  return <>
    {pose.action && pose.action.state!==pose.state && <ConcurrentCast key={pose.action.id} event={pose.action} clock={clock}/>}
    {pose.reaction && <CombatEffect key={pose.reaction.id} event={pose.reaction} clock={clock} />}
    {pose.block && pose.block!==pose.reaction && <CombatEffect key={pose.block.id} event={pose.block} clock={clock} />}
  </>;
}

export default function CombatCharacter({classId,color,size=62,highlight=false,pose,clock:providedClock}:{
  classId:TypingBossClassId;color:string;size?:number;highlight?:boolean;pose?:CombatAnimation;clock?:React.MutableRefObject<number>;
}) {
  const localClock=useRef(0),clock=providedClock || localClock;
  const state=pose?.state || "idle";
  const atlas=`${ASSETS}/characters/${classId}-combat.webp`;
  const [readyClass,setReadyClass]=useState<TypingBossClassId | null>(()=>preloaded.get(classId)?.ready?classId:null);
  const preload=Boolean(pose);
  const poseId=pose?.id,poseAt=pose?.at;
  useEffect(()=>{
    if(!preload || !poseId)return;
    let cancelled=false;
    preloadAtlas(classId,atlas).promise.then(()=>{if(!cancelled)setReadyClass(classId);}).catch(()=>{});
    return ()=>{cancelled=true;};
  },[classId,atlas,preload,poseId]);
  const spriteState=readyClass===classId?state:"idle";
  const delay=useMemo(()=>poseId && poseAt!==undefined && spriteState!=="idle" ? Math.max(0,Date.now()+clock.current-poseAt):0,[poseId,poseAt,spriteState,clock]);
  const isIdle=spriteState==="idle",held=spriteState==="defeated";
  const config=idle[classId];
  const scale=isIdle && ["paladin","cleric","barbarian"].includes(classId)?1:1.12;
  const frameWidth=isIdle?size*config.aspect*scale:size*scale;
  return <span data-testid="combat-character" data-character={classId} data-animation={state}
    data-action={pose?.action?.state} data-reaction={pose?.reaction?.state} data-sprite-state={spriteState}
    className={`combat-actor actor-pose-${state}`} aria-hidden="true"
    style={{width:size*.85,height:size,"--actor-color":color,"--actor-glow":`${highlight?18:8}px`,"--pose-ms":`${pose?.duration || 900}ms`} as React.CSSProperties}>
    <span key={`${spriteState}:${pose?.id || "idle"}`} className={`actor-body actor-body-${state}`} style={{animationDelay:`-${delay}ms`}}>
      <span className={`actor-frames${isIdle?" actor-frames-idle":""}${held?" actor-frames-held":""}`} style={{
        width:frameWidth,height:size*scale,left:"50%",top:size-size*scale,marginLeft:-frameWidth/2,
        backgroundImage:`url("${isIdle?config.src:atlas}")`,backgroundSize:`600% ${isIdle?100:800}%`,
        backgroundPositionY:isIdle?"0%":`${POSE_ROW[spriteState]/7*100}%`,backgroundPositionX:held?"100%":"0%",
        animationDuration:`${pose?.duration || 900}ms`,animationDelay:`-${delay}ms`,
      }} />
    </span>
    {pose && <CombatEffects pose={pose} clock={clock} />}
  </span>;
}
