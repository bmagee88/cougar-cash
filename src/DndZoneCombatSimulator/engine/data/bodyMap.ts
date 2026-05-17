import type { AttackMove, BodyPart, BodyRange, DamageType, MissZone, Range } from "../types/combat";

export const BODY_SCALE_MIN = 0;
export const BODY_SCALE_MAX = 150;

export const bodyMap: BodyRange[] = [
  { part: "feet", label: "Feet", start: 0, end: 14 },
  { part: "legs", label: "Legs", start: 15, end: 59 },
  { part: "hands", label: "Hands", start: 60, end: 69 },
  { part: "arms", label: "Arms", start: 80, end: 97 },
  { part: "chest", label: "Chest", start: 98, end: 107 },
  { part: "shoulders", label: "Shoulders", start: 118, end: 127 },
  { part: "neck", label: "Neck", start: 128, end: 137 },
  { part: "head", label: "Head", start: 138, end: 150 },
];

export const missZones: MissZone[] = [
  { label: "low dodge gap", start: 33, end: 42 },
  { label: "middle dodge gap", start: 70, end: 79 },
  { label: "high dodge gap", start: 108, end: 117 },
];

export const moveTargetRanges: Record<AttackMove, Range> = {
  slashHigh: { start: 128, end: 150 },
  slashMid: { start: 80, end: 127 },
  slashLow: { start: 0, end: 69 },
  cleave: { start: 118, end: 150 },
  stabHead: { start: 138, end: 150 },
  stabChest: { start: 98, end: 107 },
  stabLegs: { start: 15, end: 59 },
};

// Critical rule: the initial marker must start in the correct body area.
// Example: slashMid cannot initially start in the head area.
export const moveAllowedInitialParts: Record<AttackMove, BodyPart[]> = {
  slashHigh: ["neck", "head"],
  slashMid: ["arms", "chest", "shoulders"],
  slashLow: ["feet", "legs", "hands"],
  cleave: ["shoulders", "neck", "head"],
  stabHead: ["head"],
  stabChest: ["chest"],
  stabLegs: ["legs"],
};

export const moveDamageType: Record<AttackMove, DamageType> = {
  slashHigh: "slash",
  slashMid: "slash",
  slashLow: "slash",
  cleave: "slash",
  stabHead: "pierce",
  stabChest: "pierce",
  stabLegs: "pierce",
};
