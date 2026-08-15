import React, {
  MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Box,
  Button,
  Divider,
  Drawer,
  FormControlLabel,
  IconButton,
  Popover,
  Slider,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExploreIcon from "@mui/icons-material/Explore";
import FlagIcon from "@mui/icons-material/Flag";
import MenuIcon from "@mui/icons-material/Menu";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ScoreboardIcon from "@mui/icons-material/Scoreboard";
import ShuffleIcon from "@mui/icons-material/Shuffle";
import * as THREE from "three";
import "./CrossyRoad.css";

type LaneKind = "goal" | "grass" | "road" | "river" | "rail";
type Direction = "up" | "down" | "left" | "right";
type PlayerId = "duck" | "chicken" | "frog" | "rabbit";
type MovingAsset = "car" | "train" | "log";
type DriverKind = "normal" | "aggressive" | "granny";
type PowerUpType = "control" | "speed" | "life" | "jump" | "lightning";
type ScoreItemType = "seeds" | "bread" | "flies" | "carrot";
type PlayerNames = Record<PlayerId, string>;
type LeaderboardTab = "rank" | "score";

type MovingThing = {
  id: string;
  start: number;
  length: number;
  asset: MovingAsset;
  color?: string;
  loopLength?: number;
  speedMultiplier?: number;
  driver?: DriverKind;
  lengthMin?: number;
  lengthMax?: number;
  lengthSeed?: number;
};

type LaneDefinition = {
  row: number;
  kind: LaneKind;
  direction: 1 | -1;
  speed: number;
  hardMode: boolean;
  decorSeed: number;
  things?: MovingThing[];
};

type RuntimeThing = MovingThing & {
  lane: LaneDefinition;
  x: number;
  homeRow?: number;
  laneChangeFromRow?: number;
  laneChangeProgress?: number;
  occupiedRows?: number[];
};

type TrafficCarState = {
  id: string;
  laneRow: number;
  targetLaneRow: number | null;
  laneChangeFromRow: number | null;
  laneChangeStartedAt: number;
  laneChangeEndsAt: number;
  x: number;
  speed: number;
};

type TrafficSimulationCache = {
  signature: string;
  seconds: number;
  cars: Record<string, TrafficCarState>;
};

type MobilePressState = {
  playerId: PlayerId;
  timer: number | null;
  longPressed: boolean;
};

type SwipeState = {
  active: boolean;
  startX: number;
  startY: number;
  pointerId: number | null;
};

type DeathAnimation = {
  type: "flat" | "splash";
  col: number;
  row: number;
  startedAt: number;
  endsAt: number;
};

type MobileLevelConfig = {
  rows: number;
  laneSeed: number;
};

type ActivePowerUp = {
  type: PowerUpType;
  expiresAt: number;
};

type TravelAnimation = {
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
  startedAt: number;
  endsAt: number;
};

type PlayerState = {
  id: PlayerId;
  name: string;
  profileName: string | null;
  joined: boolean;
  accent: string;
  bodyColor: string;
  row: number;
  col: number;
  score: number;
  leaderboardScoreCheckpoint: number;
  laps: number;
  crowns: number;
  misses: number;
  bestProgress: number;
  stunnedUntil: number;
  facing: Direction;
  activePowerUp: ActivePowerUp | null;
  invincibleUntil: number;
  lastMoveAt: number;
  jump: TravelAnimation | null;
  lightning: TravelAnimation | null;
  deathAnimation: DeathAnimation | null;
  celebrateUntil: number;
};

type FeedItem = {
  id: string;
  text: string;
};

type LeaderboardRecord = {
  name: string;
  password: string;
  score: number;
  timeMs: number;
  updatedAt: number;
};

type ControlAction = {
  playerId: PlayerId;
  rowDelta: number;
  colDelta: number;
};

type PowerUpSettings = Record<PowerUpType, { enabled: boolean; frequency: number }>;

type GameSettings = {
  cols: number;
  rows: number;
  carSpeed: number;
  trainSpeed: number;
  logSpeed: number;
  moveCooldown: number;
  defaultZoom: number;
  hardMode: boolean;
  logLengthMin: number;
  logLengthMax: number;
  grannyDriverSpeed: number;
  trainLengthMin: number;
  trainLengthMax: number;
  laneSeed: number;
  showDeathLog: boolean;
  playerNames: PlayerNames;
  powerUps: PowerUpSettings;
};

type BoardConfig = {
  cols: number;
  rows: number;
  startRow: number;
  playerStartRow: number;
  halfCols: number;
  halfRows: number;
  startCols: Record<PlayerId, number>;
  clipPlanes: THREE.Plane[];
};

type PickupOrigin = {
  x: number;
  y: number;
  z: number;
};

type PowerUpInstance = {
  id: string;
  row: number;
  col: number;
  spawnedAt: number;
  expiresAt: number;
  entryOrigin?: PickupOrigin;
} & (
  | { kind: "power"; type: PowerUpType }
  | { kind: "score"; type: ScoreItemType }
);

type NatureDecorKind = "tree" | "rock";
type NatureDecorVariant = 0 | 1 | 2;

type NatureDecorItem = {
  id: string;
  row: number;
  col: number;
  kind: NatureDecorKind;
  variant: NatureDecorVariant;
  rotation: number;
  scale: number;
};

type BlockProps = {
  color: string;
  size: [number, number, number];
  position?: [number, number, number];
  roughness?: number;
  metalness?: number;
  clippingPlanes?: THREE.Plane[];
  transparent?: boolean;
  opacity?: number;
  emissive?: string;
  emissiveIntensity?: number;
};

const SETTINGS_KEY = "crossy-road-3d-settings-v3";
const LEADERBOARD_KEY = "crossy-road-leaderboard-v1";
const MOBILE_LEVELS_KEY = "crossy-road-mobile-levels-v1";
const MIN_COLS = 7;
const MAX_COLS = 31;
const MIN_ROWS = 7;
const MAX_ROWS = 41;
const MAX_POWER_UPS_ON_BOARD = 3;
const POWER_UP_MIN_SECONDS = 20;
const POWER_UP_MAX_SECONDS = 40;
const PICKUP_ENTRY_SECONDS = 1.25;
const PICKUP_EXIT_SECONDS = 1.25;
const MOVING_OFFSCREEN_BUFFER = 1.15;
const LANE_CHANGE_SECONDS = 1.1;
const TRAFFIC_GAP = 0.55;
const TRAFFIC_LOOK_AHEAD_SECONDS = 0.82;
const TRAFFIC_SIMULATION_STEP = 0.045;
const TRAIN_CAR_LENGTH = 1;
const MOBILE_TURN_MS = 60000;
const FLAT_DEATH_MS = 2000;
const SPLASH_DEATH_MS = 1000;
const FLAG_CELEBRATION_MS = 2200;
const ZOOM_MIN = 0.55;
const ZOOM_MAX = 2.5;
const CAMERA_PITCH_MIN = 0.34;
const CAMERA_PITCH_MAX = 1.38;
const CAMERA_PITCH_DEFAULT = 0.86;
const CAMERA_TILT_45 = Math.PI / 4;
const CAMERA_LOW_PITCH = (CAMERA_TILT_45 + CAMERA_PITCH_MIN) / 2;
const PORTRAIT_CAMERA_YAW = Math.PI / 8;
const PORTRAIT_CAMERA_ZOOM = 1.85;
const CAMERA_DIRECTION_PRESETS = [
  ["N", 0],
  ["NE", Math.PI / 4],
  ["E", Math.PI / 2],
  ["SE", (Math.PI * 3) / 4],
  ["S", Math.PI],
  ["SW", (-Math.PI * 3) / 4],
  ["W", -Math.PI / 2],
  ["NW", -Math.PI / 4],
] as const;
type CameraDirectionLabel = (typeof CAMERA_DIRECTION_PRESETS)[number][0];
const CAMERA_COMPASS_LAYOUT: (CameraDirectionLabel | null)[] = [
  "NW",
  "N",
  "NE",
  "W",
  null,
  "E",
  "SW",
  "S",
  "SE",
];
const CAMERA_TILT_PRESETS = [
  ["Top", CAMERA_PITCH_MAX],
  ["High", (CAMERA_PITCH_MAX + CAMERA_TILT_45) / 2],
  ["45", CAMERA_TILT_45],
  ["Low", CAMERA_LOW_PITCH],
  ["Flat", CAMERA_PITCH_MIN],
] as const;
type CameraTiltLabel = (typeof CAMERA_TILT_PRESETS)[number][0];
const POWER_UP_TYPES: PowerUpType[] = ["control", "speed", "life", "jump", "lightning"];
const SCORE_ITEM_TYPES: ScoreItemType[] = ["seeds", "bread", "flies", "carrot"];
const PLAYER_IDS: PlayerId[] = ["duck", "frog", "chicken", "rabbit"];
const SAFE_START_ROWS = 4;
const START_BACKDROP_ROWS = 10;
const START_BACKDROP_DECOR_FILL = 0.5;
const CROWN_POINTS = 1000;
const CROWN_BADGE_INLINE_LIMIT = 3;
const LEVEL_REGEN_ATTEMPTS = 40;
const GRASS_DECOR_D20_SIDES = 20;
const GRASS_DECOR_D20_HIT = 1;

const DEFAULT_PLAYER_NAMES: PlayerNames = {
  duck: "Duck",
  frog: "Frog",
  chicken: "Chicken",
  rabbit: "Rabbit",
};

const DEFAULT_POWER_UP_SETTINGS: PowerUpSettings = {
  control: { enabled: true, frequency: 1 },
  speed: { enabled: true, frequency: 2 },
  life: { enabled: true, frequency: 1 },
  jump: { enabled: true, frequency: 2 },
  lightning: { enabled: true, frequency: 1 },
};

const DEFAULT_SETTINGS: GameSettings = {
  cols: 13,
  rows: 17,
  carSpeed: 1,
  trainSpeed: 1,
  logSpeed: 1,
  moveCooldown: 0.25,
  defaultZoom: 1,
  hardMode: false,
  logLengthMin: 1,
  logLengthMax: 5,
  grannyDriverSpeed: 0.85,
  trainLengthMin: 5,
  trainLengthMax: 7,
  laneSeed: 1,
  showDeathLog: false,
  playerNames: DEFAULT_PLAYER_NAMES,
  powerUps: DEFAULT_POWER_UP_SETTINGS,
};

const POWER_UP_DEFS: Record<
  PowerUpType,
  { label: string; color: string; durationMs: number; detail: string }
> = {
  control: {
    label: "Opponent Control",
    color: "#ef4444",
    durationMs: 15000,
    detail: "Run into your opponent to shove them.",
  },
  speed: {
    label: "Speed",
    color: "#facc15",
    durationMs: 15000,
    detail: "Move as fast as you can click or press.",
  },
  life: {
    label: "Extra Life",
    color: "#38bdf8",
    durationMs: 15000,
    detail: "Vehicle hits grant 2 seconds of invincibility instead of a reset.",
  },
  jump: {
    label: "High Jump",
    color: "#22c55e",
    durationMs: 15000,
    detail: "Move 2 spaces with a 0.5 second jump.",
  },
  lightning: {
    label: "Lightning",
    color: "#ffffff",
    durationMs: 7000,
    detail: "From grass, teleport vertically to grass if the path is clear.",
  },
};

const SCORE_ITEM_DEFS: Record<
  ScoreItemType,
  { label: string; color: string; accent: string; bonusFor: PlayerId }
> = {
  seeds: {
    label: "Seeds",
    color: "#d8a927",
    accent: "#5f4115",
    bonusFor: "chicken",
  },
  bread: {
    label: "Bread",
    color: "#d99a4e",
    accent: "#7a4423",
    bonusFor: "duck",
  },
  flies: {
    label: "Flies",
    color: "#1f2937",
    accent: "#22c55e",
    bonusFor: "frog",
  },
  carrot: {
    label: "Carrot",
    color: "#a96a3a",
    accent: "#6f4326",
    bonusFor: "rabbit",
  },
};

const PLAYER_META: Record<
  PlayerId,
  Pick<PlayerState, "name" | "accent" | "bodyColor">
> = {
  duck: {
    name: "Duck",
    accent: "#f2c84b",
    bodyColor: "#f4c63d",
  },
  chicken: {
    name: "Chicken",
    accent: "#fb7185",
    bodyColor: "#fff5df",
  },
  frog: {
    name: "Frog",
    accent: "#3fbf5f",
    bodyColor: "#42b85c",
  },
  rabbit: {
    name: "Rabbit",
    accent: "#9b6a43",
    bodyColor: "#8a5a35",
  },
};

const KEYBOARD_CONTROLS: Record<string, ControlAction> = {
  w: { playerId: "duck", rowDelta: -1, colDelta: 0 },
  a: { playerId: "duck", rowDelta: 0, colDelta: -1 },
  s: { playerId: "duck", rowDelta: 1, colDelta: 0 },
  d: { playerId: "duck", rowDelta: 0, colDelta: 1 },
  arrowup: { playerId: "chicken", rowDelta: -1, colDelta: 0 },
  arrowleft: { playerId: "chicken", rowDelta: 0, colDelta: -1 },
  arrowdown: { playerId: "chicken", rowDelta: 1, colDelta: 0 },
  arrowright: { playerId: "chicken", rowDelta: 0, colDelta: 1 },
  i: { playerId: "frog", rowDelta: -1, colDelta: 0 },
  j: { playerId: "frog", rowDelta: 0, colDelta: -1 },
  k: { playerId: "frog", rowDelta: 1, colDelta: 0 },
  l: { playerId: "frog", rowDelta: 0, colDelta: 1 },
  t: { playerId: "rabbit", rowDelta: -1, colDelta: 0 },
  f: { playerId: "rabbit", rowDelta: 0, colDelta: -1 },
  g: { playerId: "rabbit", rowDelta: 1, colDelta: 0 },
  h: { playerId: "rabbit", rowDelta: 0, colDelta: 1 },
};

const PLAYER_UP_KEYS: Record<PlayerId, string> = {
  duck: "W",
  chicken: "ArrowUp",
  frog: "I",
  rabbit: "T",
};

const PLAYER_EXIT_KEYS: Record<PlayerId, string[]> = {
  duck: ["a", "s", "d"],
  chicken: ["arrowleft", "arrowdown", "arrowright"],
  frog: ["j", "k", "l"],
  rabbit: ["f", "g", "h"],
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function animalIcon(playerId: PlayerId) {
  return playerId === "duck"
    ? "\u{1F986}"
    : playerId === "chicken"
    ? "\u{1F414}"
    : playerId === "frog"
    ? "\u{1F438}"
    : "\u{1F407}";
}

function CrownBadges({ crowns }: { crowns: number }) {
  const count = Math.max(0, Math.floor(crowns));
  if (count === 0) return null;

  if (count <= CROWN_BADGE_INLINE_LIMIT) {
    return (
      <span className="crossy-crown-badges" aria-label={`${count} crowns`}>
        {Array.from({ length: count }).map((_, index) => (
          <span key={index} className="crossy-crown-badge" aria-hidden="true">
            {"\u265B"}
          </span>
        ))}
      </span>
    );
  }

  return (
    <span className="crossy-crown-badges crossy-crown-badges-compact" aria-label={`${count} crowns`}>
      <span className="crossy-crown-badge" aria-hidden="true">
        {"\u265B"}
      </span>
      <strong>{count}</strong>
    </span>
  );
}

function PlayerIcon({ player, ariaLabel }: { player: PlayerState; ariaLabel?: string }) {
  return (
    <span className="crossy-racer-token-shell">
      <CrownBadges crowns={player.crowns} />
      <span className="crossy-racer-token" aria-label={ariaLabel} aria-hidden={ariaLabel ? undefined : true}>
        {animalIcon(player.id)}
      </span>
    </span>
  );
}

function cleanPlayerName(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  return value.slice(0, 18);
}

function cleanNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, min, max);
}

function normalizeProfileName(value: string) {
  return value.trim().toLowerCase();
}

function isDefaultPlayerName(value: string) {
  const normalized = normalizeProfileName(value);
  return PLAYER_IDS.some((id) => normalizeProfileName(DEFAULT_PLAYER_NAMES[id]) === normalized);
}

function shouldTrackProfileName(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 && !isDefaultPlayerName(trimmed);
}

function readLeaderboard(): LeaderboardRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const saved = window.localStorage.getItem(LEADERBOARD_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved) as Partial<LeaderboardRecord>[];
    return parsed
      .filter((record) => typeof record.name === "string" && typeof record.password === "string")
      .map((record) => ({
        name: record.name ?? "",
        password: record.password ?? "",
        score: cleanNumber(record.score, 0, 0, Number.MAX_SAFE_INTEGER),
        timeMs: cleanNumber(record.timeMs, 0, 0, Number.MAX_SAFE_INTEGER),
        updatedAt: cleanNumber(record.updatedAt, Date.now(), 0, Number.MAX_SAFE_INTEGER),
      }));
  } catch {
    return [];
  }
}

function writeLeaderboard(records: LeaderboardRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(records));
}

function findLeaderboardRecord(records: LeaderboardRecord[], name: string) {
  const normalized = normalizeProfileName(name);
  return records.find((record) => normalizeProfileName(record.name) === normalized);
}

function rankedLeaderboard(records: LeaderboardRecord[], tab: LeaderboardTab) {
  return [...records].sort((a, b) => {
    if (tab === "score") return b.score - a.score || a.name.localeCompare(b.name);
    const rankA = a.score / Math.max(a.timeMs / 60000, 1 / 60);
    const rankB = b.score / Math.max(b.timeMs / 60000, 1 / 60);
    return rankB - rankA || b.score - a.score || a.name.localeCompare(b.name);
  });
}

function makeMobileLevelConfigs(settings: GameSettings) {
  return PLAYER_IDS.reduce((acc, id) => {
    acc[id] = {
      rows: settings.rows,
      laneSeed: settings.laneSeed,
    };
    return acc;
  }, {} as Record<PlayerId, MobileLevelConfig>);
}

function readMobileLevelConfigs(settings: GameSettings) {
  const fallback = makeMobileLevelConfigs(settings);
  if (typeof window === "undefined") return fallback;

  try {
    const saved = window.sessionStorage.getItem(MOBILE_LEVELS_KEY);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved) as Partial<Record<PlayerId, Partial<MobileLevelConfig>>>;
    return PLAYER_IDS.reduce((acc, id) => {
      acc[id] = {
        rows: Math.round(cleanNumber(parsed[id]?.rows, fallback[id].rows, MIN_ROWS, MAX_ROWS)),
        laneSeed: cleanNumber(parsed[id]?.laneSeed, fallback[id].laneSeed, 1, 999999999),
      };
      return acc;
    }, {} as Record<PlayerId, MobileLevelConfig>);
  } catch {
    return fallback;
  }
}

function writeMobileLevelConfigs(configs: Record<PlayerId, MobileLevelConfig>) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(MOBILE_LEVELS_KEY, JSON.stringify(configs));
}

function randomLaneSeed() {
  return Math.floor(Math.random() * 999999999) + 1;
}

