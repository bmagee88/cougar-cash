import React from 'react';
import {Stack} from '@mui/material';
import {PageFrame,BattleMenu,BattleScene,PlayerTypingBattle} from './TypingBossApp';
import BattleStatus from './BattleStatus';
import {ContinuousTyping} from './ContinuousBattle';
import {createTypingState,initializeBalanced} from './proportionalRules';
import {TypingBossSessionSnapshot,TypingBossClassId} from './types';

// Development-only fixture: inspect the real live layout without credentials,
// network traffic, inactivity kicks, or changing any user's running battle.
export default function BattleLayoutPreview() {
  const options=new URLSearchParams(window.location.search);
  const count=Math.max(1,Math.min(30,Number(options.get('players')) || 12));
  const host=options.get('role')==='host',kraken=options.get('boss')==='kraken';
  const classes:TypingBossClassId[]=['paladin','cleric','barbarian','rogue','necromancer','monk'];
  const state=initializeBalanced(createTypingState(123,host?'dragon':'paladin'));
  state.combatDivisor=host?1:count;
  const session={id:'preview',mode:'proportional',status:'active',balanced:true,teamMode:true,
    teamHealth:{hp:count*80,maxHp:count*100},typing:state,
    boss:{id:kraken?'kraken':'infernalDragon',name:kraken?'Kraken':'Ancient Red Dragon',hp:count*70,maxHp:count*100,color:'#ef4444',glow:'#ef4444'},
    players:Array.from({length:count},(_,i)=>({code:`hero${i}`,name:`Hero ${i+1}`,classId:classes[i%classes.length],color:'#93c5fd',hp:count*80,maxHp:count*100,defeated:false,attackProgress:40})),
    projectiles:[],log:[],closedAt:null,timeLimitSeconds:null,
  } as unknown as TypingBossSessionSnapshot;
  return <PageFrame wide battle>
    <BattleMenu status="active"><a href="?players=30">30 players</a> · <a href="?players=3">3 players</a> · <a href="?role=host&players=30">Host</a> · <a href="?boss=kraken&players=30">Kraken</a></BattleMenu>
    <BattleStatus session={session}/>
    <Stack className="battle-session-stack">
      {host?<><BattleScene session={session}/><ContinuousTyping sessionId="preview" credentials={{}} state={state} active={false} hostProfile={{boss:session.boss,events:[]}}/></>:
        <PlayerTypingBattle session={session} me={session.players[0]} code="hero0" active={false}/>}
    </Stack>
  </PageFrame>;
}
