import React from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import InactivityWarning,{useTypingActivity} from './InactivityWarning';
import {submitTypingBossActivity} from './api';
import {applySessionPatch} from './sessionPatch';
import {TypingBossPlayer,TypingBossSessionSnapshot} from './types';
declare const test:any,expect:any,jest:any,afterEach:any;
jest.mock('./api');
afterEach(()=>jest.useRealTimers());
test('no notice until ten seconds; typing clears the warning immediately without a network update',()=>{
  jest.useFakeTimers();jest.setSystemTime(1000);
  const player={code:'hero',lastTypingAt:1000} as TypingBossPlayer;
  render(<InactivityWarning sessionId="room" player={player} active countdownEndsAt={1000} serverNow={1000}/>);
  expect(screen.queryByRole('alert')).toBeNull();
  act(()=>jest.advanceTimersByTime(9999));expect(screen.queryByRole('alert')).toBeNull();
  act(()=>jest.advanceTimersByTime(251));expect(screen.getByRole('alert').textContent).toContain('retreats in 20s');
  act(()=>window.dispatchEvent(new CustomEvent('typing-boss-human-typing',{detail:{sessionId:'room',code:'hero'}})));
  expect(screen.queryByRole('alert')).toBeNull();
});
test('roster patches remove kicked players without removing surviving players',()=>{
  const session={players:[{code:'a'},{code:'b'}],projectiles:[]} as TypingBossSessionSnapshot;
  const next=applySessionPatch(session,{removePlayers:['a'],players:[{code:'b',hp:100}]});
  expect(next.players.map(player=>player.code)).toEqual(['b']);expect(next.players[0].hp).toBe(100);
});
test('returning input sends activity immediately and sustained typing is throttled',()=>{
  jest.useFakeTimers();jest.setSystemTime(10000);
  (submitTypingBossActivity as any).mockClear();
  function Harness(){const activity=useTypingActivity('room',{code:'hero',playerToken:'private'},true);return <input onKeyDown={activity}/>;}
  render(<Harness/>);
  fireEvent.keyDown(screen.getByRole('textbox'),{key:'a'});
  expect(submitTypingBossActivity).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(screen.getByRole('textbox'),{key:'b'});
  fireEvent.keyDown(screen.getByRole('textbox'),{key:'c'});
  expect(submitTypingBossActivity).toHaveBeenCalledTimes(1);
  act(()=>jest.advanceTimersByTime(500));
  expect(submitTypingBossActivity).toHaveBeenCalledTimes(2);
});
test('retreat notice explains the player is out for the battle',()=>{
  const player={code:'hero',timedOut:true} as TypingBossPlayer;
  const view=render(<InactivityWarning sessionId="room" player={player} active countdownEndsAt={Date.now()}/>);
  expect(screen.getByRole('alert').textContent).toContain('out for this battle');
  view.rerender(<InactivityWarning sessionId="room" player={{...player,timedOut:false,lastTypingAt:Date.now()}} active/>);
  expect(screen.queryByRole('alert')).toBeNull();
});
