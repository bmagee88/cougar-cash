import type { BattleState } from "../types/combat";
import { createInitialCombatants } from "./characters";

export function createInitialState(): BattleState {
  return {
    combatants: createInitialCombatants(),
    groups: [
      {
        id: "ruined-yard",
        name: "Ruined Yard",
        effects: ["crowded", "broken stones"],
        combatantIds: ["aria", "borin", "goblin", "brute"],
      },
    ],
    tavernIds: [],
    lairIds: [],
    log: ["Combat simulator ready. Generate characters, swap them in, or step through an attack."],
  };
}
