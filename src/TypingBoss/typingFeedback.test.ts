import { createTypingState, initializeBalanced, typingWord } from "./proportionalRules";
import { chargedLetters, portraitDefense, wordReward } from "./typingFeedback";
import { portraitProjectileLayout } from "./usePortraitProjectileLayout";
import { projectileEndpoints } from "./combatFeedback";

declare const test: any, expect: any;

test("correct characters increase attack and wrong characters immediately subtract two", () => {
  const state = { ...createTypingState(1), characters: 9 };
  const word = typingWord(state).text;
  expect(chargedLetters(state, word.slice(0, 2))).toBe(11);
  expect(chargedLetters(state, `!${word.slice(1, 2)}`)).toBe(8);
  expect(chargedLetters(state, `${word} `)).toBe(10 + word.length);
});

test("portrait defenses grow with real values and clear when their stored defense is consumed", () => {
  const state = createTypingState(1, "rogue");
  const zero = portraitDefense(state, 100);
  const charged = portraitDefense({ ...state, dodgeSamples: [10], shield: .1 }, 100);
  const stronger = portraitDefense({ ...state, dodgeSamples: [25], shield: .4, paladinShield: 20 }, 100);
  expect(zero).toEqual({ dodge: 0, shield: 0 });
  expect(stronger.dodge).toBeGreaterThan(charged.dodge);
  expect(stronger.shield).toBeGreaterThan(charged.shield);
  expect(portraitDefense({ ...state, shield: 1, paladinShield: 1000 }, 100).shield).toBe(1);
  const balanced = initializeBalanced(createTypingState(1, "paladin"));
  expect(portraitDefense({ ...balanced, balancedGuard: 25, balancedGuardMax: 100 }, 100)).toEqual({ dodge: 0, shield: .25 });
  expect(portraitDefense({ ...balanced, balancedGuard: 0 }, 100)).toEqual(zero);
});

test("feedback never claims an unearned bonus for errors, capped defense, or balanced orange words", () => {
  const state = createTypingState(1, "cleric");
  expect(wordReward(state, state, "word", false, "gold").bonus).toBe(false);
  const full = { ...state, shield: 1 };
  expect(wordReward(full, full, "word", true, "blue")).toMatchObject({ label: "Block full", bonus: false });
  const balanced = initializeBalanced(state);
  expect(wordReward(balanced, balanced, "word", true, "orange")).toMatchObject({ label: "Perfect word", bonus: false });
  const growth = createTypingState(1, "cleric");
  expect(wordReward(growth, { ...growth, growth: .08 }, "word", true, null)).toMatchObject({ label: "Power +8%", bonus: true });
});

test("profile projectile routing accounts for scrolling and preserves actual support recipients", () => {
  const root = { left: 20, top: 100, width: 1000, height: 800 };
  const scene = { left: -80, top: 100, width: 1200, height: 500 };
  const profile = { left: 40, top: 700, width: 140, height: 140 };
  const points = new Map([["me", { x: 10, y: 60 }], ["ally", { x: 30, y: 60 }]]);
  const mapped = portraitProjectileLayout(root, scene, profile, points, { x: 80, y: 60 }, "me");
  expect(mapped.positions.get("me")!.x).toBe(9);
  expect(mapped.positions.get("me")!.y).toBeCloseTo(84.1);
  expect(mapped.bossPoint).toEqual({ x: 86, y: 37.5 });
  expect(mapped.positions.get("ally")).toEqual({ x: 26, y: 37.5 });
  const damage = projectileEndpoints({ source: "me", target: "boss", kind: "damage" } as any, mapped.positions, mapped.bossPoint);
  expect(damage.from).toEqual(mapped.positions.get("me"));
  expect(damage.to).toEqual(mapped.bossPoint);
  const heal = projectileEndpoints({ source: "me", target: "ally", kind: "heal" } as any, mapped.positions, mapped.bossPoint);
  expect(heal.from).toEqual(mapped.positions.get("me"));
  expect(heal.to).toEqual(mapped.positions.get("ally"));
});
