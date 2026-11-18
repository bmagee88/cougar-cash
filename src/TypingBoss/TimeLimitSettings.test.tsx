import React, {useState} from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react';
import TimeLimitSettings, {timeLimitSeconds} from './TimeLimitSettings';
import BattleTimer from './BattleTimer';
import {TypingBossSessionSnapshot} from './types';
import {startTypingBossSession} from './api';
declare const test:any, expect:any, jest:any, afterEach:any;
const originalFetch=global.fetch;
afterEach(() => {jest.useRealTimers();global.fetch=originalFetch;});

test.each([undefined,null,180,270,420])('starting a battle sends the chosen time limit: %s',async(duration:number|null|undefined)=>{
  const fetch=jest.fn(async()=>({ok:true,headers:{get:()=> 'application/json'},text:async()=>JSON.stringify({session:{balanced:false,timeLimitSeconds:duration===undefined?300:duration}})}));
  global.fetch=fetch as any;
  await startTypingBossSession('bossABC','host',1,undefined,undefined,false,true,true,duration);
  expect(JSON.parse(fetch.mock.calls[0][1].body).timeLimitSeconds).toBe(duration===undefined?300:duration);
});

test('host can choose every preset, unlimited, and a validated custom duration', () => {
  function Harness() {
    const [preset,setPreset]=useState('300'),[custom,setCustom]=useState('10');
    return <><TimeLimitSettings preset={preset} customMinutes={custom} onPresetChange={setPreset} onCustomChange={setCustom} disabled={false}/>
      <output aria-label="Selected seconds">{String(timeLimitSeconds(preset,custom))}</output></>;
  }
  render(<Harness/>);
  expect(screen.getByLabelText('Selected seconds').textContent).toBe('300');
  for (const [value,expected] of [['180','180'],['420','420'],['unlimited','null'],['custom','600']]) {
    fireEvent.change(screen.getByLabelText('Time limit'),{target:{value}});
    expect(screen.getByLabelText('Selected seconds').textContent).toBe(expected);
  }
  fireEvent.change(screen.getByLabelText('Custom time (minutes)'),{target:{value:'4.5'}});
  expect(screen.getByLabelText('Selected seconds').textContent).toBe('270');
  fireEvent.change(screen.getByLabelText('Custom time (minutes)'),{target:{value:''}});
  expect(screen.getByText('Enter a time from 1 to 120 minutes.')).toBeTruthy();
});

test('timer preserves the opening countdown and resumes from the server deadline after reconnect', () => {
  jest.useFakeTimers();jest.setSystemTime(50000);
  const session={status:'active',serverNow:1000,countdownEndsAt:6000,battleEndsAt:306000,timeLimitSeconds:300} as TypingBossSessionSnapshot;
  const view=render(<BattleTimer session={session}/>);
  expect(screen.getByLabelText('Time left: 5:00')).toBeTruthy();
  act(()=>jest.advanceTimersByTime(6000));
  expect(screen.getByLabelText('Time left: 4:59')).toBeTruthy();
  view.rerender(<BattleTimer session={{...session,serverNow:106000}}/>);
  expect(screen.getByLabelText('Time left: 3:20')).toBeTruthy();
  view.rerender(<BattleTimer session={{...session,status:'draw'}}/>);
  expect(screen.queryByLabelText(/Time left/)).toBeNull();
  view.rerender(<BattleTimer session={{...session,battleEndsAt:null,timeLimitSeconds:null}}/>);
  expect(screen.getByLabelText('Time limit: Unlimited')).toBeTruthy();
});
