import type { ArmorPiece, AttackMove, BodyPart, Combatant, HitKind, Weapon } from "../types/combat";
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

export function canMeleeAttack(attacker: Combatant, defender: Combatant, weapon: Weapon): boolean {
  if (attacker.team === defender.team) return false;

  const attackerFront = attacker.row === 1 || attacker.row === 2;
  const attackerBack = attacker.row === 0 || attacker.row === 3;
  const defenderFront = defender.row === 1 || defender.row === 2;
  const defenderBack = defender.row === 0 || defender.row === 3;

  if (attackerFront && defenderFront) return true;
  if (attackerFront && defenderBack) return weapon.reach === "reach" || weapon.reach === "doubleReach";
  if (attackerBack && defenderFront) return weapon.reach === "reach" || weapon.reach === "doubleReach";
  if (attackerBack && defenderBack) return weapon.reach === "doubleReach";

  return false;
}

export function markerBottom(marker: number): string {
  return `${clamp((marker / BODY_SCALE_MAX) * 100, -5, 105)}%`;
}
