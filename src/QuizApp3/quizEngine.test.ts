import { createDailyRound, createRound, createSession, submitRound, attemptStats } from "./quizEngine";
import { QuizDefinition } from "./types";
import { emptyFilters, PROGRESS_KEY, readProgress, saveAttempt } from "./storage";
import { filterQuizzes, filterValues, UNSPECIFIED_SOURCE_VALUE, validateQuiz } from "./catalogUtils";

declare const test: any, expect: any, jest: any, beforeEach: any, afterEach: any;

const quiz: QuizDefinition = require("./quizzes/hardware-basics.json");
const correctAnswers = (round: ReturnType<typeof createRound>) =>
  round.pairs.map((pair) => round.answers.find((answer) => answer.id === pair.answerId)!);

beforeEach(() => { localStorage.clear(); });
afterEach(() => { jest.restoreAllMocks(); });

test("four-question rounds preserve cumulative mastery across the entire concept bank", () => {
  let state = createSession(quiz);
  [40, 80, 100].forEach((score, index) => {
    const round = createRound(quiz, state);
    expect(round.questions).toHaveLength(4);
    expect(new Set(round.pairs.map((pair) => pair.conceptKey)).size).toBe(4);
    const result = submitRound(quiz, state, round, correctAnswers(round), index + 1);
    expect(result.score).toBe(score);
    state = result.state;
  });
  expect(state.complete).toBe(true);
  expect(() => createRound(quiz, state)).toThrow(/complete/);
  // Mastery survives a fresh run, which starts the original required pass.
  const next = createSession(quiz, state.conceptState);
  expect(createRound(quiz, next).mode).toBe("required");
});

test("required passes cover every concept once and earn bonus rounds for mistakes", () => {
  let state = createSession(quiz, Object.fromEntries(quiz.concepts.map((c) => [c.conceptKey, true])));
  const seen: string[] = [];
  for (let index = 0; index < 3; index += 1) {
    const round = createRound(quiz, state);
    expect(round.mode).toBe("required");
    expect(round.questions).toHaveLength(index === 2 ? 2 : 4);
    seen.push(...round.pairs.map((pair) => pair.conceptKey));
    const answers = correctAnswers(round);
    if (index === 0) [answers[0], answers[1]] = [answers[1], answers[0]];
    state = submitRound(quiz, state, round, answers, index + 1).state;
  }
  expect(new Set(seen).size).toBe(quiz.concepts.length);
  expect(seen).toHaveLength(quiz.concepts.length);
  expect(state.bonusRoundsEarned).toBe(1);
  expect(state.complete).toBe(false);
  const bonus = createRound(quiz, state);
  expect(bonus.mode).toBe("bonus");
  state.firstPassWrongConceptIds.forEach((key) =>
    expect(bonus.pairs.some((pair) => pair.conceptKey === key)).toBe(true),
  );
  const result = submitRound(quiz, state, bonus, correctAnswers(bonus), 4);
  expect(result.score).toBe(100);
  expect(result.state.complete).toBe(true);
});

test("an incorrect match replaces previous mastery and practice prioritizes missed concepts", () => {
  const state = createSession(quiz);
  const first = createRound(quiz, state);
  const answers = correctAnswers(first);
  [answers[0], answers[1]] = [answers[1], answers[0]];
  const result = submitRound(quiz, state, first, answers, 1);
  expect(result.correctCount).toBe(2);
  expect(result.score).toBe(20);
  const next = createRound(quiz, result.state);
  expect(next.pairs.every((pair) => !result.state.conceptState[pair.conceptKey])).toBe(true);
  expect(state.conceptState[first.pairs[2].conceptKey]).toBe(false);
});

test("practice mistakes earn only one daily bonus and the bonus prioritizes actual missed concepts", () => {
  let state = createSession(quiz);
  const first = createRound(quiz, state);
  const answers = correctAnswers(first);
  [answers[0], answers[1]] = [answers[1], answers[0]];
  state = submitRound(quiz, state, first, answers, 1).state;
  expect(state.bonusRoundsEarned).toBe(1);
  expect(state.firstPassWrongConceptIds).toEqual(first.pairs.slice(0, 2).map((pair) => pair.conceptKey));
  const bonus = createDailyRound(quiz, state, { dailyAttempts: 3, dailyBase: 3, dailyBonus: 1 });
  expect(bonus.mode).toBe("bonus");
  state.firstPassWrongConceptIds.forEach((key) =>
    expect(bonus.pairs.some((pair) => pair.conceptKey === key)).toBe(true),
  );
  expect(bonus.questions).toHaveLength(4);
  // Even a full bank of mistakes earns one bonus, never a bonus per four misses.
  const allWrong = { ...state, firstPassWrongConceptIds: quiz.concepts.map((concept) => concept.conceptKey) };
  expect(submitRound(quiz, allWrong, bonus, correctAnswers(bonus), 4).state.bonusRoundsEarned).toBe(1);
});

