export type CQuiz2View =
  | "account"
  | "due"
  | "quizzes"
  | "scores"
  | "settings"
  | "quiz"
  | "teacher-create"
  | "teacher-data";

export type SessionUser = {
  id: string;
  anonId: string;
  role: "student" | "teacher" | "admin";
};

export type SessionResponse = {
  signedIn: boolean;
  user: SessionUser | null;
  idleTimeoutSeconds: number;
};

export type QuizAttempt = {
  id: string;
  score: number;
  correctCount: number;
  totalCount: number;
  attemptDate: string;
  createdAt: string;
};

export type QuizSummary = {
  id: string;
  quizName: string;
  quizNumber: number;
  gradeLevel: number | null;
  teacher: string;
  unit: string;
  section: string;
  questionCount: number;
  maxAttemptsPerDay: number;
  attemptsToday: number;
  attemptsRemainingToday: number;
  greenChecks: number;
  yellowCheck: number;
  greyCheck: number;
  due: boolean;
  dueDate: string;
  daysUntilDue: number;
  hasAnyAttemptsEver: boolean;
  latestScore: number | null;
  attempts: QuizAttempt[];
};

export type DashboardResponse = {
  today: string;
  user: SessionUser;
  quizzes: QuizSummary[];
  totals: {
    greenChecks: number;
    yellowChecks: number;
    dueToday: number;
  };
};

export type TeacherStudentQuizSummary = {
  id: string;
  quizName: string;
  quizNumber: number;
  gradeLevel: number | null;
  teacher: string;
  unit: string;
  section: string;
  greenChecks: number;
  yellowChecks: number;
  greyChecks: number;
  due: boolean;
  dueDate: string;
  daysUntilDue: number;
  maxChecks: number;
  attempts: QuizAttempt[];
};

export type TeacherStudentSummary = {
  anonId: string;
  totalChecks: number;
  quizCount: number;
  quizzes: TeacherStudentQuizSummary[];
};

export type TeacherQuizStudentSummary = {
  anonId: string;
  currentChecks: number;
  maxChecks: number;
  attempts: QuizAttempt[];
};

export type TeacherQuizSummary = {
  id: string;
  quizName: string;
  quizNumber: number;
  gradeLevel: number | null;
  teacher: string;
  unit: string;
  section: string;
  totalUniqueStudentsAttempted: number;
  totalChecksCurrently: number;
  highestChecksToDate: number;
  students: TeacherQuizStudentSummary[];
};

export type TeacherDashboardResponse = {
  today: string;
  user: SessionUser;
  students: TeacherStudentSummary[];
  quizzes: TeacherQuizSummary[];
};

export type RoundQuestion = {
  id: string;
  text: string;
};

export type RoundAnswer = {
  id: string;
  text: string;
};

export type RoundResponse = {
  attemptSessionId: string;
  roundNumber: number;
  quiz: Pick<QuizSummary, "id" | "quizName" | "quizNumber" | "gradeLevel" | "teacher" | "unit" | "section">;
  questions: RoundQuestion[];
  answers: RoundAnswer[];
  questionWindowSize: number;
  totalQuestions: number;
  attemptsToday: number;
  maxAttemptsPerDay: number;
  attemptsRemainingToday: number;
};

export type SubmitRoundResponse = {
  attemptId: string;
  quiz: Pick<QuizSummary, "id" | "quizName" | "quizNumber" | "gradeLevel" | "teacher" | "unit" | "section">;
  score: number;
  correctCount: number;
  totalCount: number;
  results: Array<{ questionId: string; correct: boolean }>;
  status: {
    green: number;
    cap: "grey" | "yellow" | null;
    due: boolean;
    dueDate: string;
    daysUntilDue: number;
  };
  attemptsToday: number;
  maxAttemptsPerDay: number;
  attemptsRemainingToday: number;
  canKeepGoing: boolean;
};
