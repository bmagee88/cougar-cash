import type { AttackMove, AttackPlan, BattleState, Combatant } from "../types/combat";
import { moveAllowedInitialParts, moveDamageType } from "../data/bodyMap";
import { clamp } from "../utils/math";
import { uid } from "../utils/random";
import { getAttackAdjustment, getEvasion } from "./characterRules";
import { calculateDamageDetails, getDamageMultiplier } from "./damageRules";
import { moveLabel } from "./labels";
import { canMeleeAttack, getHitEvaluation, rollInitialMarkerForMove } from "./targetingRules";

function directionText(shift: number): string {
  if (shift > 0) return `up ${Math.abs(shift)}`;
  if (shift < 0) return `down ${Math.abs(shift)}`;
  return "0";
}

function chooseBestDefenderShift(defender: Combatant, marker: number, evasion: number): number {
  let bestShift = 0;
  let bestScore = -Infinity;

  for (let shift = -evasion; shift <= evasion; shift++) {
    const score = getHitEvaluation(defender, marker + shift).scoreForDefender;
    if (score > bestScore) {
      bestScore = score;
      bestShift = shift;
    }
  }

  return bestShift;
}

function chooseBestAttackerShift(defender: Combatant, marker: number, adjustment: number): number {
  let bestShift = 0;
  let bestScore = -Infinity;

  for (let shift = -adjustment; shift <= adjustment; shift++) {
    const score = getHitEvaluation(defender, marker + shift).scoreForAttacker;
    if (score > bestScore) {
      bestScore = score;
      bestShift = shift;
    }
  }

  return bestShift;
}

