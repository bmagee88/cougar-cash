import { QuizDefinition } from "./types";
import { validateQuiz } from "./catalogUtils";
export { filterQuizzes, filterValue, filterValues, UNSPECIFIED_SOURCE_VALUE } from "./catalogUtils";

declare const require: {
  context: (path: string, recursive: boolean, pattern: RegExp) => {
    (filename: string): unknown;
    keys: () => string[];
  };
};

// Webpack includes every JSON file in this folder automatically at build time.
// Add a file and push it: there is no registry, upload screen, or backend.
const files = require.context("./quizzes", false, /\.json$/);
export const catalogErrors: string[] = [];
export const quizzes: QuizDefinition[] = [];
// CRA's baseUrl resolver also exposes module aliases for these same files.
// Include only the canonical relative keys so each bank is registered once.
files.keys().filter((filename) => filename.startsWith("./")).sort().forEach((filename) => {
  const quiz: unknown = files(filename);
  if (!validateQuiz(quiz)) {
    catalogErrors.push(`${filename}: invalid quiz format.`);
  } else if (quizzes.some((existing) => existing.id === quiz.id)) {
    catalogErrors.push(`${filename}: duplicate quiz ID "${quiz.id}".`);
  } else {
    quizzes.push({ ...quiz, concepts: [...quiz.concepts].sort((a, b) => a.position - b.position) });
  }
});
quizzes.sort((a, b) => a.quizNumber - b.quizNumber || a.quizName.localeCompare(b.quizName));

