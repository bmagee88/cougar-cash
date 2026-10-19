import { describe, expect, test } from "@jest/globals";
import { CURRICULUM_FAMILIES, curriculumQuestion } from "./curriculum";
import { COMPUTER_TOPICS, CURRICULUM_OBJECTIVES } from "./curriculumResources";
import { DEFAULT_SETTINGS, GeneratorContext, Settings, createRng, createRun, prepareRow, questionFor, resolveAttempt } from "./engine";
import { Grade } from "./resources";
import { parseProgress, restoreProgress, snapshotProgress } from "./progress";

const context = (seed: string, grade: Grade = 2, platforms = 5): GeneratorContext => ({ rng: createRng(seed), grade, firstGrade: grade > 0, tier: grade * 6 + 4, level: 35, platforms });

describe("Teacher's cumulative computer checklist", () => {
  test("all 52 requirements have a family, with the exact nine checklist topic counts", () => {
    expect(CURRICULUM_OBJECTIVES).toHaveLength(52);
    expect(new Set(CURRICULUM_OBJECTIVES.map(item => item.id)).size).toBe(52);
    expect(CURRICULUM_FAMILIES).toHaveLength(52);
    expect(new Set(CURRICULUM_FAMILIES.map(item => item.objective))).toEqual(new Set(CURRICULUM_OBJECTIVES.map(item => item.id)));
    expect(COMPUTER_TOPICS.map(topic => CURRICULUM_OBJECTIVES.filter(item => item.topic === topic.id).length)).toEqual([9, 11, 11, 4, 4, 5, 5, 1, 2]);
    expect([0, 1, 2].map(grade => CURRICULUM_OBJECTIVES.filter(item => item.grade === grade).length)).toEqual([18, 16, 18]);
  });

  test.each([2, 3, 4, 5])("all nine topics work at each grade with %i short, unique, narrated answers", platforms => {
    for (const topic of COMPUTER_TOPICS) for (const grade of [0, 1, 2] as Grade[]) for (let seed = 0; seed < 50; seed++) {
      const rules: Settings = { ...DEFAULT_SETTINGS, grades: [grade], skills: [topic.id], platforms };
      const q = questionFor(`curriculum-${seed}`, 19, rules);
      expect(q.prompt.trim().split(/\s+/).length).toBeLessThanOrEqual(6);
      expect(q.choices).toHaveLength(platforms);
      expect(new Set(q.choices.map(item => item.value)).size).toBe(platforms);
      expect(q.choices.filter(item => item.value === q.answer)).toHaveLength(1);
      q.choices.forEach(item => { expect(item.value).toMatch(/^\S+$/); expect(item.value.length).toBeLessThanOrEqual(4); expect(item.spoken).toBeTruthy(); });
      if (q.answer === "⇧") expect(q.choices.some(item => item.value === "⇪")).toBe(false);
      expect(q.curriculum.introduced).toBeLessThanOrEqual(grade);
      expect(q).toEqual(questionFor(`curriculum-${seed}`, 19, rules));
      if (q.options) {
        expect(q.options).toHaveLength(platforms);
        expect(new Set(q.options.map(item => item.text)).size).toBe(platforms);
        expect(q.options.map(item => item.value)).toEqual(Array.from({ length: platforms }, (_, i) => String(i + 1)));
        q.options.forEach(item => { expect(q.speech).toContain(item.text); expect(q.choices.find(choice => choice.value === item.value).spoken).toContain(item.text); });
      }
      if (q.context) expect(q.context.length).toBeGreaterThan(0);
    }
  });

  test("higher grades revisit foundations and reach every requirement without introducing later skills early", () => {
    for (const topic of COMPUTER_TOPICS) for (const grade of [0, 1, 2] as Grade[]) {
      const seen = new Set<string>();
      for (let seed = 0; seed < 700; seed++) {
        const q = curriculumQuestion(topic.id, context(`cumulative-${seed}`, grade));
        expect(q.curriculum.introduced).toBeLessThanOrEqual(grade); seen.add(q.curriculum.requirement);
      }
      for (const objective of CURRICULUM_OBJECTIVES.filter(item => item.topic === topic.id && item.grade <= grade)) expect(seen.has(objective.id)).toBe(true);
    }
  });

  test("generated pattern and loop answers are computed from their visual instructions", () => {
    for (const id of ["C2", "C5"]) for (let seed = 0; seed < 100; seed++) {
      const draft = CURRICULUM_FAMILIES.find(item => item.objective === id).make(context(`program-${seed}`));
      const { steps, repeat } = draft.sequence;
      if (id === "C2") expect(draft.answer).toBe(steps[(steps.length - 1) % 2].token.value);
      else expect(Number(draft.answer)).toBe(steps.length * repeat);
    }
  });

  test("queries and addresses have one distinct answer and safety never calls a lock proof of trust", () => {
    for (let seed = 0; seed < 100; seed++) {
      const web = CURRICULUM_FAMILIES.find(item => item.id === "W4").make(context(`web-${seed}`));
      const chosen = web.options.find(item => item.value === web.answer).text;
      if (web.prompt.includes("address")) expect(chosen).toMatch(/\.example\.org$/);
      else expect(chosen).not.toContain(".");
      const lock = CURRICULUM_FAMILIES.find(item => item.id === "N7").make(context(`lock-${seed}`));
      const safe = lock.options.find(item => item.value === lock.answer).text;
      expect(safe).toMatch(/check/i); expect(safe).not.toMatch(/^Yes/);
      const privacy = CURRICULUM_FAMILIES.find(item => item.id === "S5").make(context(`private-${seed}`));
      expect(privacy.options.find(item => item.value === privacy.answer).text).toMatch(/address|password/);
    }
  });

  test("keyboard shortcuts stay usable with voice off, and scenario answer positions vary", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 150; seed++) {
      const shortcut = CURRICULUM_FAMILIES.find(item => item.id === "P10").make(context(`key-${seed}`));
      if (!shortcut.options) expect(shortcut.context).toBe(`${({ C: "Copy", V: "Paste", Z: "Undo" })[shortcut.answer]}: Ctrl + _`);
      const account = CURRICULUM_FAMILIES.find(item => item.id === "D9").make(context(`account-${seed}`));
      seen.add(account.answer);
    }
    expect(seen.size).toBe(5);
  });

  test("debugging replaces a visible wrong instruction with the unique path to the star", () => {
    const move = (cell: number, value: string) => value === "↑" ? cell >= 3 ? cell - 3 : -1
      : value === "↓" ? cell < 6 ? cell + 3 : -1
      : value === "→" ? cell % 3 < 2 ? cell + 1 : -1
      : value === "←" ? cell % 3 > 0 ? cell - 1 : -1 : cell;
    for (let seed = 0; seed < 150; seed++) {
      const q = CURRICULUM_FAMILIES.find(item => item.id === "C4").make(context(`fix-${seed}`));
      expect(q.sequence.steps[1].incorrect).toBe(true);
      expect(q.sequence.steps[1].missing).toBe(false);
      expect(q.sequence.steps[1].token.value).not.toBe(q.answer);
      const solutions = q.pool.filter(choice => {
        let cell = q.robot.start;
        q.sequence.steps.forEach((step, i) => { if (cell >= 0) cell = move(cell, i === 1 ? choice.value : step.token.value); });
        return cell === q.robot.goal;
      });
      expect(solutions.map(item => item.value)).toEqual([q.answer]);
      expect(q.speech).toContain(q.sequence.steps[1].token.spoken);
    }
  });

  test("new scenarios keep their number-to-text mapping on retries and restore the exact five levels", () => {
    const rules: Settings = { ...DEFAULT_SETTINGS, grades: [2], skills: ["troubleshooting"], platforms: 5 };
    let run = createRun("scenario-save", rules);
    while (run.level < 12) run = prepareRow(resolveAttempt(run, run.rows[run.level].correctLane, rules).run, rules);
    const first = run.rows[12];
    run = prepareRow(resolveAttempt(run, (first.correctLane + 1) % 5, rules).run, rules);
    expect(run.rows[12].question).toEqual(first.question);
    const save = snapshotProgress(run, rules), parsed = parseProgress(JSON.parse(JSON.stringify(save)));
    expect(parsed).not.toBeNull();
    const restored = restoreProgress(parsed);
    expect(restored.rows[restored.level].question).toEqual(run.rows[run.level].question);
    expect(snapshotProgress(restored, rules).rows).toEqual(save.rows);
    expect(save.rows.length).toBeLessThanOrEqual(5);
  });
});
