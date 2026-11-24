import React from 'react';
import {act,render,screen,waitFor} from '@testing-library/react';
import CombatCharacter from './CombatCharacter';
import useVictoryCelebration from './useVictoryCelebration';
import {playerVictoryPose,VICTORY_CELEBRATION_MS} from './victoryAnimation';
import {TypingBossPlayer,TypingBossSessionSnapshot} from './types';
declare const test:any,expect:any,jest:any,beforeEach:any,afterEach:any;
let NativeImage:typeof Image;
beforeEach(()=>{
  jest.useFakeTimers('modern');jest.setSystemTime(1000);NativeImage=window.Image;
  window.Image=function(){const image:any={};Object.defineProperty(image,'src',{set:()=>image.onload?.()});return image;} as any;
});
afterEach(()=>{window.Image=NativeImage;jest.useRealTimers();});

function Results({session}:{session:TypingBossSessionSnapshot}) {
  return <div>{useVictoryCelebration(session)?'Celebrating':'Show results'}</div>;
}
test('results wait exactly four seconds, without extending it on snapshots or reconnect',()=>{
  const session={status:'victory',closedAt:new Date(1000).toISOString()} as TypingBossSessionSnapshot;
  const view=render(<Results session={session}/>);
  expect(screen.getByText('Celebrating')).toBeTruthy();
  act(()=>jest.advanceTimersByTime(2000));view.rerender(<Results session={{...session,serverNow:3000}}/>);
  act(()=>jest.advanceTimersByTime(VICTORY_CELEBRATION_MS-2000-1));expect(screen.getByText('Celebrating')).toBeTruthy();
  act(()=>jest.advanceTimersByTime(1));
  expect(screen.getByText('Show results')).toBeTruthy();
  view.unmount();render(<Results session={session}/>);expect(screen.getByText('Show results')).toBeTruthy();
});

test('defeat, draw and rematch cancel a pending player celebration',()=>{
  const session={status:'victory',closedAt:new Date(1000).toISOString()} as TypingBossSessionSnapshot;
  const view=render(<Results session={session}/>);
  for(const status of ['defeat','draw','setup'] as const){view.rerender(<Results session={{...session,status}}/>);expect(screen.getByText('Show results')).toBeTruthy();}
  expect(jest.getTimerCount()).toBe(0);
});

test('victory jumps retain their phase on snapshots and catch up after a late load',async()=>{
  const player={code:'hero',classId:'rogue',hp:100,defeated:false} as TypingBossPlayer;
  const pose=playerVictoryPose(player,500)!;
  const view=render(<CombatCharacter classId="rogue" color="#fff" pose={pose}/>);
  await waitFor(()=>expect(screen.getByTestId('combat-character').getAttribute('data-sprite-state')).toBe('victory'));
  const body=view.container.querySelector('.actor-body') as HTMLElement,frames=view.container.querySelector('.actor-frames') as HTMLElement;
  const delay=body.style.animationDelay;
  expect(delay).toBe(`${-(Date.now()-pose.at)}ms`);expect(frames.style.animationIterationCount).toBe('infinite');
  act(()=>jest.advanceTimersByTime(400));view.rerender(<CombatCharacter classId="rogue" color="#fff" pose={{...pose}}/>);
  expect(view.container.querySelector('.actor-body')).toBe(body);expect(body.style.animationDelay).toBe(delay);
  view.unmount();jest.setSystemTime(7000);
  render(<CombatCharacter classId="rogue" color="#fff" pose={pose}/>);
  expect((document.querySelector('.actor-body') as HTMLElement).style.animationDelay).toBe('-6500ms');
});
