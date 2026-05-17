import type { AttackMove, RowIndex } from "../types/combat";

export function rowLabel(row: RowIndex): string {
  if (row === 0) return "Your Back";
  if (row === 1) return "Your Front";
  if (row === 2) return "Enemy Front";
  return "Enemy Back";
}

export function moveLabel(move: AttackMove): string {
  const labels: Record<AttackMove, string> = {
    slashHigh: "Slash High",
    slashMid: "Slash Mid",
    slashLow: "Slash Low",
    cleave: "Cleave",
    stabHead: "Stab Head",
    stabChest: "Stab Chest",
    stabLegs: "Stab Legs",
  };

  return labels[move];
}
