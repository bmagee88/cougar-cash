import { backRowForTeam, frontRowForTeam, type BattleGroup, type GroupRow } from "../types/battlefield";
import type { Combatant } from "../types/character";
import type { Weapon } from "../types/equipment";

export function findCombatantGroupAndRow(groups: BattleGroup[], combatantId: string): { group: BattleGroup; row: GroupRow } | undefined {
  for (const group of groups) {
    const slot = group.slots.find((candidate) => candidate.occupantId === combatantId);
    if (slot) return { group, row: slot.row };
  }
  return undefined;
}

function frontRowOccupiedByTeam(group: BattleGroup, combatants: Record<string, Combatant>, team: Combatant["team"]): boolean {
  const frontRow = frontRowForTeam(team);
  return group.slots.some((slot) => {
    const occupant = slot.occupantId ? combatants[slot.occupantId] : undefined;
    return slot.row === frontRow && occupant?.team === team;
  });
}

export function canMeleeAttack(params: {
  attacker: Combatant;
  defender: Combatant;
  weapon: Weapon;
  attackerGroup: BattleGroup;
  defenderGroup: BattleGroup;
  attackerRow: GroupRow;
  defenderRow: GroupRow;
  combatants: Record<string, Combatant>;
}): { allowed: boolean; reason: string } {
  const { attacker, defender, weapon, attackerGroup, defenderGroup, attackerRow, defenderRow, combatants } = params;

  if (attackerGroup.id !== defenderGroup.id) {
    return { allowed: false, reason: "Melee attacks cannot target a different group." };
  }

  if (attacker.team === defender.team) {
    return { allowed: false, reason: "Cannot melee attack a character on the same team." };
  }

  const attackerFront = frontRowForTeam(attacker.team);
  const attackerBack = backRowForTeam(attacker.team);
  const defenderFront = frontRowForTeam(defender.team);
  const defenderBack = backRowForTeam(defender.team);
  const defenderFrontOccupied = frontRowOccupiedByTeam(defenderGroup, combatants, defender.team);

  if (attackerRow === attackerFront && defenderRow === defenderFront) {
    return { allowed: true, reason: "Front row can attack enemy front row." };
  }

  if (attackerRow === attackerFront && defenderRow === defenderBack) {
    if (defenderFrontOccupied && weapon.reach === "none") {
      return { allowed: false, reason: "Enemy front row blocks attacks against the back row without reach." };
    }
    return weapon.reach === "reach" || weapon.reach === "doubleReach"
      ? { allowed: true, reason: "Reach allows front row to attack the enemy back row." }
      : { allowed: true, reason: "Enemy back row is exposed because the front row is empty." };
  }

  if (attackerRow === attackerBack && defenderRow === defenderFront) {
    return weapon.reach === "reach" || weapon.reach === "doubleReach"
      ? { allowed: true, reason: "Reach allows back row to attack enemy front row." }
      : { allowed: false, reason: "Back row needs reach to attack enemy front row." };
  }

  if (attackerRow === attackerBack && defenderRow === defenderBack) {
    return weapon.reach === "doubleReach"
      ? { allowed: true, reason: "Double reach allows back row to attack enemy back row." }
      : { allowed: false, reason: "Back row needs double reach to attack enemy back row." };
  }

  return { allowed: false, reason: "Unsupported row relationship." };
}
