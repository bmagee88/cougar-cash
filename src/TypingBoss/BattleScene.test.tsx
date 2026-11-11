import React from "react";
import { render, screen, within } from "@testing-library/react";
import { BattleScene } from "./TypingBossApp";
import { TypingBossSessionSnapshot } from "./types";

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


