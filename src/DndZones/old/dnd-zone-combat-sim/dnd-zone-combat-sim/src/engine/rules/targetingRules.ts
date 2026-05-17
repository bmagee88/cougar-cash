import { BODY_SCALE_MAX, BODY_SCALE_MIN, attackTargetZones, humanoidBodyMap, missZones } from "../data/bodyMaps";
import type { BodyPartRange, HitEvaluation } from "../types/combat";
import type { ArmorPiece, AttackMove } from "../types/equipment";
import { rollInt } from "../utils/dice";
import { isInRange } from "../utils/ranges";

export function getBodyPartAtMarker(marker: number): BodyPartRange | undefined {
  return humanoidBodyMap.find((bodyPart) => isInRange(marker, bodyPart));
}

export function isMissMarker(marker: number): boolean {
  return marker < BODY_SCALE_MIN || marker > BODY_SCALE_MAX || missZones.some((zone) => isInRange(marker, zone));
}

export function getArmorAtMarker(marker: number, armor: ArmorPiece[]): ArmorPiece[] {
  return armor.filter((piece) => piece.coverageRanges.some((range) => isInRange(marker, range)));
}

export function rollInitialMarker(move: AttackMove, chosenBodyPartId?: string): number {
  if (move === "stab" && chosenBodyPartId) {
    const bodyPart = humanoidBodyMap.find((part) => part.id === chosenBodyPartId);
    if (bodyPart) return rollInt(bodyPart.start, bodyPart.end);
  }

  const zone = attackTargetZones[move];
  return rollInt(zone.start, zone.end);
}

export function evaluateMarker(marker: number, armor: ArmorPiece[]): HitEvaluation {
  if (isMissMarker(marker)) {
    return { kind: "miss", marker, armorPieces: [], score: 1000, reason: "Marker landed in a miss zone or outside the body scale." };
  }

  const bodyPart = getBodyPartAtMarker(marker);
  if (!bodyPart) {
    return { kind: "miss", marker, armorPieces: [], score: 1000, reason: "Marker did not match a body part." };
  }

  const armorPieces = getArmorAtMarker(marker, armor);
  if (armorPieces.length > 0) {
    return { kind: "armor", marker, bodyPart, armorPieces, score: 400 - armorPieces.length * 20, reason: `Marker hit armor on ${bodyPart.name}.` };
  }

  return { kind: "flesh", marker, bodyPart, armorPieces: [], score: 0, reason: `Marker hit exposed flesh on ${bodyPart.name}.` };
}

export function chooseBestDefenderAdjustment(initialMarker: number, evasion: number, defenderArmor: ArmorPiece[]): { adjustment: number; evaluation: HitEvaluation } {
  let bestAdjustment = 0;
  let bestEvaluation = evaluateMarker(initialMarker, defenderArmor);

  for (let adjustment = -evasion; adjustment <= evasion; adjustment += 1) {
    const evaluation = evaluateMarker(initialMarker + adjustment, defenderArmor);
    if (evaluation.score > bestEvaluation.score) {
      bestEvaluation = evaluation;
      bestAdjustment = adjustment;
    }
  }

  return { adjustment: bestAdjustment, evaluation: bestEvaluation };
}

export function chooseBestAttackerAdjustment(markerAfterDefense: number, adjustmentPower: number, defenderArmor: ArmorPiece[]): { adjustment: number; evaluation: HitEvaluation } {
  let bestAdjustment = 0;
  let bestEvaluation = evaluateMarker(markerAfterDefense, defenderArmor);

  for (let adjustment = -adjustmentPower; adjustment <= adjustmentPower; adjustment += 1) {
    const evaluation = evaluateMarker(markerAfterDefense + adjustment, defenderArmor);
    if (evaluation.score < bestEvaluation.score) {
      bestEvaluation = evaluation;
      bestAdjustment = adjustment;
    }
  }

  return { adjustment: bestAdjustment, evaluation: bestEvaluation };
}
