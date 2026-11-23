import React, {useEffect, useState} from 'react';
import {Box, Chip, LinearProgress, Stack, Typography} from '@mui/material';
import BattleTimer from './BattleTimer';
import {useCombatClock} from './CombatCharacter';
import {damageMultiplier} from './battleRules';
import {combatNumber} from './combatNumbers';
import {TypingBossSessionSnapshot} from './types';

export default function BattleStatus({session}: {session: TypingBossSessionSnapshot}) {
  const clock=useCombatClock(session.serverNow), [,tick]=useState(0);
  useEffect(()=>{
    if(session.status!=='active' || session.mode!=='proportional')return;
    const timer=setInterval(()=>tick(value=>value+1),250);
    return ()=>clearInterval(timer);
  },[session.status,session.mode]);
  const end=session.closedAt ? Date.parse(session.closedAt) : Date.now()+clock.current;
  const multiplier=damageMultiplier(session.countdownEndsAt,end);
  const team=session.teamHealth;
  return <Stack spacing={1} className="battle-status">
    <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap">
      <BattleTimer session={session}/>
      {session.mode==='proportional' && session.status!=='setup' && <Chip label={`Global damage ×${multiplier.toFixed(2)}`}
        title="Both sides gain ×0.01 damage every two battle seconds. Healing and shields are unchanged." sx={{fontWeight:900}}/>}
    </Stack>
    {session.teamMode && team && <Box sx={{p:1.5,border:'1px solid #22c55e',borderRadius:2,bgcolor:'#102b24'}}>
      <Typography fontWeight={900}>Team HP · {combatNumber(team.hp)} / {combatNumber(team.maxHp)}</Typography>
      <LinearProgress aria-label="Shared team HP" variant="determinate" value={team.maxHp>0?Math.max(0,Math.min(100,100*team.hp/team.maxHp)):0}
        sx={{height:12,borderRadius:1,mt:1,bgcolor:'#193e31','& .MuiLinearProgress-bar':{bgcolor:'#4ade80'}}}/>
    </Box>}
  </Stack>;
}
