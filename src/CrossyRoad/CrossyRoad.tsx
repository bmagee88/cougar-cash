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
  misses: number;
  bestProgress: number;
  stunnedUntil: number;
  facing: Direction;
  activePowerUp: ActivePowerUp | null;
  invincibleUntil: number;
  lastMoveAt: number;
  jump: TravelAnimation | null;
  lightning: TravelAnimation | null;
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
const CAMERA_PITCH_MIN = 0.34;
const CAMERA_PITCH_MAX = 1.38;
const CAMERA_PITCH_DEFAULT = 0.86;
const CAMERA_DIRECTION_PRESETS = [
  ["North", 0],
  ["East", Math.PI / 2],
  ["South", Math.PI],
  ["West", -Math.PI / 2],
] as const;
const CAMERA_TILT_PRESETS = [
  ["Top", CAMERA_PITCH_MAX],
  ["High", (CAMERA_PITCH_MAX + Math.PI / 4) / 2],
  ["45", Math.PI / 4],
  ["Low", (Math.PI / 4 + CAMERA_PITCH_MIN) / 2],
  ["Flat", CAMERA_PITCH_MIN],
] as const;
const POWER_UP_TYPES: PowerUpType[] = ["control", "speed", "life", "jump", "lightning"];
const SCORE_ITEM_TYPES: ScoreItemType[] = ["seeds", "bread", "flies", "carrot"];
const PLAYER_IDS: PlayerId[] = ["duck", "frog", "chicken", "rabbit"];
const SAFE_START_ROWS = 4;

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
      defaultZoom: cleanNumber(parsed.defaultZoom, DEFAULT_SETTINGS.defaultZoom, 0.55, 1.45),
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
    const minLength = Math.round(clamp(settings.trainLengthMin, 1, 50));
    const maxLength = Math.round(clamp(settings.trainLengthMax, minLength, 50));
    const count = board.cols > 18 && maxLength <= board.cols * 0.72 ? 2 : 1;
    const lengths = Array.from({ length: count }).map(() =>
      Math.floor(randomBetween(random, minLength, maxLength + 1)),
    );
    const loopLength = board.cols + maxLength + MOVING_OFFSCREEN_BUFFER * 2;
    const starts = makeSpacedStarts(lengths, loopLength, random);

    return starts.map((start, index) => ({
      id: `train-${row}-${index}`,
      start,
      length: maxLength,
      asset: "train",
      loopLength,
      speedMultiplier: randomBetween(random, 0.85, 1.15),
      lengthMin: minLength,
      lengthMax: maxLength,
      lengthSeed: row * 101 + index * 17 + settings.laneSeed,
    }));
  }

  if (kind === "river") {
    const minLength = settings.hardMode ? Math.round(clamp(settings.logLengthMin, 1, 10)) : 2.2;
    const maxLength = settings.hardMode
      ? Math.round(clamp(settings.logLengthMax, minLength, 10))
      : 3.9;
    const lengths = Array.from({ length: Math.max(2, Math.floor(board.cols / 5)) }).map(() =>
      settings.hardMode
        ? Math.floor(randomBetween(random, minLength, maxLength + 1))
        : randomBetween(random, minLength, maxLength),
    );
    const loopLength = board.cols + Math.max(...lengths) + MOVING_OFFSCREEN_BUFFER * 2;
    const starts = makeSpacedStarts(lengths, loopLength, random);

    return starts.map((start, index) => ({
      id: `log-${row}-${index}`,
      start,
      length: lengths[index],
      asset: "log",
      loopLength,
      speedMultiplier: settings.hardMode ? randomBetween(random, 0.85, 1.15) : 1,
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

function generateLanes(settings: GameSettings, board: BoardConfig): LaneDefinition[] {
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

    const baseSpeed =
      kind === "road"
        ? randomBetween(random, 1.8, 3.05) * settings.carSpeed
        : kind === "rail"
        ? 7.2 * settings.trainSpeed
        : kind === "river"
        ? randomBetween(random, 1.0, 1.75) * settings.logSpeed
        : 0;

    lanes.push({
      row,
      kind,
      direction,
      speed: baseSpeed,
      hardMode: settings.hardMode,
      things: makeMovingThings(kind, row, direction, settings, board, random),
    });
  }

  return lanes;
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

function worldXFromThing(thing: RuntimeThing, board: BoardConfig) {
  return thing.x + thing.length / 2 - board.halfCols;
}

function seededUnit(value: number) {
  return positiveModulo(Math.sin(value * 12.9898) * 43758.5453, 1);
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

function thingEnd(thing: RuntimeThing) {
  return thing.x + thing.length;
}

function intervalsOverlap(startA: number, endA: number, startB: number, endB: number, gap = 0.3) {
  return startA < endB + gap && endA > startB - gap;
}

function runtimeThingOccupiesRow(thing: RuntimeThing, row: number) {
  return thing.occupiedRows ? thing.occupiedRows.includes(row) : thing.lane.row === row;
}

function hasLaneSpace(
  lane: LaneDefinition,
  x: number,
  length: number,
  runtimeThings: RuntimeThing[],
  ignoreId: string,
) {
  return !runtimeThings.some(
    (thing) =>
      thing.asset === "car" &&
      thing.id !== ignoreId &&
      runtimeThingOccupiesRow(thing, lane.row) &&
      intervalsOverlap(x, x + length, thing.x, thingEnd(thing), 0.42),
  );
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

    if ((closeToFront || catchingFront) && thing.driver === "aggressive" && state.targetLaneRow == null) {
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

function resolveHardModeLogs(runtimeThings: RuntimeThing[], lanes: LaneDefinition[]) {
  const byLogRow = new Map<number, RuntimeThing[]>();
  const resolved = [...runtimeThings];

  resolved.forEach((thing) => {
    if (thing.asset !== "log") return;
    const rowThings = byLogRow.get(thing.lane.row) ?? [];
    rowThings.push(thing);
    byLogRow.set(thing.lane.row, rowThings);
  });

  byLogRow.forEach((logs, row) => {
    const lane = lanes[row];
    if (!lane) return;
    const sorted = [...logs].sort((a, b) => b.start - a.start);
    let front: RuntimeThing | null = null;
    sorted.forEach((log) => {
      const resolvedIndex = resolved.findIndex((thing) => thing.id === log.id);
      if (resolvedIndex < 0) return;
      let nextLog = resolved[resolvedIndex];
      const gap = 0.36;
      const wouldOverlap =
        front &&
        (lane.direction === 1
          ? nextLog.x + nextLog.length + gap > front.x
          : nextLog.x < front.x + front.length + gap);

      if (wouldOverlap && front) {
        nextLog = {
          ...nextLog,
          x:
            lane.direction === 1
              ? front.x - nextLog.length - gap
              : front.x + front.length + gap,
          speedMultiplier: front.speedMultiplier,
        };
        resolved[resolvedIndex] = nextLog;
      }

      if (!front) {
        front = nextLog;
        return;
      }

      const isAhead =
        lane.direction === 1
          ? nextLog.x + nextLog.length > front.x + front.length
          : nextLog.x < front.x;
      if (isAhead) front = nextLog;
    });
  });

  return resolved;
}

function resolveHardModeTraffic(
  runtimeThings: RuntimeThing[],
  lanes: LaneDefinition[],
  seconds: number,
  board: BoardConfig,
) {
  return resolveHardModeCars(resolveHardModeLogs(runtimeThings, lanes), lanes, seconds, board);
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
  return playerCenter >= thing.x + 0.08 && playerCenter <= thing.x + thing.length - 0.08;
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
    misses: 0,
    bestProgress: 0,
    stunnedUntil: 0,
    facing: "up" as Direction,
    activePowerUp: null,
    invincibleUntil: 0,
    lastMoveAt: -Infinity,
    jump: null,
    lightning: null,
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
    misses: 0,
    bestProgress: 0,
    stunnedUntil: 0,
    facing: "up",
    activePowerUp: null,
    invincibleUntil: 0,
    lastMoveAt: -Infinity,
    jump: null,
    lightning: null,
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
  };
}

function restartPlayer(
  player: PlayerState,
  timestamp: number,
  messages: string[],
  text: string,
  players: PlayerState[],
  board: BoardConfig,
) {
  messages.push(text);
  return {
    ...player,
    row: board.playerStartRow,
    col: findOpenStartCol(player.id, players, board),
    misses: player.misses + 1,
    score: player.score - 15,
    stunnedUntil: timestamp + 850,
    facing: "up" as Direction,
    jump: null,
    lightning: null,
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
) {
  return players.map((rawPlayer) => {
    if (!rawPlayer.joined) return rawPlayer;

    const player = clearExpiredPlayerEffects(rawPlayer, timestamp);
    if (player.jump || timestamp < player.stunnedUntil) return player;

    const lane = getLane(lanes, Math.round(player.row));

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
      };
    }

    if (lane.kind === "river") {
      const log = getMovingThingsForLane(lane, seconds, board, lanes).find((thing) => isOnLog(player.col, thing));
      if (!log) {
        return restartPlayer(player, timestamp, messages, `${player.name} fell in the river.`, players, board);
      }

      const carriedCol = player.col + lane.direction * lane.speed * (log.speedMultiplier ?? 1) * dt;
      if (carriedCol < -0.45 || carriedCol > board.cols - 0.55) {
        return restartPlayer(player, timestamp, messages, `${player.name} rode a log off the edge.`, players, board);
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
}

function isPickupCellOpen(
  row: number,
  col: number,
  board: BoardConfig,
  players: PlayerState[],
  powerUps: PowerUpInstance[],
) {
  if (row < 0 || row >= board.rows || col < 0 || col >= board.cols) return false;
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
    if (isPickupCellOpen(row, col, board, players, powerUps)) return { row, col };
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
    const row = grassRows.find((grassRow) => isPickupCellOpen(grassRow, col, board, players, powerUps));
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
}: {
  playersRef: MutableRefObject<PlayerState[]>;
  boardRef: MutableRefObject<BoardConfig>;
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
  const targetPositionRef = useRef(new THREE.Vector3());

  useFrame(() => {
    const timestamp = performance.now();
    const board = boardRef.current;
    playersRef.current.forEach((player) => {
      const group = refs.current[player.id];
      if (!group) return;

      if (!player.joined) {
        group.visible = false;
        const glow = glowRefs.current[player.id];
        if (glow) glow.visible = false;
        return;
      }

      const position = getAnimatedPosition(player, timestamp, board);
      const targetPosition = targetPositionRef.current.set(position.x, position.y, position.z);
      group.position.lerp(
        targetPosition,
        player.lightning ? 0.95 : player.jump ? 0.72 : 0.42,
      );
      group.rotation.y =
        player.facing === "up"
          ? 0
          : player.facing === "down"
          ? Math.PI
          : player.facing === "left"
          ? Math.PI / 2
          : -Math.PI / 2;
      group.visible = timestamp >= player.stunnedUntil || Math.sin(timestamp * 0.035) > 0;

      const glow = glowRefs.current[player.id];
      if (!glow) return;
      const glowColor = getPowerGlowColor(player, timestamp);
      glow.visible = Boolean(glowColor);
      if (glowColor && glow.material instanceof THREE.MeshBasicMaterial) {
        glow.material.color.set(glowColor);
        glow.material.opacity = glowColor === "#ffffff" ? 0.36 : 0.24;
      }
      glow.scale.setScalar(1 + Math.sin(timestamp * 0.01) * 0.08);
    });
  });

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

function TrainAsset({
  length,
  direction,
  clippingPlanes,
}: {
  length: number;
  direction: 1 | -1;
  clippingPlanes?: THREE.Plane[];
}) {
  const segmentCount = Math.max(1, Math.round(length / 1.45));
  const segmentLength = length / segmentCount;
  const start = -length / 2 + segmentLength / 2;

  return (
    <group rotation={[0, direction === 1 ? 0 : Math.PI, 0]}>
      {Array.from({ length: segmentCount }).map((_, index) => {
        const isEngine = index === segmentCount - 1;
        const x = start + index * segmentLength;
        return (
          <group key={index} position={[x, 0, 0]}>
            <Block
              color={isEngine ? "#27313d" : "#c53d36"}
              size={[segmentLength * 0.88, 0.52, 0.68]}
              position={[0, 0.38, 0]}
              metalness={0.08}
              clippingPlanes={clippingPlanes}
            />
            <Block color="#f1f5f9" size={[segmentLength * 0.44, 0.18, 0.06]} position={[0, 0.48, -0.37]} clippingPlanes={clippingPlanes} />
            <Block color="#171f2a" size={[segmentLength * 0.72, 0.12, 0.12]} position={[0, 0.15, -0.42]} clippingPlanes={clippingPlanes} />
            <Block color="#171f2a" size={[segmentLength * 0.72, 0.12, 0.12]} position={[0, 0.15, 0.42]} clippingPlanes={clippingPlanes} />
            {isEngine && (
              <>
                <Block color="#171f2a" size={[0.28, 0.28, 0.28]} position={[segmentLength * 0.25, 0.77, 0]} clippingPlanes={clippingPlanes} />
                <Block color="#f9d16a" size={[0.1, 0.12, 0.46]} position={[segmentLength * 0.46, 0.46, 0]} clippingPlanes={clippingPlanes} />
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

function MovingThingModel({
  thing,
  lane,
  board,
}: {
  thing: MovingThing;
  lane: LaneDefinition;
  board: BoardConfig;
}) {
  if (thing.asset === "train") {
    return <TrainAsset length={thing.length} direction={lane.direction} clippingPlanes={board.clipPlanes} />;
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

function MovingThingGroup({
  thing,
  lane,
  secondsRef,
  boardRef,
}: {
  thing: MovingThing;
  lane: LaneDefinition;
  secondsRef: MutableRefObject<number>;
  boardRef: MutableRefObject<BoardConfig>;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const board = boardRef.current;
    const runtimeThing: RuntimeThing = {
      ...thing,
      lane,
      x: getMovingX(thing, lane, secondsRef.current, board),
    };
    group.position.set(worldXFromThing(runtimeThing, board), 0, worldZFromCenter(lane.row, board));
  });

  return (
    <group ref={groupRef}>
      <MovingThingModel thing={thing} lane={lane} board={boardRef.current} />
    </group>
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
      group.scale.x = thing.length / Math.max(0.01, thing.asset === "train" ? thing.lengthMax ?? thing.length : thing.length);
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
            scale={[runtimeThing.length / Math.max(0.01, thing.asset === "train" ? thing.lengthMax ?? thing.length : thing.length), 1, 1]}
          >
            <MovingThingModel thing={thing} lane={lane} board={boardRef.current} />
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

function LaneSurfaces({ lanes, board }: { lanes: LaneDefinition[]; board: BoardConfig }) {
  return (
    <>
      {lanes.map((lane) => {
        if (lane.kind === "road") return <RoadLane key={lane.row} lane={lane} board={board} />;
        if (lane.kind === "river") return <RiverLane key={lane.row} lane={lane} board={board} />;
        if (lane.kind === "rail") return <RailLane key={lane.row} lane={lane} board={board} />;
        return <GrassLane key={lane.row} lane={lane} board={board} />;
      })}
      <Block color="#243729" size={[board.cols + 0.36, 0.3, 0.18]} position={[0, -0.05, -board.halfRows - 0.06]} />
      <Block color="#243729" size={[board.cols + 0.36, 0.3, 0.18]} position={[0, -0.05, board.halfRows + 0.06]} />
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
) {
  const framedPlayers = activePlayers(players);
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
}: {
  board: BoardConfig;
  playersRef: MutableRefObject<PlayerState[]>;
  settingsRef: MutableRefObject<GameSettings>;
  cameraYawRef: MutableRefObject<number>;
  cameraPitchRef: MutableRefObject<number>;
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
  }, [board, camera, cameraPitchRef, cameraYawRef, playersRef, settingsRef, size.width]);

  useFrame((_, delta) => {
    const frame = getCameraFrame(
      board,
      playersRef.current,
      size.width,
      settingsRef.current.defaultZoom,
      cameraYawRef.current,
      cameraPitchRef.current,
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
  settingsRef,
  lanesRef,
  boardRef,
  secondsRef,
  nextSpawnRef,
  randomRef,
  setPowerUps,
  onSnapshot,
  onLeaderboardProgress,
}: {
  playersRef: MutableRefObject<PlayerState[]>;
  powerUpsRef: MutableRefObject<PowerUpInstance[]>;
  runningRef: MutableRefObject<boolean>;
  settingsRef: MutableRefObject<GameSettings>;
  lanesRef: MutableRefObject<LaneDefinition[]>;
  boardRef: MutableRefObject<BoardConfig>;
  secondsRef: MutableRefObject<number>;
  nextSpawnRef: MutableRefObject<number>;
  randomRef: MutableRefObject<() => number>;
  setPowerUps: (powerUps: PowerUpInstance[]) => void;
  onSnapshot: (players: PlayerState[], messages: string[]) => void;
  onLeaderboardProgress: (previousPlayers: PlayerState[], nextPlayers: PlayerState[], elapsedMs: number) => void;
}) {
  const lastSnapshotRef = useRef(0);
  const lastLeaderboardRef = useRef(0);
  const leaderboardPlayersRef = useRef<PlayerState[]>(playersRef.current);
  const leaderboardElapsedRef = useRef(0);

  useFrame((state, delta) => {
    if (!runningRef.current) return;

    const dt = Math.min(delta, 0.06);
    const timestamp = performance.now();
    const messages: string[] = [];
    secondsRef.current += dt;

    let players = resolvePlayers(
      playersRef.current,
      lanesRef.current,
      boardRef.current,
      secondsRef.current,
      timestamp,
      dt,
      messages,
    );

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

    playersRef.current = players;
    if (spawned.changed || collected.changed) {
      powerUpsRef.current = powerUps;
      setPowerUps([...powerUps]);
    }

    leaderboardElapsedRef.current += dt * 1000;
    if (state.clock.elapsedTime - lastLeaderboardRef.current > 1) {
      lastLeaderboardRef.current = state.clock.elapsedTime;
      onLeaderboardProgress(leaderboardPlayersRef.current, playersRef.current, leaderboardElapsedRef.current);
      leaderboardPlayersRef.current = copyPlayers(playersRef.current);
      leaderboardElapsedRef.current = 0;
    }

    if (messages.length > 0 || state.clock.elapsedTime - lastSnapshotRef.current > 0.14) {
      lastSnapshotRef.current = state.clock.elapsedTime;
      onSnapshot(playersRef.current, messages);
    }
  });

  return null;
}

function CrossyScene({
  playersRef,
  powerUps,
  powerUpsRef,
  runningRef,
  settingsRef,
  lanes,
  lanesRef,
  board,
  boardRef,
  secondsRef,
  nextSpawnRef,
  randomRef,
  cameraYawRef,
  cameraPitchRef,
  setPowerUps,
  onSnapshot,
  onLeaderboardProgress,
}: {
  playersRef: MutableRefObject<PlayerState[]>;
  powerUps: PowerUpInstance[];
  powerUpsRef: MutableRefObject<PowerUpInstance[]>;
  runningRef: MutableRefObject<boolean>;
  settingsRef: MutableRefObject<GameSettings>;
  lanes: LaneDefinition[];
  lanesRef: MutableRefObject<LaneDefinition[]>;
  board: BoardConfig;
  boardRef: MutableRefObject<BoardConfig>;
  secondsRef: MutableRefObject<number>;
  nextSpawnRef: MutableRefObject<number>;
  randomRef: MutableRefObject<() => number>;
  cameraYawRef: MutableRefObject<number>;
  cameraPitchRef: MutableRefObject<number>;
  setPowerUps: (powerUps: PowerUpInstance[]) => void;
  onSnapshot: (players: PlayerState[], messages: string[]) => void;
  onLeaderboardProgress: (previousPlayers: PlayerState[], nextPlayers: PlayerState[], elapsedMs: number) => void;
}) {
  return (
    <>
      <color attach="background" args={["#b9ecff"]} />
      <fog attach="fog" args={["#b9ecff", 22, 38]} />
      <CameraRig
        board={board}
        playersRef={playersRef}
        settingsRef={settingsRef}
        cameraYawRef={cameraYawRef}
        cameraPitchRef={cameraPitchRef}
      />
      <ambientLight intensity={1.55} />
      <directionalLight position={[5, 10, 4]} intensity={2.2} />
      <hemisphereLight args={["#d7f7ff", "#314b28", 1.2]} />
      <MemoLaneSurfaces lanes={lanes} board={board} />
      <MemoMovingObjects lanes={lanes} secondsRef={secondsRef} boardRef={boardRef} />
      <PowerUpModels powerUps={powerUps} board={board} secondsRef={secondsRef} />
      <MemoPlayerModels playersRef={playersRef} boardRef={boardRef} />
      <LightningBeams players={playersRef.current} board={board} />
      <CrossyGameLoop
        playersRef={playersRef}
        powerUpsRef={powerUpsRef}
        runningRef={runningRef}
        settingsRef={settingsRef}
        lanesRef={lanesRef}
        boardRef={boardRef}
        secondsRef={secondsRef}
        nextSpawnRef={nextSpawnRef}
        randomRef={randomRef}
        setPowerUps={setPowerUps}
        onSnapshot={onSnapshot}
        onLeaderboardProgress={onLeaderboardProgress}
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
  const board = useMemo(() => createBoard(settings), [settings.cols, settings.rows]);
  const lanes = useMemo(
    () => generateLanes(settings, board),
    [
      board,
      settings.carSpeed,
      settings.grannyDriverSpeed,
      settings.hardMode,
      settings.laneSeed,
      settings.logLengthMax,
      settings.logLengthMin,
      settings.logSpeed,
      settings.trainLengthMax,
      settings.trainLengthMin,
      settings.trainSpeed,
    ],
  );
  const [playersSnapshot, setPlayersSnapshot] = useState<PlayerState[]>(() =>
    makeInitialPlayers(board, settings.playerNames),
  );
  const [feed, setFeed] = useState<FeedItem[]>([{ id: "ready", text: "3D course loaded." }]);
  const [running, setRunning] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [powerUps, setPowerUpsState] = useState<PowerUpInstance[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRecord[]>(() => readLeaderboard());
  const [leaderboardTab, setLeaderboardTab] = useState<LeaderboardTab>("rank");

  const playersRef = useRef<PlayerState[]>(playersSnapshot);
  const powerUpsRef = useRef<PowerUpInstance[]>(powerUps);
  const leaderboardRef = useRef<LeaderboardRecord[]>(leaderboard);
  const runningRef = useRef(running);
  const settingsRef = useRef(settings);
  const boardRef = useRef(board);
  const lanesRef = useRef(lanes);
  const secondsRef = useRef(0);
  const randomRef = useRef(createSeededRandom(Date.now()));
  const nextSpawnRef = useRef(POWER_UP_MIN_SECONDS + Math.random() * (POWER_UP_MAX_SECONDS - POWER_UP_MIN_SECONDS));
  const cameraYawRef = useRef(0);
  const cameraPitchRef = useRef(CAMERA_PITCH_DEFAULT);
  const pressedKeysRef = useRef(new Set<string>());
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
              misses: 0,
              bestProgress: 0,
              stunnedUntil: 0,
              facing: "up" as Direction,
              activePowerUp: null,
              invincibleUntil: 0,
              jump: null,
              lightning: null,
            }
          : player,
      );
      playersRef.current = nextPlayers;
      setSettings((current) => ({
        ...current,
        playerNames: {
          ...current.playerNames,
          [playerId]: defaultName,
        },
      }));
      updateSnapshot(nextPlayers);
    },
    [setLeaderboardRecords, updateSnapshot],
  );

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
      const nextPlayers = makeInitialPlayers(boardRef.current, settingsRef.current.playerNames).map((player) => ({
        ...player,
        joined: previousById[player.id]?.joined ?? true,
        name: previousById[player.id]?.joined
          ? previousById[player.id]?.name ?? player.name
          : DEFAULT_PLAYER_NAMES[player.id],
        profileName: previousById[player.id]?.joined ? previousById[player.id]?.profileName ?? null : null,
      }));
      playersRef.current = nextPlayers;
      powerUpsRef.current = [];
      secondsRef.current = 0;
      nextSpawnRef.current = randomPowerUpSeconds(randomRef.current);
      setPlayersSnapshot(copyPlayers(nextPlayers));
      setPowerUpsState([]);
      setFeed([{ id: "reset", text: message }]);
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
      const timestamp = performance.now();
      const currentPlayers = playersRef.current.map((player) => clearExpiredPlayerEffects(player, timestamp));
      const actor = currentPlayers.find((player) => player.id === playerId);
      if (!actor) return;

      if (!actor.joined) {
        if (rowDelta !== -1 || colDelta !== 0) return;
        const nextPlayers = currentPlayers.map((player) =>
          player.id === actor.id ? resetPlayerForJoin(player, boardRef.current, currentPlayers) : player,
        );
        playersRef.current = nextPlayers;
        setSettings((current) => ({
          ...current,
          playerNames: {
            ...current.playerNames,
            [actor.id]: DEFAULT_PLAYER_NAMES[actor.id],
          },
        }));
        updateSnapshot(nextPlayers);
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
        nextRow = clamp(Math.round(actor.row) + rowDelta * moveDistance, 0, boardNow.startRow);
        nextCol = clamp(Math.round(actor.col) + colDelta * moveDistance, 0, boardNow.cols - 1);
        if (moveDistance === 2) {
          jump = {
            fromCol: Math.round(actor.col),
            fromRow: Math.round(actor.row),
            toCol: nextCol,
            toRow: nextRow,
            startedAt: timestamp,
            endsAt: timestamp + 500,
          };
        }
      }

      const blocker = getCellOccupant(currentPlayers, actor.id, nextRow, nextCol);
      let pushedPlayer: PlayerState | null = null;
      if (blocker) {
        const pushRow = Math.round(blocker.row) + rowDelta;
        const pushCol = Math.round(blocker.col) + colDelta;
        const canShove =
          actor.activePowerUp?.type === "control" &&
          !blocker.jump &&
          pushRow >= 0 &&
          pushRow <= boardNow.startRow &&
          pushCol >= 0 &&
          pushCol < boardNow.cols &&
          !getCellOccupant(currentPlayers, blocker.id, pushRow, pushCol);

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
    [updateSnapshot],
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

  const updatePlayerName = useCallback((playerId: PlayerId, value: string) => {
    setSettings((current) => ({
      ...current,
      playerNames: {
        ...current.playerNames,
        [playerId]: cleanPlayerName(value, current.playerNames[playerId] ?? DEFAULT_PLAYER_NAMES[playerId]),
      },
    }));
  }, []);

  const snapCameraDirection = useCallback((yaw: number) => {
    cameraYawRef.current = yaw;
  }, []);

  const snapCameraTilt = useCallback((pitch: number) => {
    cameraPitchRef.current = pitch;
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

  const now = performance.now();
  const leaderboardRows = rankedLeaderboard(leaderboard, leaderboardTab);

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

  return (
    <main className="crossy-road-shell">
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
          <button type="button" onClick={() => setRunning((value) => !value)}>
            {running ? "Pause" : "Play"}
          </button>
          <button type="button" onClick={() => resetRun()}>
            New Run
          </button>
        </div>
      </header>

      <section className="crossy-play-layout">
        <aside className="crossy-left-panel">
          <div className="crossy-scoreboard">
            {playersSnapshot.map((player) => (
              <div
                key={player.id}
                className={`crossy-racer${player.joined ? "" : " crossy-racer-empty"}`}
                style={{ "--player-accent": player.accent } as React.CSSProperties}
                title={player.joined ? activeLabel(player, now) : `press ${PLAYER_UP_KEYS[player.id]} to join`}
              >
                {player.joined ? (
                  <>
                    <span className="crossy-racer-token" aria-label={`${player.name} icon`}>
                      {animalIcon(player.id)}
                    </span>
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
            ))}
          </div>
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
          {settings.showDeathLog && (
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
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              rotationDragRef.current = {
                active: true,
                lastX: event.clientX,
                lastY: event.clientY,
                pointerId: event.pointerId,
              };
              event.currentTarget.setPointerCapture?.(event.pointerId);
            }}
            onPointerMove={(event) => {
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
            }}
            onPointerUp={stopRotationDrag}
            onPointerLeave={stopRotationDrag}
            onCreated={({ gl }) => {
              gl.localClippingEnabled = true;
            }}
          >
            <CrossyScene
              playersRef={playersRef}
              powerUps={powerUps}
              powerUpsRef={powerUpsRef}
              runningRef={runningRef}
              settingsRef={settingsRef}
              lanes={lanes}
              lanesRef={lanesRef}
              board={board}
              boardRef={boardRef}
              secondsRef={secondsRef}
              nextSpawnRef={nextSpawnRef}
              randomRef={randomRef}
              cameraYawRef={cameraYawRef}
              cameraPitchRef={cameraPitchRef}
              setPowerUps={setPowerUps}
              onSnapshot={updateSnapshot}
              onLeaderboardProgress={updateLeaderboardProgress}
            />
          </Canvas>
        </section>
      </section>

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
                value={settings.rows}
                inputProps={{ min: MIN_ROWS, max: MAX_ROWS }}
                onChange={(event) => updateSetting("rows", Math.round(cleanNumber(event.target.value, settings.rows, MIN_ROWS, MAX_ROWS)))}
              />
              <TextField
                label="Width"
                type="number"
                size="small"
                value={settings.cols}
                inputProps={{ min: MIN_COLS, max: MAX_COLS }}
                onChange={(event) => updateSetting("cols", Math.round(cleanNumber(event.target.value, settings.cols, MIN_COLS, MAX_COLS)))}
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
              value={settings.moveCooldown}
              inputProps={{ min: 0, max: 2, step: 0.05 }}
              onChange={(event) => updateSetting("moveCooldown", cleanNumber(event.target.value, settings.moveCooldown, 0, 2))}
            />
            <Box>
              <Typography variant="caption">Default zoom: {settings.defaultZoom.toFixed(2)}x</Typography>
              <Slider
                min={0.55}
                max={1.45}
                step={0.05}
                value={settings.defaultZoom}
                onChange={(_, value) => updateSetting("defaultZoom", value as number)}
              />
            </Box>
            <Box>
              <Typography variant="caption">Camera direction</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {CAMERA_DIRECTION_PRESETS.map(([label, yaw]) => (
                  <Button key={label} size="small" variant="outlined" onClick={() => snapCameraDirection(yaw)}>
                    {label}
                  </Button>
                ))}
              </Stack>
            </Box>
            <Box>
              <Typography variant="caption">Camera tilt</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {CAMERA_TILT_PRESETS.map(([label, pitch]) => (
                  <Button key={label} size="small" variant="outlined" onClick={() => snapCameraTilt(pitch)}>
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
                value={settings.trainLengthMin}
                inputProps={{ min: 1, max: 50 }}
                onChange={(event) => updateSetting("trainLengthMin", Math.round(cleanNumber(event.target.value, settings.trainLengthMin, 1, 50)))}
              />
              <TextField
                label="Train max"
                type="number"
                size="small"
                value={settings.trainLengthMax}
                inputProps={{ min: 1, max: 50 }}
                onChange={(event) => updateSetting("trainLengthMax", Math.round(cleanNumber(event.target.value, settings.trainLengthMax, 1, 50)))}
              />
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField
                label="Log min"
                type="number"
                size="small"
                value={settings.logLengthMin}
                inputProps={{ min: 1, max: 10 }}
                onChange={(event) => updateSetting("logLengthMin", Math.round(cleanNumber(event.target.value, settings.logLengthMin, 1, 10)))}
              />
              <TextField
                label="Log max"
                type="number"
                size="small"
                value={settings.logLengthMax}
                inputProps={{ min: 1, max: 10 }}
                onChange={(event) => updateSetting("logLengthMax", Math.round(cleanNumber(event.target.value, settings.logLengthMax, 1, 10)))}
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
                  value={settings.powerUps[type].frequency}
                  inputProps={{ min: 1, max: 10, step: 1 }}
                  onChange={(event) =>
                    updatePowerUpSetting(type, {
                      frequency: cleanNumber(event.target.value, settings.powerUps[type].frequency, 1, 10),
                    })
                  }
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
