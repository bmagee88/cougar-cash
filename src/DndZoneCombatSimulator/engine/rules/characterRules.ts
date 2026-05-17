import type { Combatant, Weapon } from "../types/combat";
import { clamp } from "../utils/math";

export function getTotalWeight(character: Combatant): number {
  const weaponWeight = character.weapons.reduce((sum, weapon) => sum + weapon.weight, 0);
  const armorWeight = character.armor.reduce((sum, armor) => sum + armor.weight, 0);
  return weaponWeight + armorWeight;
}

export function getTotalClunk(character: Combatant): number {
  return character.armor.reduce((sum, armor) => sum + armor.clunk, 0);
}

export function getEvasion(character: Combatant): number {
  const weightPenalty = Math.max(0, getTotalWeight(character) - character.stats.physicalStrength);
  const raw = Math.floor((character.stats.balance + character.stats.dexterity) / 4) - weightPenalty - getTotalClunk(character);
  return clamp(raw, 0, 8);
}

export function getMovementCategory(character: Combatant): 0 | 1 | 2 | 3 {
  const speedScore = character.stats.physicalStrength - getTotalWeight(character);
  if (speedScore <= -4) return 0;
  if (speedScore <= 2) return 1;
  if (speedScore <= 8) return 2;
  return 3;
}

export function getAttunementLevel(character: Combatant, weapon: Weapon): number {
  return character.weaponAttunement[weapon.id]?.level ?? 0;
}

export function getTrainingBonus(character: Combatant, weapon: Weapon): number {
  return character.weaponTraining[weapon.weaponType] ?? 0;
}

export function getAttackAdjustment(character: Combatant, weapon: Weapon): number {
  return clamp(getAttunementLevel(character, weapon) + getTrainingBonus(character, weapon), 0, 7);
}
