export type TypingBossStatus =
  | "setup"
  | "active"
  | "closed"
  | "expired"
  | "victory"
  | "defeat";

export type TypingBossClassId =
  | "cleric"
  | "barbarian"
  | "paladin"
  | "rogue"
  | "necromancer"
  | "monk";
export type TypingBossId = "emberWhelp" | "cindermaw" | "infernalDragon";
export type TypingBossDifficulty = "easy" | "medium" | "hard";
export type TypingBossMode = "old" | "proportional";
export interface TypingBossAttackStats {
  base: number;
  power: number;
  multiplier: number;
  consistency: number;
  orangeBonus: number;
  greenBonus: number;
  greenStacks: number;
  blueShield: number;
  meanIntervalMs: number;
  intervalStdDevMs: number;
  criticalChance: number;
  critical: boolean;
  moveId: string;
  actualDamage: number;
  blockedDamage: number;
  attackNumber: number;
  landedAt: number;
}
export interface TypingBossLeaderboardEntry {
  rank: number;
  code: string;
  name: string;
  totalDamage: number;
  strongestAttack: TypingBossAttackStats | null;
}
export interface TypingBossTypingState {
  gradeMask?: number;
  sentimentMask?: number;
  seed: number;
  nextWord: number;
  wordsInAttack: number;
  characters: number;
  intervalCount: number;
  intervalSum: number;
  intervalSquares: number;
  orange: number;
  red: number;
  green: number;
  growth: number;
  shield: number;
  consistency: number;
  totalTaken: number;
  totalCharacters: number;
  dodgeSamples?: number[];
}
// index, typed word, interval count, sum, squared sum, optional Space-to-first-character gap.
export type TypingBossWordResult = [number, string, number, number, number, number?];
export type TypingBossMoveId = "weak" | "strong" | "special" | "potion";
export type TypingBossProjectileKind =
  | "damage"
  | "heal"
  | "resurrect"
  | "buff"
  | "boss";
export type TypingBossProjectileResult = "pending" | "hit" | "miss" | "evade";

export interface TypingBossPlayer {
  code: string;
  name: string;
  classId: TypingBossClassId;
  classLabel: string;
  color: string;
  hp: number;
  maxHp: number;
  joinedAt: string;
  lastSeenAt: string | null;
  averageDps: number;
  accuracy: number;
  correctStreak: number;
  totalDamage: number;
  totalHealing: number;
  totalBuffs: number;
  totalResurrections: number;
  bossHitsTaken: number;
  regularBossMisses: number;
  specialEvades: number;
  turnsTaken: number;
  nextAttackMultiplier: number;
  evadeReady: boolean;
  monkSpecialCharge: number;
  specialReady: boolean;
  defeated: boolean;
  typing?: TypingBossTypingState;
  totalTaken?: number;
  attackProgress?: number;
}

export interface TypingBossBoss {
  attackProgress?: number;
  id: TypingBossId;
  name: string;
  difficulty: TypingBossDifficulty;
  hp: number;
  maxHp: number;
  attackIntervalMs: number;
  lastAttackAt: number;
  nextAttackAt: number;
  currentMoveLabel: string;
  color: string;
  glow: string;
}

export interface TypingBossProjectile {
  id: string;
  source: string;
  target: string;
  kind: TypingBossProjectileKind;
  moveId?: string | null;
  bossId?: TypingBossId | null;
  moveLabel: string;
  startedAt: number;
  impactAt: number;
  resolvedAt: number | null;
  result: TypingBossProjectileResult;
  amount: number | null;
  evadeType?: "regular" | "special" | "dodge" | null;
  multiplier?: number;
  sourceName?: string;
  critical?: boolean;
}

export interface TypingBossLogEntry {
  id: string;
  message: string;
  tone: "info" | "hit" | "miss" | "heal" | "danger" | "evade" | "victory";
  createdAt: string;
}

export interface TypingBossSessionSnapshot {
  id: string;
  name: string;
  status: TypingBossStatus;
  createdAt: string;
  expiresAt: string;
  closedAt: string | null;
  remainingSeconds: number;
  boss: TypingBossBoss;
  players: TypingBossPlayer[];
  projectiles: TypingBossProjectile[];
  log: TypingBossLogEntry[];
  hostToken?: string;
  activeChallengeIds?: string[];
  mode?: TypingBossMode;
  typing?: TypingBossTypingState;
  startingPlayers?: number;
  revision?: number;
  serverNow?: number;
  hpMultiplier?: number;
  leaderboard?: TypingBossLeaderboardEntry[];
}

export interface TypingBossCredentials {
  hostToken?: string;
  code?: string;
}

export interface TypingBossChallenge {
  id: string;
  moveId: string;
  moveLabel: string;
  movePower: number;
  kind:
    | "damage"
    | "heal-self"
    | "heal-other"
    | "buff-other"
    | "evade-self"
    | "resurrect";
  targetCode: string;
  questionId: string;
  question: string;
  answers: string[];
  difficulty: "easy" | "medium" | "hard";
  createdAt: number;
}

export interface TypingBossChallengeStats {
  correct: boolean;
  effectiveDps: number;
  speedMultiplier: number;
  accuracy: number;
  streak: number;
}

export interface TypingBossSessionResponse {
  session: TypingBossSessionSnapshot;
}

export interface CreateTypingBossSessionResponse
  extends TypingBossSessionResponse {
  sessionId: string;
  hostToken: string;
}

export interface TypingBossParticipantResponse
  extends TypingBossSessionResponse {
  code: string;
}

export interface TypingBossChallengeResponse
  extends TypingBossSessionResponse {
  challenge: TypingBossChallenge;
}

export interface TypingBossActionResponse extends TypingBossSessionResponse {
  projectile: TypingBossProjectile;
  stats: TypingBossChallengeStats;
}
