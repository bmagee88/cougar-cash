import type { Range } from "../types/combat";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function inRange(value: number, range: Range): boolean {
  return value >= range.start && value <= range.end;
}
