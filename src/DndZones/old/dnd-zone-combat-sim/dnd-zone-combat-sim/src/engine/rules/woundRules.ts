import type { BodyPartRange } from "../types/combat";
import type { StatusEffect } from "../types/effects";

export function getWoundForHit(bodyPart: BodyPartRange | undefined, damage: number): StatusEffect | undefined {
  if (!bodyPart || damage <= 0) return undefined;
  if (damage >= 35) {
    return {
      id: `${bodyPart.id}-severe-wound`,
      name: `Severe ${bodyPart.name} Wound`,
      category: "wound",
      description: `A serious wound to the ${bodyPart.name.toLowerCase()}.`,
      duration: "endOfWeek",
      severity: 3,
    };
  }
  if (damage >= 20) {
    return {
      id: `${bodyPart.id}-wound`,
      name: `${bodyPart.name} Wound`,
      category: "wound",
      description: `A meaningful wound to the ${bodyPart.name.toLowerCase()}.`,
      duration: "endOfDay",
      severity: 2,
    };
  }
  if (damage >= 10) {
    return {
      id: `${bodyPart.id}-minor-wound`,
      name: `Minor ${bodyPart.name} Wound`,
      category: "wound",
      description: `A minor wound to the ${bodyPart.name.toLowerCase()}.`,
      duration: "endOfBattle",
      severity: 1,
    };
  }
  return undefined;
}
