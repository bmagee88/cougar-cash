export const DIRECTIONS = ["up", "right", "down", "left"] as const;

export type Direction = (typeof DIRECTIONS)[number];

export type Difficulty = "easy" | "medium" | "hard" | "expert" | "wizz";

export type Topic =
  | "ela"
  | "computers"
  | "engineering"
  | "painting"
  | "music"
  | "history"
  | "science"
  | "environmental"
  | "math";

export type TopicFilter = Topic | "mixed";

export type PlayerId = "player" | "computer";
export type PlayerController = "local" | "ai" | "remote";

export type GamePhase =
  | "setup"
  | "attacker-target"
  | "attacker-answer"
  | "defender-live"
  | "correction"
  | "combo-recall"
  | "heart-lost"
  | "role-switch"
  | "game-over";

export interface VocabularyConcept {
  id: string;
  term: string;
  topic: Topic;
  related: string[];
  synonyms?: string[];
  obviousDistractors: string[];
  nearMissDistractors: string[];
}

export interface MatchSettings {
  difficulty: Difficulty;
  topic: TopicFilter;
  trickMe: boolean;
  hearts: number;
  lessDecisions: boolean;
  comboHitsRequired: number;
}

export interface PlayerState {
  id: PlayerId;
  label: string;
  controller: PlayerController;
  hearts: number;
}

export interface DirectionalOption<TValue = string> {
  direction: Direction;
  label: string;
  value: TValue;
  isCorrect?: boolean;
}

export interface AttackTargetOption {
  direction: Direction;
  concept: VocabularyConcept;
  label: string;
}

export interface RelatedQuestion {
  kind: "related";
  concept: VocabularyConcept;
  prompt: string;
  correctAnswer: string;
  correctDirection: Direction;
  options: DirectionalOption[];
  trickMe: boolean;
}

export interface OddOneOutQuestion {
  kind: "odd-one-out";
  concept: VocabularyConcept;
  prompt: string;
  oddAnswer: string;
  oddDirection: Direction;
  options: DirectionalOption[];
  trickMe: boolean;
}

export type ActiveQuestion = RelatedQuestion | OddOneOutQuestion;

export interface ActiveAttack {
  attackerId: PlayerId;
  defenderId: PlayerId;
  attackDirection: Direction;
  targetConcept: VocabularyConcept;
  attackQuestion: RelatedQuestion;
  attackStartedAtMs: number;
  attackTimeMs: number;
  defenderTimeLimitMs: number;
  defenseQuestion: RelatedQuestion;
}

export interface ComboRecap {
  conceptId: string;
  prompt: string;
  correctAnswer: string;
  correctDirection: Direction;
  options: DirectionalOption[];
}

export interface CorrectionReplay {
  attackDirection: Direction;
  targetConcept: VocabularyConcept;
  question: RelatedQuestion;
  recaps: ComboRecap[];
}

export interface PlayerStats {
  attackAttempts: number;
  attackCorrect: number;
  attackTimesMs: number[];
  defenseAttempts: number;
  defenseSuccesses: number;
  defenseTimeouts: number;
  successfulCounters: number;
  heartsLost: number;
  conceptsMissed: string[];
  conceptsCorrected: string[];
}

export interface MatchStats {
  startedAtMs: number;
  endedAtMs?: number;
  byPlayer: Record<PlayerId, PlayerStats>;
}

export interface GameState {
  phase: GamePhase;
  settings: MatchSettings;
  players: Record<PlayerId, PlayerState>;
  attackerId: PlayerId;
  defenderId: PlayerId;
  comboFailures: number;
  failedConceptIds: string[];
  comboRecaps: ComboRecap[];
  recentConceptIds: string[];
  currentTargets: AttackTargetOption[];
  attackStartTimeMs?: number;
  selectedAttackTarget?: AttackTargetOption;
  attackQuestion?: RelatedQuestion;
  currentAttack?: ActiveAttack;
  defenseDeadlineMs?: number;
  correctionReplay?: CorrectionReplay;
  message: string;
  winnerId?: PlayerId;
  lastOutcome?: string;
  stats: MatchStats;
}

export type Rng = () => number;

