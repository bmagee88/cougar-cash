import { describe, expect, test } from "@jest/globals";
import { DEFAULT_SETTINGS, Settings, createRng, createRun, prepareRow, questionFor, resolveAttempt } from "./engine";
import { parseProgress, restoreProgress, snapshotProgress } from "./progress";

function climb(level: number, settings = DEFAULT_SETTINGS) {
  let run = createRun("five-level-save", settings);
  while (run.level < level) run = prepareRow(resolveAttempt(run, run.rows[run.level].correctLane, settings).run, settings);
  return run;
}

describe("Rolling five-level progress", () => {
  test("older skill selections remain valid and new discovery questions survive a five-level save", () => {
    const legacy: Settings = { ...DEFAULT_SETTINGS, skills: ["letters", "letterPairs", "sounds", "spelling", "sightWords", "counting", "addition", "subtraction", "pictures", "symbols"] };
    const discovery: Settings = { ...DEFAULT_SETTINGS, skills: ["computers", "algorithms"] };
    for (const settings of [legacy, discovery]) {
      const run = climb(81, settings), save = snapshotProgress(run, settings), parsed = parseProgress(save);
      expect(parsed.settings.skills).toEqual(settings.skills);
      const restored = restoreProgress(parsed);
      expect(save.rows).toHaveLength(5);
      for (const row of save.rows) expect(restored.rows[row.level]).toEqual(run.rows[row.level]);
    }
  });
  test("only the current question and the four levels below are serialized", () => {
    const run = climb(83), saved = snapshotProgress(run, DEFAULT_SETTINGS);
    expect(saved.rows.map(row => row.level)).toEqual([79, 80, 81, 82, 83]);
    expect(JSON.stringify(saved)).not.toContain('"question"');
    expect(parseProgress(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    const restored = restoreProgress(saved);
    expect(restored.level).toBe(83); expect(restored.standing).toEqual(run.standing);
    expect(restored.best).toBe(run.best); expect(restored.history).toEqual(run.history); expect(restored.celebrated).toEqual(run.celebrated);
    for (const row of saved.rows) expect(restored.rows[row.level]).toEqual(run.rows[row.level]);
    expect(restored.rows[10].question).toEqual(questionFor(run.seed, 10, DEFAULT_SETTINGS));
  });
  test("a save near the ground contains only the levels that exist", () => {
    for (let level = 1; level <= 5; level++) {
      const run = climb(level), save = snapshotProgress(run, DEFAULT_SETTINGS);
      expect(save.rows).toHaveLength(level);
      expect(restoreProgress(parseProgress(save))).toEqual(run);
    }
  });
  test.each([2, 3, 4, 5])("restored terrain preserves the %i-row fall limit across the saved boundary and later retries", platforms => {
    const settings: Settings = { ...DEFAULT_SETTINGS, platforms };
    const rng = createRng(`restored-walk-${platforms}`);
    let run = climb(28, settings);
    for (let attempt = 0; attempt < 180; attempt++) {
      const saved = parseProgress(snapshotProgress(run, settings));
      expect(saved).not.toBeNull();
      run = restoreProgress(saved);
      for (let level = 1; level <= run.level; level++) {
        for (let lane = 0; lane < platforms; lane++) {
          expect(resolveAttempt({ ...run, level }, lane, settings).drop).toBeLessThanOrEqual(platforms);
        }
      }
      const lane = rng() < .7 ? run.rows[run.level].correctLane : Math.floor(rng() * platforms);
      run = prepareRow(resolveAttempt(run, lane, settings).run, settings);
    }
  });
  test("random-fall saves rebuild lower terrain and a fall can still reach the ground", () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, fallMode: "random" };
    const restored = restoreProgress(parseProgress(snapshotProgress(climb(40, settings), settings)));
    expect(restored.rows[1]).toBeDefined();
    for (let level = 1; level < restored.level; level++) restored.rows[level].correctLane = 0;
    const lane = restored.rows[restored.level].correctLane === 1 ? 2 : 1;
    expect(resolveAttempt(restored, lane, settings).landing).toBe(0);
  });
  test("saving after a fall follows the actual landing rather than the highest score", () => {
    const run = climb(20);
    const wrong = (run.rows[20].correctLane + 1) % DEFAULT_SETTINGS.platforms;
    const result = resolveAttempt(run, wrong, DEFAULT_SETTINGS);
    const next = prepareRow(result.run, DEFAULT_SETTINGS);
    const saved = snapshotProgress(next, DEFAULT_SETTINGS);
    expect(saved.level).toBe(result.landing + 1); expect(saved.best).toBe(19);
    expect(restoreProgress(parseProgress(saved)).standing).toEqual(result.run.standing);
  });
  test("corrupt, mismatched, or oversized level records are rejected", () => {
    const saved = snapshotProgress(climb(20), DEFAULT_SETTINGS);
    expect(parseProgress(null)).toBeNull();
    expect(parseProgress({ ...saved, version: 42 })).toBeNull();
    expect(parseProgress({ ...saved, rows: [...saved.rows, saved.rows[0]] })).toBeNull();
    expect(parseProgress({ ...saved, rows: [{ ...saved.rows[0], choices: ["invalid"] }, ...saved.rows.slice(1)] })).toBeNull();
    expect(parseProgress({ ...saved, settings: { ...saved.settings, platforms: 2 } })).toBeNull();
    expect(parseProgress({ ...saved, lane: (saved.lane + 1) % 3 })).toBeNull();
  });
});
