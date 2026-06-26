import type { ArmorPiece, AttackMove, BattleState, BodyPart, Combatant, HitKind, RowIndex, Team, Weapon } from "../types/combat";
import { BODY_SCALE_MAX, BODY_SCALE_MIN, bodyMap, missZones, moveAllowedInitialParts, moveTargetRanges } from "../data/bodyMap";
import { clamp, inRange } from "../utils/math";
import { randomInt } from "../utils/random";

export function getBodyPart(marker: number): BodyPart | undefined {
  return bodyMap.find((range) => inRange(marker, range))?.part;
}

export function isMiss(marker: number): boolean {
  return marker < BODY_SCALE_MIN || marker > BODY_SCALE_MAX || missZones.some((zone) => inRange(marker, zone));
}

export function armorAtMarker(defender: Combatant, marker: number): ArmorPiece[] {
  return defender.armor.filter((piece) => piece.coverageRanges.some((range) => inRange(marker, range)));
}

export function getHitEvaluation(
  defender: Combatant,
  marker: number,
): {
  kind: HitKind;
  bodyPart?: BodyPart;
  armor: ArmorPiece[];
  scoreForDefender: number;
  scoreForAttacker: number;
} {
  if (isMiss(marker)) {
    return { kind: "miss", armor: [], scoreForDefender: 1000, scoreForAttacker: -1000 };
  }

  const part = getBodyPart(marker);
  if (!part) {
    return { kind: "miss", armor: [], scoreForDefender: 1000, scoreForAttacker: -1000 };
  }

  const armor = armorAtMarker(defender, marker);
  if (armor.length > 0) {
    return {
      kind: "armor",
      bodyPart: part,
      armor,
      scoreForDefender: 300 + armor.length * 75,
      scoreForAttacker: 200 - armor.length * 40,
    };
  }

  const bodyDanger: Record<BodyPart, number> = {
    head: 900,
    neck: 850,
    chest: 650,
    shoulders: 450,
    arms: 400,
    hands: 375,
    legs: 350,
    feet: 250,
  };

  return {
    kind: "flesh",
    bodyPart: part,
    armor: [],
    scoreForDefender: -bodyDanger[part],
    scoreForAttacker: bodyDanger[part],
  };
}

export function rollInitialMarkerForMove(move: AttackMove): { marker: number; bodyPart?: BodyPart } {
  const targetRange = moveTargetRanges[move];
  const allowedParts = moveAllowedInitialParts[move];

  for (let attempt = 0; attempt < 100; attempt++) {
    const marker = randomInt(targetRange.start, targetRange.end);
    const bodyPart = getBodyPart(marker);
    if (bodyPart && allowedParts.includes(bodyPart)) return { marker, bodyPart };
  }

  const fallbackPart = allowedParts[0];
  const fallbackRange = bodyMap.find((range) => range.part === fallbackPart);
  const marker = fallbackRange ? randomInt(fallbackRange.start, fallbackRange.end) : randomInt(targetRange.start, targetRange.end);
  return { marker, bodyPart: getBodyPart(marker) };
}

function frontRowForTeam(team: Team): RowIndex {
  return team === "heroes" ? 1 : 2;
}

function hasLivingFrontRow(state: BattleState | undefined, team: Team): boolean {
  if (!state) return true;
  const frontRow = frontRowForTeam(team);

  return state.groups[0].combatantIds.some((id) => {
    const character = state.combatants[id];
    return character?.team === team && character.row === frontRow && character.fight > 0;
  });
}

function effectiveRowForReach(character: Combatant, state?: BattleState): RowIndex {
  const frontRow = frontRowForTeam(character.team);
  const backRow = character.team === "heroes" ? 0 : 3;

  if (character.row === backRow && !hasLivingFrontRow(state, character.team)) return frontRow;
  return character.row;
}

export function canMeleeAttack(attacker: Combatant, defender: Combatant, weapon: Weapon, state?: BattleState): boolean {
  if (attacker.team === defender.team) return false;

  const attackerRow = effectiveRowForReach(attacker, state);
  const defenderRow = effectiveRowForReach(defender, state);
  const attackerFront = attackerRow === 1 || attackerRow === 2;
  const attackerBack = attackerRow === 0 || attackerRow === 3;
  const defenderFront = defenderRow === 1 || defenderRow === 2;
  const defenderBack = defenderRow === 0 || defenderRow === 3;

  if (attackerFront && defenderFront) return true;
  if (attackerFront && defenderBack) return weapon.reach === "reach" || weapon.reach === "doubleReach";
  if (attackerBack && defenderFront) return weapon.reach === "reach" || weapon.reach === "doubleReach";
  if (attackerBack && defenderBack) return weapon.reach === "doubleReach";

  return false;
}

export function markerBottom(marker: number): string {
  return `${clamp((marker / BODY_SCALE_MAX) * 100, -5, 105)}%`;
}
