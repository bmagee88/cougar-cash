import {useEffect,useState} from 'react';
import {useCombatClock} from './CombatCharacter';
import {TypingBossSessionSnapshot} from './types';
import {partyVictoryAt,VICTORY_CELEBRATION_MS} from './victoryAnimation';

export default function useVictoryCelebration(session:TypingBossSessionSnapshot) {
  const clock=useCombatClock(session.serverNow),[,redraw]=useState(0);
  const at=partyVictoryAt(session),deadline=at===undefined?undefined:at+VICTORY_CELEBRATION_MS;
  useEffect(()=>{
    if(deadline===undefined || deadline<=Date.now()+clock.current)return;
    let timer:ReturnType<typeof setTimeout>;
    const check=()=>{
      const remaining=deadline-Date.now()-clock.current;
      if(remaining>0)timer=setTimeout(check,remaining);
      else redraw(value=>value+1);
    };
    timer=setTimeout(check,deadline-Date.now()-clock.current);
    return ()=>clearTimeout(timer);
  },[deadline,clock]);
  return deadline!==undefined && Date.now()+clock.current<deadline;
}
