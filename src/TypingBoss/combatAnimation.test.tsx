import React, { useRef } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import CombatCharacter, { useCombatAnimation } from "./CombatCharacter";
import { collectCombatAnimations, CombatPose, NO_ANIMATION_EVENTS, POSE_MS, POSE_ROW, selectCombatAnimation } from "./combatAnimation";
import { TypingBossClassId, TypingBossProjectile } from "./types";

declare const test:any,expect:any,jest:any,beforeEach:any,afterEach:any;
function shot(values:Partial<TypingBossProjectile>={}):TypingBossProjectile {
  return {id:"event",source:"caster",target:"target",kind:"damage",moveId:"weak",moveLabel:"Attack",startedAt:1000,impactAt:1700,
    resolvedAt:null,result:"pending",amount:null,...values};
}
test.each([
  [{},"weakAttack","hit"],
  [{moveId:"strong",critical:true},"strongAttack","hit"],
  [{kind:"heal"},"healCast","healed"],
  [{kind:"heal",source:"target"},"selfHeal","healed"],
  [{kind:"resurrect"},"reviveCast","reviving"],
  [{kind:"buff",moveId:"goldShield"},"shieldCast","shielded"],
  [{kind:"buff",moveId:"paladinSpecial"},"buffCast","buffed"],
  [{kind:"buff",moveId:"rogueSpecial"},"buffCast","evasionReady"],
  [{kind:"boss",source:"boss",bossAttack:"bite"},"bite","hit"],
  [{kind:"boss",source:"boss",bossAttack:"tailWhip"},"tailWhip","hit"],
  [{kind:"boss",source:"boss",bossAttack:"flamethrower"},"flamethrower","hit"],
])("actions and recipient reactions are mapped for %j",(values:Partial<TypingBossProjectile>,action:CombatPose,reaction:CombatPose)=>{
  const pending=shot(values),actors=collectCombatAnimations([pending]);
  expect(actors.get(pending.source)!.find(event=>event.channel==="action")!.state).toBe(action);
  expect(actors.get("target")?.some(event=>event.channel==="reaction") || false).toBe(false);
  const resolved=collectCombatAnimations([{...pending,resolvedAt:1700,result:"hit",amount:20}]);
  expect(resolved.get("target")!.find(event=>event.channel==="reaction")!.state).toBe(reaction);
});

test("misses and dodges do not trigger taking-damage animations",()=>{
  for(const result of ["miss","evade"] as const) {
    const events=collectCombatAnimations([shot({resolvedAt:1700,result,amount:0,evadeType:result==="evade"?"dodge":null})]).get("target")!;
    expect(selectCombatAnimation(events,1750).state).toBe("dodge");
    expect(events.some(event=>event.state==="hit")).toBe(false);
  }
});
test("full shielding braces; partial shielding keeps the hit and shield feedback",()=>{
  const full=collectCombatAnimations([shot({resolvedAt:1700,result:"hit",amount:0,blockedAmount:20})]).get("target")!;
  expect(selectCombatAnimation(full,1750).state).toBe("block");
  const partial=collectCombatAnimations([shot({resolvedAt:1700,result:"hit",amount:10,blockedAmount:10})]).get("target")!;
  const pose=selectCombatAnimation(partial,1750);
  expect(pose.state).toBe("hit");expect(pose.block!.state).toBe("block");
});
test("failed support casts do not make their recipient dodge or appear healed",()=>{
  for (const kind of ["heal","resurrect","buff"] as const) {
    const events=collectCombatAnimations([shot({kind,resolvedAt:1700,result:"miss",amount:0})]);
    expect(events.get("caster")!.some(event=>event.channel==="action")).toBe(true);
    expect(events.get("target")).toBeUndefined();
  }
});
test("self healing preserves both the casting action and receiving-heal reaction",()=>{
  const events=collectCombatAnimations([shot({kind:"heal",source:"target",resolvedAt:1000,result:"hit",amount:10})]).get("target")!;
  const pose=selectCombatAnimation(events,1100);
  expect(pose.state).toBe("selfHeal");expect(pose.action!.state).toBe("selfHeal");expect(pose.reaction!.state).toBe("healed");
});
test("knockout plays once, holds the down pose, and a successful revival rises before returning to idle",()=>{
  const hits=collectCombatAnimations([shot({resolvedAt:1700,result:"hit",amount:100})]).get("target")!;
  expect(selectCombatAnimation(hits,1700,true).state).toBe("death");
  expect(selectCombatAnimation(hits,1700+POSE_MS.death,true).state).toBe("defeated");
  expect(selectCombatAnimation([],5000,true).state).toBe("defeated");
  const revive=collectCombatAnimations([shot({id:"revive",kind:"resurrect",startedAt:3000,resolvedAt:3000,result:"hit",amount:30})]).get("target")!;
  expect(selectCombatAnimation([...hits,...revive],3050,false).state).toBe("reviving");
  expect(selectCombatAnimation([...hits,...revive],4100,false).state).toBe("idle");
});
test("expired snapshots cannot replay animations, and frequent snapshots do not extend a pose",()=>{
  const events=collectCombatAnimations([shot()]).get("caster")!;
  expect(selectCombatAnimation(events,1100).nextAt).toBe(1620);
  expect(selectCombatAnimation(events,1500).nextAt).toBe(1620);
  expect(selectCombatAnimation(events,5000).state).toBe("idle");
  expect(selectCombatAnimation(events,5000).nextAt).toBeUndefined();
});
test("simultaneous hits coalesce, while a cast and recipient reaction remain independently available",()=>{
  const shots=Array.from({length:30},(_,i)=>shot({id:String(i),source:`hero${i}`,target:"boss",resolvedAt:1700,result:"hit",amount:10}));
  const events=collectCombatAnimations(shots).get("boss")!;
  expect(selectCombatAnimation(events,1750).state).toBe("hit");
  expect(selectCombatAnimation(events,1750).nextAt).toBe(1700+POSE_MS.hit);
  const actor=collectCombatAnimations([shot({source:"target",target:"boss",startedAt:1700}),shot({id:"incoming",source:"boss",resolvedAt:1700,result:"hit",amount:10})]).get("target")!;
  const pose=selectCombatAnimation(actor,1750);
  expect(pose.action!.state).toBe("weakAttack");expect(pose.reaction!.state).toBe("hit");
});

