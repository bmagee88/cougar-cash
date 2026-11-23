import React from "react";
import {act,render,screen} from "@testing-library/react";
import TypingPortrait,{DragonPortrait} from "./TypingPortrait";
import {ContinuousTyping} from "./ContinuousBattle";
import {createTypingState,initializeBalanced} from "./proportionalRules";
import {CombatAnimationEvent,CombatPose,POSE_MS} from "./combatAnimation";
declare const test:any,expect:any,jest:any,afterEach:any;
afterEach(()=>jest.useRealTimers());
const boss={id:"infernalDragon",name:"Dragon",hp:100,maxHp:100,glow:"red",hurt:null} as any;

test('promoted profiles show doubled offensive numbers and upgraded appearance without changing HP or crit percent',()=>{
  const state=initializeBalanced(createTypingState(123,'barbarian'));Object.assign(state,{promoted:true,balancedPower:10,balancedOrangePower:5,balancedCritBonus:.12});
  const player={code:'hero',name:'Hero',classId:'barbarian',color:'red',hp:100,maxHp:100,promoted:true} as any;
  render(<ContinuousTyping sessionId="bossABC" credentials={{code:'hero'}} state={state} active={false} profile={{player,events:[]}}/>);
  expect(screen.getByLabelText('Attack power: 2,000')).toBeTruthy();expect(screen.getByLabelText('Power bonus: +1,000')).toBeTruthy();
  expect(screen.getByLabelText('Crit ready: +12%')).toBeTruthy();expect(screen.getByLabelText('Hero HP: 10,000 / 10,000')).toBeTruthy();
  expect(screen.getByTestId('typing-portrait').className).toContain('typing-portrait-promoted');expect(screen.getByLabelText('Promoted hero')).toBeTruthy();
});

test('profiles retain complete large attack and bonus values and expose current/max HP below the bar',()=>{
  const state=initializeBalanced(createTypingState(123,'barbarian'));
  state.balancedOrangePower=12345.67;state.balancedCritBonus=123.45;
  const player={code:'hero',name:'Hero',classId:'barbarian',color:'red',hp:12.345,maxHp:100,defeated:false} as any;
  const view=render(<><TypingPortrait player={player} state={state} letters={123456.78} events={[]}/><DragonPortrait boss={{...boss,hp:200,maxHp:300}} state={state} letters={123456.78} events={[]}/></>);
  expect(screen.getByLabelText('Attack power: 12,345,678')).toBeTruthy();
  expect(screen.getAllByLabelText('Power bonus: +1,234,567')).toHaveLength(2);
  expect(screen.getByLabelText('Hero HP: 1,235 / 10,000')).toBeTruthy();
  expect(screen.getByLabelText('Dragon HP: 20,000 / 30,000')).toBeTruthy();
  view.container.querySelectorAll('.portrait-health-value').forEach(label=>expect(label.previousElementSibling?.className).toBe('portrait-health'));
  view.container.querySelectorAll('.portrait-fitted-number').forEach(value=>expect(value.getAttribute('preserveAspectRatio')).toBe('xMinYMid meet'));
});

test('own profile shows Second Wind above the active character and clears it on recovery',()=>{
  const player={code:'hero',name:'Hero',classId:'cleric',color:'gold',hp:0,maxHp:100,defeated:false,secondWindWordsRemaining:3} as any;
  const state=createTypingState(123,'cleric');
  const view=render(<TypingPortrait player={player} state={state} letters={0} events={[]}/>);
  const bar=screen.getByRole('progressbar',{name:'Hero Second Wind'});
  expect(bar.closest('.portrait-recovery')?.parentElement).toBe(screen.getByTestId('typing-portrait'));
  expect(screen.getByText('Second Wind')).toBeTruthy();
  view.rerender(<TypingPortrait player={{...player,hp:40,secondWindWordsRemaining:0}} state={state} letters={0} events={[]}/>);
  expect(screen.queryByRole('progressbar',{name:'Hero Second Wind'})).toBeNull();
});
test("client dragon profile displays shared power, ready crit, special and defenses on the right",()=>{
  const state=initializeBalanced(createTypingState(123,'cleric'));
  const sharedBoss={...boss,attackCharacters:42,profile:{balanced:true,balancedOrangePower:8,balancedCritBonus:.12,gold:1,balancedGuard:30,balancedGuardMax:100,dodgeBank:50}};
  const view=render(<ContinuousTyping sessionId="bossABC" credentials={{code:'hero'}} state={state} active={false}
    profile={{player:{code:'hero',name:'Hero',classId:'cleric',color:'gold',hp:100,maxHp:100} as any,events:[]}}
    dragonProfile={{boss:sharedBoss,events:[]}}/>);
  const dragon=screen.getByTestId('dragon-portrait');
  expect(dragon.parentElement!.lastElementChild).toBe(dragon);
  expect(screen.getByLabelText('Dragon attack power: 4,200')).toBeTruthy();
  expect(screen.getByLabelText('Power bonus: +800')).toBeTruthy();
  expect(screen.getByLabelText('Crit ready: +12%')).toBeTruthy();
  expect(dragon.querySelector('.portrait-special')).toBeTruthy();
  expect((dragon.querySelector('.portrait-shield') as HTMLElement).style.opacity).not.toBe('0');
  expect(view.container.querySelector('.boss-projectile')).toBeNull();
});
test.each(["bite","weakAttack","tailWhip","flamethrower"])("host profile animates %s without rendering a projectile",(state:CombatPose)=>{
  const now=Date.now(),event:CombatAnimationEvent={id:"attack",state,at:now,duration:POSE_MS[state],channel:"action"};
  const view=render(<DragonPortrait boss={boss} state={createTypingState(123,"dragon")} events={[event]}/>);
  expect(screen.getByTestId("dragon-animation").getAttribute("data-animation")).toBe(state);
  expect(view.container.querySelector(".boss-projectile")).toBeNull();
});
test("every hit has independent feedback while flame remains uninterrupted; impacts expire locally",()=>{
  jest.useFakeTimers("modern");jest.setSystemTime(1000);
  const flame:CombatAnimationEvent={id:"flame",state:"flamethrower",at:1000,duration:2000,channel:"action"};
  const hit=(id:string,tier:"basic"|"power"|"critical"):CombatAnimationEvent=>({id,state:"hit",at:1000,duration:460,channel:"reaction",hurtTier:tier});
  const events=[flame,hit("a","critical"),hit("b","basic"),hit("c","power")];
  render(<DragonPortrait boss={boss} state={createTypingState(123,"dragon")} events={events}/>);
  expect(screen.getAllByTestId("host-profile-hit")).toHaveLength(3);
  expect(screen.getByTestId("dragon-animation").getAttribute("data-animation")).toBe("flamethrower");
  act(()=>jest.advanceTimersByTime(470));
  expect(screen.queryAllByTestId("host-profile-hit")).toHaveLength(0);
  expect(screen.getByTestId("dragon-animation").getAttribute("data-animation")).toBe("flamethrower");
});
test("error penalty chip is removed",()=>{
  const state=initializeBalanced(createTypingState(123,"dragon"));state.attackErrors=2;
  render(<ContinuousTyping sessionId="bossABC" credentials={{hostToken:"test"}} state={state} active={false}/>);
  expect(screen.queryByText(/Errors 2/)).toBeNull();
});
