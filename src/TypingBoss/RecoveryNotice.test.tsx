import React from 'react';
import {act,render,screen} from '@testing-library/react';
import RecoveryNotice from './RecoveryNotice';
import {TypingBossPlayer} from './types';
declare const test:any,expect:any,jest:any,afterEach:any;
afterEach(()=>jest.useRealTimers());
test('recovery countdown uses the server clock and disappears on early revival or room closure',()=>{
  jest.useFakeTimers();jest.setSystemTime(1000);
  const player={defeated:true,recoverAt:25000} as TypingBossPlayer;
  const view=render(<RecoveryNotice player={player} active serverNow={10000}/>);
  expect(screen.getByText(/in 15 seconds/)).toBeTruthy();
  act(()=>jest.advanceTimersByTime(5000));
  expect(screen.getByText(/in 10 seconds/)).toBeTruthy();
  view.rerender(<RecoveryNotice player={{...player,defeated:false,recoverAt:null}} active serverNow={15000}/>);
  expect(screen.queryByRole('alert')).toBeNull();
  view.rerender(<RecoveryNotice player={player} active={false} serverNow={15000}/>);
  expect(screen.queryByRole('alert')).toBeNull();
});

test('each fallen player shows their own immediately running countdown',()=>{
  jest.useFakeTimers();jest.setSystemTime(1000);
  const a={defeated:true,recoverAt:29000} as TypingBossPlayer;
  const b={defeated:true,recoverAt:32000} as TypingBossPlayer;
  render(<><RecoveryNotice player={a} active serverNow={10000}/><RecoveryNotice player={b} active serverNow={10000}/></>);
  expect(screen.getByText(/Recovering at 100 HP in 19 seconds/)).toBeTruthy();
  expect(screen.getByText(/Recovering at 100 HP in 22 seconds/)).toBeTruthy();
  act(()=>jest.advanceTimersByTime(5000));
  expect(screen.getByText(/Recovering at 100 HP in 14 seconds/)).toBeTruthy();
  expect(screen.getByText(/Recovering at 100 HP in 17 seconds/)).toBeTruthy();
});
