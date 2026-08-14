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
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import MenuIcon from "@mui/icons-material/Menu";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ShuffleIcon from "@mui/icons-material/Shuffle";
import * as THREE from "three";
import "./CrossyRoad.css";

type LaneKind = "goal" | "grass" | "road" | "river" | "rail";
type Direction = "up" | "down" | "left" | "right";
type PlayerId = "duck" | "chicken";
type MovingAsset = "car" | "train" | "log";
type PowerUpType = "control" | "speed" | "life" | "jump" | "lightning";

type MovingThing = {
  id: string;
  start: number;
  length: number;
  asset: MovingAsset;
  color?: string;
};

type LaneDefinition = {
  row: number;
  kind: LaneKind;
  direction: 1 | -1;
  speed: number;
  things?: MovingThing[];
};

type RuntimeThing = MovingThing & {
  lane: LaneDefinition;
  x: number;
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
  accent: string;
  bodyColor: string;
  row: number;
  col: number;
  score: number;
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
  trainLengthMin: number;
  trainLengthMax: number;
  laneSeed: number;
  showDeathLog: boolean;
  powerUps: PowerUpSettings;
};

type BoardConfig = {
  cols: number;
  rows: number;
  startRow: number;
  halfCols: number;
  halfRows: number;
  startCols: Record<PlayerId, number>;
  clipPlanes: THREE.Plane[];
};

type PowerUpInstance = {
  id: string;
  type: PowerUpType;
  row: number;
  col: number;
  expiresAt: number;
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
const MIN_COLS = 7;
const MAX_COLS = 31;
const MIN_ROWS = 7;
const MAX_ROWS = 41;
const MAX_POWER_UPS_ON_BOARD = 3;
const POWER_UP_MIN_SECONDS = 30;
const POWER_UP_MAX_SECONDS = 60;
const POWER_UP_TYPES: PowerUpType[] = ["control", "speed", "life", "jump", "lightning"];

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
  trainLengthMin: 5,
  trainLengthMax: 7,
  laneSeed: 1,
  showDeathLog: false,
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
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function cleanNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, min, max);
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

