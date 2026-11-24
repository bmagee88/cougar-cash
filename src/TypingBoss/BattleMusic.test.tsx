import React from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import BattleMusic from './BattleMusic';
import {TypingBossSessionSnapshot} from './types';
declare const test:any,expect:any,jest:any,beforeEach:any,afterEach:any;
const OriginalAudio=global.Audio;
let media:any[];
beforeEach(()=>{
  jest.useFakeTimers('modern');jest.setSystemTime(1000);media=[];
  global.Audio=jest.fn((src:string)=>{
    const element:any={src,paused:true,currentTime:0,duration:180,muted:false,addEventListener:jest.fn(),removeEventListener:jest.fn(),removeAttribute:jest.fn(),load:jest.fn()};
    element.play=jest.fn(()=>{element.paused=false;return Promise.resolve();});
    element.pause=jest.fn(()=>{element.paused=true;});
    media.push(element);return element;
  }) as any;
});
afterEach(()=>{global.Audio=OriginalAudio;jest.useRealTimers();});
function room(extra:Partial<TypingBossSessionSnapshot>={}):TypingBossSessionSnapshot {
  return {id:'bossABC',status:'setup',networkMode:'lan',serverNow:1000,boss:{id:'infernalDragon'},...extra} as TypingBossSessionSnapshot;
}
test.each([true,false])('LAN starts with the countdown only for the host (host=%s)',async(host:boolean)=>{
  const session=room(),view=render(<BattleMusic session={session} host={host}/>);
  expect(media[0].play).not.toHaveBeenCalled();
  await act(async()=>view.rerender(<BattleMusic session={{...session,status:'active',countdownEndsAt:6000}} host={host}/>));
  expect(media[0].play.mock.calls.length).toBe(host?1:0);
  if(host){expect(media[0].currentTime).toBe(0);expect(media[0].src).toContain('dragons-roar.mp3');}
});
test('WAN plays Kraken music on a student device, catches up on reconnect, and never restarts on snapshots',async()=>{
  let session=room({status:'active',networkMode:'wan',countdownEndsAt:6000,serverNow:9000,boss:{id:'kraken'} as any});
  let view:any;await act(async()=>{view=render(<BattleMusic session={session} host={false}/>);});
  expect(media[0].src).toContain('leviathans-roar.mp3');expect(media[0].currentTime).toBe(8);
  await act(async()=>view.rerender(<BattleMusic session={{...session,revision:2,serverNow:9200}} host={false}/>));
  expect(media).toHaveLength(1);expect(media[0].play).toHaveBeenCalledTimes(1);
  await act(async()=>view.rerender(<BattleMusic session={{...session,status:'defeat'}} host={false}/>));
  expect(media[0].paused).toBe(true);
  await act(async()=>view.rerender(<BattleMusic session={{...session,status:'setup',countdownEndsAt:null}} host={false}/>));
  await act(async()=>view.rerender(<BattleMusic session={{...session,countdownEndsAt:14000}} host={false}/>));
  expect(media[0].play).toHaveBeenCalledTimes(2);expect(media[0].currentTime).toBe(0);
});
test('autoplay rejection offers a gesture retry at the current room time',async()=>{
  const view=render(<BattleMusic session={room()} host={false}/>);
  media[0].play.mockRejectedValueOnce(new Error('Autoplay blocked'));
  await act(async()=>view.rerender(<BattleMusic session={room({status:'active',networkMode:'wan',countdownEndsAt:6000})} host={false}/>));
  expect(screen.getByRole('button',{name:'Enable battle music'})).toBeTruthy();
  act(()=>jest.advanceTimersByTime(2200));
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Enable battle music'})));
  expect(media[0].currentTime).toBe(2.2);expect(screen.queryByRole('button')).toBeNull();
});