const classes:TypingBossClassId[]=["cleric","barbarian","paladin","rogue","necromancer","monk"];
let NativeImage:typeof Image;
beforeEach(()=>{
  jest.useFakeTimers("modern");jest.setSystemTime(1000);
  NativeImage=window.Image;
  window.Image=function MockImage(){
    const image={onload:null as (()=>void)|null,onerror:null as (()=>void)|null};
    Object.defineProperty(image,"src",{set:()=>image.onload?.()});
    return image;
  } as any;
});
afterEach(()=>{window.Image=NativeImage;jest.useRealTimers();});

function Harness({shots,defeated=false,classId="paladin"}:{shots:TypingBossProjectile[];defeated?:boolean;classId?:TypingBossClassId}) {
  const clock=useRef(0);
  const events=collectCombatAnimations(shots).get("target") || NO_ANIMATION_EVENTS;
  const pose=useCombatAnimation(events,defeated,clock);
  return <CombatCharacter classId={classId} color="#facc15" size={86} pose={pose} clock={clock}/>;
}

test.each(classes)("%s has every requested pose and both source and recipient states",async(classId:TypingBossClassId)=>{
  const poses=Object.keys(POSE_ROW) as CombatPose[];
  const view=render(<CombatCharacter classId={classId} color="#fff" pose={{state:"weakAttack",id:"initial",at:1000,duration:620}}/>);
  await waitFor(()=>expect(screen.getByTestId("combat-character").getAttribute("data-sprite-state")).toBe("weakAttack"));
  for(const state of poses) {
    view.rerender(<CombatCharacter classId={classId} color="#fff" pose={{state,id:state,at:1000,duration:POSE_MS[state]}}/>);
    expect(screen.getByTestId("combat-character").getAttribute("data-animation")).toBe(state);
    expect(screen.getByTestId("combat-character").getAttribute("data-sprite-state")).toBe(state);
    expect(POSE_ROW[state]).toBeGreaterThanOrEqual(0);expect(POSE_ROW[state]).toBeLessThan(8);
  }
});
test("the hook returns a healed recipient to idle, without restarting from an overlapping snapshot",async()=>{
  const shots=[shot({kind:"heal",resolvedAt:1000,result:"hit",amount:20})];
  const view=render(<Harness shots={shots}/>);
  await waitFor(()=>expect(screen.getByTestId("combat-character").getAttribute("data-sprite-state")).toBe("healed"));
  expect(screen.getByTestId("combat-character").getAttribute("data-animation")).toBe("healed");
  act(()=>jest.advanceTimersByTime(400));
  view.rerender(<Harness shots={shots.map(item=>({...item}))}/>);
  act(()=>jest.advanceTimersByTime(310));
  expect(screen.getByTestId("combat-character").getAttribute("data-animation")).toBe("idle");
  view.unmount();expect(jest.getTimerCount()).toBe(0);
});
test("partial blocks render both recipient effects instead of losing shield feedback",async()=>{
  render(<Harness shots={[shot({startedAt:500,resolvedAt:1000,result:"hit",amount:10,blockedAmount:10})]}/>);
  await waitFor(()=>expect(screen.getByTestId("combat-character").getAttribute("data-sprite-state")).toBe("hit"));
  expect(screen.getAllByTestId("recipient-reaction")).toHaveLength(2);
});
test("receiving damage while attacking keeps a visible cast cue as well as the hit reaction",async()=>{
  render(<Harness shots={[
    shot({source:"target",target:"boss"}),shot({id:"incoming",source:"boss",resolvedAt:1000,result:"hit",amount:10})
  ]}/>);
  await waitFor(()=>expect(screen.getByTestId("combat-character").getAttribute("data-sprite-state")).toBe("hit"));
  expect(screen.getByTestId("combat-character").getAttribute("data-action")).toBe("weakAttack");
  expect(screen.getByTestId("combat-character").getAttribute("data-reaction")).toBe("hit");
  expect(screen.getByTestId("concurrent-cast")).toBeTruthy();
});
