import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import DragonCombatSprite from "./DragonCombatSprite";
import { CombatAnimation, collectCombatAnimations, selectCombatAnimation } from "./combatAnimation";
import { TypingBossProjectile } from "./types";

declare const test: any, expect: any, jest: any, afterEach: any;
afterEach(() => jest.useRealTimers());

const attack: CombatAnimation = { state: "bite", id: "bite-1", at: 1000, duration: 820 };
function ready() {
  fireEvent.load(screen.getByTestId("dragon-atlas-preload"));
}

test("a late atlas load catches up to the attack and subsequent snapshots never restart it", () => {
  jest.useFakeTimers("modern"); jest.setSystemTime(1200);
  const view = render(<DragonCombatSprite bossId="infernalDragon" width={300} glow="#f00" pose={attack} />);
  expect(screen.getByTestId("dragon-animation").getAttribute("data-sprite-state")).toBe("fallback");
  act(() => jest.advanceTimersByTime(150));
  ready();
  const cell = screen.getByTestId("dragon-sprite-cell");
  expect(cell.style.animationDelay).toBe("-350ms");
  expect(screen.getByTestId("dragon-animation").className).toContain("dragon-sheet-attacking");
  act(() => jest.advanceTimersByTime(100));
  view.rerender(<DragonCombatSprite bossId="infernalDragon" width={300} glow="#f00" pose={{ ...attack }} />);
  expect(screen.getByTestId("dragon-sprite-cell")).toBe(cell);
  expect(cell.style.animationDelay).toBe("-350ms");
});

test("a damage reaction overlays the dragon's continuing attack frames", () => {
  jest.useFakeTimers("modern"); jest.setSystemTime(1300);
  const shots: TypingBossProjectile[] = [
    { id: "cast", source: "boss", target: "hero", kind: "boss", bossAttack: "tailWhip", moveLabel: "Tail Whip", startedAt: 1000, impactAt: 1700, resolvedAt: null, result: "pending", amount: null },
    { id: "hit", source: "hero", target: "boss", kind: "damage", moveLabel: "Attack", startedAt: 500, impactAt: 1200, resolvedAt: 1200, result: "hit", amount: 10 },
  ];
  const events = collectCombatAnimations(shots).get("boss")!;
  const pose = selectCombatAnimation(events, 1300);
  expect(pose.state).toBe("hit");
  const view = render(<DragonCombatSprite bossId="infernalDragon" width={300} glow="#f00" pose={pose} />);
  ready();
  expect(screen.getByTestId("dragon-animation").getAttribute("data-sprite-state")).toBe("tailWhip");
  expect(screen.getByTestId("recipient-reaction")).toBeTruthy();
  const idle = selectCombatAnimation(events, 1900);
  view.rerender(<DragonCombatSprite bossId="infernalDragon" width={300} glow="#f00" pose={idle} />);
  expect(screen.getByTestId("dragon-animation").getAttribute("data-sprite-state")).toBe("idle");
  expect(screen.getByTestId("dragon-sprite-cell").className).not.toContain("dragon-sprite-playing");
});

test("changing dragons cannot temporarily display another dragon's loaded sheet", () => {
  const view = render(<DragonCombatSprite bossId="infernalDragon" width={300} glow="#f00" pose={attack} />);
  ready();
  view.rerender(<DragonCombatSprite bossId="emberWhelp" width={300} glow="#f00" pose={attack} />);
  expect(screen.getByTestId("dragon-animation").getAttribute("data-sprite-state")).toBe("fallback");
  ready();
  expect(screen.getByTestId("dragon-sprite-cell").style.backgroundImage).toContain("ember-whelp-attacks-v2.webp");
});
