import React from "react";
import { render, screen, within } from "@testing-library/react";
import { BattleScene, PlayerTypingBattle } from "./TypingBossApp";
import { TypingBossSessionSnapshot } from "./types";
import { createTypingState } from "./proportionalRules";

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

test.each([10, 11, 20, 21, 30])("host and client share the battlefield and density at %i players", count => {
  const session = room(count);
  const { rerender } = render(<BattleScene session={session} />);
  const host = screen.getByRole("region", { name: "Host battle scene" });
  const sceneBefore = host.innerHTML;
  expect(screen.queryByRole("img", { name: "Your character" })).toBeNull();
  expect(within(host).queryByText("Hero 0") !== null).toBe(count <= 10);
  expect(within(host).queryAllByRole("progressbar")).toHaveLength(1 + (count <= 20 ? count : 0));
  const charge = within(host).queryByRole("progressbar", { name: "Hero 0 attack progress" });
  expect(charge ? getComputedStyle(charge).height : undefined).toBe(count > 20 ? undefined : count > 10 ? "2px" : "4px");

  // Mark even a knocked-out player. Removing the local marker/glow restores the
  // exact host scene: no reordered party, alternate camera or different sizing.
  rerender(<BattleScene session={session} ownCode={`hero${count - 1}`} />);
  expect(screen.getByRole("region", { name: "Player battle scene" })).toBeTruthy();
  expect(screen.getAllByRole("img", { name: "Your character" })).toHaveLength(1);
  rerender(<BattleScene session={session} />);
  expect(screen.getByRole("region").innerHTML).toBe(sceneBefore);
});

test("personal projectiles launch from the typing portrait exactly once while other players stay in the scene", () => {
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
    expect(view.container.querySelectorAll(".boss-projectile")).toHaveLength(4);
    expect(getComputedStyle(screen.getByTestId("portrait-projectile-layer")).overflow).toBe("hidden");
    expect(screen.getByRole("region", { name: "Player battle scene" }).querySelectorAll(".boss-projectile")).toHaveLength(1);
    const origin = "translate(9.1%, 86.73%)";
    const calls = animate.mock.calls as any[];
    expect(calls.filter(call => call[0][0].transform === origin)).toHaveLength(2);
    expect(calls.filter(call => call[0][call[0].length-1].transform === origin)).toHaveLength(1);
    expect(calls.some(call => call[0][0].transform === "translate(87.1%, 86.73%)")).toBe(true);
    view.unmount();
  } finally { bounds.mockRestore(); HTMLElement.prototype.animate = native; }
});

test("the client dragon profile reflects the full shared dragon and all attacks", () => {
  const session=room(2),now=Date.now();
  session.typing=createTypingState(1,"paladin");
  session.boss.hurt={id:"other",tier:"critical",at:now-20,until:now+1000};
  const base={kind:"damage" as const,moveId:"weak",moveLabel:"Attack",startedAt:now-900,impactAt:now-100,resolvedAt:now-100,result:"hit" as const,amount:10,target:"boss"};
  session.projectiles=[{...base,id:"mine",source:"hero0"},{...base,id:"other",source:"hero1",critical:true,resolvedAt:now-20}];
  const {rerender}=render(<PlayerTypingBattle session={session} me={session.players[0]} code="hero0" active={false} />);
  const dragon=()=>within(screen.getByTestId("dragon-portrait")).getByTestId("dragon-animation");
  expect(dragon().getAttribute("data-hurt-tier")).toBe("critical");
  session.projectiles=[session.projectiles[1]];
  rerender(<PlayerTypingBattle session={{...session}} me={session.players[0]} code="hero0" active={false} />);
  expect(dragon().getAttribute("data-hurt-tier")).toBe("critical");
  session.boss.hurt=null;
  session.projectiles=[{...base,id:"boss-attack",source:"boss",target:"hero1",kind:"boss",bossAttack:"bite",startedAt:now-50,resolvedAt:null,result:"pending"}];
  rerender(<PlayerTypingBattle session={{...session}} me={session.players[0]} code="hero0" active={false} />);
  expect(dragon().getAttribute("data-animation")).toBe("bite");
});