function formatPlayTime(timeMs: number) {
  const seconds = Math.max(0, Math.floor(timeMs / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function positiveModulo(value: number, modulo: number) {
  return ((value % modulo) + modulo) % modulo;
}

function createSeededRandom(seed: number) {
  let value = Math.floor(seed) % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function randomBetween(random: () => number, min: number, max: number) {
  return min + random() * (max - min);
}

function makeSpacedStarts(lengths: number[], loopLength: number, random: () => number) {
  if (lengths.length === 0) return [];

  const maxLength = Math.max(...lengths);
  let count = lengths.length;
  while (count > 1 && loopLength / count < maxLength + 1.25) {
    count -= 1;
  }

  const segment = loopLength / count;
  const offset = random() * segment;
  return lengths.slice(0, count).map((_, index) => positiveModulo(offset + index * segment, loopLength));
}

function makeLoopStarts(lengths: number[], loopLength: number) {
  if (lengths.length === 0) return [];

  const maxLength = Math.max(...lengths);
  let count = lengths.length;
  while (count > 1 && loopLength / count < maxLength + 1.25) {
    count -= 1;
  }

  const segment = loopLength / count;
  return lengths.slice(0, count).map((_, index) => index * segment);
}

function pickDriverKind(random: () => number): DriverKind {
  const roll = random();
  if (roll < 0.18) return "aggressive";
  if (roll < 0.38) return "granny";
  return "normal";
}

function driverSpeedMultiplier(driver: DriverKind, settings: GameSettings) {
  if (driver === "aggressive") return 1.15;
  if (driver === "granny") return settings.grannyDriverSpeed;
  return 1;
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function randomPowerUpSeconds(random: () => number) {
  return POWER_UP_MIN_SECONDS + random() * (POWER_UP_MAX_SECONDS - POWER_UP_MIN_SECONDS);
}

function pickPowerUpType(settings: GameSettings, random: () => number) {
  const enabledTypes = POWER_UP_TYPES.map((type) => ({
    type,
    weight: Math.max(0, settings.powerUps[type].frequency),
  })).filter(({ type, weight }) => settings.powerUps[type].enabled && weight > 0);

  const totalWeight = enabledTypes.reduce((sum, powerUp) => sum + powerUp.weight, 0);
  if (totalWeight <= 0) return null;

  let roll = random() * totalWeight;
  for (const powerUp of enabledTypes) {
    roll -= powerUp.weight;
    if (roll <= 0) return powerUp.type;
  }

  return enabledTypes[enabledTypes.length - 1]?.type ?? null;
}

function pickScoreItemType(random: () => number) {
  return SCORE_ITEM_TYPES[Math.floor(random() * SCORE_ITEM_TYPES.length)];
}

function pickSpawnItem(settings: GameSettings, random: () => number) {
  const scoreChoice = { kind: "score" as const, type: pickScoreItemType(random) };
  if (random() < 0.42) return scoreChoice;

  const powerType = pickPowerUpType(settings, random);
  return powerType ? { kind: "power" as const, type: powerType } : scoreChoice;
}

function scoreItemValue(type: ScoreItemType, playerId: PlayerId) {
  return SCORE_ITEM_DEFS[type].bonusFor === playerId ? 150 : 100;
}

function loadSettings(): GameSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;

  try {
    const saved = window.sessionStorage.getItem(SETTINGS_KEY);
    if (!saved) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(saved) as Partial<GameSettings>;
    const trainLengthMin = cleanNumber(parsed.trainLengthMin, DEFAULT_SETTINGS.trainLengthMin, 1, 50);
    const trainLengthMax = cleanNumber(parsed.trainLengthMax, DEFAULT_SETTINGS.trainLengthMax, 1, 50);
    const logLengthMin = cleanNumber(parsed.logLengthMin, DEFAULT_SETTINGS.logLengthMin, 1, 10);
    const logLengthMax = cleanNumber(parsed.logLengthMax, DEFAULT_SETTINGS.logLengthMax, 1, 10);

    return {
      cols: Math.round(cleanNumber(parsed.cols, DEFAULT_SETTINGS.cols, MIN_COLS, MAX_COLS)),
      rows: Math.round(cleanNumber(parsed.rows, DEFAULT_SETTINGS.rows, MIN_ROWS, MAX_ROWS)),
      carSpeed: cleanNumber(parsed.carSpeed, DEFAULT_SETTINGS.carSpeed, 0.5, 1.5),
      trainSpeed: cleanNumber(parsed.trainSpeed, DEFAULT_SETTINGS.trainSpeed, 0.5, 1.5),
      logSpeed: cleanNumber(parsed.logSpeed, DEFAULT_SETTINGS.logSpeed, 0.5, 1.5),
      moveCooldown: cleanNumber(parsed.moveCooldown, DEFAULT_SETTINGS.moveCooldown, 0, 2),
      defaultZoom: cleanNumber(parsed.defaultZoom, DEFAULT_SETTINGS.defaultZoom, ZOOM_MIN, ZOOM_MAX),
      hardMode: parsed.hardMode ?? DEFAULT_SETTINGS.hardMode,
      logLengthMin: Math.min(logLengthMin, logLengthMax),
      logLengthMax: Math.max(logLengthMin, logLengthMax),
      grannyDriverSpeed: cleanNumber(parsed.grannyDriverSpeed, DEFAULT_SETTINGS.grannyDriverSpeed, 0.5, 1.5),
      trainLengthMin: Math.min(trainLengthMin, trainLengthMax),
      trainLengthMax: Math.max(trainLengthMin, trainLengthMax),
      laneSeed: cleanNumber(parsed.laneSeed, DEFAULT_SETTINGS.laneSeed, 1, 999999999),
      showDeathLog: parsed.showDeathLog ?? DEFAULT_SETTINGS.showDeathLog,
      playerNames: PLAYER_IDS.reduce((acc, id) => {
        acc[id] = cleanPlayerName(parsed.playerNames?.[id], DEFAULT_PLAYER_NAMES[id]);
        return acc;
      }, {} as PlayerNames),
      powerUps: POWER_UP_TYPES.reduce((acc, type) => {
        const savedPowerUp = parsed.powerUps?.[type];
        acc[type] = {
          enabled: savedPowerUp?.enabled ?? DEFAULT_POWER_UP_SETTINGS[type].enabled,
          frequency: cleanNumber(
            savedPowerUp?.frequency,
            DEFAULT_POWER_UP_SETTINGS[type].frequency,
            1,
            10,
          ),
        };
        return acc;
      }, {} as PowerUpSettings),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: GameSettings) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function createBoard(settings: GameSettings): BoardConfig {
  const cols = Math.round(clamp(settings.cols, MIN_COLS, MAX_COLS));
  const rows = Math.round(clamp(settings.rows, MIN_ROWS, MAX_ROWS));
  const duckStart = clamp(Math.floor(cols / 2) - 2, 0, cols - 1);
  const frogStart = clamp(Math.floor(cols / 2) - 1, 0, cols - 1);
  const chickenStart = clamp(Math.floor(cols / 2) + 1, 0, cols - 1);
  const rabbitStart = clamp(Math.floor(cols / 2) + 2, 0, cols - 1);
  const halfCols = cols / 2;
  const halfRows = rows / 2;

  return {
    cols,
    rows,
    startRow: rows - 1,
    playerStartRow: Math.max(0, rows - SAFE_START_ROWS),
    halfCols,
    halfRows,
    startCols: {
      duck: duckStart,
      frog: frogStart,
      chicken: chickenStart,
      rabbit: rabbitStart,
    },
    clipPlanes: [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), halfCols),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), halfCols),
    ],
  };
}

function makeMovingThings(
  kind: LaneKind,
  row: number,
  direction: 1 | -1,
  settings: GameSettings,
  board: BoardConfig,
  random: () => number,
): MovingThing[] | undefined {
  if (kind !== "road" && kind !== "rail" && kind !== "river") return undefined;

  if (kind === "rail") {
    const minCars = Math.round(clamp(settings.trainLengthMin, 1, 50));
    const maxCars = Math.round(clamp(settings.trainLengthMax, minCars, 50));
    const count = board.cols > 18 && maxCars <= board.cols * 0.72 ? 2 : 1;
    const lengths = Array.from({ length: count }).map(() =>
      Math.floor(randomBetween(random, minCars, maxCars + 1)) * TRAIN_CAR_LENGTH,
    );
    const loopLength = board.cols + maxCars * TRAIN_CAR_LENGTH + MOVING_OFFSCREEN_BUFFER * 2;
    const starts = makeSpacedStarts(lengths, loopLength, random);

    return starts.map((start, index) => ({
      id: `train-${row}-${index}`,
      start,
      length: maxCars * TRAIN_CAR_LENGTH,
      asset: "train",
      loopLength,
      speedMultiplier: randomBetween(random, 0.85, 1.15),
      lengthMin: minCars * TRAIN_CAR_LENGTH,
      lengthMax: maxCars * TRAIN_CAR_LENGTH,
      lengthSeed: row * 101 + index * 17 + settings.laneSeed,
    }));
  }

  if (kind === "river") {
    const minLength = settings.hardMode ? Math.round(clamp(settings.logLengthMin, 1, 10)) : 2;
    const maxLength = settings.hardMode
      ? Math.round(clamp(settings.logLengthMax, minLength, 10))
      : 4;
    const lengths = Array.from({ length: Math.max(2, Math.floor(board.cols / 5)) }).map(() =>
      Math.floor(randomBetween(random, minLength, maxLength + 1)),
    );
    const loopLength = board.cols + Math.max(...lengths) + MOVING_OFFSCREEN_BUFFER * 2;
    const starts = makeSpacedStarts(lengths, loopLength, random);

    return starts.map((start, index) => ({
      id: `log-${row}-${index}`,
      start,
      length: lengths[index],
      asset: "log",
      loopLength,
      speedMultiplier: 1,
    }));
  }

  const carColors = ["#f6c945", "#e9504f", "#5da0f2", "#5fc47b", "#2f80ed"];
  const lengths = Array.from({ length: Math.max(2, Math.floor(board.cols / 4)) }).map(() =>
    randomBetween(random, 1.05, 1.35),
  );
  const loopLength = board.cols + Math.max(...lengths) + MOVING_OFFSCREEN_BUFFER * 2;
  const starts = makeLoopStarts(lengths, loopLength);

  return starts.map((start, index) => {
    const driver = settings.hardMode ? pickDriverKind(random) : "normal";
    const color =
      driver === "aggressive"
        ? "#f97316"
        : driver === "granny"
        ? "#94a3b8"
        : carColors[(row + index) % carColors.length];

    return {
      id: `car-${row}-${index}`,
      start,
      length: lengths[index],
      asset: "car",
      color,
      loopLength,
      driver,
      speedMultiplier: driverSpeedMultiplier(driver, settings),
    };
  });
}

function buildLanes(settings: GameSettings, board: BoardConfig): LaneDefinition[] {
  const random = createSeededRandom(settings.laneSeed + board.cols * 37 + board.rows * 53);
  const defaultPattern: LaneKind[] = [
    "road",
    "road",
    "rail",
    "grass",
    "river",
    "river",
    "river",
    "grass",
    "road",
    "rail",
    "road",
    "grass",
    "river",
    "road",
    "road",
  ];

  const lanes: LaneDefinition[] = [];

  for (let row = 0; row < board.rows; row += 1) {
    const isDefault = settings.laneSeed === DEFAULT_SETTINGS.laneSeed;
    const isStartGrass = row >= board.startRow - (SAFE_START_ROWS - 1);
    const kind: LaneKind =
      row === 0
        ? "goal"
        : isStartGrass
        ? "grass"
        : isDefault
        ? defaultPattern[(row - 1) % defaultPattern.length]
        : random() < 0.24
        ? "grass"
        : random() < 0.43
        ? "river"
        : random() < 0.7
        ? "road"
        : "rail";
    const previousLane = lanes[row - 1];
    const direction: 1 | -1 =
      settings.hardMode &&
      previousLane &&
      ((kind === "road" && previousLane.kind === "road") ||
        (kind === "river" && previousLane.kind === "river"))
        ? previousLane.direction
        : (row + Math.floor(settings.laneSeed)) % 2 === 0
        ? 1
        : -1;

    let baseSpeed =
      kind === "road"
        ? randomBetween(random, 1.8, 3.05) * settings.carSpeed
        : kind === "rail"
        ? 7.2 * settings.trainSpeed
        : kind === "river"
        ? randomBetween(random, 1.0, 1.75) * settings.logSpeed
        : 0;
    if (kind === "river" && previousLane?.kind === "river") {
      const speedBand = row % 2 === 0 ? 1.18 : 0.82;
      baseSpeed *= speedBand;
      if (Math.abs(baseSpeed - previousLane.speed) < 0.16) {
        baseSpeed += (row % 2 === 0 ? 0.22 : -0.22) * settings.logSpeed;
      }
    }

    lanes.push({
      row,
      kind,
      direction,
      speed: baseSpeed,
      hardMode: settings.hardMode,
      decorSeed: Math.floor(settings.laneSeed * 131 + row * 977 + board.cols * 37 + board.rows * 53),
      things: makeMovingThings(kind, row, direction, settings, board, random),
    });
  }

  return lanes;
}

function nextRegeneratedLaneSeed(seed: number, attempt: number) {
  return Math.floor(positiveModulo(seed * 9301 + 49297 + attempt * 233280, 999999998)) + 1;
}

function hasFullyBlockedForestRow(lanes: LaneDefinition[], board: BoardConfig) {
  for (let row = 0; row <= maxPlayableRow(board); row += 1) {
    const isForestRow =
      isStartBacklotRow(row, board) ||
      (row < board.playerStartRow && getLane(lanes, row).kind === "grass");
    if (!isForestRow) continue;

    const openCol = Array.from({ length: board.cols }).find(
      (_, col) => !hasForestBlocker(row, col, lanes, board),
    );
    if (openCol == null) return true;
  }

  return false;
}

function generateLanes(settings: GameSettings, board: BoardConfig): LaneDefinition[] {
  let seed = settings.laneSeed;
  let fallback = buildLanes(settings, board);

  for (let attempt = 0; attempt < LEVEL_REGEN_ATTEMPTS; attempt += 1) {
    const candidateSettings = attempt === 0 ? settings : { ...settings, laneSeed: seed };
    const lanes = attempt === 0 ? fallback : buildLanes(candidateSettings, board);
    if (!hasFullyBlockedForestRow(lanes, board)) return lanes;

    fallback = lanes;
    seed = nextRegeneratedLaneSeed(seed, attempt);
  }

  return fallback;
}

function getLane(lanes: LaneDefinition[], row: number) {
  return lanes[clamp(Math.round(row), 0, lanes.length - 1)] ?? lanes[lanes.length - 1];
}

function isSafeLane(lane: LaneDefinition) {
  return lane.kind === "grass" || lane.kind === "goal";
}

function getFacing(rowDelta: number, colDelta: number): Direction {
  if (rowDelta < 0) return "up";
  if (rowDelta > 0) return "down";
  if (colDelta < 0) return "left";
  return "right";
}

function worldXFromCenter(col: number, board: BoardConfig) {
  return col + 0.5 - board.halfCols;
}

function worldZFromCenter(row: number, board: BoardConfig) {
  return row + 0.5 - board.halfRows;
}

function maxPlayableRow(board: BoardConfig) {
  return board.rows + START_BACKDROP_ROWS - 1;
}

function isStartBacklotRow(row: number, board: BoardConfig) {
  return row >= board.rows && row <= maxPlayableRow(board);
}

function crownCell(board: BoardConfig) {
  return {
    row: maxPlayableRow(board),
    col: Math.floor(board.cols / 2),
  };
}

function isCrownCell(row: number, col: number, board: BoardConfig) {
  const crown = crownCell(board);
  return row === crown.row && col === crown.col;
}

function worldXFromThing(thing: RuntimeThing, board: BoardConfig) {
  return thing.x + thing.length / 2 - board.halfCols;
}

function seededUnit(value: number) {
  return positiveModulo(Math.sin(value * 12.9898) * 43758.5453, 1);
}

function laneDecorSeed(lanes: LaneDefinition[], board: BoardConfig) {
  return (lanes[0]?.decorSeed ?? 101) + board.cols * 409 + board.rows * 257;
}

function natureDecorForCell(row: number, col: number, seedBase: number, fillChance: number) {
  const cellSeed = seedBase + row * 15485863 + col * 32452843;
  if (seededUnit(cellSeed) >= fillChance) return null;

  const kind: NatureDecorKind = seededUnit(cellSeed + 11) < 0.58 ? "tree" : "rock";
  const variant = Math.floor(seededUnit(cellSeed + 23) * 3) as NatureDecorVariant;
  return {
    id: `${kind}-${row}-${col}`,
    row,
    col,
    kind,
    variant,
    rotation: Math.floor(seededUnit(cellSeed + 31) * 4) * (Math.PI / 2),
    scale: kind === "tree" ? 0.88 + seededUnit(cellSeed + 47) * 0.18 : 0.82 + seededUnit(cellSeed + 47) * 0.22,
  };
}

function grassDecorD20Hit(row: number, col: number, seedBase: number) {
  const roll =
    Math.floor(seededUnit(seedBase + row * 49999 + col * 7867 + 19) * GRASS_DECOR_D20_SIDES) + 1;
  return roll === GRASS_DECOR_D20_HIT;
}

function hasPlayableGrassDecor(row: number, col: number, lanes: LaneDefinition[], board: BoardConfig) {
  if (row < 0 || row >= board.rows || col < 0 || col >= board.cols) return false;
  if (row >= board.playerStartRow) return false;
  const lane = getLane(lanes, row);
  if (lane.kind !== "grass") return false;
  return grassDecorD20Hit(row, col, lane.decorSeed);
}

function hasStartBacklotDecor(row: number, col: number, lanes: LaneDefinition[], board: BoardConfig) {
  if (!isStartBacklotRow(row, board) || col < 0 || col >= board.cols) return false;
  if (isCrownCell(row, col, board)) return false;
  const seedBase = laneDecorSeed(lanes, board) + 88711;
  return natureDecorForCell(row, col, seedBase, START_BACKDROP_DECOR_FILL) != null;
}

function hasForestBlocker(row: number, col: number, lanes: LaneDefinition[], board: BoardConfig) {
  return hasPlayableGrassDecor(row, col, lanes, board) || hasStartBacklotDecor(row, col, lanes, board);
}

function crownLevelKey(lanes: LaneDefinition[], board: BoardConfig) {
  return `${board.cols}x${board.rows}:${lanes.map((lane) => lane.decorSeed).join(".")}`;
}

function getThingLength(thing: MovingThing, lane: LaneDefinition, seconds: number) {
  if (thing.asset !== "train" || thing.lengthMin == null || thing.lengthMax == null) {
    return thing.length;
  }

  const loopWidth = thing.loopLength ?? 1;
  const rawPhase = thing.start + lane.speed * (thing.speedMultiplier ?? 1) * seconds;
  const loopIndex = Math.floor(rawPhase / loopWidth);
  const minLength = Math.min(thing.lengthMin, thing.lengthMax);
  const maxLength = Math.max(thing.lengthMin, thing.lengthMax);
  return Math.floor(minLength + seededUnit((thing.lengthSeed ?? 1) + loopIndex * 31.17) * (maxLength - minLength + 1));
}

function getMovingX(thing: MovingThing, lane: LaneDefinition, seconds: number, board: BoardConfig, length = getThingLength(thing, lane, seconds)) {
  const loopWidth = thing.loopLength ?? board.cols + thing.length + MOVING_OFFSCREEN_BUFFER * 2;
  const phase = positiveModulo(thing.start + lane.speed * (thing.speedMultiplier ?? 1) * seconds, loopWidth);
  if (lane.direction === 1) return phase - length - MOVING_OFFSCREEN_BUFFER;
  return board.cols + MOVING_OFFSCREEN_BUFFER - phase;
}

function laneChangeProgress(thing: RuntimeThing, board: BoardConfig) {
  if (thing.laneChangeProgress != null) return easeInOut(clamp(thing.laneChangeProgress, 0, 1));

  const raw = (thing.x + thing.length + MOVING_OFFSCREEN_BUFFER) / (board.cols + thing.length + MOVING_OFFSCREEN_BUFFER * 2);
  const progress = thing.lane.direction === 1 ? raw : 1 - raw;
  return easeInOut(clamp(progress, 0, 1));
}

function worldZFromRuntimeThing(thing: RuntimeThing, board: BoardConfig) {
  const targetZ = worldZFromCenter(thing.lane.row, board);
  if (thing.laneChangeFromRow == null) return targetZ;

  const fromZ = worldZFromCenter(thing.laneChangeFromRow, board);
  const progress = laneChangeProgress(thing, board);
  return THREE.MathUtils.lerp(fromZ, targetZ, progress) + Math.sin(progress * Math.PI * 2) * 0.08;
}

function intervalsOverlap(startA: number, endA: number, startB: number, endB: number, gap = 0.3) {
  return startA < endB + gap && endA > startB - gap;
}

function runtimeThingOccupiesRow(thing: RuntimeThing, row: number) {
  return thing.occupiedRows ? thing.occupiedRows.includes(row) : thing.lane.row === row;
}

function adjacentPassingLanes(lanes: LaneDefinition[], lane: LaneDefinition) {
  return [lane.row - 1, lane.row + 1]
    .map((row) => lanes[row])
    .filter((candidate): candidate is LaneDefinition =>
      Boolean(candidate && candidate.kind === "road"),
    );
}

function carStateOccupiedRows(state: TrafficCarState) {
  return state.targetLaneRow == null
    ? [state.laneRow]
    : Array.from(new Set([state.laneRow, state.targetLaneRow]));
}

function desiredCarSpeed(thing: RuntimeThing, lanes: LaneDefinition[]) {
  const lane = lanes[thing.homeRow ?? thing.lane.row] ?? thing.lane;
  return lane.speed * (thing.speedMultiplier ?? 1);
}

function makeTrafficSignature(lanes: LaneDefinition[], board: BoardConfig) {
  return [
    board.cols,
    board.rows,
    lanes
      .map(
        (lane) =>
          `${lane.row}:${lane.kind}:${lane.direction}:${lane.speed.toFixed(3)}:${(lane.things ?? [])
            .map(
              (thing) =>
                `${thing.id}:${thing.start.toFixed(3)}:${thing.length.toFixed(3)}:${thing.driver ?? ""}:${(
                  thing.speedMultiplier ?? 1
                ).toFixed(3)}`,
            )
            .join(",")}`,
      )
      .join("|"),
  ].join(";");
}

let hardModeTrafficCache: TrafficSimulationCache | null = null;

function makeInitialTrafficCarState(thing: RuntimeThing, lanes: LaneDefinition[]): TrafficCarState {
  return {
    id: thing.id,
    laneRow: thing.homeRow ?? thing.lane.row,
    targetLaneRow: null,
    laneChangeFromRow: null,
    laneChangeStartedAt: 0,
    laneChangeEndsAt: 0,
    x: thing.x,
    speed: desiredCarSpeed(thing, lanes),
  };
}

function syncTrafficCache(
  carThings: RuntimeThing[],
  lanes: LaneDefinition[],
  seconds: number,
  board: BoardConfig,
) {
  const signature = makeTrafficSignature(lanes, board);
  if (!hardModeTrafficCache || hardModeTrafficCache.signature !== signature || seconds < hardModeTrafficCache.seconds) {
    hardModeTrafficCache = {
      signature,
      seconds,
      cars: carThings.reduce((acc, thing) => {
        acc[thing.id] = makeInitialTrafficCarState(thing, lanes);
        return acc;
      }, {} as Record<string, TrafficCarState>),
    };
    return hardModeTrafficCache;
  }

  const validIds = new Set(carThings.map((thing) => thing.id));
  Object.keys(hardModeTrafficCache.cars).forEach((id) => {
    if (!validIds.has(id)) delete hardModeTrafficCache?.cars[id];
  });
  carThings.forEach((thing) => {
    if (!hardModeTrafficCache?.cars[thing.id]) {
      hardModeTrafficCache!.cars[thing.id] = makeInitialTrafficCarState(thing, lanes);
    }
  });

  return hardModeTrafficCache;
}

function findFrontCar(
  row: number,
  state: TrafficCarState,
  thing: RuntimeThing,
  states: TrafficCarState[],
  thingsById: Map<string, RuntimeThing>,
  direction: 1 | -1,
) {
  let front:
    | {
        state: TrafficCarState;
        thing: RuntimeThing;
        gap: number;
      }
    | null = null;

  states.forEach((otherState) => {
    if (otherState.id === state.id || !carStateOccupiedRows(otherState).includes(row)) return;
    const otherThing = thingsById.get(otherState.id);
    if (!otherThing) return;

    const gap =
      direction === 1
        ? otherState.x - (state.x + thing.length)
        : state.x - (otherState.x + otherThing.length);
    if (gap < -TRAFFIC_GAP) return;
    if (!front || gap < front.gap) {
      front = { state: otherState, thing: otherThing, gap };
    }
  });

  return front;
}

function laneHasSwitchGap(
  targetRow: number,
  state: TrafficCarState,
  thing: RuntimeThing,
  states: TrafficCarState[],
  thingsById: Map<string, RuntimeThing>,
) {
  return !states.some((otherState) => {
    if (otherState.id === state.id || !carStateOccupiedRows(otherState).includes(targetRow)) return false;
    const otherThing = thingsById.get(otherState.id);
    if (!otherThing) return false;
    return intervalsOverlap(
      state.x,
      state.x + thing.length,
      otherState.x,
      otherState.x + otherThing.length,
      TRAFFIC_GAP + 0.18,
    );
  });
}

function pickPassingLane(
  lanes: LaneDefinition[],
  currentRow: number,
  state: TrafficCarState,
  thing: RuntimeThing,
  states: TrafficCarState[],
  thingsById: Map<string, RuntimeThing>,
) {
  const currentLane = lanes[currentRow] ?? lanes[thing.homeRow ?? thing.lane.row] ?? thing.lane;
  return adjacentPassingLanes(lanes, currentLane).find(
    (candidate) =>
      candidate.direction === currentLane.direction &&
      laneHasSwitchGap(candidate.row, state, thing, states, thingsById),
  );
}

function keepLoopEntryClear(
  state: TrafficCarState,
  thing: RuntimeThing,
  lane: LaneDefinition,
  states: TrafficCarState[],
  thingsById: Map<string, RuntimeThing>,
  board: BoardConfig,
) {
  const rows = carStateOccupiedRows(state);
  let attempts = states.length;
  while (attempts > 0) {
    const blocker = states.find((otherState) => {
      if (otherState.id === state.id) return false;
      const otherThing = thingsById.get(otherState.id);
      if (!otherThing) return false;
      const sharesRow = carStateOccupiedRows(otherState).some((row) => rows.includes(row));
      return (
        sharesRow &&
        intervalsOverlap(state.x, state.x + thing.length, otherState.x, otherState.x + otherThing.length, TRAFFIC_GAP)
      );
    });
    if (!blocker) return;

    const blockerThing = thingsById.get(blocker.id);
    if (!blockerThing) return;
    state.x =
      lane.direction === 1
        ? blocker.x - thing.length - TRAFFIC_GAP
        : blocker.x + blockerThing.length + TRAFFIC_GAP;
    attempts -= 1;
  }

  state.x = lane.direction === 1 ? -thing.length - board.cols * 0.25 : board.cols + board.cols * 0.25;
}

function wrapTrafficCarState(
  state: TrafficCarState,
  thing: RuntimeThing,
  lane: LaneDefinition,
  states: TrafficCarState[],
  thingsById: Map<string, RuntimeThing>,
  board: BoardConfig,
) {
  const rightEdge = board.cols + MOVING_OFFSCREEN_BUFFER;
  const leftEdge = -thing.length - MOVING_OFFSCREEN_BUFFER;
  const wrapped =
    lane.direction === 1
      ? state.x > rightEdge
      : state.x + thing.length < -MOVING_OFFSCREEN_BUFFER;

  if (!wrapped) return;

  if (state.targetLaneRow != null) {
    state.laneRow = state.targetLaneRow;
    state.targetLaneRow = null;
    state.laneChangeFromRow = null;
  }

  state.x = lane.direction === 1 ? leftEdge : rightEdge;
  keepLoopEntryClear(state, thing, lane, states, thingsById, board);
}

function stepTrafficSimulation(
  cache: TrafficSimulationCache,
  carThings: RuntimeThing[],
  lanes: LaneDefinition[],
  board: BoardConfig,
  seconds: number,
  dt: number,
) {
  const thingsById = new Map(carThings.map((thing) => [thing.id, thing]));
  const states = Object.values(cache.cars);

  states.forEach((state) => {
    if (state.targetLaneRow != null && seconds >= state.laneChangeEndsAt) {
      state.laneRow = state.targetLaneRow;
      state.targetLaneRow = null;
      state.laneChangeFromRow = null;
    }
  });

  const orderedStates = [...states].sort((a, b) => {
    const thingA = thingsById.get(a.id);
    const thingB = thingsById.get(b.id);
    const laneA = thingA ? lanes[thingA.homeRow ?? thingA.lane.row] ?? thingA.lane : null;
    const laneB = thingB ? lanes[thingB.homeRow ?? thingB.lane.row] ?? thingB.lane : null;
    const rowDelta = (a.targetLaneRow ?? a.laneRow) - (b.targetLaneRow ?? b.laneRow);
    if (rowDelta !== 0) return rowDelta;
    const direction = laneA?.direction ?? laneB?.direction ?? 1;
    return direction === 1 ? b.x - a.x : a.x - b.x;
  });

  orderedStates.forEach((state) => {
    const thing = thingsById.get(state.id);
    if (!thing) return;
    const homeLane = lanes[thing.homeRow ?? thing.lane.row] ?? thing.lane;
    const currentRow = state.targetLaneRow ?? state.laneRow;
    const desiredSpeed = desiredCarSpeed(thing, lanes);
    const front = findFrontCar(currentRow, state, thing, states, thingsById, homeLane.direction);
    const lookAhead = Math.max(TRAFFIC_GAP + 0.65, desiredSpeed * TRAFFIC_LOOK_AHEAD_SECONDS);
    const closeToFront = Boolean(front && front.gap < TRAFFIC_GAP + 0.12);
    const catchingFront = Boolean(front && desiredSpeed > front.state.speed + 0.02 && front.gap < lookAhead);
    let speed = desiredSpeed;

    if ((closeToFront || catchingFront) && state.targetLaneRow == null) {
      const passLane = pickPassingLane(lanes, currentRow, state, thing, states, thingsById);
      if (passLane) {
        state.laneChangeFromRow = state.laneRow;
        state.targetLaneRow = passLane.row;
        state.laneChangeStartedAt = seconds;
        state.laneChangeEndsAt = seconds + LANE_CHANGE_SECONDS;
      }
    }

    if (front && (closeToFront || catchingFront || state.targetLaneRow != null)) {
      speed = Math.min(speed, front.state.speed);
    }

    let nextX = state.x + homeLane.direction * speed * dt;
    if (front && front.gap < TRAFFIC_GAP + speed * dt + 0.05) {
      const limit =
        homeLane.direction === 1
          ? front.state.x - thing.length - TRAFFIC_GAP
          : front.state.x + front.thing.length + TRAFFIC_GAP;
      nextX = homeLane.direction === 1 ? Math.min(nextX, limit) : Math.max(nextX, limit);
    }

    state.x = nextX;
    state.speed = speed;
    wrapTrafficCarState(state, thing, homeLane, states, thingsById, board);
  });
}

function runtimeThingFromTrafficState(
  thing: RuntimeThing,
  state: TrafficCarState,
  lanes: LaneDefinition[],
  seconds: number,
) {
  const visualLane = lanes[state.targetLaneRow ?? state.laneRow] ?? thing.lane;
  const laneProgress =
    state.targetLaneRow == null
      ? undefined
      : clamp(
          (seconds - state.laneChangeStartedAt) /
            Math.max(0.001, state.laneChangeEndsAt - state.laneChangeStartedAt),
          0,
          1,
        );

  return {
    ...thing,
    lane: visualLane,
    x: state.x,
    speedMultiplier: visualLane.speed > 0 ? state.speed / visualLane.speed : thing.speedMultiplier,
    laneChangeFromRow: state.targetLaneRow == null ? undefined : state.laneChangeFromRow ?? state.laneRow,
    laneChangeProgress: laneProgress,
    occupiedRows: carStateOccupiedRows(state),
  };
}

function resolveHardModeCars(
  runtimeThings: RuntimeThing[],
  lanes: LaneDefinition[],
  seconds: number,
  board: BoardConfig,
) {
  const carThings = runtimeThings.filter((thing) => thing.asset === "car");
  if (carThings.length === 0) return runtimeThings;

  const cache = syncTrafficCache(carThings, lanes, seconds, board);
  const elapsed = clamp(seconds - cache.seconds, 0, 0.5);
  let remaining = elapsed;
  let simulatedSeconds = cache.seconds;
  while (remaining > 0.0001) {
    const step = Math.min(TRAFFIC_SIMULATION_STEP, remaining);
    simulatedSeconds += step;
    stepTrafficSimulation(cache, carThings, lanes, board, simulatedSeconds, step);
    remaining -= step;
  }
  cache.seconds = seconds;

  const resolvedCars = new Map(
    carThings.map((thing) => [thing.id, runtimeThingFromTrafficState(thing, cache.cars[thing.id], lanes, seconds)]),
  );

  return runtimeThings.map((thing) => (thing.asset === "car" ? resolvedCars.get(thing.id) ?? thing : thing));
}

function resolveHardModeTraffic(
  runtimeThings: RuntimeThing[],
  lanes: LaneDefinition[],
  seconds: number,
  board: BoardConfig,
) {
  return resolveHardModeCars(runtimeThings, lanes, seconds, board);
}

function getRuntimeThingsForLanes(lanes: LaneDefinition[], seconds: number, board: BoardConfig): RuntimeThing[] {
  const runtimeThings = lanes.flatMap((lane) =>
    (lane.things ?? []).map((thing) => {
      const length = getThingLength(thing, lane, seconds);
      return {
        ...thing,
        length,
        homeRow: lane.row,
        lane,
        x: getMovingX(thing, lane, seconds, board, length),
      };
    }),
  );

  return lanes.some((lane) => lane.hardMode) ? resolveHardModeTraffic(runtimeThings, lanes, seconds, board) : runtimeThings;
}

function getMovingThingsForLane(
  lane: LaneDefinition,
  seconds: number,
  board: BoardConfig,
  lanes?: LaneDefinition[],
): RuntimeThing[] {
  if (lanes) {
    return getRuntimeThingsForLanes(lanes, seconds, board).filter((thing) => runtimeThingOccupiesRow(thing, lane.row));
  }
  if (!lane.things) return [];
  return lane.things.map((thing) => {
    const length = getThingLength(thing, lane, seconds);
    return {
      ...thing,
      length,
      homeRow: lane.row,
      lane,
      x: getMovingX(thing, lane, seconds, board, length),
    };
  });
}

function overlapsThing(playerCol: number, thing: RuntimeThing, margin = 0.18) {
  const playerCenter = playerCol + 0.5;
  return playerCenter >= thing.x - margin && playerCenter <= thing.x + thing.length + margin;
}

function isOnLog(playerCol: number, thing: RuntimeThing) {
  const playerCenter = playerCol + 0.5;
  return logSlotCenters(thing).some((slotCenter) => Math.abs(playerCenter - slotCenter) <= 0.5);
}

function logSlotCount(log: RuntimeThing) {
  return Math.max(1, Math.round(log.length));
}

function logSlotCenters(log: RuntimeThing) {
  return Array.from({ length: logSlotCount(log) }, (_, index) => log.x + index + 0.5);
}

function logSlotColFromCenter(slotCenter: number) {
  return slotCenter - 0.5;
}

function isPlayableLogSlot(slotCol: number, board: BoardConfig) {
  return slotCol >= -0.45 && slotCol <= board.cols - 0.55;
}

function isBetween(value: number, a: number, b: number) {
  return value >= Math.min(a, b) - 0.001 && value <= Math.max(a, b) + 0.001;
}

function findLogHopLandingCol(
  lane: LaneDefinition,
  requestedCol: number,
  seconds: number,
  board: BoardConfig,
  lanes: LaneDefinition[],
) {
  const col = clamp(Math.round(requestedCol), 0, board.cols - 1);
  const targetCenter = col + 0.5;
  const logs = getMovingThingsForLane(lane, seconds, board, lanes).filter((thing) => thing.asset === "log");

  const candidates = logs.flatMap((log) => {
    const centers = logSlotCenters(log);
    const frontIndex = lane.direction === 1 ? centers.length - 1 : 0;
    const frontCenter = centers[frontIndex];
    const frontSlotCol = logSlotColFromCenter(frontCenter);
    const landingCandidates: Array<{ col: number; distance: number; priority: number }> = [];

    if (isPlayableLogSlot(frontSlotCol, board) && isBetween(targetCenter, frontCenter, frontCenter + lane.direction)) {
      landingCandidates.push({ col: frontSlotCol, distance: 0, priority: 0 });
    }

    centers.forEach((slotCenter) => {
      const slotCol = logSlotColFromCenter(slotCenter);
      const distance = Math.abs(targetCenter - slotCenter);
      if (isPlayableLogSlot(slotCol, board) && distance <= 0.5 + 0.001) {
        landingCandidates.push({ col: slotCol, distance, priority: 1 });
      }
    });

    return landingCandidates;
  });

  const best = candidates.sort((a, b) => a.priority - b.priority || a.distance - b.distance)[0];
  return best ? best.col : col;
}

function findLogExitCol(playerCol: number, board: BoardConfig) {
  const playerCenter = playerCol + 0.5;
  const candidates = Array.from(new Set([Math.floor(playerCol), Math.ceil(playerCol)]))
    .filter((col) => col >= 0 && col < board.cols)
    .map((col) => ({
      col,
      distance: Math.abs(playerCenter - (col + 0.5)),
    }));
  return candidates.sort((a, b) => a.distance - b.distance || a.col - b.col)[0]?.col ?? clamp(Math.round(playerCol), 0, board.cols - 1);
}

function getCellOccupant(players: PlayerState[], playerId: PlayerId, row: number, col: number) {
  return players.find(
    (player) =>
      player.joined &&
      player.id !== playerId &&
      Math.round(player.row) === row &&
      Math.round(player.col) === col,
  );
}

function activePlayers(players: PlayerState[]) {
  return players.filter((player) => player.joined);
}

function nextJoinedPlayerId(players: PlayerState[], currentId: PlayerId | null, includeCurrent = false) {
  const joinedIds = PLAYER_IDS.filter((id) => players.some((player) => player.id === id && player.joined));
  if (joinedIds.length === 0) return null;
  if (!currentId) return joinedIds[0];

  const currentIndex = joinedIds.indexOf(currentId);
  if (currentIndex < 0) return joinedIds[0];
  if (includeCurrent) return joinedIds[currentIndex];
  return joinedIds[(currentIndex + 1) % joinedIds.length];
}

function mobileTurnPlayers(players: PlayerState[], activePlayerId: PlayerId | null) {
  if (!activePlayerId) return players.map((player) => ({ ...player, joined: false }));
  return players.map((player) => (player.id === activePlayerId ? player : { ...player, joined: false }));
}

function mergeMobileTurnPlayers(players: PlayerState[], simulatedPlayers: PlayerState[], activePlayerId: PlayerId | null) {
  if (!activePlayerId) return players;
  const activePlayer = simulatedPlayers.find((player) => player.id === activePlayerId);
  if (!activePlayer) return players;
  return players.map((player) => (player.id === activePlayerId ? activePlayer : player));
}

function resetPlayerForJoin(player: PlayerState, board: BoardConfig, players: PlayerState[]) {
  return {
    ...player,
    name: DEFAULT_PLAYER_NAMES[player.id],
    profileName: null,
    joined: true,
    row: board.playerStartRow,
    col: findOpenStartCol(player.id, players, board),
    score: 0,
    leaderboardScoreCheckpoint: 0,
    laps: 0,
    crowns: 0,
    misses: 0,
    bestProgress: 0,
    stunnedUntil: 0,
    facing: "up" as Direction,
    activePowerUp: null,
    invincibleUntil: 0,
    lastMoveAt: -Infinity,
    jump: null,
    lightning: null,
    deathAnimation: null,
    celebrateUntil: 0,
  };
}

function findOpenStartCol(playerId: PlayerId, players: PlayerState[], board: BoardConfig) {
  const startCol = board.startCols[playerId];
  const offsets = Array.from({ length: board.cols }, (_, index) =>
    index === 0 ? 0 : index % 2 === 0 ? index / 2 : -(index + 1) / 2,
  );
  const openOffset = offsets.find((offset) => {
    const col = startCol + offset;
    return col >= 0 && col < board.cols && !getCellOccupant(players, playerId, board.playerStartRow, col);
  });

  return clamp(startCol + (openOffset ?? 0), 0, board.cols - 1);
}

function copyPlayers(players: PlayerState[]) {
  return players.map((player) => ({ ...player }));
}

function makeInitialPlayers(board: BoardConfig, playerNames: PlayerNames): PlayerState[] {
  return PLAYER_IDS.map((id) => ({
    id,
    ...PLAYER_META[id],
    name: playerNames[id] || PLAYER_META[id].name,
    profileName: null,
    joined: true,
    row: board.playerStartRow,
    col: board.startCols[id],
    score: 0,
    leaderboardScoreCheckpoint: 0,
    laps: 0,
    crowns: 0,
    misses: 0,
    bestProgress: 0,
    stunnedUntil: 0,
    facing: "up",
    activePowerUp: null,
    invincibleUntil: 0,
    lastMoveAt: -Infinity,
    jump: null,
    lightning: null,
    deathAnimation: null,
    celebrateUntil: 0,
  }));
}

function clearExpiredPlayerEffects(player: PlayerState, timestamp: number) {
  return {
    ...player,
    activePowerUp:
      player.activePowerUp && timestamp <= player.activePowerUp.expiresAt
        ? player.activePowerUp
        : null,
    jump: player.jump && timestamp <= player.jump.endsAt ? player.jump : null,
    lightning: player.lightning && timestamp <= player.lightning.endsAt ? player.lightning : null,
    deathAnimation:
      player.deathAnimation && timestamp <= player.deathAnimation.endsAt
        ? player.deathAnimation
        : null,
  };
}

function restartPlayer(
  player: PlayerState,
  timestamp: number,
  messages: string[],
  text: string,
  players: PlayerState[],
  board: BoardConfig,
  deathType: DeathAnimation["type"] = "flat",
) {
  messages.push(text);
  const deathDuration = deathType === "splash" ? SPLASH_DEATH_MS : FLAT_DEATH_MS;
  return {
    ...player,
    row: board.playerStartRow,
    col: findOpenStartCol(player.id, players, board),
    misses: player.misses + 1,
    score: player.score - 15,
    stunnedUntil: timestamp + deathDuration,
    facing: "up" as Direction,
    jump: null,
    lightning: null,
    deathAnimation: {
      type: deathType,
      col: player.col,
      row: player.row,
      startedAt: timestamp,
      endsAt: timestamp + deathDuration,
    },
  };
}

function resolvePlayers(
  players: PlayerState[],
  lanes: LaneDefinition[],
  board: BoardConfig,
  seconds: number,
  timestamp: number,
  dt: number,
  messages: string[],
  crownAvailable: boolean,
) {
  let crownCollected = false;
  const nextPlayers = players.map((rawPlayer) => {
    if (!rawPlayer.joined) return rawPlayer;

    const player = clearExpiredPlayerEffects(rawPlayer, timestamp);
    if (player.jump || timestamp < player.stunnedUntil) return player;

    const row = Math.round(player.row);
    const col = Math.round(player.col);

    if (crownAvailable && !crownCollected && isCrownCell(row, col, board)) {
      crownCollected = true;
      messages.push(`${player.name} claimed the crown for ${CROWN_POINTS}.`);
      return {
        ...player,
        row: board.playerStartRow,
        col: findOpenStartCol(player.id, players, board),
        score: player.score + CROWN_POINTS,
        crowns: player.crowns + 1,
        bestProgress: 0,
        stunnedUntil: timestamp + 650,
        facing: "up" as Direction,
        jump: null,
        lightning: null,
        deathAnimation: null,
        celebrateUntil: timestamp + FLAG_CELEBRATION_MS,
      };
    }

    const lane = getLane(lanes, row);

    if (lane.kind === "goal") {
      messages.push(`${player.name} crossed the finish.`);
      return {
        ...player,
        row: board.playerStartRow,
        col: findOpenStartCol(player.id, players, board),
        score: player.score + 75,
        laps: player.laps + 1,
        bestProgress: 0,
        stunnedUntil: timestamp + 650,
        facing: "up" as Direction,
        deathAnimation: null,
        celebrateUntil: timestamp + FLAG_CELEBRATION_MS,
      };
    }

    if (lane.kind === "river") {
      const log = getMovingThingsForLane(lane, seconds, board, lanes).find((thing) => isOnLog(player.col, thing));
      if (!log) {
        return restartPlayer(player, timestamp, messages, `${player.name} fell in the river.`, players, board, "splash");
      }

      const carriedCol = player.col + lane.direction * lane.speed * (log.speedMultiplier ?? 1) * dt;
      if (carriedCol < -0.45 || carriedCol > board.cols - 0.55) {
        return restartPlayer(player, timestamp, messages, `${player.name} rode a log off the edge.`, players, board, "splash");
      }

      const carriedCell = clamp(Math.round(carriedCol), 0, board.cols - 1);
      if (getCellOccupant(players, player.id, Math.round(player.row), carriedCell)) {
        return player;
      }

      return {
        ...player,
        col: carriedCol,
      };
    }

    if (lane.kind === "road" || lane.kind === "rail") {
      if (timestamp < player.invincibleUntil) return player;

      const hazard = getMovingThingsForLane(lane, seconds, board, lanes).find((thing) => overlapsThing(player.col, thing));
      if (hazard) {
        if (player.activePowerUp?.type === "life") {
          const expiresAt = player.activePowerUp.expiresAt - 5000;
          messages.push(`${player.name}'s shield blocked the hit.`);
          return {
            ...player,
            activePowerUp:
              expiresAt > timestamp
                ? {
                    ...player.activePowerUp,
                    expiresAt,
                  }
                : null,
            invincibleUntil: timestamp + 2000,
          };
        }

        const message =
          lane.kind === "rail"
            ? `${player.name} got clipped by the train.`
            : `${player.name} got squished by traffic.`;
        return restartPlayer(player, timestamp, messages, message, players, board);
      }
    }

    return player;
  });

  return { players: nextPlayers, crownCollected };
}

function isPickupCellOpen(
  row: number,
  col: number,
  board: BoardConfig,
  players: PlayerState[],
  powerUps: PowerUpInstance[],
  lanes?: LaneDefinition[],
) {
  if (row < 0 || row >= board.rows || col < 0 || col >= board.cols) return false;
  if (lanes && hasForestBlocker(row, col, lanes, board)) return false;
  const occupiedByPlayer = players.some(
    (player) => player.joined && Math.round(player.row) === row && Math.round(player.col) === col,
  );
  const occupiedByPowerUp = powerUps.some((powerUp) => powerUp.row === row && powerUp.col === col);
  return !occupiedByPlayer && !occupiedByPowerUp;
}

function findSpawnCell(
  lanes: LaneDefinition[],
  board: BoardConfig,
  players: PlayerState[],
  powerUps: PowerUpInstance[],
  random: () => number,
) {
  const safeRows = lanes
    .filter((lane) => lane.kind === "grass" && lane.row !== board.startRow)
    .map((lane) => lane.row);
  if (safeRows.length === 0) return null;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const row = safeRows[Math.floor(random() * safeRows.length)];
    const col = Math.floor(random() * board.cols);
    if (isPickupCellOpen(row, col, board, players, powerUps, lanes)) return { row, col };
  }

  return null;
}

function getAdjacentGrassRows(lanes: LaneDefinition[], row: number) {
  return [row - 1, row + 1].filter(
    (candidateRow) =>
      candidateRow >= 0 && candidateRow < lanes.length && getLane(lanes, candidateRow).kind === "grass",
  );
}

function findBreadSpawnCell(
  lanes: LaneDefinition[],
  board: BoardConfig,
  players: PlayerState[],
  powerUps: PowerUpInstance[],
  seconds: number,
  random: () => number,
) {
  const roadLanes = lanes.filter(
    (lane) =>
      lane.kind === "road" &&
      lane.things?.some((thing) => thing.asset === "car") &&
      getAdjacentGrassRows(lanes, lane.row).length > 0,
  );
  if (roadLanes.length === 0) return null;

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const lane = roadLanes[Math.floor(random() * roadLanes.length)];
    const visibleCars = getMovingThingsForLane(lane, seconds, board, lanes).filter((thing) => {
      const center = thing.x + thing.length / 2;
      return thing.asset === "car" && center >= 0 && center < board.cols;
    });
    if (visibleCars.length === 0) continue;

    const car = visibleCars[Math.floor(random() * visibleCars.length)];
    const col = clamp(Math.floor(car.x + car.length / 2), 0, board.cols - 1);
    const grassRows = getAdjacentGrassRows(lanes, lane.row).sort(() => random() - 0.5);
    const row = grassRows.find((grassRow) => isPickupCellOpen(grassRow, col, board, players, powerUps, lanes));
    if (row == null) continue;

    return {
      row,
      col,
      entryOrigin: {
        x: worldXFromThing(car, board),
        y: 0.76,
        z: worldZFromCenter(lane.row, board),
      },
    };
  }

  return null;
}

