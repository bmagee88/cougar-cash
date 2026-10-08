import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppBar,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Modal,
  Select,
  Slider,
  Stack,
  Switch,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import LeaderboardIcon from "@mui/icons-material/Leaderboard";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import { keyframes } from "@emotion/react";

type HomeKey = {
  key: string;
  label: string;
  targetLabel: string;
  color: string;
  widthUnits?: number;
};

type Note = {
  id: number;
  laneIndex: number;
  targetTime: number;
  createdAt: number;
  animationDelayMs: number;
};

type TempoMarker = {
  id: number;
  targetTime: number;
  animationDelayMs: number;
  leftLaneIndex: number;
  rightLaneIndex: number;
};

type TimingEventOptions = {
  accent?: boolean;
  missNoteId?: number;
  sound?: boolean;
};

type ScheduledTimingEvent = {
  targetTime: number;
  options: TimingEventOptions;
  timeoutId?: number;
};

type ResponsiveSize = {
  xs: number;
  sm: number;
  md: number;
};

type RhythmMode = "whole" | "half" | "quarter" | "backbeat" | "syncopated" | "burst";
type LeagueMode = "bronze" | "silver" | "gold" | "platinum" | "titanium";
type GameMode = "balanced" | "balancedPlus" | "progressive" | "custom" | LeagueMode;
type BalancedPlusOutcome = "hit" | "missed" | "wrong";
type BalancedTimeMode = "unlimited" | "climb" | "double";
type LeaderboardView = "leaderboard" | "recent";
type RoundResult = "lost" | "complete" | null;

type LeaguePreset = {
  label: string;
  color: string;
  tempo: number;
  startingHearts: number;
  healComboTarget: number;
};

type LeaderboardEntry = {
  id: string;
  score: number;
  mode: string;
  keys: string;
  maxTempo: number;
  correct: number;
  missed: number;
  wrong: number;
  date: string;
};

const HOME_KEYS: HomeKey[] = [
  { key: "a", label: "A", targetLabel: "A", color: "#ec4899" },
  { key: "s", label: "S", targetLabel: "S", color: "#facc15" },
  { key: "d", label: "D", targetLabel: "D", color: "#f97316" },
  { key: "f", label: "F", targetLabel: "F", color: "#22c55e" },
  { key: " ", label: "Space", targetLabel: "Space", color: "#3b82f6", widthUnits: 2 },
  { key: "j", label: "J", targetLabel: "J", color: "#22c55e" },
  { key: "k", label: "K", targetLabel: "K", color: "#f97316" },
  { key: "l", label: "L", targetLabel: "L", color: "#facc15" },
  { key: ";", label: ";", targetLabel: ";", color: "#ec4899" },
];

const DEFAULT_ACTIVE_KEYS = ["d", "f", "j", "k"];
const MIN_ACTIVE_KEYS = 2;
const MAX_RANDOM_ACTIVE_KEYS = HOME_KEYS.length;
const ALL_HOME_KEY_VALUES = HOME_KEYS.map((homeKey) => homeKey.key);
const TEMPO_MIN = 48;
const TEMPO_MAX = 300;
const MIN_STARTING_HEARTS = 3;
const MAX_STARTING_HEARTS = 40;
const MIN_HEAL_COMBO_TARGET = 3;
const MAX_HEAL_COMBO_TARGET = 60;
const FALL_DURATION_MS = 2600;
const POST_TARGET_FALL_MS = 700;
const NOTE_ANIMATION_DURATION_MS = FALL_DURATION_MS + POST_TARGET_FALL_MS;
const SCHEDULE_TICK_MS = 140;
const SCHEDULE_LOOKAHEAD_BEATS = 2;
const SLOW_TEMPO_HIT_WINDOW_MS = 540;
const FAST_TEMPO_HIT_WINDOW_MS = 190;
const HIT_LINE_PERCENT = 74;
const BALANCED_START_TEMPO = 80;
const PROGRESSIVE_START_TEMPO = 65;
const PROGRESSIVE_TEMPO_STEP = 5;
const LEVEL_DURATION_MS = 15000;
const WRONG_KEY_TEMPO_FLOOR = 60;
const BALANCED_HIT_TEMPO_REWARD = 1;
const BALANCED_MISS_TEMPO_PENALTY = 1;
const BALANCED_WRONG_TEMPO_PENALTY = 3;
const BALANCED_PLUS_WINDOW_SIZE = 30;
const BALANCED_PLUS_MIN_SAMPLE = 8;
const BALANCED_PLUS_RECENT_WINDOW = 6;
const HEART_REGEN_COMBO_TARGET = 5;
const FRACTIONAL_MISSED_HEART_LOSS = 0.2;
const DDR_LEADERBOARD_KEY = "typingDdrLeaderboard";
const DDR_ACTIVE_KEYS_KEY = "typingDdrActiveKeys";

const BALANCED_TIME_MODES: { value: BalancedTimeMode; label: string }[] = [
  { value: "unlimited", label: "Unlimited" },
  { value: "climb", label: "Climb" },
  { value: "double", label: "Double" },
];
const MUTED_CURSOR =
  'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22%3E%3Cpath d=%22M4 3l14 14%22 stroke=%22rgba(248,113,113,0.45)%22 stroke-width=%223%22 stroke-linecap=%22round%22/%3E%3Cpath d=%22M5 4l4 15 3-6 6-3z%22 fill=%22rgba(248,113,113,0.24)%22 stroke=%22rgba(248,113,113,0.42)%22 stroke-width=%221.5%22/%3E%3C/svg%3E") 4 3, auto';

const RHYTHM_PATTERNS: Record<RhythmMode, { label: string; offsets: number[] }> = {
  whole: { label: "Whole", offsets: [0] },
  half: { label: "Half", offsets: [0, 2] },
  quarter: { label: "Quarter", offsets: [0, 1, 2, 3] },
  backbeat: { label: "Backbeat", offsets: [1, 3] },
  syncopated: { label: "Syncopated", offsets: [0, 0.75, 1.5, 2.5, 3.25] },
  burst: { label: "Burst", offsets: [0, 0.5, 1.5, 2, 2.5, 3.5] },
};

const RHYTHM_INTENSITY: Record<RhythmMode, number> = {
  whole: 0,
  half: 0.14,
  quarter: 0.28,
  backbeat: 0.34,
  syncopated: 0.62,
  burst: 0.7,
};

const LEAGUE_ORDER: LeagueMode[] = ["bronze", "silver", "gold", "platinum", "titanium"];

const LEAGUE_PRESETS: Record<LeagueMode, LeaguePreset> = {
  bronze: {
    label: "Bronze",
    color: "#cd7f32",
    tempo: 80,
    startingHearts: 12,
    healComboTarget: HEART_REGEN_COMBO_TARGET,
  },
  silver: {
    label: "Silver",
    color: "#cbd5e1",
    tempo: 120,
    startingHearts: 10,
    healComboTarget: HEART_REGEN_COMBO_TARGET,
  },
  gold: {
    label: "Gold",
    color: "#facc15",
    tempo: 160,
    startingHearts: 8,
    healComboTarget: HEART_REGEN_COMBO_TARGET,
  },
  platinum: {
    label: "Platinum",
    color: "#7dd3fc",
    tempo: 220,
    startingHearts: 6,
    healComboTarget: HEART_REGEN_COMBO_TARGET,
  },
  titanium: {
    label: "Titanium",
    color: "#a78bfa",
    tempo: 300,
    startingHearts: 4,
    healComboTarget: HEART_REGEN_COMBO_TARGET,
  },
};

const PROGRESSIVE_PRESET: LeaguePreset = {
  ...LEAGUE_PRESETS.bronze,
  label: "Progressive",
  tempo: PROGRESSIVE_START_TEMPO,
  healComboTarget: HEART_REGEN_COMBO_TARGET,
};

const BALANCED_PRESET: LeaguePreset = {
  ...LEAGUE_PRESETS.bronze,
  label: "Balanced",
  color: "#38d9a9",
  tempo: BALANCED_START_TEMPO,
  healComboTarget: HEART_REGEN_COMBO_TARGET,
};

const BALANCED_PLUS_PRESET: LeaguePreset = {
  ...BALANCED_PRESET,
  label: "Balanced+",
  color: "#7dd3fc",
};

const MODE_LABELS: Record<GameMode, string> = {
  balanced: "Balanced",
  balancedPlus: "Balanced+",
  progressive: "Progressive",
  custom: "Custom",
  bronze: LEAGUE_PRESETS.bronze.label,
  silver: LEAGUE_PRESETS.silver.label,
  gold: LEAGUE_PRESETS.gold.label,
  platinum: LEAGUE_PRESETS.platinum.label,
  titanium: LEAGUE_PRESETS.titanium.label,
};

const LEADERBOARD_MODE_LABELS = [
  MODE_LABELS.balancedPlus,
  MODE_LABELS.balanced,
  MODE_LABELS.progressive,
  ...LEAGUE_ORDER.map((leagueMode) => MODE_LABELS[leagueMode]),
  MODE_LABELS.custom,
];
const LEADERBOARD_VIEW_OPTIONS: LeaderboardView[] = ["leaderboard", "recent"];

const targetPulse = keyframes`
  0% {
    transform: translate(-50%, -50%) scale(1);
    box-shadow: var(--target-rest-shadow);
    filter: brightness(1);
  }
  42% {
    transform: translate(-50%, -50%) scale(1.12);
    box-shadow: var(--target-pulse-shadow);
    filter: brightness(1.8);
  }
  100% {
    transform: translate(-50%, -50%) scale(1);
    box-shadow: var(--target-rest-shadow);
    filter: brightness(1);
  }
`;

const mistakeFlash = keyframes`
  0% { box-shadow: inset 0 0 0 999px rgba(255, 107, 107, 0.22); }
  100% { box-shadow: inset 0 0 0 999px rgba(255, 107, 107, 0); }
`;

const comboPulse = keyframes`
  0% { transform: scale(1); }
  38% { transform: scale(1.12); }
  100% { transform: scale(1); }
`;

const randomKeyFade = keyframes`
  0% { opacity: 0; }
  48% { opacity: 1; }
  58% { opacity: 1; }
  100% { opacity: 0; }
`;

const tempoStepPulse = keyframes`
  0% {
    opacity: 0;
    transform: translateY(3px) scale(0.92);
  }
  22% {
    opacity: 1;
    transform: translateY(0) scale(1.16);
  }
  64% {
    opacity: 0.86;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-3px) scale(1);
  }
`;

const tempoMarkerFall = keyframes`
  0% {
    opacity: 0;
    transform: translate3d(0, -80px, 0);
  }
  8% {
    opacity: 0.9;
  }
  100% {
    opacity: 0.9;
    transform: translate3d(0, var(--note-end-y), 0);
  }
`;

const noteFall = keyframes`
  0% {
    opacity: 0;
    transform: translate3d(-50%, -80px, 0) scale(0.96);
  }
  8% {
    opacity: 1;
  }
  100% {
    opacity: 1;
    transform: translate3d(-50%, var(--note-end-y), 0) scale(1);
  }
`;

const noteColumns = {
  xs: "repeat(4, minmax(26px, 1fr)) minmax(52px, 2fr) repeat(4, minmax(26px, 1fr))",
  sm: "repeat(4, minmax(42px, 1fr)) minmax(84px, 2fr) repeat(4, minmax(42px, 1fr))",
  md: "repeat(4, minmax(54px, 1fr)) minmax(108px, 2fr) repeat(4, minmax(54px, 1fr))",
};

