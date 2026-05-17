import type { BattleGroup, BattleState, GroupRow } from "../types/battlefield";
import { sampleCombatants } from "./sampleCharacters";

function makeSlots(prefix: string, occupants: Partial<Record<string, string>> = {}) {
  const slots = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const key = `${row}-${col}`;
      slots.push({
        id: `${prefix}-${key}`,
        row: row as GroupRow,
        col: col as 0 | 1 | 2 | 3,
        occupantId: occupants[key],
        effects: [],
      });
    }
  }
  return slots;
}

export const sampleGroups: BattleGroup[] = [
  {
    id: "courtyard",
    name: "Courtyard",
    gridX: 0,
    gridY: 0,
    effects: [{ id: "crowded", name: "Crowded", description: "Movement is messy and reactions are dangerous." }],
    slots: makeSlots("courtyard", {
      "1-1": "hero1",
      "0-2": "hero2",
      "2-1": "enemy1",
      "3-2": "enemy2",
    }),
  },
  {
    id: "bridge",
    name: "Bridge",
    gridX: 1,
    gridY: 0,
    effects: [{ id: "high-ground", name: "High Ground", description: "This group sits higher than the surrounding area." }],
    slots: makeSlots("bridge"),
  },
];

export const initialBattleState: BattleState = {
  groups: sampleGroups,
  combatants: sampleCombatants,
  environmentEffects: [{ id: "clear", name: "Clear", description: "No major battlefield-wide effect." }],
  activeCombatantId: "hero1",
  log: ["Combat simulator loaded."],
};
