import React from 'react';
import {act,fireEvent,render,screen,within} from '@testing-library/react';
import {ContinuousTyping} from './ContinuousBattle';
import {createTypingState,initializeBalanced} from './proportionalRules';
import {submitTypingBossWords} from './api';
import CombatCharacter from './CombatCharacter';
import SummonParty from './SummonSprites';
import RecoveryNotice from './RecoveryNotice';
import {TypingBossClassId,TypingBossPlayer,TypingBossTypingState} from './types';
declare const test:any,expect:any,jest:any,afterEach:any;
jest.mock('./api');
const submit=submitTypingBossWords as any;
afterEach(()=>{jest.useRealTimers();submit.mockReset();});
const type=(input:HTMLElement,text:string)=>{for(const key of text)fireEvent.keyDown(input,{key});};

test('rancid summon words give their own feedback and no owner ATK, cadence or color bonus',async()=>{
  submit.mockImplementation(()=>new Promise(()=>{}));
  const state=initializeBalanced(createTypingState(123,'necromancer'));
  Object.assign(state,{wordProtocol:1,summonPrefix:[0],issuedWords:[{index:0,text:'rot',color:null,summonSlot:0,ticket:'a'.repeat(32)},{index:1,text:'cat',color:null,ticket:'b'.repeat(32)}]});
  render(<ContinuousTyping sessionId="test" credentials={{code:'hero',playerToken:'test'}} state={state} active/>);
  const words=screen.getAllByTestId('typing-word');expect(words).toHaveLength(11);
  expect(words[0].getAttribute('data-summon-slot')).toBe('0');expect(words[0].getAttribute('data-trigger')).toBe('false');
  expect(words[0].querySelector('span')!.style.color).toBe('rgb(113, 149, 44)');
  const input=screen.getByRole('textbox');type(input,'ro');expect(screen.getByText('ATK 0')).toBeTruthy();
  type(input,'t');expect(screen.getByText('ATK 0')).toBeTruthy();expect(screen.getByText('Zombie attacks!')).toBeTruthy();
  type(input,' c');expect(screen.getByText('ATK 100')).toBeTruthy();
  expect(submit).toHaveBeenCalledTimes(1);expect(submit.mock.calls[0][2][0][0]).toBe(0);
  await act(async()=>{});
});

test('attack boundary waits for the server summon plan and resumes in the same input',async()=>{
  let resolve:any;submit.mockImplementationOnce(()=>new Promise(done=>{resolve=done;})).mockImplementation(()=>new Promise(()=>{}));
  const state=createTypingState(123,'necromancer');
  Object.assign(state,{wordProtocol:1,summonPrefix:[],nextWord:9,wordsInAttack:9,issuedWords:[{index:9,text:'dog',color:null,ticket:'a'.repeat(32)}]});
  render(<ContinuousTyping sessionId="test" credentials={{code:'hero'}} state={state} active/>);
  const input=screen.getByRole('textbox');type(input,'dog');expect(submit).toHaveBeenCalledTimes(1);
  type(input,'cat ');expect(submit).toHaveBeenCalledTimes(1);
  await act(async()=>resolve({nextWord:10,summonPrefix:[0],summonWaiting:false,issuedWords:Array.from({length:11},(_,i)=>({index:10+i,text:i?'cat':'rot',color:null,ticket:'b'.repeat(32),...(i?{}:{summonSlot:0})}))}));
  expect(screen.getByRole('textbox')).toBe(input);expect(screen.getAllByTestId('typing-word')).toHaveLength(11);
  expect(screen.getAllByTestId('typing-word')[0].getAttribute('data-summon-slot')).toBe('0');
  type(input,'rot ');expect(submit).toHaveBeenCalledTimes(2);expect(submit.mock.calls[1][2][0][0]).toBe(10);
});

test.each(['paladin','cleric','barbarian','rogue','necromancer','monk'])('%s can attack on one knee and returns to normal after recovery',(classId:TypingBossClassId)=>{
  const clock={current:0},pose={state:'weakAttack' as const,id:'attack',at:Date.now(),duration:620};
  const view=render(<CombatCharacter classId={classId} color="green" pose={pose} clock={clock} kneeling/>);
  expect(screen.getByTestId('combat-character').getAttribute('data-animation')).toBe('kneeling');
  expect(screen.getByTestId('combat-character').getAttribute('data-action')).toBe('kneelingAttack');
  expect(document.querySelector('.kneeling-attack')).toBeTruthy();
  view.rerender(<CombatCharacter classId={classId} color="green" pose={pose} clock={clock}/>);
  expect(screen.getByTestId('combat-character').getAttribute('data-animation')).toBe('weakAttack');
});

test('zombies collapse to a held KO and resurrect in the same slot',()=>{
  jest.useFakeTimers();jest.setSystemTime(1000);
  const clock={current:0},summon={slot:0,alive:false,changedAt:1000,event:'death' as const};
  const view=render(<SummonParty summons={[summon]} clock={clock}/>);
  expect(screen.getByTestId('zombie-summon').getAttribute('data-state')).toBe('death');
  act(()=>jest.advanceTimersByTime(920));expect(screen.getByTestId('zombie-summon').getAttribute('data-state')).toBe('ko');
  const node=screen.getByTestId('zombie-summon');
  view.rerender(<SummonParty summons={[{...summon,alive:true,changedAt:1920,event:'resurrection'}]} clock={clock}/>);
  expect(screen.getByTestId('zombie-summon')).toBe(node);expect(node.getAttribute('data-state')).toBe('resurrection');
  act(()=>jest.advanceTimersByTime(1120));expect(node.getAttribute('data-state')).toBe('idle');
});

test('team recovery explains how to stand without exposing the damage penalty',()=>{
  render(<RecoveryNotice player={{secondWindWordsRemaining:3} as TypingBossPlayer} active teamMode/>);
  const text=screen.getByRole('alert').textContent!;
  expect(text).toContain('Keep typing to stand again');expect(text).toContain('3 more words');
  expect(text).not.toMatch(/80%|75%|0\.8/);
});
