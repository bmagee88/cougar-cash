import React,{useEffect,useState} from "react";
import {useCombatClock} from "./CombatCharacter";
import {TypingBossSessionSnapshot} from "./types";
import "./battleCountdown.css";

export function useBattleCountdown(deadline?:number|null,serverNow?:number) {
  const clock=useCombatClock(serverNow),[,redraw]=useState(0);
  useEffect(()=>{
    if(!deadline || deadline<=Date.now()+clock.current)return;
    const timer=setInterval(()=>{
      redraw(value=>value+1);
      if(Date.now()+clock.current>=deadline)clearInterval(timer);
    },100);
    return ()=>clearInterval(timer);
  },[deadline,clock]);
  return deadline?Math.max(0,Math.ceil((deadline-Date.now()-clock.current)/1000)):0;
}
export default function BattleCountdown({session}:{session:TypingBossSessionSnapshot}) {
  const seconds=useBattleCountdown(session.status==='active'?session.countdownEndsAt:null,session.serverNow);
  if(!seconds)return null;
  return <div className="battle-countdown" role="status" aria-live="polite" aria-label={`Battle starts in ${seconds} seconds`}>
    <span>Get ready</span><strong key={seconds}>{seconds}</strong><span>Battle starts together</span>
  </div>;
}
