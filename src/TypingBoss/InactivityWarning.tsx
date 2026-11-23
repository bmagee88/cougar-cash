import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Alert} from '@mui/material';
import {TypingBossCredentials,TypingBossPlayer} from './types';
import {useCombatClock} from './CombatCharacter';
import {submitTypingBossActivity} from './api';
const EVENT='typing-boss-human-typing';

export function useTypingActivity(sessionId:string,credentials:TypingBossCredentials,active:boolean) {
  const live=useRef({credentials,active}),timer=useRef<ReturnType<typeof setTimeout>|null>(null),lastSent=useRef(0);
  live.current={credentials,active};
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
  return useCallback(()=>{
    if(!live.current.active || !live.current.credentials.playerToken)return;
    window.dispatchEvent(new CustomEvent(EVENT,{detail:{sessionId,code:live.current.credentials.code}}));
    const send=()=>{
      if(!live.current.active)return;
      lastSent.current=Date.now();
      void Promise.resolve(submitTypingBossActivity(sessionId,live.current.credentials)).catch(()=>{});
    };
    const delay=Math.max(0,500-(Date.now()-lastSent.current));
    if(!delay){if(timer.current)clearTimeout(timer.current);timer.current=null;send();return;}
    if(timer.current)return;
    timer.current=setTimeout(()=>{
      timer.current=null;
      send();
    },delay);
  },[sessionId]);
}

export default function InactivityWarning({sessionId,player,active,countdownEndsAt,serverNow}:{
  sessionId:string;player:TypingBossPlayer;active:boolean;countdownEndsAt?:number|null;serverNow?:number;
}) {
  const clock=useCombatClock(serverNow),[localAt,setLocalAt]=useState(0),[,tick]=useState(0);
  useEffect(()=>{
    const update=(event:Event)=>{
      const detail=(event as CustomEvent).detail;
      if(detail.sessionId===sessionId && detail.code===player.code)setLocalAt(Date.now()+clock.current);
    };
    window.addEventListener(EVENT,update);
    return ()=>window.removeEventListener(EVENT,update);
  },[sessionId,player.code,clock]);
  useEffect(()=>{
    if(!active)return;
    const timer=setInterval(()=>tick(value=>value+1),250);
    return ()=>clearInterval(timer);
  },[active]);
  const now=Date.now()+clock.current;
  const last=Math.max(countdownEndsAt || 0,player.lastTypingAt || 0,player.proneUntil || 0,localAt);
  if(!active || (!player.timedOut && (!last || now-last<10000)))return null;
  const remaining=Math.max(0,Math.ceil((last+30000-now)/1000));
  return <Alert severity="warning" role="alert" sx={{position:'fixed',top:12,left:'50%',transform:'translateX(-50%)',zIndex:1400,width:'max-content',maxWidth:'90vw',pointerEvents:'none'}}>
    {player.timedOut?'Your character retreated due to inactivity. You are out for this battle.':`Keep typing to stay in the battle. Your character retreats in ${remaining}s and cannot return this battle.`}
  </Alert>;
}
