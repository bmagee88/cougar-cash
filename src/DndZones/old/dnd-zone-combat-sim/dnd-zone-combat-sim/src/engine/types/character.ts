import type { StatusEffect } from "./effects";
import type { ArmorPiece, Weapon, WeaponAttunement, WeaponProficiency, WeaponType } from "./equipment";

export type Team = "heroes" | "enemies";

export interface Stats {
  physicalStrength: number;
  dexterity: number;
  balance: number;
  magicka: number;
  willpower: number;
  intellect: number;
  charisma: number;
  guts: number;
  toughness: number;
}

export interface CharacterHealth {
  fight: number;
  maxFight: number;
  blood: number;
  maxBlood: number;
  concussion: number;
  maxConcussion: number;
}

export interface CharacterEquipment {
  weapons: Weapon[];
  armor: ArmorPiece[];
}

export interface CharacterProgression {
  weaponAttunements: Record<string, WeaponAttunement>;
  weaponProficiencies: Partial<Record<WeaponType, WeaponProficiency>>;
}

export interface Combatant {
  id: string;
  name: string;
  team: Team;
  stats: Stats;
  health: CharacterHealth;
  equipment: CharacterEquipment;
  progression: CharacterProgression;
  statuses: StatusEffect[];
}
