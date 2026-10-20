import { describe, expect, test } from "@jest/globals";
import { DEFAULT_SETTINGS, createRng, questionFor } from "./engine";
import { MATH_GENERATORS } from "./math";
import { Grade, SkillId } from "./resources";
import { createRun } from "./engine";
import { snapshotProgress, parseProgress, restoreProgress } from "./progress";

describe("generated math language", () => {
  test.each([0, 1, 2] as Grade[])("grade %i arithmetic and comparisons have one correct answer", grade => {
    const phrases = new Set<string>();
    for (let i = 0; i < 500; i++) {
      for (const skill of ["addition", "subtraction", "counting"] as SkillId[]) {
        const q = MATH_GENERATORS[skill]({ rng: createRng(`math:${i}`), tier: grade * 6, firstGrade: grade > 0, grade, level: 1, platforms: 2 + i % 4 });
        phrases.add(q.prompt);
        expect(q.prompt.split(/\s+/).length).toBeLessThanOrEqual(6);
        expect(q.pool.filter(item => item.value === q.answer)).toHaveLength(1);
        if (q.options) {
          const numbers = q.options.map(option => grade === 0 ? Array.from(option.text).length : Number(option.text));
          const picked = numbers[Number(q.answer) - 1];
          if (q.prompt.includes("equal")) expect(q.context).toBe(`Match: ${grade === 0 ? "🍓".repeat(picked) : picked}`);
          else expect(picked).toBe(q.prompt.includes("more") ? Math.max(...numbers) : Math.min(...numbers));
          expect(new Set(numbers).size).toBe(q.options.length);
        } else {
          const match = q.display.match(/^(\d+) ([+−]) (\d+) = ([\d_?]+)$/);
          const a = Number(match[1]), b = Number(match[3]);
          const result = match[2] === "+" ? a + b : a - b;
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(grade === 0 ? 9 : grade === 1 ? 20 : 99);
          expect(match[4] === "?" ? q.answer : match[4].replace("_", q.answer)).toBe(String(result));
        }
      }
    }
    expect(Array.from(phrases).some(value => value.includes("take away"))).toBe(true);
    expect(phrases.has("How many all together?")).toBe(true);
    expect(phrases.has("How many in total?")).toBe(true);
    expect(Array.from(phrases).some(value => value.includes("more than"))).toBe(grade > 0);
    expect(Array.from(phrases).some(value => value.includes("less than"))).toBe(grade > 0);
  });

  test("old question versions remain reproducible; new saves round trip", () => {
    for (const questions of [undefined, 2, 3] as const) {
      const settings = { ...DEFAULT_SETTINGS, questions, skills: ["addition"] as SkillId[] };
      const run = createRun("math-save", settings);
      const saved = parseProgress(snapshotProgress(run, settings));
      expect(saved).not.toBeNull();
      expect(restoreProgress(saved).rows[1].question).toEqual(run.rows[1].question);
      expect(questionFor("math-save", 1, settings)).toEqual(run.rows[1].question);
    }
  });
});
