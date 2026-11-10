export interface HomeRowWordEntry {
  word: string;
  /** Estimated first vocabulary exposure: 0 = kindergarten, 1–12 = grade, null = needs review. */
  gradeLevel: number | null;
  sentiment: "positive" | "negative" | "neutral";
  reviewNote?: string;
}
export const entriesByLength: Record<string, HomeRowWordEntry[]>;
export const wordsByLength: Record<string, string[]>;
export const SENTIMENTS: HomeRowWordEntry["sentiment"][];
export function filterWordsByLength(gradeMask?: number, sentimentMask?: number): Record<string, string[]>;
