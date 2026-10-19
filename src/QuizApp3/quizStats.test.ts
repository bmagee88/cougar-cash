import { completedQuizStats, dailyProgress, localDayKey, proficiencyColor } from "./quizStats";
import { LocalAttempt, QuizDefinition } from "./types";

declare const test: any, expect: any;

test("proficiency counts finished quizzes, never their intermediate submissions", () => {
  const base = { quizId: "quiz", totalCount: 10, bonusRoundsEarned: 0 };
  const attempt = (id: string, day: number, score: number, completedQuiz?: boolean): LocalAttempt => ({
    ...base, id, score, correctCount: score / 10, createdAt: new Date(2026, 9, day, 12, Number(id)).toISOString(),
    ...(completedQuiz !== undefined ? { completedQuiz } : {}),
  });
  const history = [attempt("1", 17, 40, false), attempt("2", 17, 80, false), attempt("3", 17, 100, true),
    attempt("4", 18, 40, false), attempt("5", 18, 100, false)];
  expect(completedQuizStats(history)).toEqual({ completedTotal: 1, completedPerfect: 1, perfectPercent: 100 });
  expect(completedQuizStats([...history, attempt("6", 18, 80, true)]))
    .toEqual({ completedTotal: 2, completedPerfect: 1, perfectPercent: 50 });
  expect(completedQuizStats([attempt("1", 18, 100, false)]).perfectPercent).toBeNull();
  // Legacy progress is reconstructed from the final submission of a full run.
  expect(completedQuizStats([attempt("1", 17, 40), attempt("2", 17, 80), attempt("3", 17, 100), attempt("4", 18, 40)]))
    .toEqual({ completedTotal: 1, completedPerfect: 1, perfectPercent: 100 });
});

test("proficiency colors honor the exact 80, 90, and strictly-greater-than-95 boundaries", () => {
  expect(proficiencyColor(0)).toBe("#b69b28");
  expect(proficiencyColor(79.9)).toBe("#b69b28");
  expect(proficiencyColor(80)).toBe("#f6d34a");
  expect(proficiencyColor(89.9)).toBe("#f6d34a");
  expect(proficiencyColor(90)).toBe("#58c98c");
  expect(proficiencyColor(95)).toBe("#58c98c");
  expect(proficiencyColor(95.1)).toBe("#62ff79");
  expect(proficiencyColor(100)).toBe("#62ff79");
  expect(proficiencyColor(null)).toBe("#a3b2c4");
});

test("daily progress counts only this quiz's submissions on the device's calendar day", () => {
  const quiz: QuizDefinition = require("./quizzes/hardware-basics.json");
  const now = new Date(2026, 9, 18, 0, 5);
  const attempt = (id: string, date: Date, bonusRoundsEarned = 0): LocalAttempt => ({
    id, quizId: quiz.id, score: 50, correctCount: 5, totalCount: 10,
    createdAt: date.toISOString(), bonusRoundsEarned,
  });
  const attempts = [
    attempt("yesterday", new Date(2026, 9, 17, 23, 59), 1),
    attempt("today-1", now, 1), attempt("today-2", now, 1),
    { ...attempt("other-quiz", now), quizId: "another-quiz" },
  ];
  expect(dailyProgress(quiz, attempts, localDayKey(now))).toEqual({
    dailyAttempts: 2, dailyBase: 3, dailyBonus: 1, dailyAllowed: 4,
  });
  expect(dailyProgress(quiz, attempts, "2026-10-19")).toEqual({
    dailyAttempts: 0, dailyBase: 3, dailyBonus: 0, dailyAllowed: 3,
  });
});
