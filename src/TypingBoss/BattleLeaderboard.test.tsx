import React from "react";
import { render, screen } from "@testing-library/react";
import BattleLeaderboard from "./BattleLeaderboard";
import { TypingBossLeaderboardEntry } from "./types";

declare const test: any, expect: any;

test("ending leaderboard shows total damage, strongest attack breakdown, and players without attacks", () => {
  const entries: TypingBossLeaderboardEntry[] = [
    { rank: 1, code: "a", name: "Ada", totalDamage: 500, strongestAttack: {
      base: 50, power: 192, actualDamage: 144, blockedDamage: 48, consistency: 1.5,
      multiplier: 3.84, orangeBonus: .2, greenBonus: .08, greenStacks: 2,
      criticalChance: .3, critical: true, moveId: "strong", attackNumber: 3, landedAt: 1000,
      blueShield: .1, meanIntervalMs: 200, intervalStdDevMs: 0,
    } },
    { rank: 2, code: "b", name: "Ben", totalDamage: 0, strongestAttack: null },
  ];
  render(<BattleLeaderboard entries={entries} />);
  expect(screen.getByText("#1 Ada")).toBeTruthy();
  expect(screen.getByText("500 total damage")).toBeTruthy();
  expect(screen.getByText("Magnitude: 50 characters")).toBeTruthy();
  expect(screen.getByText("Consistency: ×1.5")).toBeTruthy();
  expect(screen.getByText("Orange: +20%")).toBeTruthy();
  expect(screen.getByText("Green: +8% (2 stacked)")).toBeTruthy();
  expect(screen.getByText("Red: 30% crit chance")).toBeTruthy();
  expect(screen.getByText("Critical: Yes · ×2")).toBeTruthy();
  expect(screen.getByText("Shield blocked: 48")).toBeTruthy();
  expect(screen.getByText("Blue shield ready at release: 10%")).toBeTruthy();
  expect(screen.getByText("Mean key gap: 200 ms")).toBeTruthy();
  expect(screen.getByText("No attacks landed this battle.")).toBeTruthy();
});
