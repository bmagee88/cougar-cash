import React from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import {KrakenSprite} from './KrakenVisuals';
import {ContinuousTyping} from './ContinuousBattle';
import {createTypingState,initializeBalanced} from './proportionalRules';
import {submitTypingBossWords} from './api';
declare const test:any,expect:any,jest:any,afterEach:any;
jest.mock('./api');
afterEach(()=>{jest.useRealTimers();jest.clearAllMocks();});
const player={code:'hero',name:'Hero',hp:100,maxHp:100,classId:'paladin',color:'gold',defeated:false} as any;
function state() {
  const s=initializeBalanced(createTypingState(1,'paladin'));s.wordProtocol=1;s.balancedSpecialAt=0;
  s.issuedWords=[{index:0,text:'cat',color:'gold',ticket:'a'.repeat(32)}];return s;
}
test('20-frame Kraken cast keeps its animation timeline on unrelated rerenders',()=>{
  jest.useFakeTimers();jest.setSystemTime(1000);
  const clock={current:0},pose={id:'idle',state:'idle',at:1000,duration:0} as any,cast={id:'cast',at:900,until:1900};
  const view=render(<KrakenSprite width={142} pose={pose} clock={clock} cast={cast}/>);
  fireEvent.load(screen.getByTestId('kraken-preload-special'));
  const glow=screen.getByTestId('kraken-special-glow');expect(glow.getAttribute('data-frames')).toBe('20');expect(glow.style.animationDelay).toBe('-100ms');
  act(()=>jest.advanceTimersByTime(200));view.rerender(<KrakenSprite width={104} pose={pose} clock={clock} cast={{...cast}}/>);
  expect(screen.getByTestId('kraken-special-glow')).toBe(glow);expect(glow.style.animationDelay).toBe('-100ms');
});
test('prone locks input for five seconds and resumes a partial word without losing a timing sample',()=>{
  jest.useFakeTimers();jest.setSystemTime(1000);(submitTypingBossWords as any).mockImplementation(()=>new Promise(()=>{}));
  const s=state(),props={sessionId:'bossABC',credentials:{code:'hero'},state:s,active:true};
  const view=render(<ContinuousTyping {...props} profile={{player,events:[]}}/>);
  fireEvent.keyDown(screen.getByRole('textbox'),{key:'c'});
  view.rerender(<ContinuousTyping {...props} profile={{player:{...player,proneUntil:Date.now()+5000},events:[]}}/>);
  expect((screen.getByRole('textbox') as HTMLInputElement).disabled).toBe(true);
  expect(screen.getByText(/Knocked prone/)).toBeTruthy();
  act(()=>jest.advanceTimersByTime(5000));expect((screen.getByRole('textbox') as HTMLInputElement).disabled).toBe(false);
  fireEvent.keyDown(screen.getByRole('textbox'),{key:'a'});fireEvent.keyDown(screen.getByRole('textbox'),{key:'t'});
  const record=(submitTypingBossWords as any).mock.calls[0][2][0];expect(record[1]).toBe('cat');expect(record[2]).toBe(2);expect(record[3]).toBeLessThan(1000);
});
test('curse enters the next correct letter and allows the rest of the word to complete',()=>{
  jest.useFakeTimers();jest.setSystemTime(1000);(submitTypingBossWords as any).mockImplementation(()=>new Promise(()=>{}));
  const s=state();
  render(<ContinuousTyping sessionId="bossABC" credentials={{code:'hero'}} state={s} active profile={{player:{...player,curseUntil:16000,curseKey:{id:'key',key:'z',at:1000,index:0}},events:[]}}/>);
  expect(screen.getByText(/Ink Hex typed/)).toBeTruthy();expect(screen.getByLabelText(/Ink Hex: 15 seconds/)).toBeTruthy();
  const input=screen.getByRole('textbox');for(const key of 'at')fireEvent.keyDown(input,{key});
  expect((submitTypingBossWords as any).mock.calls[0][2][0][7].mistakes).toBe(0);
  expect(screen.getByTestId('portrait-special').getAttribute('data-charged')).toBe('true');
});
