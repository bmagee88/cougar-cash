import React, {useRef} from 'react';
import {useCombatClock} from './CombatCharacter';
import {TypingBossSessionSnapshot} from './types';
import './bossVictoryColor.css';

export const BOSS_VICTORY_COLOR_MS=8000;
export default function useBossVictoryColor(session:TypingBossSessionSnapshot) {
  const clock=useCombatClock(session.serverNow),timing=useRef({key:'',delay:0});
  const key=session.status==='defeat'?`${session.id}:${session.closedAt || ''}`:'';
  if(key!==timing.current.key) {
    const at=Date.parse(session.closedAt || '');
    timing.current={key,delay:key && Number.isFinite(at)?-Math.max(0,Date.now()+clock.current-at):0};
  }
  return {className:key?'boss-victory-color':'',style:{animationDelay:key?`${timing.current.delay}ms`:undefined} as React.CSSProperties};
}
