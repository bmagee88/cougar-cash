import { DEFAULT_SETTINGS, Run, Settings, createRng, createRun, prepareRow, questionFor, resolveAttempt, sanitizeSettings, scoreKey, segmentFor, spiderIsActive, spiderLaneFor } from "./engine";
import { FIVE_LETTER_WORDS, FOUR_LETTER_WORDS, SKILLS, THREE_LETTER_WORDS, SkillId } from "./resources";
import { COMPUTER_ACTIONS, COMPUTER_JOBS, COMPUTER_KEYS, COMPUTER_TOOLS, SEQUENCE_PLANS } from "./discoveryResources";

describe("Cricket Climb question resources and generators", () => {
  test("word banks have the advertised lengths and concrete picture cues", () => {
    [THREE_LETTER_WORDS, FOUR_LETTER_WORDS, FIVE_LETTER_WORDS].forEach((bank, i) => {
      expect(bank.length).toBeGreaterThanOrEqual(16);
      bank.forEach(item => { expect(item.word).toHaveLength(i + 3); expect(item.picture).toBeTruthy(); });
    });
  });
  test.each([2, 3, 4, 5])("every skill produces %i distinct choices with exactly one correct answer", platforms => {
    for (const skill of SKILLS) {
      const settings: Settings = { ...DEFAULT_SETTINGS, platforms, skills: [skill.id as SkillId] };
      for (let level = 1; level <= 110; level++) {
        const question = questionFor("content-audit", level, settings);
        expect(question.skill).toBe(skill.id);
        expect(question.choices).toHaveLength(platforms);
        expect(new Set(question.choices.map(choice => choice.value)).size).toBe(platforms);
        expect(question.choices.filter(choice => choice.value === question.answer)).toHaveLength(1);
        expect(question.prompt.trim().split(/\s+/).length).toBeLessThanOrEqual(6);
        question.choices.forEach(choice => { expect(choice.value).toBeTruthy(); expect(choice.spoken).toBeTruthy(); });
        if (["letters", "letterPairs", "sounds", "spelling", "sightWords"].includes(skill.id)) expect(question.answer).toMatch(/^[a-z]$/i);
        if (["counting", "addition", "subtraction"].includes(skill.id)) expect(question.answer).toMatch(/^\d$/);
        expect(question).toEqual(questionFor("content-audit", level, settings));
      }
    }
  });
  test("each selected skill gets a turn in every skill round", () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, skills: ["addition", "spelling", "symbols"] };
    for (let level = 1; level < 90; level += 3) {
      const round = [level, level + 1, level + 2].map(n => questionFor("rounds", n, settings).skill);
      expect(new Set(round)).toEqual(new Set(settings.skills));
    }
  });
  test("questions stay fixed on retry, while the same choices reorder", () => {
    let run = createRun("repeat", DEFAULT_SETTINGS);
    const first = run.rows[1];
    const wrongLane = (first.correctLane + 1) % 3;
    run = prepareRow(resolveAttempt(run, wrongLane, DEFAULT_SETTINGS).run, DEFAULT_SETTINGS);
    expect(run.rows[1].question).toBe(first.question);
    expect(run.rows[1].choices.map(a => a.value).sort()).toEqual(first.choices.map(a => a.value).sort());
    expect(run.rows[1].choices).not.toEqual(first.choices);
    expect(questionFor("new-load", 1, DEFAULT_SETTINGS).id).not.toBe(first.question.id);
  });
  test("rechecking the same skills in a different order preserves seeded questions", () => {
    const first: Settings = { ...DEFAULT_SETTINGS, skills: ["letters", "addition", "symbols"] };
    const reordered: Settings = { ...first, skills: [...first.skills].reverse() };
    for (let level = 1; level <= 20; level++) expect(questionFor("skill-order", level, first)).toEqual(questionFor("skill-order", level, reordered));
  });
  test("patches have 5, 6, 7, 8 questions and introduce first grade at level 46", () => {
    expect([1, 6, 12, 19].map(n => segmentFor(n).length)).toEqual([5, 6, 7, 8]);
    expect(segmentFor(45).firstGrade).toBe(false);
    expect(segmentFor(46)).toMatchObject({ firstGrade: true, start: 46, segment: 7, length: 11 });
  });
});