function getLaneGridColumn(laneIndex: number) {
  return laneIndex + 1;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isBalancedPracticeMode(gameMode: GameMode) {
  return gameMode === "balanced" || gameMode === "balancedPlus";
}

function scaleSize(size: ResponsiveSize, multiplier: number): ResponsiveSize {
  return {
    xs: Math.round(size.xs * multiplier),
    sm: Math.round(size.sm * multiplier),
    md: Math.round(size.md * multiplier),
  };
}

function scaleResponsiveSize(size: ResponsiveSize, multiplier: number): ResponsiveSize {
  return {
    xs: Math.max(1, Math.round(size.xs * multiplier)),
    sm: Math.max(1, Math.round(size.sm * multiplier)),
    md: Math.max(1, Math.round(size.md * multiplier)),
  };
}

function getComboMultiplier(comboCount: number) {
  return 1 + Math.max(0, comboCount) * 0.01;
}

function calculateHitScore(activeKeyCount: number, tempoIntensity: number, rhythmIntensity: number, comboCount: number) {
  const keyFactor = Math.pow(clamp(activeKeyCount, 1, HOME_KEYS.length), 1.15);
  const tempoFactor = 0.85 + tempoIntensity * 1.35;
  const rhythmFactor = 0.9 + rhythmIntensity * 1.25;
  const comboFactor = getComboMultiplier(comboCount);

  return Math.max(1, Math.round(3 * keyFactor * tempoFactor * rhythmFactor * comboFactor));
}

function getLevelDurationMs() {
  return LEVEL_DURATION_MS;
}

function getExpectedNotesInWindow(tempo: number, rhythmMode: RhythmMode, windowMs: number) {
  const beatMs = 60000 / tempo;
  const barMs = beatMs * 4;
  const notesPerBar = RHYTHM_PATTERNS[rhythmMode].offsets.length;
  return Math.max(1, Math.floor((windowMs / barMs) * notesPerBar));
}

function getProgressiveHealComboTarget(tempo: number, rhythmMode: RhythmMode, startingHearts: number) {
  const notesInWindow = getExpectedNotesInWindow(tempo, rhythmMode, LEVEL_DURATION_MS);
  return Math.max(1, Math.floor(notesInWindow / Math.max(1, startingHearts)));
}

function getBalancedClimbMs(gameMode: GameMode) {
  let nowMs = 0;
  let tempo = BALANCED_START_TEMPO;
  let nextBarStart = 0;
  let hitCount = 0;
  const targetTimes: number[] = [];
  const needsBalancedPlusWarmup = gameMode === "balancedPlus";

  while (tempo < TEMPO_MAX && nowMs < 10 * 60 * 1000) {
    const beatMs = 60000 / tempo;
    if (nextBarStart === 0 || nextBarStart < nowMs + beatMs) {
      nextBarStart = nowMs + FALL_DURATION_MS + beatMs;
    }

    const horizon = nowMs + FALL_DURATION_MS + beatMs * SCHEDULE_LOOKAHEAD_BEATS;
    while (nextBarStart < horizon) {
      const barStart = nextBarStart;
      RHYTHM_PATTERNS.quarter.offsets.forEach((offset) => {
        targetTimes.push(barStart + offset * beatMs);
      });
      nextBarStart = barStart + beatMs * 4;
    }

    targetTimes.sort((a, b) => a - b);
    while (targetTimes.length > 0 && targetTimes[0] <= nowMs && tempo < TEMPO_MAX) {
      targetTimes.shift();
      hitCount += 1;
      if (!needsBalancedPlusWarmup || hitCount >= BALANCED_PLUS_MIN_SAMPLE) {
        tempo += BALANCED_HIT_TEMPO_REWARD;
      }
    }

    nowMs += SCHEDULE_TICK_MS;
  }

  return Math.ceil(nowMs / 1000) * 1000;
}

function getBalancedTimeLimitMs(timeMode: BalancedTimeMode, gameMode: GameMode = "balancedPlus") {
  if (timeMode === "unlimited") return null;
  const climbMs = getBalancedClimbMs(gameMode);
  return timeMode === "double" ? climbMs * 2 : climbMs;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getLeagueModeForTempo(tempo: number) {
  let leagueMode = LEAGUE_ORDER[0];
  LEAGUE_ORDER.forEach((mode) => {
    if (tempo >= LEAGUE_PRESETS[mode].tempo) {
      leagueMode = mode;
    }
  });
  return leagueMode;
}

function getBasePresetForMode(gameMode: GameMode) {
  if (gameMode === "custom") return null;
  if (gameMode === "balanced") return BALANCED_PRESET;
  if (gameMode === "balancedPlus") return BALANCED_PLUS_PRESET;
  if (gameMode === "progressive") return PROGRESSIVE_PRESET;
  return LEAGUE_PRESETS[gameMode];
}

function getDisplayPresetForMode(gameMode: GameMode, progressiveTempo: number) {
  if (gameMode === "custom") return null;
  if (gameMode === "balanced") return BALANCED_PRESET;
  if (gameMode === "balancedPlus") return BALANCED_PLUS_PRESET;
  if (gameMode === "progressive") return LEAGUE_PRESETS[getLeagueModeForTempo(progressiveTempo)];
  return LEAGUE_PRESETS[gameMode];
}

function formatKeyList(keys: string[]) {
  return HOME_KEYS.filter((homeKey) => keys.includes(homeKey.key))
    .map((homeKey) => homeKey.label)
    .join(" ");
}

function getOrderedHomeKeys(keys: string[]) {
  const selectedKeys = new Set(keys);
  return HOME_KEYS.map((homeKey) => homeKey.key).filter((key) => selectedKeys.has(key));
}

function loadDdrActiveKeys() {
  if (typeof window === "undefined") return DEFAULT_ACTIVE_KEYS;

  try {
    const stored = window.localStorage.getItem(DDR_ACTIVE_KEYS_KEY);
    if (!stored) return DEFAULT_ACTIVE_KEYS;
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed) || !parsed.every((key) => typeof key === "string")) {
      return DEFAULT_ACTIVE_KEYS;
    }

    const orderedKeys = getOrderedHomeKeys(parsed);
    return orderedKeys.length >= MIN_ACTIVE_KEYS ? orderedKeys : DEFAULT_ACTIVE_KEYS;
  } catch {
    return DEFAULT_ACTIVE_KEYS;
  }
}

function saveDdrActiveKeys(keys: string[]) {
  if (typeof window === "undefined") return;

  const orderedKeys = getOrderedHomeKeys(keys);
  if (orderedKeys.length < MIN_ACTIVE_KEYS) return;
  window.localStorage.setItem(DDR_ACTIVE_KEYS_KEY, JSON.stringify(orderedKeys));
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    tag === "button" ||
    tag === "a" ||
    target.isContentEditable ||
    target.closest('[role="button"], [role="slider"], [role="combobox"]') !== null
  );
}

function getRandomLane(activeLaneIndexes: number[], lastLane: number | null) {
  if (activeLaneIndexes.length === 0) return 0;
  if (activeLaneIndexes.length === 1) return activeLaneIndexes[0];

  const candidates = activeLaneIndexes.filter((lane) => lane !== lastLane);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function getRandomHomeKeys(count: number) {
  const keys = [...ALL_HOME_KEY_VALUES];
  for (let index = keys.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [keys[index], keys[swapIndex]] = [keys[swapIndex], keys[index]];
  }

  const selectedKeys = new Set(keys.slice(0, clamp(count, MIN_ACTIVE_KEYS, MAX_RANDOM_ACTIVE_KEYS)));
  return HOME_KEYS.map((homeKey) => homeKey.key).filter((key) => selectedKeys.has(key));
}

function normalizeDdrLeaderboardEntries(entries: LeaderboardEntry[]) {
  const validEntries = entries.filter(
    (entry) =>
      typeof entry.id === "string" &&
      typeof entry.score === "number" &&
      typeof entry.mode === "string" &&
      typeof entry.date === "string"
  );
  const topEntriesByMode = LEADERBOARD_MODE_LABELS.flatMap((modeLabel) =>
    validEntries
      .filter((entry) => entry.mode === modeLabel)
      .sort((a, b) => b.score - a.score || new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10)
  );
  const recentEntries = [...validEntries]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
  const entryMap = new Map<string, LeaderboardEntry>();

  [...topEntriesByMode, ...recentEntries].forEach((entry) => {
    entryMap.set(entry.id, entry);
  });

  return Array.from(entryMap.values());
}

function loadDdrLeaderboard() {
  if (typeof window === "undefined") return [] as LeaderboardEntry[];

  try {
    const stored = window.localStorage.getItem(DDR_LEADERBOARD_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as LeaderboardEntry[];
    if (!Array.isArray(parsed)) return [];

    return normalizeDdrLeaderboardEntries(parsed);
  } catch {
    return [];
  }
}

function saveDdrLeaderboardEntry(entry: LeaderboardEntry) {
  if (typeof window === "undefined") return [] as LeaderboardEntry[];

  const nextEntries = normalizeDdrLeaderboardEntries([entry, ...loadDdrLeaderboard()]);
  window.localStorage.setItem(DDR_LEADERBOARD_KEY, JSON.stringify(nextEntries));
  return nextEntries;
}

function useBeatSound(enabled: boolean) {
  const audioContextRef = useRef<AudioContext | null>(null);

  const ensureAudioContext = useCallback(() => {
    const AudioContextConstructor =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return null;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextConstructor();
    }

    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }, []);

  const playBeat = useCallback(
    (accent = false) => {
      if (!enabled) return;
      const context = ensureAudioContext();
      if (!context) return;

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = accent ? 880 : 660;
      gain.gain.setValueAtTime(accent ? 0.065 : 0.045, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.08);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.09);
    },
    [enabled, ensureAudioContext]
  );

  return { prime: ensureAudioContext, playBeat };
}

