import { QuizConceptDraft } from "../CQuiz2/types";

export type QuizSource = { textbook: string; chapters: string; sections: string };

export type QuizDefinition = {
  id: string;
  quizName: string;
  quizNumber: number;
  gradeLevel: number | null;
  teacher: string;
  sources: QuizSource[];
  sourceName?: string;
  concepts: QuizConceptDraft[];
};

export type ConceptState = Record<string, boolean>;

export type QuizSessionState = {
  conceptState: ConceptState;
  bonusEligible: boolean;
  seenConceptIds: string[];
  firstPassWrongConceptIds: string[];
  bonusSeenConceptIds: string[];
  bonusRoundsEarned: number;
  bonusRoundsUsed: number;
  requiredComplete: boolean;
  complete: boolean;
};

export type MatchingItem = { id: string; text: string };

export type LocalRound = {
  id: string;
  mode: "practice" | "required" | "bonus";
  questions: MatchingItem[];
  answers: MatchingItem[];
  pairs: { questionId: string; answerId: string; conceptKey: string }[];
};

export type SavedRound = {
  date: string;
  round: LocalRound;
  answers: MatchingItem[];
  checkedAnswers: Record<string, boolean>;
};

export type LocalAttempt = {
  id: string;
  quizId: string;
  score: number;
  correctCount: number;
  totalCount: number;
  createdAt: string;
  bonusRoundsEarned?: number;
  completedQuiz?: boolean;
};

export type LocalProgress = {
  version: 1;
  attempts: LocalAttempt[];
  conceptStates: Record<string, ConceptState>;
  quizSessions?: Record<string, { date: string; state: QuizSessionState }>;
};

export type QuizFilters = Record<
  "quizNumber" | "quizName" | "teacher" | "gradeLevel" | "textbook" | "chapters" | "sections",
  string
>;
