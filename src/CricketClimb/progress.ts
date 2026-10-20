import { QuestionSource, Row, Run, Settings, createRng, questionFor, sanitizeSettings, scoreKey, segmentFor, shuffle } from "./engine";
import { GRADE_LEVELS } from "./resources";

export const PROGRESS_KEY = "cricket-climb.progress.v1";
export const SAVED_LEVELS = 5;
type SavedRow = { level: number; visits: number; choices: string[]; source?: QuestionSource };
const rowSettings = (row: SavedRow, settings: Settings): Settings => row.source ? { ...settings, ...row.source } : settings;
export type SavedProgress = {
  version: 1; seed: string; level: number; lane: number; best: number; settings: Settings;
  rulesKey: string; rows: SavedRow[]; history: boolean[]; celebratedThrough: number;
};

// Store only five compact level records. Questions can be recreated from the run's seed.
export function snapshotProgress(run: Run, settings: Settings): SavedProgress {
  const first = Math.max(1, run.level - SAVED_LEVELS + 1);
  return {
    version: 1, seed: run.seed, level: run.level, lane: run.standing.lane, best: run.best,
    settings: { ...settings, skills: [...settings.skills], grades: [...settings.grades] }, rulesKey: scoreKey(settings),
    rows: Array.from({ length: run.level - first + 1 }, (_, i) => {
      const row = run.rows[first + i];
      return { level: row.level, visits: row.visits, choices: row.choices.map(answer => answer.value), ...(row.source ? { source: { ...row.source } } : {}) };
    }),
    history: run.history.slice(-12), celebratedThrough: Math.max(1, ...run.celebrated),
  };
}

export function parseProgress(raw: unknown): SavedProgress | null {
  try {
    const save = raw as SavedProgress;
    if (!save || save.version !== 1 || typeof save.seed !== "string" || !save.seed || save.seed.length > 200) return null;
    if (!Number.isSafeInteger(save.level) || save.level < 1 || !Number.isSafeInteger(save.best) || save.best < save.level - 1) return null;
    if (!save.settings || !Array.isArray(save.settings.skills) || !save.settings.skills.length) return null;
    if (save.settings.grades !== undefined && (!Array.isArray(save.settings.grades) || !save.settings.grades.length || save.settings.grades.some(grade => !GRADE_LEVELS.some(item => item.id === grade)))) return null;
    const settings = sanitizeSettings(save.settings);
    if (save.rulesKey !== scoreKey(settings) || !Number.isInteger(save.lane) || save.lane < 0 || save.lane >= settings.platforms) return null;
    const first = Math.max(1, save.level - SAVED_LEVELS + 1);
    if (!Array.isArray(save.rows) || save.rows.length !== Math.min(save.level, SAVED_LEVELS)) return null;
    const rows = save.rows.map((row, i) => {
      if (row.level !== first + i || !Number.isSafeInteger(row.visits) || row.visits < 1 || !Array.isArray(row.choices)) throw Error("Invalid saved level");
      if (row.source && (![2, 3].includes(row.source.questions) || typeof row.source.voice !== "boolean")) throw Error("Invalid question source");
      const question = questionFor(save.seed, row.level, rowSettings(row, settings));
      if (row.choices.length !== settings.platforms || new Set(row.choices).size !== settings.platforms ||
        row.choices.some(value => !question.choices.some(answer => answer.value === value))) throw Error("Invalid saved answers");
      return { level: row.level, visits: row.visits, choices: [...row.choices], ...(row.source ? { source: { questions: row.source.questions, voice: row.source.voice } } : {}) };
    });
    const lanes = rows.map(row => row.choices.indexOf(questionFor(save.seed, row.level, rowSettings(row, settings)).answer));
    if (save.level > 1 && lanes[lanes.length - 2] !== save.lane) return null;
    if (settings.fallMode === "limited") {
      // Valid recent layouts must still permit a safe continuation across the saved-window boundary.
      for (let i = 0; i + settings.platforms <= lanes.length; i++) {
        if (new Set(lanes.slice(i, i + settings.platforms)).size < settings.platforms - 1) return null;
      }
      for (let i = 0; i + settings.platforms < lanes.length; i++) {
        if (new Set(lanes.slice(i, i + settings.platforms + 1)).size !== settings.platforms) return null;
      }
    }
    const history = Array.isArray(save.history) ? save.history.filter(value => typeof value === "boolean").slice(-12) : [];
    const maxPatch = segmentFor(save.best + 1).segment;
    const celebratedThrough = Number.isSafeInteger(save.celebratedThrough) ? Math.max(1, Math.min(maxPatch, save.celebratedThrough)) : 1;
    return { version: 1, seed: save.seed, level: save.level, lane: save.lane, best: save.best, settings,
      rulesKey: scoreKey(settings), rows, history, celebratedThrough };
  } catch { return null; }
}

export function restoreProgress(save: SavedProgress): Run {
  const settings = save.settings, rows: Record<number, Row> = {};
  for (const stored of save.rows) {
    const question = questionFor(save.seed, stored.level, rowSettings(stored, settings));
    const choices = stored.choices.map(value => question.choices.find(answer => answer.value === value));
    rows[stored.level] = { level: stored.level, visits: stored.visits, question, choices,
      correctLane: stored.choices.indexOf(question.answer), open: stored.level < save.level, ...(stored.source ? { source: { ...stored.source } } : {}) };
  }
  // Rebuild older terrain rather than persisting it. Working downward preserves the five saved layouts.
  // Every N+1 consecutive rows must cover every lane, so any wrong answer catches within N rows.
  for (let level = save.rows[0].level - 1; level >= 1; level--) {
    const rng = createRng(`${save.seed}:older-terrain:${level}`);
    const lanes = Array.from({ length: settings.platforms }, (_, i) => i);
    const nextLanes = Array.from({ length: settings.platforms }, (_, i) => rows[level + i + 1].correctLane);
    const missing = settings.fallMode === "limited" ? lanes.filter(lane => !nextLanes.includes(lane)) : [];
    const correctLane = missing.length ? missing[0] : Math.floor(rng() * settings.platforms);
    const question = questionFor(save.seed, level, settings);
    const distractors = shuffle(question.choices.filter(answer => answer.value !== question.answer), rng);
    const choices = lanes.map(lane => lane === correctLane ? question.choices[0] : distractors.shift());
    rows[level] = { level, visits: 1, question, choices, correctLane, open: true, ...(settings.questions !== undefined ? { source: { questions: settings.questions, voice: settings.voice } } : {}) };
  }
  return { seed: save.seed, level: save.level, standing: { level: save.level - 1, lane: save.lane }, rows,
    history: [...save.history], best: save.best, celebrated: Array.from({ length: save.celebratedThrough - 1 }, (_, i) => i + 2) };
}