export default function TypingDdrPage() {
  const [gameMode, setGameMode] = useState<GameMode>("balancedPlus");
  const [tempo, setTempo] = useState(BALANCED_PLUS_PRESET.tempo);
  const [progressiveTempo, setProgressiveTempo] = useState(PROGRESSIVE_START_TEMPO);
  const [rhythmMode, setRhythmMode] = useState<RhythmMode>("quarter");
  const [activeKeys, setActiveKeys] = useState<string[]>(loadDdrActiveKeys);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [keysLocked, setKeysLocked] = useState(false);
  const [startingHearts, setStartingHearts] = useState(LEAGUE_PRESETS.bronze.startingHearts);
  const [hearts, setHearts] = useState(LEAGUE_PRESETS.bronze.startingHearts);
  const [pointScore, setPointScore] = useState(0);
  const [hits, setHits] = useState(0);
  const [missedNotes, setMissedNotes] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [combo, setCombo] = useState(0);
  const [healProgress, setHealProgress] = useState(0);
  const [healComboTarget, setHealComboTarget] = useState(LEAGUE_PRESETS.bronze.healComboTarget);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tempoMarkers, setTempoMarkers] = useState<TempoMarker[]>([]);
  const [pulseLane, setPulseLane] = useState<{ laneIndex: number; token: number } | null>(null);
  const [levelUpToken, setLevelUpToken] = useState(0);
  const [mistakeToken, setMistakeToken] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [showKeyLetters, setShowKeyLetters] = useState(true);
  const [compactMode, setCompactMode] = useState(true);
  const [randomKeysEnabled, setRandomKeysEnabled] = useState(false);
  const [randomKeyCount, setRandomKeyCount] = useState(DEFAULT_ACTIVE_KEYS.length);
  const [modeShortcutActive, setModeShortcutActive] = useState(false);
  const [keyEditActive, setKeyEditActive] = useState(false);
  const [maxTempo, setMaxTempo] = useState(BALANCED_PLUS_PRESET.tempo);
  const [averageTempo, setAverageTempo] = useState(BALANCED_PLUS_PRESET.tempo);
  const [balancedTimeMode, setBalancedTimeMode] = useState<BalancedTimeMode>("unlimited");
  const [balancedElapsedMs, setBalancedElapsedMs] = useState(0);
  const [roundResult, setRoundResult] = useState<RoundResult>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboardView, setLeaderboardView] = useState<LeaderboardView>("leaderboard");
  const [leaderboardViewMenuOpen, setLeaderboardViewMenuOpen] = useState(false);
  const [leaderboardMode, setLeaderboardMode] = useState<string>(MODE_LABELS.balancedPlus);

  const runningRef = useRef(running);
  const gameOverRef = useRef(gameOver);
  const gameModeRef = useRef(gameMode);
  const progressiveTempoRef = useRef(progressiveTempo);
  const keysLockedRef = useRef(keysLocked);
  const notesRef = useRef(notes);
  const heartsRef = useRef(hearts);
  const comboRef = useRef(combo);
  const healProgressRef = useRef(healProgress);
  const nextBarStartRef = useRef(0);
  const nextNoteIdRef = useRef(1);
  const nextTempoMarkerIdRef = useRef(1);
  const lastLaneRef = useRef<number | null>(null);
  const timingEventsRef = useRef<Record<string, ScheduledTimingEvent>>({});
  const tempoMarkersRef = useRef(tempoMarkers);
  const pauseStartedAtRef = useRef<number | null>(null);
  const levelStartedAtRef = useRef<number | null>(null);
  const levelElapsedMsRef = useRef(0);
  const balancedRunStartedAtRef = useRef<number | null>(null);
  const balancedElapsedMsRef = useRef(0);
  const tempoAverageStartedAtRef = useRef<number | null>(null);
  const tempoAverageTotalRef = useRef(0);
  const tempoAverageDurationRef = useRef(0);
  const maxTempoRef = useRef(maxTempo);
  const balancedTimeModeRef = useRef(balancedTimeMode);
  const roundResultRef = useRef<RoundResult>(roundResult);
  const randomKeysEnabledRef = useRef(randomKeysEnabled);
  const randomKeyCountRef = useRef(randomKeyCount);
  const keyEditActiveRef = useRef(keyEditActive);
  const balancedPlusOutcomesRef = useRef<BalancedPlusOutcome[]>([]);
  const runSavedRef = useRef(false);
  const soundOnRef = useRef(soundOn);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const leaderboardScrollRef = useRef<HTMLDivElement | null>(null);
  const [stageHeight, setStageHeight] = useState(560);

  const { prime, playBeat } = useBeatSound(soundOn);
  const playBeatRef = useRef(playBeat);
  const beatMs = useMemo(() => 60000 / tempo, [tempo]);
  const beatMsRef = useRef(beatMs);
  const tempoRef = useRef(tempo);
  const tempoIntensity = useMemo(() => clamp((tempo - TEMPO_MIN) / (TEMPO_MAX - TEMPO_MIN), 0, 1), [tempo]);
  const rhythmIntensity = RHYTHM_INTENSITY[rhythmMode];
  const rhythmModeRef = useRef(rhythmMode);
  const noteTargetY = Math.round((stageHeight * HIT_LINE_PERCENT) / 100);
  const noteEndY = Math.round(-80 + ((noteTargetY + 80) * NOTE_ANIMATION_DURATION_MS) / FALL_DURATION_MS);
  const stageSizeScale = useMemo(() => clamp((noteTargetY + 80) / 560, 0.68, 1.12), [noteTargetY]);
  const challengeIntensity = useMemo(
    () => clamp(tempoIntensity * 0.72 + rhythmIntensity * 0.36, 0, 1),
    [rhythmIntensity, tempoIntensity]
  );
  const hitWindowMs = useMemo(
    () =>
      Math.round(SLOW_TEMPO_HIT_WINDOW_MS - (SLOW_TEMPO_HIT_WINDOW_MS - FAST_TEMPO_HIT_WINDOW_MS) * challengeIntensity),
    [challengeIntensity]
  );
  const hitWindowMsRef = useRef(hitWindowMs);
  const noteWidth = useMemo<ResponsiveSize>(
    () => scaleResponsiveSize(compactMode ? { xs: 22, sm: 30, md: 36 } : { xs: 28, sm: 38, md: 46 }, stageSizeScale),
    [compactMode, stageSizeScale]
  );
  const noteHeight = useMemo<ResponsiveSize>(
    () => ({
      xs: Math.max(12, Math.round(noteWidth.xs - (compactMode ? 9 : 14) * challengeIntensity)),
      sm: Math.max(14, Math.round(noteWidth.sm - (compactMode ? 13 : 19) * challengeIntensity)),
      md: Math.max(16, Math.round(noteWidth.md - (compactMode ? 17 : 24) * challengeIntensity)),
    }),
    [challengeIntensity, compactMode, noteWidth]
  );
  const targetSize = useMemo<ResponsiveSize>(
    () => {
      const baseSize = compactMode ? { xs: 28, sm: 38, md: 46 } : { xs: 34, sm: 48, md: 58 };
      const tempoAdjustedSize = {
        xs: Math.max(20, baseSize.xs - Math.round((compactMode ? 5 : 7) * challengeIntensity)),
        sm: Math.max(26, baseSize.sm - Math.round((compactMode ? 8 : 10) * challengeIntensity)),
        md: Math.max(32, baseSize.md - Math.round((compactMode ? 11 : 14) * challengeIntensity)),
      };
      return scaleResponsiveSize(tempoAdjustedSize, stageSizeScale);
    },
    [challengeIntensity, compactMode, stageSizeScale]
  );
  const activeLaneIndexes = useMemo(
    () =>
      HOME_KEYS.map((homeKey, index) => (activeKeys.includes(homeKey.key) ? index : -1)).filter(
        (index) => index !== -1
      ),
    [activeKeys]
  );
  const activeLaneIndexesRef = useRef(activeLaneIndexes);
  const activeKeySet = useMemo(() => new Set(activeKeys), [activeKeys]);
  const notesByLane = useMemo(() => {
    const lanes = HOME_KEYS.map(() => [] as Note[]);
    notes.forEach((note) => {
      lanes[note.laneIndex].push(note);
    });
    return lanes;
  }, [notes]);
  const modeOptions = useMemo<GameMode[]>(
    () => ["balancedPlus", "balanced", "progressive", ...LEAGUE_ORDER, "custom"],
    []
  );
  const randomKeyFlashDelays = useMemo(() => {
    if (!randomKeysEnabled) {
      return HOME_KEYS.map(() => 0);
    }

    const order = HOME_KEYS.map((_, index) => index);
    for (let index = order.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
    }

    const delays = HOME_KEYS.map(() => 0);
    order.forEach((keyIndex, orderIndex) => {
      delays[keyIndex] = orderIndex * 85;
    });
    return delays;
  }, [randomKeysEnabled]);
  const displayPreset = useMemo(() => getDisplayPresetForMode(gameMode, progressiveTempo), [gameMode, progressiveTempo]);
  const currentPreset = useMemo(() => getBasePresetForMode(gameMode), [gameMode]);
  const isCustomMode = gameMode === "custom";
  const balancedTimeLimitMs = useMemo(() => getBalancedTimeLimitMs(balancedTimeMode, gameMode), [balancedTimeMode, gameMode]);
  const balancedTimeModeIndex = BALANCED_TIME_MODES.findIndex((mode) => mode.value === balancedTimeMode);

  useEffect(() => {
    setLeaderboard(loadDdrLeaderboard());
  }, []);

  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  useEffect(() => {
    gameModeRef.current = gameMode;
  }, [gameMode]);

  useEffect(() => {
    progressiveTempoRef.current = progressiveTempo;
  }, [progressiveTempo]);

  useEffect(() => {
    playBeatRef.current = playBeat;
  }, [playBeat]);

  useEffect(() => {
    tempoRef.current = tempo;
    beatMsRef.current = beatMs;
  }, [beatMs, tempo]);

  useEffect(() => {
    rhythmModeRef.current = rhythmMode;
  }, [rhythmMode]);

  useEffect(() => {
    hitWindowMsRef.current = hitWindowMs;
  }, [hitWindowMs]);

  useEffect(() => {
    activeLaneIndexesRef.current = activeLaneIndexes;
  }, [activeLaneIndexes]);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    gameOverRef.current = gameOver;
  }, [gameOver]);

  useEffect(() => {
    keysLockedRef.current = keysLocked;
  }, [keysLocked]);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    tempoMarkersRef.current = tempoMarkers;
  }, [tempoMarkers]);

  useEffect(() => {
    heartsRef.current = hearts;
  }, [hearts]);

  useEffect(() => {
    comboRef.current = combo;
  }, [combo]);

  useEffect(() => {
    healProgressRef.current = healProgress;
  }, [healProgress]);

  useEffect(() => {
    maxTempoRef.current = maxTempo;
  }, [maxTempo]);

  useEffect(() => {
    balancedTimeModeRef.current = balancedTimeMode;
  }, [balancedTimeMode]);

  useEffect(() => {
    roundResultRef.current = roundResult;
  }, [roundResult]);

  useEffect(() => {
    randomKeysEnabledRef.current = randomKeysEnabled;
  }, [randomKeysEnabled]);

  useEffect(() => {
    keyEditActiveRef.current = keyEditActive;
  }, [keyEditActive]);

  useEffect(() => {
    setRandomKeyCount((previous) => clamp(previous, MIN_ACTIVE_KEYS, MAX_RANDOM_ACTIVE_KEYS));
  }, []);

  useEffect(() => {
    randomKeyCountRef.current = randomKeyCount;
  }, [randomKeyCount]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;

    const updateStageHeight = () => {
      const nextHeight = Math.round(stage.getBoundingClientRect().height);
      if (nextHeight > 0) {
        setStageHeight((previous) => (previous === nextHeight ? previous : nextHeight));
      }
    };

    updateStageHeight();

    const resizeObserver = new ResizeObserver(updateStageHeight);
    resizeObserver.observe(stage);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!currentPreset) return;

    const nextTempo = gameMode === "progressive" ? progressiveTempo : currentPreset.tempo;
    tempoRef.current = nextTempo;
    beatMsRef.current = 60000 / nextTempo;
    setTempo(nextTempo);
    setRhythmMode("quarter");
    setStartingHearts(currentPreset.startingHearts);
    const nextHealComboTarget =
      gameMode === "progressive"
        ? getProgressiveHealComboTarget(nextTempo, rhythmModeRef.current, currentPreset.startingHearts)
        : currentPreset.healComboTarget;
    setHealComboTarget(nextHealComboTarget);

    const shouldRefillHearts = !keysLockedRef.current;
    const nextHearts = shouldRefillHearts
      ? currentPreset.startingHearts
      : Math.min(heartsRef.current, currentPreset.startingHearts);
    heartsRef.current = nextHearts;
    setHearts(nextHearts);

    const nextHealProgress = Math.min(healProgressRef.current, nextHealComboTarget - 1);
    healProgressRef.current = nextHealProgress;
    setHealProgress(nextHealProgress);
  }, [currentPreset, gameMode, progressiveTempo]);

  const addTempoMarker = useCallback((nowMs = performance.now()) => {
    const activeLanes = activeLaneIndexesRef.current;
    if (activeLanes.length === 0) return;

    const leftLaneIndex = Math.min(...activeLanes);
    const rightLaneIndex = Math.max(...activeLanes);
    const fallbackTargetTime = nowMs + FALL_DURATION_MS + beatMsRef.current;
    const targetTime = Math.max(nextBarStartRef.current || fallbackTargetTime, nowMs + FALL_DURATION_MS * 0.2);
    const marker: TempoMarker = {
      id: nextTempoMarkerIdRef.current,
      targetTime,
      animationDelayMs: targetTime - FALL_DURATION_MS - nowMs,
      leftLaneIndex,
      rightLaneIndex,
    };
    nextTempoMarkerIdRef.current += 1;
    tempoMarkersRef.current = [...tempoMarkersRef.current, marker];
    setTempoMarkers(tempoMarkersRef.current);
  }, []);

  const advanceProgressiveLevels = useCallback((levelsGained: number) => {
    if (levelsGained <= 0) return;

    if (gameModeRef.current === "progressive") {
      const nowMs = performance.now();
      const previousTempo = progressiveTempoRef.current;
      const nextTempo = Math.max(WRONG_KEY_TEMPO_FLOOR, previousTempo + PROGRESSIVE_TEMPO_STEP * levelsGained);
      progressiveTempoRef.current = nextTempo;
      tempoRef.current = nextTempo;
      beatMsRef.current = 60000 / nextTempo;
      maxTempoRef.current = Math.max(maxTempoRef.current, nextTempo);
      setProgressiveTempo(nextTempo);
      setTempo(nextTempo);
      setMaxTempo(maxTempoRef.current);
      if (nextTempo > previousTempo) {
        addTempoMarker(nowMs);
        setLevelUpToken((previous) => previous + 1);
      }
    }
  }, [addTempoMarker]);

  const checkLevelAdvance = useCallback((nowMs = performance.now()) => {
    if (!runningRef.current || gameOverRef.current || !keysLockedRef.current || gameModeRef.current !== "progressive") {
      return;
    }

    const levelStartedAt = levelStartedAtRef.current ?? nowMs;
    const elapsedMs = levelElapsedMsRef.current + nowMs - levelStartedAt;
    const levelsGained = Math.floor(elapsedMs / getLevelDurationMs());

    if (levelsGained <= 0) return;

    levelElapsedMsRef.current = elapsedMs % getLevelDurationMs();
    levelStartedAtRef.current = nowMs;
    advanceProgressiveLevels(levelsGained);
  }, [advanceProgressiveLevels]);

  useEffect(() => {
    if (!running || gameOver || !keysLocked || gameMode !== "progressive") return undefined;

    levelStartedAtRef.current = performance.now();
    const intervalId = window.setInterval(() => checkLevelAdvance(), 100);

    return () => {
      window.clearInterval(intervalId);
      if (levelStartedAtRef.current !== null) {
        levelElapsedMsRef.current = Math.min(
          getLevelDurationMs() - 1,
          levelElapsedMsRef.current + performance.now() - levelStartedAtRef.current
        );
        levelStartedAtRef.current = null;
      }
    };
  }, [checkLevelAdvance, gameMode, gameOver, keysLocked, running]);

  const getBalancedElapsedMs = useCallback((nowMs = performance.now()) => {
    const runStartedAt = balancedRunStartedAtRef.current;
    return balancedElapsedMsRef.current + (runStartedAt === null ? 0 : Math.max(0, nowMs - runStartedAt));
  }, []);

  const commitBalancedElapsed = useCallback(
    (nowMs = performance.now()) => {
      const nextElapsedMs = getBalancedElapsedMs(nowMs);
      balancedElapsedMsRef.current = nextElapsedMs;
      balancedRunStartedAtRef.current = null;
      setBalancedElapsedMs(nextElapsedMs);
      return nextElapsedMs;
    },
    [getBalancedElapsedMs]
  );

  const commitTempoAverage = useCallback((nowMs = performance.now()) => {
    const averageStartedAt = tempoAverageStartedAtRef.current;
    if (averageStartedAt === null || !isBalancedPracticeMode(gameModeRef.current)) return;

    const elapsedMs = Math.max(0, nowMs - averageStartedAt);
    if (elapsedMs === 0) return;

    tempoAverageTotalRef.current += tempoRef.current * elapsedMs;
    tempoAverageDurationRef.current += elapsedMs;
    tempoAverageStartedAtRef.current = nowMs;
    setAverageTempo(Math.round(tempoAverageTotalRef.current / tempoAverageDurationRef.current));
  }, []);

  const startBalancedRunClock = useCallback((nowMs = performance.now()) => {
    if (!isBalancedPracticeMode(gameModeRef.current)) return;
    if (balancedRunStartedAtRef.current === null) {
      balancedRunStartedAtRef.current = nowMs;
    }
    if (tempoAverageStartedAtRef.current === null) {
      tempoAverageStartedAtRef.current = nowMs;
      setAverageTempo(Math.round(tempoRef.current));
    }
  }, []);

  const stopBalancedRunClock = useCallback(
    (nowMs = performance.now()) => {
      commitBalancedElapsed(nowMs);
      commitTempoAverage(nowMs);
      tempoAverageStartedAtRef.current = null;
    },
    [commitBalancedElapsed, commitTempoAverage]
  );

  const completeTimedRound = useCallback(() => {
    const nowMs = performance.now();
    stopBalancedRunClock(nowMs);
    runningRef.current = false;
    gameOverRef.current = true;
    roundResultRef.current = "complete";
    pauseStartedAtRef.current = null;
    setRunning(false);
    setRoundResult("complete");
    setGameOver(true);
  }, [stopBalancedRunClock]);

  useEffect(() => {
    if (!running || gameOver || !keysLocked || !isBalancedPracticeMode(gameMode)) return undefined;

    const intervalId = window.setInterval(() => {
      const nowMs = performance.now();
      const nextElapsedMs = getBalancedElapsedMs(nowMs);
      setBalancedElapsedMs(nextElapsedMs);
      commitTempoAverage(nowMs);

      if (balancedTimeLimitMs !== null && nextElapsedMs >= balancedTimeLimitMs) {
        completeTimedRound();
      }
    }, 500);

    return () => window.clearInterval(intervalId);
  }, [
    balancedTimeLimitMs,
    commitTempoAverage,
    completeTimedRound,
    gameMode,
    gameOver,
    getBalancedElapsedMs,
    keysLocked,
    running,
  ]);

  const applyTempoDelta = useCallback((delta: number) => {
    if (delta === 0) return;
    commitTempoAverage();
    setTempo((previous) => {
      const nextTempo = clamp(previous + delta, WRONG_KEY_TEMPO_FLOOR, TEMPO_MAX);
      tempoRef.current = nextTempo;
      beatMsRef.current = 60000 / nextTempo;
      maxTempoRef.current = Math.max(maxTempoRef.current, nextTempo);
      setMaxTempo(maxTempoRef.current);
      return nextTempo;
    });
  }, [commitTempoAverage]);

  const adjustBalancedTempo = useCallback(
    (delta: number) => {
      if (gameModeRef.current !== "balanced") return;
      applyTempoDelta(delta);
    },
    [applyTempoDelta]
  );

  const recordBalancedPlusOutcome = useCallback(
    (outcome: BalancedPlusOutcome, comboCount = comboRef.current) => {
      if (gameModeRef.current !== "balancedPlus") return;

      const nextOutcomes = [...balancedPlusOutcomesRef.current, outcome].slice(-BALANCED_PLUS_WINDOW_SIZE);
      balancedPlusOutcomesRef.current = nextOutcomes;

      if (nextOutcomes.length < BALANCED_PLUS_MIN_SAMPLE) {
        if (outcome !== "hit") {
          applyTempoDelta(-BALANCED_MISS_TEMPO_PENALTY);
        }
        return;
      }

      const hitCount = nextOutcomes.filter((value) => value === "hit").length;
      const accuracy = hitCount / nextOutcomes.length;
      const recentMissCount = nextOutcomes
        .slice(-BALANCED_PLUS_RECENT_WINDOW)
        .filter((value) => value !== "hit").length;

      if (outcome === "hit") {
        if (accuracy >= 0.92 && recentMissCount === 0 && comboCount >= 8) {
          applyTempoDelta(BALANCED_HIT_TEMPO_REWARD);
        }
        return;
      }

      if (accuracy < 0.72 || recentMissCount >= 3) {
        applyTempoDelta(outcome === "wrong" ? -3 : -2);
        return;
      }

      if (accuracy < 0.84 || recentMissCount >= 2) {
        applyTempoDelta(outcome === "wrong" ? -2 : -1);
        return;
      }

      if (outcome === "wrong") {
        applyTempoDelta(-1);
      }
    },
    [applyTempoDelta]
  );

  const resetStreak = useCallback(() => {
    comboRef.current = 0;
    healProgressRef.current = 0;
    setCombo(0);
    setHealProgress(0);
  }, []);

  const loseHearts = useCallback((amount: number) => {
    const nextHearts = Math.max(0, Number((heartsRef.current - amount).toFixed(3)));
    heartsRef.current = nextHearts;
    setHearts(nextHearts);

    if (nextHearts === 0) {
      stopBalancedRunClock();
      runningRef.current = false;
      gameOverRef.current = true;
      roundResultRef.current = "lost";
      pauseStartedAtRef.current = null;
      setRunning(false);
      setRoundResult("lost");
      setGameOver(true);
    }

    return nextHearts;
  }, [stopBalancedRunClock]);

  const armTimingEvent = useCallback((id: string) => {
    const timingEvent = timingEventsRef.current[id];
    if (!timingEvent) return;

    if (timingEvent.timeoutId !== undefined) {
      window.clearTimeout(timingEvent.timeoutId);
    }

    timingEvent.timeoutId = window.setTimeout(() => {
      const currentEvent = timingEventsRef.current[id];
      if (!currentEvent) return;

      delete timingEventsRef.current[id];

      if (!runningRef.current || gameOverRef.current) return;

      if (currentEvent.options.missNoteId !== undefined) {
        const nextNotes = notesRef.current.filter((note) => note.id !== currentEvent.options.missNoteId);
        if (nextNotes.length !== notesRef.current.length) {
          notesRef.current = nextNotes;
          setNotes(nextNotes);
          setMissedNotes((previous) => previous + 1);
          adjustBalancedTempo(-BALANCED_MISS_TEMPO_PENALTY);
          recordBalancedPlusOutcome("missed");
          if (gameModeRef.current === "progressive" || isBalancedPracticeMode(gameModeRef.current)) {
            loseHearts(FRACTIONAL_MISSED_HEART_LOSS);
          }
          resetStreak();
        }
        return;
      }

      if (currentEvent.options.sound && soundOnRef.current) {
        playBeatRef.current(currentEvent.options.accent);
      }
    }, Math.max(0, timingEvent.targetTime - performance.now()));
  }, [adjustBalancedTempo, loseHearts, recordBalancedPlusOutcome, resetStreak]);

  const pauseTimingEvents = useCallback(() => {
    Object.values(timingEventsRef.current).forEach((timingEvent) => {
      if (timingEvent.timeoutId !== undefined) {
        window.clearTimeout(timingEvent.timeoutId);
        timingEvent.timeoutId = undefined;
      }
    });
  }, []);

  const resumeTimingEvents = useCallback(() => {
    Object.keys(timingEventsRef.current).forEach(armTimingEvent);
  }, [armTimingEvent]);

  const clearTimingEvents = useCallback(() => {
    const timingEvents = Object.values(timingEventsRef.current);
    timingEventsRef.current = {};
    timingEvents.forEach((timingEvent) => {
      if (timingEvent.timeoutId !== undefined) {
        window.clearTimeout(timingEvent.timeoutId);
      }
    });
  }, []);

  const scheduleTimingEvent = useCallback(
    (id: string, targetTime: number, options: TimingEventOptions = {}) => {
      if (timingEventsRef.current[id] !== undefined) return;

      timingEventsRef.current[id] = { targetTime, options };
      armTimingEvent(id);
    },
    [armTimingEvent]
  );

  const clearNotesAndReseed = useCallback(() => {
    clearTimingEvents();
    const startAt = performance.now() + FALL_DURATION_MS + beatMsRef.current;
    nextBarStartRef.current = startAt;
    lastLaneRef.current = null;
    notesRef.current = [];
    tempoMarkersRef.current = [];
    setNotes([]);
    setTempoMarkers([]);
  }, [clearTimingEvents]);

  const resetGame = useCallback(() => {
    runningRef.current = false;
    gameOverRef.current = false;
    roundResultRef.current = null;
    keysLockedRef.current = false;
    pauseStartedAtRef.current = null;
    levelStartedAtRef.current = null;
    levelElapsedMsRef.current = 0;
    balancedRunStartedAtRef.current = null;
    balancedElapsedMsRef.current = 0;
    tempoAverageStartedAtRef.current = null;
    tempoAverageTotalRef.current = 0;
    tempoAverageDurationRef.current = 0;
    heartsRef.current = startingHearts;
    comboRef.current = 0;
    healProgressRef.current = 0;
    const nextProgressiveTempo = PROGRESSIVE_START_TEMPO;
    const currentMode = gameModeRef.current;
    const nextTempo =
      currentMode === "progressive"
        ? nextProgressiveTempo
        : currentMode === "custom"
          ? tempoRef.current
          : (getBasePresetForMode(currentMode)?.tempo ?? BALANCED_PLUS_PRESET.tempo);
    const nextMaxTempo = nextTempo;
    progressiveTempoRef.current = nextProgressiveTempo;
    tempoRef.current = nextTempo;
    beatMsRef.current = 60000 / nextTempo;
    maxTempoRef.current = nextMaxTempo;
    balancedPlusOutcomesRef.current = [];
    runSavedRef.current = false;
    clearNotesAndReseed();
    setTempo(nextTempo);
    setHearts(startingHearts);
    setPointScore(0);
    setHits(0);
    setMissedNotes(0);
    setMistakes(0);
    setCombo(0);
    setHealProgress(0);
    setBalancedElapsedMs(0);
    setAverageTempo(Math.round(nextTempo));
    setGameOver(false);
    setRoundResult(null);
    setRunning(false);
    setKeysLocked(false);
    setPulseLane(null);
    setLevelUpToken(0);
    setProgressiveTempo(nextProgressiveTempo);
    setMaxTempo(nextMaxTempo);
    setModeShortcutActive(false);
    keyEditActiveRef.current = false;
    setKeyEditActive(false);
  }, [clearNotesAndReseed, startingHearts]);

  const resumePausedTimeline = useCallback(() => {
    const pauseStartedAt = pauseStartedAtRef.current;
    if (pauseStartedAt === null) return false;

    const pauseDurationMs = Math.max(0, performance.now() - pauseStartedAt);
    pauseStartedAtRef.current = null;

    if (pauseDurationMs === 0) return true;

    if (nextBarStartRef.current) {
      nextBarStartRef.current += pauseDurationMs;
    }

    const shiftedNotes = notesRef.current.map((note) => ({
      ...note,
      createdAt: note.createdAt + pauseDurationMs,
      targetTime: note.targetTime + pauseDurationMs,
    }));
    notesRef.current = shiftedNotes;
    setNotes(shiftedNotes);

    const shiftedMarkers = tempoMarkersRef.current.map((marker) => ({
      ...marker,
      targetTime: marker.targetTime + pauseDurationMs,
    }));
    tempoMarkersRef.current = shiftedMarkers;
    setTempoMarkers(shiftedMarkers);

    Object.values(timingEventsRef.current).forEach((timingEvent) => {
      timingEvent.targetTime += pauseDurationMs;
    });

    return true;
  }, []);

  const pauseGame = useCallback(() => {
    if (!runningRef.current || gameOverRef.current) return;

    stopBalancedRunClock();
    pauseStartedAtRef.current = performance.now();
    runningRef.current = false;
    setRunning(false);
    pauseTimingEvents();
  }, [pauseTimingEvents, stopBalancedRunClock]);

  const startGame = useCallback(() => {
    if (soundOnRef.current) {
      prime();
    }
    if (gameOverRef.current) {
      resetGame();
    }
    const resumedFromPause = resumePausedTimeline();
    if (!runningRef.current) {
      const nowMs = performance.now();
      const currentBeatMs = beatMsRef.current;
      if (!resumedFromPause && nextBarStartRef.current < nowMs + currentBeatMs) {
        nextBarStartRef.current = nowMs + FALL_DURATION_MS + currentBeatMs;
      }
    }
    if (!keysLockedRef.current && randomKeysEnabledRef.current) {
      const nextRandomKeys = getRandomHomeKeys(randomKeyCountRef.current);
      setActiveKeys(nextRandomKeys);
      activeLaneIndexesRef.current = HOME_KEYS.map((homeKey, index) =>
        nextRandomKeys.includes(homeKey.key) ? index : -1
      ).filter((index) => index !== -1);
    }
    runningRef.current = true;
    gameOverRef.current = false;
    roundResultRef.current = null;
    keysLockedRef.current = true;
    setGameOver(false);
    setRoundResult(null);
    setKeysLocked(true);
    setRunning(true);
    startBalancedRunClock();
    setModeShortcutActive(false);
    keyEditActiveRef.current = false;
    setKeyEditActive(false);
    setMaxTempo((previous) => {
      const nextMaxTempo = Math.max(previous, tempoRef.current);
      maxTempoRef.current = nextMaxTempo;
      return nextMaxTempo;
    });
    resumeTimingEvents();
  }, [prime, resetGame, resumePausedTimeline, resumeTimingEvents, startBalancedRunClock]);

  const restartAndStart = useCallback(() => {
    resetGame();
    startGame();
  }, [resetGame, startGame]);

  const applyGameMode = useCallback((nextMode: GameMode) => {
    setGameMode(nextMode);
    balancedPlusOutcomesRef.current = [];
    balancedRunStartedAtRef.current = null;
    balancedElapsedMsRef.current = 0;
    tempoAverageStartedAtRef.current = null;
    tempoAverageTotalRef.current = 0;
    tempoAverageDurationRef.current = 0;
    setBalancedElapsedMs(0);
    if (nextMode !== "custom") {
      const nextHealComboTarget =
        nextMode === "progressive"
          ? getProgressiveHealComboTarget(PROGRESSIVE_START_TEMPO, "quarter", PROGRESSIVE_PRESET.startingHearts)
          : HEART_REGEN_COMBO_TARGET;
      setHealComboTarget(nextHealComboTarget);
      healProgressRef.current = Math.min(healProgressRef.current, nextHealComboTarget - 1);
      setHealProgress(healProgressRef.current);
    }

    if (nextMode === "progressive") {
      progressiveTempoRef.current = PROGRESSIVE_START_TEMPO;
      tempoRef.current = PROGRESSIVE_START_TEMPO;
      beatMsRef.current = 60000 / PROGRESSIVE_START_TEMPO;
      setProgressiveTempo(PROGRESSIVE_START_TEMPO);
      setTempo(PROGRESSIVE_START_TEMPO);
      setMaxTempo(PROGRESSIVE_START_TEMPO);
      setAverageTempo(PROGRESSIVE_START_TEMPO);
      maxTempoRef.current = PROGRESSIVE_START_TEMPO;
      return;
    }

    const nextTempo = nextMode === "custom" ? tempoRef.current : (getBasePresetForMode(nextMode)?.tempo ?? BALANCED_PLUS_PRESET.tempo);
    tempoRef.current = nextTempo;
    beatMsRef.current = 60000 / nextTempo;
    setTempo(nextTempo);
    setMaxTempo(nextTempo);
    setAverageTempo(Math.round(nextTempo));
    maxTempoRef.current = nextTempo;
  }, []);

  const toggleActiveKey = useCallback((key: string) => {
    if (keysLockedRef.current) return;

    setActiveKeys((previousKeys) => {
      const includesKey = previousKeys.includes(key);
      if (includesKey && previousKeys.length <= MIN_ACTIVE_KEYS) return previousKeys;

      const nextKeys = includesKey ? previousKeys.filter((activeKey) => activeKey !== key) : [...previousKeys, key];
      const orderedKeys = getOrderedHomeKeys(nextKeys);
      saveDdrActiveKeys(orderedKeys);
      return orderedKeys;
    });
  }, []);

  const stepModeShortcut = useCallback(
    (direction: 1 | -1) => {
      const currentIndex = modeOptions.indexOf(gameModeRef.current);
      const safeIndex = currentIndex === -1 ? 0 : currentIndex;
      const nextIndex = (safeIndex + direction + modeOptions.length) % modeOptions.length;
      applyGameMode(modeOptions[nextIndex]);
    },
    [applyGameMode, modeOptions]
  );

  const stepBalancedTimeMode = useCallback((direction: 1 | -1) => {
    setBalancedTimeMode((previous) => {
      const currentIndex = BALANCED_TIME_MODES.findIndex((mode) => mode.value === previous);
      const safeIndex = currentIndex === -1 ? 0 : currentIndex;
      const nextIndex = clamp(safeIndex + direction, 0, BALANCED_TIME_MODES.length - 1);
      return BALANCED_TIME_MODES[nextIndex].value;
    });
  }, []);

  const handleMenuShortcut = useCallback(
    (event: KeyboardEvent) => {
      if (keysLockedRef.current || runningRef.current || gameOverRef.current || event.ctrlKey || event.metaKey || event.altKey) {
        return false;
      }

      const key = event.key.toLowerCase();

      if (modeShortcutActive) {
        if (key === "d") {
          event.preventDefault();
          stepModeShortcut(1);
          return true;
        }
        if (key === "e") {
          event.preventDefault();
          stepModeShortcut(-1);
          return true;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          setModeShortcutActive(false);
          return true;
        }
      }

      if (key === "m") {
        event.preventDefault();
        setModeShortcutActive((previous) => !previous);
        return true;
      }

      if (key === "k") {
        event.preventDefault();
        setModeShortcutActive(false);
        randomKeysEnabledRef.current = false;
        keyEditActiveRef.current = true;
        setRandomKeysEnabled(false);
        setKeyEditActive(true);
        return true;
      }

      if (key === "h") {
        event.preventDefault();
        setShowKeyLetters((previous) => !previous);
        return true;
      }

      if (key === "c") {
        event.preventDefault();
        setCompactMode((previous) => !previous);
        return true;
      }

      if (key === "r") {
        event.preventDefault();
        setRandomKeysEnabled((previous) => !previous);
        return true;
      }

      if (key === "l") {
        event.preventDefault();
        setLeaderboardMode(gameModeRef.current === "progressive" ? "Progressive" : MODE_LABELS[gameModeRef.current]);
        setLeaderboardOpen(true);
        return true;
      }

      if (randomKeysEnabledRef.current && key === "j") {
        event.preventDefault();
        setRandomKeyCount((previous) => clamp(previous - 1, MIN_ACTIVE_KEYS, MAX_RANDOM_ACTIVE_KEYS));
        return true;
      }

      if (isBalancedPracticeMode(gameModeRef.current) && (key === "s" || key === "f")) {
        event.preventDefault();
        stepBalancedTimeMode(key === "f" ? 1 : -1);
        return true;
      }

      return false;
    },
    [modeShortcutActive, stepBalancedTimeMode, stepModeShortcut]
  );

  const recordHit = useCallback(
    (noteId: number, laneIndex: number) => {
      const remainingNotes = notesRef.current.filter((note) => note.id !== noteId);
      notesRef.current = remainingNotes;
      setNotes(remainingNotes);
      setHits((previous) => previous + 1);

      const nextCombo = comboRef.current + 1;
      comboRef.current = nextCombo;
      setCombo(nextCombo);
      setPointScore(
        (previous) => previous + calculateHitScore(activeKeys.length, tempoIntensity, rhythmIntensity, nextCombo)
      );

      adjustBalancedTempo(BALANCED_HIT_TEMPO_REWARD);
      recordBalancedPlusOutcome("hit", nextCombo);

      let nextHealProgress = healProgressRef.current + 1;
      if (nextHealProgress >= healComboTarget) {
        nextHealProgress = 0;
        const nextHearts = Math.min(startingHearts, heartsRef.current + 1);
        heartsRef.current = nextHearts;
        setHearts(nextHearts);
      }

      healProgressRef.current = nextHealProgress;
      setHealProgress(nextHealProgress);
      setPulseLane({ laneIndex, token: noteId });
    },
    [
      activeKeys.length,
      adjustBalancedTempo,
      healComboTarget,
      recordBalancedPlusOutcome,
      rhythmIntensity,
      startingHearts,
      tempoIntensity,
    ]
  );

  const registerMistake = useCallback(() => {
    setMistakes((previous) => previous + 1);
    comboRef.current = 0;
    setCombo(0);
    setMistakeToken((previous) => previous + 1);

    adjustBalancedTempo(-BALANCED_WRONG_TEMPO_PENALTY);
    recordBalancedPlusOutcome("wrong");

    loseHearts(1);
  }, [adjustBalancedTempo, loseHearts, recordBalancedPlusOutcome]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (leaderboardOpen) {
        if (event.ctrlKey || event.metaKey || event.altKey) return;

        const leaderboardKey = event.key.toLowerCase();

        if (leaderboardKey === "b") {
          event.preventDefault();
          setLeaderboardOpen(false);
          setLeaderboardViewMenuOpen(false);
          return;
        }

        if (leaderboardKey === "v") {
          event.preventDefault();
          setLeaderboardViewMenuOpen(true);
          return;
        }

        if (leaderboardViewMenuOpen) {
          if (leaderboardKey === "enter") {
            event.preventDefault();
            setLeaderboardViewMenuOpen(false);
            return;
          }

          if (leaderboardKey === "i" || leaderboardKey === "k") {
            event.preventDefault();
            setLeaderboardView((previous) => {
              const currentIndex = LEADERBOARD_VIEW_OPTIONS.indexOf(previous);
              const safeIndex = currentIndex === -1 ? 0 : currentIndex;
              const direction = leaderboardKey === "i" ? -1 : 1;
              const nextIndex = clamp(safeIndex + direction, 0, LEADERBOARD_VIEW_OPTIONS.length - 1);
              return LEADERBOARD_VIEW_OPTIONS[nextIndex];
            });
            return;
          }

          return;
        }

        if (leaderboardView === "leaderboard" && (leaderboardKey === "j" || leaderboardKey === "l")) {
          event.preventDefault();
          setLeaderboardMode((previous) => {
            const currentIndex = LEADERBOARD_MODE_LABELS.indexOf(previous);
            const safeIndex = currentIndex === -1 ? 0 : currentIndex;
            const direction = leaderboardKey === "j" ? -1 : 1;
            const nextIndex = (safeIndex + direction + LEADERBOARD_MODE_LABELS.length) % LEADERBOARD_MODE_LABELS.length;
            return LEADERBOARD_MODE_LABELS[nextIndex];
          });
          return;
        }

        if (leaderboardKey === "i" || leaderboardKey === "k") {
          event.preventDefault();
          leaderboardScrollRef.current?.scrollBy({
            top: leaderboardKey === "i" ? -180 : 180,
            behavior: "smooth",
          });
          return;
        }

        return;
      }

      if (
        keyEditActiveRef.current &&
        !keysLockedRef.current &&
        !runningRef.current &&
        !gameOverRef.current &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();

        if (event.key === "Enter") {
          keyEditActiveRef.current = false;
          setKeyEditActive(false);
          return;
        }

        if (event.repeat) return;

        const editKey = event.key === " " ? " " : event.key.toLowerCase();
        const matchingHomeKey = HOME_KEYS.find((homeKey) => homeKey.key === editKey);
        if (matchingHomeKey) {
          toggleActiveKey(matchingHomeKey.key);
        }
        return;
      }

      if (event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.repeat) {
        event.preventDefault();
        if (runningRef.current) {
          pauseGame();
        } else {
          startGame();
        }
        return;
      }

      if (handleMenuShortcut(event)) {
        return;
      }

      if (!runningRef.current && keysLockedRef.current && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const commandKey = event.key.toLowerCase();
        if (commandKey === "r") {
          event.preventDefault();
          restartAndStart();
          return;
        }
        if (commandKey === "m") {
          event.preventDefault();
          resetGame();
          return;
        }
      }

      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || isEditableTarget(event.target)) {
        return;
      }

      if (!runningRef.current || gameOverRef.current || event.key.length !== 1) return;

      event.preventDefault();

      const pressedKey = event.key.toLowerCase();
      const homeKeyIndex = HOME_KEYS.findIndex((homeKey) => homeKey.key === pressedKey);

      if (homeKeyIndex === -1 || !activeKeySet.has(pressedKey)) {
        registerMistake();
        return;
      }

      const pressTime = performance.now();
      let candidate: Note | null = null;
      let candidateDistance = Number.POSITIVE_INFINITY;

      notesRef.current.forEach((note) => {
        if (note.laneIndex !== homeKeyIndex) return;

        const distance = Math.abs(note.targetTime - pressTime);
        if (distance <= hitWindowMs && distance < candidateDistance) {
          candidate = note;
          candidateDistance = distance;
        }
      });

      if (!candidate) {
        registerMistake();
        return;
      }

      recordHit(candidate.id, homeKeyIndex);
    },
    [
      activeKeySet,
      handleMenuShortcut,
      hitWindowMs,
      pauseGame,
      recordHit,
      registerMistake,
      resetGame,
      restartAndStart,
      startGame,
      toggleActiveKey,
      leaderboardOpen,
      leaderboardView,
      leaderboardViewMenuOpen,
    ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (!running || gameOver) return;

    const scheduleIntervalId = window.setInterval(() => {
      const nowMs = performance.now();
      const currentBeatMs = beatMsRef.current;
      const currentHitWindowMs = hitWindowMsRef.current;
      const activeLanes = activeLaneIndexesRef.current;
      const pattern = RHYTHM_PATTERNS[rhythmModeRef.current];
      const newNotes: Note[] = [];

      if (activeLanes.length === 0) return;

      const horizon = nowMs + FALL_DURATION_MS + currentBeatMs * SCHEDULE_LOOKAHEAD_BEATS;

      if (!nextBarStartRef.current) {
        nextBarStartRef.current = nowMs + FALL_DURATION_MS + currentBeatMs;
      }

      while (nextBarStartRef.current < horizon) {
        const barStart = nextBarStartRef.current;
        [0, 1, 2, 3].forEach((beatIndex) => {
          const targetTime = barStart + beatIndex * currentBeatMs;
          scheduleTimingEvent(`beat-${Math.round(targetTime)}`, targetTime, {
            accent: beatIndex === 0,
            sound: true,
          });
        });

        pattern.offsets.forEach((offset) => {
          const laneIndex = getRandomLane(activeLanes, lastLaneRef.current);
          lastLaneRef.current = laneIndex;
          const targetTime = barStart + offset * currentBeatMs;
          const noteId = nextNoteIdRef.current;
          newNotes.push({
            id: noteId,
            laneIndex,
            targetTime,
            createdAt: targetTime - FALL_DURATION_MS,
            animationDelayMs: targetTime - FALL_DURATION_MS - nowMs,
          });
          scheduleTimingEvent(`miss-${noteId}`, targetTime + currentHitWindowMs, {
            missNoteId: noteId,
          });
          nextNoteIdRef.current += 1;
        });
        nextBarStartRef.current = barStart + currentBeatMs * 4;
      }

      const previousNotes = notesRef.current;
      const liveNotes = previousNotes.filter((note) => nowMs - note.targetTime < currentHitWindowMs + 160);
      const previousMarkers = tempoMarkersRef.current;
      const liveMarkers = previousMarkers.filter((marker) => nowMs - marker.targetTime < currentHitWindowMs + 260);

      if (newNotes.length > 0 || liveNotes.length !== previousNotes.length) {
        const nextNotes = [...liveNotes, ...newNotes];
        notesRef.current = nextNotes;
        setNotes(nextNotes);
      }
      if (liveMarkers.length !== previousMarkers.length) {
        tempoMarkersRef.current = liveMarkers;
        setTempoMarkers(liveMarkers);
      }
    }, SCHEDULE_TICK_MS);

    return () => window.clearInterval(scheduleIntervalId);
  }, [gameOver, resetStreak, running, scheduleTimingEvent]);

  useEffect(() => {
    if (gameOver) {
      clearTimingEvents();
    }
  }, [clearTimingEvents, gameOver]);

  useEffect(() => () => clearTimingEvents(), [clearTimingEvents]);

  useEffect(() => {
    if (runningRef.current) {
      clearNotesAndReseed();
    }
  }, [activeKeys, clearNotesAndReseed, rhythmMode]);

  const handleActiveKeysChange = (_: React.MouseEvent<HTMLElement>, nextKeys: string[]) => {
    if (keysLockedRef.current) return;
    if (nextKeys.length < MIN_ACTIVE_KEYS) return;
    const orderedKeys = getOrderedHomeKeys(nextKeys);
    saveDdrActiveKeys(orderedKeys);
    setActiveKeys(orderedKeys);
  };

  const handleLaneClick = (key: string) => {
    if (keysLocked || gameOver) return;
    if (randomKeysEnabled) return;
    toggleActiveKey(key);
  };

  const handleStartingHeartsChange = (_: Event, value: number | number[]) => {
    const nextHearts = Array.isArray(value) ? value[0] : value;
    setStartingHearts(nextHearts);

    if (!runningRef.current && !gameOverRef.current && hits === 0 && missedNotes === 0 && mistakes === 0 && pointScore === 0) {
      heartsRef.current = nextHearts;
      setHearts(nextHearts);
      return;
    }

    const cappedHearts = Math.min(heartsRef.current, nextHearts);
    heartsRef.current = cappedHearts;
    setHearts(cappedHearts);
  };

  const handleHealComboTargetChange = (_: Event, value: number | number[]) => {
    const nextTarget = Array.isArray(value) ? value[0] : value;
    setHealComboTarget(nextTarget);
    const nextProgress = Math.min(healProgressRef.current, nextTarget - 1);
    healProgressRef.current = nextProgress;
    setHealProgress(nextProgress);
  };

  const handleGameModeChange = (event: { target: { value: unknown } }) => {
    if (keysLockedRef.current) return;

    setModeShortcutActive(false);
    applyGameMode(event.target.value as GameMode);
  };

  const handleBalancedTimeModeChange = (_: Event, value: number | number[]) => {
    const nextIndex = Array.isArray(value) ? value[0] : value;
    setBalancedTimeMode(BALANCED_TIME_MODES[nextIndex].value);
  };

  const handleCustomTempoChange = (_: Event, value: number | number[]) => {
    const nextTempo = Array.isArray(value) ? value[0] : value;
    setTempo(nextTempo);
    tempoRef.current = nextTempo;
    beatMsRef.current = 60000 / nextTempo;
    if (!keysLockedRef.current && gameModeRef.current === "custom") {
      setMaxTempo(nextTempo);
      maxTempoRef.current = nextTempo;
    }
  };

  const healProgressRatio = healComboTarget > 0 ? clamp(healProgress / healComboTarget, 0, 1) : 0;
  const comboMultiplier = getComboMultiplier(combo);
  const playAreaWidth = compactMode ? "min(760px, 100%)" : "min(1100px, 100%)";
  const modeDisplayLabel = gameMode === "progressive" ? "Progressive" : MODE_LABELS[gameMode];
  const modeColor = displayPreset?.color ?? "#38d9a9";
  const keyListLabel = formatKeyList(activeKeys);
  const paused = keysLocked && !running && !gameOver;
  const balancedTimeDisplay =
    balancedTimeLimitMs === null
      ? formatDuration(balancedElapsedMs)
      : formatDuration(Math.max(0, balancedTimeLimitMs - balancedElapsedMs));
  const modeLeaderboardEntries = leaderboard
    .filter((entry) => entry.mode === leaderboardMode)
    .sort((a, b) => b.score - a.score || new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);
  const recentLeaderboardEntries = [...leaderboard]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
  const displayedLeaderboardEntries =
    leaderboardView === "leaderboard" ? modeLeaderboardEntries : recentLeaderboardEntries;
  const leaderboardTitle = leaderboardView === "recent" ? "Most Recent" : "Local Leaderboard";
  const currentModeLeaderboardScores = leaderboard
    .filter((entry) => entry.mode === modeDisplayLabel)
    .map((entry) => entry.score);
  const bestScoreForCurrentMode = Math.max(pointScore, 0, ...currentModeLeaderboardScores);
  const currentModeRank =
    pointScore > 0 ? 1 + currentModeLeaderboardScores.filter((score) => score > pointScore).length : null;

  useEffect(() => {
    if (!gameOver || !keysLocked || runSavedRef.current) return;
    if (pointScore === 0 && hits === 0 && missedNotes === 0 && mistakes === 0) return;

    runSavedRef.current = true;
    const entry: LeaderboardEntry = {
      id: `${Date.now()}-${Math.round(Math.random() * 100000)}`,
      score: pointScore,
      mode: modeDisplayLabel,
      keys: keyListLabel,
      maxTempo,
      correct: hits,
      missed: missedNotes,
      wrong: mistakes,
      date: new Date().toISOString(),
    };
    setLeaderboard(saveDdrLeaderboardEntry(entry));
  }, [gameOver, hits, keyListLabel, keysLocked, maxTempo, missedNotes, mistakes, modeDisplayLabel, pointScore]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        color: "#f8fafc",
        bgcolor: "#05070d",
        position: "relative",
        overflow: "hidden",
        cursor: MUTED_CURSOR,
        "& *": {
          cursor: `${MUTED_CURSOR} !important`,
        },
      }}
    >
      {mistakeToken > 0 && (
        <Box
          aria-hidden
          key={mistakeToken}
          sx={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            animation: `${mistakeFlash} 220ms ease-out forwards`,
          }}
        />
      )}

      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: "rgba(5, 7, 13, 0.92)",
          color: "#f8fafc",
          borderBottom: "1px solid rgba(255,255,255,0.12)",
          backdropFilter: "blur(12px)",
        }}
      >
        <Toolbar
          sx={{
            gap: 2,
            alignItems: "center",
            flexWrap: "wrap",
            py: 1.25,
            minHeight: "auto",
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: { xs: "100%", md: 232 } }}>
            <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: 0 }}>
              Home Row DDR
            </Typography>
            <Chip
              size="small"
              label={modeDisplayLabel}
              sx={{
                bgcolor: `${modeColor}24`,
                color: modeColor,
                fontWeight: 900,
                borderRadius: 1,
                border: `1px solid ${modeColor}66`,
              }}
            />
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="Restart">
              <IconButton color="inherit" onClick={resetGame} aria-label="Restart">
                <RestartAltIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={soundOn ? "Mute beat" : "Unmute beat"}>
              <IconButton
                color="inherit"
                onClick={() =>
                  setSoundOn((previous) => {
                    const next = !previous;
                    if (next) prime();
                    return next;
                  })
                }
                aria-label="Toggle beat sound"
              >
                {soundOn ? <VolumeUpIcon /> : <VolumeOffIcon />}
              </IconButton>
            </Tooltip>
          </Stack>

          <Stack direction="row" spacing={0.75} alignItems="center">
            <Typography sx={{ color: "#cbd5e1", fontSize: "0.82rem", fontWeight: 800 }}>(h)ints</Typography>
            <Switch
              checked={showKeyLetters}
              onChange={(event) => setShowKeyLetters(event.target.checked)}
              size="small"
              inputProps={{ "aria-label": "Show hints" }}
              sx={{
                "& .MuiSwitch-switchBase.Mui-checked": { color: "#38d9a9" },
                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: "#38d9a9" },
              }}
            />
          </Stack>

          <Stack direction="row" spacing={0.75} alignItems="center">
            <Typography sx={{ color: "#cbd5e1", fontSize: "0.82rem", fontWeight: 800 }}>(c)ompact</Typography>
            <Switch
              checked={compactMode}
              disabled={keysLocked}
              onChange={(event) => setCompactMode(event.target.checked)}
              size="small"
              inputProps={{ "aria-label": "Compact mode" }}
              sx={{
                "& .MuiSwitch-switchBase.Mui-checked": { color: "#38d9a9" },
                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: "#38d9a9" },
              }}
            />
          </Stack>

          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            flexWrap="wrap"
            aria-label="Key stats"
            sx={{
              color: "rgba(226,232,240,0.72)",
              fontSize: "0.74rem",
              fontWeight: 900,
            }}
          >
            <Chip
              size="small"
              label={`Correct ${hits}`}
              sx={{ bgcolor: "rgba(34,197,94,0.12)", color: "rgba(187,247,208,0.8)", borderRadius: 1, fontWeight: 900 }}
            />
            <Chip
              size="small"
              label={`Missed ${missedNotes}`}
              sx={{ bgcolor: "rgba(250,204,21,0.11)", color: "rgba(254,240,138,0.78)", borderRadius: 1, fontWeight: 900 }}
            />
            <Chip
              size="small"
              label={`Wrong ${mistakes}`}
              sx={{ bgcolor: "rgba(248,113,113,0.11)", color: "rgba(254,202,202,0.76)", borderRadius: 1, fontWeight: 900 }}
            />
            <Chip
              size="small"
              label={`Max BPM ${maxTempo}`}
              sx={{ bgcolor: "rgba(125,211,252,0.1)", color: "rgba(186,230,253,0.74)", borderRadius: 1, fontWeight: 900 }}
            />
            {isBalancedPracticeMode(gameMode) && (
              <Chip
                size="small"
                label={`Avg BPM ${averageTempo}`}
                sx={{
                  bgcolor: "rgba(56,217,169,0.1)",
                  color: "rgba(167,243,208,0.74)",
                  borderRadius: 1,
                  fontWeight: 900,
                }}
              />
            )}
          </Stack>

          <Box sx={{ flexGrow: 1 }} />

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent="flex-end"
            sx={{ minWidth: { xs: "100%", sm: 160 }, color: "rgba(148,163,184,0.58)" }}
          >
            {levelUpToken > 0 && (
              <Stack
                key={levelUpToken}
                direction="row"
                spacing={0.25}
                alignItems="center"
                onAnimationEnd={() => setLevelUpToken(0)}
                sx={{
                  color: "rgba(125,211,252,0.62)",
                  fontSize: "0.72rem",
                  fontWeight: 950,
                  animation: `${tempoStepPulse} 720ms ease-out forwards`,
                }}
              >
                <ArrowUpwardIcon sx={{ fontSize: 16 }} />
                <Typography component="span" sx={{ fontSize: "0.72rem", fontWeight: 950 }}>
                  tempo
                </Typography>
              </Stack>
            )}
            <Typography sx={{ fontSize: { xs: 18, sm: 22 }, fontWeight: 950, letterSpacing: 0 }}>
              {tempo} BPM
            </Typography>
          </Stack>
        </Toolbar>
      </AppBar>

      <Modal
        open={leaderboardOpen}
        onClose={() => {
          setLeaderboardOpen(false);
          setLeaderboardViewMenuOpen(false);
        }}
        aria-labelledby="ddr-leaderboard-title"
      >
        <Box
          ref={leaderboardScrollRef}
          sx={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "min(1120px, calc(100vw - 32px))",
            height: "min(78vh, 680px)",
            maxHeight: "min(78vh, 680px)",
            overflowY: "auto",
            boxSizing: "border-box",
            borderRadius: 1,
            border: "1px solid rgba(255,255,255,0.16)",
            bgcolor: "#05070d",
            color: "#f8fafc",
            boxShadow: "0 30px 90px rgba(0,0,0,0.48)",
            p: { xs: 2, sm: 2.5 },
          }}
        >
          <Box
            component="button"
            type="button"
            onClick={() => {
              setLeaderboardOpen(false);
              setLeaderboardViewMenuOpen(false);
            }}
            aria-label="Back to menu"
            sx={{
              appearance: "none",
              border: 0,
              bgcolor: "transparent",
              color: "rgba(203,213,225,0.74)",
              cursor: "pointer",
              font: "inherit",
              fontSize: "0.78rem",
              fontWeight: 900,
              letterSpacing: 0,
              lineHeight: 1,
              p: 0,
              mb: 1.4,
              textTransform: "lowercase",
              "&:hover": {
                color: "#f8fafc",
                textDecoration: "underline",
                textUnderlineOffset: "3px",
              },
              "&:focus-visible": {
                outline: "2px solid rgba(125,211,252,0.72)",
                outlineOffset: "4px",
              },
            }}
          >
            (b) back
          </Box>

          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
            <Typography id="ddr-leaderboard-title" sx={{ fontWeight: 950, fontSize: { xs: 20, sm: 24 } }}>
              {leaderboardTitle}
            </Typography>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }} sx={{ mt: 2 }}>
            <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 180 } }}>
              <InputLabel sx={{ color: "#cbd5e1" }}>View (v)</InputLabel>
              <Select
                value={leaderboardView}
                label="View (v)"
                open={leaderboardViewMenuOpen}
                onOpen={() => setLeaderboardViewMenuOpen(true)}
                onClose={() => setLeaderboardViewMenuOpen(false)}
                onChange={(event) => {
                  setLeaderboardView(event.target.value as LeaderboardView);
                  setLeaderboardViewMenuOpen(false);
                }}
                sx={{
                  color: "#f8fafc",
                  ".MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.2)" },
                  ".MuiSvgIcon-root": { color: "#f8fafc" },
                }}
              >
                <MenuItem value="leaderboard">Leaderboard</MenuItem>
                <MenuItem value="recent">Most recent</MenuItem>
              </Select>
            </FormControl>
            <Typography
              sx={{
                color: "rgba(148,163,184,0.76)",
                fontSize: "0.74rem",
                fontWeight: 850,
                lineHeight: 1.35,
              }}
            >
              (i)/(k) scroll - (j)/(l) modes - View: (i)/(k) choose, Enter closes
            </Typography>
          </Stack>

          {leaderboardView === "leaderboard" && (
            <Tabs
              value={leaderboardMode}
              onChange={(_, value: string) => setLeaderboardMode(value)}
              variant="scrollable"
              scrollButtons="auto"
              aria-label="Leaderboard modes"
              sx={{
                mt: 1.5,
                minHeight: 38,
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                "& .MuiTab-root": {
                  color: "rgba(203,213,225,0.68)",
                  fontWeight: 900,
                  minHeight: 38,
                  px: 1.25,
                  mx: 0.2,
                  border: "1px solid transparent",
                  borderRadius: 1,
                  textTransform: "none",
                  transition: "background-color 140ms ease, border-color 140ms ease, color 140ms ease",
                },
                "& .MuiTab-root.Mui-selected": {
                  color: "#f8fafc",
                  bgcolor: "rgba(56,217,169,0.16)",
                  borderColor: "rgba(56,217,169,0.5)",
                  boxShadow: "inset 0 0 0 1px rgba(56,217,169,0.12)",
                },
                "& .MuiTabs-indicator": { bgcolor: "#38d9a9" },
              }}
            >
              {LEADERBOARD_MODE_LABELS.map((modeLabel) => (
                <Tab key={modeLabel} value={modeLabel} label={modeLabel} />
              ))}
            </Tabs>
          )}

          <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.1)" }} />

          {displayedLeaderboardEntries.length === 0 ? (
            <Typography sx={{ color: "rgba(148,163,184,0.76)", fontWeight: 800 }}>
              {leaderboardView === "leaderboard" ? `No ${leaderboardMode} runs yet.` : "No finished runs yet."}
            </Typography>
          ) : (
            <Stack spacing={1}>
              {displayedLeaderboardEntries.map((entry, index) => (
                <Box
                  key={entry.id}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "34px 1fr", sm: "34px 1fr auto" },
                    gap: 1,
                    alignItems: "center",
                    p: 1.1,
                    borderRadius: 1,
                    bgcolor: "rgba(255,255,255,0.045)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <Typography sx={{ color: "rgba(148,163,184,0.7)", fontWeight: 950 }}>#{index + 1}</Typography>
                  <Box>
                    <Typography sx={{ fontWeight: 950 }}>
                      {entry.score.toLocaleString()} pts - {entry.mode}
                    </Typography>
                    <Typography sx={{ color: "rgba(148,163,184,0.72)", fontSize: "0.78rem", fontWeight: 800 }}>
                      {entry.keys} - max {entry.maxTempo} BPM - {entry.correct} correct - {entry.missed} missed - {entry.wrong} wrong
                    </Typography>
                  </Box>
                  <Typography
                    sx={{
                      display: { xs: "none", sm: "block" },
                      color: "rgba(148,163,184,0.58)",
                      fontSize: "0.74rem",
                      fontWeight: 800,
                    }}
                  >
                    {new Date(entry.date).toLocaleDateString()}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      </Modal>

      <Box
        component="main"
        sx={{
          position: "relative",
          zIndex: 1,
          height: "calc(100vh - 88px)",
          minHeight: compactMode ? 420 : 560,
          display: "grid",
          gridTemplateRows: "1fr auto",
          px: { xs: 1.5, sm: 2.5, md: 4 },
          py: compactMode ? { xs: 1, md: 1.5 } : { xs: 2, md: 3 },
          gap: compactMode ? 1 : 2,
        }}
      >
        <Box
          ref={stageRef}
          sx={{
            width: playAreaWidth,
            mx: "auto",
            position: "relative",
            display: "grid",
            gridTemplateColumns: noteColumns,
            gap: compactMode ? { xs: 0.45, sm: 0.65, md: 0.8 } : { xs: 0.7, sm: 1, md: 1.25 },
            alignItems: "stretch",
            minHeight: 0,
            mt: compactMode ? { xs: 1, md: 2 } : { xs: 3, md: 5 },
          }}
        >
          {isBalancedPracticeMode(gameMode) && (
            <Typography
              aria-label="Run time"
              sx={{
                position: "absolute",
                top: { xs: 4, sm: 6, md: 8 },
                right: { xs: 0, sm: 2 },
                zIndex: 3,
                color: "rgba(148,163,184,0.24)",
                fontSize: { xs: 26, sm: 38, md: 48 },
                fontWeight: 950,
                lineHeight: 1,
                letterSpacing: 0,
                pointerEvents: "none",
                textAlign: "right",
              }}
            >
              {balancedTimeDisplay}
            </Typography>
          )}

          {!keysLocked && !gameOver && (
            <Box
              aria-hidden
              sx={{
                position: "absolute",
                inset: 0,
                zIndex: 4,
                pointerEvents: "none",
                bgcolor: "rgba(2,6,23,0.42)",
                backdropFilter: "blur(7px)",
                WebkitBackdropFilter: "blur(7px)",
              }}
            />
          )}

          {!keysLocked && !gameOver && (
            <Box
              role="dialog"
              aria-label="DDR start menu"
              sx={{
                position: "absolute",
                left: "50%",
                top: "48%",
                transform: "translate(-50%, -50%)",
                zIndex: 5,
                width: "min(760px, calc(100vw - 32px))",
                maxHeight: "min(78vh, 720px)",
                overflowY: "auto",
                px: { xs: 2, sm: 3 },
                py: { xs: 2, sm: 2.5 },
                borderRadius: 1,
                border: "1px solid rgba(255,255,255,0.16)",
                bgcolor: "rgba(8,13,25,0.96)",
                boxShadow: "0 28px 90px rgba(0,0,0,0.58), 0 0 0 1px rgba(255,255,255,0.06)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
              }}
            >
              <Stack spacing={2}>
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5}>
                  <Box>
                    <Typography sx={{ color: "rgba(248,250,252,0.9)", fontWeight: 950, fontSize: { xs: 22, sm: 28 } }}>
                      Press Tab to start
                    </Typography>
                    <Typography sx={{ color: "rgba(148,163,184,0.72)", fontWeight: 800, fontSize: "0.82rem" }}>
                      {tempo} BPM - {startingHearts} hearts - regen {healComboTarget}
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    startIcon={<LeaderboardIcon />}
                    onClick={() => {
                      setLeaderboardMode(modeDisplayLabel);
                      setLeaderboardOpen(true);
                    }}
                    sx={{
                      alignSelf: { xs: "stretch", sm: "center" },
                      borderColor: "rgba(148,163,184,0.28)",
                      color: "rgba(226,232,240,0.82)",
                      fontWeight: 900,
                    }}
                  >
                    (l) Leaderboard
                  </Button>
                </Stack>

                <Divider sx={{ borderColor: "rgba(255,255,255,0.1)" }} />

                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                  <FormControl size="small" sx={{ minWidth: { xs: "100%", md: 210 } }}>
                    <InputLabel sx={{ color: modeShortcutActive ? "#7dd3fc" : "#cbd5e1" }}>(m)ode</InputLabel>
                    <Select
                      value={gameMode}
                      label="(m)ode"
                      onChange={handleGameModeChange}
                      sx={{
                        color: "#f8fafc",
                        ".MuiOutlinedInput-notchedOutline": {
                          borderColor: modeShortcutActive ? "rgba(125,211,252,0.86)" : "rgba(255,255,255,0.2)",
                        },
                        ".MuiSvgIcon-root": { color: "#f8fafc" },
                      }}
                    >
                      <MenuItem value="balancedPlus">Balanced+</MenuItem>
                      <MenuItem value="balanced">Balanced</MenuItem>
                      <MenuItem value="progressive">Progressive</MenuItem>
                      {LEAGUE_ORDER.map((leagueMode) => (
                        <MenuItem key={leagueMode} value={leagueMode}>
                          {LEAGUE_PRESETS[leagueMode].label}
                        </MenuItem>
                      ))}
                      <MenuItem value="custom">Custom</MenuItem>
                    </Select>
                    <Typography sx={{ mt: 0.45, color: "rgba(148,163,184,0.68)", fontSize: "0.68rem", fontWeight: 800 }}>
                      (d)own - (e)levate - (Enter) select
                    </Typography>
                  </FormControl>

                  <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Typography sx={{ color: "#cbd5e1", fontSize: "0.82rem", fontWeight: 800 }}>(h)ints</Typography>
                      <Switch
                        checked={showKeyLetters}
                        onChange={(event) => setShowKeyLetters(event.target.checked)}
                        size="small"
                        inputProps={{ "aria-label": "Show hints" }}
                        sx={{
                          "& .MuiSwitch-switchBase.Mui-checked": { color: "#38d9a9" },
                          "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: "#38d9a9" },
                        }}
                      />
                    </Stack>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Typography sx={{ color: "#cbd5e1", fontSize: "0.82rem", fontWeight: 800 }}>(c)ompact</Typography>
                      <Switch
                        checked={compactMode}
                        onChange={(event) => setCompactMode(event.target.checked)}
                        size="small"
                        inputProps={{ "aria-label": "Compact mode" }}
                        sx={{
                          "& .MuiSwitch-switchBase.Mui-checked": { color: "#38d9a9" },
                          "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: "#38d9a9" },
                        }}
                      />
                    </Stack>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Typography sx={{ color: "#cbd5e1", fontSize: "0.82rem", fontWeight: 800 }}>(r)andom</Typography>
                      <Switch
                        checked={randomKeysEnabled}
                        onChange={(event) => setRandomKeysEnabled(event.target.checked)}
                        size="small"
                        inputProps={{ "aria-label": "Random key set" }}
                        sx={{
                          "& .MuiSwitch-switchBase.Mui-checked": { color: "#7dd3fc" },
                          "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: "#7dd3fc" },
                        }}
                      />
                    </Stack>
                  </Stack>
                </Stack>

                {randomKeysEnabled && (
                  <Box sx={{ maxWidth: 460 }}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Typography sx={{ color: "#cbd5e1", fontSize: "0.78rem", fontWeight: 900, minWidth: 116 }}>
                        Random keys {randomKeyCount}
                      </Typography>
                      <Slider
                        min={MIN_ACTIVE_KEYS}
                        max={MAX_RANDOM_ACTIVE_KEYS}
                        step={1}
                        marks
                        value={randomKeyCount}
                        onChange={(_, value) =>
                          setRandomKeyCount(clamp(Array.isArray(value) ? value[0] : value, MIN_ACTIVE_KEYS, MAX_RANDOM_ACTIVE_KEYS))
                        }
                        size="small"
                        sx={{ color: "#7dd3fc" }}
                        aria-label="Number of random keys"
                      />
                    </Stack>
                    <Typography sx={{ color: "rgba(148,163,184,0.68)", fontSize: "0.68rem", fontWeight: 800 }}>
                      (j) less - drag slider for more
                    </Typography>
                  </Box>
                )}

                {isBalancedPracticeMode(gameMode) && (
                  <Box sx={{ width: "100%", maxWidth: 690 }}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} alignItems={{ xs: "stretch", sm: "center" }}>
                      <Typography sx={{ color: "#cbd5e1", fontSize: "0.78rem", fontWeight: 900, minWidth: 132 }}>
                        Time {BALANCED_TIME_MODES[Math.max(0, balancedTimeModeIndex)].label}
                      </Typography>
                      <Slider
                        min={0}
                        max={BALANCED_TIME_MODES.length - 1}
                        step={1}
                        marks={BALANCED_TIME_MODES.map((mode, index) => ({
                          value: index,
                          label:
                            mode.value === "unlimited"
                              ? "Open"
                              : formatDuration(getBalancedTimeLimitMs(mode.value, gameMode) ?? 0),
                        }))}
                        value={Math.max(0, balancedTimeModeIndex)}
                        onChange={handleBalancedTimeModeChange}
                        size="small"
                        sx={{
                          color: "#38d9a9",
                          "& .MuiSlider-markLabel": {
                            color: "rgba(203,213,225,0.7)",
                            fontSize: "0.68rem",
                            fontWeight: 800,
                          },
                        }}
                        aria-label="Balanced time mode"
                      />
                    </Stack>
                    <Typography sx={{ color: "rgba(148,163,184,0.68)", fontSize: "0.68rem", fontWeight: 800 }}>
                      (s) shorter - (f) farther
                    </Typography>
                  </Box>
                )}

                <Box
                  sx={{
                    mx: -1,
                    p: 1,
                    borderRadius: 1,
                    border: keyEditActive ? "1px solid rgba(56,217,169,0.68)" : "1px solid transparent",
                    bgcolor: keyEditActive ? "rgba(56,217,169,0.08)" : "transparent",
                    boxShadow: keyEditActive ? "0 0 0 3px rgba(56,217,169,0.1)" : "none",
                    transition: "background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
                  }}
                >
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={0.75} justifyContent="space-between" sx={{ mb: 1 }}>
                    <Typography sx={{ color: keyEditActive ? "#d1fae5" : "#cbd5e1", fontSize: "0.82rem", fontWeight: 900 }}>
                      (k)eys
                    </Typography>
                    {keyEditActive && (
                      <Typography sx={{ color: "rgba(148,163,184,0.7)", fontSize: "0.68rem", fontWeight: 800 }}>
                        press Enter to lock
                      </Typography>
                    )}
                  </Stack>
                  <ToggleButtonGroup
                    value={randomKeysEnabled ? ALL_HOME_KEY_VALUES : activeKeys}
                    onChange={randomKeysEnabled ? undefined : handleActiveKeysChange}
                    size="small"
                    aria-label="Active home row keys"
                    sx={{
                      flexWrap: "wrap",
                      gap: 0.6,
                      "& .MuiToggleButtonGroup-grouped": {
                        border: "1px solid rgba(255,255,255,0.22) !important",
                        borderRadius: "6px !important",
                      },
                    }}
                  >
                    {HOME_KEYS.map((homeKey, keyIndex) => (
                      <ToggleButton
                        key={homeKey.key}
                        value={homeKey.key}
                        aria-label={`${homeKey.label} key`}
                        sx={{
                          color: "#e2e8f0",
                          minWidth: homeKey.widthUnits === 2 ? 92 : 42,
                          px: homeKey.widthUnits === 2 ? 1.75 : 1,
                          fontWeight: 900,
                          animation: randomKeysEnabled ? `${randomKeyFade} 1350ms ease-in-out infinite` : "none",
                          animationDelay: randomKeysEnabled ? `${randomKeyFlashDelays[keyIndex]}ms` : "0ms",
                          "&.Mui-selected": {
                            color: "#05070d",
                            bgcolor: homeKey.color,
                            "&:hover": { bgcolor: homeKey.color },
                          },
                        }}
                      >
                        {homeKey.label}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Box>

                {isCustomMode && (
                  <Stack spacing={1.75}>
                    <Divider sx={{ borderColor: "rgba(255,255,255,0.1)" }} />
                    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                      <Box sx={{ flex: 1, minWidth: 180 }}>
                        <Stack direction="row" spacing={1.25} alignItems="center">
                          <Typography sx={{ color: "#cbd5e1", fontSize: "0.78rem", fontWeight: 900, minWidth: 72 }}>
                            {tempo} BPM
                          </Typography>
                          <Slider
                            size="small"
                            min={TEMPO_MIN}
                            max={TEMPO_MAX}
                            step={2}
                            value={tempo}
                            onChange={handleCustomTempoChange}
                            sx={{ color: "#38d9a9" }}
                            aria-label="Tempo"
                          />
                        </Stack>
                      </Box>
                      <FormControl size="small" sx={{ minWidth: { xs: "100%", md: 160 } }}>
                        <InputLabel sx={{ color: "#cbd5e1" }}>Rhythm</InputLabel>
                        <Select
                          value={rhythmMode}
                          label="Rhythm"
                          onChange={(event) => setRhythmMode(event.target.value as RhythmMode)}
                          sx={{
                            color: "#f8fafc",
                            ".MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.2)" },
                            ".MuiSvgIcon-root": { color: "#f8fafc" },
                          }}
                        >
                          {Object.entries(RHYTHM_PATTERNS).map(([rhythmKey, pattern]) => (
                            <MenuItem key={rhythmKey} value={rhythmKey}>
                              {pattern.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Stack>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                      <Box sx={{ flex: 1, minWidth: 180 }}>
                        <Stack direction="row" spacing={1.25} alignItems="center">
                          <Typography sx={{ color: "#cbd5e1", fontSize: "0.78rem", fontWeight: 900, minWidth: 76 }}>
                            Hearts {startingHearts}
                          </Typography>
                          <Slider
                            min={MIN_STARTING_HEARTS}
                            max={MAX_STARTING_HEARTS}
                            step={1}
                            value={startingHearts}
                            onChange={handleStartingHeartsChange}
                            size="small"
                            sx={{ color: "#38d9a9" }}
                            aria-label="Starting hearts"
                          />
                        </Stack>
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 180 }}>
                        <Stack direction="row" spacing={1.25} alignItems="center">
                          <Typography sx={{ color: "#cbd5e1", fontSize: "0.78rem", fontWeight: 900, minWidth: 76 }}>
                            Regen {healComboTarget}
                          </Typography>
                          <Slider
                            min={MIN_HEAL_COMBO_TARGET}
                            max={MAX_HEAL_COMBO_TARGET}
                            step={1}
                            value={healComboTarget}
                            onChange={handleHealComboTargetChange}
                            size="small"
                            sx={{ color: "#38d9a9" }}
                            aria-label="Consecutive correct hits to regain a heart"
                          />
                        </Stack>
                      </Box>
                    </Stack>
                  </Stack>
                )}
              </Stack>
            </Box>
          )}

          {paused && (
            <Box
              role="dialog"
              aria-label="Game paused"
              sx={{
                position: "absolute",
                left: "50%",
                top: "48%",
                transform: "translate(-50%, -50%)",
                zIndex: 5,
                px: { xs: 3, sm: 4 },
                py: { xs: 2.25, sm: 3 },
                borderRadius: 1,
                border: "1px solid rgba(255,255,255,0.14)",
                bgcolor: "rgba(5,7,13,0.86)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.38)",
                backdropFilter: "blur(10px)",
                textAlign: "center",
              }}
            >
              <Typography sx={{ color: "rgba(248,250,252,0.9)", fontWeight: 950, fontSize: { xs: 28, sm: 38 } }}>
                paused
              </Typography>
              <Typography sx={{ mt: 1, color: "rgba(226,232,240,0.72)", fontWeight: 850, fontSize: { xs: 14, sm: 16 } }}>
                press (tab) to continue
              </Typography>
              <Typography sx={{ mt: 0.75, color: "rgba(226,232,240,0.58)", fontWeight: 800, fontSize: { xs: 13, sm: 15 } }}>
                press (r) to restart
              </Typography>
              <Typography sx={{ mt: 0.75, color: "rgba(226,232,240,0.5)", fontWeight: 800, fontSize: { xs: 13, sm: 15 } }}>
                press (m) to go back to the menu
              </Typography>
            </Box>
          )}

          {gameOver && keysLocked && (
            <Box
              role="dialog"
              aria-label="Round finished"
              sx={{
                position: "absolute",
                left: "50%",
                top: "48%",
                transform: "translate(-50%, -50%)",
                zIndex: 5,
                width: "min(560px, calc(100vw - 32px))",
                px: { xs: 2.5, sm: 3.5 },
                py: { xs: 2.5, sm: 3.25 },
                borderRadius: 1,
                border: "1px solid rgba(255,255,255,0.14)",
                bgcolor: "rgba(5,7,13,0.9)",
                boxShadow: "0 24px 80px rgba(0,0,0,0.48)",
                backdropFilter: "blur(12px)",
                textAlign: "center",
              }}
            >
              <Typography sx={{ color: "rgba(248,250,252,0.94)", fontWeight: 950, fontSize: { xs: 34, sm: 46 } }}>
                finished!
              </Typography>
              <Typography sx={{ color: "rgba(148,163,184,0.78)", fontWeight: 850, fontSize: "0.86rem" }}>
                {roundResult === "complete" ? "time complete" : "hearts empty"}
              </Typography>
              <Typography sx={{ mt: 2, color: "rgba(248,250,252,0.9)", fontWeight: 950, fontSize: { xs: 36, sm: 52 }, lineHeight: 1 }}>
                {pointScore.toLocaleString()}
              </Typography>
              <Typography sx={{ color: "rgba(148,163,184,0.66)", fontWeight: 850, fontSize: "0.78rem" }}>
                score
              </Typography>
              <Box
                sx={{
                  mt: 2,
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" },
                  gap: 1,
                }}
              >
                {[
                  ["Best", bestScoreForCurrentMode.toLocaleString()],
                  ["Rank", currentModeRank === null ? "-" : `#${currentModeRank}`],
                  ["Correct", hits.toLocaleString()],
                  ["Missed", missedNotes.toLocaleString()],
                  ["Wrong", mistakes.toLocaleString()],
                  ["Max BPM", maxTempo.toLocaleString()],
                  ["Mode", modeDisplayLabel],
                  ["Keys", keyListLabel],
                ].map(([label, value]) => (
                  <Box
                    key={label}
                    sx={{
                      p: 1,
                      borderRadius: 1,
                      bgcolor: "rgba(255,255,255,0.045)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      minWidth: 0,
                    }}
                  >
                    <Typography sx={{ color: "rgba(148,163,184,0.66)", fontSize: "0.68rem", fontWeight: 850 }}>
                      {label}
                    </Typography>
                    <Typography sx={{ color: "rgba(248,250,252,0.88)", fontSize: "0.82rem", fontWeight: 950, overflowWrap: "anywhere" }}>
                      {value}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Typography sx={{ mt: 2, color: "rgba(226,232,240,0.62)", fontWeight: 800, fontSize: "0.78rem" }}>
                press (r) to restart - press (m) for menu
              </Typography>
            </Box>
          )}

          {tempoMarkers.length > 0 && (
            <Box
              aria-hidden
              sx={{
                position: "absolute",
                inset: 0,
                zIndex: 2,
                display: "grid",
                gridTemplateColumns: noteColumns,
                gap: compactMode ? { xs: 0.45, sm: 0.65, md: 0.8 } : { xs: 0.7, sm: 1, md: 1.25 },
                pointerEvents: "none",
              }}
            >
              {tempoMarkers.map((marker) => (
                <Box
                  key={marker.id}
                  sx={{
                    gridColumn: `${marker.leftLaneIndex + 1} / ${marker.rightLaneIndex + 2}`,
                    position: "relative",
                    minHeight: 0,
                  }}
                >
                  <Box
                    sx={{
                      "--note-end-y": `${noteEndY}px`,
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: { xs: 3, sm: 4, md: 5 },
                      borderRadius: 999,
                      bgcolor: "rgba(125,211,252,0.76)",
                      boxShadow: "0 0 20px rgba(125,211,252,0.72)",
                      transform: "translate3d(0, -80px, 0)",
                      willChange: "transform, opacity",
                      animation: `${tempoMarkerFall} ${NOTE_ANIMATION_DURATION_MS}ms linear ${marker.animationDelayMs}ms both`,
                      animationPlayState: running ? "running" : "paused",
                    }}
                  />
                </Box>
              ))}
            </Box>
          )}

          {HOME_KEYS.map((homeKey, laneIndex) => {
            const active = (!keysLocked && randomKeysEnabled) || activeKeySet.has(homeKey.key);
            const laneNotes = notesByLane[laneIndex];
            const shouldPulse = pulseLane?.laneIndex === laneIndex;
            const widthUnits = homeKey.widthUnits ?? 1;
            const currentNoteWidth = scaleSize(noteWidth, widthUnits);
            const currentTargetWidth = scaleSize(targetSize, widthUnits);

            return (
              <Box
                key={homeKey.key}
                role="button"
                aria-label={`Toggle ${homeKey.label} key`}
                onClick={() => handleLaneClick(homeKey.key)}
                sx={{
                  gridColumn: getLaneGridColumn(laneIndex),
                  position: "relative",
                  zIndex: 1,
                  borderLeft: "1px solid rgba(255,255,255,0.08)",
                  borderRight: "1px solid rgba(255,255,255,0.08)",
                  contain: "layout paint style",
                  background: active
                    ? `linear-gradient(180deg, ${homeKey.color}1f, rgba(255,255,255,0.03))`
                    : "rgba(255,255,255,0.025)",
                  opacity: active ? 1 : 0.34,
                  cursor: !keysLocked && !gameOver ? "pointer" : "default",
                  animation:
                    !keysLocked && randomKeysEnabled ? `${randomKeyFade} 1350ms ease-in-out infinite` : "none",
                  animationDelay: !keysLocked && randomKeysEnabled ? `${randomKeyFlashDelays[laneIndex]}ms` : "0ms",
                }}
              >
                {laneNotes.map((note) => {
                  return (
                    <Box
                      key={note.id}
                      sx={{
                        "--note-end-y": `${noteEndY}px`,
                        position: "absolute",
                        top: 0,
                        left: "50%",
                        transform: "translate3d(-50%, -80px, 0)",
                        zIndex: 2,
                        width: currentNoteWidth,
                        height: noteHeight,
                        bgcolor: homeKey.color,
                        borderRadius: widthUnits > 1 ? 1.5 : 1,
                        willChange: "transform, opacity",
                        animation: `${noteFall} ${NOTE_ANIMATION_DURATION_MS}ms linear ${note.animationDelayMs}ms both`,
                        animationPlayState: running ? "running" : "paused",
                        pointerEvents: "none",
                      }}
                    />
                  );
                })}

                <Box
                  key={`${homeKey.key}-${shouldPulse ? pulseLane?.token : "idle"}`}
                  sx={{
                    position: "absolute",
                    top: `${HIT_LINE_PERCENT}%`,
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    zIndex: 3,
                    width: currentTargetWidth,
                    height: targetSize,
                    borderRadius: widthUnits > 1 ? 1.5 : 1,
                    border: `3px solid ${active ? homeKey.color : "rgba(255,255,255,0.18)"}`,
                    bgcolor: active ? "#07110f" : "#070910",
                    "--target-rest-shadow": active ? `0 0 18px ${homeKey.color}55` : "none",
                    "--target-pulse-shadow": active
                      ? `0 0 0 5px ${homeKey.color}3d, 0 0 30px ${homeKey.color}, 0 0 56px ${homeKey.color}99`
                      : "0 0 16px rgba(255,255,255,0.2)",
                    display: "grid",
                    placeItems: "center",
                    boxShadow: "var(--target-rest-shadow)",
                    animation: shouldPulse ? `${targetPulse} 260ms ease-out` : "none",
                  }}
                >
                  {showKeyLetters && (
                    <Typography
                      component="span"
                      sx={{
                        color: active ? homeKey.color : "rgba(255,255,255,0.28)",
                        fontWeight: 900,
                        fontSize:
                          widthUnits > 1
                            ? { xs: 10, sm: 12, md: 14 }
                            : { xs: 13, sm: 16, md: 18 },
                        lineHeight: 1,
                        textTransform: "uppercase",
                        textShadow: active ? `0 0 12px ${homeKey.color}99` : "none",
                        userSelect: "none",
                      }}
                    >
                      {homeKey.targetLabel}
                    </Typography>
                  )}
                </Box>
              </Box>
            );
          })}

          <Box
            sx={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${HIT_LINE_PERCENT}%`,
              height: 2,
              bgcolor: "rgba(255,255,255,0.48)",
              boxShadow: "0 0 16px rgba(255,255,255,0.42)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        </Box>

        <Stack
          spacing={0.85}
          sx={{
            width: playAreaWidth,
            mx: "auto",
            minHeight: 96,
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minHeight: 44 }}>
            <Box sx={{ minWidth: { xs: 86, sm: 150 } }}>
              {gameOver && (
                <Typography sx={{ color: "rgba(254,202,202,0.72)", fontWeight: 950, fontSize: { xs: 13, sm: 15 } }}>
                  {roundResult === "complete" ? "Run complete" : "You lose"} - press r
                </Typography>
              )}
            </Box>

            <Box sx={{ flexGrow: 1, display: "grid", placeItems: "center", minWidth: 0 }}>
              <Typography
                key={combo}
                aria-label="Combo multiplier"
                sx={{
                  color: "rgba(34,197,94,0.34)",
                  fontSize: { xs: 24, sm: 34, md: 40 },
                  fontWeight: 950,
                  lineHeight: 1,
                  letterSpacing: 0,
                  textShadow: "0 0 18px rgba(34,197,94,0.1)",
                  animation: combo > 0 ? `${comboPulse} 170ms ease-out` : "none",
                }}
              >
                x{comboMultiplier.toFixed(2)}
              </Typography>
            </Box>

            <Typography
              aria-label="Score"
              sx={{
                color: "rgba(148,163,184,0.26)",
                fontSize: { xs: 26, sm: 38, md: 48 },
                fontWeight: 950,
                lineHeight: 1,
                minWidth: { xs: 96, sm: 148 },
                textAlign: "right",
                letterSpacing: 0,
              }}
            >
              {pointScore.toLocaleString()}
            </Typography>
          </Stack>

          <Stack
            direction="row"
            justifyContent="center"
            alignItems="center"
            flexWrap="wrap"
            spacing={0.35}
            aria-label="Lives"
          >
            {Array.from({ length: startingHearts }).map((_, heartIndex) => {
              const heartFillRatio = clamp(hearts - heartIndex, 0, 1);
              const pending = !gameOver && heartFillRatio === 0 && heartIndex === Math.ceil(hearts);
              const pendingOpacity = pending ? 0.12 + healProgressRatio * 0.82 : 0;
              const heartOpacity = heartFillRatio > 0 ? heartFillRatio : pendingOpacity;

              return (
                <Box
                  key={heartIndex}
                  sx={{
                    position: "relative",
                    width: { xs: 20, sm: 24, md: 26 },
                    height: { xs: 20, sm: 24, md: 26 },
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <FavoriteBorderIcon
                    sx={{
                      position: "absolute",
                      inset: 0,
                      color: "rgba(248,113,113,0.35)",
                      fontSize: { xs: 20, sm: 24, md: 26 },
                      opacity: heartOpacity >= 1 ? 0 : 1,
                    }}
                  />
                  <FavoriteIcon
                    sx={{
                      position: "absolute",
                      inset: 0,
                      color: "#fb7185",
                      fontSize: { xs: 20, sm: 24, md: 26 },
                      opacity: heartOpacity,
                      transition: "opacity 160ms ease",
                    }}
                  />
                </Box>
              );
            })}
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
