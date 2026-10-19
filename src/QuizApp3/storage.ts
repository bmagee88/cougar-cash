import { LocalAttempt, LocalProgress, QuizFilters, QuizSessionState } from "./types";
import { localDayKey } from "./quizStats";

export const PROGRESS_KEY = "quiz-app-3.progress.v1";
const FILTERS_KEY = "quiz-app-3.filters.v1";
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

export const readFilters = (): QuizFilters => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(FILTERS_KEY) || "{}");
    return Object.fromEntries(Object.keys(emptyFilters()).map((key) => [
      key, typeof saved?.[key] === "string" ? saved[key] : key === "textbook" && typeof saved?.unit === "string" ? saved.unit : "",
    ])) as QuizFilters;
  } catch {
    return emptyFilters();
  }
};

export const saveFilters = (filters: QuizFilters) => {
  try { window.localStorage.setItem(FILTERS_KEY, JSON.stringify(filters)); } catch {
    // Search still works when saving filter preferences is unavailable.
  }
};
