import React from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import BattleMusic,{MUSIC_VOLUME,MUSIC_FADE_MS,ENDING_MUSIC} from './BattleMusic';
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
  await act(async()=>view.rerender(<BattleMusic session={{...session,status:'closed'}} host={false}/>));
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

test.each(['infernalDragon','kraken'])('boss victory fades %s battle music, then plays Final Bow once without resetting on snapshots',async(bossId:string)=>{
  const session=room({status:'active',countdownEndsAt:6000,boss:{id:bossId} as any});
  const view=render(<BattleMusic session={session} host/>),element=media[0];
  const result={...session,status:'defeat' as const,closedAt:new Date(1000).toISOString()};
  await act(async()=>view.rerender(<BattleMusic session={result} host/>));
  expect(element.paused).toBe(false);expect(element.volume).toBe(MUSIC_VOLUME);
  act(()=>jest.advanceTimersByTime(MUSIC_FADE_MS/2));expect(element.volume).toBeCloseTo(MUSIC_VOLUME/2);
  await act(async()=>view.rerender(<BattleMusic session={{...result,revision:2,serverNow:2500}} host/>));
  await act(async()=>jest.advanceTimersByTime(MUSIC_FADE_MS/2));
  expect(element.src).toContain('the-final-bow.mp3');expect(element.loop).toBe(false);
  expect(element.volume).toBe(MUSIC_VOLUME);expect(element.currentTime).toBe(0);expect(element.play).toHaveBeenCalledTimes(2);
  await act(async()=>view.rerender(<BattleMusic session={{...result,revision:3,serverNow:4000}} host/>));
  expect(element.play).toHaveBeenCalledTimes(2);expect(media).toHaveLength(1);
});

test('player victory fades to the empty music slot, and a rematch restores the battle track and volume',async()=>{
  const session=room({status:'active',countdownEndsAt:6000}),view=render(<BattleMusic session={session} host/>),element=media[0];
  await act(async()=>view.rerender(<BattleMusic session={{...session,status:'victory',closedAt:new Date(1000).toISOString()}} host/>));
  act(()=>jest.advanceTimersByTime(1500));expect(element.volume).toBeCloseTo(MUSIC_VOLUME/2);
  await act(async()=>jest.advanceTimersByTime(1500));
  expect(ENDING_MUSIC.victory).toBeNull();expect(element.paused).toBe(true);expect(element.volume).toBe(0);
  expect(element.src).toContain('dragons-roar.mp3');expect(element.play).toHaveBeenCalledTimes(1);
  await act(async()=>view.rerender(<BattleMusic session={{...session,status:'setup',countdownEndsAt:null,closedAt:null}} host/>));
  expect(element.volume).toBe(MUSIC_VOLUME);expect(element.currentTime).toBe(0);
  await act(async()=>view.rerender(<BattleMusic session={{...session,countdownEndsAt:9000,serverNow:4000}} host/>));
  expect(element.paused).toBe(false);expect(element.loop).toBe(true);expect(element.play).toHaveBeenCalledTimes(2);
});

test.each([['wan',false,true],['lan',true,true],['lan',false,false]])('ending music preserves %s playback policy for host=%s',async(networkMode:any,host:boolean,plays:boolean)=>{
  await act(async()=>{render(<BattleMusic session={room({status:'defeat',networkMode,countdownEndsAt:6000,serverNow:9000,closedAt:new Date(1000).toISOString()})} host={host}/>);});
  expect(media[0].play.mock.calls.length).toBe(plays?1:0);
  if(plays){expect(media[0].src).toContain('the-final-bow.mp3');expect(media[0].currentTime).toBe(5);}
});

test('leaving or rematching during the fade cancels the ending transition',async()=>{
  const session=room({status:'active',countdownEndsAt:6000}),view=render(<BattleMusic session={session} host/>),element=media[0];
  await act(async()=>view.rerender(<BattleMusic session={{...session,status:'defeat',closedAt:new Date(1000).toISOString()}} host/>));
  act(()=>jest.advanceTimersByTime(1000));
  await act(async()=>view.rerender(<BattleMusic session={{...session,status:'setup',countdownEndsAt:null}} host/>));
  act(()=>jest.advanceTimersByTime(4000));expect(element.src).toContain('dragons-roar.mp3');expect(element.paused).toBe(true);
  view.unmount();expect(jest.getTimerCount()).toBe(0);
});
