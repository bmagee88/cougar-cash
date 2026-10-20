import { describe, expect, test } from "@jest/globals";
import { DEFAULT_SETTINGS, Settings, gradeFor, questionFor, sanitizeSettings, scoreKey } from "./engine";
import { GRADE_LEVELS, Grade, SKILLS, SkillId } from "./resources";
import { parseProgress, restoreProgress, snapshotProgress } from "./progress";
import { CONTROL_SHORTCUTS } from "./secondGradeResources";

describe("Grade selection and progression", () => {
  test("all seven grade mixes start at their lowest grade, skip unchecked grades, and stop at the highest", () => {
    const levels = [1, 45, 46, 126, 127, 250];
    for (const grades of [[0], [1], [2], [0, 1], [0, 2], [1, 2], [0, 1, 2]] as Grade[][]) {
      const settings: Settings = { ...DEFAULT_SETTINGS, grades };
      const stages = [0, 0, 1, 1, 2, 2];
      levels.forEach((level, i) => {
        const expected = grades[Math.min(stages[i], grades.length - 1)];
        expect(gradeFor(level, settings).id).toBe(expected);
        expect(questionFor("checked-grades", level, settings).grade).toBe(expected);
      });
      expect(gradeFor(1, settings).tier).toBe(grades[0] * 6);
    }
  });

  test.each([2, 3, 4, 5])("every category supports each grade with %i distinct, short, narrated choices", platforms => {
    for (const { id: grade } of GRADE_LEVELS) for (const skill of SKILLS) {
      const settings: Settings = { ...DEFAULT_SETTINGS, voice: true, platforms, grades: [grade], skills: [skill.id as SkillId] };
      for (const level of [1, 6, 19, 46, 127, 200]) {
        const question = questionFor("all-grades", level, settings);
        expect(question.grade).toBe(grade);
        expect(question.choices).toHaveLength(platforms);
        expect(new Set(question.choices.map(item => item.value)).size).toBe(platforms);
        expect(question.choices.filter(item => item.value === question.answer)).toHaveLength(1);
        expect(question.prompt.split(/\s+/).length).toBeLessThanOrEqual(6);
        expect(question.speech).toBeTruthy();
        question.choices.forEach(item => { expect(item.value).toBeTruthy(); expect(item.spoken).toBeTruthy(); });
        if (["letters", "letterPairs", "sounds", "spelling", "sightWords"].includes(skill.id)) expect(question.answer).toMatch(/^[a-z]$/i);
        if (["counting", "addition", "subtraction"].includes(skill.id)) expect(question.answer).toMatch(/^\d$/);
        expect(question).toEqual(questionFor("all-grades", level, { ...settings, grades: [...settings.grades].reverse() }));
      }
    }
  });

  test("grades persist canonically and score keys separate mixes while preserving old K + first-grade records", () => {
    const legacy = { ...DEFAULT_SETTINGS, questions: undefined, grades: [0, 1] as Grade[] };
    const oldKey = JSON.stringify([legacy.platforms, legacy.fallMode, [...legacy.skills].sort(), legacy.spider, legacy.spiderMisses, legacy.spiderWindow]);
    expect(scoreKey(legacy)).toBe(oldKey);
    const { grades: omitted, ...oldSettings } = legacy;
    expect(omitted).toEqual([0, 1]);
    expect(sanitizeSettings(oldSettings).grades).toEqual([0, 1]);
    expect(sanitizeSettings({}).grades).toEqual([0]);
    expect(sanitizeSettings({ grades: [2, 0, 2, 1] }).grades).toEqual([0, 1, 2]);
    expect(sanitizeSettings({ grades: [] }).grades).toEqual([0]);
    expect(scoreKey({ ...DEFAULT_SETTINGS, grades: [0, 1, 2] })).toBe(scoreKey({ ...DEFAULT_SETTINGS, grades: [2, 0, 1] }));
    const keys = [[0], [1], [2], [0, 1], [0, 2], [1, 2], [0, 1, 2]].map(grades => scoreKey({ ...DEFAULT_SETTINGS, grades: grades as Grade[] }));
    expect(new Set(keys).size).toBe(7);
  });

  test("a real level-140 save from before grade checkboxes keeps its question and five layouts", () => {
    const legacySave = require("./fixtures/progress-before-grades.json");
    expect(legacySave.settings.grades).toBeUndefined();
    const parsed = parseProgress(legacySave);
    expect(parsed).not.toBeNull(); expect(parsed.settings.grades).toEqual([0, 1]);
    const restored = restoreProgress(parsed);
    expect(restored.level).toBe(140); expect(restored.rows[140].question.grade).toBe(1);
    expect(snapshotProgress(restored, parsed.settings).rows).toEqual(legacySave.rows);
    expect(parseProgress({ ...legacySave, settings: { ...legacySave.settings, grades: [] } })).toBeNull();
    expect(parseProgress({ ...legacySave, settings: { ...legacySave.settings, grades: [3] } })).toBeNull();
  });
});

