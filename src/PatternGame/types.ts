export type PatternStatus = "setup" | "active" | "closed" | "expired" | "complete";
export type PatternTurnPhase =
  | "immediate"
  | "move"
  | "rig"
  | "cast"
  | "declare"
  | "nibble"
  | "set"
  | "wait"
  | "hookSet"
  | "battle"
  | "livewell"
  | "cleanup";
export type Habitat = "V" | "W" | "R" | "O" | "D" | "M";
export type LureType = "Frog" | "Jig" | "Worm" | "Crankbait" | "Spinnerbait" | "Swimbait";
export type LureColor = "Natural" | "Dark" | "Bright" | "Flash";
export type RetrieveType = "Slow" | "Steady" | "Erratic" | "Fast";
export type MoodCategory = "neutral" | "lure" | "color" | "retrieve";
export type BattleAction = "reel" | "pressure" | "giveLine";

export interface PatternCredentials {
  hostToken?: string;
  code?: string;
}

export interface PatternCard {
  id: string;
  key: string;
  name: string;
  category: "tackle" | "trick" | "interference" | "event";
  tradeValue: number | null;
  text: string;
  immediate: boolean;
  dead: boolean;
}

export interface PatternTell {
  lures: LureType[];
  colors: LureColor[];
  retrieves: RetrieveType[];
}

export interface PatternModifierDetail {
  label: string;
  value: number;
}

export interface PatternFishGuess {
  id: string;
  playerId: string;
  playerName: string;
  round: number;
  declaration: {
    lure: LureType;
    color: LureColor;
    retrieve: RetrieveType;
  };
  matchCount: number;
  hotHit: boolean;
  nibbleRoll: number | null;
  nibbleModifier: number | null;
  nibbleTarget: number | null;
  nibbleRawModifier?: number | null;
  nibbleDetails?: PatternModifierDetail[];
  nibbleSuccess: boolean | null;
}

export interface PatternSetResult {
  id: string;
  mode: "now" | "wait";
  hardSet: boolean;
  waitRoll: number | null;
  waitBonus: number;
  waitSpit: boolean;
  hookRoll: number | null;
  hookModifier: number | null;
  hookTarget: number | null;
  hookDetails?: PatternModifierDetail[];
  hookSuccess: boolean | null;
  proceedAfter: string | null;
}

export interface PatternPublicFish {
  publicId: string;
  habitat: Habitat;
  habitatLabel: string;
  tellDifficulty: string;
  tell: PatternTell;
  guessHistory: PatternFishGuess[];
  alert: boolean;
  fight: number | null;
  ability: string | null;
  location?: {
    tileInstanceId: string;
    row: number;
    column: number;
  };
}

export interface PatternFullFish {
  id: string;
  habitat: Habitat;
  habitatLabel: string;
  weightTier: string;
  weight: number;
  innateProfile: {
    lure: LureType;
    color: LureColor;
    retrieve: RetrieveType;
  };
  tellDifficulty: string;
  tell: PatternTell;
  guessHistory: PatternFishGuess[];
  fight: number;
  ability: string;
}

export interface PatternTile {
  id: string;
  templateId: string;
  name: string;
  side: "A" | "B";
  rotation: 0 | 180;
  row: number;
  column: number;
  grid: Habitat[][][];
}

export interface PatternLake {
  width: number;
  height: 2;
  tiles: PatternTile[];
  activeFish: PatternPublicFish[];
}

export interface PatternPlayerPublic {
  code: string;
  name: string;
  ready: boolean;
  joinedAt: string;
  lastSeenAt: string | null;
  locationTileId: string | null;
  equipment: {
    rod: string;
    reel: string;
    line: string;
  };
  tackleSlots: PatternCard[];
  currentPresentation: {
    lure: LureType;
    color: LureColor;
    retrieve: RetrieveType;
  } | null;
  handCount: number;
  livewell: Array<
    | {
        slot: number;
        revealed: true;
        fish: PatternFullFish;
      }
    | {
        slot: number;
        revealed: false;
        label: string;
      }
  >;
}

export interface PatternPlayerPrivate {
  code: string;
  hand: PatternCard[];
  livewell: Array<{
    slot: number;
    revealed: boolean;
    fish: PatternFullFish;
  }>;
  pendingCatch: PatternFullFish | null;
  pendingImmediateCardId: string | null;
  adjacentTileIds: string[];
}

export interface PatternAttempt {
  id: string;
  playerId: string;
  fishPublicId: string;
  habitat: Habitat;
  habitatLabel: string;
  moodCategory: MoodCategory;
  declaration: {
    lure: LureType;
    color: LureColor;
    retrieve: RetrieveType;
  } | null;
  matchCount: number | null;
  hotHit: boolean;
  nibbleRoll: number | null;
  nibbleModifier: number | null;
  nibbleTarget: number | null;
  nibbleRawModifier?: number | null;
  nibbleDetails?: PatternModifierDetail[];
  nibbleSuccess: boolean | null;
  biteBoxResolved: boolean;
}

export interface PatternBattle {
  fishPublicId: string | null;
  playerId: string;
  position: number;
  tension: boolean;
  tangled: boolean;
  abilityUsed: boolean;
  terminal: "landed" | "escaped" | null;
  history: Array<{
    action: BattleAction;
    roll: number | null;
    modifier: number;
    success: boolean;
    movement: number;
    notes: string[];
  }>;
}

export interface PatternLogEntry {
  id: string;
  message: string;
  tone: "info" | "hit" | "miss" | "danger" | "victory";
  createdAt: string;
}

export interface PatternSessionSnapshot {
  id: string;
  name: string;
  status: PatternStatus;
  createdAt: string;
  expiresAt: string;
  closedAt: string | null;
  remainingSeconds: number;
  lakeWidth: number;
  round: number;
  season: string;
  moon: string;
  weather: string;
  activeEvent: {
    key: string;
    name: string;
    text: string;
    round: number;
  } | null;
  playerOrder: string[];
  turn: {
    id: string;
    playerId: string;
    phase: PatternTurnPhase;
    cast: {
      roll: number;
      tileId: string;
      row: number;
      column: number;
      cell: Habitat[];
    } | null;
    selectedFishPublicId: string | null;
    waitUsed: boolean;
    waitBonus: number;
    setResult: PatternSetResult | null;
  } | null;
  lake: PatternLake | null;
  players: PatternPlayerPublic[];
  attempt: PatternAttempt | null;
  battle: PatternBattle | null;
  log: PatternLogEntry[];
  results: {
    standings: Array<{
      playerId: string;
      name: string;
      totalWeight: number;
      weights: number[];
      fish: PatternFullFish[];
    }>;
    winners: string[];
  } | null;
  me?: PatternPlayerPrivate | null;
  host?: {
    hostToken: string;
    deckCount: number;
    discardCount: number;
  };
}

export interface PatternSessionResponse {
  session: PatternSessionSnapshot;
}

export interface CreatePatternSessionResponse extends PatternSessionResponse {
  sessionId: string;
  hostToken: string;
}

export interface PatternParticipantResponse extends PatternSessionResponse {
  code: string;
}
