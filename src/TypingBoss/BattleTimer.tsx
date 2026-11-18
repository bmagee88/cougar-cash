import React from 'react';
import {Chip} from '@mui/material';
import {useBattleCountdown} from './BattleCountdown';
import {TypingBossSessionSnapshot} from './types';

export default function BattleTimer({session}: {session: TypingBossSessionSnapshot}) {
  const seconds = useBattleCountdown(session.status === 'active' ? session.battleEndsAt : null, session.serverNow);
  const starting = useBattleCountdown(session.status === 'active' ? session.countdownEndsAt : null, session.serverNow);
  if (session.status !== 'active') return null;
  const remaining = starting ? session.timeLimitSeconds ?? seconds : seconds;
  const label = !session.battleEndsAt ? 'Time limit: Unlimited' :
    `Time left: ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  return <Chip aria-label={label} label={label} color={session.battleEndsAt && remaining <= 30 ? 'warning' : 'default'}
    sx={{alignSelf: 'center', fontWeight: 900, fontVariantNumeric: 'tabular-nums'}} />;
}
