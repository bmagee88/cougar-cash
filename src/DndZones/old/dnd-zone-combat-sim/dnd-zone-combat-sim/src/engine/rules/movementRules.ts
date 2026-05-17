import type { BattleState, GroupRow } from "../types/battlefield";
import { backRowForTeam } from "../types/battlefield";
import { findCombatantGroupAndRow } from "./reachRules";

export function moveCombatantToOpenSlot(state: BattleState, combatantId: string, groupId: string, row: GroupRow): BattleState {
  const targetGroup = state.groups.find((group) => group.id === groupId);
  if (!targetGroup) throw new Error("Target group not found.");
  const openSlot = targetGroup.slots.find((slot) => slot.row === row && !slot.occupantId);
  if (!openSlot) throw new Error("No open slot in that row.");

  return {
    ...state,
    groups: state.groups.map((group) => ({
      ...group,
      slots: group.slots.map((slot) => {
        if (slot.occupantId === combatantId) return { ...slot, occupantId: undefined };
        if (group.id === groupId && slot.id === openSlot.id) return { ...slot, occupantId: combatantId };
        return slot;
      }),
    })),
    log: [`${state.combatants[combatantId].name} moves to ${targetGroup.name}.`, ...state.log].slice(0, 50),
  };
}

export function knockBack(state: BattleState, combatantId: string, fallbackGroupId?: string): BattleState {
  const combatant = state.combatants[combatantId];
  const location = findCombatantGroupAndRow(state.groups, combatantId);
  if (!combatant || !location) return state;

  const backRow = backRowForTeam(combatant.team);
  if (location.row !== backRow) {
    try {
      return moveCombatantToOpenSlot(state, combatantId, location.group.id, backRow);
    } catch {
      return {
        ...state,
        combatants: {
          ...state.combatants,
          [combatantId]: {
            ...combatant,
            statuses: [...combatant.statuses, { id: "prone", name: "Prone", category: "movement", description: "Fell prone after blocked knockback.", duration: "endOfTurn" }],
          },
        },
        log: [`${combatant.name} cannot be knocked back and falls prone.`, ...state.log].slice(0, 50),
      };
    }
  }

  if (fallbackGroupId) return moveCombatantToOpenSlot(state, combatantId, fallbackGroupId, backRow);
  return state;
}
