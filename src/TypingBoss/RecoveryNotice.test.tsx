import React from 'react';
import {act,render,screen} from '@testing-library/react';
import RecoveryNotice from './RecoveryNotice';
import {TypingBossPlayer} from './types';
declare const test:any,expect:any,jest:any,afterEach:any;
afterEach(()=>jest.useRealTimers());

test('Second Wind shows accepted-word progress while the player remains able to type',()=>{
  const player={defeated:false,secondWindWordsRemaining:3} as TypingBossPlayer;
  const view=render(<RecoveryNotice player={player} active/>);
  expect(screen.getByRole('alert').textContent).toContain('75% attack damage');
  expect(screen.getByRole('alert').textContent).toContain('3 more words');
  view.rerender(<RecoveryNotice player={{...player,secondWindWordsRemaining:1}} active/>);
  expect(screen.getByRole('alert').textContent).toContain('1 more word');
  view.rerender(<RecoveryNotice player={player} active={false}/>);
  expect(screen.queryByRole('alert')).toBeNull();
});

test('the five-second protection notice uses the server clock and expires locally',()=>{
  jest.useFakeTimers();jest.setSystemTime(1000);
  const player={defeated:false,secondWindWordsRemaining:0,protectedUntil:15000} as TypingBossPlayer;
  render(<RecoveryNotice player={player} active serverNow={10000}/>);
  expect(screen.getByRole('alert').textContent).toContain('Protected for 5s');
  act(()=>jest.advanceTimersByTime(5000));
  expect(screen.queryByRole('alert')).toBeNull();
});