describe("Second-grade content", () => {
  const rules = (skill: SkillId): Settings => ({ ...DEFAULT_SETTINGS, questions: 2, grades: [2], skills: [skill], platforms: 5 });

  test("two-digit addition and subtraction give the correct missing digit, including regrouping", () => {
    let carries = 0, borrows = 0;
    for (let seed = 0; seed < 200; seed++) for (const skill of ["addition", "subtraction"] as SkillId[]) {
      const q = questionFor(`math-${seed}`, 1, rules(skill));
      const [, left, operation, right, masked] = q.display.match(/^(\d+) ([+−]) (\d+) = ([\d_]+)$/);
      const a = Number(left), b = Number(right), result = operation === "+" ? a + b : a - b;
      expect(masked.replace("_", q.answer)).toBe(String(result));
      expect(a).toBeGreaterThanOrEqual(10); expect(b).toBeGreaterThanOrEqual(10);
      expect(result).toBeGreaterThanOrEqual(0); expect(result).toBeLessThan(100);
      if (operation === "+" && a % 10 + b % 10 >= 10) carries++;
      if (operation === "−" && a % 10 < b % 10) borrows++;
    }
    expect(carries).toBeGreaterThan(30); expect(borrows).toBeGreaterThan(30);
  });

  test("place-value and skip-counting answers stay single digits within 1000", () => {
    const steps = new Set<number>(), places = new Set<string>();
    for (let seed = 0; seed < 250; seed++) {
      const q = questionFor(`numbers-${seed}`, 1, rules("counting"));
      if (q.prompt.includes("shows")) {
        const place = q.prompt.match(/the (hundreds|tens|ones)/)[1], index = ["hundreds", "tens", "ones"].indexOf(place);
        expect(q.answer).toBe(q.display[index]); places.add(place);
      } else {
        const [a, b, mask] = q.display.split(" · "), next = Number(mask.replace("_", q.answer));
        expect(next).toBe(Number(b) * 2 - Number(a)); expect(next).toBeLessThan(1000);
        steps.add(Number(b) - Number(a));
      }
    }
    expect(steps).toEqual(new Set([5, 10, 100])); expect(places).toEqual(new Set(["hundreds", "tens", "ones"]));
  });

  test("Control shortcuts always have a written action cue when voice is off", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const q = questionFor(`computing-${seed}`, 1, rules("computers"));
      if (!q.display) continue;
      const shortcut = CONTROL_SHORTCUTS.find(item => item.key.toUpperCase() === q.answer);
      expect(q.display).toBe(`${shortcut.label}: Ctrl + _`); expect(q.speech).toContain(shortcut.action); seen.add(shortcut.key);
    }
    expect(seen).toEqual(new Set(CONTROL_SHORTCUTS.map(item => item.key)));
  });

  test("alphabet reasoning, vowel teams, and longer words have correct letter blanks", () => {
    for (let seed = 0; seed < 120; seed++) for (const skill of ["letters", "letterPairs", "sounds", "spelling", "sightWords"] as SkillId[]) {
      const q = questionFor(`reading-${seed}`, 1, rules(skill));
      if (skill === "letters" || skill === "letterPairs") {
        const shown = q.display.match(/[a-z]/gi).map(letter => letter.toLowerCase().charCodeAt(0));
        const target = q.answer.toLowerCase().charCodeAt(0);
        if (q.display.includes("←")) expect(target).toBe(shown[0] - 1);
        else if (q.display.includes("→")) expect(target).toBe(shown[0] + 1);
        else { expect(target).toBe(shown[0] + 1); expect(target).toBe(shown[1] - 1); }
        if (skill === "letterPairs") expect(q.answer === q.answer.toUpperCase()).toBe(q.display.match(/[a-z]/i)[0] === q.display.match(/[a-z]/i)[0].toLowerCase());
      } else {
        const word = q.pictureLabel || q.speech.match(/Finish the word ([a-z]+)\./)[1];
        expect(q.display.replace("_", q.answer)).toBe(word);
      }
    }
  });

  test("events, loop order, repeated instructions, and two-step offsets match their displayed plan", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 220; seed++) {
      const q = questionFor(`program-${seed}`, 1, rules("algorithms")), plan = q.sequence;
      if (q.robot) { seen.add("debug"); continue; }
      if (plan.caption === "Tap starts this program") {
        seen.add("event");
        const index = q.prompt.includes("first") ? 1 : q.prompt.includes("second") ? 2 : 3;
        expect(q.answer).toBe(plan.steps[index].token.value);
      } else if (plan.caption === "Repeat, then finish") {
        seen.add("loop");
        const count = Number(plan.steps[0].label.match(/\d+/)[0]);
        const target = ["first", "second", "third", "fourth", "fifth"].findIndex(word => q.prompt.includes(word)) + 1;
        expect(q.answer).toBe(plan.steps[target <= count ? 0 : 1].token.value);
      } else if (plan.reference !== undefined) {
        seen.add("offset");
        expect(q.answer).toBe(plan.steps[plan.reference + (q.prompt.includes("earlier") ? -2 : 2)].token.value);
      } else {
        seen.add("pattern"); expect(q.answer).toBe(plan.steps[0].token.value);
      }
    }
    expect(seen).toEqual(new Set(["debug", "event", "loop", "offset", "pattern"]));
  });

  test("debugging a middle instruction produces one valid path to the star", () => {
    const move = (cell: number, arrow: string) => arrow === "↑" ? cell >= 3 ? cell - 3 : -1
      : arrow === "↓" ? cell < 6 ? cell + 3 : -1 : arrow === "←" ? cell % 3 ? cell - 1 : -1
        : arrow === "→" ? cell % 3 < 2 ? cell + 1 : -1 : cell;
    let paths = 0;
    for (let seed = 0; seed < 180; seed++) {
      const q = questionFor(`debug-${seed}`, 1, rules("algorithms"));
      if (!q.robot) continue;
      paths++; expect(q.sequence.steps[1].missing).toBe(true);
      const solutions = q.choices.filter(choice => {
        let cell = q.robot.start;
        for (const step of q.sequence.steps) { cell = move(cell, step.missing ? choice.value : step.token.value); if (cell < 0) return false; }
        return cell === q.robot.goal;
      });
      expect(solutions.map(item => item.value)).toEqual([q.answer]);
    }
    expect(paths).toBeGreaterThan(20);
  });
});