function spawnPowerUps(
  current: PowerUpInstance[],
  players: PlayerState[],
  lanes: LaneDefinition[],
  board: BoardConfig,
  settings: GameSettings,
  seconds: number,
  nextSpawnRef: MutableRefObject<number>,
  randomRef: MutableRefObject<() => number>,
) {
  const random = randomRef.current;
  let next = current.filter((powerUp) => seconds <= powerUp.expiresAt + PICKUP_EXIT_SECONDS);
  let changed = next.length !== current.length;

  if (seconds < nextSpawnRef.current) return { powerUps: next, changed };

  nextSpawnRef.current = seconds + randomPowerUpSeconds(random);

  const activeCount = next.filter((powerUp) => seconds <= powerUp.expiresAt).length;
  if (activeCount >= MAX_POWER_UPS_ON_BOARD) return { powerUps: next, changed };

  const item = pickSpawnItem(settings, random);

  const cell =
    item.kind === "score" && item.type === "bread"
      ? findBreadSpawnCell(lanes, board, players, next, seconds, random)
      : findSpawnCell(lanes, board, players, next, random);
  if (!cell) return { powerUps: next, changed };

  next = [
    ...next,
    {
      id: makeId(item.type),
      ...item,
      ...cell,
      spawnedAt: seconds,
      expiresAt: seconds + randomPowerUpSeconds(random),
    },
  ];
  changed = true;

  return { powerUps: next, changed };
}

function collectPowerUps(
  players: PlayerState[],
  powerUps: PowerUpInstance[],
  seconds: number,
  timestamp: number,
  messages: string[],
) {
  if (powerUps.length === 0) return { players, powerUps, changed: false };

  let changed = false;
  const collectedIds = new Set<string>();
  const nextPlayers = players.map((player) => {
    if (!player.joined) return player;

    const collected = powerUps.find(
      (powerUp) =>
        powerUp.row === Math.round(player.row) &&
        powerUp.col === Math.round(player.col) &&
        seconds <= powerUp.expiresAt &&
        !collectedIds.has(powerUp.id),
    );

    if (!collected) return player;
    collectedIds.add(collected.id);
    changed = true;

    if (collected.kind === "score") {
      const points = scoreItemValue(collected.type, player.id);
      messages.push(`${player.name} picked up ${SCORE_ITEM_DEFS[collected.type].label} for ${points}.`);
      return {
        ...player,
        score: player.score + points,
      };
    }

    messages.push(`${player.name} picked up ${POWER_UP_DEFS[collected.type].label}.`);

    return {
      ...player,
      activePowerUp: {
        type: collected.type,
        expiresAt: timestamp + POWER_UP_DEFS[collected.type].durationMs,
      },
    };
  });

  if (!changed) return { players, powerUps, changed: false };
  return {
    players: nextPlayers,
    powerUps: powerUps.filter((powerUp) => !collectedIds.has(powerUp.id)),
    changed: true,
  };
}

function pathHasHazard(
  fromRow: number,
  toRow: number,
  col: number,
  lanes: LaneDefinition[],
  board: BoardConfig,
  seconds: number,
) {
  const min = Math.min(fromRow, toRow);
  const max = Math.max(fromRow, toRow);
  for (let row = min; row <= max; row += 1) {
    if (row === fromRow) continue;
    const lane = getLane(lanes, row);
    if (lane.kind !== "road" && lane.kind !== "rail") continue;
    const hazard = getMovingThingsForLane(lane, seconds, board, lanes).find((thing) => overlapsThing(col, thing, 0.1));
    if (hazard) return true;
  }
  return false;
}

