import type { ProcessingRule } from "../types";

export const processingRules: Record<
  ProcessingRule,
  { label: string; instruction: string; apply: (input: number) => number }
> = {
  double: { label: "Double", instruction: "Multiply by 2", apply: (n) => n * 2 },
  "add-ten": { label: "Add 10", instruction: "Add 10", apply: (n) => n + 10 },
  square: { label: "Square", instruction: "Multiply by itself", apply: (n) => n * n },
};

export function processInput(input: number, rule: ProcessingRule) {
  return processingRules[rule].apply(input);
}
