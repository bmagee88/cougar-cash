import React from 'react';
import {Alert} from '@mui/material';
import {useBattleCountdown} from './BattleCountdown';
import {TypingBossPlayer} from './types';

export default function RecoveryNotice({player, active, serverNow}:{player:TypingBossPlayer;active:boolean;serverNow?:number}) {
  const protection=useBattleCountdown(active?player.protectedUntil:null,serverNow);
  if(!active || player.timedOut)return null;
  if((player.secondWindWordsRemaining || 0)>0)return <Alert severity="info">
    Second Wind · Keep typing at 75% attack damage. Complete {player.secondWindWordsRemaining} more {player.secondWindWordsRemaining===1?'word':'words'} to return with 40% HP.
  </Alert>;
  if(protection>0)return <Alert severity="success">Second Wind restored · Protected for {protection}s.</Alert>;
  return null;
}
