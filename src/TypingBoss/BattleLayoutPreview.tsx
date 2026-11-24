import React, {useState} from 'react';
import {Stack} from '@mui/material';
import {PageFrame,BattleMenu,BattleScene,PlayerTypingBattle,BattleOutcomeModal,BattleStatsModal} from './TypingBossApp';
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
  const [endingAt]=useState(()=>Date.now()-(Number(options.get('elapsed')) || 0));
  const [statsOpen,setStatsOpen]=useState(false),[outcomeDismissed,setOutcomeDismissed]=useState(false);
  const classes:TypingBossClassId[]=['paladin','cleric','barbarian','rogue','necromancer','monk'];
  const state=initializeBalanced(createTypingState(123,host?'dragon':'paladin'));
  state.combatDivisor=host?1:count;
  const session={id:'preview',mode:'proportional',status:'active',balanced:true,teamMode:true,
    teamHealth:{hp:count*80,maxHp:count*100},typing:state,
    boss:{id:kraken?'kraken':'infernalDragon',name:kraken?'Kraken':'Ancient Red Dragon',hp:count*70,maxHp:count*100,color:'#ef4444',glow:'#ef4444'},
    players:Array.from({length:count},(_,i)=>({code:`hero${i}`,name:`Hero ${i+1}`,classId:classes[i%classes.length],color:'#93c5fd',hp:count*80,maxHp:count*100,defeated:false,attackProgress:40,totalDamage:0,totalTaken:0})),
    projectiles:[],log:[],closedAt:null,timeLimitSeconds:null,
  } as unknown as TypingBossSessionSnapshot;
  const attack=options.get('attack') as 'bite'|'fireball'|'tailWhip'|'flamethrower'|null;
  const attackLabels={bite:'Bite',fireball:'Fireball',tailWhip:'Tail Whip',flamethrower:'Flamethrower'};
  if(attack && attackLabels[attack])session.projectiles=[{id:'preview-attack',source:'boss',target:'hero0',kind:'boss',bossAttack:attack,
    moveLabel:attackLabels[attack],startedAt:endingAt,impactAt:endingAt+700,resolvedAt:null,result:'pending',amount:null}];
  if (!kraken && options.get('ending')) {
    session.status=options.get('ending')==='collapse'?'victory':'defeat';
    session.closedAt=new Date(endingAt).toISOString();
    if(session.status==='victory')session.boss.hp=0;
    else {session.teamHealth!.hp=0;session.players.forEach(player=>{player.hp=0;player.defeated=true;});}
  }
  return <PageFrame wide battle>
    <BattleMenu status="active"><a href="?players=30">30 players</a> · <a href="?players=3">3 players</a> · <a href="?role=host&players=30">Host</a> · <a href="?boss=kraken&players=30">Kraken</a></BattleMenu>
    <BattleStatus session={session}/>
    <Stack className="battle-session-stack">
      {host?<><BattleScene session={session}/><ContinuousTyping sessionId="preview" credentials={{}} state={state} active={false} hostProfile={{boss:session.boss,events:[]}}/></>:
        <PlayerTypingBattle session={session} me={session.players[0]} code="hero0" active={false}/>}
    </Stack>
    {options.has('results') && <>
      <BattleStatsModal open={statsOpen} session={session} onClose={()=>setStatsOpen(false)}/>
      <BattleOutcomeModal open={['victory','defeat','draw'].includes(session.status) && !statsOpen && !outcomeDismissed} session={session}
        onClose={()=>setOutcomeDismissed(true)} onStats={()=>{setOutcomeDismissed(true);setStatsOpen(true);}}/>
    </>}
  </PageFrame>;
}