function loadSettings(): GameSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;

  try {
    const saved = window.sessionStorage.getItem(SETTINGS_KEY);
    if (!saved) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(saved) as Partial<GameSettings>;
    const trainLengthMin = cleanNumber(parsed.trainLengthMin, DEFAULT_SETTINGS.trainLengthMin, 1, 50);
    const trainLengthMax = cleanNumber(parsed.trainLengthMax, DEFAULT_SETTINGS.trainLengthMax, 1, 50);

    return {
      cols: Math.round(cleanNumber(parsed.cols, DEFAULT_SETTINGS.cols, MIN_COLS, MAX_COLS)),
      rows: Math.round(cleanNumber(parsed.rows, DEFAULT_SETTINGS.rows, MIN_ROWS, MAX_ROWS)),
      carSpeed: cleanNumber(parsed.carSpeed, DEFAULT_SETTINGS.carSpeed, 0.1, 4),
      trainSpeed: cleanNumber(parsed.trainSpeed, DEFAULT_SETTINGS.trainSpeed, 0.1, 4),
      logSpeed: cleanNumber(parsed.logSpeed, DEFAULT_SETTINGS.logSpeed, 0.1, 4),
      moveCooldown: cleanNumber(parsed.moveCooldown, DEFAULT_SETTINGS.moveCooldown, 0, 2),
      trainLengthMin: Math.min(trainLengthMin, trainLengthMax),
      trainLengthMax: Math.max(trainLengthMin, trainLengthMax),
      laneSeed: cleanNumber(parsed.laneSeed, DEFAULT_SETTINGS.laneSeed, 1, 999999999),
      showDeathLog: parsed.showDeathLog ?? DEFAULT_SETTINGS.showDeathLog,
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
  const duckStart = clamp(Math.floor(cols / 2) - 1, 0, cols - 1);
  const chickenStart = clamp(Math.floor(cols / 2) + 1, 0, cols - 1);
  const halfCols = cols / 2;
  const halfRows = rows / 2;

  return {
    cols,
    rows,
    startRow: rows - 1,
    halfCols,
    halfRows,
    startCols: {
      duck: duckStart,
      chicken: chickenStart,
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
    const count = board.cols > 18 ? 2 : 1;

    return Array.from({ length: count }).map((_, index) => ({
      id: `train-${row}-${index}`,
      start: randomBetween(random, -maxLength, board.cols + maxLength) + index * (board.cols / count),
      length: Math.round(randomBetween(random, minLength, maxLength + 0.99)),
      asset: "train",
    }));
  }

  if (kind === "river") {
    const count = Math.max(2, Math.floor(board.cols / 5));
    return Array.from({ length: count }).map((_, index) => ({
      id: `log-${row}-${index}`,
      start: -2 + index * (board.cols / count) + randomBetween(random, -0.6, 0.9),
      length: randomBetween(random, 2.2, 3.9),
      asset: "log",
    }));
  }

  const carColors = ["#f6c945", "#e9504f", "#5da0f2", "#5fc47b", "#2f80ed"];
  const count = Math.max(2, Math.floor(board.cols / 4));
  return Array.from({ length: count }).map((_, index) => ({
    id: `car-${row}-${index}`,
    start: -1 + index * (board.cols / count) + randomBetween(random, -0.8, 0.8),
    length: randomBetween(random, 1.05, 1.35),
    asset: "car",
    color: carColors[(row + index) % carColors.length],
  }));
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

  return Array.from({ length: board.rows }).map((_, row) => {
    const direction: 1 | -1 = (row + Math.floor(settings.laneSeed)) % 2 === 0 ? 1 : -1;
    const isDefault = settings.laneSeed === DEFAULT_SETTINGS.laneSeed;
    const kind: LaneKind =
      row === 0
        ? "goal"
        : row === board.startRow
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

    const baseSpeed =
      kind === "road"
        ? randomBetween(random, 1.8, 3.05) * settings.carSpeed
        : kind === "rail"
        ? randomBetween(random, 6.3, 8.2) * settings.trainSpeed
        : kind === "river"
        ? randomBetween(random, 1.0, 1.75) * settings.logSpeed
        : 0;

    return {
      row,
      kind,
      direction,
      speed: baseSpeed,
      things: makeMovingThings(kind, row, direction, settings, board, random),
    };
  });
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

function getMovingX(thing: MovingThing, lane: LaneDefinition, seconds: number, board: BoardConfig) {
  const loopWidth = board.cols + thing.length + 6;
  return positiveModulo(thing.start + lane.direction * lane.speed * seconds + 3, loopWidth) - 3;
}

function getMovingThingsForLane(lane: LaneDefinition, seconds: number, board: BoardConfig): RuntimeThing[] {
  if (!lane.things) return [];
  return lane.things.map((thing) => ({
    ...thing,
    lane,
    x: getMovingX(thing, lane, seconds, board),
  }));
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
      player.id !== playerId &&
      Math.round(player.row) === row &&
      Math.round(player.col) === col,
  );
}

function findOpenStartCol(playerId: PlayerId, players: PlayerState[], board: BoardConfig) {
  const startCol = board.startCols[playerId];
  const offsets = Array.from({ length: board.cols }, (_, index) =>
    index === 0 ? 0 : index % 2 === 0 ? index / 2 : -(index + 1) / 2,
  );
  const openOffset = offsets.find((offset) => {
    const col = startCol + offset;
    return col >= 0 && col < board.cols && !getCellOccupant(players, playerId, board.startRow, col);
  });

  return clamp(startCol + (openOffset ?? 0), 0, board.cols - 1);
}

function copyPlayers(players: PlayerState[]) {
  return players.map((player) => ({ ...player }));
}

function makeInitialPlayers(board: BoardConfig): PlayerState[] {
  return (["duck", "chicken"] as PlayerId[]).map((id) => ({
    id,
    ...PLAYER_META[id],
    row: board.startRow,
    col: board.startCols[id],
    score: 0,
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
    row: board.startRow,
    col: findOpenStartCol(player.id, players, board),
    misses: player.misses + 1,
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
    const player = clearExpiredPlayerEffects(rawPlayer, timestamp);
    if (player.jump || timestamp < player.stunnedUntil) return player;

    const lane = getLane(lanes, Math.round(player.row));

    if (lane.kind === "goal") {
      messages.push(`${player.name} crossed the finish.`);
      return {
        ...player,
        row: board.startRow,
        col: findOpenStartCol(player.id, players, board),
        score: player.score + 75,
        laps: player.laps + 1,
        bestProgress: 0,
        stunnedUntil: timestamp + 650,
        facing: "up" as Direction,
      };
    }

    if (lane.kind === "river") {
      const log = getMovingThingsForLane(lane, seconds, board).find((thing) => isOnLog(player.col, thing));
      if (!log) {
        return restartPlayer(player, timestamp, messages, `${player.name} fell in the river.`, players, board);
      }

      const carriedCol = player.col + lane.direction * lane.speed * dt;
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

      const hazard = getMovingThingsForLane(lane, seconds, board).find((thing) => overlapsThing(player.col, thing));
      if (hazard) {
        if (player.activePowerUp?.type === "life") {
          messages.push(`${player.name}'s extra life blocked the hit.`);
          return {
            ...player,
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
  const candidateRows = safeRows.length > 0 ? safeRows : [board.startRow];

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const row = candidateRows[Math.floor(random() * candidateRows.length)];
    const col = Math.floor(random() * board.cols);
    const occupiedByPlayer = players.some(
      (player) => Math.round(player.row) === row && Math.round(player.col) === col,
    );
    const occupiedByPowerUp = powerUps.some((powerUp) => powerUp.row === row && powerUp.col === col);
    if (!occupiedByPlayer && !occupiedByPowerUp) return { row, col };
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
  let next = current.filter((powerUp) => seconds <= powerUp.expiresAt);
  let changed = next.length !== current.length;

  if (seconds < nextSpawnRef.current) return { powerUps: next, changed };

  nextSpawnRef.current = seconds + randomPowerUpSeconds(random);

  if (next.length >= MAX_POWER_UPS_ON_BOARD) return { powerUps: next, changed };

  const type = pickPowerUpType(settings, random);
  if (!type) return { powerUps: next, changed };

  const cell = findSpawnCell(lanes, board, players, next, random);
  if (!cell) return { powerUps: next, changed };

  next = [
    ...next,
    {
      id: makeId(type),
      type,
      ...cell,
      expiresAt: seconds + randomPowerUpSeconds(random),
    },
  ];
  changed = true;

  return { powerUps: next, changed };
}

function collectPowerUps(
  players: PlayerState[],
  powerUps: PowerUpInstance[],
  timestamp: number,
  messages: string[],
) {
  if (powerUps.length === 0) return { players, powerUps, changed: false };

  let changed = false;
  const collectedIds = new Set<string>();
  const nextPlayers = players.map((player) => {
    const collected = powerUps.find(
      (powerUp) =>
        powerUp.row === Math.round(player.row) &&
        powerUp.col === Math.round(player.col) &&
        !collectedIds.has(powerUp.id),
    );

    if (!collected) return player;
    collectedIds.add(collected.id);
    changed = true;
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
    const hazard = getMovingThingsForLane(lane, seconds, board).find((thing) => overlapsThing(col, thing, 0.1));
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
    chicken: null,
  });
  const glowRefs = useRef<Record<PlayerId, THREE.Mesh | null>>({
    duck: null,
    chicken: null,
  });

  useFrame(() => {
    const timestamp = performance.now();
    const board = boardRef.current;
    playersRef.current.forEach((player) => {
      const group = refs.current[player.id];
      if (!group) return;

      const position = getAnimatedPosition(player, timestamp, board);
      group.position.lerp(
        new THREE.Vector3(position.x, position.y, position.z),
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
    </>
  );
}

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
  return (
    <>
      {lanes.flatMap((lane) =>
        (lane.things ?? []).map((thing) => (
          <MovingThingGroup
            key={`${lane.row}-${thing.id}-${thing.length}`}
            thing={thing}
            lane={lane}
            secondsRef={secondsRef}
            boardRef={boardRef}
          />
        )),
      )}
    </>
  );
}

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

function PowerUpModels({
  powerUps,
  board,
}: {
  powerUps: PowerUpInstance[];
  board: BoardConfig;
}) {
  return (
    <>
      {powerUps.map((powerUp) => (
        <group
          key={powerUp.id}
          position={[
            worldXFromCenter(powerUp.col, board),
            0,
            worldZFromCenter(powerUp.row, board),
          ]}
        >
          <PowerUpAsset type={powerUp.type} />
        </group>
      ))}
    </>
  );
}

function LightningBeams({ players, board }: { players: PlayerState[]; board: BoardConfig }) {
  const now = performance.now();
  return (
    <>
      {players
        .filter((player) => player.lightning && now <= player.lightning.endsAt)
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

function CameraRig({ board }: { board: BoardConfig }) {
  const { camera, size } = useThree();

  useEffect(() => {
    const zoomBase = Math.min(36, Math.max(18, 520 / Math.max(board.cols, board.rows)));
    camera.position.set(board.halfCols + 2, 12 + board.rows * 0.08, board.halfRows + 5);
    camera.lookAt(0, 0, 0);

    if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom = size.width < 760 ? zoomBase * 0.76 : zoomBase;
      camera.near = 0.1;
      camera.far = 120;
      camera.updateProjectionMatrix();
    }
  }, [board.cols, board.halfCols, board.halfRows, board.rows, camera, size.width]);

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
}) {
  const lastSnapshotRef = useRef(0);

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
    const collected = collectPowerUps(players, powerUps, timestamp, messages);
    players = collected.players;
    powerUps = collected.powerUps;

    playersRef.current = players;
    if (spawned.changed || collected.changed) {
      powerUpsRef.current = powerUps;
      setPowerUps([...powerUps]);
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
  setPowerUps,
  onSnapshot,
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
  setPowerUps: (powerUps: PowerUpInstance[]) => void;
  onSnapshot: (players: PlayerState[], messages: string[]) => void;
}) {
  return (
    <>
      <color attach="background" args={["#b9ecff"]} />
      <fog attach="fog" args={["#b9ecff", 22, 38]} />
      <CameraRig board={board} />
      <ambientLight intensity={1.55} />
      <directionalLight position={[5, 10, 4]} intensity={2.2} />
      <hemisphereLight args={["#d7f7ff", "#314b28", 1.2]} />
      <group rotation={[0, 0, 0]}>
        <LaneSurfaces lanes={lanes} board={board} />
        <MovingObjects lanes={lanes} secondsRef={secondsRef} boardRef={boardRef} />
        <PowerUpModels powerUps={powerUps} board={board} />
        <PlayerModels playersRef={playersRef} boardRef={boardRef} />
        <LightningBeams players={playersRef.current} board={board} />
      </group>
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
      />
    </>
  );
}

function DPad({
  player,
  running,
  onMove,
}: {
  player: PlayerState;
  running: boolean;
  onMove: (playerId: PlayerId, rowDelta: number, colDelta: number) => void;
}) {
  return (
    <div className="crossy-pad" style={{ "--player-accent": player.accent } as React.CSSProperties}>
      <div className="crossy-pad-avatar">{player.id === "duck" ? "D" : "C"}</div>
      <button type="button" disabled={!running} aria-label={`${player.name} up`} onClick={() => onMove(player.id, -1, 0)}>
        ↑
      </button>
      <button type="button" disabled={!running} aria-label={`${player.name} left`} onClick={() => onMove(player.id, 0, -1)}>
        ←
      </button>
      <button type="button" disabled={!running} aria-label={`${player.name} down`} onClick={() => onMove(player.id, 1, 0)}>
        ↓
      </button>
      <button type="button" disabled={!running} aria-label={`${player.name} right`} onClick={() => onMove(player.id, 0, 1)}>
        →
      </button>
    </div>
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
  const lanes = useMemo(() => generateLanes(settings, board), [board, settings]);
  const [playersSnapshot, setPlayersSnapshot] = useState<PlayerState[]>(() => makeInitialPlayers(board));
  const [feed, setFeed] = useState<FeedItem[]>([{ id: "ready", text: "3D course loaded." }]);
  const [running, setRunning] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [powerUps, setPowerUpsState] = useState<PowerUpInstance[]>([]);

  const playersRef = useRef<PlayerState[]>(playersSnapshot);
  const powerUpsRef = useRef<PowerUpInstance[]>(powerUps);
  const runningRef = useRef(running);
  const settingsRef = useRef(settings);
  const boardRef = useRef(board);
  const lanesRef = useRef(lanes);
  const secondsRef = useRef(0);
  const randomRef = useRef(createSeededRandom(Date.now()));
  const nextSpawnRef = useRef(POWER_UP_MIN_SECONDS + Math.random() * (POWER_UP_MAX_SECONDS - POWER_UP_MIN_SECONDS));

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

  const resetRun = useCallback(
    (message = "New 3D run ready.") => {
      const nextPlayers = makeInitialPlayers(boardRef.current);
      playersRef.current = nextPlayers;
      powerUpsRef.current = [];
      secondsRef.current = 0;
      nextSpawnRef.current = randomPowerUpSeconds(randomRef.current);
      setPlayersSnapshot(copyPlayers(nextPlayers));
      setPowerUpsState([]);
      setFeed([{ id: "reset", text: message }]);
      setRunning(true);
    },
    [],
  );

  useEffect(() => {
    resetRun("Board rebuilt.");
  }, [board.cols, board.rows, settings.laneSeed, settings.trainLengthMax, settings.trainLengthMin, resetRun]);

  const movePlayer = useCallback(
    (playerId: PlayerId, rowDelta: number, colDelta: number) => {
      if (!runningRef.current) return;
      const timestamp = performance.now();
      const currentPlayers = playersRef.current.map((player) => clearExpiredPlayerEffects(player, timestamp));
      const actor = currentPlayers.find((player) => player.id === playerId);
      if (!actor || timestamp < actor.stunnedUntil) return;

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

      const progress = boardNow.startRow - nextRow;
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
      const control = KEYBOARD_CONTROLS[event.key.toLowerCase()];
      if (!control) return;
      event.preventDefault();
      movePlayer(control.playerId, control.rowDelta, control.colDelta);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [movePlayer]);

  const updateSetting = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    setSettings((current) => {
      const next = { ...current, [key]: value };
      if (key === "trainLengthMin" && Number(value) > current.trainLengthMax) {
        next.trainLengthMax = Number(value);
      }
      if (key === "trainLengthMax" && Number(value) < current.trainLengthMin) {
        next.trainLengthMin = Number(value);
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

  const now = performance.now();

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

      <section className="crossy-game-stage">
        <Canvas
          className="crossy-canvas"
          dpr={[1, 1.5]}
          orthographic
          camera={{ position: [8.5, 12, 13.5], zoom: 34, near: 0.1, far: 120 }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          frameloop="always"
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
            setPowerUps={setPowerUps}
            onSnapshot={updateSnapshot}
          />
        </Canvas>

        <div className="crossy-hud">
          {playersSnapshot.map((player) => (
            <div
              key={player.id}
              className="crossy-racer"
              style={{ "--player-accent": player.accent } as React.CSSProperties}
            >
              <span className="crossy-racer-token">{player.id === "duck" ? "D" : "C"}</span>
              <span className="crossy-racer-name">{player.name}</span>
              <strong className="crossy-racer-stat">Points {player.score}</strong>
              <span className="crossy-racer-stat">Flags {player.laps}</span>
              <span className="crossy-racer-stat">Misses {player.misses}</span>
              <span className="crossy-racer-stat crossy-racer-power">{activeLabel(player, now)}</span>
            </div>
          ))}
        </div>

        <aside className={settings.showDeathLog ? "crossy-side-panel" : "crossy-side-panel crossy-side-panel-compact"}>
          {settings.showDeathLog && (
            <div className="crossy-feed" aria-live="polite">
              {feed.map((item) => (
                <div key={item.id}>{item.text}</div>
              ))}
            </div>
          )}
          <div className="crossy-pads">
            {playersSnapshot.map((player) => (
              <DPad key={player.id} player={player} running={running} onMove={movePlayer} />
            ))}
          </div>
        </aside>
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
                  min={0.1}
                  max={4}
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
