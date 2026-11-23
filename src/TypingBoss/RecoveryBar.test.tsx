import React from 'react';
import {render,screen} from '@testing-library/react';
import RecoveryBar from './RecoveryBar';
import {TypingBossPlayer} from './types';
declare const test:any,expect:any;
test('Second Wind bar advances by completed words and disappears on recovery',()=>{
  const player={name:'Hero',defeated:false,secondWindWordsRemaining:3} as TypingBossPlayer,clock={current:0};
  const view=render(<RecoveryBar player={player} clock={clock}/>);
  expect(screen.getByRole('progressbar',{name:'Hero Second Wind'}).getAttribute('aria-valuenow')).toBe('0');
  view.rerender(<RecoveryBar player={{...player,secondWindWordsRemaining:1}} clock={clock}/>);
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('2');
  view.rerender(<RecoveryBar player={{...player,secondWindWordsRemaining:0}} clock={clock}/>);
  expect(screen.queryByRole('progressbar')).toBeNull();
});
