import React from "react";
import { act, render, screen, within } from "@testing-library/react";
import { BattleScene, PlayerTypingBattle } from "./TypingBossApp";
import { TypingBossSessionSnapshot } from "./types";
import { createTypingState } from "./proportionalRules";
import {DamageBoard} from './ContinuousBattle';

declare const test: any, expect: any, jest: any;

jest.mock("react-router-dom", () => ({ Link: "a" }), { virtual: true });

function room(count: number): TypingBossSessionSnapshot {
  return {
    id: "bossABC", mode: "proportional", status: "active", serverNow: Date.now(),
    boss: { id: "infernalDragon", name: "Ancient dragon", hp: 100 * count, maxHp: 100 * count, color: "red", glow: "red" },
    players: Array.from({ length: count }, (_, i) => ({
      code: `hero${i}`, name: `Hero ${i}`, classId: "paladin", color: "blue", hp: 100, maxHp: 100,
      defeated: i === count - 1, attackProgress: 40,
    })), projectiles: [],
  } as TypingBossSessionSnapshot;
}

test('two-player balanced HP and damage use whole hundredfold display units',()=>{
  const session=room(2);session.balanced=true;
  session.players.forEach(player=>Object.assign(player,{totalDamage:0,totalTaken:0}));
  Object.assign(session.players[0],{totalDamage:12.345,totalTaken:.125});
  const view=render(<><BattleScene session={session}/><DamageBoard session={session}/></>);
  expect(screen.getByText('20,000 / 20,000 HP')).toBeTruthy();
  expect(screen.getByText('Dealt 1,235')).toBeTruthy();
  expect(screen.getByText('Taken 13')).toBeTruthy();
  expect(session.boss.hp).toBe(200);
  expect(session.players[0].totalDamage).toBe(12.345);
  view.unmount();
});

test('battlefield fits a narrow screen and resizes characters without remeasuring on combat updates',()=>{
  const original=global.ResizeObserver;
  let resize:any;
  const observe=jest.fn(),disconnect=jest.fn();
  const observer=jest.fn(callback=>{resize=callback;return {observe,disconnect};});
  global.ResizeObserver=observer as any;
  const bounds=jest.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue({width:360} as DOMRect);
  try {
    const session=room(30),view=render(<BattleScene session={session}/>);
    const sprite=()=>view.container.querySelector('[data-testid="combat-character"]') as HTMLElement;
    expect(view.container.querySelector('[data-world-scale]')?.getAttribute('data-world-scale')).toBe('0.36');
    const scene=screen.getByRole('region',{name:'Host battle scene'});
    expect(getComputedStyle(scene).overflow).toBe('hidden');
    expect(getComputedStyle(scene).width).toBe('100%');
    act(()=>resize([{contentRect:{width:1200}}]));
    expect(sprite().style.height).toBe('64px');
    act(()=>resize([{contentRect:{width:2000,height:1200}}]));
    expect(view.container.querySelector('[data-world-scale]')?.getAttribute('data-world-scale')).toBe('2');
    view.rerender(<BattleScene session={{...session,boss:{...session.boss,hp:1}}}/>);
    expect(observer).toHaveBeenCalledTimes(1);
    view.unmount();expect(disconnect).toHaveBeenCalled();
  } finally {bounds.mockRestore();global.ResizeObserver=original;}
});

test.each([10, 11, 20, 21, 30])("host and quiet student overview share the formation at %i players", count => {
  const session = room(count);
  const { rerender } = render(<BattleScene session={session} />);
  const host = screen.getByRole("region", { name: "Host battle scene" });
  expect(getComputedStyle(host).overflow).toBe('hidden');
  expect(getComputedStyle(host).width).toBe('100%');
  const sceneBefore = host.innerHTML;
  expect(screen.queryByRole("img", { name: "Your character" })).toBeNull();
  expect(within(host).queryByText("Hero 0") !== null).toBe(true);
  expect(within(host).queryAllByRole("progressbar")).toHaveLength(1 + (count <= 20 ? count : 0));
  const charge = within(host).queryByRole("progressbar", { name: "Hero 0 attack progress" });
  expect(charge ? getComputedStyle(charge).height : undefined).toBe(count > 20 ? undefined : count > 10 ? "2px" : "4px");

  // Mark even a knocked-out player. Removing the local marker/glow restores the
  // exact host scene: no reordered party, alternate camera or different sizing.
  rerender(<BattleScene session={session} ownCode={`hero${count - 1}`} />);
  expect(screen.getByRole("region", { name: "Player battle scene" })).toBeTruthy();
  expect(screen.getAllByRole("img", { name: "Your character" })).toHaveLength(1);
  const overview=screen.getByRole('region',{name:'Player battle scene'});
  expect(overview.getAttribute('data-overview')).toBe('true');
  expect(within(overview).queryByLabelText('Dragon attack progress')).toBeNull();
  expect(within(overview).queryByLabelText('Hero 0 attack progress')).toBeNull();
  expect(overview.querySelectorAll('.boss-projectile')).toHaveLength(0);
  rerender(<BattleScene session={session} />);
  expect(screen.getByRole("region").innerHTML).toBe(sceneBefore);
});

