export type TypingBossStatus =
  | "setup"
  | "active"
  | "closed"
  | "expired"
  | "victory"
  | "draw"
  | "defeat";

export type TypingBossClassId =
  | "cleric"
  | "barbarian"
  | "paladin"
  | "rogue"
  | "necromancer"
  | "monk";
export type TypingBossId = "emberWhelp" | "cindermaw" | "infernalDragon" | "kraken" | "giantSandWyrm";
export type TypingBossDifficulty = "easy" | "medium" | "hard";
export type DragonHurtTier = "basic" | "power" | "critical";
export interface DragonHurt { id: string; tier: DragonHurtTier; at: number; until: number }
export interface DragonFlameBreath { krakenAttack?:'tidalWave'; id: string; at: number; until: number }
export type TypingBossMode = "old" | "proportional";
export type BattleNetworkMode = "lan" | "wan";
export type TypingBossPromotionLevel=0|1|2;
export interface TypingBossAttackStats {
  promotionMultiplier?:number;
  healingPower?: number;
  orangePower?: number;
  criticalPower?: number;
  criticalBonus?: number;
  balanced?: boolean;
  balancedRandomColors?: boolean;
  earnedPower?: number;
  supportPower?: number;
  supportUsed?: number;
  guardPower?: number;
  powerBonus?: number;
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
  retreated?: boolean;
  rank: number;
  code: string;
  name: string;
  totalDamage: number;
  isBoss?: boolean;
  dps?: number;
  typingStats?: { accuracy: number; wpm: number; meanIntervalMs: number; intervalStdDevMs: number };
  strongestAttack: TypingBossAttackStats | null;
}
export interface TypingBossTypingState {
  summonPrefix?:number[];
  summonWaiting?:boolean;
  promotionLevel?:TypingBossPromotionLevel;
  promoted?:boolean;
  combatDivisor?: number;
  krakenAttackIndex?: number;
  curseMistakes?: Record<number,number>;
  wordProtocol?: 1;
  issuedWords?: TypingBossIssuedWord[];
  previewWords?: Omit<TypingBossIssuedWord,'ticket'>[];
  balanced?: boolean;
  balancedRandomColors?: boolean;
  balancedPower?: number;
  balancedCharacters?: number;
  balancedSpecialAt?: number;
  balancedPace?: number[];
  balancedFlow?: number[];
  balancedGuard?: number;
  balancedGuardMax?: number;
  balancedQuality?: number;
  balancedDefenseWord?: boolean;
  balancedSkillWord?: boolean;
  balancedOrangeBank?: number;
  balancedHealingBank?: number;
  balancedBlockBank?: number;
  balancedHealingDeposit?: number;
  balancedOrangePower?: number;
  balancedCritCharge?: number;
  balancedCritBonus?: number;
  balancedCritAt?: number;
  balancedAttacksWithoutTrigger?: number;
  balancedTriggeredThisAttack?: boolean;
  balancedOrangeAt?: number;
  balancedBlueAt?: number;
  balancedGreenAt?: number;
  balancedDodgeBank?: number;
  balancedCadenceBonus?: number;
  ability?: TypingBossClassId | "dragon" | "kraken" | "wyrm";
  gold?: number;
  attackWords?: number;
  nextPowerBonus?: number;
  dodgeExtraRolls?: number;
  paladinShield?: number;
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
  totalCorrectCharacters?: number;
  totalIntervalCount?: number;
  totalIntervalSum?: number;
  totalIntervalSquares?: number;
  dodgeSamples?: number[];
  dodgeBank?: number;
  attackErrors?: number;
}
// index, typed word, interval count, sum, squared sum, optional Space-to-first-character gap.
export type TypingBossIssuedWord = {index:number;text:string;color:'blue'|'orange'|'red'|'green'|'gold'|null;ticket:string;trigger?:boolean;summonSlot?:number};
export interface ZombieSummon {slot:number;alive:boolean;changedAt:number;event:'spawn'|'resurrection'|'death';attackAt?:number;attackId?:string}
export type TypingBossWordResult = [number, string, number, number, number, (number | null)?, (number[] | null)?, {ticket:string;mistakes:number}?];
export type TypingBossMoveId = "weak" | "strong" | "special" | "potion";
export type TypingBossProjectileKind =
  | "damage"
  | "heal"
  | "resurrect"
  | "buff"
  | "boss";
