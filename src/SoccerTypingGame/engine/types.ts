export type TeamId = "X" | "O";

export type GamePhase =
  | "OFFENSE_SELECT"
  | "OFFENSE_TYPING"
  | "DEFENSE_SELECT"
  | "DEFENSE_TYPING"
  | "RESOLVE_PLAY"
  | "GOAL_RESET"
  | "MATCH_COMPLETE";

export type TargetKind = "player" | "goal";

export type Rng = () => number;

export interface Point {
  x: number;
  y: number;
}

export interface FieldSize {
  width: number;
  height: number;
}

export interface TeamDefinition {
  id: TeamId;
  name: string;
  marker: "X" | "O";
  color: string;
  accent: string;
}

export interface PlayerDefinition {
  id: string;
  team: TeamId;
  name: string;
  key: string;
  home: Point;
}

export interface TemporaryPosition {
  interceptionPlayId: number;
  turnsRemaining: number;
}

export interface PlayerState extends PlayerDefinition {
  position: Point;
  hasBall: boolean;
  temporary?: TemporaryPosition;
}

export interface GoalTarget {
  id: "left-goal" | "right-goal";
  key: string;
  label: string;
  point: Point;
  scoringTeam: TeamId;
}

export interface PhraseScalingConfig {
  minChars: number;
  maxChars: number;
  normalizationDistance: number;
}

export interface SelectionConfig {
  offenseSelectionMs: number;
  defenseSelectionMs: number;
}

export interface SoccerTypingConfig {
  field: FieldSize;
  teams: Record<TeamId, TeamDefinition>;
  players: PlayerDefinition[];
  goals: GoalTarget[];
  kickoffPlayerByTeam: Record<TeamId, string>;
  winningScore: number;
  phraseScaling: PhraseScalingConfig;
  defensePhraseScaling: PhraseScalingConfig;
  selection: SelectionConfig;
  phraseBank: string[];
}

export interface TypingChallenge {
  phrase: string;
  typed: string;
  startedAtMs: number;
  completedAtMs?: number;
  printableKeystrokes: number;
  incorrectKeystrokes: number;
  backspaces: number;
}

export interface TypingChallengeStats {
  phrase: string;
  elapsedMs: number;
  printableKeystrokes: number;
  incorrectKeystrokes: number;
  backspaces: number;
  accuracy: number;
}

export interface PlayTarget {
  kind: TargetKind;
  id: string;
  key: string;
  label: string;
  point: Point;
  team?: TeamId;
  scoringTeam?: TeamId;
}

export interface InterceptionOption {
  defenderId: string;
  defenderKey: string;
  defenderTeam: TeamId;
  defenderPosition: Point;
  interceptionPoint: Point;
  pathT: number;
  distanceToPath: number;
  distanceFromOrigin: number;
  defensiveTimeLimitMs: number;
}

export interface LockedPlay {
  id: number;
  offenseTeam: TeamId;
  defenseTeam: TeamId;
  originPlayerId: string;
  origin: Point;
  target: PlayTarget;
  distance: number;
  offensePhrase: string;
  offenseStartedAtMs: number;
  offenseCompletedAtMs?: number;
  offenseElapsedMs?: number;
  eligibleInterceptions: InterceptionOption[];
  selectedInterception?: InterceptionOption;
  defensePhrase?: string;
  defenseStartedAtMs?: number;
  defenseDeadlineAtMs?: number;
}

export interface MatchStats {
  passesCompleted: number;
  shotsTaken: number;
  goals: Record<TeamId, number>;
  interceptions: Record<TeamId, number>;
  turnovers: Record<TeamId, number>;
  offenseChallenges: TypingChallengeStats[];
  defenseChallenges: TypingChallengeStats[];
}

export interface MatchState {
  phase: GamePhase;
  players: PlayerState[];
  scores: Record<TeamId, number>;
  possessionTeam: TeamId;
  activePlayerId: string;
  ball: Point;
  currentPlay?: LockedPlay;
  activeChallenge?: TypingChallenge;
  selectionDeadlineAtMs?: number;
  lastEvent: string;
  nextPlayId: number;
  stats: MatchStats;
  winner?: TeamId;
}
