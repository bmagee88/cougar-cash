import React, {useEffect, useMemo, useState} from 'react';
import {useCombatClock} from './CombatCharacter';
import {TypingBossSessionSnapshot} from './types';
import './bossAttackNameBar.css';

export const ATTACK_NAME_MS=4000;

export default function BossAttackNameBar({session}:{session:TypingBossSessionSnapshot}) {
  const clock=useCombatClock(session.serverNow),[,redraw]=useState(0);
  const now=Date.now()+clock.current;
  const visible=!['setup','closed','expired'].includes(session.status);
  const attacks=visible?session.projectiles.filter(shot=>shot.source==='boss' && shot.kind==='boss'):[];
  const startedAt=(shot:typeof attacks[number])=>shot.animationStartedAt ?? shot.startedAt;
  // A volley has one announcement, even when it contains one shot per player.
  const latest=attacks.filter(shot=>startedAt(shot)<=now).reduce<typeof attacks[number]|undefined>((best,shot)=>
    !best || startedAt(shot)>startedAt(best)?shot:best,undefined);
  const at=latest?startedAt(latest):undefined;
  const deadline=at===undefined?Infinity:at+ATTACK_NAME_MS;
  const nextAt=Math.min(...attacks.filter(shot=>startedAt(shot)>now).map(startedAt),deadline>now?deadline:Infinity);
  useEffect(()=>{
    if(!Number.isFinite(nextAt))return;
    const timer=setTimeout(()=>redraw(value=>value+1),Math.max(1,nextAt-Date.now()-clock.current));
    return ()=>clearTimeout(timer);
  },[nextAt,clock]);
  const delay=useMemo(()=>at===undefined?0:-Math.max(0,Date.now()+clock.current-at),[at,clock]);
  if(!latest || now>=deadline)return null;
  return <div key={`${at}:${latest.moveLabel}`} className="boss-attack-name-bar" data-testid="boss-attack-name-bar"
    role="status" aria-live="polite" aria-atomic="true" style={{animationDelay:`${delay}ms`}}>
    <span>{latest.moveLabel}</span>
  </div>;
}
