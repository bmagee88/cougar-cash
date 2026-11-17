import React from 'react';
import {Alert} from '@mui/material';
import {useBattleCountdown} from './BattleCountdown';
import {TypingBossPlayer} from './types';

export default function RecoveryNotice({player, active, serverNow}:{player:TypingBossPlayer;active:boolean;serverNow?:number}) {
  const seconds=useBattleCountdown(player.recoverAt,serverNow);
  if(!active || !player.defeated)return null;
  if(!player.recoverAt)return <Alert severity="info">Knocked out. Auto revive is off. A Necromancer can revive you.</Alert>;
  return <Alert severity="info">Knocked out. Recovering at 100 HP in {seconds} seconds. A Necromancer may revive you sooner.</Alert>;
}
