import type { StatusEffect } from "./effects";

export type DamageType = "slash" | "pierce" | "blunt";
export type AttackMove = "slashHigh" | "slashMid" | "slashLow" | "cleave" | "stab";
export type ReachLevel = "none" | "reach" | "doubleReach";
export type WeaponType = "sword" | "spear" | "axe" | "mace" | "dagger" | "bow" | "staff";
export type WeaponProficiency = 0 | 1 | 2 | 3;

export type ArmorSlot =
  | "head"
  | "neck"
  | "shoulders"
  | "chest"
  | "arms"
  | "hands"
  | "legs"
  | "feet";

export interface BodyCoverageRange {
  start: number;
  end: number;
  label?: string;
}

export interface CritEffect {
  id: string;
  name: string;
  description: string;
  statusToApply?: StatusEffect;
  maxFightDamage?: number;
}

export interface WeaponEffect {
  id: string;
  name: string;
  description: string;
  allowsArmorCrit?: boolean;
}

export interface Weapon {
  id: string;
  name: string;
  weaponType: WeaponType;
  slotSize: 1 | 2 | 4;
  handSlotsOccupied: number[];
  weight: number;
  reach: ReachLevel;
  isTrueRanged?: boolean;
  sharpness: number;
  piercing: number;
  bluntForce: number;
  effects: WeaponEffect[];
  critEffects: Partial<Record<DamageType, CritEffect>>;
}

export interface ArmorPiece {
  id: string;
  name: string;
  armorSlot: ArmorSlot;
  weight: number;
  clunk: number;
  sharpMitigation: number;
  pierceMitigation: number;
  bluntMitigation: number;
  coverageRanges: BodyCoverageRange[];
}

export interface WeaponAttunement {
  weaponId: string;
  xp: number;
  level: 0 | 1 | 2 | 3 | 4;
}
