import React from 'react';
import {TypingBossPlayer} from './types';
import {SECOND_WIND_WORDS} from './battleRules';

export default function RecoveryBar({player,profile=false}:{player:TypingBossPlayer;clock:React.MutableRefObject<number>;profile?:boolean}) {
  const remaining=player.secondWindWordsRemaining || 0;
  if(!remaining)return null;
  const completed=SECOND_WIND_WORDS-remaining;
  return <div role="progressbar" aria-label={`${player.name} Second Wind`} aria-valuemin={0} aria-valuemax={SECOND_WIND_WORDS}
    aria-valuenow={completed} aria-valuetext={`${remaining} words to recover`}
    style={{position:profile?'relative':'absolute',bottom:profile?undefined:'calc(100% + 5px)',left:profile?undefined:'50%',transform:profile?undefined:'translateX(-50%)',width:'100%',maxWidth:profile?undefined:72,height:7,
      background:'#142033',border:'1px solid #86efac',borderRadius:4,overflow:'hidden',zIndex:6}}>
    <div style={{width:`${completed/SECOND_WIND_WORDS*100}%`,height:'100%',background:'#86efac'}}/>
  </div>;
}
