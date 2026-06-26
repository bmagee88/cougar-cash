import type { ArmorPiece, Weapon } from "../types/combat";

export const ironSword: Weapon = {
  id: "iron-sword",
  name: "Iron Sword",
  weaponType: "sword",
  slotSize: 2,
  handSlotsOccupied: [3, 4],
  weight: 3,
  reach: "none",
  sharpness: 1.4,
  piercing: 0.9,
  bluntForce: 0.5,
  critEffects: {
    slash: "Bleeding Cut",
    pierce: "Deep Puncture",
    blunt: "Bruised",
  },
};

export const longSpear: Weapon = {
  id: "long-spear",
  name: "Long Spear",
  weaponType: "spear",
  slotSize: 4,
  handSlotsOccupied: [1, 2, 3, 4],
  weight: 4,
  reach: "doubleReach",
  sharpness: 0.4,
  piercing: 1.8,
  bluntForce: 0.5,
  critEffects: {
    slash: "Ugly Scrape",
    pierce: "Impaled Wound",
    blunt: "Staggered",
  },
};

export const heavyAxe: Weapon = {
  id: "heavy-axe",
  name: "Heavy Axe",
  weaponType: "axe",
  slotSize: 4,
  handSlotsOccupied: [1, 2, 3, 4],
  weight: 5,
  reach: "reach",
  sharpness: 1.8,
  piercing: 0.4,
  bluntForce: 1.0,
  canCritArmor: true,
  critEffects: {
    slash: "Rending Chop",
    pierce: "Cracked Plate",
    blunt: "Bone Shock",
  },
};

export const mace: Weapon = {
  id: "mace",
  name: "Mace",
  weaponType: "mace",
  slotSize: 2,
  handSlotsOccupied: [3, 4],
  weight: 4,
  reach: "none",
  sharpness: 0.1,
  piercing: 0.2,
  bluntForce: 1.7,
  critEffects: {
    slash: "Scraped",
    pierce: "Jabbed",
    blunt: "Stunned",
  },
};

export const dagger: Weapon = {
  id: "dagger",
  name: "Dagger",
  weaponType: "dagger",
  slotSize: 1,
  handSlotsOccupied: [4],
  weight: 1,
  reach: "none",
  sharpness: 0.9,
  piercing: 1.2,
  bluntForce: 0.2,
  critEffects: {
    slash: "Quick Cut",
    pierce: "Vital Puncture",
    blunt: "Bonked",
  },
};

export const weaponPool: Weapon[] = [ironSword, longSpear, heavyAxe, mace, dagger];

export const fullHelm: ArmorPiece = {
  id: "full-helm",
  name: "Full Helm",
  weight: 2,
  clunk: 1,
  sharpMitigation: 92,
  pierceMitigation: 88,
  bluntMitigation: 82,
  coverageRanges: [{ start: 138, end: 150 }],
};

export const cap: ArmorPiece = {
  id: "cap",
  name: "Cap",
  weight: 1,
  clunk: 0,
  sharpMitigation: 78,
  pierceMitigation: 75,
  bluntMitigation: 75,
  coverageRanges: [{ start: 145, end: 150 }],
};

export const breastplate: ArmorPiece = {
  id: "breastplate",
  name: "Breastplate",
  weight: 5,
  clunk: 2,
  sharpMitigation: 95,
  pierceMitigation: 90,
  bluntMitigation: 85,
  coverageRanges: [{ start: 98, end: 107 }],
};

export const shoulderGuards: ArmorPiece = {
  id: "shoulder-guards",
  name: "Shoulder Guards",
  weight: 2,
  clunk: 1,
  sharpMitigation: 88,
  pierceMitigation: 82,
  bluntMitigation: 78,
  coverageRanges: [{ start: 118, end: 127 }],
};

export const greaves: ArmorPiece = {
  id: "greaves",
  name: "Greaves",
  weight: 3,
  clunk: 1,
  sharpMitigation: 86,
  pierceMitigation: 82,
  bluntMitigation: 78,
  coverageRanges: [{ start: 15, end: 59 }],
};

export const armWraps: ArmorPiece = {
  id: "arm-wraps",
  name: "Arm Wraps",
  weight: 1,
  clunk: 0,
  sharpMitigation: 78,
  pierceMitigation: 75,
  bluntMitigation: 75,
  coverageRanges: [{ start: 80, end: 97 }],
};

export const armorPool: ArmorPiece[] = [fullHelm, cap, breastplate, shoulderGuards, greaves, armWraps];