export function buildAttackPlan(
  state: BattleState,
  attackerId: string,
  defenderId: string,
  weaponId: string,
  move: AttackMove,
): AttackPlan | null {
  const attacker = state.combatants[attackerId];
  const defender = state.combatants[defenderId];
  const weapon = attacker?.weapons.find((w) => w.id === weaponId) ?? attacker?.weapons[0];

  if (!attacker || !defender || !weapon) return null;

  const messages: string[] = [];
  messages.push(`${attacker.name} attacks ${defender.name} with ${weapon.name} using ${moveLabel(move).toLowerCase()}.`);

  if (!canMeleeAttack(attacker, defender, weapon)) {
    messages.push(`The attack cannot reach from row ${attacker.row} to row ${defender.row}.`);
    return null;
  }

  const damageType = moveDamageType[move];
  const initialRoll = rollInitialMarkerForMove(move);
  const initialMarker = initialRoll.marker;
  const initialBodyPart = initialRoll.bodyPart;

  const defenderShift = chooseBestDefenderShift(defender, initialMarker, getEvasion(defender));
  const afterDefenderMarker = initialMarker + defenderShift;

  const attackerShift = chooseBestAttackerShift(defender, afterDefenderMarker, getAttackAdjustment(attacker, weapon));
  const finalMarker = afterDefenderMarker + attackerShift;

  const evaluation = getHitEvaluation(defender, finalMarker);

  const damageDetails =
    evaluation.kind === "miss"
      ? {
          force: attacker.stats.physicalStrength * weapon.weight,
          multiplier: getDamageMultiplier(weapon, damageType),
          rawDamage: 0,
          mitigationDetails: [],
          totalMitigation: 0,
          finalDamage: 0,
        }
      : calculateDamageDetails(attacker, weapon, damageType, evaluation.armor);

  const armorNames = evaluation.armor.map((piece) => piece.name);
  const critEffect =
    evaluation.kind === "flesh" || (evaluation.kind === "armor" && weapon.canCritArmor)
      ? weapon.critEffects[damageType]
      : undefined;

  const fightAfterDamage = clamp(defender.fight - damageDetails.finalDamage, 0, defender.maxFight);

  const finalHitLabel =
    evaluation.kind === "miss"
      ? "miss"
      : evaluation.kind === "armor"
        ? `armor (${armorNames.join(", ")})`
        : `flesh (${evaluation.bodyPart})`;

  messages.push(
    `Initial marker placed on ${initialBodyPart ?? "miss"} at ${initialMarker}. ${moveLabel(move)} can only initially target: ${moveAllowedInitialParts[move].join(", ")}.`,
  );
  messages.push(`${defender.name} uses evade ${directionText(defenderShift)} from ${initialMarker} to ${afterDefenderMarker}.`);
  messages.push(
    `${attacker.name} uses weapon skill ${directionText(attackerShift)} from ${afterDefenderMarker} to ${finalMarker}, which hits **${finalHitLabel}**.`,
  );
  messages.push(`${attacker.name}'s strength is ${attacker.stats.physicalStrength}.`);
  messages.push(`${weapon.name}'s ${damageType} multiplier is ${damageDetails.multiplier.toFixed(1)}.`);

  if (evaluation.kind === "miss") {
    messages.push(
      `${attacker.name}'s Strength ${attacker.stats.physicalStrength} using ${weapon.name}, whose weight is ${weapon.weight}, would strike with a force of ${damageDetails.force}. The ${damageType} multiplier is ${damageDetails.multiplier.toFixed(1)}, but the attack misses and ${defender.name} takes 0 damage.`,
    );
  } else if (evaluation.kind === "armor") {
    const mitigationText = damageDetails.mitigationDetails.map((detail) => `${detail.armorName} mitigates ${detail.mitigation}`).join("; ");
    messages.push(
      `${attacker.name}'s Strength ${attacker.stats.physicalStrength} using ${weapon.name}, whose weight is ${weapon.weight}, strikes ${defender.name}'s ${evaluation.bodyPart} with a force of ${damageDetails.force}. The ${damageType} multiplier is ${damageDetails.multiplier.toFixed(1)}, making raw damage ${damageDetails.rawDamage.toFixed(1)} before armor.`,
    );
    messages.push(`${defender.name}'s armor is ${armorNames.join(", ")} and mitigates ${damageDetails.totalMitigation} total (${mitigationText}).`);
    messages.push(`${defender.name} takes ${damageDetails.finalDamage}, lowering their Fight to ${fightAfterDamage}.`);
    if (critEffect) messages.push(`Armor crit effect: ${critEffect}.`);
  } else {
    messages.push(
      `${attacker.name}'s Strength ${attacker.stats.physicalStrength} using ${weapon.name}, whose weight is ${weapon.weight}, strikes ${defender.name}'s ${evaluation.bodyPart} with a force of ${damageDetails.force}.`,
    );
    messages.push(
      `It hits flesh, so ${damageType} uses the ${weapon.name}'s ${damageDetails.multiplier.toFixed(1)} multiplier, making raw damage ${damageDetails.rawDamage.toFixed(1)} with no armor mitigation.`,
    );
    messages.push(`${defender.name} takes ${damageDetails.finalDamage}, lowering their Fight to ${fightAfterDamage}.`);
    if (critEffect) messages.push(`Critical effect: ${critEffect}.`);
  }

  return {
    attackerId,
    defenderId,
    weaponId: weapon.id,
    move,
    damageType,
    initialMarker,
    initialBodyPart,
    defenderShift,
    afterDefenderMarker,
    attackerShift,
    finalMarker,
    hitKind: evaluation.kind,
    bodyPart: evaluation.bodyPart,
    armorNames,
    damage: damageDetails.finalDamage,
    critEffect,
    ...damageDetails,
    messages,
    applied: false,
  };
}

export function applyAttackPlan(state: BattleState, plan: AttackPlan): BattleState {
  if (plan.applied) return state;

  const attacker = state.combatants[plan.attackerId];
  const defender = state.combatants[plan.defenderId];
  const weapon = attacker?.weapons.find((w) => w.id === plan.weaponId);

  if (!attacker || !defender || !weapon) return state;

  const updatedDefender: Combatant = {
    ...defender,
    fight: clamp(defender.fight - plan.damage, 0, defender.maxFight),
    statuses:
      plan.critEffect && plan.hitKind === "flesh"
        ? [
            ...defender.statuses,
            {
              id: uid("status"),
              name: plan.critEffect,
              duration: "endOfBattle",
              description: `Applied by ${weapon.name}`,
            },
          ]
        : defender.statuses,
  };

  const oldAttune = attacker.weaponAttunement[weapon.id] ?? { xp: 0, level: 0 };
  const newXp = oldAttune.xp + 1;
  const newLevel = clamp(Math.floor(newXp / 5), 0, 4) as 0 | 1 | 2 | 3 | 4;

  const updatedAttacker: Combatant = {
    ...attacker,
    weaponAttunement: {
      ...attacker.weaponAttunement,
      [weapon.id]: { xp: newXp, level: newLevel },
    },
  };

  return {
    ...state,
    combatants: {
      ...state.combatants,
      [attacker.id]: updatedAttacker,
      [defender.id]: updatedDefender,
    },
    log: [...plan.messages, ...state.log],
  };
}
