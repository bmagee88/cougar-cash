import { LocalAttempt, LocalProgress, QuizDefinition, QuizFilters, QuizSessionState, SavedRound } from "./types";
import { localDayKey } from "./quizStats";

export const PROGRESS_KEY = "quiz-app-3.progress.v1";
const FILTERS_KEY = "quiz-app-3.filters.v1";
const roundKey = (quizId: string) => `quiz-app-3.round.v1:${quizId}`;
export const emptyProgress = (): LocalProgress => ({ version: 1, attempts: [], conceptStates: {} });
export const emptyFilters = (): QuizFilters => ({
  quizNumber: "", quizName: "", teacher: "", gradeLevel: "", textbook: "", chapters: "", sections: "",
});

const validSession = (saved: { date: string; state: QuizSessionState }) => {
  const state = saved?.state;
  return typeof saved?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(saved.date) &&
    state && typeof state.conceptState === "object" && state.conceptState !== null &&
    Object.values(state.conceptState).every((value) => typeof value === "boolean") &&
    [state.seenConceptIds, state.firstPassWrongConceptIds, state.bonusSeenConceptIds]
      .every((keys) => Array.isArray(keys) && keys.every((key) => typeof key === "string")) &&
    [state.bonusEligible, state.requiredComplete, state.complete].every((value) => typeof value === "boolean") &&
    [state.bonusRoundsEarned, state.bonusRoundsUsed].every((value) => Number.isInteger(value) && value >= 0);
};

export const readProgress = (): LocalProgress => {
  const raw = window.localStorage.getItem(PROGRESS_KEY);
  if (!raw) return emptyProgress();
  const parsed = JSON.parse(raw);
  if (parsed?.version !== 1 || !Array.isArray(parsed.attempts) ||
      !parsed.conceptStates || typeof parsed.conceptStates !== "object" ||
      (parsed.quizSessions !== undefined && (!parsed.quizSessions || typeof parsed.quizSessions !== "object" ||
        !Object.values(parsed.quizSessions).every(validSession))) ||
      parsed.attempts.some((attempt: LocalAttempt) =>
        !attempt || typeof attempt.id !== "string" || typeof attempt.quizId !== "string" ||
        (attempt.takeId !== undefined && (typeof attempt.takeId !== "string" || !attempt.takeId.trim())) ||
        !Number.isInteger(attempt.correctCount) || !Number.isInteger(attempt.totalCount) ||
        attempt.totalCount <= 0 || attempt.correctCount < 0 || attempt.correctCount > attempt.totalCount ||
        attempt.score !== Math.round(attempt.correctCount / attempt.totalCount * 100) ||
        (attempt.completedQuiz !== undefined && typeof attempt.completedQuiz !== "boolean") ||
        (attempt.bonusRoundsEarned !== undefined && (!Number.isInteger(attempt.bonusRoundsEarned) || attempt.bonusRoundsEarned < 0)) ||
        !Number.isFinite(Date.parse(attempt.createdAt)),
      )) {
    throw new Error("Saved quiz progress could not be read.");
  }
  return parsed;
};

// Read before appending so another tab's completed attempts are retained.
// Each round's ID is also the attempt ID, making a repeated save idempotent.
export const saveAttempt = (attempt: LocalAttempt, conceptState: Record<string, boolean>, sessionState?: QuizSessionState): LocalProgress => {
  const current = readProgress();
  if (current.attempts.some((saved) => saved.id === attempt.id)) return current;
  const next: LocalProgress = {
    ...current,
    version: 1,
    attempts: [...current.attempts, attempt],
    conceptStates: { ...current.conceptStates, [attempt.quizId]: conceptState },
    ...(sessionState ? { quizSessions: {
      ...current.quizSessions,
      [attempt.quizId]: { date: localDayKey(new Date(attempt.createdAt)), state: sessionState },
    } } : {}),
  };
  window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
  return next;
};

// Keep the displayed round separately from graded progress. Restoring a round
// never records an attempt; only Submit writes to the attempt history.
export const readRound = (quiz: QuizDefinition): SavedRound | undefined => {
  const raw = window.localStorage.getItem(roundKey(quiz.id));
  if (!raw) return undefined;
  const saved: SavedRound = JSON.parse(raw);
  const round = saved?.round;
  const validItems = (items: any) => Array.isArray(items) && items.every((item) =>
    item && typeof item.id === "string" && typeof item.text === "string",
  );
  if (typeof saved?.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(saved.date) ||
      (saved.takeId !== undefined && (typeof saved.takeId !== "string" || !saved.takeId.trim())) ||
      !round || typeof round.id !== "string" || !["practice", "required", "bonus"].includes(round.mode) ||
      !validItems(round.questions) || !validItems(round.answers) || !validItems(saved.answers) ||
      !round.questions.length || round.questions.length > 4 ||
      !Array.isArray(round.pairs) || round.pairs.length !== round.questions.length ||
      round.answers.length !== round.questions.length || saved.answers.length !== round.questions.length ||
      new Set(saved.answers.map((answer) => answer.id)).size !== saved.answers.length ||
      new Set(round.pairs.map((pair) => pair?.conceptKey)).size !== round.pairs.length ||
      round.pairs.some((pair, index) => !pair || pair.questionId !== round.questions[index].id ||
        !quiz.concepts.some((concept) => concept.conceptKey === pair.conceptKey) ||
        !round.answers.some((answer) => answer.id === pair.answerId) ||
        !saved.answers.some((answer) => answer.id === pair.answerId)) ||
      !saved.checkedAnswers || typeof saved.checkedAnswers !== "object" ||
      Object.values(saved.checkedAnswers).some((value) => typeof value !== "boolean")) {
    throw new Error("The unfinished round could not be restored.");
  }
  return saved;
};

export const saveRound = (quizId: string, saved: SavedRound) => {
  window.localStorage.setItem(roundKey(quizId), JSON.stringify(saved));
};

export const readFilters = (scope = ""): QuizFilters => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(scope ? `${FILTERS_KEY}:${scope}` : FILTERS_KEY) || "{}");
    return Object.fromEntries(Object.keys(emptyFilters()).map((key) => [
      key, typeof saved?.[key] === "string" ? saved[key] : key === "textbook" && typeof saved?.unit === "string" ? saved.unit : "",
    ])) as QuizFilters;
  } catch {
    return emptyFilters();
  }
};

export const saveFilters = (filters: QuizFilters, scope = "") => {
  try { window.localStorage.setItem(scope ? `${FILTERS_KEY}:${scope}` : FILTERS_KEY, JSON.stringify(filters)); } catch {
    // Search still works when saving filter preferences is unavailable.
  }
};
