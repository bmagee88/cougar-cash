import { QuizDefinition, QuizFilters } from "./types";

export const validateQuiz = (value: unknown): value is QuizDefinition => {
  const quiz = value as QuizDefinition;
  return Boolean(quiz &&
    [quiz.id, quiz.quizName, quiz.teacher].every((text) =>
      typeof text === "string" && text.trim(),
    ) &&
    Array.isArray(quiz.sources) && quiz.sources.length > 0 && quiz.sources.every((source) =>
      source && typeof source.textbook === "string" && source.textbook.trim() &&
      typeof source.chapters === "string" && typeof source.sections === "string",
    ) &&
    Number.isInteger(quiz.quizNumber) && quiz.quizNumber > 0 &&
    (quiz.gradeLevel === null || (Number.isInteger(quiz.gradeLevel) && quiz.gradeLevel >= 0 && quiz.gradeLevel <= 12)) &&
    Array.isArray(quiz.concepts) && quiz.concepts.length > 0 &&
    new Set(quiz.concepts.map((concept) => concept?.conceptKey)).size === quiz.concepts.length &&
    new Set(quiz.concepts.map((concept) => concept?.position)).size === quiz.concepts.length &&
    quiz.concepts.every((concept) => concept && Number.isInteger(concept.position) && concept.position > 0 &&
      [concept.conceptKey, concept.conceptName, concept.confusabilityGroup].every((text) => typeof text === "string" && text.trim()) &&
      [concept.questionVariants, concept.answerVariants].every((variants) => Array.isArray(variants) &&
        variants.length > 0 && variants.every((text) => typeof text === "string" && text.trim()),
      ),
    ));
};

export const UNSPECIFIED_SOURCE_VALUE = "__unspecified";
const sourceKeys = ["textbook", "chapters", "sections"] as const;
const isSourceKey = (key: keyof QuizFilters): key is typeof sourceKeys[number] =>
  (sourceKeys as readonly string[]).includes(key);

export const filterValues = (quiz: QuizDefinition, key: keyof QuizFilters): string[] => {
  if (isSourceKey(key)) return quiz.sources.map((source) => source[key] || UNSPECIFIED_SOURCE_VALUE);
  return [key === "gradeLevel" && quiz.gradeLevel === null ? "unassigned" : String(quiz[key])];
};

export const filterValue = (quiz: QuizDefinition, key: keyof QuizFilters) => filterValues(quiz, key).join("\n");

export const filterQuizzes = (catalog: QuizDefinition[], filters: QuizFilters) =>
  catalog.filter((quiz) =>
    (Object.keys(filters) as (keyof QuizFilters)[]).filter((key) => !isSourceKey(key)).every((key) =>
      !filters[key] || filterValues(quiz, key).includes(filters[key]),
    ) && quiz.sources.some((source) => sourceKeys.every((key) =>
      !filters[key] || (source[key] || UNSPECIFIED_SOURCE_VALUE) === filters[key],
    )),
  );
