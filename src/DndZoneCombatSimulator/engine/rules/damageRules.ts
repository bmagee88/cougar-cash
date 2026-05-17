import type { ArmorPiece, Combatant, DamageType, Weapon } from "../types/combat";

export function getDamageMultiplier(weapon: Weapon, damageType: DamageType): number {
  if (damageType === "slash") return weapon.sharpness;
  if (damageType === "pierce") return weapon.piercing;
  return weapon.bluntForce;
}

export function getArmorMitigation(piece: ArmorPiece, damageType: DamageType): number {
  if (damageType === "slash") return piece.sharpMitigation;
  if (damageType === "pierce") return piece.pierceMitigation;
  return piece.bluntMitigation;
}

export function calculateDamageDetails(
  attacker: Combatant,
  weapon: Weapon,
  damageType: DamageType,
  armor: ArmorPiece[],
): {
  force: number;
  multiplier: number;
  rawDamage: number;
  mitigationDetails: { armorName: string; mitigation: number }[];
  totalMitigation: number;
  finalDamage: number;
} {
  const force = attacker.stats.physicalStrength * weapon.weight;
  const multiplier = getDamageMultiplier(weapon, damageType);
  const rawDamage = force * multiplier;

  const mitigationDetails = armor.map((piece) => ({
    armorName: piece.name,
    mitigation: getArmorMitigation(piece, damageType),
  }));

  const totalMitigation = mitigationDetails.reduce((sum, detail) => sum + detail.mitigation, 0);
  const finalDamage = Math.round(Math.max(0, rawDamage - totalMitigation));

  return { force, multiplier, rawDamage, mitigationDetails, totalMitigation, finalDamage };
}