export type TypingBossProjectileResult = "pending" | "hit" | "miss" | "evade";

export interface TypingBossPlayer {
  consumedAt?:number|null;
  consumedUntil?:number|null;
  spitOutAt?:number|null;
  summons?:ZombieSummon[];
  promotionLevel?:TypingBossPromotionLevel;
  timedOut?: boolean;
  lastTypingAt?: number | null;
  secondWindWordsRemaining?: number;
  protectedUntil?: number | null;
  promoted?:boolean;
  proneUntil?:number|null;
  curseUntil?:number|null;
  curseKey?:{id:string;key:string;at:number;index:number}|null;
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
  knockouts?: number;
  recoverAt?: number | null;
  recoverDurationMs?: number | null;
  typing?: TypingBossTypingState;
  totalTaken?: number;
  attackProgress?: number;
}

export interface WyrmAction {id:string;kind:'wyrmBite'|'slam'|'overrun'|'burrow'|'consume'|'spitOut';at:number;until:number;targetCode?:string}
export interface TypingBossBoss {
  wyrmSpitAt?:number|null;
  wyrmAction?:WyrmAction|null;
  wyrmBurrowed?:boolean;
  krakenWave?:DragonFlameBreath|null;
  krakenCast?:{id:string;at:number;until:number}|null;
  profile?: Partial<TypingBossTypingState>;
  flameBreath?: DragonFlameBreath | null;
  queuedStrongReactions?: number;
  attackCharacters?: number;
  hurt?: DragonHurt | null;
  queuedAttacks?: number;
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
  consumeTick?:boolean;
  summonSlot?:number;
  promoted?:boolean;
  animationStartedAt?: number;
  balanced?: boolean;
  balancedRandomColors?: boolean;
  blockedAmount?: number;
  id: string;
  source: string;
  target: string;
  kind: TypingBossProjectileKind;
  moveId?: string | null;
  bossId?: TypingBossId | null;
  moveLabel: string;
  bossAttack?: "bite" | "fireball" | "tailWhip" | "flamethrower" | "tentacleStrike" | "tentacleSweep" | "tidalWave" | WyrmAction['kind'];
  startedAt: number;
  impactAt: number;
  resolvedAt: number | null;
  result: TypingBossProjectileResult;
  amount: number | null;
  evadeType?: "regular" | "special" | "dodge" | "prone" | "secondWind" | null;
  multiplier?: number;
  sourceName?: string;
  targetName?: string;
  critical?: boolean;
}

export interface TypingBossLogEntry {
  id: string;
  message: string;
  tone: "info" | "hit" | "miss" | "heal" | "danger" | "evade" | "victory";
  createdAt: string;
}

export interface TypingBossSessionSnapshot {
  networkMode?: BattleNetworkMode;
  battleView?: 'personal' | 'full';
  teamActivity?: {damage:number;healing:number;revives:number};
  countdownEndsAt?: number | null;
  timeLimitSeconds?: number | null;
  battleEndsAt?: number | null;
  endReason?: 'time-limit' | null;
  timedResult?: {bossHpPercent: number; teamHpPercent: number} | null;
  clericHealingPool?: number;
  necroHealingPool?: number;
  teamMode?: boolean;
  teamHealth?: {hp: number; maxHp: number} | null;
  clericHealingAllowance?: number;
  balanced?: boolean;
  balancedRandomColors?: boolean;
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
  playerToken?: string;
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
  playerToken: string;
}

export interface TypingBossChallengeResponse
  extends TypingBossSessionResponse {
  challenge: TypingBossChallenge;
}

export interface TypingBossActionResponse extends TypingBossSessionResponse {
  projectile: TypingBossProjectile;
  stats: TypingBossChallengeStats;
}
