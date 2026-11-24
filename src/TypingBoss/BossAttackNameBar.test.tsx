import React from 'react';
import {act,render,screen} from '@testing-library/react';
import BossAttackNameBar from './BossAttackNameBar';
import {TypingBossProjectile,TypingBossSessionSnapshot} from './types';
declare const test:any,expect:any,jest:any,beforeEach:any,afterEach:any;
beforeEach(()=>{jest.useFakeTimers('modern');jest.setSystemTime(1000);});
afterEach(()=>jest.useRealTimers());
const shot=(extra:Partial<TypingBossProjectile>={})=>({id:'bite',source:'boss',target:'hero',kind:'boss',moveLabel:'Bite',startedAt:1000,impactAt:1700,resolvedAt:null,result:'pending',amount:null,...extra} as TypingBossProjectile);
const room=(projectiles:TypingBossProjectile[])=>({status:'active',projectiles} as TypingBossSessionSnapshot);

test('announces an attack on release, lasts four seconds and expires without another snapshot',()=>{
  render(<BossAttackNameBar session={room([shot()])}/>);
  expect(screen.getByRole('status').textContent).toBe('Bite');
  act(()=>jest.advanceTimersByTime(3999));expect(screen.getByRole('status')).toBeTruthy();
  act(()=>jest.advanceTimersByTime(1));expect(screen.queryByRole('status')).toBeNull();
});

test('a volley and its hit updates share the original four-second deadline',()=>{
  const shots=[shot(),shot({id:'bite-2',target:'hero2'})],view=render(<BossAttackNameBar session={room(shots)}/>);
  const bar=screen.getByRole('status'),delay=bar.style.animationDelay;
  act(()=>jest.advanceTimersByTime(2000));
  view.rerender(<BossAttackNameBar session={room(shots.map(shot=>({...shot,result:'hit',resolvedAt:1700,amount:10})))}/>);
  expect(screen.getAllByRole('status')).toHaveLength(1);expect(screen.getByRole('status')).toBe(bar);expect(bar.style.animationDelay).toBe(delay);
  act(()=>jest.advanceTimersByTime(2000));expect(screen.queryByRole('status')).toBeNull();
});

test('a future attack replaces the current name at its animation start and gets its own four seconds',()=>{
  render(<BossAttackNameBar session={room([shot(),shot({id:'flame',moveLabel:'Flamethrower',animationStartedAt:2500,startedAt:3500})])}/>);
  expect(screen.getByRole('status').textContent).toBe('Bite');
  act(()=>jest.advanceTimersByTime(1500));expect(screen.getByRole('status').textContent).toBe('Flamethrower');
  act(()=>jest.advanceTimersByTime(3999));expect(screen.getByRole('status')).toBeTruthy();
  act(()=>jest.advanceTimersByTime(1));expect(screen.queryByRole('status')).toBeNull();
});

test('reconnect resumes remaining display time, ignores player attacks, and clears for a rematch',()=>{
  jest.setSystemTime(3500);
  const session=room([shot(),shot({id:'hero-hit',source:'hero',target:'boss',kind:'damage',startedAt:3400,moveLabel:'Quick Attack'})]);
  const view=render(<BossAttackNameBar session={session}/>);
  expect(screen.getByRole('status').textContent).toBe('Bite');expect(screen.getByRole('status').style.animationDelay).toBe('-2500ms');
  act(()=>jest.advanceTimersByTime(1500));expect(screen.queryByRole('status')).toBeNull();
  view.rerender(<BossAttackNameBar session={{...session,status:'setup',projectiles:[shot({startedAt:5000})]}}/>);
  expect(screen.queryByRole('status')).toBeNull();
});