test("variant questions and answers always retain the same concept mapping", () => {
  const bank: QuizDefinition = require("./quizzes/digital-citizenship-concepts.json");
  for (let index = 0; index < 15; index += 1) {
    const round = createRound(bank, createSession(bank));
    round.pairs.forEach((pair, slot) => {
      const concept = bank.concepts.find((item) => item.conceptKey === pair.conceptKey)!;
      expect(concept.questionVariants).toContain(round.questions[slot].text);
      expect(concept.answerVariants).toContain(round.answers.find((answer) => answer.id === pair.answerId)!.text);
    });
  }
});

test("local attempts survive reload, repeated saves do not double-count, and ratios use all attempts", () => {
  const base = { quizId: quiz.id, totalCount: 10, createdAt: "2026-10-18T12:00:00.000Z" };
  const perfect = { ...base, id: "a", correctCount: 10, score: 100 };
  saveAttempt(perfect, { "legacy-1": true });
  saveAttempt(perfect, { "legacy-1": true });
  saveAttempt({ ...base, id: "b", correctCount: 8, score: 80 }, { "legacy-1": false });
  const saved = readProgress();
  expect(saved.attempts).toHaveLength(2);
  expect(saved.conceptStates[quiz.id]["legacy-1"]).toBe(false);
  expect(attemptStats(saved.attempts)).toEqual({ total: 2, perfect: 1, below: 1, perfectPercent: 50, belowPercent: 50 });
  expect(attemptStats([]).perfectPercent).toBeNull();
  const raw = localStorage.getItem(PROGRESS_KEY);
  jest.useFakeTimers().setSystemTime(new Date("2030-01-01"));
  expect(readProgress()).toEqual(saved);
  expect(localStorage.getItem(PROGRESS_KEY)).toBe(raw);
  jest.useRealTimers();
});

test("unreadable progress is not overwritten and failed writes do not report success", () => {
  localStorage.setItem(PROGRESS_KEY, "broken JSON");
  const attempt = { id: "x", quizId: quiz.id, totalCount: 10, correctCount: 10, score: 100, createdAt: new Date().toISOString() };
  expect(() => saveAttempt(attempt, {})).toThrow();
  expect(localStorage.getItem(PROGRESS_KEY)).toBe("broken JSON");
  localStorage.clear();
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Quota exceeded"); });
  expect(() => saveAttempt(attempt, {})).toThrow("Quota exceeded");
  expect(readProgress().attempts).toHaveLength(0);
});

test("all seven quiz criteria filter together, including blank sections and unassigned grade", () => {
  const another = { ...quiz, id: "other", teacher: "Another teacher", gradeLevel: null };
  const filters = { ...emptyFilters(), teacher: quiz.teacher, gradeLevel: "6", textbook: quiz.sources[0].textbook,
    chapters: quiz.sources[0].chapters, sections: UNSPECIFIED_SOURCE_VALUE, quizNumber: String(quiz.quizNumber), quizName: quiz.quizName };
  expect(filterQuizzes([quiz, another], filters)).toEqual([quiz]);
  expect(filterQuizzes([quiz, another], { ...filters, chapters: "Missing" })).toEqual([]);
  expect(filterQuizzes([quiz, another], { ...emptyFilters(), gradeLevel: "unassigned" })).toEqual([another]);
});

test("multiple textbooks retain their own chapter and section references when filtering", () => {
  const multi: QuizDefinition = { ...quiz, sources: [
    { textbook: "Book A", chapters: "Chapter 1", sections: "" },
    { textbook: "Book B", chapters: "Chapters 4–5", sections: "4.1–4.3; 5.2" },
  ] };
  expect(validateQuiz(multi)).toBe(true);
  expect(filterValues(multi, "textbook")).toEqual(["Book A", "Book B"]);
  expect(filterQuizzes([multi], { ...emptyFilters(), textbook: "Book B", chapters: "Chapters 4–5", sections: "4.1–4.3; 5.2" })).toEqual([multi]);
  expect(filterQuizzes([multi], { ...emptyFilters(), textbook: "Book A", chapters: "Chapters 4–5" })).toEqual([]);
  expect(filterQuizzes([multi], { ...emptyFilters(), textbook: "Book A", sections: UNSPECIFIED_SOURCE_VALUE })).toEqual([multi]);
});

test("the shipped JSON banks validate; duplicate concept keys and empty variants are rejected", () => {
  const fs = require("fs");
  const path = require("path");
  const folder = path.join(__dirname, "quizzes");
  fs.readdirSync(folder).filter((filename: string) => filename.endsWith(".json")).forEach((filename: string) => {
    expect(validateQuiz(JSON.parse(fs.readFileSync(path.join(folder, filename), "utf8")))).toBe(true);
  });
  expect(validateQuiz({ ...quiz, concepts: [quiz.concepts[0], quiz.concepts[0]] })).toBe(false);
  expect(validateQuiz({ ...quiz, concepts: [{ ...quiz.concepts[0], answerVariants: [] }] })).toBe(false);
});
