import React, { useRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import DragonCombatSprite from "./DragonCombatSprite";
import { CombatAnimation, CombatAnimationEvent, collectCombatAnimations } from "./combatAnimation";
import { selectDragonCombatAnimation, useDragonCombatAnimation } from "./useDragonCombatAnimation";
import { DragonFlameBreath, DragonHurt, TypingBossProjectile } from "./types";
import { DRAGON_FLAME } from "./dragonHurtRules";
import { ProjectileMotion } from "./ProjectileMotion";

declare const test:any,expect:any,jest:any,afterEach:any;
afterEach(()=>jest.useRealTimers());
const breath:DragonFlameBreath={id:"flame",at:1000,until:3000};
const flame:CombatAnimationEvent={id:"flame",state:"flamethrower",at:1000,duration:DRAGON_FLAME.duration,channel:"action"};
test("flame owns every frame over all attacks and reactions, including a stronger critical",()=>{
  const hurt:DragonHurt={id:"crit",tier:"critical",at:1100,until:2300};
  const events:CombatAnimationEvent[]=[flame,
    {id:"bite",state:"bite",at:1200,duration:820,channel:"action"},
    {id:"power",state:"hit",at:1300,duration:660,channel:"reaction",hurtTier:"power"},
    {id:"dodge",state:"dodge",at:1400,duration:520,channel:"reaction"}];
  for(const now of [1000,1500,2300,2999]) {
    const pose=selectDragonCombatAnimation(events,hurt,now,false,breath);
    expect(pose.state).toBe("flamethrower");expect(pose.at).toBe(1000);expect(pose.nextAt).toBe(3000);expect(pose.reaction).toBeUndefined();
  }
  expect(selectDragonCombatAnimation(events,hurt,1500).state).toBe("flamethrower");
  expect(selectDragonCombatAnimation(events,hurt,1500,true,breath).state).not.toBe("flamethrower");
  const queued={...hurt,at:3000,until:4200};
  expect(selectDragonCombatAnimation(events,queued,3000,false,breath).hurtTier).toBe("critical");
});
test.each(["infernalDragon","cindermaw","emberWhelp"] as const)("%s has 20 inspectable frames including the last recovery pose",bossId=>{
  const pose:CombatAnimation={...flame,action:flame};
  render(<DragonCombatSprite bossId={bossId} width={256} glow="#f00" pose={pose} inspectFrame={99}/>);
  fireEvent.load(screen.getByTestId("dragon-flame-preload"));
  const cell=screen.getByTestId("dragon-sprite-cell");
  expect(cell.getAttribute("data-frame-count")).toBe("20");expect(cell.style.backgroundPosition).toBe("100% 100%");
  expect(cell.style.animationName).toBe("none");
  expect(screen.getByTestId("dragon-animation").getAttribute("data-sprite-state")).toBe("flamethrower");
});
test("late sheet loading catches up once and snapshots never restart a breath",()=>{
  jest.useFakeTimers("modern");jest.setSystemTime(1100);
  const pose:CombatAnimation={...flame,action:flame};
  const view=render(<DragonCombatSprite bossId="cindermaw" width={256} glow="#f00" pose={pose}/>);
  act(()=>jest.advanceTimersByTime(900));fireEvent.load(screen.getByTestId("dragon-flame-preload"));
  const cell=screen.getByTestId("dragon-sprite-cell");expect(cell.style.animationDelay).toBe("-1000ms");
  act(()=>jest.advanceTimersByTime(100));view.rerender(<DragonCombatSprite bossId="cindermaw" width={256} glow="#f00" pose={{...pose}}/>);
  expect(screen.getByTestId("dragon-sprite-cell")).toBe(cell);expect(cell.style.animationDelay).toBe("-1000ms");
});
function Harness() {
  const clock=useRef(0),pose=useDragonCombatAnimation([flame],null,false,clock,breath);
  return <span data-testid="pose">{pose.state}</span>;
}
test("the lock expires locally without a network update",()=>{
  jest.useFakeTimers("modern");jest.setSystemTime(1000);const view=render(<Harness/>);
  act(()=>jest.advanceTimersByTime(1999));expect(screen.getByTestId("pose").textContent).toBe("flamethrower");
  act(()=>jest.advanceTimersByTime(20));expect(screen.getByTestId("pose").textContent).toBe("idle");
  view.unmount();expect(jest.getTimerCount()).toBe(0);
});
test("inhale starts the sprite immediately while the projectile and stream wait for ignition",()=>{
  jest.useFakeTimers("modern");jest.setSystemTime(1000);
  const shot:TypingBossProjectile={id:"flame",kind:"boss",source:"boss",target:"hero",bossAttack:"flamethrower",moveLabel:"Flame",result:"pending",resolvedAt:null,amount:null,
    animationStartedAt:1000,startedAt:1600,impactAt:2700};
  expect(collectCombatAnimations([shot]).get("boss")![0].at).toBe(1000);
  const point={x:50,y:60};const view=render(<ProjectileMotion projectile={shot} from={point} to={point} art={null} serverOffset={0}/>);
  expect(screen.queryByTestId("dragon-breath-stream")).toBeNull();
  expect((view.container.querySelector(".boss-projectile") as HTMLElement).style.visibility).toBe("hidden");
  act(()=>jest.advanceTimersByTime(611));expect(screen.getByTestId("dragon-breath-stream")).toBeTruthy();
  act(()=>jest.advanceTimersByTime(1100));expect(screen.queryByTestId("dragon-breath-stream")).toBeNull();
});