describe("Computer basics and algorithms", () => {
  test("computer questions progress from pictured parts to jobs, keys, and saving", () => {
    const seen = new Set<string>();
    const settings: Settings = { ...DEFAULT_SETTINGS, platforms: 5, skills: ["computers"] };
    for (let seed = 0; seed < 350; seed++) {
      const first = questionFor(`computer-${seed}`, 1, settings);
      expect(first.prompt).toMatch(/^Find the /);
      expect(first.choices.find(item => item.value === first.answer).image).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/gh\/jdecked\/twemoji@v16\.0\.1\/assets\/svg\/.*\.svg$/);
      const question = questionFor(`computer-${seed}`, 80, settings);
      seen.add(question.prompt);
      if (COMPUTER_JOBS.some(item => item.prompt === question.prompt)) {
        // A whole laptop must not compete with its screen/keyboard in a part-function question.
        expect(question.choices.some(item => item.value === "💻")).toBe(false);
      }
    }
    expect(seen).toEqual(new Set([
      ...COMPUTER_TOOLS.map(item => `Find the ${item.spoken}.`), ...COMPUTER_JOBS.map(item => item.prompt),
      ...COMPUTER_KEYS.map(item => item.prompt), ...COMPUTER_ACTIONS.map(item => item.prompt),
    ]));
  });

  test("sequencing uses complete picture plans and correctly teaches positional words", () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, skills: ["algorithms"] };
    const words = new Set<string>();
    for (let seed = 0; seed < 400; seed++) {
      for (const level of [1, 12, 35, 70]) {
        const question = questionFor(`order-${seed}`, level, settings), sequence = question.sequence;
        if (question.robot || sequence.repeat || sequence.steps.some(step => step.missing)) continue;
        const original = SEQUENCE_PLANS.find(plan => plan.title === sequence.caption);
        expect(sequence.steps.map(step => step.token)).toEqual(original.steps);
        if (question.prompt === "Which picture comes first?") expect(question.answer).toBe(sequence.steps[0].token.value);
        if (question.prompt === "Which picture comes last?") expect(question.answer).toBe(sequence.steps[sequence.steps.length - 1].token.value);
        if (sequence.reference !== undefined) {
          const target = sequence.reference + (question.prompt.includes("next") ? 1 : -1);
          expect(question.answer).toBe(sequence.steps[target].token.value);
          expect(question.choices.find(item => item.value === question.answer).spoken).toBe(sequence.steps[target].token.spoken);
        }
        if (question.prompt.includes("says")) {
          const target = Number(question.answer) - 1;
          expect(question.prompt.toLowerCase()).toContain(sequence.steps[target].label.toLowerCase());
          words.add(sequence.steps[target].label);
        }
      }
    }
    expect(words).toEqual(new Set(["First", "Then", "Next", "Finally"]));
  });

  test("first-grade robot paths and repeat plans have a single computable answer", () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, platforms: 5, skills: ["algorithms"] };
    let robots = 0, repeats = 0, patterns = 0;
    const move = (cell: number, arrow: string) => {
      if (arrow === "↑") return cell >= 3 ? cell - 3 : -1;
      if (arrow === "↓") return cell < 6 ? cell + 3 : -1;
      if (arrow === "←") return cell % 3 > 0 ? cell - 1 : -1;
      if (arrow === "→") return cell % 3 < 2 ? cell + 1 : -1;
      return cell;
    };
    for (let seed = 0; seed < 300; seed++) {
      const question = questionFor(`code-${seed}`, 80, settings), sequence = question.sequence;
      if (question.robot) {
        robots++;
        let cell = question.robot.start;
        for (const step of sequence.steps.filter(step => !step.missing)) {
          cell = move(cell, step.token.value); expect(cell).toBeGreaterThanOrEqual(0); expect(cell).toBeLessThan(9);
        }
        expect(question.choices.filter(choice => move(cell, choice.value) === question.robot.goal).map(choice => choice.value)).toEqual([question.answer]);
      } else if (sequence.repeat) {
        repeats++; expect(Number(question.answer)).toBe(sequence.steps.length * sequence.repeat);
        expect(question.answer).toMatch(/^[1-9]$/);
      } else if (sequence.steps.some(step => step.missing)) {
        patterns++; expect(question.answer).toBe(sequence.steps[1].token.value);
      }
    }
    expect(robots).toBeGreaterThan(20); expect(repeats).toBeGreaterThan(20); expect(patterns).toBeGreaterThan(20);
  });
});