function findLightningLandingRow(
  startRow: number,
  rowDelta: number,
  lanes: LaneDefinition[],
  board: BoardConfig,
) {
  if (rowDelta === 0) return null;
  let row = startRow + rowDelta;
  while (row >= 0 && row <= board.startRow) {
    if (isSafeLane(getLane(lanes, row))) return row;
    row += rowDelta;
  }
  return null;
}

function Block({
  color,
  size,
  position = [0, 0, 0],
  roughness = 0.82,
  metalness = 0,
  clippingPlanes,
  transparent = false,
  opacity = 1,
  emissive,
  emissiveIntensity = 0,
}: BlockProps) {
  return (
    <mesh position={position} castShadow={false} receiveShadow={false}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        clippingPlanes={clippingPlanes}
        transparent={transparent}
        opacity={opacity}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  );
}

function DuckAsset() {
  return (
    <group>
      <Block color="#f4c63d" size={[0.52, 0.42, 0.58]} position={[0, 0.34, 0.02]} />
      <Block color="#f8d75a" size={[0.38, 0.36, 0.38]} position={[0, 0.68, -0.28]} />
      <Block color="#f1892d" size={[0.3, 0.12, 0.2]} position={[0, 0.65, -0.58]} />
      <Block color="#d7a817" size={[0.12, 0.28, 0.36]} position={[-0.34, 0.34, 0.04]} />
      <Block color="#d7a817" size={[0.12, 0.28, 0.36]} position={[0.34, 0.34, 0.04]} />
      <Block color="#101318" size={[0.06, 0.07, 0.04]} position={[-0.09, 0.73, -0.49]} />
      <Block color="#101318" size={[0.06, 0.07, 0.04]} position={[0.09, 0.73, -0.49]} />
      <Block color="#ef7d25" size={[0.12, 0.08, 0.32]} position={[-0.15, 0.08, -0.12]} />
      <Block color="#ef7d25" size={[0.12, 0.08, 0.32]} position={[0.15, 0.08, -0.12]} />
    </group>
  );
}

function ChickenAsset() {
  return (
    <group>
      <Block color="#fff5df" size={[0.54, 0.46, 0.58]} position={[0, 0.36, 0.02]} />
      <Block color="#fffaf0" size={[0.38, 0.36, 0.38]} position={[0, 0.72, -0.28]} />
      <Block color="#ef3d37" size={[0.12, 0.18, 0.12]} position={[-0.13, 0.98, -0.3]} />
      <Block color="#ef3d37" size={[0.12, 0.24, 0.12]} position={[0, 1.02, -0.3]} />
      <Block color="#ef3d37" size={[0.12, 0.18, 0.12]} position={[0.13, 0.98, -0.3]} />
      <Block color="#ef7d25" size={[0.22, 0.12, 0.18]} position={[0, 0.69, -0.58]} />
      <Block color="#f0e2c7" size={[0.12, 0.26, 0.32]} position={[-0.35, 0.35, 0.04]} />
      <Block color="#f0e2c7" size={[0.12, 0.26, 0.32]} position={[0.35, 0.35, 0.04]} />
      <Block color="#101318" size={[0.06, 0.07, 0.04]} position={[-0.09, 0.77, -0.49]} />
      <Block color="#101318" size={[0.06, 0.07, 0.04]} position={[0.09, 0.77, -0.49]} />
      <Block color="#ef7d25" size={[0.1, 0.08, 0.32]} position={[-0.14, 0.08, -0.1]} />
      <Block color="#ef7d25" size={[0.1, 0.08, 0.32]} position={[0.14, 0.08, -0.1]} />
    </group>
  );
}

function FrogAsset() {
  return (
    <group>
      <Block color="#42b85c" size={[0.56, 0.34, 0.56]} position={[0, 0.28, 0.03]} />
      <Block color="#58d56f" size={[0.44, 0.28, 0.42]} position={[0, 0.55, -0.22]} />
      <Block color="#f3fff0" size={[0.14, 0.12, 0.1]} position={[-0.16, 0.7, -0.42]} />
      <Block color="#f3fff0" size={[0.14, 0.12, 0.1]} position={[0.16, 0.7, -0.42]} />
      <Block color="#111827" size={[0.06, 0.07, 0.04]} position={[-0.16, 0.72, -0.48]} />
      <Block color="#111827" size={[0.06, 0.07, 0.04]} position={[0.16, 0.72, -0.48]} />
      <Block color="#f27aa0" size={[0.22, 0.04, 0.05]} position={[0, 0.52, -0.45]} />
      <Block color="#2f8e45" size={[0.16, 0.12, 0.36]} position={[-0.34, 0.16, 0.03]} />
      <Block color="#2f8e45" size={[0.16, 0.12, 0.36]} position={[0.34, 0.16, 0.03]} />
      <Block color="#2f8e45" size={[0.26, 0.08, 0.2]} position={[-0.24, 0.08, -0.18]} />
      <Block color="#2f8e45" size={[0.26, 0.08, 0.2]} position={[0.24, 0.08, -0.18]} />
    </group>
  );
}

function RabbitAsset() {
  return (
    <group>
      <Block color="#8a5a35" size={[0.52, 0.42, 0.54]} position={[0, 0.34, 0.02]} />
      <Block color="#9b6a43" size={[0.36, 0.34, 0.34]} position={[0, 0.72, -0.26]} />
      <Block color="#9b6a43" size={[0.12, 0.42, 0.12]} position={[-0.12, 1.05, -0.25]} />
      <Block color="#9b6a43" size={[0.12, 0.42, 0.12]} position={[0.12, 1.05, -0.25]} />
      <Block color="#f5d7c4" size={[0.06, 0.3, 0.05]} position={[-0.12, 1.06, -0.31]} />
      <Block color="#f5d7c4" size={[0.06, 0.3, 0.05]} position={[0.12, 1.06, -0.31]} />
      <Block color="#111827" size={[0.06, 0.07, 0.04]} position={[-0.09, 0.78, -0.47]} />
      <Block color="#111827" size={[0.06, 0.07, 0.04]} position={[0.09, 0.78, -0.47]} />
      <Block color="#f3f4f6" size={[0.16, 0.16, 0.16]} position={[0, 0.36, 0.36]} />
      <Block color="#6f4326" size={[0.12, 0.08, 0.3]} position={[-0.16, 0.08, -0.1]} />
      <Block color="#6f4326" size={[0.12, 0.08, 0.3]} position={[0.16, 0.08, -0.1]} />
    </group>
  );
}

function getPowerGlowColor(player: PlayerState, timestamp: number) {
  if (timestamp < player.invincibleUntil) return "#9ddcff";
  if (!player.activePowerUp) return null;
  return POWER_UP_DEFS[player.activePowerUp.type].color;
}

function getAnimatedPosition(player: PlayerState, timestamp: number, board: BoardConfig) {
  const animation = player.jump ?? player.lightning;
  if (!animation) {
    return {
      x: worldXFromCenter(player.col, board),
      y: 0.02,
      z: worldZFromCenter(player.row, board),
    };
  }

  const duration = Math.max(1, animation.endsAt - animation.startedAt);
  const rawT = clamp((timestamp - animation.startedAt) / duration, 0, 1);
  const t = player.lightning ? (rawT > 0.18 ? 1 : rawT / 0.18) : rawT;
  const x = THREE.MathUtils.lerp(
    worldXFromCenter(animation.fromCol, board),
    worldXFromCenter(animation.toCol, board),
    t,
  );
  const z = THREE.MathUtils.lerp(
    worldZFromCenter(animation.fromRow, board),
    worldZFromCenter(animation.toRow, board),
    t,
  );
  const arc = player.jump ? Math.sin(t * Math.PI) * 1.25 : 0;
  return { x, y: 0.02 + arc, z };
}

function PlayerModels({
  playersRef,
  boardRef,
  mobileTurnPlayerIdRef,
}: {
  playersRef: MutableRefObject<PlayerState[]>;
  boardRef: MutableRefObject<BoardConfig>;
  mobileTurnPlayerIdRef?: MutableRefObject<PlayerId | null>;
}) {
  const refs = useRef<Record<PlayerId, THREE.Group | null>>({
    duck: null,
    frog: null,
    chicken: null,
    rabbit: null,
  });
  const glowRefs = useRef<Record<PlayerId, THREE.Mesh | null>>({
    duck: null,
    frog: null,
    chicken: null,
    rabbit: null,
  });
  const effectRefs = useRef<Record<PlayerId, THREE.Group | null>>({
    duck: null,
    frog: null,
    chicken: null,
    rabbit: null,
  });
  const targetPositionRef = useRef(new THREE.Vector3());
  const targetScaleRef = useRef(new THREE.Vector3(1, 1, 1));

  useFrame(() => {
    const timestamp = performance.now();
    const board = boardRef.current;
    playersRef.current.forEach((player) => {
      const group = refs.current[player.id];
      if (!group) return;

      const hiddenByMobileTurn =
        mobileTurnPlayerIdRef?.current != null && player.id !== mobileTurnPlayerIdRef.current;
      const effect = effectRefs.current[player.id];
      if (!player.joined || hiddenByMobileTurn) {
        group.visible = false;
        const glow = glowRefs.current[player.id];
        if (glow) glow.visible = false;
        if (effect) effect.visible = false;
        return;
      }

      const deathAnimation =
        player.deathAnimation && timestamp <= player.deathAnimation.endsAt
          ? player.deathAnimation
          : null;
      const position = deathAnimation
        ? {
            x: worldXFromCenter(deathAnimation.col, board),
            y: 0.02,
            z: worldZFromCenter(deathAnimation.row, board),
          }
        : getAnimatedPosition(player, timestamp, board);
      const targetPosition = targetPositionRef.current.set(position.x, position.y, position.z);
      group.position.lerp(
        targetPosition,
        deathAnimation ? 0.82 : player.lightning ? 0.95 : player.jump ? 0.72 : 0.42,
      );
      const targetScale = targetScaleRef.current.set(
        deathAnimation?.type === "flat" ? 1.14 : 1,
        deathAnimation?.type === "flat" ? 0.12 : 1,
        deathAnimation?.type === "flat" ? 1.14 : 1,
      );
      group.scale.lerp(targetScale, deathAnimation ? 0.65 : 0.3);
      group.rotation.y =
        player.facing === "up"
          ? 0
          : player.facing === "down"
          ? Math.PI
          : player.facing === "left"
          ? Math.PI / 2
          : -Math.PI / 2;
      group.visible =
        deathAnimation?.type !== "splash" &&
        (deathAnimation?.type === "flat" || timestamp >= player.stunnedUntil || Math.sin(timestamp * 0.035) > 0);

      const glow = glowRefs.current[player.id];
      const glowColor = deathAnimation ? null : getPowerGlowColor(player, timestamp);
      if (glow) {
        glow.visible = Boolean(glowColor);
        if (glowColor && glow.material instanceof THREE.MeshBasicMaterial) {
          glow.material.color.set(glowColor);
          glow.material.opacity = glowColor === "#ffffff" ? 0.36 : 0.24;
        }
        glow.scale.setScalar(1 + Math.sin(timestamp * 0.01) * 0.08);
      }

      if (!effect) return;
      if (deathAnimation?.type === "splash") {
        const progress = clamp(
          (timestamp - deathAnimation.startedAt) /
            Math.max(1, deathAnimation.endsAt - deathAnimation.startedAt),
          0,
          1,
        );
        effect.visible = true;
        effect.position.set(
          worldXFromCenter(deathAnimation.col, board),
          0.28 + Math.sin(progress * Math.PI) * 0.28,
          worldZFromCenter(deathAnimation.row, board),
        );
        effect.rotation.y += 0.08;
        effect.scale.setScalar(0.45 + Math.sin(progress * Math.PI) * 0.85);
        return;
      }

      if (timestamp < player.celebrateUntil) {
        const progress = 1 - clamp((player.celebrateUntil - timestamp) / FLAG_CELEBRATION_MS, 0, 1);
        effect.visible = true;
        effect.position.set(position.x, 1.25 + Math.sin(timestamp * 0.014) * 0.16, position.z);
        effect.rotation.y += 0.11;
        effect.scale.setScalar(0.8 + Math.sin(progress * Math.PI * 3) * 0.16);
        return;
      }

      effect.visible = false;
    });
  });

  const effectBits = [
    ["#ffffff", 0.48, 0.08],
    ["#38bdf8", -0.48, 0.06],
    ["#facc15", 0.1, 0.5],
    ["#ef4444", -0.12, -0.48],
    ["#22c55e", 0.48, -0.08],
    ["#fb7185", -0.48, -0.08],
  ] as const;

  return (
    <>
      <group ref={(node) => (refs.current.duck = node)}>
        <mesh ref={(node) => (glowRefs.current.duck = node)} position={[0, 0.4, 0]}>
          <sphereGeometry args={[0.82, 12, 8]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.24} depthWrite={false} />
        </mesh>
        <DuckAsset />
      </group>
      <group ref={(node) => (refs.current.chicken = node)}>
        <mesh ref={(node) => (glowRefs.current.chicken = node)} position={[0, 0.4, 0]}>
          <sphereGeometry args={[0.82, 12, 8]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.24} depthWrite={false} />
        </mesh>
        <ChickenAsset />
      </group>
      <group ref={(node) => (refs.current.frog = node)}>
        <mesh ref={(node) => (glowRefs.current.frog = node)} position={[0, 0.36, 0]}>
          <sphereGeometry args={[0.78, 12, 8]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.24} depthWrite={false} />
        </mesh>
        <FrogAsset />
      </group>
      <group ref={(node) => (refs.current.rabbit = node)}>
        <mesh ref={(node) => (glowRefs.current.rabbit = node)} position={[0, 0.4, 0]}>
          <sphereGeometry args={[0.82, 12, 8]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.24} depthWrite={false} />
        </mesh>
        <RabbitAsset />
      </group>
      {PLAYER_IDS.map((playerId) => (
        <group
          key={`${playerId}-effect`}
          ref={(node) => {
            effectRefs.current[playerId] = node;
          }}
          visible={false}
        >
          {effectBits.map(([color, x, z], index) => (
            <Block
              key={index}
              color={color}
              size={[0.12, 0.12, 0.12]}
              position={[x, 0.2 + (index % 3) * 0.2, z]}
              emissive={color}
              emissiveIntensity={0.9}
            />
          ))}
          <Block color="#60a5fa" size={[0.46, 0.05, 0.46]} position={[0, 0.02, 0]} transparent opacity={0.65} />
        </group>
      ))}
    </>
  );
}

const MemoPlayerModels = React.memo(PlayerModels);

function CarAsset({
  length,
  color,
  direction,
  clippingPlanes,
}: {
  length: number;
  color: string;
  direction: 1 | -1;
  clippingPlanes?: THREE.Plane[];
}) {
  return (
    <group rotation={[0, direction === 1 ? 0 : Math.PI, 0]}>
      <Block color={color} size={[length * 0.9, 0.34, 0.58]} position={[0, 0.32, 0]} clippingPlanes={clippingPlanes} />
      <Block color={color} size={[length * 0.48, 0.28, 0.5]} position={[0.04, 0.63, -0.02]} clippingPlanes={clippingPlanes} />
      <Block color="#bde7ff" size={[length * 0.22, 0.18, 0.04]} position={[0.13, 0.66, -0.29]} roughness={0.25} clippingPlanes={clippingPlanes} />
      <Block color="#232629" size={[0.18, 0.2, 0.12]} position={[-length * 0.34, 0.15, -0.35]} clippingPlanes={clippingPlanes} />
      <Block color="#232629" size={[0.18, 0.2, 0.12]} position={[length * 0.34, 0.15, -0.35]} clippingPlanes={clippingPlanes} />
      <Block color="#232629" size={[0.18, 0.2, 0.12]} position={[-length * 0.34, 0.15, 0.35]} clippingPlanes={clippingPlanes} />
      <Block color="#232629" size={[0.18, 0.2, 0.12]} position={[length * 0.34, 0.15, 0.35]} clippingPlanes={clippingPlanes} />
      <Block color="#ffe789" size={[0.08, 0.08, 0.08]} position={[length * 0.46, 0.34, -0.23]} clippingPlanes={clippingPlanes} />
      <Block color="#ffe789" size={[0.08, 0.08, 0.08]} position={[length * 0.46, 0.34, 0.23]} clippingPlanes={clippingPlanes} />
    </group>
  );
}

function trainCarCountForLength(length: number) {
  return Math.max(1, Math.round(length / TRAIN_CAR_LENGTH));
}

function trainCarX(index: number, visibleCars: number) {
  return -((visibleCars * TRAIN_CAR_LENGTH) / 2) + TRAIN_CAR_LENGTH / 2 + index * TRAIN_CAR_LENGTH;
}

function TrainAsset({
  thing,
  lane,
  secondsRef,
  clippingPlanes,
}: {
  thing: MovingThing;
  lane: LaneDefinition;
  secondsRef?: MutableRefObject<number>;
  clippingPlanes?: THREE.Plane[];
}) {
  const segmentRefs = useRef<Array<THREE.Group | null>>([]);
  const maxCars = trainCarCountForLength(thing.lengthMax ?? thing.length);
  const initialCars = trainCarCountForLength(getThingLength(thing, lane, secondsRef?.current ?? 0));

  useFrame(() => {
    const visibleCars = trainCarCountForLength(getThingLength(thing, lane, secondsRef?.current ?? 0));
    segmentRefs.current.forEach((segment, index) => {
      if (!segment) return;
      segment.visible = index < visibleCars;
      segment.position.x = trainCarX(index, visibleCars);
    });
  });

  return (
    <group rotation={[0, lane.direction === 1 ? 0 : Math.PI, 0]}>
      {Array.from({ length: maxCars }).map((_, index) => {
        const isEngine = index === 0;
        return (
          <group
            key={index}
            ref={(node) => {
              segmentRefs.current[index] = node;
            }}
            position={[trainCarX(index, initialCars), 0, 0]}
            visible={index < initialCars}
          >
            <Block
              color={isEngine ? "#27313d" : "#c53d36"}
              size={[TRAIN_CAR_LENGTH * 0.86, 0.52, 0.68]}
              position={[0, 0.38, 0]}
              metalness={0.08}
              clippingPlanes={clippingPlanes}
            />
            <Block color="#f1f5f9" size={[TRAIN_CAR_LENGTH * 0.42, 0.18, 0.06]} position={[0, 0.48, -0.37]} clippingPlanes={clippingPlanes} />
            <Block color="#171f2a" size={[TRAIN_CAR_LENGTH * 0.72, 0.12, 0.12]} position={[0, 0.15, -0.42]} clippingPlanes={clippingPlanes} />
            <Block color="#171f2a" size={[TRAIN_CAR_LENGTH * 0.72, 0.12, 0.12]} position={[0, 0.15, 0.42]} clippingPlanes={clippingPlanes} />
            {isEngine && (
              <>
                <Block color="#171f2a" size={[0.28, 0.28, 0.28]} position={[TRAIN_CAR_LENGTH * 0.22, 0.77, 0]} clippingPlanes={clippingPlanes} />
                <Block color="#f9d16a" size={[0.1, 0.12, 0.46]} position={[TRAIN_CAR_LENGTH * 0.44, 0.46, 0]} clippingPlanes={clippingPlanes} />
              </>
            )}
          </group>
        );
      })}
    </group>
  );
}

function LogAsset({ length, clippingPlanes }: { length: number; clippingPlanes?: THREE.Plane[] }) {
  return (
    <group>
      <Block color="#885022" size={[length * 0.94, 0.3, 0.56]} position={[0, 0.18, 0]} clippingPlanes={clippingPlanes} />
      <Block color="#5c3518" size={[0.08, 0.32, 0.58]} position={[-length * 0.47, 0.18, 0]} clippingPlanes={clippingPlanes} />
      <Block color="#5c3518" size={[0.08, 0.32, 0.58]} position={[length * 0.47, 0.18, 0]} clippingPlanes={clippingPlanes} />
      {Array.from({ length: Math.max(2, Math.floor(length)) }).map((_, index) => (
        <Block
          key={index}
          color="#a9642e"
          size={[0.06, 0.32, 0.6]}
          position={[-length * 0.35 + index * 0.7, 0.19, 0]}
          clippingPlanes={clippingPlanes}
        />
      ))}
    </group>
  );
}

function TreeAsset({ variant }: { variant: NatureDecorVariant }) {
  if (variant === 0) {
    return (
      <group>
        <Block color="#7a4a24" size={[0.18, 0.58, 0.18]} position={[0, 0.29, 0]} />
        <Block color="#236338" size={[0.72, 0.34, 0.72]} position={[0, 0.72, 0]} />
        <Block color="#2f8d4e" size={[0.56, 0.3, 0.56]} position={[0, 1.0, 0]} />
        <Block color="#3aa45d" size={[0.38, 0.26, 0.38]} position={[0, 1.24, 0]} />
      </group>
    );
  }

  if (variant === 1) {
    return (
      <group>
        <Block color="#81512a" size={[0.22, 0.64, 0.22]} position={[0, 0.32, 0]} />
        <Block color="#2f7f44" size={[0.72, 0.52, 0.62]} position={[0, 0.86, 0]} />
        <Block color="#3b9652" size={[0.5, 0.42, 0.78]} position={[0, 0.98, 0]} />
        <Block color="#46a85f" size={[0.42, 0.32, 0.42]} position={[0.22, 1.16, -0.12]} />
      </group>
    );
  }

  return (
    <group>
      <Block color="#6f4326" size={[0.16, 0.82, 0.16]} position={[0, 0.41, 0]} />
      <Block color="#1f5d34" size={[0.46, 0.46, 0.46]} position={[0, 0.86, 0]} />
      <Block color="#28733f" size={[0.58, 0.34, 0.34]} position={[0, 1.08, 0]} />
      <Block color="#34904f" size={[0.34, 0.36, 0.58]} position={[0, 1.24, 0]} />
    </group>
  );
}

function RockAsset({ variant }: { variant: NatureDecorVariant }) {
  if (variant === 0) {
    return (
      <group>
        <Block color="#8b9290" size={[0.52, 0.24, 0.42]} position={[0, 0.12, 0]} />
        <Block color="#a3aaa7" size={[0.28, 0.18, 0.24]} position={[0.12, 0.31, -0.08]} />
      </group>
    );
  }

  if (variant === 1) {
    return (
      <group>
        <Block color="#747b7c" size={[0.36, 0.2, 0.48]} position={[-0.12, 0.1, 0.04]} />
        <Block color="#9aa1a0" size={[0.34, 0.28, 0.3]} position={[0.16, 0.14, -0.06]} />
        <Block color="#6b7374" size={[0.22, 0.16, 0.22]} position={[0.02, 0.3, 0.12]} />
      </group>
    );
  }

  return (
    <group>
      <Block color="#9ca3a2" size={[0.6, 0.18, 0.26]} position={[0, 0.09, 0]} />
      <Block color="#7d8584" size={[0.26, 0.28, 0.32]} position={[-0.18, 0.2, 0.02]} />
      <Block color="#b0b7b5" size={[0.24, 0.22, 0.24]} position={[0.2, 0.18, -0.04]} />
    </group>
  );
}

function renderNatureDecor(item: NatureDecorItem, board: BoardConfig) {
  return (
    <group
      key={item.id}
      position={[worldXFromCenter(item.col, board), 0.01, worldZFromCenter(item.row, board)]}
      rotation={[0, item.rotation, 0]}
      scale={[item.scale, item.scale, item.scale]}
    >
      {item.kind === "tree" ? <TreeAsset variant={item.variant} /> : <RockAsset variant={item.variant} />}
    </group>
  );
}

