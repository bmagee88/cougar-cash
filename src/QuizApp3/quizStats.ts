import { QUESTION_WINDOW_SIZE } from "./quizEngine";
import { LocalAttempt, QuizDefinition } from "./types";

export const localDayKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const dailyProgress = (quiz: QuizDefinition, attempts: LocalAttempt[], today = localDayKey(), takeId?: string) => {
  const completedToday = attempts.filter((attempt) =>
    attempt.quizId === quiz.id && localDayKey(new Date(attempt.createdAt)) === today,
  );
  const activeTakeId = takeId ?? completedToday[completedToday.length - 1]?.takeId;
  const takeAttempts = completedToday.filter((attempt) => attempt.takeId === activeTakeId);
  const bonusRounds = Math.min(1, takeAttempts.reduce((earned, attempt) =>
    Math.max(earned, attempt.bonusRoundsEarned || 0), 0,
  ));
  return {
    dailyAttempts: takeAttempts.length,
    dailyBase: Math.max(1, Math.ceil(quiz.concepts.length / QUESTION_WINDOW_SIZE)),
    dailyBonus: bonusRounds,
    dailyAllowed: Math.max(1, Math.ceil(quiz.concepts.length / QUESTION_WINDOW_SIZE)) + bonusRounds,
  };
};

export class DailyLimitError extends Error {
  constructor() { super("This take is complete. Choose Replay to practice again."); }
}

export const completedQuizStats = (attempts: LocalAttempt[]) => {
  const days = new Map<string, LocalAttempt[]>();
  attempts.forEach((attempt) => {
    const key = `${attempt.quizId}:${localDayKey(new Date(attempt.createdAt))}:${attempt.takeId || ""}`;
    days.set(key, [...(days.get(key) || []), attempt]);
  });
  const completed: LocalAttempt[] = [];
  days.forEach((submissions) => {
    if (submissions.some((attempt) => attempt.completedQuiz !== undefined)) {
      completed.push(...submissions.filter((attempt) => attempt.completedQuiz === true));
      return;
    }
    // Older saves contain round submissions only. Reconstruct a finished day
    // from its regular allowance plus its single earned bonus, without
    // counting intermediate submissions as completed quizzes.
    const ordered = [...submissions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const allowance = Math.max(1, Math.ceil(ordered[0].totalCount / QUESTION_WINDOW_SIZE)) +
      (ordered.some((attempt) => (attempt.bonusRoundsEarned || 0) > 0) ? 1 : 0);
    if (ordered.length >= allowance) completed.push(ordered[allowance - 1]);
  });
  const completedTotal = completed.length;
  const recentCompleted = [...completed]
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .slice(-3);
  return {
    completedTotal,
    averageScore: recentCompleted.length ? recentCompleted.reduce((sum, attempt) => sum + attempt.score, 0) / recentCompleted.length : null,
  };
};

export const proficiencyColor = (percent: number | null): string => {
  if (percent === null) return "#a3b2c4";
  if (percent > 95) return "#62ff79";
  if (percent >= 90) return "#58c98c";
  if (percent >= 80) return "#f6d34a";
  return "#b69b28";
};
