import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCombatClock } from './CombatCharacter';
import { CombatAnimationEvent, NO_ANIMATION_EVENTS } from './combatAnimation';
import './impactShake.css';

export function impactShakeStrength(event: CombatAnimationEvent, boss: boolean) {
  return boss ? event.critical || event.hurtTier === 'critical' ? 9 : 2 : event.incomingAttack === 'bite' ? 12 : event.incomingAttack === 'flamethrower' || event.incomingAttack === 'tidalWave' ? 2 : 5;
}

export default function useImpactShake(events: readonly CombatAnimationEvent[] = NO_ANIMATION_EVENTS, serverNow?: number, boss = false) {
  const clock = useCombatClock(serverNow), [, redraw] = useState(0), sequence = useRef(0);
  const now = Date.now() + clock.current;
  const hit = events.filter(event => event.state === 'hit' && event.at <= now && now < event.at + 420)
    .sort((a,b) => b.at - a.at || impactShakeStrength(b,boss) - impactShakeStrength(a,boss))[0];
  const nextAt = Math.min(...events.filter(event => event.state === 'hit' && event.at > now).map(event => event.at), hit ? hit.at + 420 : Infinity);
  useEffect(() => {
    if (!Number.isFinite(nextAt)) return;
    const timer = setTimeout(() => redraw(value => value + 1), Math.max(1,nextAt-Date.now()-clock.current)+4);
    return () => clearTimeout(timer);
  }, [nextAt, clock]);
  const id = hit?.id, at = hit?.at;
  // Alternate names to restart each hit without remounting the focused input.
  const animationName = useMemo(() => id ? `battle-impact-${++sequence.current%2 ? 'a' : 'b'}` : undefined, [id]);
  const delay = useMemo(() => at === undefined ? 0 : -Math.max(0,Date.now()+clock.current-at), [at,clock]);
  return { 'data-impact-id': id, 'data-shake-strength': hit ? impactShakeStrength(hit,boss) : undefined,
    style: { animationName, animationDelay:`${delay}ms`, '--impact-distance':`${hit ? impactShakeStrength(hit,boss) : 0}px` } as React.CSSProperties };
}