function CrownAsset() {
  return (
    <group>
      <Block color="#b7791f" size={[0.72, 0.12, 0.46]} position={[0, 0.12, 0]} metalness={0.35} roughness={0.3} />
      <Block color="#facc15" size={[0.64, 0.18, 0.38]} position={[0, 0.22, 0]} metalness={0.55} roughness={0.22} />
      {[-0.24, 0, 0.24].map((x, index) => (
        <group key={x} position={[x, 0, index === 1 ? 0 : 0.02]}>
          <Block color="#facc15" size={[0.14, index === 1 ? 0.42 : 0.34, 0.14]} position={[0, 0.48, 0]} metalness={0.55} roughness={0.22} />
          <Block color="#ffe47a" size={[0.2, 0.12, 0.2]} position={[0, index === 1 ? 0.75 : 0.68, 0]} emissive="#facc15" emissiveIntensity={0.35} />
        </group>
      ))}
      <Block color="#38bdf8" size={[0.1, 0.08, 0.06]} position={[-0.2, 0.32, -0.2]} emissive="#38bdf8" emissiveIntensity={0.65} />
      <Block color="#ef4444" size={[0.1, 0.08, 0.06]} position={[0, 0.34, -0.2]} emissive="#ef4444" emissiveIntensity={0.65} />
      <Block color="#22c55e" size={[0.1, 0.08, 0.06]} position={[0.2, 0.32, -0.2]} emissive="#22c55e" emissiveIntensity={0.65} />
    </group>
  );
}

function CrownPrize({ board }: { board: BoardConfig }) {
  const ref = useRef<THREE.Group>(null);
  const crown = crownCell(board);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.95;
    ref.current.position.y = 0.08 + Math.sin(state.clock.elapsedTime * 2.6) * 0.08;
  });

  return (
    <group ref={ref} position={[worldXFromCenter(crown.col, board), 0.08, worldZFromCenter(crown.row, board)]}>
      <mesh position={[0, 0.32, 0]}>
        <sphereGeometry args={[0.72, 16, 10]} />
        <meshBasicMaterial color="#facc15" transparent opacity={0.2} depthWrite={false} />
      </mesh>
      <CrownAsset />
    </group>
  );
}

function MovingThingModel({
  thing,
  lane,
  board,
  secondsRef,
}: {
  thing: MovingThing;
  lane: LaneDefinition;
  board: BoardConfig;
  secondsRef?: MutableRefObject<number>;
}) {
  if (thing.asset === "train") {
    return <TrainAsset thing={thing} lane={lane} secondsRef={secondsRef} clippingPlanes={board.clipPlanes} />;
  }
  if (thing.asset === "log") return <LogAsset length={thing.length} clippingPlanes={board.clipPlanes} />;
  return (
    <CarAsset
      length={thing.length}
      color={thing.color ?? "#e9504f"}
      direction={lane.direction}
      clippingPlanes={board.clipPlanes}
    />
  );
}

function MovingObjects({
  lanes,
  secondsRef,
  boardRef,
}: {
  lanes: LaneDefinition[];
  secondsRef: MutableRefObject<number>;
  boardRef: MutableRefObject<BoardConfig>;
}) {
  const refs = useRef<Record<string, THREE.Group | null>>({});

  useFrame(() => {
    const board = boardRef.current;
    const runtimeThings = getRuntimeThingsForLanes(lanes, secondsRef.current, board);
    runtimeThings.forEach((thing) => {
      const group = refs.current[thing.id];
      if (!group) return;
      group.position.set(worldXFromThing(thing, board), 0, worldZFromRuntimeThing(thing, board));
      group.scale.x = 1;
    });
  });

  return (
    <>
      {lanes.flatMap((lane) =>
        (lane.things ?? []).map((thing) => {
          const length = getThingLength(thing, lane, secondsRef.current);
          const runtimeThing: RuntimeThing = {
            ...thing,
            length,
            homeRow: lane.row,
            lane,
            x: getMovingX(thing, lane, secondsRef.current, boardRef.current, length),
          };

          return (
          <group
            key={`${lane.row}-${thing.id}-${thing.length}`}
            ref={(node) => {
              refs.current[thing.id] = node;
            }}
            position={[
              worldXFromThing(runtimeThing, boardRef.current),
              0,
              worldZFromRuntimeThing(runtimeThing, boardRef.current),
            ]}
            scale={[1, 1, 1]}
          >
            <MovingThingModel thing={thing} lane={lane} board={boardRef.current} secondsRef={secondsRef} />
          </group>
        );
        }),
      )}
    </>
  );
}

const MemoMovingObjects = React.memo(MovingObjects);

function RoadLane({ lane, board }: { lane: LaneDefinition; board: BoardConfig }) {
  const z = worldZFromCenter(lane.row, board);
  return (
    <group position={[0, 0, z]}>
      <Block color="#454c52" size={[board.cols, 0.18, 1]} position={[0, -0.09, 0]} />
      {Array.from({ length: Math.max(4, Math.ceil(board.cols / 2)) }).map((_, index) => (
        <Block
          key={index}
          color="#f5df71"
          size={[0.72, 0.03, 0.07]}
          position={[-board.halfCols + 0.8 + index * 1.9, 0.02, 0]}
          roughness={0.65}
        />
      ))}
      <Block color="#2c3338" size={[board.cols, 0.08, 0.08]} position={[0, 0.03, -0.48]} />
      <Block color="#2c3338" size={[board.cols, 0.08, 0.08]} position={[0, 0.03, 0.48]} />
    </group>
  );
}

function RiverLane({ lane, board }: { lane: LaneDefinition; board: BoardConfig }) {
  const z = worldZFromCenter(lane.row, board);
  return (
    <group position={[0, 0, z]}>
      <Block color="#1f86c7" size={[board.cols, 0.16, 1]} position={[0, -0.1, 0]} roughness={0.35} />
      {Array.from({ length: Math.max(4, Math.ceil(board.cols / 2)) }).map((_, index) => (
        <Block
          key={index}
          color="#8bd9ff"
          size={[1.1, 0.02, 0.04]}
          position={[-board.halfCols + 1 + index * 2.1, 0.01, index % 2 === 0 ? -0.2 : 0.22]}
          roughness={0.22}
        />
      ))}
    </group>
  );
}

function GrassLane({ lane, board }: { lane: LaneDefinition; board: BoardConfig }) {
  const z = worldZFromCenter(lane.row, board);
  return (
    <group position={[0, 0, z]}>
      <Block color={lane.kind === "goal" ? "#7dd46f" : "#4dac55"} size={[board.cols, 0.18, 1]} position={[0, -0.09, 0]} />
      {Array.from({ length: Math.max(6, board.cols - 2) }).map((_, index) => {
        const seed = lane.row * 13 + index * 7;
        return (
          <Block
            key={index}
            color={index % 4 === 0 ? "#f2dc62" : "#2f8d3f"}
            size={[0.08, index % 4 === 0 ? 0.12 : 0.22, 0.08]}
            position={[-board.halfCols + 0.6 + index * 1.12, 0.04, ((seed % 7) - 3) * 0.09]}
          />
        );
      })}
      {lane.kind === "goal" && (
        <>
          <Block color="#ffffff" size={[0.44, 0.03, 0.44]} position={[-0.28, 0.03, 0]} />
          <Block color="#20252a" size={[0.44, 0.04, 0.44]} position={[0.18, 0.035, 0]} />
          <Block color="#ffffff" size={[0.44, 0.03, 0.44]} position={[0.64, 0.03, 0]} />
        </>
      )}
    </group>
  );
}

function RailLane({ lane, board }: { lane: LaneDefinition; board: BoardConfig }) {
  const z = worldZFromCenter(lane.row, board);
  return (
    <group position={[0, 0, z]}>
      <Block color="#58473e" size={[board.cols, 0.16, 1]} position={[0, -0.09, 0]} />
      {Array.from({ length: board.cols + 1 }).map((_, index) => (
        <Block key={index} color="#7a5232" size={[0.14, 0.08, 0.86]} position={[-board.halfCols + index, 0.02, 0]} />
      ))}
      <Block color="#c7d1cf" size={[board.cols, 0.09, 0.08]} position={[0, 0.09, -0.27]} metalness={0.45} roughness={0.28} />
      <Block color="#c7d1cf" size={[board.cols, 0.09, 0.08]} position={[0, 0.09, 0.27]} metalness={0.45} roughness={0.28} />
    </group>
  );
}

function StartBacklot({
  lanes,
  board,
  crownAvailable,
}: {
  lanes: LaneDefinition[];
  board: BoardConfig;
  crownAvailable: boolean;
}) {
  const decor = useMemo(() => {
    const seedBase = laneDecorSeed(lanes, board) + 88711;
    const nextDecor: NatureDecorItem[] = [];
    for (let row = board.rows; row < board.rows + START_BACKDROP_ROWS; row += 1) {
      for (let col = 0; col < board.cols; col += 1) {
        if (isCrownCell(row, col, board)) continue;
        const item = natureDecorForCell(row, col, seedBase, START_BACKDROP_DECOR_FILL);
        if (item) nextDecor.push(item);
      }
    }
    return nextDecor;
  }, [lanes, board]);
  const backlotCenterZ = board.halfRows + START_BACKDROP_ROWS / 2;
  return (
    <>
      {Array.from({ length: START_BACKDROP_ROWS }).map((_, index) => (
        <group key={`start-backlot-row-${index}`} position={[0, 0, worldZFromCenter(board.rows + index, board)]}>
          <Block
            color={index % 2 === 0 ? "#3f9b4f" : "#459f55"}
            size={[board.cols, 0.18, 1]}
            position={[0, -0.09, 0]}
          />
        </group>
      ))}
      {decor.map((item) => renderNatureDecor(item, board))}
      {crownAvailable && <CrownPrize board={board} />}
      <Block
        color="#243729"
        size={[0.18, 0.3, START_BACKDROP_ROWS]}
        position={[-board.halfCols - 0.06, -0.05, backlotCenterZ]}
      />
      <Block
        color="#243729"
        size={[0.18, 0.3, START_BACKDROP_ROWS]}
        position={[board.halfCols + 0.06, -0.05, backlotCenterZ]}
      />
      <Block
        color="#243729"
        size={[board.cols + 0.36, 0.3, 0.18]}
        position={[0, -0.05, board.halfRows + START_BACKDROP_ROWS + 0.06]}
      />
    </>
  );
}

function PlayableGrassDecor({ lanes, board }: { lanes: LaneDefinition[]; board: BoardConfig }) {
  const decor = useMemo(() => {
    const nextDecor: NatureDecorItem[] = [];
    lanes.forEach((lane) => {
      if (lane.kind !== "grass" || lane.row >= board.playerStartRow) return;
      for (let col = 0; col < board.cols; col += 1) {
        if (!grassDecorD20Hit(lane.row, col, lane.decorSeed)) continue;
        const item = natureDecorForCell(lane.row, col, lane.decorSeed, 1);
        if (item) nextDecor.push(item);
      }
    });
    return nextDecor;
  }, [lanes, board]);
  return (
    <>
      {decor.map((item) => renderNatureDecor(item, board))}
    </>
  );
}

function LaneSurfaces({
  lanes,
  board,
  crownAvailable,
}: {
  lanes: LaneDefinition[];
  board: BoardConfig;
  crownAvailable: boolean;
}) {
  return (
    <>
      {lanes.map((lane) => {
        if (lane.kind === "road") return <RoadLane key={lane.row} lane={lane} board={board} />;
        if (lane.kind === "river") return <RiverLane key={lane.row} lane={lane} board={board} />;
        if (lane.kind === "rail") return <RailLane key={lane.row} lane={lane} board={board} />;
        return <GrassLane key={lane.row} lane={lane} board={board} />;
      })}
      <StartBacklot lanes={lanes} board={board} crownAvailable={crownAvailable} />
      <PlayableGrassDecor lanes={lanes} board={board} />
      <Block color="#243729" size={[board.cols + 0.36, 0.3, 0.18]} position={[0, -0.05, -board.halfRows - 0.06]} />
      <Block color="#243729" size={[0.18, 0.3, board.rows]} position={[-board.halfCols - 0.06, -0.05, 0]} />
      <Block color="#243729" size={[0.18, 0.3, board.rows]} position={[board.halfCols + 0.06, -0.05, 0]} />
    </>
  );
}

const MemoLaneSurfaces = React.memo(LaneSurfaces);

function PowerUpAsset({ type }: { type: PowerUpType }) {
  const ref = useRef<THREE.Group>(null);
  const def = POWER_UP_DEFS[type];

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 1.8;
    ref.current.position.y = 0.34 + Math.sin(state.clock.elapsedTime * 3) * 0.08;
  });

  return (
    <group ref={ref}>
      <Block
        color={def.color}
        size={[0.46, 0.46, 0.46]}
        position={[0, 0, 0]}
        emissive={def.color}
        emissiveIntensity={0.55}
      />
      <Block color="#111827" size={[0.18, 0.08, 0.18]} position={[0, 0.31, 0]} />
    </group>
  );
}

function ScoreItemAsset({ type }: { type: ScoreItemType }) {
  const ref = useRef<THREE.Group>(null);
  const def = SCORE_ITEM_DEFS[type];
  const glowColor =
    type === "flies" ? "#22c55e" : type === "seeds" ? "#ffffff" : type === "bread" ? "#facc15" : "#6f4326";

  useFrame((state) => {
    if (!ref.current) return;
    if (type === "carrot") {
      ref.current.rotation.y = 0;
      ref.current.position.y = 0;
      return;
    }
    ref.current.rotation.y = state.clock.elapsedTime * 1.35;
    ref.current.position.y = Math.sin(state.clock.elapsedTime * 2.4) * 0.05;
  });

  if (type === "bread") {
    return (
      <group ref={ref}>
        <mesh position={[0, 0.02, 0]}>
          <sphereGeometry args={[0.48, 12, 8]} />
          <meshBasicMaterial color={glowColor} transparent opacity={0.22} depthWrite={false} />
        </mesh>
        <Block color={def.color} size={[0.48, 0.24, 0.34]} position={[0, 0, 0]} />
        <Block color="#f7d38b" size={[0.38, 0.05, 0.24]} position={[0, 0.15, 0]} />
        <Block color={def.accent} size={[0.08, 0.04, 0.26]} position={[-0.12, 0.18, 0]} />
        <Block color={def.accent} size={[0.08, 0.04, 0.26]} position={[0.12, 0.18, 0]} />
      </group>
    );
  }

  if (type === "flies") {
    return (
      <group ref={ref}>
        <mesh position={[0, 0.05, 0]}>
          <sphereGeometry args={[0.5, 12, 8]} />
          <meshBasicMaterial color={glowColor} transparent opacity={0.24} depthWrite={false} />
        </mesh>
        <Block color={def.color} size={[0.16, 0.12, 0.16]} position={[0, 0.04, 0]} />
        <Block color={def.color} size={[0.12, 0.1, 0.12]} position={[0.18, 0.11, -0.1]} />
        <Block color={def.accent} size={[0.16, 0.03, 0.08]} position={[-0.11, 0.09, 0]} transparent opacity={0.72} />
        <Block color={def.accent} size={[0.16, 0.03, 0.08]} position={[0.11, 0.09, 0]} transparent opacity={0.72} />
      </group>
    );
  }

  if (type === "carrot") {
    return (
      <group ref={ref}>
        <mesh position={[0, 0.02, 0]}>
          <sphereGeometry args={[0.46, 12, 8]} />
          <meshBasicMaterial color={glowColor} transparent opacity={0.2} depthWrite={false} />
        </mesh>
        <Block color={def.color} size={[0.2, 0.5, 0.2]} position={[0, -0.02, 0]} />
        <Block color="#7fbf4d" size={[0.08, 0.18, 0.08]} position={[-0.08, 0.33, 0]} />
        <Block color="#8bd65a" size={[0.08, 0.22, 0.08]} position={[0.02, 0.37, -0.04]} />
        <Block color="#6da642" size={[0.08, 0.16, 0.08]} position={[0.1, 0.31, 0.04]} />
        <Block color="#5f3b24" size={[0.44, 0.06, 0.36]} position={[0, -0.3, 0]} />
      </group>
    );
  }

  return (
    <group ref={ref}>
      <mesh position={[0, 0.04, 0]}>
        <sphereGeometry args={[0.48, 12, 8]} />
        <meshBasicMaterial color={glowColor} transparent opacity={0.24} depthWrite={false} />
      </mesh>
      {[-0.14, 0, 0.14].map((x, index) => (
        <Block
          key={index}
          color={def.color}
          size={[0.14, 0.11, 0.14]}
          position={[x, 0.02 + index * 0.03, index % 2 === 0 ? -0.05 : 0.08]}
        />
      ))}
      <Block color={def.accent} size={[0.5, 0.04, 0.28]} position={[0, -0.08, 0]} />
    </group>
  );
}

function easeInOut(value: number) {
  return value * value * (3 - 2 * value);
}

function pickupSideX(pickup: PowerUpInstance, board: BoardConfig) {
  return pickup.col < board.cols / 2 ? -board.halfCols - 1.8 : board.halfCols + 1.8;
}

function getPickupTransform(pickup: PowerUpInstance, board: BoardConfig, seconds: number) {
  const targetX = worldXFromCenter(pickup.col, board);
  const targetZ = worldZFromCenter(pickup.row, board);
  const entry = easeInOut(clamp((seconds - pickup.spawnedAt) / PICKUP_ENTRY_SECONDS, 0, 1));
  const exit = easeInOut(clamp((seconds - pickup.expiresAt) / PICKUP_EXIT_SECONDS, 0, 1));
  const sideX = pickupSideX(pickup, board);
  const oppositeSideX = sideX < 0 ? board.halfCols + 1.8 : -board.halfCols - 1.8;
  const position = new THREE.Vector3(targetX, 0.34, targetZ);
  const scale = new THREE.Vector3(1, 1, 1);

  if (pickup.kind === "power") {
    if (entry < 1) {
      position.y = THREE.MathUtils.lerp(1.65, 0.34, entry);
    }
    if (exit > 0) {
      position.y = THREE.MathUtils.lerp(0.34, 1.65, exit);
      scale.setScalar(1 - exit * 0.45);
    }
    return { position, scale };
  }

  if (pickup.type === "flies") {
    if (entry < 1) {
      position.x = THREE.MathUtils.lerp(sideX, targetX, entry);
      position.z = THREE.MathUtils.lerp(targetZ - 0.7, targetZ, entry) + Math.sin(entry * Math.PI * 7) * 0.38 * (1 - entry);
      position.y = 0.58 + Math.sin(entry * Math.PI * 5) * 0.18;
    }
    if (exit > 0) {
      position.x = THREE.MathUtils.lerp(targetX, oppositeSideX, exit);
      position.z = targetZ + Math.sin(exit * Math.PI * 7) * 0.45;
      position.y = 0.58 + Math.sin(exit * Math.PI * 5) * 0.2;
    }
    return { position, scale };
  }

  if (pickup.type === "bread") {
    const fromX = pickup.entryOrigin?.x ?? sideX;
    const fromY = pickup.entryOrigin?.y ?? 0.82;
    const fromZ = pickup.entryOrigin?.z ?? targetZ + 0.45;
    if (entry < 1) {
      position.x = THREE.MathUtils.lerp(fromX, targetX, entry);
      position.z = THREE.MathUtils.lerp(fromZ, targetZ, entry);
      position.y = THREE.MathUtils.lerp(fromY, 0.34, entry) + Math.sin(entry * Math.PI) * 0.95;
    }
    if (exit > 0) {
      position.y = THREE.MathUtils.lerp(0.34, -0.26, exit);
      scale.setScalar(Math.max(0.08, 1 - exit));
    }
    return { position, scale };
  }

  if (pickup.type === "seeds") {
    if (entry < 1) {
      position.x = THREE.MathUtils.lerp(sideX, targetX, entry);
      position.y = THREE.MathUtils.lerp(0.8, 0.34, entry);
    }
    if (exit > 0) {
      position.x = THREE.MathUtils.lerp(targetX, oppositeSideX, exit);
      position.y = THREE.MathUtils.lerp(0.34, 0.8, exit);
    }
    return { position, scale };
  }

  position.y = THREE.MathUtils.lerp(-0.32, 0.24, entry);
  scale.y = Math.max(0.05, entry);
  if (exit > 0) {
    position.y = THREE.MathUtils.lerp(0.24, -0.32, exit);
    scale.y = Math.max(0.05, 1 - exit);
  }

  return { position, scale };
}

function PickupInstanceModel({
  pickup,
  board,
  secondsRef,
}: {
  pickup: PowerUpInstance;
  board: BoardConfig;
  secondsRef: MutableRefObject<number>;
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    const group = ref.current;
    if (!group) return;
    const { position, scale } = getPickupTransform(pickup, board, secondsRef.current);
    group.position.copy(position);
    group.scale.copy(scale);
  });

  const initial = getPickupTransform(pickup, board, secondsRef.current);
  return (
    <group ref={ref} position={initial.position} scale={initial.scale}>
      {pickup.kind === "power" ? (
        <PowerUpAsset type={pickup.type} />
      ) : (
        <ScoreItemAsset type={pickup.type} />
      )}
    </group>
  );
}

function PowerUpModels({
  powerUps,
  board,
  secondsRef,
}: {
  powerUps: PowerUpInstance[];
  board: BoardConfig;
  secondsRef: MutableRefObject<number>;
}) {
  return (
    <>
      {powerUps.map((powerUp) => (
        <PickupInstanceModel key={powerUp.id} pickup={powerUp} board={board} secondsRef={secondsRef} />
      ))}
    </>
  );
}

function LightningBeams({ players, board }: { players: PlayerState[]; board: BoardConfig }) {
  const now = performance.now();
  return (
    <>
      {players
        .filter((player) => player.joined && player.lightning && now <= player.lightning.endsAt)
        .map((player) => {
          const lightning = player.lightning!;
          const fromX = worldXFromCenter(lightning.fromCol, board);
          const toX = worldXFromCenter(lightning.toCol, board);
          const fromZ = worldZFromCenter(lightning.fromRow, board);
          const toZ = worldZFromCenter(lightning.toRow, board);
          return (
            <group key={`${player.id}-lightning`} position={[(fromX + toX) / 2, 0.82, (fromZ + toZ) / 2]}>
              <Block
                color="#ffffff"
                size={[0.16, 0.16, Math.max(0.4, Math.abs(toZ - fromZ) + 0.9)]}
                emissive="#ffffff"
                emissiveIntensity={1}
                transparent
                opacity={0.76}
              />
            </group>
          );
        })}
    </>
  );
}

function getCameraFrame(
  board: BoardConfig,
  players: PlayerState[],
  width: number,
  defaultZoom: number,
  cameraYaw: number,
  cameraPitch: number,
  focusPlayerId: PlayerId | null = null,
) {
  const framedPlayers = focusPlayerId
    ? players.filter((player) => player.joined && player.id === focusPlayerId)
    : activePlayers(players);
  const rows = framedPlayers.length > 0 ? framedPlayers.map((player) => player.row) : [board.playerStartRow];
  const cols = framedPlayers.length > 0 ? framedPlayers.map((player) => player.col) : [Math.floor(board.cols / 2)];
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const minCol = Math.min(...cols);
  const maxCol = Math.max(...cols);
  const averageRow = rows.reduce((sum, row) => sum + row, 0) / rows.length;
  const averageCol = cols.reduce((sum, col) => sum + col, 0) / cols.length;
  const rowSpread = maxRow - minRow;
  const colSpread = maxCol - minCol;
  const spread = Math.max(rowSpread, colSpread * 0.65);
  const target = new THREE.Vector3(
    worldXFromCenter(averageCol, board),
    0,
    worldZFromCenter(averageRow, board),
  );
  const pitch = clamp(cameraPitch, CAMERA_PITCH_MIN, CAMERA_PITCH_MAX);
  const pitchT = (pitch - CAMERA_PITCH_MIN) / (CAMERA_PITCH_MAX - CAMERA_PITCH_MIN);
  const orbitRadius = Math.max(board.cols, board.rows) * 0.72 + 6;
  const horizontalRadius = Math.cos(pitch) * orbitRadius;
  const baseZoom = Math.min(38, Math.max(17, 520 / Math.max(board.cols, board.rows))) * defaultZoom;
  const viewportZoom = width < 760 ? baseZoom * 0.74 : baseZoom;
  const pitchZoom = 0.84 + pitchT * 0.16;
  const targetZoom = clamp((viewportZoom - spread * 1.18) * pitchZoom, viewportZoom * 0.38, viewportZoom * 1.02);

  return {
    target,
    position: new THREE.Vector3(
      target.x + Math.sin(cameraYaw) * horizontalRadius,
      2.2 + Math.sin(pitch) * orbitRadius,
      target.z + Math.cos(cameraYaw) * horizontalRadius,
    ),
    zoom: targetZoom,
  };
}

