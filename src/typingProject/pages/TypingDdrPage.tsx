import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppBar,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import MenuIcon from "@mui/icons-material/Menu";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
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
type GameMode = "progressive" | "custom" | LeagueMode;

type LeaguePreset = {
  label: string;
  color: string;
  tempo: number;
  startingHearts: number;
  healComboTarget: number;
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
const TEMPO_MIN = 48;
const TEMPO_MAX = 300;
const MIN_STARTING_HEARTS = 3;
const MAX_STARTING_HEARTS = 40;
const MIN_HEAL_COMBO_TARGET = 3;
const MAX_HEAL_COMBO_TARGET = 60;
const FALL_DURATION_MS = 2600;
const SCHEDULE_LOOKAHEAD_BEATS = 2;
const SLOW_TEMPO_HIT_WINDOW_MS = 540;
const FAST_TEMPO_HIT_WINDOW_MS = 190;
const HIT_LINE_PERCENT = 74;
const PROGRESSIVE_START_TEMPO = 80;
const PROGRESSIVE_TEMPO_STEP = 10;
const LEVEL_DURATION_MS = 30000;
const LEVEL_THREE_DURATION_MS = 20000;
const LEVEL_SEVEN_DURATION_MS = 15000;
const IDLE_PAUSE_MS = 6000;

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
    healComboTarget: 20,
  },
  silver: {
    label: "Silver",
    color: "#cbd5e1",
    tempo: 120,
    startingHearts: 10,
    healComboTarget: 18,
  },
  gold: {
    label: "Gold",
    color: "#facc15",
    tempo: 160,
    startingHearts: 8,
    healComboTarget: 14,
  },
  platinum: {
    label: "Platinum",
    color: "#7dd3fc",
    tempo: 220,
    startingHearts: 6,
    healComboTarget: 10,
  },
  titanium: {
    label: "Titanium",
    color: "#a78bfa",
    tempo: 300,
    startingHearts: 4,
    healComboTarget: 6,
  },
};

const PROGRESSIVE_PRESET: LeaguePreset = {
  ...LEAGUE_PRESETS.bronze,
  label: "Progressive",
  healComboTarget: 6,
};

const MODE_LABELS: Record<GameMode, string> = {
  progressive: "Progressive",
  custom: "Custom",
  bronze: LEAGUE_PRESETS.bronze.label,
  silver: LEAGUE_PRESETS.silver.label,
  gold: LEAGUE_PRESETS.gold.label,
  platinum: LEAGUE_PRESETS.platinum.label,
  titanium: LEAGUE_PRESETS.titanium.label,
};

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

