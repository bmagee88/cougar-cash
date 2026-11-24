import React,{useState} from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import {BattleOutcomeModal,BattleStatsModal} from './TypingBossApp';
import {TypingBossSessionSnapshot} from './types';
declare const test:any,expect:any,jest:any,beforeEach:any,afterEach:any;
jest.mock('react-router-dom',()=>({Link:'a'}),{virtual:true});
beforeEach(()=>{jest.useFakeTimers('modern');jest.setSystemTime(1000);});
afterEach(()=>jest.useRealTimers());
const victory=()=>({id:'bossABC',status:'victory',mode:'proportional',closedAt:new Date(1000).toISOString(),
  boss:{id:'infernalDragon',name:'Dragon',hp:0,maxHp:100},players:[],projectiles:[],leaderboard:[]} as unknown as TypingBossSessionSnapshot);

function Results({session}:{session:TypingBossSessionSnapshot}) {
  const [stats,setStats]=useState(false),[dismissed,setDismissed]=useState(false);
  return <>
    <BattleStatsModal open={stats} session={session} onClose={()=>setStats(false)}/>
    <BattleOutcomeModal open={['victory','defeat','draw'].includes(session.status) && !stats && !dismissed} session={session}
      onClose={()=>setDismissed(true)} onStats={()=>{setDismissed(true);setStats(true);}}/>
  </>;
}

test('victory opens the actual stats screen at four seconds without a results prompt',()=>{
  const session=victory(),view=render(<Results session={session}/>);
  expect(screen.queryByRole('dialog')).toBeNull();
  act(()=>jest.advanceTimersByTime(2000));view.rerender(<Results session={{...session,revision:2,serverNow:3000}}/>);
  act(()=>jest.advanceTimersByTime(1999));expect(screen.queryByRole('dialog')).toBeNull();
  act(()=>jest.advanceTimersByTime(1));
  expect(screen.getByRole('dialog',{name:'Proportional Battle Stats'})).toBeTruthy();
  expect(screen.queryByRole('dialog',{name:'VICTORY'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Close'}));act(()=>jest.advanceTimersByTime(5000));
  view.rerender(<Results session={{...session,revision:3,serverNow:10000}}/>);
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('a late reconnect opens stats immediately and rematching cancels the pending popup',()=>{
  jest.setSystemTime(7000);const session=victory();
  const view=render(<Results session={session}/>);
  expect(screen.getByRole('dialog',{name:'Proportional Battle Stats'})).toBeTruthy();
  view.unmount();jest.setSystemTime(1000);
  const next=render(<Results session={session}/>);
  act(()=>jest.advanceTimersByTime(2000));
  next.rerender(<Results session={{...session,status:'setup',closedAt:null}}/>);
  act(()=>jest.advanceTimersByTime(4000));expect(screen.queryByRole('dialog')).toBeNull();
});