function CameraRig({
  board,
  playersRef,
  settingsRef,
  cameraYawRef,
  cameraPitchRef,
  mobileTurnPlayerIdRef,
}: {
  board: BoardConfig;
  playersRef: MutableRefObject<PlayerState[]>;
  settingsRef: MutableRefObject<GameSettings>;
  cameraYawRef: MutableRefObject<number>;
  cameraPitchRef: MutableRefObject<number>;
  mobileTurnPlayerIdRef?: MutableRefObject<PlayerId | null>;
}) {
  const { camera, size } = useThree();
  const lookTargetRef = useRef(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    const frame = getCameraFrame(
      board,
      playersRef.current,
      size.width,
      settingsRef.current.defaultZoom,
      cameraYawRef.current,
      cameraPitchRef.current,
      mobileTurnPlayerIdRef?.current ?? null,
    );
    camera.position.copy(frame.position);
    lookTargetRef.current.copy(frame.target);
    camera.lookAt(lookTargetRef.current);

    if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom = frame.zoom;
      camera.near = 0.1;
      camera.far = 120;
      camera.updateProjectionMatrix();
    }
  }, [board, camera, cameraPitchRef, cameraYawRef, mobileTurnPlayerIdRef, playersRef, settingsRef, size.width]);

  useFrame((_, delta) => {
    const frame = getCameraFrame(
      board,
      playersRef.current,
      size.width,
      settingsRef.current.defaultZoom,
      cameraYawRef.current,
      cameraPitchRef.current,
      mobileTurnPlayerIdRef?.current ?? null,
    );
    const ease = 1 - Math.pow(0.002, delta);
    camera.position.lerp(frame.position, ease);
    lookTargetRef.current.lerp(frame.target, ease);
    camera.lookAt(lookTargetRef.current);

    if (camera instanceof THREE.OrthographicCamera) {
      const nextZoom = THREE.MathUtils.damp(camera.zoom, frame.zoom, 4.8, delta);
      if (Math.abs(nextZoom - camera.zoom) > 0.001) {
        camera.zoom = nextZoom;
        camera.updateProjectionMatrix();
      }
    }
  });

  return null;
}

function CrossyGameLoop({
  playersRef,
  powerUpsRef,
  runningRef,
  mobileModeRef,
  mobileTurnPlayerIdRef,
  mobileReadyOpenRef,
  mobileTurnEndsAtRef,
  settingsRef,
  lanesRef,
  boardRef,
  crownAvailableRef,
  secondsRef,
  nextSpawnRef,
  randomRef,
  setPowerUps,
  onSnapshot,
  onLeaderboardProgress,
  onMobileTurnAdvance,
  onMobileTurnTimeout,
  onMobilePlayerFlag,
  onDesktopPlayerFlag,
  onCrownCollected,
}: {
  playersRef: MutableRefObject<PlayerState[]>;
  powerUpsRef: MutableRefObject<PowerUpInstance[]>;
  runningRef: MutableRefObject<boolean>;
  mobileModeRef?: MutableRefObject<boolean>;
  mobileTurnPlayerIdRef?: MutableRefObject<PlayerId | null>;
  mobileReadyOpenRef?: MutableRefObject<boolean>;
  mobileTurnEndsAtRef?: MutableRefObject<number>;
  settingsRef: MutableRefObject<GameSettings>;
  lanesRef: MutableRefObject<LaneDefinition[]>;
  boardRef: MutableRefObject<BoardConfig>;
  crownAvailableRef: MutableRefObject<boolean>;
  secondsRef: MutableRefObject<number>;
  nextSpawnRef: MutableRefObject<number>;
  randomRef: MutableRefObject<() => number>;
  setPowerUps: (powerUps: PowerUpInstance[]) => void;
  onSnapshot: (players: PlayerState[], messages: string[]) => void;
  onLeaderboardProgress: (previousPlayers: PlayerState[], nextPlayers: PlayerState[], elapsedMs: number) => void;
  onMobileTurnAdvance?: (playerId: PlayerId, players: PlayerState[], delayMs?: number) => void;
  onMobileTurnTimeout?: (playerId: PlayerId, players: PlayerState[]) => void;
  onMobilePlayerFlag?: (playerId: PlayerId, players: PlayerState[]) => void;
  onDesktopPlayerFlag?: (playerId: PlayerId, players: PlayerState[]) => void;
  onCrownCollected: () => void;
}) {
  const lastSnapshotRef = useRef(0);
  const lastLeaderboardRef = useRef(0);
  const leaderboardPlayersRef = useRef<PlayerState[]>(playersRef.current);
  const leaderboardElapsedRef = useRef(0);

  useFrame((state, delta) => {
    if (!runningRef.current) return;

    const dt = Math.min(delta, 0.06);
    const timestamp = performance.now();
    const mobileMode = mobileModeRef?.current ?? false;
    const mobileTurnPlayerId = mobileMode ? mobileTurnPlayerIdRef?.current ?? null : null;
    const basePlayers = playersRef.current;
    if (mobileMode) {
      if ((mobileReadyOpenRef?.current ?? false) || !mobileTurnPlayerId) return;
      const turnEndsAt = mobileTurnEndsAtRef?.current ?? 0;
      if (turnEndsAt > 0 && timestamp >= turnEndsAt) {
        onMobileTurnTimeout?.(mobileTurnPlayerId, basePlayers);
        return;
      }
    }

    const messages: string[] = [];
    secondsRef.current += dt;

    const simulatedPlayers = mobileMode ? mobileTurnPlayers(basePlayers, mobileTurnPlayerId) : basePlayers;
    const previousTurnPlayer = mobileTurnPlayerId
      ? simulatedPlayers.find((player) => player.id === mobileTurnPlayerId)
      : null;

    const resolved = resolvePlayers(
      simulatedPlayers,
      lanesRef.current,
      boardRef.current,
      secondsRef.current,
      timestamp,
      dt,
      messages,
      crownAvailableRef.current,
    );
    let players = resolved.players;
    if (resolved.crownCollected) {
      crownAvailableRef.current = false;
      onCrownCollected();
    }

    const spawned = spawnPowerUps(
      powerUpsRef.current,
      players,
      lanesRef.current,
      boardRef.current,
      settingsRef.current,
      secondsRef.current,
      nextSpawnRef,
      randomRef,
    );

    let powerUps = spawned.powerUps;
    const collected = collectPowerUps(players, powerUps, secondsRef.current, timestamp, messages);
    players = collected.players;
    powerUps = collected.powerUps;

    const nextPlayers = mobileMode ? mergeMobileTurnPlayers(basePlayers, players, mobileTurnPlayerId) : players;
    playersRef.current = nextPlayers;
    if (spawned.changed || collected.changed) {
      powerUpsRef.current = powerUps;
      setPowerUps([...powerUps]);
    }

    const nextTurnPlayer =
      mobileTurnPlayerId && nextPlayers.find((player) => player.id === mobileTurnPlayerId);
    const desktopFlagPlayer = !mobileMode
      ? nextPlayers.find((player) => {
          const previousPlayer = basePlayers.find((candidate) => candidate.id === player.id);
          return previousPlayer && player.laps > previousPlayer.laps;
        })
      : null;
    if (desktopFlagPlayer) {
      onDesktopPlayerFlag?.(desktopFlagPlayer.id, nextPlayers);
    }

    if (
      mobileMode &&
      mobileTurnPlayerId &&
      previousTurnPlayer &&
      nextTurnPlayer &&
      nextTurnPlayer.laps > previousTurnPlayer.laps
    ) {
      onMobilePlayerFlag?.(mobileTurnPlayerId, nextPlayers);
    }

    if (
      mobileMode &&
      mobileTurnPlayerId &&
      previousTurnPlayer &&
      nextTurnPlayer &&
      nextTurnPlayer.misses > previousTurnPlayer.misses
    ) {
      const delayMs = nextTurnPlayer.deathAnimation?.type === "splash" ? SPLASH_DEATH_MS : FLAT_DEATH_MS;
      onMobileTurnAdvance?.(mobileTurnPlayerId, nextPlayers, delayMs);
    }

    leaderboardElapsedRef.current += dt * 1000;
    if (state.clock.elapsedTime - lastLeaderboardRef.current > 1) {
      lastLeaderboardRef.current = state.clock.elapsedTime;
      const leaderboardPlayers = mobileMode ? mobileTurnPlayers(nextPlayers, mobileTurnPlayerId) : nextPlayers;
      onLeaderboardProgress(leaderboardPlayersRef.current, leaderboardPlayers, leaderboardElapsedRef.current);
      leaderboardPlayersRef.current = copyPlayers(leaderboardPlayers);
      leaderboardElapsedRef.current = 0;
    }

    if (messages.length > 0 || state.clock.elapsedTime - lastSnapshotRef.current > 0.14) {
      lastSnapshotRef.current = state.clock.elapsedTime;
      onSnapshot(nextPlayers, messages);
    }
  });

  return null;
}

function CrossyScene({
  playersRef,
  powerUps,
  powerUpsRef,
  runningRef,
  mobileModeRef,
  mobileTurnPlayerIdRef,
  mobileReadyOpenRef,
  mobileTurnEndsAtRef,
  settingsRef,
  lanes,
  lanesRef,
  board,
  boardRef,
  crownAvailable,
  crownAvailableRef,
  secondsRef,
  nextSpawnRef,
  randomRef,
  cameraYawRef,
  cameraPitchRef,
  setPowerUps,
  onSnapshot,
  onLeaderboardProgress,
  onMobileTurnAdvance,
  onMobileTurnTimeout,
  onMobilePlayerFlag,
  onDesktopPlayerFlag,
  onCrownCollected,
}: {
  playersRef: MutableRefObject<PlayerState[]>;
  powerUps: PowerUpInstance[];
  powerUpsRef: MutableRefObject<PowerUpInstance[]>;
  runningRef: MutableRefObject<boolean>;
  mobileModeRef?: MutableRefObject<boolean>;
  mobileTurnPlayerIdRef?: MutableRefObject<PlayerId | null>;
  mobileReadyOpenRef?: MutableRefObject<boolean>;
  mobileTurnEndsAtRef?: MutableRefObject<number>;
  settingsRef: MutableRefObject<GameSettings>;
  lanes: LaneDefinition[];
  lanesRef: MutableRefObject<LaneDefinition[]>;
  board: BoardConfig;
  boardRef: MutableRefObject<BoardConfig>;
  crownAvailable: boolean;
  crownAvailableRef: MutableRefObject<boolean>;
  secondsRef: MutableRefObject<number>;
  nextSpawnRef: MutableRefObject<number>;
  randomRef: MutableRefObject<() => number>;
  cameraYawRef: MutableRefObject<number>;
  cameraPitchRef: MutableRefObject<number>;
  setPowerUps: (powerUps: PowerUpInstance[]) => void;
  onSnapshot: (players: PlayerState[], messages: string[]) => void;
  onLeaderboardProgress: (previousPlayers: PlayerState[], nextPlayers: PlayerState[], elapsedMs: number) => void;
  onMobileTurnAdvance?: (playerId: PlayerId, players: PlayerState[], delayMs?: number) => void;
  onMobileTurnTimeout?: (playerId: PlayerId, players: PlayerState[]) => void;
  onMobilePlayerFlag?: (playerId: PlayerId, players: PlayerState[]) => void;
  onDesktopPlayerFlag?: (playerId: PlayerId, players: PlayerState[]) => void;
  onCrownCollected: () => void;
}) {
  return (
    <>
      <color attach="background" args={["#b9ecff"]} />
      <CameraRig
        board={board}
        playersRef={playersRef}
        settingsRef={settingsRef}
        cameraYawRef={cameraYawRef}
        cameraPitchRef={cameraPitchRef}
        mobileTurnPlayerIdRef={mobileTurnPlayerIdRef}
      />
      <ambientLight intensity={1.55} />
      <directionalLight position={[5, 10, 4]} intensity={2.2} />
      <hemisphereLight args={["#d7f7ff", "#314b28", 1.2]} />
      <MemoLaneSurfaces lanes={lanes} board={board} crownAvailable={crownAvailable} />
      <MemoMovingObjects lanes={lanes} secondsRef={secondsRef} boardRef={boardRef} />
      <PowerUpModels powerUps={powerUps} board={board} secondsRef={secondsRef} />
      <MemoPlayerModels playersRef={playersRef} boardRef={boardRef} mobileTurnPlayerIdRef={mobileTurnPlayerIdRef} />
      <LightningBeams
        players={
          mobileTurnPlayerIdRef?.current
            ? mobileTurnPlayers(playersRef.current, mobileTurnPlayerIdRef.current)
            : playersRef.current
        }
        board={board}
      />
      <CrossyGameLoop
        playersRef={playersRef}
        powerUpsRef={powerUpsRef}
        runningRef={runningRef}
        mobileModeRef={mobileModeRef}
        mobileTurnPlayerIdRef={mobileTurnPlayerIdRef}
        mobileReadyOpenRef={mobileReadyOpenRef}
        mobileTurnEndsAtRef={mobileTurnEndsAtRef}
        settingsRef={settingsRef}
        lanesRef={lanesRef}
        boardRef={boardRef}
        crownAvailableRef={crownAvailableRef}
        secondsRef={secondsRef}
        nextSpawnRef={nextSpawnRef}
        randomRef={randomRef}
        setPowerUps={setPowerUps}
        onSnapshot={onSnapshot}
        onLeaderboardProgress={onLeaderboardProgress}
        onMobileTurnAdvance={onMobileTurnAdvance}
        onMobileTurnTimeout={onMobileTurnTimeout}
        onMobilePlayerFlag={onMobilePlayerFlag}
        onDesktopPlayerFlag={onDesktopPlayerFlag}
        onCrownCollected={onCrownCollected}
      />
    </>
  );
}

function activeLabel(player: PlayerState, now: number) {
  if (!player.activePowerUp || now > player.activePowerUp.expiresAt) return "No power";
  const remaining = Math.max(0, Math.ceil((player.activePowerUp.expiresAt - now) / 1000));
  return `${POWER_UP_DEFS[player.activePowerUp.type].label} ${remaining}s`;
}

