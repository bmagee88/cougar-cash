import {
  ALPHABET, COMMON_NOUNS, COMMON_VERBS, DEFAULT_SHORT_SKILLS, EMOJIS, FIVE_LETTER_WORDS, FOUR_LETTER_WORDS,
  GRADE_LEVELS, Grade, LETTER_NAMES, NAVIGATION_SYMBOLS, SIGHT_WORDS, SKILLS, SkillId, THREE_LETTER_WORDS,
} from "./resources";
import { algorithmQuestion, computerQuestion } from "./discovery";
import { MATH_GENERATORS } from "./math";
import { SECOND_GRADE_GENERATORS } from "./secondGrade";
import { CURRICULUM_GENERATORS } from "./curriculum";
import type { ComputerTopic } from "./curriculumResources";

export type Settings = {
  platforms: number; fallMode: "limited" | "random"; skills: SkillId[]; grades: Grade[];
  voice: boolean; sounds: boolean; theme: "sunny" | "moonlit";
  spider: boolean; spiderMisses: number; spiderWindow: number;
  questions?: 2 | 3;
  preferences?: 2;
};
export const DEFAULT_SETTINGS: Settings = {
  platforms: 3, fallMode: "limited", skills: [...DEFAULT_SHORT_SKILLS],
  grades: [0], questions: 3, preferences: 2,
  voice: false, sounds: true, theme: "sunny", spider: true, spiderMisses: 3, spiderWindow: 5,
};
export const SETTINGS_KEY = "cricket-climb.settings.v1";
export const SCORES_KEY = "cricket-climb.scores.v1";
export type Answer = { value: string; spoken: string; image?: string };
export type Question = {
  id: string; skill: SkillId; prompt: string; speech: string; display?: string;
  picture?: string; pictureLabel?: string; answer: string; choices: Answer[]; firstGrade: boolean; grade: Grade;
  sequence?: { caption: string; steps: { token: Answer; label: string; missing?: boolean; incorrect?: boolean }[]; reference?: number; repeat?: number };
  robot?: { start: number; goal: number };
  context?: string;
  options?: { value: string; text: string; spoken?: string }[];
  curriculum?: { requirement: string; introduced: Grade; family: string };
  listening?: boolean;
};
export type QuestionSource = { questions: 2 | 3; voice: boolean };
export type Row = { level: number; question: Question; choices: Answer[]; correctLane: number; open: boolean; visits: number; source?: QuestionSource };
export type Run = {
  seed: string; level: number; standing: { level: number; lane: number }; rows: Record<number, Row>;
  history: boolean[]; best: number; celebrated: number[];
};

export function sanitizeSettings(raw: Partial<Settings> = {}): Settings {
  const skills = Array.isArray(raw.skills) ? SKILLS.map(({ id }) => id as SkillId).filter(id => raw.skills.includes(id)) : DEFAULT_SETTINGS.skills;
  // Old saves/settings had only K and first grade. Do not change their seeded content.
  const grades = Array.isArray(raw.grades) ? GRADE_LEVELS.map(item => item.id).filter(id => raw.grades.includes(id))
    : Array.isArray(raw.skills) ? [0, 1] as Grade[] : DEFAULT_SETTINGS.grades;
  const windowSize = Math.max(3, Math.min(12, Math.round(Number(raw.spiderWindow) || 5)));
  return {
    platforms: [2, 3, 4, 5].includes(raw.platforms) ? raw.platforms : 3,
    fallMode: raw.fallMode === "random" ? "random" : "limited",
    skills: skills.length ? skills : [...DEFAULT_SETTINGS.skills],
    grades: grades.length ? [...grades] : [...DEFAULT_SETTINGS.grades],
    voice: typeof raw.voice === "boolean" ? raw.voice : DEFAULT_SETTINGS.voice,
    ...(raw.questions === 3 ? { questions: 3 as const } : raw.questions === 2 ? { questions: 2 as const } : !Array.isArray(raw.skills) ? { questions: 3 as const } : {}),
    ...(raw.preferences === 2 ? { preferences: 2 as const } : {}),
    sounds: typeof raw.sounds === "boolean" ? raw.sounds : true,
    theme: raw.theme === "moonlit" ? "moonlit" : "sunny",
    spider: typeof raw.spider === "boolean" ? raw.spider : true,
    spiderWindow: windowSize,
    spiderMisses: Math.max(1, Math.min(windowSize, Math.round(Number(raw.spiderMisses) || 3))),
  };
}