describe("Cricket Climb fall rules", () => {
  test.each([2, 3, 4, 5])("limited fall never exceeds %i rows across progression and retries", platforms => {
    const settings = { ...DEFAULT_SETTINGS, platforms };
    const random = createRng(`walk-${platforms}`);
    let run = createRun("safety", settings);
    for (let attempt = 0; attempt < 1800; attempt++) {
      const row = run.rows[run.level];
      expect(row.correctLane).toBeGreaterThanOrEqual(0);
      expect(row.correctLane).toBeLessThan(platforms);
      for (let lane = 0; lane < platforms; lane++) {
        expect(resolveAttempt(run, lane, settings).drop).toBeLessThanOrEqual(platforms);
      }
      const lane = random() < .78 ? row.correctLane : Math.floor(random() * platforms);
      run = prepareRow(resolveAttempt(run, lane, settings).run, settings);
    }
    expect(run.best).toBeGreaterThan(100);
  });
  function tower(): Run {
    const settings: Settings = { ...DEFAULT_SETTINGS, fallMode: "random" };
    let run = createRun("tall", settings);
    while (run.level < 21) run = prepareRow(resolveAttempt(run, run.rows[run.level].correctLane, settings).run, settings);
    const rows = Object.fromEntries(Object.entries(run.rows).map(([key, row]) => [key, { ...row, correctLane: 0, open: Number(key) < 21 }]));
    return { ...run, rows };
  }
  test("random mode can tumble all the way to the ground", () => {
    const run = tower(), result = resolveAttempt(run, 2, { ...DEFAULT_SETTINGS, fallMode: "random" });
    expect(result.landing).toBe(0); expect(result.drop).toBe(21);
    expect(Object.values(result.run.rows).every(row => !row.open)).toBe(true);
  });
  test("a fall catches the nearest correct leaf in the same lane and closes rows above", () => {
    const run = tower(); run.rows[7].correctLane = 2; run.rows[13].correctLane = 2;
    const result = resolveAttempt(run, 2, { ...DEFAULT_SETTINGS, fallMode: "random" });
    expect(result.landing).toBe(13); expect(result.run.level).toBe(14); expect(result.run.standing.lane).toBe(2);
    expect(Object.values(result.run.rows).filter(row => row.level > 13).every(row => !row.open)).toBe(true);
    expect(result.run.rows[13].open).toBe(true);
    expect(result.run.best).toBe(20);
  });
  test("patch fanfare only plays the first time a patch is reached in a run", () => {
    let run = createRun("patch", DEFAULT_SETTINGS);
    while (run.level < 5) run = prepareRow(resolveAttempt(run, run.rows[run.level].correctLane, DEFAULT_SETTINGS).run, DEFAULT_SETTINGS);
    const first = resolveAttempt(run, run.rows[5].correctLane, DEFAULT_SETTINGS);
    expect(first.newSegment).toBe(true);
    const repeat = resolveAttempt({ ...run, celebrated: first.run.celebrated }, run.rows[5].correctLane, DEFAULT_SETTINGS);
    expect(repeat.newSegment).toBe(false);
  });
});

describe("Spider and device score settings", () => {
  test("spider waits for a complete rolling window, marks a wrong answer, and moves when possible", () => {
    let run = createRun("spider", DEFAULT_SETTINGS);
    run = { ...run, history: [false, false, false] };
    expect(spiderIsActive(run, DEFAULT_SETTINGS)).toBe(false);
    run.history.push(true, false);
    expect(spiderIsActive(run, DEFAULT_SETTINGS)).toBe(true);
    const lane = spiderLaneFor(run, DEFAULT_SETTINGS, null);
    expect(lane).not.toBe(run.rows[1].correctLane);
    expect(spiderLaneFor(run, DEFAULT_SETTINGS, lane)).not.toBe(lane);
    run.history = [...run.history, true, true, true];
    expect(spiderIsActive(run, DEFAULT_SETTINGS)).toBe(false);
  });
  test("scores separate game rules and skills, while theme and audio keep the same record", () => {
    expect(scoreKey(DEFAULT_SETTINGS)).toBe(scoreKey({ ...DEFAULT_SETTINGS, theme: "moonlit", sounds: false, voice: false, skills: [...DEFAULT_SETTINGS.skills].reverse() }));
    for (const change of [{ platforms: 4 }, { fallMode: "random" }, { skills: ["letters"] }, { spider: false }, { spiderMisses: 2 }]) {
      expect(scoreKey({ ...DEFAULT_SETTINGS, ...change } as Settings)).not.toBe(scoreKey(DEFAULT_SETTINGS));
    }
  });
  test("invalid saved settings recover to playable values", () => {
    const settings = sanitizeSettings({ platforms: 99, skills: [], spiderMisses: 100, spiderWindow: 4 });
    expect(settings.platforms).toBe(3); expect(settings.skills.length).toBeGreaterThan(0); expect(settings.spiderMisses).toBe(4);
  });
});
import { describe, expect, test } from "@jest/globals";
