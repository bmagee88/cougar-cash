import React from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import BattleCountdown from './BattleCountdown';
import {ContinuousTyping} from './ContinuousBattle';
import {createTypingState,typingWord} from './proportionalRules';
import {TypingBossSessionSnapshot} from './types';
declare const test:any,expect:any,jest:any,afterEach:any;
afterEach(()=>jest.useRealTimers());
test('host and player share 5,4,3,2,1 and unblock typing together without another network update',()=>{
  jest.useFakeTimers('modern');jest.setSystemTime(1000);
  const session={status:'active',serverNow:1000,countdownEndsAt:6000} as TypingBossSessionSnapshot;
  const state=createTypingState(123);
  render(<><BattleCountdown session={session}/><BattleCountdown session={session}/>
    <ContinuousTyping sessionId="bossABC" credentials={{code:'hero'}} state={state} active countdownEndsAt={6000} serverNow={1000}/></>);
  const input=screen.getByRole('textbox') as HTMLInputElement;
  expect(input.disabled).toBe(true);
  fireEvent.keyDown(input,{key:typingWord(state).text[0]});
  expect(screen.queryByTestId('word-reward')).toBeNull();
  for(let second=5;second>=1;second--) {
    expect(screen.getAllByLabelText(`Battle starts in ${second} seconds`)).toHaveLength(2);
    expect(input.disabled).toBe(true);
    act(()=>jest.advanceTimersByTime(1000));
  }
  expect(screen.queryAllByRole('status')).toHaveLength(0);expect(input.disabled).toBe(false);
});
test('late join/reconnect resumes the remaining server countdown, and closed games remove it',()=>{
  jest.useFakeTimers('modern');jest.setSystemTime(50000);
  const session={status:'active',serverNow:3000,countdownEndsAt:6000} as TypingBossSessionSnapshot;
  const view=render(<BattleCountdown session={session}/>);
  expect(screen.getByLabelText('Battle starts in 3 seconds')).toBeTruthy();
  view.rerender(<BattleCountdown session={{...session,status:'closed'}}/>);
  expect(screen.queryByRole('status')).toBeNull();expect(jest.getTimerCount()).toBe(0);
});