const levelUpFlash = keyframes`
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.88);
    filter: blur(3px);
  }
  18% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.04);
    filter: blur(0);
  }
  72% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
    filter: blur(0);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.12);
    filter: blur(2px);
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
    transform: translate3d(-50%, var(--note-target-y), 0) scale(1);
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

function scaleSize(size: ResponsiveSize, multiplier: number): ResponsiveSize {
  return {
    xs: Math.round(size.xs * multiplier),
    sm: Math.round(size.sm * multiplier),
    md: Math.round(size.md * multiplier),
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

function getProgressiveTempoForLevel(level: number) {
  return clamp(PROGRESSIVE_START_TEMPO + level * PROGRESSIVE_TEMPO_STEP, PROGRESSIVE_START_TEMPO, TEMPO_MAX);
}

function getLevelDurationMs(level: number) {
  if (level >= 7) return LEVEL_SEVEN_DURATION_MS;
  if (level >= 3) return LEVEL_THREE_DURATION_MS;
  return LEVEL_DURATION_MS;
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
  if (gameMode === "progressive") return PROGRESSIVE_PRESET;
  return LEAGUE_PRESETS[gameMode];
}

function getDisplayPresetForMode(gameMode: GameMode, progressiveTempo: number) {
  if (gameMode === "custom") return null;
  if (gameMode === "progressive") return LEAGUE_PRESETS[getLeagueModeForTempo(progressiveTempo)];
  return LEAGUE_PRESETS[gameMode];
}

function getLevelAdjustedHealTarget(preset: LeaguePreset, level: number, keysLocked: boolean) {
  if (!keysLocked) {
    return preset.healComboTarget;
  }

  return preset.healComboTarget + level;
}

function formatKeyList(keys: string[]) {
  return HOME_KEYS.filter((homeKey) => keys.includes(homeKey.key))
    .map((homeKey) => homeKey.label)
    .join(" ");
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
  const [gameMode, setGameMode] = useState<GameMode>("progressive");
  const [tempo, setTempo] = useState(LEAGUE_PRESETS.bronze.tempo);
  const [rhythmMode, setRhythmMode] = useState<RhythmMode>("quarter");
  const [activeKeys, setActiveKeys] = useState<string[]>(DEFAULT_ACTIVE_KEYS);
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
  const [level, setLevel] = useState(0);
  const [healProgress, setHealProgress] = useState(0);
  const [healComboTarget, setHealComboTarget] = useState(LEAGUE_PRESETS.bronze.healComboTarget);
  const [notes, setNotes] = useState<Note[]>([]);
  const [pulseLane, setPulseLane] = useState<{ laneIndex: number; token: number } | null>(null);
  const [levelUpToken, setLevelUpToken] = useState(0);
  const [mistakeToken, setMistakeToken] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [showKeyLetters, setShowKeyLetters] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const runningRef = useRef(running);
  const gameOverRef = useRef(gameOver);
  const keysLockedRef = useRef(keysLocked);
  const notesRef = useRef(notes);
  const heartsRef = useRef(hearts);
  const comboRef = useRef(combo);
  const healProgressRef = useRef(healProgress);
  const nextBarStartRef = useRef(0);
  const nextNoteIdRef = useRef(1);
  const lastLaneRef = useRef<number | null>(null);
  const timingEventsRef = useRef<Record<string, ScheduledTimingEvent>>({});
  const pauseStartedAtRef = useRef<number | null>(null);
  const levelStartedAtRef = useRef<number | null>(null);
  const levelElapsedMsRef = useRef(0);
  const idlePauseTimeoutRef = useRef<number | null>(null);
  const soundOnRef = useRef(soundOn);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageHeight, setStageHeight] = useState(560);

  const { prime, playBeat } = useBeatSound(soundOn);
  const playBeatRef = useRef(playBeat);
  const beatMs = useMemo(() => 60000 / tempo, [tempo]);
  const beatMsRef = useRef(beatMs);
  const tempoIntensity = useMemo(() => clamp((tempo - TEMPO_MIN) / (TEMPO_MAX - TEMPO_MIN), 0, 1), [tempo]);
  const rhythmIntensity = RHYTHM_INTENSITY[rhythmMode];
  const rhythmModeRef = useRef(rhythmMode);
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
    () => (compactMode ? { xs: 22, sm: 30, md: 36 } : { xs: 28, sm: 38, md: 46 }),
    [compactMode]
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
    () => (compactMode ? { xs: 28, sm: 38, md: 46 } : { xs: 34, sm: 48, md: 58 }),
    [compactMode]
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
  const progressiveTempo = useMemo(() => getProgressiveTempoForLevel(level), [level]);
  const displayPreset = useMemo(() => getDisplayPresetForMode(gameMode, progressiveTempo), [gameMode, progressiveTempo]);
  const currentPreset = useMemo(() => getBasePresetForMode(gameMode), [gameMode]);
  const previousLevelRef = useRef(level);
  const isCustomMode = gameMode === "custom";
  const canChooseKeys = !keysLocked;

  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  useEffect(() => {
    playBeatRef.current = playBeat;
  }, [playBeat]);

  useEffect(() => {
    beatMsRef.current = beatMs;
  }, [beatMs]);

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
    heartsRef.current = hearts;
  }, [hearts]);

  useEffect(() => {
    comboRef.current = combo;
  }, [combo]);

  useEffect(() => {
    healProgressRef.current = healProgress;
  }, [healProgress]);

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

    setTempo(gameMode === "progressive" ? progressiveTempo : currentPreset.tempo);
    setRhythmMode("quarter");
    setStartingHearts(currentPreset.startingHearts);
    const nextHealComboTarget = getLevelAdjustedHealTarget(currentPreset, level, keysLockedRef.current);
    setHealComboTarget(nextHealComboTarget);
    setCompactMode(false);

    const shouldRefillHearts = !keysLockedRef.current;
    const nextHearts = shouldRefillHearts
      ? currentPreset.startingHearts
      : Math.min(heartsRef.current, currentPreset.startingHearts);
    heartsRef.current = nextHearts;
    setHearts(nextHearts);

    const nextHealProgress = Math.min(healProgressRef.current, nextHealComboTarget - 1);
    healProgressRef.current = nextHealProgress;
    setHealProgress(nextHealProgress);
  }, [currentPreset, gameMode, level, progressiveTempo]);

  useEffect(() => {
    const previousLevel = previousLevelRef.current;
    previousLevelRef.current = level;

    if (
      gameMode === "progressive" &&
      keysLockedRef.current &&
      runningRef.current &&
      level > 0 &&
      level !== previousLevel
    ) {
      setLevelUpToken((previous) => previous + 1);
    }
  }, [gameMode, level]);

  useEffect(() => {
    if (!running || gameOver || !keysLocked) return undefined;

    const currentLevelDurationMs = getLevelDurationMs(level);
    levelStartedAtRef.current = performance.now();
    const remainingMs = Math.max(0, currentLevelDurationMs - levelElapsedMsRef.current);
    const timeoutId = window.setTimeout(() => {
      levelStartedAtRef.current = null;
      levelElapsedMsRef.current = 0;
      setLevel((previous) => previous + 1);
    }, remainingMs);

    return () => {
      window.clearTimeout(timeoutId);
      if (levelStartedAtRef.current !== null) {
        levelElapsedMsRef.current = Math.min(
          currentLevelDurationMs,
          levelElapsedMsRef.current + performance.now() - levelStartedAtRef.current
        );
        levelStartedAtRef.current = null;
      }
    };
  }, [gameOver, keysLocked, level, running]);

  const resetStreak = useCallback(() => {
    comboRef.current = 0;
    healProgressRef.current = 0;
    setCombo(0);
    setHealProgress(0);
  }, []);

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
          resetStreak();
        }
        return;
      }

      if (currentEvent.options.sound && soundOnRef.current) {
        playBeatRef.current(currentEvent.options.accent);
      }
    }, Math.max(0, timingEvent.targetTime - performance.now()));
  }, [resetStreak]);

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
    setNotes([]);
  }, [clearTimingEvents]);

  const clearIdlePause = useCallback(() => {
    if (idlePauseTimeoutRef.current !== null) {
      window.clearTimeout(idlePauseTimeoutRef.current);
      idlePauseTimeoutRef.current = null;
    }
  }, []);

  const resetGame = useCallback(() => {
    runningRef.current = false;
    gameOverRef.current = false;
    keysLockedRef.current = false;
    pauseStartedAtRef.current = null;
    levelStartedAtRef.current = null;
    levelElapsedMsRef.current = 0;
    clearIdlePause();
    clearNotesAndReseed();
    heartsRef.current = startingHearts;
    comboRef.current = 0;
    healProgressRef.current = 0;
    setHearts(startingHearts);
    setPointScore(0);
    setHits(0);
    setMissedNotes(0);
    setMistakes(0);
    setCombo(0);
    setLevel(0);
    setHealProgress(0);
    setGameOver(false);
    setRunning(false);
    setKeysLocked(false);
    setPulseLane(null);
    setLevelUpToken(0);
  }, [clearIdlePause, clearNotesAndReseed, startingHearts]);

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

    Object.values(timingEventsRef.current).forEach((timingEvent) => {
      timingEvent.targetTime += pauseDurationMs;
    });

    return true;
  }, []);

  const pauseGame = useCallback(() => {
    if (!runningRef.current || gameOverRef.current) return;

    clearIdlePause();
    pauseStartedAtRef.current = performance.now();
    runningRef.current = false;
    setRunning(false);
    pauseTimingEvents();
  }, [clearIdlePause, pauseTimingEvents]);

  const armIdlePause = useCallback(() => {
    clearIdlePause();
    if (!runningRef.current || gameOverRef.current) return;

    idlePauseTimeoutRef.current = window.setTimeout(() => {
      if (runningRef.current && !gameOverRef.current) {
        pauseGame();
      }
    }, IDLE_PAUSE_MS);
  }, [clearIdlePause, pauseGame]);

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
    runningRef.current = true;
    gameOverRef.current = false;
    keysLockedRef.current = true;
    setGameOver(false);
    setKeysLocked(true);
    setRunning(true);
    resumeTimingEvents();
    armIdlePause();
  }, [armIdlePause, prime, resetGame, resumePausedTimeline, resumeTimingEvents]);

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
    [activeKeys.length, healComboTarget, rhythmIntensity, startingHearts, tempoIntensity]
  );

  const registerMistake = useCallback(() => {
    setMistakes((previous) => previous + 1);
    comboRef.current = 0;
    setCombo(0);
    setMistakeToken((previous) => previous + 1);

    const nextHearts = Math.max(0, heartsRef.current - 1);
    heartsRef.current = nextHearts;
    setHearts(nextHearts);

    if (nextHearts === 0) {
      clearIdlePause();
      runningRef.current = false;
      gameOverRef.current = true;
      pauseStartedAtRef.current = null;
      setRunning(false);
      setGameOver(true);
    }
  }, [clearIdlePause]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.repeat) {
        event.preventDefault();
        if (runningRef.current) {
          pauseGame();
        } else {
          startGame();
        }
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || isEditableTarget(event.target)) {
        return;
      }

      if (event.key === "Enter" && !runningRef.current) {
        event.preventDefault();
        startGame();
        return;
      }

      if (!runningRef.current || gameOverRef.current || event.key.length !== 1) return;

      event.preventDefault();
      armIdlePause();

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
    [activeKeySet, armIdlePause, hitWindowMs, pauseGame, recordHit, registerMistake, startGame]
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

      if (newNotes.length > 0 || liveNotes.length !== previousNotes.length) {
        const nextNotes = [...liveNotes, ...newNotes];
        notesRef.current = nextNotes;
        setNotes(nextNotes);
      }
    }, 140);

    return () => window.clearInterval(scheduleIntervalId);
  }, [gameOver, resetStreak, running, scheduleTimingEvent]);

  useEffect(() => {
    if (gameOver) {
      clearTimingEvents();
    }
  }, [clearTimingEvents, gameOver]);

  useEffect(() => () => clearTimingEvents(), [clearTimingEvents]);

  useEffect(() => () => clearIdlePause(), [clearIdlePause]);

  useEffect(() => {
    if (runningRef.current) {
      clearNotesAndReseed();
    }
  }, [activeKeys, clearNotesAndReseed, rhythmMode]);

  const handleActiveKeysChange = (_: React.MouseEvent<HTMLElement>, nextKeys: string[]) => {
    if (keysLockedRef.current) return;
    if (nextKeys.length === 0) return;
    const orderedKeys = HOME_KEYS.map((homeKey) => homeKey.key).filter((key) => nextKeys.includes(key));
    setActiveKeys(orderedKeys);
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

  const healProgressRatio = healComboTarget > 0 ? clamp(healProgress / healComboTarget, 0, 1) : 0;
  const comboMultiplier = getComboMultiplier(combo);
  const playAreaWidth = compactMode ? "min(760px, 100%)" : "min(1100px, 100%)";
  const noteTargetY = Math.round((stageHeight * HIT_LINE_PERCENT) / 100);
  const modeDisplayLabel = gameMode === "progressive" ? "Progressive" : MODE_LABELS[gameMode];
  const modeColor = displayPreset?.color ?? "#38d9a9";
  const keyListLabel = formatKeyList(activeKeys);
  const currentLevelDurationSeconds = Math.round(getLevelDurationMs(level) / 1000);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        color: "#f8fafc",
        bgcolor: "#05070d",
        position: "relative",
        overflow: "hidden",
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

      {levelUpToken > 0 && (
        <Box
          aria-hidden
          key={levelUpToken}
          onAnimationEnd={() => setLevelUpToken(0)}
          sx={{
            position: "fixed",
            left: "50%",
            top: "48%",
            zIndex: 4,
            pointerEvents: "none",
            px: { xs: 2.25, sm: 3 },
            py: { xs: 1.25, sm: 1.5 },
            borderRadius: 1,
            border: "1px solid rgba(250,204,21,0.42)",
            bgcolor: "rgba(5,7,13,0.76)",
            boxShadow: "0 0 38px rgba(250,204,21,0.34)",
            color: "#fde68a",
            fontSize: { xs: 30, sm: 42, md: 56 },
            fontWeight: 950,
            letterSpacing: 0,
            textShadow: "0 0 24px rgba(250,204,21,0.76)",
            animation: `${levelUpFlash} 1200ms ease-out forwards`,
          }}
        >
          level up!
        </Box>
      )}

      <Drawer
        anchor="left"
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        PaperProps={{
          sx: {
            width: 292,
            bgcolor: "#05070d",
            color: "#f8fafc",
            borderRight: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 0 48px rgba(0,0,0,0.42)",
          },
        }}
      >
        <Box sx={{ p: 2.25 }}>
          <Typography sx={{ fontWeight: 900, letterSpacing: 0, fontSize: "0.95rem" }}>Game Settings</Typography>
          <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.1)" }} />

          <FormControl size="small" fullWidth>
            <InputLabel sx={{ color: "#cbd5e1" }}>Mode</InputLabel>
            <Select
              value={gameMode}
              label="Mode"
              disabled={keysLocked}
              onChange={(event) => setGameMode(event.target.value as GameMode)}
              sx={{
                color: "#f8fafc",
                ".MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.2)" },
                ".MuiSvgIcon-root": { color: "#f8fafc" },
              }}
            >
              <MenuItem value="progressive">Progressive</MenuItem>
              {LEAGUE_ORDER.map((leagueMode) => (
                <MenuItem key={leagueMode} value={leagueMode}>
                  {LEAGUE_PRESETS[leagueMode].label}
                </MenuItem>
              ))}
              <MenuItem value="custom">Custom</MenuItem>
            </Select>
          </FormControl>

          <Box
            sx={{
              p: 1.25,
              mt: 2,
              borderRadius: 1,
              transition: "background-color 140ms ease",
              "&:hover": { bgcolor: "rgba(255,255,255,0.06)" },
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography sx={{ color: "#dbe4ee", fontWeight: 900, fontSize: "0.82rem" }}>
                {modeDisplayLabel}
              </Typography>
              {displayPreset && (
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    bgcolor: displayPreset.color,
                    boxShadow: `0 0 16px ${displayPreset.color}88`,
                  }}
                />
              )}
            </Stack>
            <Stack spacing={0.75}>
              <Typography sx={{ color: "rgba(226,232,240,0.7)", fontSize: "0.78rem", fontWeight: 800 }}>
                {tempo} BPM - Quarter
              </Typography>
              <Typography sx={{ color: "rgba(226,232,240,0.7)", fontSize: "0.78rem", fontWeight: 800 }}>
                Lives {startingHearts} - Regen {healComboTarget}
              </Typography>
              <Typography sx={{ color: "rgba(226,232,240,0.7)", fontSize: "0.78rem", fontWeight: 800 }}>
                Notes {keyListLabel}
              </Typography>
              {gameMode === "progressive" && (
                <Typography sx={{ color: "rgba(226,232,240,0.52)", fontSize: "0.75rem", fontWeight: 800 }}>
                  Level {level} - +10 BPM every {currentLevelDurationSeconds}s
                </Typography>
              )}
              {isCustomMode && (
                <Typography sx={{ color: "rgba(226,232,240,0.52)", fontSize: "0.75rem", fontWeight: 800 }}>
                  Custom controls are shown in the top row before Start.
                </Typography>
              )}
            </Stack>
          </Box>
        </Box>
      </Drawer>

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
          <Stack direction="row" spacing={1.1} alignItems="center" sx={{ minWidth: { xs: "100%", md: "auto" } }}>
            <Tooltip title="Game settings">
              <IconButton
                color="inherit"
                onClick={() => setSettingsOpen(true)}
                aria-label="Open game settings"
                sx={{
                  color: "rgba(248,250,252,0.62)",
                  bgcolor: "#05070d",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.08)", color: "#f8fafc" },
                }}
              >
                <MenuIcon />
              </IconButton>
            </Tooltip>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 168 }}>
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

          {isCustomMode && (
            <>
              <Box sx={{ minWidth: { xs: "100%", sm: 230 }, width: { xs: "100%", sm: 250 } }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Typography sx={{ fontSize: "0.82rem", fontWeight: 800, whiteSpace: "nowrap" }}>{tempo} BPM</Typography>
                  <Slider
                    size="small"
                    min={TEMPO_MIN}
                    max={TEMPO_MAX}
                    step={2}
                    value={tempo}
                    disabled={keysLocked}
                    onChange={(_, value) => setTempo(value as number)}
                    sx={{ color: "#38d9a9" }}
                    aria-label="Tempo"
                  />
                </Stack>
              </Box>

              <Box sx={{ minWidth: { xs: "100%", sm: 150 }, width: { xs: "100%", sm: 170 } }}>
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Typography sx={{ color: "#cbd5e1", fontSize: "0.78rem", fontWeight: 800, whiteSpace: "nowrap" }}>
                    Hearts {startingHearts}
                  </Typography>
                  <Slider
                    min={MIN_STARTING_HEARTS}
                    max={MAX_STARTING_HEARTS}
                    step={1}
                    value={startingHearts}
                    disabled={keysLocked}
                    onChange={handleStartingHeartsChange}
                    size="small"
                    sx={{ color: "#38d9a9" }}
                    aria-label="Starting hearts"
                  />
                </Stack>
              </Box>

              <Box sx={{ minWidth: { xs: "100%", sm: 150 }, width: { xs: "100%", sm: 170 } }}>
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Typography sx={{ color: "#cbd5e1", fontSize: "0.78rem", fontWeight: 800, whiteSpace: "nowrap" }}>
                    Regen {healComboTarget}
                  </Typography>
                  <Slider
                    min={MIN_HEAL_COMBO_TARGET}
                    max={MAX_HEAL_COMBO_TARGET}
                    step={1}
                    value={healComboTarget}
                    disabled={keysLocked}
                    onChange={handleHealComboTargetChange}
                    size="small"
                    sx={{ color: "#38d9a9" }}
                    aria-label="Consecutive correct hits to regain a heart"
                  />
                </Stack>
              </Box>

              <Stack direction="row" spacing={0.75} alignItems="center">
                <Typography sx={{ color: "#cbd5e1", fontSize: "0.82rem", fontWeight: 800 }}>Letters</Typography>
                <Switch
                  checked={showKeyLetters}
                  onChange={(event) => setShowKeyLetters(event.target.checked)}
                  size="small"
                  inputProps={{ "aria-label": "Show key letters" }}
                  sx={{
                    "& .MuiSwitch-switchBase.Mui-checked": { color: "#38d9a9" },
                    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: "#38d9a9" },
                  }}
                />
              </Stack>

              <Stack direction="row" spacing={0.75} alignItems="center">
                <Typography sx={{ color: "#cbd5e1", fontSize: "0.82rem", fontWeight: 800 }}>Compact</Typography>
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
            </>
          )}

          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
            <Typography sx={{ color: "#cbd5e1", fontSize: "0.82rem", fontWeight: 800 }}>
              {canChooseKeys ? "Keys" : "Keys locked"}
            </Typography>
            <ToggleButtonGroup
              value={activeKeys}
              onChange={handleActiveKeysChange}
              size="small"
              aria-label="Active home row keys"
              sx={{
                flexWrap: "wrap",
                gap: 0.5,
                "& .MuiToggleButtonGroup-grouped": {
                  border: "1px solid rgba(255,255,255,0.22) !important",
                  borderRadius: "6px !important",
                },
              }}
            >
              {HOME_KEYS.map((homeKey) => (
                <ToggleButton
                  key={homeKey.key}
                  value={homeKey.key}
                  disabled={!canChooseKeys}
                  aria-label={`${homeKey.label} key`}
                  sx={{
                    color: "#e2e8f0",
                    minWidth: homeKey.widthUnits === 2 ? 74 : 36,
                    px: homeKey.widthUnits === 2 ? 1.5 : 1,
                    fontWeight: 900,
                    "&.Mui-selected": {
                      color: "#05070d",
                      bgcolor: homeKey.color,
                      "&:hover": { bgcolor: homeKey.color },
                    },
                    "&.Mui-disabled": {
                      color: "rgba(226,232,240,0.34)",
                    },
                    "&.Mui-selected.Mui-disabled": {
                      color: "#05070d",
                      bgcolor: `${homeKey.color}99`,
                    },
                  }}
                >
                  {homeKey.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
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
          </Stack>

          <Box sx={{ flexGrow: 1 }} />
        </Toolbar>
      </AppBar>

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
          {!keysLocked && !gameOver && (
            <Box
              role="dialog"
              aria-label="Press Tab to start"
              sx={{
                position: "absolute",
                left: "50%",
                top: "46%",
                transform: "translate(-50%, -50%)",
                zIndex: 5,
                pointerEvents: "none",
                px: { xs: 2.5, sm: 3.5 },
                py: { xs: 1.5, sm: 2 },
                borderRadius: 1,
                border: "1px solid rgba(255,255,255,0.16)",
                bgcolor: "rgba(5,7,13,0.72)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.34)",
                backdropFilter: "blur(10px)",
              }}
            >
              <Typography sx={{ color: "rgba(248,250,252,0.88)", fontWeight: 900, fontSize: { xs: 18, sm: 24 } }}>
                Press Tab to start
              </Typography>
            </Box>
          )}

          {HOME_KEYS.map((homeKey, laneIndex) => {
            const active = activeKeySet.has(homeKey.key);
            const laneNotes = notesByLane[laneIndex];
            const shouldPulse = pulseLane?.laneIndex === laneIndex;
            const widthUnits = homeKey.widthUnits ?? 1;
            const currentNoteWidth = scaleSize(noteWidth, widthUnits);
            const currentTargetWidth = scaleSize(targetSize, widthUnits);

            return (
              <Box
                key={homeKey.key}
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
                }}
              >
                {laneNotes.map((note) => {
                  return (
                    <Box
                      key={note.id}
                      sx={{
                        "--note-target-y": `${noteTargetY}px`,
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
                        animation: `${noteFall} ${FALL_DURATION_MS}ms linear ${note.animationDelayMs}ms both`,
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
            {!gameOver && (
              <Button
                variant="contained"
                startIcon={running ? <PauseIcon /> : <PlayArrowIcon />}
                onClick={running ? pauseGame : startGame}
                sx={{
                  minWidth: 122,
                  height: 40,
                  bgcolor: running ? "#facc15" : "#38d9a9",
                  color: "#03110e",
                  fontWeight: 900,
                  "&:hover": {
                    bgcolor: running ? "#eab308" : "#20c997",
                  },
                }}
              >
                {running ? "Pause" : keysLocked ? "Resume" : "Start"}
              </Button>
            )}
            {gameOver && (
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography sx={{ color: "#fecaca", fontWeight: 900 }}>You lose</Typography>
                <Button variant="contained" startIcon={<RestartAltIcon />} onClick={resetGame}>
                  Reset
                </Button>
              </Stack>
            )}

            <Typography
              sx={{
                color: "rgba(148,163,184,0.34)",
                fontSize: { xs: 15, sm: 18 },
                fontWeight: 950,
                whiteSpace: "nowrap",
              }}
            >
              Level {level}
            </Typography>

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
              const filled = heartIndex < hearts;
              const pending = !gameOver && !filled && heartIndex === hearts;
              const pendingOpacity = pending ? 0.12 + healProgressRatio * 0.82 : 0;

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
                      opacity: filled ? 0 : 1,
                    }}
                  />
                  <FavoriteIcon
                    sx={{
                      position: "absolute",
                      inset: 0,
                      color: "#fb7185",
                      fontSize: { xs: 20, sm: 24, md: 26 },
                      opacity: filled ? 0.95 : pendingOpacity,
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