export default function CrossyRoad() {
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const board = useMemo(() => createBoard(settings), [settings]);
  const lanes = useMemo(() => generateLanes(settings, board), [settings, board]);
  const [playersSnapshot, setPlayersSnapshot] = useState<PlayerState[]>(() =>
    makeInitialPlayers(board, settings.playerNames),
  );
  const [isMobileMode, setIsMobileMode] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(max-width: 700px)").matches,
  );
  const [mobileTurnPlayerId, setMobileTurnPlayerId] = useState<PlayerId | null>(() =>
    nextJoinedPlayerId(makeInitialPlayers(board, settings.playerNames), null, true),
  );
  const [mobileLevelConfigs, setMobileLevelConfigs] = useState(() => readMobileLevelConfigs(settings));
  const [mobileReadyOpen, setMobileReadyOpen] = useState(isMobileMode);
  const [mobileTurnTimeLeft, setMobileTurnTimeLeft] = useState(MOBILE_TURN_MS);
  const [feed, setFeed] = useState<FeedItem[]>([{ id: "ready", text: "3D course loaded." }]);
  const [running, setRunning] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [powerUps, setPowerUpsState] = useState<PowerUpInstance[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRecord[]>(() => readLeaderboard());
  const [leaderboardTab, setLeaderboardTab] = useState<LeaderboardTab>("rank");
  const [cameraPopoverAnchor, setCameraPopoverAnchor] = useState<HTMLButtonElement | null>(null);
  const [cameraDirectionLabel, setCameraDirectionLabel] = useState<CameraDirectionLabel | null>("N");
  const [cameraTiltLabel, setCameraTiltLabel] = useState<CameraTiltLabel | null>(null);
  const [portraitCameraView, setPortraitCameraView] = useState(false);
  const [numberInputDrafts, setNumberInputDrafts] = useState<Record<string, string>>({});
  const [claimedCrownLevelKeys, setClaimedCrownLevelKeys] = useState<Set<string>>(() => new Set());
  const currentCrownLevelKey = useMemo(() => crownLevelKey(lanes, board), [lanes, board]);
  const crownAvailable = !claimedCrownLevelKeys.has(currentCrownLevelKey);

  const playersRef = useRef<PlayerState[]>(playersSnapshot);
  const powerUpsRef = useRef<PowerUpInstance[]>(powerUps);
  const crownAvailableRef = useRef(crownAvailable);
  const leaderboardRef = useRef<LeaderboardRecord[]>(leaderboard);
  const runningRef = useRef(running);
  const mobileModeRef = useRef(isMobileMode);
  const mobileTurnPlayerIdRef = useRef<PlayerId | null>(mobileTurnPlayerId);
  const mobileLevelConfigsRef = useRef(mobileLevelConfigs);
  const mobileReadyOpenRef = useRef(mobileReadyOpen);
  const mobileTurnEndsAtRef = useRef(0);
  const mobileTurnDelayRef = useRef<number | null>(null);
  const preserveNextBoardRebuildRef = useRef(false);
  const preserveNextBoardPositionsRef = useRef(false);
  const pendingBoardRebuildMessageRef = useRef<string | null>(null);
  const settingsRef = useRef(settings);
  const boardRef = useRef(board);
  const lanesRef = useRef(lanes);
  const secondsRef = useRef(0);
  const randomRef = useRef(createSeededRandom(Date.now()));
  const nextSpawnRef = useRef(POWER_UP_MIN_SECONDS + Math.random() * (POWER_UP_MAX_SECONDS - POWER_UP_MIN_SECONDS));
  const cameraYawRef = useRef(0);
  const cameraPitchRef = useRef(CAMERA_PITCH_DEFAULT);
  const pressedKeysRef = useRef(new Set<string>());
  const mobilePressRef = useRef<MobilePressState | null>(null);
  const swipeRef = useRef<SwipeState>({ active: false, startX: 0, startY: 0, pointerId: null });
  const rotationDragRef = useRef<{ active: boolean; lastX: number; lastY: number; pointerId: number | null }>({
    active: false,
    lastX: 0,
    lastY: 0,
    pointerId: null,
  });

  useEffect(() => {
    saveSettings(settings);
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    crownAvailableRef.current = crownAvailable;
  }, [crownAvailable]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const query = window.matchMedia("(max-width: 700px)");
    const update = () => setIsMobileMode(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    mobileModeRef.current = isMobileMode;
    if (!isMobileMode) {
      mobileTurnPlayerIdRef.current = null;
      mobileReadyOpenRef.current = false;
      mobileTurnEndsAtRef.current = 0;
      setMobileTurnPlayerId(null);
      setMobileReadyOpen(false);
      return;
    }

    const nextTurn = nextJoinedPlayerId(playersRef.current, mobileTurnPlayerIdRef.current, true);
    mobileTurnPlayerIdRef.current = nextTurn;
    setMobileTurnPlayerId(nextTurn);
    const config = nextTurn ? mobileLevelConfigsRef.current[nextTurn] : null;
    if (config) {
      preserveNextBoardRebuildRef.current = true;
      setSettings((current) => ({
        ...current,
        rows: Math.round(clamp(config.rows, MIN_ROWS, MAX_ROWS)),
        laneSeed: cleanNumber(config.laneSeed, current.laneSeed, 1, 999999999),
      }));
    }
    mobileReadyOpenRef.current = true;
    mobileTurnEndsAtRef.current = 0;
    setMobileReadyOpen(true);
    rotationDragRef.current = { active: false, lastX: 0, lastY: 0, pointerId: null };
  }, [isMobileMode]);

  useEffect(() => {
    mobileTurnPlayerIdRef.current = mobileTurnPlayerId;
  }, [mobileTurnPlayerId]);

  useEffect(() => {
    mobileLevelConfigsRef.current = mobileLevelConfigs;
    writeMobileLevelConfigs(mobileLevelConfigs);
  }, [mobileLevelConfigs]);

  useEffect(() => {
    if (!isMobileMode || mobileReadyOpen) return undefined;
    const update = () => {
      if (mobileReadyOpenRef.current) {
        setMobileTurnTimeLeft(MOBILE_TURN_MS);
        return;
      }
      setMobileTurnTimeLeft(Math.max(0, mobileTurnEndsAtRef.current - performance.now()));
    };
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [isMobileMode, mobileReadyOpen, mobileTurnPlayerId]);

  useEffect(
    () => () => {
      if (mobileTurnDelayRef.current != null) {
        window.clearTimeout(mobileTurnDelayRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  useEffect(() => {
    lanesRef.current = lanes;
  }, [lanes]);

  useEffect(() => {
    powerUpsRef.current = powerUps;
  }, [powerUps]);

  useEffect(() => {
    leaderboardRef.current = leaderboard;
  }, [leaderboard]);

  useEffect(() => {
    let changed = false;
    const renamedPlayers = playersRef.current.map((player) => {
      const name = settings.playerNames[player.id] || DEFAULT_PLAYER_NAMES[player.id];
      const profileName =
        player.profileName && normalizeProfileName(player.profileName) === normalizeProfileName(name)
          ? player.profileName
          : null;
      if (player.name === name && player.profileName === profileName) return player;
      changed = true;
      return { ...player, name, profileName };
    });

    if (!changed) return;
    playersRef.current = renamedPlayers;
    setPlayersSnapshot(copyPlayers(renamedPlayers));
  }, [settings.playerNames]);

  const appendFeed = useCallback((messages: string[]) => {
    if (messages.length === 0) return;
    setFeed((current) =>
      [
        ...messages.map((text, index) => ({
          id: `${Date.now()}-${index}-${Math.random()}`,
          text,
        })),
        ...current,
      ].slice(0, 5),
    );
  }, []);

  const updateSnapshot = useCallback(
    (players: PlayerState[], messages: string[] = []) => {
      setPlayersSnapshot(copyPlayers(players));
      appendFeed(messages);
    },
    [appendFeed],
  );

  const setPowerUps = useCallback((next: PowerUpInstance[]) => {
    powerUpsRef.current = next;
    setPowerUpsState(next);
  }, []);

  const handleCrownCollected = useCallback(() => {
    crownAvailableRef.current = false;
    setClaimedCrownLevelKeys((current) => {
      if (current.has(currentCrownLevelKey)) return current;
      const next = new Set(current);
      next.add(currentCrownLevelKey);
      return next;
    });
  }, [currentCrownLevelKey]);

  const setLeaderboardRecords = useCallback((updater: (records: LeaderboardRecord[]) => LeaderboardRecord[]) => {
    setLeaderboard((current) => {
      const next = updater(current);
      leaderboardRef.current = next;
      writeLeaderboard(next);
      return next;
    });
  }, []);

  const setPlayerProfile = useCallback(
    (playerId: PlayerId, name: string, profileName: string | null) => {
      setSettings((current) => ({
        ...current,
        playerNames: {
          ...current.playerNames,
          [playerId]: name,
        },
      }));

      const nextPlayers = playersRef.current.map((player) =>
        player.id === playerId
          ? {
              ...player,
              name,
              profileName,
              leaderboardScoreCheckpoint: player.score,
            }
          : player,
      );
      playersRef.current = nextPlayers;
      updateSnapshot(nextPlayers);
    },
    [updateSnapshot],
  );

  const finalizePlayerName = useCallback(
    (playerId: PlayerId, rawName?: string) => {
      const player = playersRef.current.find((currentPlayer) => currentPlayer.id === playerId);
      if (!player) return;

      const desiredName = cleanPlayerName(
        rawName ?? settingsRef.current.playerNames[playerId],
        DEFAULT_PLAYER_NAMES[playerId],
      ).trim();
      const defaultName = DEFAULT_PLAYER_NAMES[playerId];
      if (!shouldTrackProfileName(desiredName)) {
        setPlayerProfile(playerId, defaultName, null);
        return;
      }

      const existing = findLeaderboardRecord(leaderboardRef.current, desiredName);
      if (existing) {
        const password = window.prompt(`Enter the password for ${existing.name}.`);
        if (password === existing.password) {
          setPlayerProfile(playerId, existing.name, existing.name);
          return;
        }

        window.alert("That password did not match.");
        setPlayerProfile(playerId, defaultName, null);
        return;
      }

      const password = window.prompt(`Create a password for ${desiredName}.`);
      if (!password) {
        setPlayerProfile(playerId, defaultName, null);
        return;
      }

      const record: LeaderboardRecord = {
        name: desiredName,
        password,
        score: 0,
        timeMs: 0,
        updatedAt: Date.now(),
      };
      setLeaderboardRecords((records) => [...records, record]);
      setPlayerProfile(playerId, desiredName, desiredName);
    },
    [setLeaderboardRecords, setPlayerProfile],
  );

  const updateLeaderboardProgress = useCallback(
    (_previousPlayers: PlayerState[], nextPlayers: PlayerState[], elapsedMs: number) => {
      const trackedPlayers = nextPlayers.filter(
        (player) => player.joined && player.profileName && shouldTrackProfileName(player.profileName),
      );
      if (trackedPlayers.length === 0) return;
      const trackedIds = new Set(trackedPlayers.map((player) => player.id));

      setLeaderboardRecords((records) => {
        let changed = false;
        const nextRecords = [...records];

        trackedPlayers.forEach((player) => {
          const scoreDelta = player.score - player.leaderboardScoreCheckpoint;
          const recordIndex = nextRecords.findIndex(
            (record) => player.profileName && normalizeProfileName(record.name) === normalizeProfileName(player.profileName),
          );
          if (recordIndex < 0) return;

          const record = nextRecords[recordIndex];
          nextRecords[recordIndex] = {
            ...record,
            score: Math.max(0, record.score + scoreDelta),
            timeMs: record.timeMs + elapsedMs,
            updatedAt: Date.now(),
          };
          changed = true;
        });

        return changed ? nextRecords : records;
      });

      playersRef.current = playersRef.current.map((player) =>
        trackedIds.has(player.id) ? { ...player, leaderboardScoreCheckpoint: player.score } : player,
      );
    },
    [setLeaderboardRecords],
  );

  const applyMobileLevelConfig = useCallback((playerId: PlayerId, configs = mobileLevelConfigsRef.current) => {
    const config =
      configs[playerId] ??
      ({
        rows: settingsRef.current.rows,
        laneSeed: settingsRef.current.laneSeed,
      } as MobileLevelConfig);
    preserveNextBoardRebuildRef.current = true;
    setSettings((current) => ({
      ...current,
      rows: Math.round(clamp(config.rows, MIN_ROWS, MAX_ROWS)),
      laneSeed: cleanNumber(config.laneSeed, current.laneSeed, 1, 999999999),
    }));
  }, []);

  const openMobileReadyForPlayer = useCallback(
    (playerId: PlayerId | null, delayMs = 0) => {
      if (mobileTurnDelayRef.current != null) {
        window.clearTimeout(mobileTurnDelayRef.current);
        mobileTurnDelayRef.current = null;
      }

      mobileReadyOpenRef.current = true;
      mobileTurnEndsAtRef.current = 0;
      setMobileReadyOpen(delayMs <= 0);
      setMobileTurnTimeLeft(MOBILE_TURN_MS);

      const open = () => {
        mobileTurnDelayRef.current = null;
        mobileTurnPlayerIdRef.current = playerId;
        setMobileTurnPlayerId(playerId);
        if (playerId) applyMobileLevelConfig(playerId);
        mobileReadyOpenRef.current = true;
        setMobileReadyOpen(true);
      };

      if (delayMs > 0) {
        mobileTurnDelayRef.current = window.setTimeout(open, delayMs);
      } else {
        open();
      }
    },
    [applyMobileLevelConfig],
  );

  const startMobileTurn = useCallback(() => {
    if (!mobileTurnPlayerIdRef.current) return;
    mobileTurnEndsAtRef.current = performance.now() + MOBILE_TURN_MS;
    mobileReadyOpenRef.current = false;
    setMobileReadyOpen(false);
    setMobileTurnTimeLeft(MOBILE_TURN_MS);
  }, []);

  const joinPlayer = useCallback(
    (playerId: PlayerId) => {
      const currentPlayers = playersRef.current.map((player) => clearExpiredPlayerEffects(player, performance.now()));
      const player = currentPlayers.find((candidate) => candidate.id === playerId);
      if (!player || player.joined) return;

      const nextPlayers = currentPlayers.map((candidate) =>
        candidate.id === player.id ? resetPlayerForJoin(candidate, boardRef.current, currentPlayers) : candidate,
      );
      playersRef.current = nextPlayers;
      setSettings((current) => ({
        ...current,
        playerNames: {
          ...current.playerNames,
          [player.id]: DEFAULT_PLAYER_NAMES[player.id],
        },
      }));

      if (mobileModeRef.current && !mobileTurnPlayerIdRef.current) {
        mobileTurnPlayerIdRef.current = player.id;
        setMobileTurnPlayerId(player.id);
        openMobileReadyForPlayer(player.id);
      }
      updateSnapshot(nextPlayers);
    },
    [openMobileReadyForPlayer, updateSnapshot],
  );

  const removePlayer = useCallback(
    (playerId: PlayerId) => {
      const boardNow = boardRef.current;
      const defaultName = DEFAULT_PLAYER_NAMES[playerId];
      const removedPlayer = playersRef.current.find((player) => player.id === playerId);
      if (removedPlayer?.profileName) {
        const scoreDelta = removedPlayer.score - removedPlayer.leaderboardScoreCheckpoint;
        if (scoreDelta !== 0) {
          setLeaderboardRecords((records) =>
            records.map((record) =>
              normalizeProfileName(record.name) === normalizeProfileName(removedPlayer.profileName ?? "")
                ? {
                    ...record,
                    score: Math.max(0, record.score + scoreDelta),
                    updatedAt: Date.now(),
                  }
                : record,
            ),
          );
        }
      }
      const nextPlayers = playersRef.current.map((player) =>
        player.id === playerId
          ? {
              ...player,
              name: defaultName,
              profileName: null,
              joined: false,
              row: boardNow.playerStartRow,
              col: boardNow.startCols[player.id],
              score: 0,
              leaderboardScoreCheckpoint: 0,
              laps: 0,
              crowns: 0,
              misses: 0,
              bestProgress: 0,
              stunnedUntil: 0,
              facing: "up" as Direction,
              activePowerUp: null,
              invincibleUntil: 0,
              jump: null,
              lightning: null,
              deathAnimation: null,
              celebrateUntil: 0,
            }
          : player,
      );
      playersRef.current = nextPlayers;
      if (mobileModeRef.current && mobileTurnPlayerIdRef.current === playerId) {
        const nextTurn = nextJoinedPlayerId(nextPlayers, playerId);
        openMobileReadyForPlayer(nextTurn);
      }
      setSettings((current) => ({
        ...current,
        playerNames: {
          ...current.playerNames,
          [playerId]: defaultName,
        },
      }));
      updateSnapshot(nextPlayers);
    },
    [openMobileReadyForPlayer, setLeaderboardRecords, updateSnapshot],
  );

  const saveMobileLevelForPlayer = useCallback((playerId: PlayerId) => {
    setMobileLevelConfigs((current) => {
      const next = {
        ...current,
        [playerId]: {
          rows: Math.round(clamp(settingsRef.current.rows, MIN_ROWS, MAX_ROWS)),
          laneSeed: cleanNumber(settingsRef.current.laneSeed, current[playerId]?.laneSeed ?? DEFAULT_SETTINGS.laneSeed, 1, 999999999),
        },
      };
      mobileLevelConfigsRef.current = next;
      return next;
    });
  }, []);

  const advanceMobileTurn = useCallback(
    (playerId: PlayerId, players: PlayerState[], delayMs = 0) => {
      saveMobileLevelForPlayer(playerId);
      const nextTurn = nextJoinedPlayerId(players, playerId);
      openMobileReadyForPlayer(nextTurn, delayMs);
    },
    [openMobileReadyForPlayer, saveMobileLevelForPlayer],
  );

  const handleMobileTurnTimeout = useCallback(
    (playerId: PlayerId, players: PlayerState[]) => {
      advanceMobileTurn(playerId, players, 0);
    },
    [advanceMobileTurn],
  );

  const handleMobilePlayerFlag = useCallback((playerId: PlayerId) => {
    const nextConfig = {
      rows: Math.round(clamp(settingsRef.current.rows + 1, MIN_ROWS, MAX_ROWS)),
      laneSeed: randomLaneSeed(),
    };
    setMobileLevelConfigs((current) => {
      const next = {
        ...current,
        [playerId]: nextConfig,
      };
      mobileLevelConfigsRef.current = next;
      return next;
    });
    preserveNextBoardRebuildRef.current = true;
    setSettings((current) => ({
      ...current,
      rows: nextConfig.rows,
      laneSeed: nextConfig.laneSeed,
    }));
  }, []);

  const handleDesktopPlayerFlag = useCallback((playerId: PlayerId, players: PlayerState[]) => {
    if (mobileModeRef.current) return;
    const winner = players.find((player) => player.id === playerId);
    playersRef.current = players;
    preserveNextBoardRebuildRef.current = true;
    preserveNextBoardPositionsRef.current = true;
    pendingBoardRebuildMessageRef.current = `${winner?.name ?? "A player"} changed the level.`;
    setSettings((current) => ({
      ...current,
      laneSeed: randomLaneSeed(),
    }));
  }, []);

  const resetRun = useCallback(
    (message = "New 3D run ready.") => {
      const scoredPlayers = playersRef.current.filter(
        (player) => player.profileName && player.score !== player.leaderboardScoreCheckpoint,
      );
      if (scoredPlayers.length > 0) {
        setLeaderboardRecords((records) =>
          records.map((record) => {
            const player = scoredPlayers.find(
              (candidate) =>
                candidate.profileName && normalizeProfileName(candidate.profileName) === normalizeProfileName(record.name),
            );
            if (!player) return record;
            return {
              ...record,
              score: Math.max(0, record.score + player.score - player.leaderboardScoreCheckpoint),
              updatedAt: Date.now(),
            };
          }),
        );
      }

      const previousById = playersRef.current.reduce((acc, player) => {
        acc[player.id] = player;
        return acc;
      }, {} as Record<PlayerId, PlayerState>);
      const preserveStats = preserveNextBoardRebuildRef.current;
      const preservePositions = preserveNextBoardPositionsRef.current;
      const boardNow = boardRef.current;
      const lanesNow = lanesRef.current;
      const resetMessage = pendingBoardRebuildMessageRef.current ?? message;
      const resetMessages: string[] = [];
      preserveNextBoardRebuildRef.current = false;
      preserveNextBoardPositionsRef.current = false;
      pendingBoardRebuildMessageRef.current = null;
      const nextPlayers = makeInitialPlayers(boardRef.current, settingsRef.current.playerNames).map((player) => {
        const previous = previousById[player.id];
        const joined = previous?.joined ?? true;
        const preservedRow =
          preservePositions && previous ? clamp(previous.row, 0, maxPlayableRow(boardNow)) : player.row;
        const preservedCol =
          preservePositions && previous ? clamp(previous.col, 0, boardNow.cols - 1) : player.col;
        const resetForForest =
          joined &&
          preservePositions &&
          hasForestBlocker(Math.round(preservedRow), Math.round(preservedCol), lanesNow, boardNow);
        if (resetForForest) {
          resetMessages.push(`${previous?.name ?? player.name} was pushed back by the new trees and rocks.`);
        }
        return {
          ...player,
          joined,
          name: joined ? previous?.name ?? player.name : DEFAULT_PLAYER_NAMES[player.id],
          profileName: joined ? previous?.profileName ?? null : null,
          row: resetForForest ? boardNow.playerStartRow : preservedRow,
          col: resetForForest ? boardNow.startCols[player.id] : preservedCol,
          score: preserveStats ? previous?.score ?? player.score : player.score,
          leaderboardScoreCheckpoint: preserveStats
            ? previous?.score ?? player.leaderboardScoreCheckpoint
            : player.leaderboardScoreCheckpoint,
          laps: preserveStats ? previous?.laps ?? player.laps : player.laps,
          crowns: preserveStats ? previous?.crowns ?? player.crowns : player.crowns,
          misses: preserveStats ? previous?.misses ?? player.misses : player.misses,
          bestProgress: preserveStats ? previous?.bestProgress ?? player.bestProgress : player.bestProgress,
          activePowerUp: preserveStats ? previous?.activePowerUp ?? null : null,
        };
      });
      playersRef.current = nextPlayers;
      if (mobileModeRef.current) {
        const nextTurn = nextJoinedPlayerId(nextPlayers, mobileTurnPlayerIdRef.current, true);
        mobileTurnPlayerIdRef.current = nextTurn;
        setMobileTurnPlayerId(nextTurn);
      }
      powerUpsRef.current = [];
      secondsRef.current = 0;
      nextSpawnRef.current = randomPowerUpSeconds(randomRef.current);
      setPlayersSnapshot(copyPlayers(nextPlayers));
      setPowerUpsState([]);
      setFeed([
        { id: "reset", text: resetMessage },
        ...resetMessages.map((text, index) => ({ id: `reset-forest-${index}`, text })),
      ].slice(0, 5));
      setRunning(true);
    },
    [setLeaderboardRecords],
  );

  useEffect(() => {
    resetRun("Board rebuilt.");
  }, [
    board.cols,
    board.rows,
    settings.grannyDriverSpeed,
    settings.hardMode,
    settings.laneSeed,
    settings.logLengthMax,
    settings.logLengthMin,
    settings.trainLengthMax,
    settings.trainLengthMin,
    resetRun,
  ]);

  const movePlayer = useCallback(
    (playerId: PlayerId, rowDelta: number, colDelta: number) => {
      if (!runningRef.current) return;
      if (mobileModeRef.current && mobileReadyOpenRef.current) return;
      const timestamp = performance.now();
      const currentPlayers = playersRef.current.map((player) => clearExpiredPlayerEffects(player, timestamp));
      const actor = currentPlayers.find((player) => player.id === playerId);
      if (!actor) return;

      if (
        mobileModeRef.current &&
        actor.joined &&
        mobileTurnPlayerIdRef.current &&
        actor.id !== mobileTurnPlayerIdRef.current
      ) {
        return;
      }

      if (!actor.joined) {
        if (rowDelta !== -1 || colDelta !== 0) return;
        joinPlayer(actor.id);
        return;
      }

      if (timestamp < actor.stunnedUntil) return;

      const actorHasSpeed = actor.activePowerUp?.type === "speed";
      const cooldownMs = actorHasSpeed ? 0 : settingsRef.current.moveCooldown * 1000;
      if (timestamp - actor.lastMoveAt < cooldownMs) return;

      if (actor.jump || actor.lightning) return;

      const boardNow = boardRef.current;
      const lanesNow = lanesRef.current;
      const facing = getFacing(rowDelta, colDelta);
      const currentLane = getLane(lanesNow, Math.round(actor.row));
      let nextRow = Math.round(actor.row);
      let nextCol = Math.round(actor.col);
      let jump: TravelAnimation | null = null;
      let lightning: TravelAnimation | null = null;
      const messages: string[] = [];

      if (
        actor.activePowerUp?.type === "lightning" &&
        isSafeLane(currentLane) &&
        rowDelta !== 0
      ) {
        const landingRow = findLightningLandingRow(Math.round(actor.row), rowDelta, lanesNow, boardNow);
        if (landingRow == null) {
          messages.push(`${actor.name}'s lightning found no grass.`);
        } else if (hasForestBlocker(landingRow, nextCol, lanesNow, boardNow)) {
          messages.push(`${actor.name}'s lightning landing was blocked.`);
        } else if (pathHasHazard(Math.round(actor.row), landingRow, nextCol, lanesNow, boardNow, secondsRef.current)) {
          messages.push(`${actor.name}'s lightning path was blocked.`);
        } else {
          nextRow = landingRow;
          lightning = {
            fromCol: nextCol,
            fromRow: Math.round(actor.row),
            toCol: nextCol,
            toRow: nextRow,
            startedAt: timestamp,
            endsAt: timestamp + 95,
          };
        }
      } else {
        const moveDistance = actor.activePowerUp?.type === "jump" ? 2 : 1;
        nextRow = clamp(Math.round(actor.row) + rowDelta * moveDistance, 0, maxPlayableRow(boardNow));
        nextCol = clamp(Math.round(actor.col) + colDelta * moveDistance, 0, boardNow.cols - 1);
        if (moveDistance === 2) {
          jump = {
            fromCol: actor.col,
            fromRow: Math.round(actor.row),
            toCol: nextCol,
            toRow: nextRow,
            startedAt: timestamp,
            endsAt: timestamp + 500,
          };
        }
      }

      const targetLane = getLane(lanesNow, nextRow);
      if (!lightning) {
        if (targetLane.kind === "river" && currentLane.kind !== "river") {
          nextCol = findLogHopLandingCol(targetLane, nextCol, secondsRef.current, boardNow, lanesNow);
        } else if (currentLane.kind === "river" && targetLane.kind !== "river") {
          nextCol = findLogExitCol(actor.col, boardNow);
        }

        if (jump) {
          jump = {
            ...jump,
            toCol: nextCol,
            toRow: nextRow,
          };
        }
      }

      if (hasForestBlocker(nextRow, nextCol, lanesNow, boardNow)) {
        const blockedPlayers = currentPlayers.map((player) =>
          player.id === actor.id ? { ...player, facing, lastMoveAt: timestamp } : player,
        );
        playersRef.current = blockedPlayers;
        updateSnapshot(blockedPlayers, [`${actor.name} ran into the rocks and trees.`]);
        return;
      }

      const collisionPlayers = mobileModeRef.current ? mobileTurnPlayers(currentPlayers, actor.id) : currentPlayers;
      const blocker = getCellOccupant(collisionPlayers, actor.id, nextRow, nextCol);
      let pushedPlayer: PlayerState | null = null;
      if (blocker) {
        const pushRow = Math.round(blocker.row) + rowDelta;
        const pushCol = Math.round(blocker.col) + colDelta;
        const canShove =
          actor.activePowerUp?.type === "control" &&
          !blocker.jump &&
          pushRow >= 0 &&
          pushRow <= maxPlayableRow(boardNow) &&
          pushCol >= 0 &&
          pushCol < boardNow.cols &&
          !hasForestBlocker(pushRow, pushCol, lanesNow, boardNow) &&
          !getCellOccupant(collisionPlayers, blocker.id, pushRow, pushCol);

        if (!canShove) {
          const blockedPlayers = currentPlayers.map((player) =>
            player.id === actor.id ? { ...player, facing, lastMoveAt: timestamp } : player,
          );
          playersRef.current = blockedPlayers;
          updateSnapshot(blockedPlayers, [`${actor.name} was blocked by ${blocker.name}.`]);
          return;
        }

        pushedPlayer = {
          ...blocker,
          row: pushRow,
          col: pushCol,
          facing,
          stunnedUntil: Math.max(blocker.stunnedUntil, timestamp + 180),
          jump: null,
          lightning: null,
        };
        messages.push(`${actor.name} shoved ${blocker.name}.`);
      }

      const progress = boardNow.playerStartRow - nextRow;
      const progressGain = Math.max(0, progress - actor.bestProgress);
      const nextPlayers = currentPlayers.map((player) => {
        if (pushedPlayer && player.id === pushedPlayer.id) {
          return pushedPlayer;
        }
        if (player.id !== actor.id) return player;
        return {
          ...player,
          row: nextRow,
          col: nextCol,
          score: player.score + progressGain * 5,
          bestProgress: Math.max(player.bestProgress, progress),
          facing,
          lastMoveAt: player.id === actor.id ? timestamp : player.lastMoveAt,
          jump,
          lightning,
        };
      });

      playersRef.current = nextPlayers;
      updateSnapshot(nextPlayers, messages);
    },
    [joinPlayer, updateSnapshot],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, [contenteditable='true']")) return;

      const key = event.key.toLowerCase();
      pressedKeysRef.current.add(key);

      const exitingPlayer = PLAYER_IDS.find((playerId) =>
        PLAYER_EXIT_KEYS[playerId].every((exitKey) => pressedKeysRef.current.has(exitKey)),
      );
      if (exitingPlayer && playersRef.current.some((player) => player.id === exitingPlayer && player.joined)) {
        event.preventDefault();
        PLAYER_EXIT_KEYS[exitingPlayer].forEach((exitKey) => pressedKeysRef.current.delete(exitKey));
        removePlayer(exitingPlayer);
        return;
      }

      const control = KEYBOARD_CONTROLS[key];
      if (!control) return;
      event.preventDefault();
      movePlayer(control.playerId, control.rowDelta, control.colDelta);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      pressedKeysRef.current.delete(event.key.toLowerCase());
    };

    const clearPressedKeys = () => {
      pressedKeysRef.current.clear();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearPressedKeys);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearPressedKeys);
    };
  }, [movePlayer, removePlayer]);

  const updateSetting = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    setSettings((current) => {
      const next = { ...current, [key]: value };
      if (key === "trainLengthMin" && Number(value) > current.trainLengthMax) {
        next.trainLengthMax = Number(value);
      }
      if (key === "trainLengthMax" && Number(value) < current.trainLengthMin) {
        next.trainLengthMin = Number(value);
      }
      if (key === "logLengthMin" && Number(value) > current.logLengthMax) {
        next.logLengthMax = Number(value);
      }
      if (key === "logLengthMax" && Number(value) < current.logLengthMin) {
        next.logLengthMin = Number(value);
      }
      return next;
    });
  };

  const updatePowerUpSetting = (type: PowerUpType, patch: Partial<{ enabled: boolean; frequency: number }>) => {
    setSettings((current) => ({
      ...current,
      powerUps: {
        ...current.powerUps,
        [type]: {
          ...current.powerUps[type],
          ...patch,
        },
      },
    }));
  };

  const numberFieldProps = (
    key: string,
    currentValue: number,
    commit: (rawValue: string) => void,
  ) => {
    const draft = Object.prototype.hasOwnProperty.call(numberInputDrafts, key)
      ? numberInputDrafts[key]
      : undefined;

    const commitDraft = () => {
      if (draft == null) return;
      const trimmed = draft.trim();
      if (trimmed.length > 0) {
        commit(trimmed);
      }
      setNumberInputDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    };

    return {
      value: draft ?? String(currentValue),
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setNumberInputDrafts((current) => ({
          ...current,
          [key]: value,
        }));
      },
      onBlur: commitDraft,
      onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
          commitDraft();
          event.currentTarget.blur();
        }
      },
    };
  };

  const updatePlayerName = useCallback((playerId: PlayerId, value: string) => {
    setSettings((current) => ({
      ...current,
      playerNames: {
        ...current.playerNames,
        [playerId]: cleanPlayerName(value, current.playerNames[playerId] ?? DEFAULT_PLAYER_NAMES[playerId]),
      },
    }));
  }, []);

  const snapCameraDirection = useCallback((yaw: number, label: CameraDirectionLabel) => {
    cameraYawRef.current = yaw;
    setCameraDirectionLabel(label);
    setPortraitCameraView(false);
  }, []);

  const snapCameraTilt = useCallback((pitch: number, label: CameraTiltLabel) => {
    cameraPitchRef.current = pitch;
    setCameraTiltLabel(label);
    setPortraitCameraView(false);
  }, []);

  const togglePortraitCameraView = useCallback(() => {
    setPortraitCameraView((enabled) => {
      const next = !enabled;
      if (next) {
        cameraYawRef.current = PORTRAIT_CAMERA_YAW;
        cameraPitchRef.current = CAMERA_LOW_PITCH;
        setCameraDirectionLabel(null);
        setCameraTiltLabel("Low");
        setSettings((current) => ({
          ...current,
          defaultZoom: PORTRAIT_CAMERA_ZOOM,
        }));
      }
      return next;
    });
  }, []);

  const resetLeaderboardRecord = useCallback(
    (name: string) => {
      const record = findLeaderboardRecord(leaderboardRef.current, name);
      if (!record) return;
      const password = window.prompt(`Enter the password for ${record.name}.`);
      if (password !== record.password) {
        window.alert("That password did not match.");
        return;
      }

      setLeaderboardRecords((records) =>
        records.map((candidate) =>
          normalizeProfileName(candidate.name) === normalizeProfileName(record.name)
            ? {
                ...candidate,
                score: 0,
                timeMs: 0,
                updatedAt: Date.now(),
              }
            : candidate,
        ),
      );
    },
    [setLeaderboardRecords],
  );

  const editMobilePlayerName = useCallback(
    (player: PlayerState) => {
      const rawName = window.prompt("Player name", settingsRef.current.playerNames[player.id] ?? player.name);
      if (rawName == null) return;
      updatePlayerName(player.id, rawName);
      finalizePlayerName(player.id, rawName);
    },
    [finalizePlayerName, updatePlayerName],
  );

  const clearMobilePress = useCallback(() => {
    if (mobilePressRef.current?.timer != null) {
      window.clearTimeout(mobilePressRef.current.timer);
    }
    mobilePressRef.current = null;
  }, []);

  const handleMobilePlayerPointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>, player: PlayerState) => {
      if (!mobileModeRef.current) return;
      event.preventDefault();
      clearMobilePress();
      const press: MobilePressState = {
        playerId: player.id,
        timer: null,
        longPressed: false,
      };
      press.timer = window.setTimeout(() => {
        press.longPressed = true;
        const currentPlayer = playersRef.current.find((candidate) => candidate.id === player.id);
        if (currentPlayer?.joined) {
          removePlayer(player.id);
        }
      }, 650);
      mobilePressRef.current = press;
    },
    [clearMobilePress, removePlayer],
  );

  const handleMobilePlayerPointerUp = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>, player: PlayerState) => {
      if (!mobileModeRef.current) return;
      event.preventDefault();
      const press = mobilePressRef.current;
      if (press?.timer != null) window.clearTimeout(press.timer);
      mobilePressRef.current = null;
      if (!press || press.playerId !== player.id || press.longPressed) return;

      const currentPlayer = playersRef.current.find((candidate) => candidate.id === player.id);
      if (!currentPlayer?.joined) {
        joinPlayer(player.id);
        return;
      }
      editMobilePlayerName(currentPlayer);
    },
    [editMobilePlayerName, joinPlayer],
  );

  useEffect(() => clearMobilePress, [clearMobilePress]);

  const now = performance.now();
  const leaderboardRows = rankedLeaderboard(leaderboard, leaderboardTab);
  const mobileTurnPlayer =
    mobileTurnPlayerId == null ? null : playersSnapshot.find((player) => player.id === mobileTurnPlayerId && player.joined) ?? null;
  const mobileTurnSeconds = Math.max(0, Math.ceil(mobileTurnTimeLeft / 1000));
  const mobileTurnRunning =
    isMobileMode && !mobileReadyOpen && !mobileReadyOpenRef.current && mobileTurnEndsAtRef.current > 0;
  const cameraPopoverOpen = Boolean(cameraPopoverAnchor);

  const stopRotationDrag = useCallback((event?: React.PointerEvent<HTMLDivElement>) => {
    if (event && rotationDragRef.current.pointerId != null) {
      try {
        event.currentTarget.releasePointerCapture?.(rotationDragRef.current.pointerId);
      } catch {
        // Pointer capture may already be gone if the cursor leaves the canvas.
      }
    }
    rotationDragRef.current = { active: false, lastX: 0, lastY: 0, pointerId: null };
  }, []);

  const stopMobileSwipe = useCallback((event?: React.PointerEvent<HTMLDivElement>) => {
    if (event && swipeRef.current.pointerId != null) {
      try {
        event.currentTarget.releasePointerCapture?.(swipeRef.current.pointerId);
      } catch {
        // Pointer capture may already be gone.
      }
    }
    swipeRef.current = { active: false, startX: 0, startY: 0, pointerId: null };
  }, []);

  const handleStagePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();

    if (mobileModeRef.current) {
      if (mobileReadyOpenRef.current) return;
      swipeRef.current = {
        active: true,
        startX: event.clientX,
        startY: event.clientY,
        pointerId: event.pointerId,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      return;
    }

    rotationDragRef.current = {
      active: true,
      lastX: event.clientX,
      lastY: event.clientY,
      pointerId: event.pointerId,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  const handleStagePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (mobileModeRef.current) return;
    if (!rotationDragRef.current.active) return;
    event.preventDefault();
    const deltaX = event.clientX - rotationDragRef.current.lastX;
    const deltaY = event.clientY - rotationDragRef.current.lastY;
    rotationDragRef.current.lastX = event.clientX;
    rotationDragRef.current.lastY = event.clientY;
    cameraYawRef.current += deltaX * 0.012;
    cameraPitchRef.current = clamp(
      cameraPitchRef.current - deltaY * 0.006,
      CAMERA_PITCH_MIN,
      CAMERA_PITCH_MAX,
    );
  }, []);

  const handleStagePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!mobileModeRef.current) {
        stopRotationDrag(event);
        return;
      }

      const swipe = swipeRef.current;
      stopMobileSwipe(event);
      if (!swipe.active) return;
      event.preventDefault();
      const deltaX = event.clientX - swipe.startX;
      const deltaY = event.clientY - swipe.startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      if (Math.max(absX, absY) < 28) return;

      const playerId = mobileTurnPlayerIdRef.current;
      if (!playerId) return;
      if (mobileReadyOpenRef.current) return;
      if (absX > absY) {
        movePlayer(playerId, 0, deltaX > 0 ? 1 : -1);
      } else {
        movePlayer(playerId, deltaY > 0 ? 1 : -1, 0);
      }
    },
    [movePlayer, stopMobileSwipe, stopRotationDrag],
  );

  const handleStagePointerLeave = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (mobileModeRef.current) {
        stopMobileSwipe(event);
        return;
      }
      stopRotationDrag(event);
    },
    [stopMobileSwipe, stopRotationDrag],
  );

  return (
    <main
      className={`crossy-road-shell${isMobileMode ? " crossy-mobile-mode" : ""}${
        portraitCameraView ? " crossy-portrait-view" : ""
      }`}
    >
      <header className="crossy-topbar">
        <div className="crossy-title-row">
          <Tooltip title="Game settings">
            <IconButton className="crossy-menu-button" aria-label="Open settings" onClick={() => setDrawerOpen(true)}>
              <MenuIcon />
            </IconButton>
          </Tooltip>
          <div>
            <p className="crossy-eyebrow">Three.js prototype</p>
            <h1>Crossy Road</h1>
          </div>
        </div>
        <div className="crossy-actions">
          <div className="crossy-topbar-zoom" aria-label="Camera zoom">
            <span>{settings.defaultZoom.toFixed(2)}x</span>
            <Slider
              size="small"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={0.05}
              value={settings.defaultZoom}
              onChange={(_, value) => updateSetting("defaultZoom", value as number)}
              aria-label="Camera zoom"
            />
          </div>
          <Tooltip title="Camera view">
            <IconButton
              className="crossy-camera-menu-button"
              aria-label="Open camera controls"
              aria-describedby={cameraPopoverOpen ? "crossy-camera-popover" : undefined}
              onClick={(event) => setCameraPopoverAnchor(event.currentTarget)}
            >
              <ExploreIcon />
            </IconButton>
          </Tooltip>
          <button type="button" onClick={() => setRunning((value) => !value)}>
            {running ? "Pause" : "Play"}
          </button>
          <button type="button" onClick={() => resetRun()}>
            New Run
          </button>
        </div>
      </header>

      <Popover
        id="crossy-camera-popover"
        open={cameraPopoverOpen}
        anchorEl={cameraPopoverAnchor}
        onClose={() => setCameraPopoverAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ className: "crossy-camera-popover-paper" }}
      >
        <Box className="crossy-camera-popover">
          <div className="crossy-camera-panel">
            <Typography variant="caption" fontWeight={900}>Compass</Typography>
            <div className="crossy-compass-grid" role="group" aria-label="Camera direction">
              {CAMERA_COMPASS_LAYOUT.map((label, index) => {
                if (!label) {
                  return (
                    <span key={`center-${index}`} className="crossy-compass-center" aria-hidden="true">
                      <ExploreIcon fontSize="small" />
                    </span>
                  );
                }
                const preset = CAMERA_DIRECTION_PRESETS.find(([presetLabel]) => presetLabel === label);
                if (!preset) return null;
                const [, yaw] = preset;
                return (
                  <button
                    key={label}
                    type="button"
                    className={`crossy-compass-button${cameraDirectionLabel === label ? " crossy-camera-choice-active" : ""}`}
                    aria-pressed={cameraDirectionLabel === label}
                    onClick={() => snapCameraDirection(yaw, label)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="crossy-camera-panel">
            <Typography variant="caption" fontWeight={900}>Tilt</Typography>
            <div className="crossy-tilt-buttons" role="group" aria-label="Camera tilt">
              {CAMERA_TILT_PRESETS.map(([label, pitch]) => (
                <button
                  key={label}
                  type="button"
                  className={`crossy-tilt-button${cameraTiltLabel === label ? " crossy-camera-choice-active" : ""}`}
                  aria-pressed={cameraTiltLabel === label}
                  onClick={() => snapCameraTilt(pitch, label)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className={`crossy-portrait-toggle${portraitCameraView ? " crossy-camera-choice-active" : ""}`}
            aria-pressed={portraitCameraView}
            onClick={togglePortraitCameraView}
          >
            Portrait N-NE Low
          </button>
        </Box>
      </Popover>

      <section className="crossy-play-layout">
        <aside className="crossy-left-panel">
          <div className="crossy-scoreboard">
            {playersSnapshot.map((player) =>
              isMobileMode ? (
                <button
                  key={player.id}
                  type="button"
                  className={`crossy-mobile-racer${player.joined ? "" : " crossy-mobile-racer-empty"}${
                    player.joined && mobileTurnPlayerId === player.id ? " crossy-mobile-racer-active" : ""
                  }`}
                  style={{ "--player-accent": player.accent } as React.CSSProperties}
                  aria-label={`${player.name} crowns ${player.crowns}, flags ${player.laps}, score ${player.score}`}
                  title={player.joined ? activeLabel(player, now) : `tap ${player.name} to join`}
                  onPointerDown={(event) => handleMobilePlayerPointerDown(event, player)}
                  onPointerUp={(event) => handleMobilePlayerPointerUp(event, player)}
                  onPointerCancel={clearMobilePress}
                  onPointerLeave={clearMobilePress}
                >
                  <PlayerIcon player={player} />
                  <span className="crossy-mobile-stats">
                    <span className="crossy-mobile-stat" aria-label={`${player.name} flags`}>
                      {player.laps}
                    </span>
                    <span className="crossy-mobile-stat crossy-mobile-score" aria-label={`${player.name} score`}>
                      <strong>{player.score}</strong>
                    </span>
                  </span>
                  {player.joined && mobileTurnPlayerId === player.id && mobileTurnRunning && (
                    <span className="crossy-mobile-timer" aria-label={`${mobileTurnSeconds} seconds left`}>
                      {mobileTurnSeconds}
                    </span>
                  )}
                  {!player.joined && <span className="crossy-mobile-join" aria-hidden="true">+</span>}
                </button>
              ) : (
                <div
                  key={player.id}
                  className={`crossy-racer${player.joined ? "" : " crossy-racer-empty"}`}
                  style={{ "--player-accent": player.accent } as React.CSSProperties}
                  title={player.joined ? activeLabel(player, now) : `press ${PLAYER_UP_KEYS[player.id]} to join`}
                >
                  {player.joined ? (
                    <>
                      <PlayerIcon player={player} ariaLabel={`${player.name} icon`} />
                      <input
                        className="crossy-racer-name-input"
                        value={settings.playerNames[player.id] ?? player.name}
                        aria-label={`${player.name} name`}
                        onChange={(event) => updatePlayerName(player.id, event.target.value)}
                        onBlur={(event) => finalizePlayerName(player.id, event.currentTarget.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.currentTarget.blur();
                          }
                        }}
                      />
                      <span className="crossy-stat-chip" aria-label={`${player.name} score`}>
                        <ScoreboardIcon fontSize="small" />
                        <strong>{player.score}</strong>
                      </span>
                      <span className="crossy-stat-chip" aria-label={`${player.name} flags`}>
                        <FlagIcon fontSize="small" />
                        <span>{player.laps}</span>
                      </span>
                      <span className="crossy-stat-chip" aria-label={`${player.name} misses`}>
                        <span className="crossy-skull-icon" aria-hidden="true">{"\u2620"}</span>
                        <span>{player.misses}</span>
                      </span>
                      <button
                        type="button"
                        className="crossy-racer-remove"
                        aria-label={`Remove ${player.name}`}
                        onClick={() => removePlayer(player.id)}
                      >
                        <CloseIcon fontSize="small" />
                      </button>
                    </>
                  ) : (
                    <span className="crossy-join-prompt">press {PLAYER_UP_KEYS[player.id]} to join</span>
                  )}
                </div>
              ),
            )}
          </div>
          {!isMobileMode && (
            <div className="crossy-leaderboard">
              <Tabs
                value={leaderboardTab}
                onChange={(_, value) => setLeaderboardTab(value as LeaderboardTab)}
                variant="fullWidth"
              >
                <Tab value="rank" label="Rank" />
                <Tab value="score" label="Score" />
              </Tabs>
              <div className="crossy-leaderboard-list">
                {leaderboardRows.length === 0 ? (
                  <div className="crossy-leaderboard-empty">No saved scores</div>
                ) : (
                  leaderboardRows.slice(0, 8).map((record, index) => {
                    const rank = record.score / Math.max(record.timeMs / 60000, 1 / 60);
                    return (
                      <div key={record.name} className="crossy-leaderboard-row">
                        <strong>{index + 1}</strong>
                        <span>{record.name}</span>
                        <span>{leaderboardTab === "rank" ? rank.toFixed(1) : Math.round(record.score)}</span>
                        <small>{formatPlayTime(record.timeMs)}</small>
                        <button type="button" onClick={() => resetLeaderboardRecord(record.name)}>
                          Reset
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
          {!isMobileMode && settings.showDeathLog && (
            <div className="crossy-feed" aria-live="polite">
              {feed.map((item) => (
                <div key={item.id}>{item.text}</div>
              ))}
            </div>
          )}
        </aside>

        <section className="crossy-game-stage">
          <Canvas
            className="crossy-canvas"
            dpr={[1, 1.5]}
            orthographic
            camera={{ position: [8.5, 12, 13.5], zoom: 34, near: 0.1, far: 120 }}
            gl={{ antialias: true, powerPreference: "high-performance" }}
            frameloop="always"
            onContextMenu={(event) => event.preventDefault()}
            onPointerDown={handleStagePointerDown}
            onPointerMove={handleStagePointerMove}
            onPointerUp={handleStagePointerUp}
            onPointerLeave={handleStagePointerLeave}
            onPointerCancel={handleStagePointerLeave}
            onCreated={({ gl }) => {
              gl.localClippingEnabled = true;
            }}
          >
            <CrossyScene
              playersRef={playersRef}
              powerUps={powerUps}
              powerUpsRef={powerUpsRef}
              runningRef={runningRef}
              mobileModeRef={mobileModeRef}
              mobileTurnPlayerIdRef={isMobileMode ? mobileTurnPlayerIdRef : undefined}
              mobileReadyOpenRef={isMobileMode ? mobileReadyOpenRef : undefined}
              mobileTurnEndsAtRef={isMobileMode ? mobileTurnEndsAtRef : undefined}
              settingsRef={settingsRef}
              lanes={lanes}
              lanesRef={lanesRef}
              board={board}
              boardRef={boardRef}
              crownAvailable={crownAvailable}
              crownAvailableRef={crownAvailableRef}
              secondsRef={secondsRef}
              nextSpawnRef={nextSpawnRef}
              randomRef={randomRef}
              cameraYawRef={cameraYawRef}
              cameraPitchRef={cameraPitchRef}
              setPowerUps={setPowerUps}
              onSnapshot={updateSnapshot}
              onLeaderboardProgress={updateLeaderboardProgress}
              onMobileTurnAdvance={advanceMobileTurn}
              onMobileTurnTimeout={handleMobileTurnTimeout}
              onMobilePlayerFlag={handleMobilePlayerFlag}
              onDesktopPlayerFlag={handleDesktopPlayerFlag}
              onCrownCollected={handleCrownCollected}
            />
          </Canvas>
        </section>
      </section>

      {isMobileMode && mobileReadyOpen && mobileTurnPlayer && (
        <div className="crossy-mobile-ready-backdrop" role="dialog" aria-modal="true" aria-labelledby="crossy-ready-title">
          <div
            className="crossy-mobile-ready-modal"
            style={{ "--player-accent": mobileTurnPlayer.accent } as React.CSSProperties}
          >
            <div className="crossy-mobile-ready-icon" aria-hidden="true">
              {animalIcon(mobileTurnPlayer.id)}
            </div>
            <p>Next Turn</p>
            <h2 id="crossy-ready-title">{mobileTurnPlayer.name}</h2>
            <button type="button" className="crossy-mobile-ready-button" onClick={startMobileTurn}>
              Ready
            </button>
          </div>
        </div>
      )}

      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box className="crossy-settings-drawer" role="presentation">
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h6" fontWeight={900}>Settings</Typography>
                <Typography variant="caption" color="text.secondary">Saved in session storage</Typography>
              </Box>
              <IconButton aria-label="Close settings" onClick={() => setDrawerOpen(false)}>
                <CloseIcon />
              </IconButton>
            </Stack>

            <Divider />

            <Typography variant="subtitle2" fontWeight={900}>Level</Typography>
            <Stack direction="row" spacing={1}>
              <TextField
                label="Rows"
                type="number"
                size="small"
                inputProps={{ min: MIN_ROWS, max: MAX_ROWS }}
                {...numberFieldProps("rows", settings.rows, (value) =>
                  updateSetting("rows", Math.round(cleanNumber(value, settings.rows, MIN_ROWS, MAX_ROWS)))
                )}
              />
              <TextField
                label="Width"
                type="number"
                size="small"
                inputProps={{ min: MIN_COLS, max: MAX_COLS }}
                {...numberFieldProps("cols", settings.cols, (value) =>
                  updateSetting("cols", Math.round(cleanNumber(value, settings.cols, MIN_COLS, MAX_COLS)))
                )}
              />
            </Stack>
            <Button
              variant="outlined"
              startIcon={<ShuffleIcon />}
              onClick={() => updateSetting("laneSeed", Math.floor(Math.random() * 999999999))}
            >
              Randomize Level Rows
            </Button>
            <FormControlLabel
              label="Hard mode traffic"
              control={
                <Switch
                  checked={settings.hardMode}
                  onChange={(event) => updateSetting("hardMode", event.target.checked)}
                />
              }
            />

            <Divider />

            <Typography variant="subtitle2" fontWeight={900}>Movement</Typography>
            <TextField
              label="Move cooldown seconds"
              type="number"
              size="small"
              inputProps={{ min: 0, max: 2, step: 0.05 }}
              {...numberFieldProps("moveCooldown", settings.moveCooldown, (value) =>
                updateSetting("moveCooldown", cleanNumber(value, settings.moveCooldown, 0, 2))
              )}
            />
            <Box>
              <Typography variant="caption">Default zoom: {settings.defaultZoom.toFixed(2)}x</Typography>
              <Slider
                min={ZOOM_MIN}
                max={ZOOM_MAX}
                step={0.05}
                value={settings.defaultZoom}
                onChange={(_, value) => updateSetting("defaultZoom", value as number)}
              />
            </Box>
            <Box>
              <Typography variant="caption">Camera direction</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {CAMERA_DIRECTION_PRESETS.map(([label, yaw]) => (
                  <Button
                    key={label}
                    size="small"
                    variant={cameraDirectionLabel === label ? "contained" : "outlined"}
                    onClick={() => snapCameraDirection(yaw, label)}
                  >
                    {label}
                  </Button>
                ))}
              </Stack>
            </Box>
            <Box>
              <Typography variant="caption">Camera tilt</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {CAMERA_TILT_PRESETS.map(([label, pitch]) => (
                  <Button
                    key={label}
                    size="small"
                    variant={cameraTiltLabel === label ? "contained" : "outlined"}
                    onClick={() => snapCameraTilt(pitch, label)}
                  >
                    {label}
                  </Button>
                ))}
              </Stack>
            </Box>
            <FormControlLabel
              label="Show death log"
              control={
                <Switch
                  checked={settings.showDeathLog}
                  onChange={(event) => updateSetting("showDeathLog", event.target.checked)}
                />
              }
            />

            <Divider />

            <Typography variant="subtitle2" fontWeight={900}>Lane Speeds</Typography>
            {[
              ["Cars", "carSpeed"],
              ["Trains", "trainSpeed"],
              ["Logs", "logSpeed"],
            ].map(([label, key]) => (
              <Box key={key}>
                <Typography variant="caption">{label}: {settings[key as "carSpeed" | "trainSpeed" | "logSpeed"].toFixed(2)}x</Typography>
                <Slider
                  min={0.5}
                  max={1.5}
                  step={0.05}
                  value={settings[key as "carSpeed" | "trainSpeed" | "logSpeed"]}
                  onChange={(_, value) => updateSetting(key as "carSpeed" | "trainSpeed" | "logSpeed", value as number)}
                />
              </Box>
            ))}

            <Stack direction="row" spacing={1}>
              <TextField
                label="Train min"
                type="number"
                size="small"
                inputProps={{ min: 1, max: 50 }}
                {...numberFieldProps("trainLengthMin", settings.trainLengthMin, (value) =>
                  updateSetting("trainLengthMin", Math.round(cleanNumber(value, settings.trainLengthMin, 1, 50)))
                )}
              />
              <TextField
                label="Train max"
                type="number"
                size="small"
                inputProps={{ min: 1, max: 50 }}
                {...numberFieldProps("trainLengthMax", settings.trainLengthMax, (value) =>
                  updateSetting("trainLengthMax", Math.round(cleanNumber(value, settings.trainLengthMax, 1, 50)))
                )}
              />
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField
                label="Log min"
                type="number"
                size="small"
                inputProps={{ min: 1, max: 10 }}
                {...numberFieldProps("logLengthMin", settings.logLengthMin, (value) =>
                  updateSetting("logLengthMin", Math.round(cleanNumber(value, settings.logLengthMin, 1, 10)))
                )}
              />
              <TextField
                label="Log max"
                type="number"
                size="small"
                inputProps={{ min: 1, max: 10 }}
                {...numberFieldProps("logLengthMax", settings.logLengthMax, (value) =>
                  updateSetting("logLengthMax", Math.round(cleanNumber(value, settings.logLengthMax, 1, 10)))
                )}
              />
            </Stack>
            <Box>
              <Typography variant="caption">Granny driver speed: {settings.grannyDriverSpeed.toFixed(2)}x</Typography>
              <Slider
                min={0.5}
                max={1.5}
                step={0.01}
                value={settings.grannyDriverSpeed}
                onChange={(_, value) => updateSetting("grannyDriverSpeed", value as number)}
              />
            </Box>

            <Divider />

            <Typography variant="subtitle2" fontWeight={900}>Power Ups</Typography>
            {POWER_UP_TYPES.map((type) => (
              <Box key={type} className="crossy-power-setting">
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                  <Box>
                    <Typography fontWeight={850} sx={{ color: POWER_UP_DEFS[type].color === "#ffffff" ? "#111827" : POWER_UP_DEFS[type].color }}>
                      {POWER_UP_DEFS[type].label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{POWER_UP_DEFS[type].detail}</Typography>
                  </Box>
                  <FormControlLabel
                    label=""
                    control={
                      <Switch
                        checked={settings.powerUps[type].enabled}
                        onChange={(event) => updatePowerUpSetting(type, { enabled: event.target.checked })}
                      />
                    }
                  />
                </Stack>
                <TextField
                  label="Frequency weight"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ min: 1, max: 10, step: 1 }}
                  {...numberFieldProps(`powerUpFrequency-${type}`, settings.powerUps[type].frequency, (value) =>
                    updatePowerUpSetting(type, {
                      frequency: cleanNumber(value, settings.powerUps[type].frequency, 1, 10),
                    })
                  )}
                />
              </Box>
            ))}

            <Divider />

            <Button variant="contained" startIcon={<RestartAltIcon />} onClick={() => resetRun()}>
              Restart With Current Settings
            </Button>
          </Stack>
        </Box>
      </Drawer>
    </main>
  );
}