test("only personal projectiles animate beside the profiles while the overview stays still", () => {
  const session = room(2), now = Date.now();
  session.typing = createTypingState(1, "paladin");
  const base = { moveLabel: "Attack", moveId: "weak", startedAt: now, impactAt: now + 700, resolvedAt: null, result: "pending" as const, amount: null };
  session.projectiles = [
    { ...base, id: "own-damage", source: "hero0", target: "boss", kind: "damage" },
    { ...base, id: "other-damage", source: "hero1", target: "boss", kind: "damage" },
    { ...base, id: "own-heal", source: "hero0", target: "hero1", kind: "heal" },
    { ...base, id: "incoming", source: "boss", target: "hero0", kind: "boss", bossAttack: "fireball" },
  ];
  const bounds = jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function(this: HTMLElement) {
    const root = this.getAttribute("data-testid") === "personal-typing-stage";
    const profile = this.classList.contains("typing-portrait");
    const dragon = this.classList.contains("typing-dragon-portrait");
    return { left: dragon ? 820 : profile ? 40 : 20, top: profile ? 660 : 40, width: profile ? 142 : 1000, height: profile ? 142 : root ? 800 : 540 } as DOMRect;
  });
  const native = HTMLElement.prototype.animate;
  const animate = jest.fn(() => ({ cancel: jest.fn() }));
  HTMLElement.prototype.animate = animate as any;
  try {
    const view = render(<PlayerTypingBattle session={session} me={session.players[0]} code="hero0" active={false} />);
    expect(view.container.querySelectorAll(".boss-projectile")).toHaveLength(3);
    expect(getComputedStyle(screen.getByTestId("portrait-projectile-layer")).overflow).toBe("hidden");
    expect(screen.getByRole("region", { name: "Player battle scene" }).querySelectorAll(".boss-projectile")).toHaveLength(0);
    const origin = "translate(9.1%, 86.73%)";
    const calls = animate.mock.calls as any[];
    expect(calls.filter(call => call[0][0].transform === origin)).toHaveLength(2);
    expect(calls.filter(call => call[0][call[0].length-1].transform === origin)).toHaveLength(1);
    expect(calls.some(call => call[0][0].transform === "translate(87.1%, 86.73%)")).toBe(true);
    view.unmount();
  } finally { bounds.mockRestore(); HTMLElement.prototype.animate = native; }
});

test("the student dragon profile reacts only to their hits and relevant incoming attacks", () => {
  const session=room(2),now=Date.now();
  session.typing=createTypingState(1,"paladin");
  session.boss.hurt={id:"other",tier:"critical",at:now-20,until:now+1000};
  const base={kind:"damage" as const,moveId:"weak",moveLabel:"Attack",startedAt:now-900,impactAt:now-100,resolvedAt:now-100,result:"hit" as const,amount:10,target:"boss"};
  session.projectiles=[{...base,id:"mine",source:"hero0"},{...base,id:"other",source:"hero1",critical:true,resolvedAt:now-20}];
  const {rerender}=render(<PlayerTypingBattle session={session} me={session.players[0]} code="hero0" active={false} />);
  const dragon=()=>within(screen.getByTestId("dragon-portrait")).getByTestId("dragon-animation");
  expect(dragon().getAttribute("data-hurt-tier")).toBe("basic");
  const overview=screen.getByRole('region',{name:'Player battle scene'});
  expect(within(overview).getByTestId('dragon-animation').getAttribute('data-animation')).toBe('idle');
  session.projectiles=[session.projectiles[1]];
  rerender(<PlayerTypingBattle session={{...session}} me={session.players[0]} code="hero0" active={false} />);
  expect(dragon().getAttribute("data-hurt-tier")).toBeNull();
  session.projectiles=[{...base,id:"boss-attack",source:"boss",target:"hero1",kind:"boss",bossAttack:"bite",startedAt:now-50,resolvedAt:null,result:"pending"}];
  rerender(<PlayerTypingBattle session={{...session}} me={session.players[0]} code="hero0" active={false} />);
  expect(dragon().getAttribute("data-animation")).toBe("idle");
  session.projectiles=[{...session.projectiles[0],target:'hero0'}];
  rerender(<PlayerTypingBattle session={{...session}} me={session.players[0]} code="hero0" active={false} />);
  expect(dragon().getAttribute("data-animation")).toBe("bite");
});

test('roster HP and charge updates reuse portrait geometry, while new formation slots remeasure',()=>{
  const session=room(2);session.typing=createTypingState(1,'paladin');
  const bounds=jest.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:1000,height:800} as DOMRect);
  try {
    const view=render(<PlayerTypingBattle session={session} me={session.players[0]} code="hero0" active={false}/>);
    const measured=bounds.mock.calls.length;
    expect(measured).toBeGreaterThan(0);
    const updated={...session,players:session.players.map(player=>({...player,hp:80,attackProgress:60})),serverNow:Date.now()+400};
    view.rerender(<PlayerTypingBattle session={updated} me={updated.players[0]} code="hero0" active={false}/>);
    expect(bounds.mock.calls.length).toBe(measured);
    const joined={...updated,players:[...updated.players,{...updated.players[1],code:'hero2'}]};
    view.rerender(<PlayerTypingBattle session={joined} me={joined.players[0]} code="hero0" active={false}/>);
    expect(bounds.mock.calls.length).toBeGreaterThan(measured);
    view.unmount();
  } finally {bounds.mockRestore();}
});

test('joining another room resets typing even though both private-seed placeholders are zero',()=>{
  const first=room(2);first.typing={...createTypingState(0,'paladin'),nextWord:10,characters:5,wordProtocol:1,
    issuedWords:[{index:10,text:'cat',color:null,ticket:'a'.repeat(32)}]};
  const view=render(<PlayerTypingBattle session={first} me={first.players[0]} code="hero0" active={false}/>);
  expect(screen.getByLabelText('Attack power: 500')).toBeTruthy();
  const second={...first,id:'bossXYZ',typing:{...createTypingState(0,'paladin'),wordProtocol:1 as const,
    issuedWords:[{index:0,text:'dog',color:null,ticket:'b'.repeat(32)}]}};
  view.rerender(<PlayerTypingBattle session={second} me={second.players[0]} code="hero0" active={false}/>);
  expect(screen.getByLabelText('Attack power: 0')).toBeTruthy();
});


