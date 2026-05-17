import type { BattleState } from "../types/battlefield";
import type { AttackIntent, AttackResult } from "../types/combat";
import type { WeaponProficiency } from "../types/equipment";
import { findCombatantGroupAndRow, canMeleeAttack } from "./reachRules";
import { calculateEvasion } from "./evasionResolver";
import { chooseBestAttackerAdjustment, chooseBestDefenderAdjustment, rollInitialMarker } from "./targetingRules";
import { applyArmorMitigation, calculateTypedDamage } from "./damageResolver";

export function getWeaponSkillAdjustment(state: BattleState, attackerId: string, weaponId: string): number {
  const attacker = state.combatants[attackerId];
  const weapon = attacker.equipment.weapons.find((candidate) => candidate.id === weaponId);
  if (!weapon) return 0;

  const attunementLevel = attacker.progression.weaponAttunements[weaponId]?.level ?? 0;
  const proficiency: WeaponProficiency = attacker.progression.weaponProficiencies[weapon.weaponType] ?? 0;
  return attunementLevel + proficiency;
}

export function addWeaponXp(state: BattleState, attackerId: string, weaponId: string): BattleState {
  const attacker = state.combatants[attackerId];
  const existing = attacker.progression.weaponAttunements[weaponId] ?? { weaponId, xp: 0, level: 0 };
  const nextXp = existing.xp + 1;
  const nextLevel = nextXp >= 40 ? 4 : nextXp >= 25 ? 3 : nextXp >= 12 ? 2 : nextXp >= 4 ? 1 : 0;

  return {
    ...state,
    combatants: {
      ...state.combatants,
      [attackerId]: {
        ...attacker,
        progression: {
          ...attacker.progression,
          weaponAttunements: {
            ...attacker.progression.weaponAttunements,
            [weaponId]: { weaponId, xp: nextXp, level: nextLevel },
          },
        },
      },
    },
  };
}

export function resolveAttack(state: BattleState, intent: AttackIntent): { state: BattleState; result: AttackResult } {
  const attacker = state.combatants[intent.attackerId];
  const defender = state.combatants[intent.defenderId];
  if (!attacker || !defender) throw new Error("Missing attacker or defender.");

  const weapon = attacker.equipment.weapons.find((candidate) => candidate.id === intent.weaponId);
  if (!weapon) throw new Error(`${attacker.name} does not have that weapon equipped.`);

  const attackerLocation = findCombatantGroupAndRow(state.groups, attacker.id);
  const defenderLocation = findCombatantGroupAndRow(state.groups, defender.id);
  if (!attackerLocation || !defenderLocation) throw new Error("Missing attacker or defender location.");

  if (!weapon.isTrueRanged) {
    const meleeCheck = canMeleeAttack({
      attacker,
      defender,
      weapon,
      attackerGroup: attackerLocation.group,
      defenderGroup: defenderLocation.group,
      attackerRow: attackerLocation.row,
      defenderRow: defenderLocation.row,
      combatants: state.combatants,
    });
    if (!meleeCheck.allowed) throw new Error(meleeCheck.reason);
  }

  const initialMarker = rollInitialMarker(intent.move, intent.chosenBodyPartId);
  const defenderEvasion = calculateEvasion(defender);
  const defenseChoice = chooseBestDefenderAdjustment(initialMarker, defenderEvasion, defender.equipment.armor);
  const markerAfterDefense = initialMarker + defenseChoice.adjustment;
  const attackerAdjustmentPower = getWeaponSkillAdjustment(state, attacker.id, weapon.id);
  const attackChoice = chooseBestAttackerAdjustment(markerAfterDefense, attackerAdjustmentPower, defender.equipment.armor);
  const finalMarker = markerAfterDefense + attackChoice.adjustment;
  const evaluation = attackChoice.evaluation;

  const { baseDamage, typedDamage } = calculateTypedDamage(attacker, weapon, intent.damageType);
  const armorResult = evaluation.kind === "armor"
    ? applyArmorMitigation(typedDamage, evaluation.armorPieces, intent.damageType)
    : { finalDamage: typedDamage, mitigatedDamage: 0 };

  const finalDamage = evaluation.kind === "miss" ? 0 : Math.round(armorResult.finalDamage * 10) / 10;
  const critApplied = evaluation.kind === "flesh" || (evaluation.kind === "armor" && weapon.effects.some((effect) => effect.allowsArmorCrit));

  let defenderAfter = defender;
  if (finalDamage > 0) {
    const maxFightDamage = defender.health.fight <= 0 && critApplied ? Math.ceil(finalDamage / 2) : 0;
    defenderAfter = {
      ...defender,
      health: {
        ...defender.health,
        fight: Math.max(0, Math.round((defender.health.fight - finalDamage) * 10) / 10),
        maxFight: Math.max(0, defender.health.maxFight - maxFightDamage),
      },
      statuses: critApplied && weapon.critEffects[intent.damageType]?.statusToApply
        ? [...defender.statuses, weapon.critEffects[intent.damageType]!.statusToApply!]
        : defender.statuses,
    };
  }

  const resultLogs = [
    `${attacker.name} attacks ${defender.name} with ${weapon.name}.`,
    `Initial marker: ${initialMarker}. Defender shifts ${defenseChoice.adjustment}. Attacker shifts ${attackChoice.adjustment}. Final marker: ${finalMarker}.`,
    evaluation.reason,
    evaluation.kind === "armor" ? `Armor layers: ${evaluation.armorPieces.map((armor) => armor.name).join(", ")}.` : "",
    evaluation.kind === "miss" ? "The attack misses." : `Damage: ${finalDamage}. ${critApplied ? "Critical effect applied." : "No critical effect."}`,
  ].filter(Boolean);

  const stateWithDamage: BattleState = {
    ...state,
    combatants: {
      ...state.combatants,
      [defender.id]: defenderAfter,
    },
    log: [...resultLogs, ...state.log].slice(0, 50),
  };

  const stateWithXp = addWeaponXp(stateWithDamage, attacker.id, weapon.id);

  return {
    state: stateWithXp,
    result: {
      attacker,
      defender,
      weapon,
      attackerGroup: attackerLocation.group,
      defenderGroup: defenderLocation.group,
      attackerRow: attackerLocation.row,
      defenderRow: defenderLocation.row,
      initialMarker,
      defenderAdjustment: defenseChoice.adjustment,
      attackerAdjustment: attackChoice.adjustment,
      finalMarker,
      evaluation,
      baseDamage,
      typedDamage,
      mitigatedDamage: Math.round(armorResult.mitigatedDamage * 10) / 10,
      finalDamage,
      critApplied,
      logs: resultLogs,
    },
  };
}
