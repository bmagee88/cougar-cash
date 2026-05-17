import type { BodyPartRange, MissZone } from "../types/combat";

export const BODY_SCALE_MIN = 0;
export const BODY_SCALE_MAX = 150;

export const humanoidBodyMap: BodyPartRange[] = [
  { id: "feet", name: "Feet", start: 0, end: 14 },
  { id: "legs", name: "Legs", start: 15, end: 52 },
  { id: "hands", name: "Hands", start: 53, end: 62 },
  { id: "arms", name: "Arms", start: 63, end: 89 },
  { id: "chest", name: "Chest", start: 90, end: 124 },
  { id: "shoulders", name: "Shoulders", start: 125, end: 132 },
  { id: "neck", name: "Neck", start: 133, end: 139 },
  { id: "head", name: "Head", start: 140, end: 150 },
];

export const missZones: MissZone[] = [
  { id: "low-gap", name: "Low dodge gap", start: 33, end: 42 },
  { id: "middle-gap", name: "Middle dodge gap", start: 70, end: 79 },
  { id: "high-gap", name: "High dodge gap", start: 108, end: 117 },
];

export const attackTargetZones = {
  slashLow: { start: 0, end: 62, label: "low slash zone" },
  slashMid: { start: 53, end: 124, label: "middle slash zone" },
  slashHigh: { start: 125, end: 150, label: "high slash zone" },
  cleave: { start: 125, end: 150, label: "cleave head and shoulders zone" },
  stab: { start: 0, end: 150, label: "chosen stab zone" },
} as const;
