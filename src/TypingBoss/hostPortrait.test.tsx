import React from "react";
import {act,render,screen} from "@testing-library/react";
import {DragonPortrait} from "./TypingPortrait";
import {ContinuousTyping} from "./ContinuousBattle";
import {createTypingState,initializeBalanced} from "./proportionalRules";
import {CombatAnimationEvent,CombatPose,POSE_MS} from "./combatAnimation";
declare const test:any,expect:any,jest:any,afterEach:any;
afterEach(()=>jest.useRealTimers());
const boss={id:"infernalDragon",name:"Dragon",hp:100,maxHp:100,glow:"red",hurt:null} as any;
test("client dragon profile displays shared power, ready crit, special and defenses on the right",()=>{
  const state=initializeBalanced(createTypingState(123,'cleric'));
  const sharedBoss={...boss,attackCharacters:42,profile:{balanced:true,balancedOrangePower:8,balancedCritBonus:.12,gold:1,balancedGuard:30,balancedGuardMax:100,dodgeBank:50}};
  const view=render(<ContinuousTyping sessionId="bossABC" credentials={{code:'hero'}} state={state} active={false}
    profile={{player:{code:'hero',name:'Hero',classId:'cleric',color:'gold',hp:100,maxHp:100} as any,events:[]}}
    dragonProfile={{boss:sharedBoss,events:[]}}/>);
  const dragon=screen.getByTestId('dragon-portrait');
  expect(dragon.parentElement!.lastElementChild).toBe(dragon);
  expect(screen.getByLabelText('Dragon attack letters: 42')).toBeTruthy();
  expect(screen.getByLabelText('Power bonus: +8')).toBeTruthy();
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
