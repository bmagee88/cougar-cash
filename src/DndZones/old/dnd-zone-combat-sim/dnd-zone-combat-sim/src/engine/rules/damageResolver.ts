import type { ArmorPiece, DamageType, Weapon } from "../types/equipment";
import type { Combatant } from "../types/character";

export function getWeaponDamageMultiplier(weapon: Weapon, damageType: DamageType): number {
  if (damageType === "slash") return weapon.sharpness;
  if (damageType === "pierce") return weapon.piercing;
  return weapon.bluntForce;
}

export function getArmorMitigation(armor: ArmorPiece, damageType: DamageType): number {
  if (damageType === "slash") return armor.sharpMitigation;
  if (damageType === "pierce") return armor.pierceMitigation;
  return armor.bluntMitigation;
}

export function calculateTypedDamage(attacker: Combatant, weapon: Weapon, damageType: DamageType): { baseDamage: number; typedDamage: number } {
  const baseDamage = attacker.stats.physicalStrength * weapon.weight;
  const typedDamage = baseDamage * getWeaponDamageMultiplier(weapon, damageType);
  return { baseDamage, typedDamage };
}

export function applyArmorMitigation(damage: number, armorPieces: ArmorPiece[], damageType: DamageType): { finalDamage: number; mitigatedDamage: number } {
  const finalDamage = armorPieces.reduce((remaining, armor) => Math.max(0, remaining - getArmorMitigation(armor, damageType)), damage);
  return { finalDamage, mitigatedDamage: damage - finalDamage };
}
