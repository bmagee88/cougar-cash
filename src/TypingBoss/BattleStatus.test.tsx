import React from 'react';
import {act,render,screen} from '@testing-library/react';
import BattleStatus from './BattleStatus';
import {TypingBossSessionSnapshot} from './types';
declare const test:any,expect:any,jest:any,afterEach:any;
afterEach(()=>jest.useRealTimers());

test('shared team HP is shown once and damage increases after the opening countdown',()=>{
  jest.useFakeTimers();jest.setSystemTime(50000);
  const session={mode:'proportional',status:'active',serverNow:1000,countdownEndsAt:6000,
    teamMode:true,teamHealth:{hp:70,maxHp:100},timeLimitSeconds:null} as TypingBossSessionSnapshot;
  const view=render(<BattleStatus session={session}/>);
  expect(screen.getByText('Global damage ×1.00')).toBeTruthy();
  expect(screen.getAllByRole('progressbar',{name:'Shared team HP'})).toHaveLength(1);
  expect(screen.getByText('Team HP · 7,000 / 10,000')).toBeTruthy();
  act(()=>jest.advanceTimersByTime(65000));
  expect(screen.getByText('Global damage ×1.30')).toBeTruthy();
  view.rerender(<BattleStatus session={{...session,teamMode:false,teamHealth:null}}/>);
  expect(screen.queryByRole('progressbar')).toBeNull();
});
