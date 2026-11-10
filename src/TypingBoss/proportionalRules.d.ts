import { TypingBossTypingState } from "./types";
export const WORDS: string[];
export function attackProgress(seed: number, wordIndex: number, characters: number): number;
export function wordAt(seed: number, index: number): { text: string; color: "blue" | "orange" | "red" | "green" | null };
export function consistencyMultiplier(count: number, sum: number, squares: number): number;
export function createTypingState(seed: number): TypingBossTypingState;
export function finishWord(state: TypingBossTypingState, text: string, count: number, sum: number, squares: number): { correct: boolean; color: string | null };
export function releaseAttack(state: TypingBossTypingState, random?: () => number): { base: number; power: number; multiplier: number; critical: boolean; consistency: number; moveId: string; orangeBonus: number; greenBonus: number; greenStacks: number; criticalChance: number; blueShield: number; meanIntervalMs: number; intervalStdDevMs: number };
