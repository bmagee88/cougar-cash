import React, { useRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { CombatAnimation, CombatAnimationEvent } from "./combatAnimation";
import DragonCombatSprite from "./DragonCombatSprite";
import { selectDragonCombatAnimation, useDragonCombatAnimation } from "./useDragonCombatAnimation";
import { DRAGON_HURT } from "./dragonHurtRules";
import { DragonHurt, DragonHurtTier } from "./types";

declare const test: any, expect: any, jest: any, afterEach: any;
afterEach(() => jest.useRealTimers());
const attack: CombatAnimationEvent = { id: "cast", state: "bite", at: 1000, duration: 820, channel: "action" };
const hurt = (tier: DragonHurtTier): DragonHurt => ({ id: `${tier}-hit`, tier, at: 1000, until: 1000 + DRAGON_HURT[tier].duration });

test("dragon attacks override basic hurt, but power and critical hurt suppress even a concurrent action", () => {
  expect(selectDragonCombatAnimation([attack], hurt("basic"), 1100).state).toBe("bite");
  for (const tier of ["power", "critical"] as const) {
    const pose = selectDragonCombatAnimation([attack], hurt(tier), 1100);
    expect(pose.state).toBe("hit"); expect(pose.hurtTier).toBe(tier); expect(pose.action).toBeUndefined();
  }
});

test("lower hit updates cannot restart an authoritative critical, and death cancels it", () => {
  const critical = hurt("critical");
  const lower: CombatAnimationEvent = { id: "weak", state: "hit", at: 1100, duration: 460, channel: "reaction", hurtTier: "basic" };
  const first = selectDragonCombatAnimation([], critical, 1050);
  const second = selectDragonCombatAnimation([lower], critical, 1150);
  expect(second.id).toBe(first.id); expect(second.at).toBe(first.at); expect(second.nextAt).toBe(critical.until);
  expect(selectDragonCombatAnimation([lower], critical, 1200, true).state).toBe("death");
  expect(selectDragonCombatAnimation([lower], critical, 2500).state).toBe("idle");
});

test("legacy snapshots still honor the full hurt severity rather than the latest low hit", () => {
  const events: CombatAnimationEvent[] = [
    { id: "critical", state: "hit", at: 1000, duration: 460, channel: "reaction", hurtTier: "critical" },
    { id: "weak", state: "hit", at: 1100, duration: 460, channel: "reaction", hurtTier: "basic" },
    { id: "power", state: "hit", at: 1200, duration: 460, channel: "reaction", hurtTier: "power" },
  ];
  expect(selectDragonCombatAnimation(events, undefined, 1500).hurtTier).toBe("critical");
  expect(selectDragonCombatAnimation(events, undefined, 1500).at).toBe(1000);
});

test.each([["basic",3],["power",6],["critical",10]])("%s pain renders exactly %i discrete frames and supports inspecting the last frame", (tier: DragonHurtTier, count: number) => {
  jest.useFakeTimers("modern"); jest.setSystemTime(1050);
  const reaction = hurt(tier);
  const pose: CombatAnimation = { state: "hit", id: reaction.id, at: reaction.at, duration: DRAGON_HURT[tier].duration, hurtTier: tier };
  const view = render(<DragonCombatSprite bossId="infernalDragon" width={300} glow="#f00" pose={pose} inspectFrame={99} />);
  fireEvent.load(screen.getByTestId("dragon-atlas-preload"));
  fireEvent.load(screen.getByTestId("dragon-hurt-preload"));
  const cell = screen.getByTestId("dragon-sprite-cell");
  expect(cell.getAttribute("data-frame-count")).toBe(String(count));
  expect(cell.style.backgroundPositionX).toBe(`${(count-1)/9*100}%`);
  expect(screen.getByTestId("dragon-animation").getAttribute("data-sprite-state")).toBe(`hurt-${tier}`);
  view.unmount();
});

test("late-loading hurt artwork catches up without replaying its wind-up", () => {
  jest.useFakeTimers("modern"); jest.setSystemTime(1100);
  const pose: CombatAnimation = { state: "hit", id: "critical", at: 1000, duration: 1200, hurtTier: "critical" };
  const view = render(<DragonCombatSprite bossId="cindermaw" width={300} glow="#f00" pose={pose} />);
  act(() => jest.advanceTimersByTime(300));
  fireEvent.load(screen.getByTestId("dragon-hurt-preload"));
  const cell = screen.getByTestId("dragon-sprite-cell");
  expect(cell.style.animationDelay).toBe("-400ms");
  act(() => jest.advanceTimersByTime(100));
  view.rerender(<DragonCombatSprite bossId="cindermaw" width={300} glow="#f00" pose={{ ...pose }} />);
  expect(screen.getByTestId("dragon-sprite-cell")).toBe(cell);
  expect(cell.style.animationDelay).toBe("-400ms");
});

function Harness({ reaction }: { reaction: DragonHurt }) {
  const clock = useRef(0), pose = useDragonCombatAnimation([], reaction, false, clock);
  return <span data-testid="pose">{pose.state}</span>;
}
test("hurt expiry returns the dragon to idle without another network update", () => {
  jest.useFakeTimers("modern"); jest.setSystemTime(1000);
  const view = render(<Harness reaction={hurt("critical")} />);
  expect(screen.getByTestId("pose").textContent).toBe("hit");
  act(() => jest.advanceTimersByTime(1210));
  expect(screen.getByTestId("pose").textContent).toBe("idle");
  view.unmount(); expect(jest.getTimerCount()).toBe(0);
});