export function scoreKey(settings: Settings) {
  const grades = GRADE_LEVELS.map(item => item.id).filter(id => (settings.grades || [0, 1]).includes(id));
  // Preserve the existing score key for the original K + first-grade game.
  return JSON.stringify([settings.platforms, settings.fallMode, [...settings.skills].sort(), settings.spider,
    ...(settings.spider ? [settings.spiderMisses, settings.spiderWindow] : []),
    ...(grades.length === 2 && grades[0] === 0 && grades[1] === 1 ? [] : [grades]),
    ...(settings.questions === 3 ? ["math-language-v3"] : settings.questions === 2 ? ["tap-reading-v2"] : [])]);
}

export function createRng(seed: string) {
  let value = 2166136261;
  for (let i = 0; i < seed.length; i++) value = Math.imul(value ^ seed.charCodeAt(i), 16777619);
  return () => {
    value += 0x6D2B79F5;
    let n = Math.imul(value ^ (value >>> 15), 1 | value);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
const pick = <T,>(items: T[], rng: () => number) => items[Math.floor(rng() * items.length)];
const letter = (value: string): Answer => ({ value, spoken: LETTER_NAMES[value.toLowerCase()] });
const digit = (value: number): Answer => ({ value: String(value), spoken: String(value) });

export function segmentFor(level: number) {
  let segment = 1, start = 1, length = 5;
  while (level >= start + length) { start += length; segment++; length++; }
  return { segment, start, length, progress: Math.max(0, level - start), firstGrade: segment >= 7 };
}

export function gradeFor(level: number, settings: Settings) {
  const checked = GRADE_LEVELS.filter(item => (settings.grades || [0, 1]).includes(item.id));
  const grades = checked.length ? checked : GRADE_LEVELS;
  const segment = segmentFor(level).segment, index = Math.min(Math.floor((segment - 1) / 6), grades.length - 1);
  const grade = grades[index];
  return { ...grade, tier: segment - 1 + grade.id * 6 - index * 6 };
}

export type Draft = Omit<Question, "id" | "skill" | "choices" | "firstGrade" | "grade"> & { pool: Answer[] };
export type GeneratorContext = { rng: () => number; tier: number; firstGrade: boolean; grade: Grade; level: number; platforms?: number; voice?: boolean };
const letterPool = ALPHABET.map(letter);
const digitPool = Array.from({ length: 10 }, (_, n) => digit(n));

// Each skill owns a small generator. Add skills here and in SKILL_GROUPS; the game loop stays unchanged.
export const GENERATORS: Partial<Record<SkillId, (context: GeneratorContext) => Draft>> = {
  letters: ({ rng, tier }) => {
    const value = pick(ALPHABET, rng), upper = tier < 2 || rng() > .5;
    const answer = upper ? value.toUpperCase() : value;
    return { prompt: `Find the letter ${answer}.`, speech: `Find the ${upper ? "big" : "little"} letter ${LETTER_NAMES[value]}.`,
      answer, pool: ALPHABET.map(v => letter(upper ? v.toUpperCase() : v)) };
  },
  letterPairs: ({ rng }) => {
    const value = pick(ALPHABET, rng);
    return { prompt: "Find its little letter.", speech: `Find the little letter for big ${LETTER_NAMES[value]}.`,
      display: value.toUpperCase(), answer: value, pool: letterPool };
  },
  sounds: ({ rng, tier, firstGrade }) => {
    const words = firstGrade ? [...FOUR_LETTER_WORDS, ...FIVE_LETTER_WORDS] : THREE_LETTER_WORDS;
    const item = pick(words, rng), last = tier >= 2 && rng() > .5;
    return { prompt: `${last ? "Last" : "First"} letter in ${item.word}?`, speech: `What is the ${last ? "last" : "first"} letter in ${item.word}?`,
      picture: item.picture, pictureLabel: item.word, answer: last ? item.word.slice(-1) : item.word[0], pool: letterPool };
  },
  spelling: ({ rng, tier, firstGrade }) => {
    const words = firstGrade ? [...FOUR_LETTER_WORDS, ...FIVE_LETTER_WORDS] : THREE_LETTER_WORDS;
    const item = pick(words, rng), index = tier < 2 ? 0 : tier < 4 ? 1 : Math.floor(rng() * item.word.length);
    return { prompt: "Find the missing letter.", speech: `Finish the word ${item.word}.`,
      display: item.word.slice(0, index) + "_" + item.word.slice(index + 1), picture: item.picture,
      pictureLabel: item.word, answer: item.word[index], pool: letterPool };
  },
  sightWords: ({ rng, tier, firstGrade }) => {
    const words = firstGrade ? SIGHT_WORDS.firstGrade : tier >= 2 ? SIGHT_WORDS.growing : SIGHT_WORDS.early;
    const word = pick(words, rng), index = Math.floor(rng() * word.length);
    return { prompt: "Finish the sight word.", speech: `Finish the word ${word}.`,
      display: word.slice(0, index) + "_" + word.slice(index + 1), answer: word[index],
      pool: word === "I" ? ALPHABET.map(v => letter(v.toUpperCase())) : letterPool };
  },
  counting: ({ rng, tier, firstGrade }) => {
    if (firstGrade && rng() > .35) {
      const step = rng() > .5 ? 2 : 1, start = Math.floor(rng() * (10 - 3 * step));
      return { prompt: "Which number comes next?", speech: `Count ${start}, ${start + step}, ${start + step * 2}. Which number comes next?`,
        display: `${start}  ${start + step}  ${start + step * 2}  _`, answer: String(start + step * 3), pool: digitPool };
    }
    const total = 1 + Math.floor(rng() * Math.min(9, 3 + tier));
    const picture = pick([{ value: "🍓", plural: "berries" }, { value: "🌼", plural: "flowers" }, { value: "🐞", plural: "ladybugs" }], rng);
    return { prompt: `How many ${picture.plural}?`, speech: `How many ${picture.plural} can you count?`,
      display: Array(total).fill(picture.value).join(" "), answer: String(total), pool: digitPool };
  },
  addition: ({ rng, tier, firstGrade }) => {
    const max = Math.min(9, 4 + tier), a = Math.floor(rng() * max), b = Math.floor(rng() * (max - a)) + 1;
    const missing = firstGrade && rng() > .4;
    return { prompt: missing ? "Find the missing number." : "How many altogether?",
      speech: missing ? `${a} plus what equals ${a + b}?` : `What is ${a} plus ${b}?`,
      display: missing ? `${a} + _ = ${a + b}` : `${a} + ${b} = ?`, answer: String(missing ? b : a + b), pool: digitPool };
  },
  subtraction: ({ rng, tier, firstGrade }) => {
    const a = 1 + Math.floor(rng() * Math.min(9, 3 + tier)), b = Math.floor(rng() * (a + 1));
    const missing = firstGrade && rng() > .4;
    return { prompt: missing ? "Find the missing number." : "How many are left?",
      speech: missing ? `${a} take away what equals ${a - b}?` : `What is ${a} take away ${b}?`,
      display: missing ? `${a} − _ = ${a - b}` : `${a} − ${b} = ?`, answer: String(missing ? b : a - b), pool: digitPool };
  },
  pictures: ({ rng, tier, firstGrade }) => {
    const pool = firstGrade && rng() > .5 ? COMMON_VERBS : tier < 2 ? THREE_LETTER_WORDS.filter(v => v.kind === "noun") : COMMON_NOUNS;
    const item = pick(pool, rng);
    return { prompt: `Find ${item.word}.`, speech: `Find ${item.word}.`, answer: item.picture, pool: EMOJIS };
  },
  symbols: ({ rng, tier }) => {
    const symbols = NAVIGATION_SYMBOLS.slice(0, Math.min(NAVIGATION_SYMBOLS.length, 5 + tier));
    const item = pick(symbols, rng);
    return { prompt: item.prompt, speech: item.prompt, answer: item.value, pool: NAVIGATION_SYMBOLS };
  },
  computers: computerQuestion,
  algorithms: algorithmQuestion,
};

export function questionFor(seed: string, level: number, settings: Settings): Question {
  const rng = createRng(`${seed}:question:${level}`), grade = gradeFor(level, settings);
  const eligible = settings.questions !== undefined && !settings.voice && grade.id < 2 ? settings.skills.filter(skill => skill !== "letters") : settings.skills;
  // A defensive visual fallback also lets an older, letter-only save continue muted.
  const skills: SkillId[] = eligible.length ? eligible : ["letterPairs"];
  // Balanced shuffled rounds give each checked skill a turn, without a predictable skill order.
  const cycle = Math.floor((level - 1) / skills.length);
  const order = shuffle([...skills].sort(), createRng(`${seed}:skills:${cycle}`));
  const skill = order[(level - 1) % order.length];
  // New curriculum IDs leave all earlier IDs and seeded saves unchanged.
  const math = settings.questions === 3 && (skill !== "counting" || rng() < .6) ? MATH_GENERATORS[skill] : undefined;
  const generator = math || CURRICULUM_GENERATORS[skill as ComputerTopic] || (grade.id === 2 ? SECOND_GRADE_GENERATORS[skill] : GENERATORS[skill]);
  const draft = generator({ rng, tier: grade.tier, firstGrade: grade.id >= 1, grade: grade.id, level, platforms: settings.platforms,
    ...(settings.questions !== undefined ? { voice: settings.voice } : {}) });
  const correct = draft.pool.find(({ value }) => value === draft.answer);
  const other = shuffle(draft.pool.filter(({ value }) => value !== draft.answer), rng).slice(0, settings.platforms - 1);
  const { pool, ...content } = draft;
  const listening = (skill === "letters" && grade.id < 2) || /^Find the [A-Z0-9] key\.$/.test(content.prompt);
  return { ...content, ...(listening ? { prompt: skill === "letters" ? "Listen. Find the letter." : "Listen. Find the key.", listening: true } : {}),
    skill, id: `${seed}:${level}`, firstGrade: grade.id >= 1, grade: grade.id, choices: [correct, ...other] };
}

export function createRun(seed: string, settings: Settings): Run {
  return prepareRow({ seed, level: 1, standing: { level: 0, lane: Math.floor(settings.platforms / 2) }, rows: {}, history: [], best: 0, celebrated: [] }, settings);
}

export function prepareRow(run: Run, settings: Settings): Run {
  const { level } = run, previous = run.rows[level];
  const rng = createRng(`${run.seed}:layout:${level}:${previous ? previous.visits : 0}`);
  const question = previous ? previous.question : questionFor(run.seed, level, settings);
  let lanes = Array.from({ length: settings.platforms }, (_, i) => i);
  if (settings.fallMode === "limited") {
    // At startup use every lane once. Later, any lane absent from the N rows below MUST be correct.
    // Thus every wrong choice has a catch at most N rows down, including after a retry reshuffle.
    const below = Array.from({ length: Math.min(level - 1, settings.platforms) }, (_, i) => run.rows[level - i - 1]).filter(Boolean);
    const missing = lanes.filter(lane => !below.some(row => row.correctLane === lane));
    if (level <= settings.platforms || missing.length) lanes = missing;
  }
  const alternatives = previous ? lanes.filter(lane => lane !== previous.correctLane) : lanes;
  const correctLane = pick(alternatives.length ? alternatives : lanes, rng);
  let distractors = shuffle(question.choices.filter(({ value }) => value !== question.answer), rng);
  if (previous && distractors.length > 1 && distractors.every((a, i) => a.value === previous.choices.filter(v => v.value !== question.answer)[i].value)) {
    distractors = [...distractors.slice(1), distractors[0]];
  }
  const choices = Array.from({ length: settings.platforms }, (_, lane) => lane === correctLane
    ? question.choices.find(({ value }) => value === question.answer) : distractors.shift());
  const source = previous ? previous.source : settings.questions !== undefined ? { questions: settings.questions, voice: settings.voice } : undefined;
  return { ...run, rows: { ...run.rows, [level]: { level, question, choices, correctLane, open: false, visits: (previous?.visits || 0) + 1, ...(source ? { source } : {}) } } };
}

// Audio can be changed without losing the climb. Retain other questions and safe
// lanes; replace only an unanswered listening question that is no longer enabled.
export function withoutMutedListening(run: Run, settings: Settings): Run {
  const row = run.rows[run.level];
  if (settings.voice || !row.question.listening) return run;
  const question = questionFor(run.seed, run.level, { ...settings, questions: settings.questions || 2, voice: false });
  const other = shuffle(question.choices.filter(choice => choice.value !== question.answer), createRng(`${run.seed}:silent:${run.level}:${row.visits}`));
  const choices = row.choices.map((_, lane) => lane === row.correctLane ? question.choices[0] : other.shift());
  return { ...run, rows: { ...run.rows, [run.level]: { ...row, question, choices, source: { questions: settings.questions || 2, voice: false } } } };
}

export function resolveAttempt(run: Run, lane: number, settings: Settings) {
  const row = run.rows[run.level], correct = lane === row.correctLane;
  let landing = correct ? run.level : 0;
  if (!correct) {
    for (let level = run.level - 1; level > 0; level--) {
      if (run.rows[level]?.correctLane === lane) { landing = level; break; }
    }
  }
  const rows = { ...run.rows, [run.level]: { ...row, open: true } };
  for (const key of Object.keys(rows)) {
    if (Number(key) > landing) rows[Number(key)] = { ...rows[Number(key)], open: false };
  }
  const nextSegment = segmentFor(landing + 1).segment;
  const newSegment = correct && segmentFor(landing).segment !== nextSegment && !run.celebrated.includes(nextSegment);
  const next: Run = { ...run, rows, level: landing + 1, standing: { level: landing, lane },
    history: [...run.history, correct].slice(-12), best: Math.max(run.best, correct ? run.level : 0),
    celebrated: newSegment ? [...run.celebrated, nextSegment] : run.celebrated };
  return { run: next, correct, landing, drop: correct ? 0 : run.level - landing, newSegment };
}

export function spiderIsActive(run: Run, settings: Settings) {
  const recent = run.history.slice(-settings.spiderWindow);
  return settings.spider && recent.length >= settings.spiderWindow && recent.filter(correct => !correct).length >= settings.spiderMisses;
}

export function spiderLaneFor(run: Run, settings: Settings, previousLane: number | null) {
  if (!spiderIsActive(run, settings)) return null;
  const wrong = run.rows[run.level].choices.map((_, i) => i).filter(i => i !== run.rows[run.level].correctLane);
  const alternatives = wrong.filter(i => i !== previousLane);
  return pick(alternatives.length ? alternatives : wrong, createRng(`${run.seed}:spider:${run.level}:${run.rows[run.level].visits}`));
}
