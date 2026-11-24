import React, { useEffect, useRef, useState } from 'react';
import { CombatAnimation } from './combatAnimation';
import { useCombatClock } from './CombatCharacter';
import { TypingBossSessionSnapshot } from './types';
import './dragonBattleEnding.css';

export const DRAGON_FINISH_MS = 4200;
export const DRAGON_COLLAPSE_MS = 1800;
export function dragonEnding(session: TypingBossSessionSnapshot) {
  if (session.boss.id === 'kraken') return null;
  const kind = session.status === 'defeat' ? 'blast' : session.status === 'victory' && session.boss.hp <= 0 ? 'collapse' : null;
  const at = session.closedAt ? Date.parse(session.closedAt) : NaN;
  return kind && Number.isFinite(at) ? {kind, at, duration:kind === 'blast' ? DRAGON_FINISH_MS : DRAGON_COLLAPSE_MS} : null;
}
export function useDragonEnding(session: TypingBossSessionSnapshot) {
  const clock = useCombatClock(session.serverNow), [, redraw] = useState(0);
  const ending = dragonEnding(session), deadline = ending ? ending.at+ending.duration : 0;
  const now = Date.now()+clock.current;
  useEffect(() => {
    if (!deadline || deadline <= Date.now()+clock.current) return;
    const timer = setTimeout(() => redraw(value=>value+1), deadline-Date.now()-clock.current+8);
    return () => clearTimeout(timer);
  }, [deadline,clock]);
  return {ending, playing:Boolean(ending && now<deadline), now};
}
export function dragonFinisherPose(at: number): CombatAnimation {
  return {id:`dragon-finisher:${at}`,state:'flamethrower',at,duration:DRAGON_FINISH_MS};
}
export function partyFinisherPose(at: number, now: number): CombatAnimation {
  return now<at+DRAGON_FINISH_MS ? {id:`party-ko:${at}`,state:'death',at,duration:DRAGON_FINISH_MS} : {id:`party-ko:${at}`,state:'defeated',at,duration:0};
}
export default function DragonVictoryBlast({at,now,bossPoint}: {at:number;now:number;bossPoint:{x:number;y:number}}) {
  const timing = useRef({at,delay:-Math.max(0,now-at)});
  if(timing.current.at!==at)timing.current={at,delay:-Math.max(0,now-at)};
  const delay = timing.current.delay;
  return <div className="dragon-victory-blast" data-testid="dragon-victory-blast" role="img" aria-label="The dragon unleashes a final fire blast. The party falls in slow motion."
    style={{'--finisher-delay':`${delay}ms`,'--blast-origin-x':`${bossPoint.x-7}%`,'--blast-origin-y':`${bossPoint.y+6}%`} as React.CSSProperties}>
    <div className="dragon-blast-flash"/><div className="dragon-blast-cone"><i/><i/><i/></div>
    <div className="dragon-blast-shockwave"/>
    {Array.from({length:24},(_,index)=><i key={index} className="dragon-blast-ember" style={{'--ember-x':`${7+(index*37)%75}%`,'--ember-y':`${35+(index*17)%55}%`,'--ember-turn':`${index*29}deg`} as React.CSSProperties}/>)}
    <strong className="dragon-blast-ko">PARTY K.O.</strong>
  </div>;
}
