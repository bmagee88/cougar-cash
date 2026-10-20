import { describe, expect, test } from "@jest/globals";
import { DEFAULT_SETTINGS, Settings, createRun, prepareRow, questionFor, resolveAttempt, sanitizeSettings, withoutMutedListening } from "./engine";
import { SKILLS } from "./resources";
import { displayReading, instructionReading, questionPrompt, questionReading } from "./reading";
import { parseProgress, restoreProgress, snapshotProgress } from "./progress";

describe("Quiet defaults and selective reading", () => {
  test("all pictured first/last-letter targets are hidden in listening mode and written in silent mode", () => {
    const positions = new Set<string>();
    for (const grade of [0, 1] as const) for (let seed = 0; seed < 150; seed++) {
      const q = questionFor(`word-target-${seed}`, 19, { ...DEFAULT_SETTINGS, skills: ["sounds"], grades: [grade] });
      const prompt = questionPrompt(q, true);
      expect(prompt).toMatch(/^(First|Last) letter\?$/);
      expect(prompt).not.toContain(q.pictureLabel);
      expect(questionPrompt(q, false)).toContain(q.pictureLabel);
      expect(questionReading(q, true)).toContain(q.pictureLabel);
      expect(questionReading(q, false)).toBe(q.prompt);
      positions.add(prompt);
    }
    expect(positions).toEqual(new Set(["First letter?", "Last letter?"]));
  });

  test("picture vocabulary keeps the target name spoken-only with voice on", () => {
    for (const grade of [0, 1] as const) for (let seed = 0; seed < 40; seed++) {
      const q = questionFor(`vocabulary-${seed}`, 1, { ...DEFAULT_SETTINGS, skills: ["pictures"], grades: [grade] });
      expect(questionPrompt(q, true)).toBe("Find the picture.");
      expect(questionPrompt(q, false)).toBe(q.prompt);
      expect(questionReading(q, true)).toBe(q.prompt);
    }
    const definition = questionFor("definition", 1, { ...DEFAULT_SETTINGS, skills: ["pictures"], grades: [2] });
    expect(questionPrompt(definition, true)).toBe(definition.prompt);
  });

  test("spelling, sight words, and blend questions name their target in audio but keep incomplete text masked", () => {
    for (const skill of ["sounds", "spelling", "sightWords"] as const) {
      const q = questionFor(`word-${skill}`, 1, { ...DEFAULT_SETTINGS, skills: [skill], grades: [2] });
      const original = JSON.stringify(q);
      expect(questionReading(q, true)).toBe(q.speech);
      expect(questionReading(q, false)).toBe(q.prompt);
      expect(q.display).toContain("_");
      expect(displayReading(q.display)).toContain("blank");
      expect(JSON.stringify(q)).toBe(original);
    }
  });

  test("new defaults are kindergarten, every subject checked, and automatic reading off", () => {
    expect(DEFAULT_SETTINGS.grades).toEqual([0]);
    expect(DEFAULT_SETTINGS.voice).toBe(false);
    expect(new Set(DEFAULT_SETTINGS.skills)).toEqual(new Set(SKILLS.map(skill => skill.id)));
    expect(sanitizeSettings({}).grades).toEqual([0]);
    expect(sanitizeSettings({}).voice).toBe(false);
  });

  test("letter-name listening is omitted without read aloud but case matching remains", () => {
    const rules: Settings = { ...DEFAULT_SETTINGS, skills: ["letters", "letterPairs"] };
    for (const grade of [0, 1] as const) for (let level = 1; level < 30; level++) {
      const silent = questionFor("listen-or-match", level, { ...rules, grades: [grade] });
      expect(silent.skill).toBe("letterPairs"); expect(silent.listening).not.toBe(true);
      expect(silent.display.toLowerCase()).toBe(silent.answer);
    }
    const listening = questionFor("name", 1, { ...rules, skills: ["letters"], voice: true });
    expect(listening.listening).toBe(true);
    expect(listening.prompt).toBe("Listen. Find the letter.");
    expect(listening.prompt).not.toContain(listening.answer);
    expect(questionReading(listening)).toBe(listening.speech);
    const secondGrade = questionFor("alphabet", 1, { ...rules, grades: [2], skills: ["letters"] });
    expect(secondGrade.skill).toBe("letters"); expect(secondGrade.listening).not.toBe(true);
  });

  test("silent keyboard questions use functions instead of printing the key to copy", () => {
    for (let seed = 0; seed < 250; seed++) {
      const question = questionFor(`keyboard-${seed}`, 1, { ...DEFAULT_SETTINGS, skills: ["keyboard"] });
      expect(question.listening).not.toBe(true);
      expect(question.prompt).not.toMatch(/^Find the [A-Z0-9] key/);
    }
  });

  test("automatic and question-only reading omit solutions, scenario context, and the answer list", () => {
    const rules: Settings = { ...DEFAULT_SETTINGS, grades: [2], skills: ["troubleshooting"], platforms: 5 };
    const scenario = questionFor("read-parts", 1, rules);
    expect(questionReading(scenario)).toBe(scenario.prompt);
    scenario.options.forEach(option => expect(questionReading(scenario)).not.toContain(option.text));
    const spelling = questionFor("blank", 1, { ...DEFAULT_SETTINGS, skills: ["spelling"] });
    expect(questionReading(spelling)).toBe("Find the missing letter.");
    expect(displayReading("c_t")).toBe("see, blank, tee");
    expect(displayReading("42 + 29 = 7_")).toContain("blank");
    expect(displayReading("42 + 29 = 7_")).not.toContain("71");
  });

  test("a hidden instruction and a missing step number stay hidden when tapped", () => {
    expect(instructionReading({ token: { value: "→", spoken: "right" }, label: "Next", missing: true })).toBe("Next. Missing instruction.");
    expect(instructionReading({ token: { value: "👏", spoken: "clap" }, label: "?" })).toBe("Missing step number. clap.");
  });

  test("audio changes preserve prior questions and the five saved layouts across mixed question profiles", () => {
    const rules: Settings = { ...DEFAULT_SETTINGS, skills: ["letters", "letterPairs"], voice: true };
    let run = createRun("mixed-reading", rules);
    while (run.level < 7 || !run.rows[run.level].question.listening) run = prepareRow(resolveAttempt(run, run.rows[run.level].correctLane, rules).run, rules);
    const muted = { ...rules, voice: false }, before = run;
    run = withoutMutedListening(run, muted);
    expect(run.level).toBe(before.level); expect(run.best).toBe(before.best);
    expect(run.rows[run.level].question.listening).not.toBe(true);
    expect(run.rows[run.level].correctLane).toBe(before.rows[before.level].correctLane);
    expect(run.rows[run.level - 1]).toBe(before.rows[before.level - 1]);
    const save = snapshotProgress(run, muted), parsed = parseProgress(JSON.parse(JSON.stringify(save)));
    expect(parsed).not.toBeNull(); expect(save.rows).toHaveLength(5);
    const restored = restoreProgress(parsed);
    save.rows.forEach(row => expect(restored.rows[row.level]).toEqual(run.rows[row.level]));
    expect(save.rows.some(row => row.source.voice)).toBe(true);
    expect(save.rows.some(row => !row.source.voice)).toBe(true);
    expect(parseProgress({ ...save, rows: save.rows.map((row, i) => i ? row : { ...row, source: { questions: 2, voice: "yes" } }) })).toBeNull();
  });

  test("an old letter-only climb can continue silently without losing its level or old score key", () => {
    const legacy: Settings = { ...DEFAULT_SETTINGS, questions: undefined, skills: ["letters"], voice: true };
    let run = createRun("old-listening", legacy);
    while (run.level < 6) run = prepareRow(resolveAttempt(run, run.rows[run.level].correctLane, legacy).run, legacy);
    const muted = { ...legacy, voice: false };
    run = withoutMutedListening(run, muted);
    expect(run.level).toBe(6); expect(run.rows[6].question.skill).toBe("letterPairs");
    const parsed = parseProgress(snapshotProgress(run, muted));
    expect(parsed).not.toBeNull(); expect(restoreProgress(parsed).rows[6]).toEqual(run.rows[6]);
  });
});
