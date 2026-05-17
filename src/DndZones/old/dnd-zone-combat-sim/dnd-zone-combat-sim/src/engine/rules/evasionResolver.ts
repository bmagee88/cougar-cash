import type { Combatant } from "../types/character";

export function getTotalEquipmentWeight(combatant: Combatant): number {
  const weaponWeight = combatant.equipment.weapons.reduce((sum, weapon) => sum + weapon.weight, 0);
  const armorWeight = combatant.equipment.armor.reduce((sum, armor) => sum + armor.weight, 0);
  return weaponWeight + armorWeight;
}

export function getTotalClunk(combatant: Combatant): number {
  return combatant.equipment.armor.reduce((sum, armor) => sum + armor.clunk, 0);
}

export function calculateEvasion(combatant: Combatant): number {
  const totalWeight = getTotalEquipmentWeight(combatant);
  const unmitigatedWeight = Math.max(0, totalWeight - combatant.stats.physicalStrength);
  const raw = Math.floor((combatant.stats.balance + combatant.stats.dexterity) / 4) - Math.floor(unmitigatedWeight / 2) - getTotalClunk(combatant);
  return Math.max(0, raw);
}

export function calculateMovementCount(combatant: Combatant): 0 | 1 | 2 | 3 {
  const score = combatant.stats.physicalStrength - getTotalEquipmentWeight(combatant);
  if (score <= -5) return 0;
  if (score <= 2) return 1;
  if (score <= 8) return 2;
  return 3;
}
