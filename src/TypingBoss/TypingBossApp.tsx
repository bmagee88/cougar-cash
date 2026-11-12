import WordFilterChips, { WordFilters, filteredWordCount } from "../typingProject/components/WordFilterChips";
import { SENTIMENTS } from "../typingProject/resources/homeRowWordBank";
import { initializeBalanced, proportionalPlayerPoint } from "./proportionalRules";
import { generateJoinName, shortJoinCode } from "./joinNames";
import { VolcanicBackdrop, VolcanicForeground } from "./VolcanicScenery";
import BattleCountdown,{useBattleCountdown} from "./BattleCountdown";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import BoltIcon from "@mui/icons-material/Bolt";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FavoriteIcon from "@mui/icons-material/Favorite";
import HomeIcon from "@mui/icons-material/Home";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ShieldIcon from "@mui/icons-material/Shield";
import {
  Alert,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  createTheme,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  FormControlLabel,
  Switch,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Slider,
  Stack,
  TextField,
  ThemeProvider,
  Tooltip,
  Typography,
} from "@mui/material";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Link as RouterLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  closeTypingBossSession,
  createTypingBossChallenge,
  createTypingBossParticipant,
  createTypingBossSession,
  getTypingBossEventSourceUrl,
  getTypingBossSession,
  startTypingBossSession,
  submitTypingBossAction,
  verifyTypingBossParticipant,
} from "./api";
import {
  TypingBossChallenge,
  TypingBossClassId,
  TypingBossCredentials,
  TypingBossId,
  TypingBossMoveId,
  TypingBossPlayer,
  TypingBossProjectile,
  TypingBossSessionSnapshot,
  TypingBossStatus,
  TypingBossMode,
} from "./types";
import { ProjectileMotion } from "./ProjectileMotion";
import { ContinuousTyping, DamageBoard } from "./ContinuousBattle";
import BattleLeaderboard from "./BattleLeaderboard";
import { AttackProgressBar } from "./AttackProgress";
import { acceptSessionSnapshot, applySessionPatch, SessionPatch } from "./sessionPatch";
import { pruneSavedCredentials, readSavedCredential, removeSavedCredential, saveCredential } from "./credentials";
import { COMBAT_COLORS, projectileEndpoints } from "./combatFeedback";
import HostBattleLog from "./HostBattleLog";
import RoomCreationGate from "./RoomCreationGate";
import DragonCombatSprite from "./DragonCombatSprite";
import { useDragonCombatAnimation } from "./useDragonCombatAnimation";
import { usePortraitProjectileLayout } from "./usePortraitProjectileLayout";
import CombatCharacter, { useCombatAnimation, useCombatClock } from "./CombatCharacter";
import { collectCombatAnimations, CombatAnimation, CombatAnimationEvent, NO_ANIMATION_EVENTS } from "./combatAnimation";
const AnimationPreview = process.env.NODE_ENV === "development" ? React.lazy(() => import("./AnimationPreview")) : null;

const SESSION_ID_PATTERN = /^boss[0-9A-F]{3}$/;
const PLAYER_CODE_PATTERN = /^hero[0-9A-F]{4}$/;
const MAX_RECONNECT_ATTEMPTS = 5;
const PUBLIC_ASSET_BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const TYPING_BOSS_ASSETS = {
  boss: `${PUBLIC_ASSET_BASE}/assets/typing-boss/red-dragon-sprite.png`,
  emberWhelpBoss: `${PUBLIC_ASSET_BASE}/assets/typing-boss/ember-whelp-sprite.png`,
  cindermawBoss: `${PUBLIC_ASSET_BASE}/assets/typing-boss/red-dragon-sprite.png`,
  ancientRedDragonBoss: `${PUBLIC_ASSET_BASE}/assets/typing-boss/ancient-red-dragon-sprite.png`,
  cleric: `${PUBLIC_ASSET_BASE}/assets/typing-boss/cleric-sprite.png`,
  barbarian: `${PUBLIC_ASSET_BASE}/assets/typing-boss/barbarian-sprite.png`,
  paladin: `${PUBLIC_ASSET_BASE}/assets/typing-boss/paladin-sprite.png`,
  rogue: `${PUBLIC_ASSET_BASE}/assets/typing-boss/rogue-sprite.png`,
  necromancer: `${PUBLIC_ASSET_BASE}/assets/typing-boss/necromancer-sprite.png`,
  monk: `${PUBLIC_ASSET_BASE}/assets/typing-boss/monk-sprite.png`,
  clericIdleAnimation: `${PUBLIC_ASSET_BASE}/assets/typing-boss/cleric-idle-sprite.png`,
  barbarianIdleAnimation: `${PUBLIC_ASSET_BASE}/assets/typing-boss/barbarian-idle-sprite.png`,
  paladinIdleAnimation: `${PUBLIC_ASSET_BASE}/assets/typing-boss/paladin-idle-sprite.png`,
  clericAnimationSheet: `${PUBLIC_ASSET_BASE}/assets/typing-boss/cleric-animation-sheet.png`,
  barbarianWeakAttack: `${PUBLIC_ASSET_BASE}/assets/typing-boss/player-weak-attack-sprite.png`,
  barbarianStrongAttack: `${PUBLIC_ASSET_BASE}/assets/typing-boss/player-strong-attack-sprite.png`,
  clericWeakAttack: `${PUBLIC_ASSET_BASE}/assets/typing-boss/cleric-weak-attack-sprite.png`,
  clericStrongAttack: `${PUBLIC_ASSET_BASE}/assets/typing-boss/cleric-strong-attack-sprite.png`,
  rogueWeakAttack: `${PUBLIC_ASSET_BASE}/assets/typing-boss/rogue-weak-attack-sprite.png`,
  rogueStrongAttack: `${PUBLIC_ASSET_BASE}/assets/typing-boss/rogue-strong-attack-sprite.png`,
  necromancerWeakAttack: `${PUBLIC_ASSET_BASE}/assets/typing-boss/necromancer-weak-attack-sprite.png`,
  necromancerStrongAttack: `${PUBLIC_ASSET_BASE}/assets/typing-boss/necromancer-strong-attack-sprite.png`,
  paladinWeakAttack: `${PUBLIC_ASSET_BASE}/assets/typing-boss/paladin-weak-attack-sprite.png`,
  paladinStrongAttack: `${PUBLIC_ASSET_BASE}/assets/typing-boss/paladin-strong-attack-sprite.png`,
  fireballWhelp: `${PUBLIC_ASSET_BASE}/assets/typing-boss/fireball-whelp.png`,
  fireballCindermaw: `${PUBLIC_ASSET_BASE}/assets/typing-boss/fireball-cindermaw.png`,
  fireballAncientRedDragon: `${PUBLIC_ASSET_BASE}/assets/typing-boss/fireball-ancient-red-dragon.png`,
} as const;

const BOSS_SPRITE_ASSETS: Record<TypingBossId, string> = {
  emberWhelp: TYPING_BOSS_ASSETS.emberWhelpBoss,
  cindermaw: TYPING_BOSS_ASSETS.cindermawBoss,
  infernalDragon: TYPING_BOSS_ASSETS.ancientRedDragonBoss,
};

const BOSS_FIREBALL_ASSETS: Record<TypingBossId, string> = {
  emberWhelp: TYPING_BOSS_ASSETS.fireballWhelp,
  cindermaw: TYPING_BOSS_ASSETS.fireballCindermaw,
  infernalDragon: TYPING_BOSS_ASSETS.fireballAncientRedDragon,
};

const CLASS_PROJECTILE_ASSETS: Record<
  TypingBossClassId,
  { weak: string; strong: string }
> = {
  cleric: {
    weak: TYPING_BOSS_ASSETS.clericWeakAttack,
    strong: TYPING_BOSS_ASSETS.clericStrongAttack,
  },
  barbarian: {
    weak: TYPING_BOSS_ASSETS.barbarianWeakAttack,
    strong: TYPING_BOSS_ASSETS.barbarianStrongAttack,
  },
  paladin: {
    weak: TYPING_BOSS_ASSETS.paladinWeakAttack,
    strong: TYPING_BOSS_ASSETS.paladinStrongAttack,
  },
  rogue: {
    weak: TYPING_BOSS_ASSETS.rogueWeakAttack,
    strong: TYPING_BOSS_ASSETS.rogueStrongAttack,
  },
  necromancer: {
    weak: TYPING_BOSS_ASSETS.necromancerWeakAttack,
    strong: TYPING_BOSS_ASSETS.necromancerStrongAttack,
  },
  monk: {
    weak: TYPING_BOSS_ASSETS.barbarianWeakAttack,
    strong: TYPING_BOSS_ASSETS.clericStrongAttack,
  },
};

const CLASS_ORDER: TypingBossClassId[] = [
  "cleric",
  "barbarian",
  "paladin",
  "rogue",
  "necromancer",
  "monk",
];
const CLASS_ID_SET = new Set<string>(CLASS_ORDER);

function normalizeClassSelection(value: unknown): TypingBossClassId {
  return typeof value === "string" && CLASS_ID_SET.has(value)
    ? (value as TypingBossClassId)
    : "cleric";
}

const CLASS_INFO: Record<
  TypingBossClassId,
  {
    label: string;
    special: string;
    detail: string;
    specialDetail: string;
    color: string;
  }
> = {
  cleric: {
    label: "Cleric",
    special: "Radiant Mend",
    detail: "Ally healing through medium questions.",
    specialDetail: "Heal an ally.",
    color: "#facc15",
  },
  barbarian: {
    label: "Barbarian",
    special: "Rage Breaker",
    detail: "A longer hard question for bigger damage.",
    specialDetail: "Hard+ damage.",
    color: "#fb7185",
  },
  paladin: {
    label: "Paladin",
    special: "Blessed Rally",
    detail: "Buff another player's next attack by 50%.",
    specialDetail: "Buff ally.",
    color: "#fbbf24",
  },
  rogue: {
    label: "Rogue",
    special: "Shadow Veil",
    detail: "Prepare one special evade that halves a boss hit chance.",
    specialDetail: "Ready evade.",
    color: "#a78bfa",
  },
  necromancer: {
    label: "Necromancer",
    special: "Soul Return",
    detail: "Resurrect a fallen player at half HP.",
    specialDetail: "Resurrect ally.",
    color: "#86efac",
  },
  monk: {
    label: "Monk",
    special: "Third Palm",
    detail: "No speed penalty, with a powerful easy special every third turn.",
    specialDetail: "Every 3rd turn.",
    color: "#fb923c",
  },
};

const BOSS_CHOICES: {
  id: TypingBossId;
  name: string;
  difficulty: "easy" | "medium" | "hard";
  hp: number;
  attackIntervalMs: number;
  color: string;
  description: string;
}[] = [
  {
    id: "emberWhelp",
    name: "Ember Whelp",
    difficulty: "easy",
    hp: 900,
    attackIntervalMs: 24000,
    color: "#f97316",
    description: "Slow charge bar, lighter fire attacks.",
  },
  {
    id: "cindermaw",
    name: "Cindermaw",
    difficulty: "medium",
    hp: 1200,
    attackIntervalMs: 18000,
    color: "#ef4444",
    description: "Balanced raid pace for a full class.",
  },
  {
    id: "infernalDragon",
    name: "Ancient Red Dragon",
    difficulty: "hard",
    hp: 1550,
    attackIntervalMs: 12000,
    color: "#dc2626",
    description: "Fast charge bar and punishing fireballs.",
  },
];

type ArenaLayout = {
  hostBossPoint: Point;
  playerBossPoint: Point;
  hostSpawns: Point[];
  playerSpawns: Point[];
};

const VOLCANIC_HOST_SPAWNS: Point[] = Array.from({ length: 15 }, (_, index) => ({
  x: 12 + (index % 5) * 11,
  y: 61 + Math.floor(index / 5) * 9,
}));

const VOLCANIC_PLAYER_SPAWNS: Point[] = [
  { x: 26, y: 67 },
  { x: 12, y: 61 }, { x: 43, y: 61 }, { x: 57, y: 65 },
  { x: 12, y: 78 }, { x: 43, y: 78 }, { x: 57, y: 79 },
  { x: 26, y: 81 }, { x: 35, y: 56 }, { x: 54, y: 55 },
];

const BOSS_ARENAS: Record<TypingBossId, ArenaLayout> = {
  emberWhelp: {
    hostBossPoint: { x: 80, y: 52 },
    playerBossPoint: { x: 80, y: 52 },
    hostSpawns: VOLCANIC_HOST_SPAWNS,
    playerSpawns: VOLCANIC_PLAYER_SPAWNS,
  },
  cindermaw: {
    hostBossPoint: { x: 80, y: 52 },
    playerBossPoint: { x: 78, y: 50 },
    hostSpawns: VOLCANIC_HOST_SPAWNS,
    playerSpawns: VOLCANIC_PLAYER_SPAWNS,
  },
  infernalDragon: {
    hostBossPoint: { x: 80, y: 52 },
    playerBossPoint: { x: 78, y: 50 },
    hostSpawns: VOLCANIC_HOST_SPAWNS,
    playerSpawns: VOLCANIC_PLAYER_SPAWNS,
  },
};

function arenaForBoss(bossId: TypingBossId): ArenaLayout {
  return BOSS_ARENAS[bossId] || BOSS_ARENAS.cindermaw;
}

type TypingProgressStats = {
  accepted: number;
  mistakes: number;
  missedTypes: MissedCharacterTypeCounts;
  startedAt: number;
  updatedAt: number;
};

type MissedCharacterType =
  | "capital"
  | "letter"
  | "number"
  | "punctuation"
  | "space"
  | "symbol"
  | "extra";

type MissedCharacterTypeCounts = Record<MissedCharacterType, number>;

const MISSED_CHARACTER_TYPE_LABELS: Record<MissedCharacterType, string> = {
  capital: "Capital",
  letter: "Letter",
  number: "Number",
  punctuation: "Punctuation",
  space: "Space",
  symbol: "Symbol",
  extra: "Extra",
};

type BonusStep = {
  label: string;
  value: string;
};

const bossTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#67e8f9",
      contrastText: "#03141a",
    },
    secondary: {
      main: "#facc15",
    },
    background: {
      default: "#10131a",
      paper: "#171b24",
    },
    text: {
      primary: "#f8fafc",
      secondary: "#aab4c4",
    },
    divider: "#31394a",
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          letterSpacing: 0,
          textTransform: "none",
          fontWeight: 800,
        },
      },
    },
  },
});

type Point = { x: number; y: number };

function normalizeSessionAlias(value: string) {
  const hex = value
    .replace(/^boss/i, "")
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "")
    .slice(0, 3);

  return hex ? `boss${hex}` : "";
}

function normalizePlayerCode(value: string) {
  const hex = value
    .replace(/^hero/i, "")
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "")
    .slice(0, 4);

  return hex ? `hero${hex}` : "";
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function getErrorStatus(error: unknown) {
  return typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status?: number }).status)
    : undefined;
}

function formatRemaining(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function joinUrlForSession(sessionId: string) {
  return `${window.location.origin}/typing-boss/join?session=${sessionId}`;
}

function hpPercent(current: number, max: number) {
  return max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAnswerText(value: string) {
  return value;
}

function keyMatches(key: string, expected: string) {
  return key === expected;
}

function createMissedTypeCounts(): MissedCharacterTypeCounts {
  return {
    capital: 0,
    letter: 0,
    number: 0,
    punctuation: 0,
    space: 0,
    symbol: 0,
    extra: 0,
  };
}

function classifyCharacterType(char: string): MissedCharacterType {
  if (!char) return "extra";
  if (char === " ") return "space";
  if (/^[A-Z]$/.test(char)) return "capital";
  if (/^[a-z]$/.test(char)) return "letter";
  if (/^[0-9]$/.test(char)) return "number";
  if (`.,!?;:'"()[]{}-`.includes(char)) return "punctuation";
  return "symbol";
}

function countMatchingCharacters(input: string, target: string) {
  let count = 0;
  const length = Math.min(input.length, target.length);
  for (let index = 0; index < length; index += 1) {
    if (input[index] === target[index]) {
      count += 1;
    }
  }
  return count;
}

function bestAnswerMatchingCharacters(input: string, answers: string[]) {
  return answers.reduce(
    (best, answer) => Math.max(best, countMatchingCharacters(input, answer)),
    0
  );
}

function acceptedCharactersForInputs(
  challenge: TypingBossChallenge,
  questionInput: string,
  answerInput: string
) {
  const questionAccepted = countMatchingCharacters(questionInput, challenge.question);
  const answerAccepted =
    questionInput === challenge.question
      ? bestAnswerMatchingCharacters(answerInput, challenge.answers)
      : 0;
  return questionAccepted + answerAccepted;
}

function answerPrefixMatches(answers: string[], input: string) {
  return answers.some((answer) => normalizeAnswerText(answer).startsWith(input));
}

function answerCharacterIsValidPrefix(
  answers: string[],
  input: string,
  index: number
) {
  return answerPrefixMatches(answers, input.slice(0, index + 1));
}

function missedTypeEntries(counts: MissedCharacterTypeCounts) {
  return (Object.keys(MISSED_CHARACTER_TYPE_LABELS) as MissedCharacterType[])
    .map((type) => ({ type, count: counts[type] }))
    .filter((entry) => entry.count > 0);
}

function accuracyBonusMultiplier(accuracy: number) {
  const pct = Math.floor(clamp(accuracy, 0, 1) * 100);
  if (pct >= 100) return 1.16;
  if (pct >= 99) return 1.11;
  if (pct >= 98) return 1.07;
  if (pct >= 97) return 1.04;
  if (pct >= 96) return 1.02;
  if (pct >= 95) return 1.01;
  return 1;
}

function bossHitChanceFromAccuracy(accuracy: number) {
  return clamp(1 - accuracy + accuracy / 2, 0.35, 0.95);
}

function effectiveBossHitChance(player: TypingBossPlayer) {
  const base = bossHitChanceFromAccuracy(player.accuracy);
  return player.classId === "rogue" && player.evadeReady ? base / 2 : base;
}

function defensePercentForPlayer(player: TypingBossPlayer) {
  return Math.round((1 - effectiveBossHitChance(player)) * 100);
}

function attackStrengthForPlayer(player: TypingBossPlayer) {
  const speed = player.averageDps > 0 ? player.averageDps : 1;
  return Math.max(
    1,
    Math.round(
      speed *
        (1 + player.correctStreak * 0.05) *
        (player.nextAttackMultiplier || 1) *
        10
    )
  );
}

function speedMultiplierForPlayer(player: TypingBossPlayer, effectiveDps: number) {
  if (player.averageDps <= 0) return 1;
  if (player.classId === "monk") {
    return clamp(effectiveDps / player.averageDps, 1, 1.75);
  }
  return clamp(effectiveDps / player.averageDps, 0.65, 1.6);
}

function liveAttackStats(
  challenge: TypingBossChallenge,
  player: TypingBossPlayer,
  stats: TypingProgressStats,
  answerInput: string,
  now: number
) {
  const totalKeystrokes = Math.max(stats.accepted + stats.mistakes, 1);
  const accuracy = clamp(stats.accepted / totalKeystrokes, 0, 1);
  const durationSec = clamp((now - stats.startedAt) / 1000, 0.6, 180);
  const effectiveDps = stats.accepted / durationSec;
  const speedMultiplier = speedMultiplierForPlayer(player, effectiveDps);
  const accuracyMultiplier = accuracyBonusMultiplier(accuracy);
  const nextStreak = player.correctStreak + 1;
  const streakMultiplier = 1 + nextStreak * 0.05;
  const answerLength = answerInput.length || Math.max(...challenge.answers.map((answer) => answer.length));
  const baseCharacters = challenge.question.length + answerLength;
  const buffMultiplier =
    challenge.kind === "damage" ? player.nextAttackMultiplier || 1 : 1;
  const totalMultiplier =
    challenge.movePower *
    speedMultiplier *
    accuracyMultiplier *
    streakMultiplier *
    buffMultiplier;
  const estimatedAmount = Math.max(1, Math.round(baseCharacters * totalMultiplier));

  return {
    accuracy,
    effectiveDps,
    speedMultiplier,
    accuracyMultiplier,
    streakMultiplier,
    totalMultiplier,
    baseCharacters,
    estimatedAmount,
  };
}

function challengeEffectLabel(challenge: TypingBossChallenge) {
  if (challenge.kind === "heal-self" || challenge.kind === "heal-other") return "Healing";
  if (challenge.kind === "buff-other") return "Buff";
  if (challenge.kind === "evade-self") return "Evade";
  if (challenge.kind === "resurrect") return "Revive";
  return "Attack";
}

function challengeEffectValue(
  challenge: TypingBossChallenge,
  preview: ReturnType<typeof liveAttackStats>
) {
  if (challenge.kind === "buff-other") return "+50%";
  if (challenge.kind === "evade-self") return "Ready";
  if (challenge.kind === "resurrect") return "Half HP";
  return `${preview.estimatedAmount}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function useNow(intervalMs = 250) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return now;
}

function useTypingBossSessionStream(
  sessionId: string | undefined,
  credentials: TypingBossCredentials | null
) {
  const [session, setSession] = useState<TypingBossSessionSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [streamError, setStreamError] = useState("");
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [terminalReason, setTerminalReason] = useState<
    "" | "not-found" | "reconnect-limit"
  >("");
  const hostToken = credentials?.hostToken;
  const code = credentials?.code;

  useEffect(() => {
    if (!sessionId || (!hostToken && !code)) {
      return undefined;
    }

    let closed = false;
    let attempts = 0;
    const activeCredentials = { hostToken, code };
    const source = new EventSource(
      getTypingBossEventSourceUrl(sessionId, activeCredentials)
    );
    const role = hostToken ? "host" : "player";
    const credential = hostToken || code || "";
    function rememberExpiry(incoming: TypingBossSessionSnapshot) {
      if (incoming.status === "expired") removeSavedCredential(sessionId!, role, credential);
      else saveCredential(sessionId!, role, credential, incoming.expiresAt);
      if (["victory", "defeat", "closed", "expired"].includes(incoming.status)) source.close();
    }

    async function checkSessionStillExists() {
      try {
        await getTypingBossSession(sessionId, activeCredentials);
      } catch (caught) {
        const status = getErrorStatus(caught);
        if (closed) return;
        if (status === 401 || status === 403 || status === 404 || status === 410) {
          source.close();
          removeSavedCredential(sessionId!, role, credential);
          setConnected(false);
          setTerminalReason("not-found");
          setStreamError("This boss game is no longer available.");
        }
      }
    }

    source.addEventListener("session", (event) => {
      if (closed) return;
      const message = event as MessageEvent<string>;
      const incoming = JSON.parse(message.data) as TypingBossSessionSnapshot;
      rememberExpiry(incoming);
      setSession(previous => acceptSessionSnapshot(previous, incoming));
      setConnected(true);
      setStreamError("");
      setReconnectAttempts(0);
      setTerminalReason("");
      attempts = 0;
    });

    source.addEventListener("patch", (event) => {
      if (closed) return;
      const patch = JSON.parse((event as MessageEvent<string>).data) as SessionPatch;
      if (patch.expiresAt) saveCredential(sessionId!, role, credential, patch.expiresAt);
      if (patch.status && ["victory", "defeat", "closed", "expired"].includes(patch.status)) {
        if (patch.status === "expired") removeSavedCredential(sessionId!, role, credential);
        source.close();
      }
      setSession(previous => previous ? applySessionPatch(previous, patch) : previous);
      setConnected(true);
      setStreamError("");
      attempts = 0;
      setReconnectAttempts(0);
      setTerminalReason("");
    });

    source.onerror = () => {
      if (closed) return;
      attempts += 1;
      setConnected(false);
      setReconnectAttempts(attempts);
      setStreamError("Updates are reconnecting.");
      checkSessionStillExists();

      if (attempts >= MAX_RECONNECT_ATTEMPTS) {
        source.close();
        setTerminalReason("reconnect-limit");
        setStreamError("The connection could not be restored.");
      }
    };

    return () => {
      closed = true;
      source.close();
    };
  }, [code, hostToken, sessionId]);

  return {
    connected,
    reconnectAttempts,
    reconnecting: Boolean(streamError && !terminalReason),
    session,
    setSession,
    streamError,
    terminalReason,
  };
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        color: "text.primary",
        py: { xs: 2, md: 3 },
      }}
    >
      <Container maxWidth="xl">{children}</Container>
    </Box>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <PageFrame>
      <Paper
        elevation={0}
        sx={{
          border: "1px solid #31394a",
          borderRadius: 2,
          p: 3,
          display: "flex",
          alignItems: "center",
          gap: 2,
        }}
      >
        <CircularProgress size={24} />
        <Typography>{label}</Typography>
      </Paper>
    </PageFrame>
  );
}

function ReconnectOverlay({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 1300,
        bgcolor: "rgba(7, 9, 14, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          border: "1px solid #31394a",
          borderRadius: 2,
          p: 2,
          minWidth: 220,
          textAlign: "center",
        }}
      >
        <CircularProgress size={30} sx={{ mb: 1 }} />
        <Typography sx={{ fontWeight: 900 }}>Reconnecting</Typography>
      </Paper>
    </Box>
  );
}

function StatusChip({ status }: { status: TypingBossStatus }) {
  const colors: Record<TypingBossStatus, { bg: string; color: string }> = {
    setup: { bg: "#3b2f18", color: "#fde68a" },
    active: { bg: "#123828", color: "#86efac" },
    closed: { bg: "#34212a", color: "#fda4af" },
    expired: { bg: "#34212a", color: "#fda4af" },
    victory: { bg: "#14313a", color: "#67e8f9" },
    defeat: { bg: "#391f1f", color: "#fca5a5" },
  };

  return (
    <Chip
      size="small"
      label={status.toUpperCase()}
      sx={{
        bgcolor: colors[status].bg,
        color: colors[status].color,
        border: `1px solid ${colors[status].color}`,
        fontWeight: 900,
        letterSpacing: 0,
      }}
    />
  );
}

function BossSprite({
  width,
  glow = "#ef4444",
  bossId = "cindermaw",
}: {
  width: number | { xs: number; md: number };
  glow?: string;
  bossId?: TypingBossId;
}) {
  return (
    <Box
      component="img"
      src={BOSS_SPRITE_ASSETS[bossId]}
      alt=""
      draggable={false}
      sx={{
        width,
        maxWidth: "100%",
        height: "auto",
        display: "block",
        imageRendering: "pixelated",
        filter: "drop-shadow(0 18px 0 rgba(0,0,0,.22))",
        userSelect: "none",
      }}
    />
  );
}

function bossPreviewWidth(bossId: TypingBossId) {
  if (bossId === "emberWhelp") {
    return { xs: 170, md: 190 };
  }
  if (bossId === "infernalDragon") {
    return { xs: 250, md: 300 };
  }
  return { xs: 220, md: 260 };
}

function bossBattleWidth(bossId: TypingBossId, size: "host" | "player") {
  if (bossId === "emberWhelp") {
    return size === "host" ? { xs: 170, md: 220 } : { xs: 190, md: 250 };
  }
  if (bossId === "infernalDragon") {
    return size === "host" ? { xs: 320, md: 430 } : { xs: 340, md: 470 };
  }
  return size === "host" ? { xs: 260, md: 340 } : { xs: 280, md: 380 };
}

function ClassMark({
  classId,
  size = 42,
}: {
  classId: TypingBossClassId;
  size?: number;
}) {
  const info = CLASS_INFO[classId];
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        bgcolor: `${info.color}22`,
        color: info.color,
        border: `2px solid ${info.color}`,
        boxShadow: `0 0 18px ${info.color}3d`,
      }}
    >
      {classIcon(classId)}
    </Box>
  );
}

function classIcon(classId: TypingBossClassId) {
  if (classId === "cleric" || classId === "paladin") return <ShieldIcon />;
  if (classId === "barbarian") return <LocalFireDepartmentIcon />;
  if (classId === "rogue") return <AutoFixHighIcon />;
  if (classId === "necromancer") return <FavoriteIcon />;
  return <BoltIcon />;
}

function PlayerCharacterSprite(props: { classId: TypingBossClassId; color: string; size?: number; highlight?: boolean; pose?: CombatAnimation; clock?: React.MutableRefObject<number> }) {
  return <CombatCharacter {...props} />;
}

function playerHealthColor(hp:number,maxHp:number,defeated=false) {
  if(defeated)return "#64748b";
  const ratio=maxHp>0?hp/maxHp:0;
  return ratio<.15?"#ef4444":ratio<.5?"#f97316":"#22c55e";
}

function StatBar({
  value,
  max,
  color,
  height = 10,
}: {
  value: number;
  max: number;
  color: string;
  height?: number;
}) {
  return (
    <Box
      sx={{
        height,
        bgcolor: "rgba(148, 163, 184, 0.2)",
        borderRadius: 999,
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          width: `${hpPercent(value, max)}%`,
          height: "100%",
          bgcolor: color,
          transition: "width 0.35s ease",
        }}
      />
    </Box>
  );
}

function moveIcon(moveId: TypingBossMoveId, classId: TypingBossClassId) {
  if (moveId === "weak") return <BoltIcon />;
  if (moveId === "strong") return <AutoFixHighIcon />;
  if (moveId === "potion") return <FavoriteIcon />;
  return classIcon(classId);
}

function CreateGamePage() {
  return <RoomCreationGate>{password => <UnlockedCreateGamePage creationPassword={password} />}</RoomCreationGate>;
}

function UnlockedCreateGamePage({ creationPassword }: { creationPassword: string }) {
  const navigate = useNavigate();
  const [gameName, setGameName] = useState("Typing Boss Battle");
  const [selectedBossId, setSelectedBossId] =
    useState<TypingBossId>("infernalDragon");
  const [mode, setMode] = useState<TypingBossMode>("proportional");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedBoss =
    BOSS_CHOICES.find((boss) => boss.id === selectedBossId) || BOSS_CHOICES[1];
  const selectedArena = arenaForBoss(selectedBoss.id);

  async function handleCreate() {
    const name = gameName.trim();
    if (!name) return;

    setBusy(true);
    setError("");
    try {
      const response = await createTypingBossSession(name, selectedBossId, mode, creationPassword);
      saveCredential(response.sessionId, "host", response.hostToken, response.session.expiresAt);
      navigate(`/typing-boss/host/${response.sessionId}`);
    } catch (caught) {
      setError(messageFromError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageFrame>
      <Stack spacing={3}>
        <Button
          component={RouterLink}
          to="/"
          startIcon={<HomeIcon />}
          sx={{ alignSelf: "flex-start", color: "text.secondary" }}
        >
          Home
        </Button>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 420px" },
            gap: 3,
            alignItems: "stretch",
          }}
        >
          <Box>
            <Typography variant="h3" sx={{ fontWeight: 950, letterSpacing: 0 }}>
              Typing Boss Battle
            </Typography>
            <Typography
              sx={{
                color: "text.secondary",
                mt: 1,
                maxWidth: 720,
                fontSize: 18,
              }}
            >
              {mode === "proportional" ? "Become the Ancient Dragon and battle up to 30 players. Everyone types continuously; every ten words releases an attack." : "The original battle: typing speed, quiz answers, class moves, accuracy, and streaks."}
            </Typography>
          </Box>

          <Paper
            elevation={0}
            sx={{
              border: "1px solid #31394a",
              borderRadius: 2,
              p: 2.5,
            }}
          >
            <Stack spacing={2}>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>
                New Game
              </Typography>
              <TextField select label="Battle mode" value={mode} onChange={event => setMode(event.target.value as TypingBossMode)}>
                <MenuItem value="proportional">Proportional · Host vs players</MenuItem>
                <MenuItem value="old">Old mode · Original battle rules</MenuItem>
              </TextField>
              <TextField
                fullWidth
                label="Game name"
                value={gameName}
                inputProps={{ maxLength: 64 }}
                onChange={(event) => setGameName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleCreate();
                  }
                }}
              />
              <Stack spacing={1}>
                <Typography sx={{ fontWeight: 900 }}>Boss</Typography>
                {BOSS_CHOICES.map((boss) => {
                  const selected = boss.id === selectedBossId;
                  return (
                    <Button
                      key={boss.id}
                      variant={selected ? "contained" : "outlined"}
                      onClick={() => setSelectedBossId(boss.id)}
                      sx={{
                        justifyContent: "stretch",
                        borderRadius: 1,
                        p: 1,
                        borderColor: boss.color,
                        bgcolor: selected ? boss.color : "transparent",
                        color: selected ? "#111827" : "text.primary",
                        "&:hover": {
                          bgcolor: selected ? boss.color : `${boss.color}22`,
                        },
                      }}
                    >
                      <Stack spacing={0.5} sx={{ width: "100%" }}>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          spacing={1}
                        >
                          <Typography sx={{ fontWeight: 950 }}>
                            {boss.name}
                          </Typography>
                          <Typography sx={{ fontWeight: 950 }}>
                            {mode === "proportional" ? "HOST" : boss.difficulty.toUpperCase()}
                          </Typography>
                        </Stack>
                        <Typography
                          variant="caption"
                          sx={{
                            textAlign: "left",
                            opacity: selected ? 0.9 : 0.72,
                          }}
                        >
                          {mode === "proportional" ? "Host controlled · 100 HP × player count · attack every 10 words" : `Charge ${Math.round(boss.attackIntervalMs / 1000)}s | HP ${boss.hp}`}
                        </Typography>
                      </Stack>
                    </Button>
                  );
                })}
              </Stack>
              {error && <Alert severity="error">{error}</Alert>}
              <Button
                variant="contained"
                startIcon={<PlayArrowIcon />}
                disabled={busy || !gameName.trim()}
                onClick={handleCreate}
              >
                Create host session
              </Button>
              <Button
                component={RouterLink}
                to="/typing-boss/join"
                variant="outlined"
                startIcon={<PersonAddIcon />}
              >
                Join a game
              </Button>
            </Stack>
          </Paper>
        </Box>

        <Box
          sx={{
            minHeight: 360,
            border: "1px solid #31394a",
            borderRadius: 2,
            position: "relative",
            overflow: "hidden",
            bgcolor: "#10080a",
          }}
        >
          <VolcanicBackdrop />
          <Box
            sx={{
              position: "absolute",
              left: {
                xs: `${selectedArena.hostBossPoint.x - 4}%`,
                md: `${selectedArena.hostBossPoint.x}%`,
              },
              top: `${selectedArena.hostBossPoint.y}%`,
              transform: "translate(-50%, -50%)",

            }}
          >
            <BossSprite
              width={bossPreviewWidth(selectedBoss.id)}
              glow={selectedBoss.color}
              bossId={selectedBoss.id}
            />
          </Box>
          <Box
            sx={{
              position: "absolute",
              left: "50%",
              top: 28,
              transform: "translateX(-50%)",
              width: { xs: "84%", md: 700 },
              textAlign: "center",
            }}
          >
            <Typography
              sx={{
                fontFamily: "'Courier New', monospace",
                fontWeight: 950,
                fontSize: { xs: 17, md: 26 },
                textShadow: "0 3px 0 #000",
              }}
            >
              {selectedBoss.name.toUpperCase()}
            </Typography>
            <Box
              sx={{
                mt: 0.5,
                border: "2px solid #c08b32",
                bgcolor: "#30080a",
                p: 0.5,
                boxShadow: "0 0 0 2px #120707",
              }}
            >
              <StatBar
                value={selectedBoss.hp}
                max={selectedBoss.hp}
                color={selectedBoss.color}
                height={18}
              />
            </Box>
            <Typography sx={{ mt: 1, color: "#facc15", fontWeight: 900 }}>
              {mode === "proportional" ? "100 HP per player. The host types as the dragon. Classes share the same combat rules." : selectedBoss.description}
            </Typography>
          </Box>
        </Box>
      </Stack>
    </PageFrame>
  );
}

function HostSessionPage() {
  const { sessionId } = useParams();
  const normalizedSessionId = normalizeSessionAlias(sessionId || "");
  const hostToken = normalizedSessionId
    ? readSavedCredential(normalizedSessionId, "host")
    : "";
  const {
    connected,
    reconnecting,
    session,
    setSession,
    streamError,
    terminalReason,
  } = useTypingBossSessionStream(
    normalizedSessionId,
    hostToken ? { hostToken } : null
  );
  const [copied, setCopied] = useState(false);
  const [hpMultiplier, setHpMultiplier] = useState(1);
  const [balanced, setBalanced] = useState(false);
  const [balancedRandomColors,setBalancedRandomColors] = useState(true);
  const [wordFilters, setWordFilters] = useState<WordFilters>({});
  const lobbyPreview = useMemo(() => {
    if (!session || session.mode !== "proportional" || session.status !== "setup") return session;
    const playerHp = 100 * hpMultiplier;
    const bossHp = playerHp * session.players.length;
    return { ...session, typing: session.typing ? (balanced ? initializeBalanced({ ...session.typing, ...wordFilters, ability: "dragon", balancedRandomColors }) : { ...session.typing, ...wordFilters, balanced:false }) : session.typing, boss: { ...session.boss, hp: bossHp, maxHp: bossHp },
      players: session.players.map(player => ({ ...player, hp: playerHp, maxHp: playerHp })) };
  }, [session, hpMultiplier, wordFilters, balanced, balancedRandomColors]);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [outcomeDismissed, setOutcomeDismissed] = useState(false);

  useEffect(() => {
    if (session?.status === "active") {
      setOutcomeDismissed(false);
    }
  }, [session?.status]);

  if (!normalizedSessionId || !SESSION_ID_PATTERN.test(normalizedSessionId)) {
    return <Navigate to="/typing-boss" replace />;
  }

  if (!hostToken) {
    return (
      <PageFrame>
        <Alert severity="warning">
          Host access for this game is not saved in this browser.
        </Alert>
      </PageFrame>
    );
  }

  async function copyJoinLink() {
    try {
      await navigator.clipboard.writeText(joinUrlForSession(normalizedSessionId));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch (caught) {
      setActionError(messageFromError(caught));
    }
  }

  async function runHostAction(action: () => Promise<{ session: TypingBossSessionSnapshot }>) {
    setBusy(true);
    setActionError("");
    try {
      const response = await action();
      setSession(previous => acceptSessionSnapshot(previous, response.session));
    } catch (caught) {
      setActionError(messageFromError(caught));
    } finally {
      setBusy(false);
    }
  }

  if (!session && !terminalReason) {
    return <LoadingPanel label="Loading boss game..." />;
  }

  if (!session) {
    return (
      <PageFrame>
        <Alert severity="error">{streamError || "This game is unavailable."}</Alert>
      </PageFrame>
    );
  }

  return (
    <PageFrame>
      <Button component={RouterLink} to="/typing-boss" startIcon={<HomeIcon />} sx={{ mb: 2, alignSelf: "flex-start" }}>Main menu</Button>
      <ReconnectOverlay show={reconnecting} />
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant={session.mode === "proportional" ? "h5" : "h4"} sx={{ fontWeight: 950, letterSpacing: 0 }}>
                {session.name}
              </Typography>
              <StatusChip status={session.status} />
              {session.mode === "proportional" && session.status !== "setup" && <Chip label={session.balanced ? "Balanced" : "Randomized"} size="small" />}
              <Chip
                size="small"
                label={connected ? "LIVE" : "OFFLINE"}
                sx={{
                  bgcolor: connected ? "#123828" : "#34212a",
                  color: connected ? "#86efac" : "#fda4af",
                  fontWeight: 900,
                }}
              />
            </Stack>
            <Typography sx={{ color: "text.secondary", mt: 0.5 }}>
              {shortJoinCode(normalizedSessionId)} · {session.players.length} players ·{" "}
              {session.mode === "proportional" ? <SessionRemainingTime expiresAt={session.expiresAt} /> : formatRemaining(session.remainingSeconds)}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Tooltip title="Copy join link">
              <span>
                <IconButton onClick={copyJoinLink}>
                  <ContentCopyIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Chip
              label={copied ? "Copied" : joinUrlForSession(normalizedSessionId)}
              variant="outlined"
              sx={{ maxWidth: { xs: "100%", md: 420 }, fontFamily: "monospace" }}
            />
            <Button variant="outlined" onClick={() => setCodeModalOpen(true)}>
              Display Code
            </Button>
            <Button variant="outlined" onClick={() => setStatsOpen(true)}>
              Stats
            </Button>
            <Button
              variant="contained"
              startIcon={<PlayArrowIcon />}
              disabled={busy || session.status !== "setup" || (session.mode === "proportional" && !filteredWordCount(wordFilters))}
              onClick={() =>
                runHostAction(() =>
                  startTypingBossSession(normalizedSessionId, hostToken, hpMultiplier, wordFilters.gradeMask === undefined ? undefined : Array.from({length:13}, (_, i) => i).filter(i => wordFilters.gradeMask! & (1 << i)), wordFilters.sentimentMask === undefined ? undefined : SENTIMENTS.filter((_, i) => wordFilters.sentimentMask! & (1 << i)), balanced, balancedRandomColors)
                )
              }
            >
              Start
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<CloseIcon />}
              disabled={busy || ["closed", "expired"].includes(session.status)}
              onClick={() =>
                runHostAction(() =>
                  closeTypingBossSession(normalizedSessionId, hostToken)
                )
              }
            >
              Close
            </Button>
          </Stack>
        </Stack>

        {actionError && <Alert severity="error">{actionError}</Alert>}
        {streamError && !reconnecting && <Alert severity="warning">{streamError}</Alert>}

        {session.mode === "proportional" ? <>
          {session.status === "setup" && <Paper variant="outlined" sx={{ p: 2.5 }}>
            <FormControlLabel label="Balanced" control={<Switch checked={balanced} onChange={(_event, checked) => setBalanced(checked)} disabled={busy} inputProps={{ "aria-label": "Balanced" }} />} />
            {balanced && <FormControlLabel label="Random colors" control={<Switch checked={balancedRandomColors} onChange={(_event,checked)=>setBalancedRandomColors(checked)} disabled={busy} inputProps={{"aria-label":"Random colors"}}/>}/>}
            {balanced && <Typography variant="body2">{balancedRandomColors ? "Color chances per word: white 40%, orange 20%, blue 18%, green 15%, crit 4%, special 3%. Banking stays active." : "Scheduled colors: special every 150 correct characters; crit every 134."}</Typography>}
            <Typography variant="body2" sx={{ color:"text.secondary" }}>{balanced ? "Skill-earned power, shared words and banking. Color settings lock at Start." : "Randomized colors, critical hits, dodges, and boss patterns."}</Typography>
            <WordFilterChips value={wordFilters} onChange={setWordFilters} disabled={busy} />
            <Typography id="hp-multiplier-label" fontWeight={900}>HP multiplier: ×{hpMultiplier}</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
              Players start with {(100 * hpMultiplier).toLocaleString()} HP each. The dragon starts with {(100 * hpMultiplier * session.players.length).toLocaleString()} HP. Damage stays the same for both sides.
            </Typography>
            <Slider aria-labelledby="hp-multiplier-label" value={hpMultiplier} min={1} max={100} step={1}
              disabled={busy} valueLabelDisplay="auto" onChange={(_event, value) => setHpMultiplier(value as number)}
              marks={[{ value: 1, label: "1×" }, { value: 10, label: "10×" }, { value: 30, label: "30×" }, { value: 60, label: "60×" }, { value: 100, label: "100×" }]} />
          </Paper>}
          <HostBattlefield session={lobbyPreview!} />
          {filteredWordCount(wordFilters) > 0 && <ContinuousTyping key={`${lobbyPreview!.typing!.seed}:${lobbyPreview!.typing!.gradeMask}:${lobbyPreview!.typing!.sentimentMask}:${balanced}:${balancedRandomColors}`} sessionId={normalizedSessionId} countdownEndsAt={session.countdownEndsAt} serverNow={session.serverNow} healingPool={session.clericHealingPool} credentials={{ hostToken }} state={lobbyPreview!.typing!} active={session.status === "active" && connected}
            hostProfile={{boss:lobbyPreview!.boss,events:collectCombatAnimations(session.projectiles).get("boss") || NO_ANIMATION_EVENTS,serverNow:session.serverNow}} />}
        </> : <Grid container spacing={2}>
          <Grid item xs={12} lg={8}>
            <HostBattlefield session={session} />
          </Grid>
          <Grid item xs={12} lg={4}>
            <Stack spacing={2}>
              <PlayerRoster players={session.players} />
              <BattleLog session={session} />
            </Stack>
          </Grid>
        </Grid>}
        <HostBattleLog key={session.id} session={session} />
      </Stack>
      <HostCodeModal
        open={codeModalOpen}
        sessionId={normalizedSessionId}
        onClose={() => setCodeModalOpen(false)}
      />
      <BattleStatsModal
        open={statsOpen}
        session={session}
        onClose={() => setStatsOpen(false)}
      />
      <BattleOutcomeModal
        host
        open={
          ["victory", "defeat"].includes(session.status) &&
          !outcomeDismissed &&
          !statsOpen
        }
        session={session}
        onClose={() => setOutcomeDismissed(true)}
        onStats={() => {
          setOutcomeDismissed(true);
          setStatsOpen(true);
        }}
      />
    </PageFrame>
  );
}

function JoinPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const querySession = normalizeSessionAlias(searchParams.get("session") || "");
  const [sessionDigits, setSessionDigits] = useState(
    querySession.replace(/^boss/i, "")
  );
  const [name, setName] = useState(() => generateJoinName());
  const [classId, setClassId] = useState<TypingBossClassId>("cleric");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const normalizedSessionId = normalizeSessionAlias(sessionDigits);

  async function handleJoin() {
    if (!SESSION_ID_PATTERN.test(normalizedSessionId)) {
      setError("Enter a valid boss session code.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await createTypingBossParticipant(
        normalizedSessionId,
        name,
        classId
      );
      saveCredential(normalizedSessionId, "player", response.code, response.session.expiresAt);
      navigate(`/typing-boss/play/${normalizedSessionId}`);
    } catch (caught) {
      setError(messageFromError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageFrame>
      <Stack spacing={3}>
        <Button
          component={RouterLink}
          to="/typing-boss"
          startIcon={<HomeIcon />}
          sx={{ alignSelf: "flex-start", color: "text.secondary" }}
        >
          Typing Boss
        </Button>

        <Box>
          <Typography variant="h3" sx={{ fontWeight: 950, letterSpacing: 0 }}>
            Join a Game
          </Typography>
            <Typography sx={{ color: "text.secondary", mt: 1 }}>
            Choose your class and a friendly hero name, then enter the host’s three-character code. In proportional mode, all classes start with 100 HP, and perfect gold words activate a class ability. The move descriptions below apply to old mode.
          </Typography>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
            <Paper
              elevation={0}
              sx={{ border: "1px solid #31394a", borderRadius: 2, p: 2.5 }}
            >
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  label="Session code"
                  value={sessionDigits}
                  onChange={(event) =>
                    setSessionDigits(
                      event.target.value
                        .replace(/^boss/i, "")
                        .toUpperCase()
                        .replace(/[^0-9A-F]/g, "")
                        .slice(0, 3)
                    )
                  }
                  helperText="The three characters shown on the host’s screen"
                  inputProps={{ maxLength: 7, autoCapitalize: "characters" }}
                />
                <TextField
                  fullWidth
                  label="Player name"
                  value={name}
                  InputProps={{ readOnly: true }}
                  helperText="A short, classroom-friendly name. Shuffle to pick another."
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleJoin();
                    }
                  }}
                />
                <Button variant="outlined" disabled={busy} onClick={() => setName(previous => generateJoinName(previous))}>
                  Shuffle name
                </Button>
                <TextField
                  select
                  fullWidth
                  label="Class"
                  value={classId}
                  onChange={(event) =>
                    setClassId(normalizeClassSelection(event.target.value))
                  }
                >
                  {CLASS_ORDER.map((item) => (
                    <MenuItem key={item} value={item}>
                      {CLASS_INFO[item].label}
                    </MenuItem>
                  ))}
                </TextField>
                {error && <Alert severity="error">{error}</Alert>}
                <Button
                  variant="contained"
                  startIcon={<PersonAddIcon />}
                  disabled={busy || !SESSION_ID_PATTERN.test(normalizedSessionId)}
                  onClick={handleJoin}
                >
                  Join
                </Button>
              </Stack>
            </Paper>
          </Grid>

          <Grid item xs={12} md={7}>
            <Grid container spacing={2}>
              {CLASS_ORDER.map((item) => {
                const info = CLASS_INFO[item];
                return (
                <Grid item xs={12} sm={6} md={4} key={item}>
                  <Paper
                    role="button"
                    tabIndex={0}
                    aria-pressed={classId === item}
                    elevation={0}
                    onClick={() => setClassId(item)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setClassId(item);
                      }
                    }}
                    sx={{
                      border:
                        classId === item
                          ? "2px solid #67e8f9"
                          : "1px solid #31394a",
                      borderRadius: 2,
                      p: 2,
                      cursor: "pointer",
                      minHeight: 238,
                      bgcolor: `${info.color}14`,
                    }}
                  >
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <PlayerCharacterSprite
                          classId={item}
                          color={info.color}
                          size={104}
                        />
                        <ClassMark classId={item} size={42} />
                      </Stack>
                      <Typography variant="h5" sx={{ fontWeight: 950 }}>
                        {info.label}
                      </Typography>
                      <Typography sx={{ color: "text.secondary" }}>
                        {info.detail}
                      </Typography>
                    </Stack>
                  </Paper>
                </Grid>
                );
              })}
            </Grid>
          </Grid>
        </Grid>
      </Stack>
    </PageFrame>
  );
}

function PlayerSessionPage() {
  const { sessionId } = useParams();
  const normalizedSessionId = normalizeSessionAlias(sessionId || "");
  const [savedCode, setSavedCode] = useState(() =>
    normalizedSessionId
      ? normalizePlayerCode(
          readSavedCredential(normalizedSessionId, "player")
        )
      : ""
  );
  const [verified, setVerified] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [statsOpen, setStatsOpen] = useState(false);
  const [outcomeDismissed, setOutcomeDismissed] = useState(false);
  const {
    reconnecting,
    session,
    streamError,
    terminalReason,
  } = useTypingBossSessionStream(
    normalizedSessionId,
    verified && savedCode ? { code: savedCode } : null
  );

  useEffect(() => {
    if (!normalizedSessionId || !savedCode) return;

    let cancelled = false;
    setVerified(false);
    setVerifyError("");
    verifyTypingBossParticipant(normalizedSessionId, savedCode)
      .then(response => {
        if (!cancelled) {
          saveCredential(normalizedSessionId, "player", savedCode, response.session.expiresAt);
          setVerified(true);
        }
      })
      .catch((caught) => {
        if (cancelled) return;
        if ([401, 403, 404, 410].includes(getErrorStatus(caught) || 0)) {
          removeSavedCredential(normalizedSessionId, "player", savedCode);
          setSavedCode("");
        }
        setVerifyError(messageFromError(caught));
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedSessionId, savedCode]);

  useEffect(() => {
    if (session?.status === "active") {
      setOutcomeDismissed(false);
    }
  }, [session?.status]);

  if (!normalizedSessionId || !SESSION_ID_PATTERN.test(normalizedSessionId)) {
    return <Navigate to="/typing-boss/join" replace />;
  }

  if (!savedCode || !PLAYER_CODE_PATTERN.test(savedCode)) {
    return (
      <Navigate
        to={`/typing-boss/join?session=${normalizedSessionId}`}
        replace
      />
    );
  }

  if (verifyError) {
    return (
      <PageFrame>
        <Alert severity="warning">{verifyError}</Alert>
      </PageFrame>
    );
  }

  if (!verified || (!session && !terminalReason)) {
    return <LoadingPanel label="Joining boss game..." />;
  }

  if (!session) {
    return (
      <PageFrame>
        <Alert severity="error">{streamError || "This game is unavailable."}</Alert>
      </PageFrame>
    );
  }

  const me = session.players.find((player) => player.code === savedCode);
  if (!me) {
    return (
      <Navigate
        to={`/typing-boss/join?session=${normalizedSessionId}`}
        replace
      />
    );
  }

  return (
    <PageFrame>
      <Button component={RouterLink} to="/typing-boss" startIcon={<HomeIcon />} sx={{ mb: 2, alignSelf: "flex-start" }}>Main menu</Button>
      <ReconnectOverlay show={reconnecting} />
      {session.mode === "proportional" ? <Stack spacing={2}>
        <PlayerTypingBattle session={session} me={me} code={savedCode} active={session.status === "active" && !me.defeated && !reconnecting} />
        {session.leaderboard && <BattleLeaderboard entries={session.leaderboard} />}
      </Stack> : <PlayerBattlePanel
        session={session}
        me={me}
        sessionId={normalizedSessionId}
        code={savedCode}
        onOpenStats={() => setStatsOpen(true)}
      />}
      <BattleStatsModal
        open={statsOpen}
        session={session}
        me={me}
        onClose={() => setStatsOpen(false)}
      />
      <BattleOutcomeModal
        open={
          ["victory", "defeat"].includes(session.status) &&
          !outcomeDismissed &&
          !statsOpen
        }
        session={session}
        onClose={() => setOutcomeDismissed(true)}
        onStats={() => {
          setOutcomeDismissed(true);
          setStatsOpen(true);
        }}
      />
    </PageFrame>
  );
}

function specialTargetMode(classId: TypingBossClassId) {
  if (classId === "cleric") return "heal";
  if (classId === "paladin") return "buff";
  if (classId === "necromancer") return "resurrect";
  return "";
}

function specialTargetTitle(classId: TypingBossClassId) {
  if (classId === "paladin") return "Buff Target";
  if (classId === "necromancer") return "Resurrection Target";
  return "Heal Target";
}

function specialTargetError(classId: TypingBossClassId) {
  if (classId === "paladin") return "Blessed Rally needs another living player.";
  if (classId === "necromancer") return "Soul Return needs a fallen player.";
  return "Radiant Mend needs a valid target.";
}

function PlayerBattlePanel({
  session,
  me,
  sessionId,
  code,
  onOpenStats,
}: {
  session: TypingBossSessionSnapshot;
  me: TypingBossPlayer;
  sessionId: string;
  code: string;
  onOpenStats: () => void;
}) {
  const [menuIndex, setMenuIndex] = useState(0);
  const [mode, setMode] = useState<"menu" | "target" | "typing">("menu");
  const [challenge, setChallenge] = useState<TypingBossChallenge | null>(null);
  const [typedQuestion, setTypedQuestion] = useState("");
  const [answerInput, setAnswerInput] = useState("");
  const [targetIndex, setTargetIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [statusText, setStatusText] = useState("");
  const [typingStats, setTypingStats] = useState<TypingProgressStats>({
    accepted: 0,
    mistakes: 0,
    missedTypes: createMissedTypeCounts(),
    startedAt: Date.now(),
    updatedAt: Date.now(),
  });
  const [bonusAnimation, setBonusAnimation] = useState<{
    steps: BonusStep[];
    activeIndex: number;
  } | null>(null);
  const typingRef = useRef({
    question: "",
    answer: "",
    accepted: 0,
    mistakes: 0,
    missedTypes: createMissedTypeCounts(),
    startedAt: 0,
    submitting: false,
  });
  const challengeRef = useRef<TypingBossChallenge | null>(null);
  const modeRef = useRef(mode);
  const meRef = useRef(me);

  useEffect(() => {
    challengeRef.current = challenge;
  }, [challenge]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    meRef.current = me;
  }, [me]);

  const publishTypingStats = useCallback(() => {
    const activeChallenge = challengeRef.current;
    const accepted = activeChallenge
      ? acceptedCharactersForInputs(
          activeChallenge,
          typingRef.current.question,
          typingRef.current.answer
        )
      : typingRef.current.accepted;
    typingRef.current.accepted = accepted;
    setTypingStats({
      accepted,
      mistakes: typingRef.current.mistakes,
      missedTypes: { ...typingRef.current.missedTypes },
      startedAt: typingRef.current.startedAt || Date.now(),
      updatedAt: Date.now(),
    });
  }, []);

  const moves = useMemo(
    () => {
      const info = CLASS_INFO[me.classId];
      const specialDetail = me.specialReady
        ? info.specialDetail
        : me.classId === "monk"
        ? `Ready in ${Math.max(1, 2 - me.monkSpecialCharge)} turn`
        : "Already active";

      return [
        {
          id: "weak" as TypingBossMoveId,
          label: "Weak Attack",
          detail: "Easy",
        },
        {
          id: "strong" as TypingBossMoveId,
          label: "Strong Attack",
          detail: "Medium",
        },
        {
          id: "special" as TypingBossMoveId,
          label: info.special,
          detail: specialDetail,
          disabled: !me.specialReady,
        },
        {
          id: "potion" as TypingBossMoveId,
          label: "Potion",
          detail: "Self heal",
        },
      ];
    },
    [me.classId, me.monkSpecialCharge, me.specialReady]
  );

  const targetCandidates = useMemo(() => {
    const alive = session.players.filter((player) => !player.defeated);
    const allies = alive.filter((player) => player.code !== me.code);
    const targetMode = specialTargetMode(me.classId);
    if (targetMode === "buff") return allies;
    if (targetMode === "resurrect") {
      return session.players.filter((player) => player.defeated && player.code !== me.code);
    }
    if (targetMode === "heal") return allies.length > 0 ? allies : alive;
    return [];
  }, [me.classId, me.code, session.players]);

  const countdown=useBattleCountdown(session.countdownEndsAt,session.serverNow);
  const canAct = session.status === "active" && countdown===0 && !me.defeated && !busy;

  const startChallenge = useCallback(
    async (moveId: TypingBossMoveId, targetCode?: string) => {
      if (!canAct) return;

      setBusy(true);
      setError("");
      setStatusText("");
      try {
        const response = await createTypingBossChallenge(
          sessionId,
          code,
          moveId,
          targetCode
        );
        typingRef.current = {
          question: "",
          answer: "",
          accepted: 0,
          mistakes: 0,
          missedTypes: createMissedTypeCounts(),
          startedAt: Date.now(),
          submitting: false,
        };
        setTypingStats({
          accepted: 0,
          mistakes: 0,
          missedTypes: createMissedTypeCounts(),
          startedAt: typingRef.current.startedAt,
          updatedAt: Date.now(),
        });
        setBonusAnimation(null);
        setChallenge(response.challenge);
        setTypedQuestion("");
        setAnswerInput("");
        setMode("typing");
      } catch (caught) {
        setError(messageFromError(caught));
      } finally {
        setBusy(false);
      }
    },
    [canAct, code, sessionId]
  );

  const chooseSelectedMove = useCallback(() => {
    const move = moves[menuIndex];
    if (!move || !canAct) return;
    if (move.disabled) {
      setError(
        meRef.current.classId === "monk"
          ? "Third Palm is ready every third turn."
          : "That special is already active."
      );
      return;
    }

    if (move.id === "special" && specialTargetMode(meRef.current.classId)) {
      if (targetCandidates.length === 0) {
        setError(specialTargetError(meRef.current.classId));
        return;
      }
      setTargetIndex(0);
      setMode("target");
      return;
    }

    startChallenge(move.id);
  }, [canAct, menuIndex, moves, startChallenge, targetCandidates.length]);

  const recordMistake = useCallback((type: MissedCharacterType) => {
    typingRef.current.mistakes += 1;
    typingRef.current.missedTypes[type] += 1;
    publishTypingStats();
  }, [publishTypingStats]);

  const completeAnswer = useCallback(
    async (answerText: string) => {
      const activeChallenge = challengeRef.current;
      if (!activeChallenge || typingRef.current.submitting) return;

      typingRef.current.submitting = true;
      setBusy(true);
      setError("");
      setStatusText("Adding attack bonuses.");
      const acceptedCharacters = acceptedCharactersForInputs(
        activeChallenge,
        typingRef.current.question,
        typingRef.current.answer
      );
      typingRef.current.accepted = acceptedCharacters;
      const finalTypingStats = {
        accepted: acceptedCharacters,
        mistakes: typingRef.current.mistakes,
        missedTypes: { ...typingRef.current.missedTypes },
        startedAt: typingRef.current.startedAt,
        updatedAt: Date.now(),
      };
      const preview = liveAttackStats(
        activeChallenge,
        meRef.current,
        finalTypingStats,
        answerText,
        Date.now()
      );
      const steps: BonusStep[] = [
        {
          label: "Characters",
          value: `${preview.baseCharacters}`,
        },
        {
          label: "Move Power",
          value: `x${activeChallenge.movePower.toFixed(2)}`,
        },
        {
          label: "Speed",
          value: `x${preview.speedMultiplier.toFixed(2)}`,
        },
        {
          label: "Accuracy",
          value: `x${preview.accuracyMultiplier.toFixed(2)}`,
        },
        {
          label: "Streak",
          value: `x${preview.streakMultiplier.toFixed(2)}`,
        },
        {
          label: challengeEffectLabel(activeChallenge),
          value: challengeEffectValue(activeChallenge, preview),
        },
      ];
      if (
        activeChallenge.kind === "damage" &&
        (meRef.current.nextAttackMultiplier || 1) > 1
      ) {
        steps.splice(5, 0, {
          label: "Paladin Buff",
          value: `x${meRef.current.nextAttackMultiplier.toFixed(2)}`,
        });
      }
      setBonusAnimation({ steps, activeIndex: -1 });
      for (let index = 0; index < steps.length; index += 1) {
        setBonusAnimation({ steps, activeIndex: index });
        await sleep(360);
      }
      setStatusText("Projectile launched.");
      try {
        await submitTypingBossAction(sessionId, code, {
          challengeId: activeChallenge.id,
          answerText,
          durationMs: Date.now() - typingRef.current.startedAt,
          acceptedCharacters,
          mistakes: typingRef.current.mistakes,
        });
        setChallenge(null);
        setTypedQuestion("");
        setAnswerInput("");
        setBonusAnimation(null);
        setTypingStats({
          accepted: 0,
          mistakes: 0,
          missedTypes: createMissedTypeCounts(),
          startedAt: Date.now(),
          updatedAt: Date.now(),
        });
        setMode("menu");
      } catch (caught) {
        setError(messageFromError(caught));
        setBonusAnimation(null);
        typingRef.current.submitting = false;
      } finally {
        setBusy(false);
      }
    },
    [code, sessionId]
  );

  const processTypingKey = useCallback(
    (event: KeyboardEvent) => {
      const activeChallenge = challengeRef.current;
      if (!activeChallenge || typingRef.current.submitting) return;

      if (event.key === "Escape") {
        event.preventDefault();
        setChallenge(null);
        setTypedQuestion("");
        setAnswerInput("");
        setMode("menu");
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        if (typingRef.current.answer.length > 0) {
          const next = typingRef.current.answer.slice(0, -1);
          typingRef.current.answer = next;
          setAnswerInput(next);
          publishTypingStats();
          return;
        }

        if (typingRef.current.question.length > 0) {
          const next = typingRef.current.question.slice(0, -1);
          typingRef.current.question = next;
          setTypedQuestion(next);
          publishTypingStats();
        }
        return;
      }

      if (event.key.length !== 1) return;
      event.preventDefault();

      const typedQuestionValue = typingRef.current.question;
      const questionComplete = typedQuestionValue === activeChallenge.question;
      if (!questionComplete) {
        if (typedQuestionValue.length >= activeChallenge.question.length) {
          recordMistake("extra");
          return;
        }

        const expected = activeChallenge.question[typedQuestionValue.length];
        const next = typedQuestionValue + event.key;
        typingRef.current.question = next;
        setTypedQuestion(next);
        if (!keyMatches(event.key, expected)) {
          recordMistake(classifyCharacterType(expected));
          return;
        }
        publishTypingStats();
        return;
      }

      const proposed = typingRef.current.answer + event.key;
      const maxAnswerLength = Math.max(
        ...activeChallenge.answers.map((answer) => answer.length)
      );
      if (typingRef.current.answer.length >= maxAnswerLength) {
        recordMistake("extra");
        return;
      }

      const matches = activeChallenge.answers.filter((answer) =>
        normalizeAnswerText(answer).startsWith(proposed)
      );

      typingRef.current.answer = proposed;
      setAnswerInput(proposed);
      if (matches.length === 0) {
        recordMistake(classifyCharacterType(event.key));
        return;
      }
      publishTypingStats();

      const exact = matches.filter((answer) => normalizeAnswerText(answer) === proposed);
      if (matches.length === 1 && exact.length === 1) {
        completeAnswer(exact[0]);
      }
    },
    [completeAnswer, publishTypingStats, recordMistake]
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return;
      }

      if (modeRef.current === "typing") {
        processTypingKey(event);
        return;
      }

      if (!canAct) return;

      if (modeRef.current === "target") {
        if (["s", "e"].includes(event.key.toLowerCase())) {
          event.preventDefault();
          setTargetIndex((value) =>
            targetCandidates.length
              ? (value - 1 + targetCandidates.length) % targetCandidates.length
              : 0
          );
        } else if (["f", "d"].includes(event.key.toLowerCase())) {
          event.preventDefault();
          setTargetIndex((value) =>
            targetCandidates.length ? (value + 1) % targetCandidates.length : 0
          );
        } else if (event.key === "Enter") {
          event.preventDefault();
          const target = targetCandidates[targetIndex];
          if (target) startChallenge("special", target.code);
        } else if (event.key === "Escape") {
          event.preventDefault();
          setMode("menu");
        }
        return;
      }

      const key = event.key.toLowerCase();
      if (["s", "d", "f", "e"].includes(key)) {
        event.preventDefault();
        setMenuIndex((value) => {
          const row = Math.floor(value / 2);
          const col = value % 2;
          if (key === "s") return row * 2 + Math.max(0, col - 1);
          if (key === "f") return row * 2 + Math.min(1, col + 1);
          if (key === "e") return Math.max(0, row - 1) * 2 + col;
          return Math.min(1, row + 1) * 2 + col;
        });
      } else if (event.key === "Enter") {
        event.preventDefault();
        chooseSelectedMove();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    canAct,
    chooseSelectedMove,
    processTypingKey,
    startChallenge,
    targetCandidates,
    targetIndex,
  ]);

  useEffect(() => {
    if (mode === "target" && targetIndex >= targetCandidates.length) {
      setTargetIndex(0);
    }
  }, [mode, targetCandidates.length, targetIndex]);

  const activeAnswerMatches = challenge
    ? challenge.answers.filter((answer) =>
        normalizeAnswerText(answer).startsWith(answerInput)
      )
    : [];

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between">
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="h4" sx={{ fontWeight: 950, letterSpacing: 0 }}>
              {session.name}
            </Typography>
            <StatusChip status={session.status} />
            <Chip
              label={me.code}
              variant="outlined"
              sx={{ fontFamily: "monospace", fontWeight: 900 }}
            />
          </Stack>
          <Typography sx={{ color: "text.secondary", mt: 0.5 }}>
            {me.name} · {me.classLabel} · {formatRemaining(session.remainingSeconds)}
          </Typography>
        </Box>

        <Button
          variant="outlined"
          onClick={onOpenStats}
          sx={{ alignSelf: { xs: "stretch", md: "flex-start" } }}
        >
          Stats
        </Button>

        <Paper
          elevation={0}
          sx={{
            minWidth: { xs: "100%", md: 300 },
            border: "1px solid #31394a",
            borderRadius: 2,
            p: 1.5,
          }}
        >
          <Stack spacing={0.75}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ClassMark classId={me.classId} size={38} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontWeight: 950 }}>{me.name}</Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Accuracy {Math.round(me.accuracy * 100)}% · Streak{" "}
                  {me.correctStreak}
                </Typography>
              </Box>
            </Stack>
            <StatBar value={me.hp} max={me.maxHp} color={playerHealthColor(me.hp,me.maxHp,me.defeated)} />
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              HP {me.hp}/{me.maxHp}
            </Typography>
          </Stack>
        </Paper>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}
      {statusText && <Alert severity="info">{statusText}</Alert>}

      <Grid container spacing={2} alignItems="flex-start">
        <Grid item xs={12} lg={8}>
          <Stack spacing={2}>
            <PlayerBattlefield session={session} me={me} />
            <Paper
              elevation={0}
              sx={{
                border: "1px solid #31394a",
                borderRadius: 2,
                p: { xs: 1.25, md: 2 },
                bgcolor: "#071018",
                boxShadow: "0 0 0 2px #080b10, inset 0 0 0 2px #c08b32",
              }}
            >
              {mode === "typing" && challenge ? (
                <TypingChallengeView
                  challenge={challenge}
                  player={me}
                  typingStats={typingStats}
                  typedQuestion={typedQuestion}
                  answerInput={answerInput}
                  activeAnswerMatches={activeAnswerMatches}
                  bonusAnimation={bonusAnimation}
                  busy={busy}
                />
              ) : mode === "target" ? (
                <TargetSelector
                  title={specialTargetTitle(me.classId)}
                  emptyLabel={specialTargetError(me.classId)}
                  targets={targetCandidates}
                  selectedIndex={targetIndex}
                  onSelect={(index) => setTargetIndex(index)}
                  onConfirm={() => {
                    const target = targetCandidates[targetIndex];
                    if (target) startChallenge("special", target.code);
                  }}
                />
              ) : (
                <MoveMenu
                  moves={moves}
                  selectedIndex={menuIndex}
                  classId={me.classId}
                  disabled={!canAct}
                  onSelect={(index) => setMenuIndex(index)}
                  onConfirm={chooseSelectedMove}
                />
              )}
            </Paper>
          </Stack>
        </Grid>
        <Grid item xs={12} lg={4}>
          <Stack spacing={2}>
            <PlayerRoster players={session.players} />
            <BattleLog session={session} compact />
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}

function MoveMenu({
  moves,
  selectedIndex,
  classId,
  disabled,
  onSelect,
  onConfirm,
}: {
  moves: { id: TypingBossMoveId; label: string; detail: string; disabled?: boolean }[];
  selectedIndex: number;
  classId: TypingBossClassId;
  disabled: boolean;
  onSelect: (index: number) => void;
  onConfirm: () => void;
}) {
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6" sx={{ fontWeight: 950 }}>
          Action Menu
        </Typography>
        <Chip
          size="small"
          icon={<KeyboardIcon />}
          label="S D F E"
          variant="outlined"
          sx={{ fontWeight: 900 }}
        />
      </Stack>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 1,
        }}
      >
        {moves.map((move, index) => {
          const selected = index === selectedIndex;
          return (
            <Button
              key={move.id}
              variant={selected ? "contained" : "outlined"}
              disabled={disabled || move.disabled}
              onClick={() => onSelect(index)}
              onDoubleClick={onConfirm}
              sx={{
                minHeight: 96,
                borderRadius: 2,
                justifyContent: "flex-start",
                textAlign: "left",
                p: 1.25,
                outline: selected ? "2px solid #facc15" : "none",
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ width: "100%" }}>
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    bgcolor: selected ? "rgba(15,23,42,.22)" : "rgba(103,232,249,.08)",
                  }}
                >
                  {moveIcon(move.id, classId)}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 950, lineHeight: 1.15 }}>
                    {move.label}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.82 }}>
                    {move.detail}
                  </Typography>
                </Box>
              </Stack>
            </Button>
          );
        })}
      </Box>
      <Button
        variant="contained"
        disabled={disabled || Boolean(moves[selectedIndex]?.disabled)}
        onClick={onConfirm}
      >
        Select
      </Button>
    </Stack>
  );
}

function TargetSelector({
  title,
  emptyLabel,
  targets,
  selectedIndex,
  onSelect,
  onConfirm,
}: {
  title: string;
  emptyLabel: string;
  targets: TypingBossPlayer[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onConfirm: () => void;
}) {
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6" sx={{ fontWeight: 950 }}>
          {title}
        </Typography>
        <Chip size="small" label="Enter" variant="outlined" sx={{ fontWeight: 900 }} />
      </Stack>
      <Stack spacing={1}>
        {targets.length === 0 && (
          <Alert severity="info">{emptyLabel}</Alert>
        )}
        {targets.map((target, index) => (
          <Button
            key={target.code}
            variant={index === selectedIndex ? "contained" : "outlined"}
            onClick={() => onSelect(index)}
            sx={{ justifyContent: "stretch", borderRadius: 2, p: 1 }}
          >
            <Stack spacing={0.75} sx={{ width: "100%" }}>
              <Stack direction="row" justifyContent="space-between">
                <Typography sx={{ fontWeight: 950 }}>{target.name}</Typography>
                <Typography>{target.hp}/{target.maxHp}</Typography>
              </Stack>
              <StatBar value={target.hp} max={target.maxHp} color={playerHealthColor(target.hp,target.maxHp,target.defeated)} />
            </Stack>
          </Button>
        ))}
      </Stack>
      <Button variant="contained" onClick={onConfirm} disabled={targets.length === 0}>
        Select Target
      </Button>
    </Stack>
  );
}

function TypingChallengeView({
  challenge,
  player,
  typingStats,
  typedQuestion,
  answerInput,
  activeAnswerMatches,
  bonusAnimation,
  busy,
}: {
  challenge: TypingBossChallenge;
  player: TypingBossPlayer;
  typingStats: TypingProgressStats;
  typedQuestion: string;
  answerInput: string;
  activeAnswerMatches: string[];
  bonusAnimation: { steps: BonusStep[]; activeIndex: number } | null;
  busy: boolean;
}) {
  const now = useNow(120);
  const questionDone = typedQuestion === challenge.question;
  const uniqueAnswer =
    answerInput && activeAnswerMatches.length === 1
      ? activeAnswerMatches[0]
      : "";
  const missedEntries = missedTypeEntries(typingStats.missedTypes);
  const preview = liveAttackStats(
    challenge,
    player,
    typingStats,
    answerInput,
    now
  );

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6" sx={{ fontWeight: 950 }}>
          {challenge.moveLabel}
        </Typography>
        <Chip size="small" label={challenge.difficulty.toUpperCase()} />
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(2, minmax(0, 1fr))",
            sm: "repeat(4, minmax(0, 1fr))",
          },
          gap: 1,
        }}
      >
        {[
          {
            label: "Live Accuracy",
            value: `${Math.round(preview.accuracy * 100)}%`,
          },
          {
            label: "DPS",
            value: preview.effectiveDps.toFixed(1),
          },
          {
            label: "Multiplier",
            value: `x${preview.totalMultiplier.toFixed(2)}`,
          },
          {
            label: "Misses",
            value: `${typingStats.mistakes}`,
          },
          {
            label: challengeEffectLabel(challenge),
            value: challengeEffectValue(challenge, preview),
          },
        ].map((stat) => (
          <Box
            key={stat.label}
            sx={{
              border: "1px solid #31394a",
              borderRadius: 1,
              p: 0.75,
              bgcolor: "#0f151f",
            }}
          >
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", fontWeight: 800 }}
            >
              {stat.label}
            </Typography>
            <Typography sx={{ fontWeight: 950, fontSize: 18 }}>
              {stat.value}
            </Typography>
          </Box>
        ))}
      </Box>

      {missedEntries.length > 0 && (
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 900 }}>
            Missed Types
          </Typography>
          {missedEntries.map((entry) => (
            <Chip
              key={entry.type}
              size="small"
              label={`${MISSED_CHARACTER_TYPE_LABELS[entry.type]} ${entry.count}`}
              sx={{
                height: 22,
                bgcolor: "rgba(251,113,133,.12)",
                color: "#fecdd3",
                border: "1px solid rgba(251,113,133,.45)",
                fontWeight: 900,
              }}
            />
          ))}
        </Stack>
      )}

      <Box
        sx={{
          border: "1px solid #31394a",
          borderRadius: 2,
          p: 1.5,
          bgcolor: "#0f151f",
        }}
      >
        <Typography
          component="div"
          sx={{
            fontFamily: "monospace",
            fontSize: 19,
            lineHeight: 1.55,
            overflowWrap: "anywhere",
          }}
        >
          {challenge.question.split("").map((char, index) => {
            const typed = index < typedQuestion.length;
            const typedChar = typed ? typedQuestion[index] : "";
            const correct = typed && keyMatches(typedChar, char);
            const wrong = typed && !correct;
            const active = !typed && index === typedQuestion.length;
            return (
              <Box
                key={`${char}-${index}`}
                component="span"
                title={wrong ? `Expected ${char === " " ? "space" : char}` : undefined}
                sx={{
                  color: wrong
                    ? "#fb7185"
                    : correct
                    ? "#facc15"
                    : active
                    ? "#f8fafc"
                    : "#94a3b8",
                  bgcolor: wrong
                    ? "rgba(251,113,133,.16)"
                    : active
                    ? "rgba(103,232,249,.18)"
                    : "transparent",
                  borderBottom: wrong ? "2px solid #fb7185" : "none",
                  borderRadius: active || wrong ? 1 : 0,
                  px: active || wrong ? 0.25 : 0,
                }}
              >
                {(typed ? typedChar : char) === " " ? "\u00a0" : typed ? typedChar : char}
              </Box>
            );
          })}
        </Typography>
      </Box>

      {questionDone && (
        <Stack spacing={1}>
          <Typography sx={{ color: "text.secondary", fontWeight: 800 }}>
            Answer
          </Typography>
          <Box
            sx={{
              minHeight: 38,
              border: "1px solid #31394a",
              borderRadius: 2,
              px: 1.25,
              display: "flex",
              alignItems: "center",
              fontFamily: "monospace",
              fontSize: 20,
              color: "#67e8f9",
            }}
          >
            {answerInput ? (
              answerInput.split("").map((char, index) => {
                const valid = answerCharacterIsValidPrefix(
                  challenge.answers,
                  answerInput,
                  index
                );
                return (
                  <Box
                    key={`${char}-${index}`}
                    component="span"
                    sx={{
                      color: valid ? "#67e8f9" : "#fb7185",
                      bgcolor: valid ? "transparent" : "rgba(251,113,133,.16)",
                      borderBottom: valid ? "none" : "2px solid #fb7185",
                      borderRadius: valid ? 0 : 1,
                      px: valid ? 0 : 0.25,
                    }}
                  >
                    {char === " " ? "\u00a0" : char}
                  </Box>
                );
              })
            ) : (
              "\u00a0"
            )}
          </Box>
          <Grid container spacing={1}>
            {challenge.answers.map((answer) => {
              const shouldHighlight =
                Boolean(answerInput) &&
                normalizeAnswerText(answer).startsWith(answerInput) &&
                (!uniqueAnswer || uniqueAnswer === answer);

              return (
                <Grid item xs={12} sm={6} key={answer}>
                  <Paper
                    elevation={0}
                    sx={{
                      border: shouldHighlight
                        ? "1px solid #67e8f9"
                        : "1px solid #31394a",
                      borderRadius: 2,
                      p: 1,
                      bgcolor: shouldHighlight
                        ? "rgba(103,232,249,.12)"
                        : "#151b25",
                    }}
                  >
                    <Typography
                      sx={{
                        fontFamily: "monospace",
                        fontSize: 17,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {answer.split("").map((char, index) => (
                        <Box
                          key={`${answer}-${index}`}
                          component="span"
                          sx={{
                            color:
                              shouldHighlight && index < answerInput.length
                                ? "#facc15"
                                : "#dbe4f0",
                            bgcolor:
                              shouldHighlight && index < answerInput.length
                                ? "rgba(250,204,21,.12)"
                                : "transparent",
                          }}
                        >
                          {char === " " ? "\u00a0" : char}
                        </Box>
                      ))}
                    </Typography>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        </Stack>
      )}

      {bonusAnimation && (
        <Box
          sx={{
            border: "1px solid #c08b32",
            borderRadius: 1,
            p: 1,
            bgcolor: "rgba(192,139,50,.12)",
          }}
        >
          <Typography sx={{ fontWeight: 950, mb: 0.75 }}>
            Bonus Roll-Up
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "repeat(2, minmax(0, 1fr))",
                sm: "repeat(3, minmax(0, 1fr))",
              },
              gap: 0.75,
            }}
          >
            {bonusAnimation.steps.map((step, index) => (
              <Box
                key={step.label}
                sx={{
                  border:
                    index <= bonusAnimation.activeIndex
                      ? "1px solid #facc15"
                      : "1px solid #31394a",
                  borderRadius: 1,
                  p: 0.75,
                  bgcolor:
                    index <= bonusAnimation.activeIndex
                      ? "rgba(250,204,21,.16)"
                      : "rgba(15,23,42,.65)",
                  transform:
                    index === bonusAnimation.activeIndex
                      ? "translateY(-2px)"
                      : "none",
                  transition: "all .18s ease",
                }}
              >
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {step.label}
                </Typography>
                <Typography sx={{ fontWeight: 950 }}>{step.value}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {busy && (
        <Stack direction="row" spacing={1} alignItems="center">
          <CircularProgress size={18} />
          <Typography sx={{ color: "text.secondary" }}>Launching</Typography>
        </Stack>
      )}
    </Stack>
  );
}

function PlayerRoster({ players }: { players: TypingBossPlayer[] }) {
  return (
    <Paper
      elevation={0}
      sx={{ border: "1px solid #31394a", borderRadius: 2, p: 2 }}
    >
      <Typography variant="h6" sx={{ fontWeight: 950, mb: 1.5 }}>
        Party
      </Typography>
      <Stack spacing={1}>
        {players.length === 0 && (
          <Typography sx={{ color: "text.secondary" }}>Waiting for players.</Typography>
        )}
        {players.map((player) => (
          <Box key={player.code}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ClassMark classId={player.classId} size={36} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Typography sx={{ fontWeight: 900, overflowWrap: "anywhere" }}>
                    {player.name}
                  </Typography>
                  <Typography sx={{ color: "text.secondary" }}>
                    {player.hp}/{player.maxHp}
                  </Typography>
                </Stack>
                <StatBar
                  value={player.hp}
                  max={player.maxHp}
                  color={playerHealthColor(player.hp,player.maxHp,player.defeated)}
                />
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {Math.round(player.accuracy * 100)}% · DPS{" "}
                  {player.averageDps.toFixed(1)} · Dmg {player.totalDamage} · Heal{" "}
                  {player.totalHealing}
                </Typography>
              </Box>
            </Stack>
            <Divider sx={{ mt: 1, borderColor: "#262f3d" }} />
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}

function BattleLog({
  session,
  compact = false,
}: {
  session: TypingBossSessionSnapshot;
  compact?: boolean;
}) {
  const colorByTone: Record<string, string> = {
    info: "#aab4c4",
    hit: COMBAT_COLORS.damage,
    miss: "#fda4af",
    heal: COMBAT_COLORS.healing,
    danger: COMBAT_COLORS.damage,
    evade: COMBAT_COLORS.dodge,
    victory: "#67e8f9",
  };

  return (
    <Accordion
      elevation={0}
      disableGutters
      sx={{
        border: "1px solid #31394a",
        borderRadius: 2,
        bgcolor: "background.paper",
        overflow: "hidden",
        "&:before": { display: "none" },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" sx={{ fontWeight: 950 }}>
            Battle Log
          </Typography>
          <Chip size="small" label={session.log.length} />
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        <Stack
          spacing={0.75}
          sx={{ maxHeight: compact ? 240 : 380, overflowY: "auto" }}
        >
          {session.log.length === 0 && (
            <Typography sx={{ color: "text.secondary" }}>
              No actions yet.
            </Typography>
          )}
          {session.log
            .slice()
            .reverse()
            .map((entry) => (
              <Typography
                key={entry.id}
                sx={{
                  color: colorByTone[entry.tone] || "text.secondary",
                  fontWeight: entry.tone === "victory" ? 950 : 700,
                  fontSize: compact ? 14 : 15,
                }}
              >
                {entry.message}
              </Typography>
            ))}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

function HostCodeModal({
  open,
  sessionId,
  onClose,
}: {
  open: boolean;
  sessionId: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    await navigator.clipboard.writeText(shortJoinCode(sessionId));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 950 }}>Game Code</DialogTitle>
      <DialogContent>
        <Stack spacing={2} alignItems="center" sx={{ py: 1 }}>
          <Typography
            sx={{
              fontFamily: "'Courier New', monospace",
              fontSize: { xs: 48, md: 76 },
              fontWeight: 950,
              color: "#67e8f9",
              textShadow: "0 4px 0 #000",
              letterSpacing: 0,
            }}
          >
            {shortJoinCode(sessionId)}
          </Typography>
          <Typography sx={{ color: "text.secondary", overflowWrap: "anywhere" }}>
            Enter these three characters in the join menu.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={copyCode}>{copied ? "Copied" : "Copy Code"}</Button>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function BattleOutcomeModal({
  open,
  session,
  onClose,
  onStats,
  host = false,
}: {
  open: boolean;
  session: TypingBossSessionSnapshot;
  onClose: () => void;
  onStats: () => void;
  host?: boolean;
}) {
  const victory = session.mode === "proportional" && host ? session.status === "defeat" : session.status === "victory";
  return (
    <Dialog open={open} onClose={onClose} maxWidth={session.mode === "proportional" ? "md" : "sm"} fullWidth>
      <DialogTitle
        sx={{
          fontWeight: 950,
          color: victory ? "#67e8f9" : "#fb7185",
          textAlign: "center",
          fontSize: { xs: 30, md: 42 },
          letterSpacing: 0,
        }}
      >
        {victory ? "VICTORY" : "DEFEAT"}
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ textAlign: "center", color: "text.secondary" }}>
          {session.mode === "proportional" && host ? victory ? "Your dragon defeated the party." : "The players defeated your dragon." : victory
            ? `${session.boss.name} has fallen.`
            : "The party was knocked out."}
        </Typography>
        {session.leaderboard && <BattleLeaderboard entries={session.leaderboard} />}
      </DialogContent>
      <DialogActions sx={{ justifyContent: "center", pb: 2 }}>
        <Button onClick={onStats} variant="outlined">
          See Stats
        </Button>
        <Button component={RouterLink} to="/typing-boss/join" variant="contained">
          Join a Game
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <Box
      sx={{
        border: "1px solid #31394a",
        borderRadius: 1,
        p: 1,
        bgcolor: "#0f151f",
      }}
    >
      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 950, fontSize: 20, color: label === "Damage" || label === "Avg DPS" || label === "Boss Hits" ? COMBAT_COLORS.damage : label === "Healing" || label === "Revives" ? COMBAT_COLORS.healing : label === "Buffs" ? COMBAT_COLORS.shield : label === "Evades" || label === "Dodges" ? COMBAT_COLORS.dodge : undefined }}>{value}</Typography>
    </Box>
  );
}

function BattleStatsModal({
  open,
  session,
  me,
  onClose,
}: {
  open: boolean;
  session: TypingBossSessionSnapshot;
  me?: TypingBossPlayer;
  onClose: () => void;
}) {
  if (session.mode === "proportional") {
    return <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ fontWeight: 950 }}>Proportional Battle Stats</DialogTitle>
      <DialogContent>{session.leaderboard ? <BattleLeaderboard entries={session.leaderboard} /> : <DamageBoard session={session} personal={Boolean(me)} />}</DialogContent>
      <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>;
  }
  const rankedPlayers = [...session.players].sort(
    (a, b) => b.totalDamage - a.totalDamage
  );
  const focus = me || rankedPlayers[0] || null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 950 }}>
        {me ? "Personal Stats" : "Battle Stats"}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          {focus && (
            <Paper
              elevation={0}
              sx={{ border: "1px solid #31394a", borderRadius: 2, p: 2 }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                <ClassMark classId={focus.classId} size={42} />
                <Box>
                  <Typography sx={{ fontWeight: 950 }}>{focus.name}</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {focus.classLabel}
                  </Typography>
                </Box>
              </Stack>
              <Grid container spacing={1}>
                <Grid item xs={6} sm={3}>
                  <StatTile label="Damage" value={focus.totalDamage} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatTile label="Healing" value={focus.totalHealing} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatTile label="Accuracy" value={`${Math.round(focus.accuracy * 100)}%`} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatTile label="Avg DPS" value={focus.averageDps.toFixed(1)} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatTile label="Turns" value={focus.turnsTaken} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatTile label="Buffs" value={focus.totalBuffs} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatTile label="Revives" value={focus.totalResurrections} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatTile label="Evades" value={focus.specialEvades} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatTile label="Boss Hits" value={focus.bossHitsTaken} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatTile label="Dodges" value={focus.regularBossMisses} />
                </Grid>
              </Grid>
            </Paper>
          )}

          <Stack spacing={1}>
            <Typography sx={{ fontWeight: 950 }}>Party Ranking</Typography>
            {rankedPlayers.map((player, index) => (
              <Paper
                key={player.code}
                elevation={0}
                sx={{ border: "1px solid #31394a", borderRadius: 1, p: 1 }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ fontWeight: 950, width: 28 }}>
                    #{index + 1}
                  </Typography>
                  <ClassMark classId={player.classId} size={34} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontWeight: 900 }}>{player.name}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      Dmg {player.totalDamage} | Heal {player.totalHealing} | Buff{" "}
                      {player.totalBuffs} | Revive {player.totalResurrections}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button component={RouterLink} to="/typing-boss/join">
          Join a Game
        </Button>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SessionRemainingTime({ expiresAt }: { expiresAt: string }) {
  const now = useNow(1000);
  return <>{formatRemaining(Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000)))}</>;
}

function bossChargePercent(session: TypingBossSessionSnapshot, now: number) {
  if (session.status !== "active") return 0;
  const start = session.boss.lastAttackAt;
  const end = session.boss.nextAttackAt;
  return clamp(((now - start) / Math.max(1, end - start)) * 100, 0, 100);
}

function playerHostPositions(players: TypingBossPlayer[], spawns: Point[]) {
  const positions = new Map<string, Point>();

  players.forEach((player, index) => {
    const base = spawns[index % spawns.length] || { x: 44, y: 84 };
    const rowOffset = Math.floor(index / spawns.length) * 2.5;
    positions.set(player.code, { x: base.x, y: Math.min(95, base.y + rowOffset) });
  });

  return positions;
}

type ProjectileArt = {
  src: string;
  size: number;
  glow: string;
};

function projectileArtFor(
  projectile: TypingBossProjectile,
  playerByCode: Map<string, TypingBossPlayer>
): ProjectileArt | null {
  if (projectile.kind === "boss") {
    const bossId = projectile.bossId || "cindermaw";
    const sizeByBoss: Record<TypingBossId, number> = {
      emberWhelp: 42,
      cindermaw: 54,
      infernalDragon: 68,
    };
    return {
      src: BOSS_FIREBALL_ASSETS[bossId],
      size: sizeByBoss[bossId],
      glow: "#fb923c",
    };
  }

  if (projectile.kind === "resurrect") {
    return {
      src: TYPING_BOSS_ASSETS.necromancerStrongAttack,
      size: 58,
      glow: "#86efac",
    };
  }

  if (projectile.kind === "buff") {
    return {
      src: TYPING_BOSS_ASSETS.paladinStrongAttack,
      size: 54,
      glow: "#facc15",
    };
  }

  if (projectile.kind === "heal") {
    return {
      src: TYPING_BOSS_ASSETS.clericWeakAttack,
      size: 46,
      glow: "#fde68a",
    };
  }

  if (projectile.kind !== "damage") {
    return null;
  }

  const sourceClass = playerByCode.get(projectile.source)?.classId || "barbarian";
  const moveTier = projectile.moveId === "weak" ? "weak" : "strong";
  return {
    src: CLASS_PROJECTILE_ASSETS[sourceClass][moveTier],
    size: moveTier === "weak" ? 48 : 64,
    glow: moveTier === "weak" ? "#fbbf24" : "#f97316",
  };
}

function HostBattlefield({ session }: { session: TypingBossSessionSnapshot }) {
  return <BattleScene session={session} />;
}

function PlayerBattlefield({ session, me }: { session: TypingBossSessionSnapshot; me: TypingBossPlayer }) {
  return <BattleScene session={session} ownCode={me.code} />;
}

export function PlayerTypingBattle({ session, me, code, active }: {
  session: TypingBossSessionSnapshot; me: TypingBossPlayer; code: string; active: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null), sceneRef = useRef<HTMLDivElement>(null), profileRef = useRef<HTMLDivElement>(null), dragonRef = useRef<HTMLDivElement>(null);
  const arena = arenaForBoss(session.boss.id);
  const positions = useMemo(() => new Map(session.players.map((player, index) =>
    [player.code, proportionalPlayerPoint(index, session.players.length)] as [string, Point])), [session.players]);
  const layout = usePortraitProjectileLayout(rootRef, sceneRef, profileRef, positions, arena.hostBossPoint, me.code, dragonRef);
  const events = useMemo(() => collectCombatAnimations(session.projectiles).get(me.code) || NO_ANIMATION_EVENTS, [session.projectiles, me.code]);
  const ownProjectiles = session.projectiles.filter(shot => shot.source === me.code || shot.target === me.code);
  const dragonEvents = useMemo(() => collectCombatAnimations(session.projectiles).get("boss") || NO_ANIMATION_EVENTS, [session.projectiles]);
  return <Box ref={rootRef} data-testid="personal-typing-stage" sx={{ position: "relative" }}>
    <Stack spacing={2}>
      <BattleScene session={session} ownCode={me.code} sceneRef={sceneRef} profileProjectilesFor={me.code} />
      <ContinuousTyping key={`${session.typing!.seed}:${session.typing!.balanced}`} sessionId={session.id} countdownEndsAt={session.countdownEndsAt} serverNow={session.serverNow} healingPool={session.clericHealingPool} credentials={{ code }} state={session.typing!} active={active}
        profile={{ player: me, events, serverNow: session.serverNow, anchorRef: profileRef }}
        dragonProfile={{ boss: session.boss, events: dragonEvents, serverNow: session.serverNow, anchorRef: dragonRef }} />
    </Stack>
    {layout && <Box data-testid="portrait-projectile-layer" sx={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 8 }}>
      <ProjectileLayer projectiles={ownProjectiles} positions={layout.positions} bossPoint={layout.bossPoint} players={session.players} serverNow={session.serverNow} personal />
    </Box>}
  </Box>;
}

// Both audiences share the camera, formation, sprite sizes and combat events.
// Personal shots can move to the portrait overlay without duplicating them here.
export function BattleScene({ session, ownCode, sceneRef, profileProjectilesFor }: {
  session: TypingBossSessionSnapshot; ownCode?: string; sceneRef?: React.Ref<HTMLDivElement>; profileProjectilesFor?: string;
}) {
  const arena = arenaForBoss(session.boss.id);
  const bossPoint = arena.hostBossPoint;
  const clock = useCombatClock(session.serverNow);
  const animations = useMemo(() => collectCombatAnimations(session.projectiles), [session.projectiles]);
  const positions = useMemo(
    () => session.mode === "proportional" ? new Map(session.players.map((player, index) =>
      [player.code, proportionalPlayerPoint(index, session.players.length)] as [string, Point]
    )) : playerHostPositions(session.players, arena.hostSpawns),
    [arena.hostSpawns, session.players, session.mode]
  );
  const density = session.players.length > 20 ? "minimal" : session.players.length > 10 ? "compact" : "normal";

  return (
    <Box sx={{ overflowX: "auto" }} role="region" aria-label={ownCode ? "Player battle scene" : "Host battle scene"} tabIndex={0}>
      <BattleCountdown session={session}/>
      <BattlefieldShell sceneRef={sceneRef} minWidth={session.mode === "proportional" ? 960 : undefined} minHeight={session.mode === "proportional" ? Math.max(540, 440 + Math.ceil(session.players.length / 4) * 48) : 640}>
        <BossNode session={session} point={bossPoint} size="host" events={animations.get("boss") || NO_ANIMATION_EVENTS} clock={clock} />
        {session.players.map((player) => (
          <PlayerNode
            key={player.code}
            player={player}
            point={positions.get(player.code) || { x: 50, y: 80 }}
            compact={session.mode === "proportional" || session.players.length > 6}
            proportional={session.mode === "proportional"}
            density={density}
            sessionId={session.id}
            highlight={player.code === ownCode}
            events={animations.get(player.code) || NO_ANIMATION_EVENTS}
            clock={clock}
          />
        ))}
        <ProjectileLayer projectiles={profileProjectilesFor ? session.projectiles.filter(shot => shot.source !== profileProjectilesFor && shot.target !== profileProjectilesFor) : session.projectiles} positions={positions} bossPoint={bossPoint} players={session.players} serverNow={session.serverNow} />
      </BattlefieldShell>
    </Box>
  );
}

function BattlefieldShell({
  children,
  minHeight,
  minWidth,
  sceneRef,
}: {
  children: React.ReactNode;
  minHeight: number;
  minWidth?: number;
  sceneRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <Box
      ref={sceneRef}
      sx={{
        position: "relative",
        minHeight,
        minWidth,
        height: { xs: minHeight, md: minHeight },
        border: "2px solid #120707",
        borderRadius: 2,
        overflow: "hidden",
        bgcolor: "#10080a",
        boxShadow: "inset 0 0 0 2px #c08b32",
      }}
    >
      <VolcanicBackdrop />
      {children}
      <VolcanicForeground />
    </Box>
  );
}

function BossNode({
  session,
  point,
  size,
  events,
  clock,
}: {
  session: TypingBossSessionSnapshot;
  point: Point;
  size: "host" | "player";
  events: readonly CombatAnimationEvent[];
  clock: React.MutableRefObject<number>;
}) {
  const pose = useDragonCombatAnimation(events, session.boss.hurt, session.status !== "setup" && session.boss.hp <= 0, clock, session.boss.flameBreath);
  const dragonWidth = session.mode === "proportional" ? size === "host" ? { xs: 230, md: 300 } : { xs: 240, md: 320 } : bossBattleWidth(session.boss.id, size);
  const latestAttack = session.projectiles.filter(projectile => projectile.source === "boss").slice(-1)[0];
  return (
    <>
      <Box
        sx={{
          position: "absolute",
          right: "3%",
          top: "4%",
          width: { xs: "55%", md: "44%" },
          textAlign: "center",
          zIndex: 5,
        }}
      >
        <Typography
          sx={{
            fontFamily: "'Courier New', monospace",
            fontWeight: 950,
            fontSize: { xs: 17, md: 26 },
            letterSpacing: 0,
            textShadow: "0 3px 0 #000",
          }}
        >
          {session.boss.name.toUpperCase()}
        </Typography>
        {session.mode === "proportional" && <AttackProgressBar sessionId={session.id} actor="boss" progress={session.boss.attackProgress} label="Dragon attack progress" />}
        <Box
          sx={{
            border: "2px solid #c08b32",
            bgcolor: "#250707",
            p: 0.5,
            boxShadow: "0 0 0 2px #120707, 0 6px 0 rgba(0,0,0,.35)",
          }}
        >
          <StatBar
            value={session.boss.hp}
            max={session.boss.maxHp}
            color={session.boss.color}
            height={20}
          />
        </Box>
        <Typography
          sx={{
            fontFamily: "'Courier New', monospace",
            color: "#f8fafc",
            fontWeight: 950,
            mt: -2.7,
            position: "relative",
            textShadow: "0 2px 0 #000",
          }}
        >
          {session.mode === "proportional" ? Number(session.boss.hp.toFixed(2)) : Math.round(session.boss.hp)} / {session.boss.maxHp} HP
        </Typography>
        {session.mode === "proportional" ? <Typography variant="caption" sx={{ color: "#fde68a", display: "block", mt: 1 }}>
          {latestAttack?.bossAttack && <strong>{latestAttack.moveLabel} · </strong>}Host controlled · every 10 words
        </Typography> : <BossChargeBar session={session} />}
        {!!session.boss.queuedAttacks && <Typography variant="caption" sx={{ display: "block", color: "#fbbf24", mt: .5 }}>
          {session.boss.queuedAttacks} {session.boss.queuedAttacks === 1 ? "attack" : "attacks"} queued · recovering
        </Typography>}
        {!!session.boss.queuedStrongReactions && <Typography variant="caption" sx={{ display: "block", color: "#fca5a5", mt: .5 }}>
          {session.boss.queuedStrongReactions} strong {session.boss.queuedStrongReactions === 1 ? "reaction" : "reactions"} queued
        </Typography>}
      </Box>
      <Box
        sx={{
          position: "absolute",
          left: `${point.x}%`,
          top: `${point.y}%`,
          transform: "translate(-50%, -50%)",
          zIndex: 2,

        }}
      >
        <DragonCombatSprite bossId={session.boss.id} width={dragonWidth} glow={session.boss.color} pose={pose} clock={clock} />
      </Box>
    </>
  );
}

function BossChargeBar({ session }: { session: TypingBossSessionSnapshot }) {
  const now = useNow(120);
  return (
    <Box sx={{ width: { xs: "72%", md: 380 }, mx: "auto", mt: 0.75 }}>
      <LinearProgress
        variant="determinate"
        value={bossChargePercent(session, now)}
        sx={{
          height: 8,
          borderRadius: 999,
          bgcolor: "rgba(250,204,21,.13)",
          "& .MuiLinearProgress-bar": {
            bgcolor: "#facc15",
          },
        }}
      />
    </Box>
  );
}

const PlayerNode = React.memo(function PlayerNode({
  player,
  point,
  compact = false,
  highlight = false,
  events = NO_ANIMATION_EVENTS,
  clock,
  proportional = false,
  sessionId = "",
  density = "normal",
}: {
  player: TypingBossPlayer;
  point: Point;
  compact?: boolean;
  highlight?: boolean;
  events?: readonly CombatAnimationEvent[];
  clock: React.MutableRefObject<number>;
  proportional?: boolean;
  sessionId?: string;
  density?: "normal" | "compact" | "minimal";
}) {
  const formation = proportional && compact;
  const width = formation ? "9%" : compact ? 132 : 170;
  const defense = defensePercentForPlayer(player);
  const attack = attackStrengthForPlayer(player);
  const pose = useCombatAnimation(events, player.defeated, clock);
  return (
    <Box
      sx={{
        position: "absolute",
        left: `${point.x}%`,
        top: `${point.y}%`,
        transform: "translate(-50%, -50%)",
        width,
        zIndex: 3,
      }}
    >
      <Stack direction={formation ? "row" : "column"} spacing={0.5} alignItems="center">
        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          justifyContent="center"
        >
          <Box sx={{ position: "relative", flexShrink: 0 }}>
          {highlight && <Box role="img" aria-label="Your character" className="own-character-arrow">
            <svg width="24" height="30" viewBox="0 0 24 30" aria-hidden="true">
              <path d="M2 2 L22 2 L12 28 Z" fill="#22c55e" stroke="#052e16" strokeWidth="2" strokeLinejoin="round" />
              <path d="M3 3 L12 27 L12 3 Z" fill="#86efac" />
              <path d="M12 3 L21 3 L12 27 Z" fill="#16a34a" />
            </svg>
          </Box>}
          <PlayerCharacterSprite
            classId={player.classId}
            color={highlight ? "#67e8f9" : player.color}
            size={proportional && compact ? 32 : compact ? 62 : 86}
            highlight={highlight}
            pose={pose}
            clock={clock}
          />
          </Box>
          {!proportional && density === "normal" && <Stack spacing={0.35}>
            <Chip
              size="small"
              label={`DEF ${defense}%`}
              sx={{
                height: compact ? 20 : 22,
                bgcolor: "rgba(15,23,42,.86)",
                color: "#86efac",
                border: "1px solid #166534",
                fontSize: compact ? 10 : 11,
                fontWeight: 950,
              }}
            />
            <Chip
              size="small"
              label={`ATK ${attack}`}
              sx={{
                height: compact ? 20 : 22,
                bgcolor: "rgba(15,23,42,.86)",
                color: "#facc15",
                border: "1px solid #92400e",
                fontSize: compact ? 10 : 11,
                fontWeight: 950,
              }}
            />
            {player.nextAttackMultiplier > 1 && (
              <Chip
                size="small"
                label={`BUFF x${player.nextAttackMultiplier.toFixed(1)}`}
                sx={{
                  height: compact ? 20 : 22,
                  bgcolor: "rgba(250,204,21,.12)",
                  color: "#facc15",
                  border: "1px solid #facc15",
                  fontSize: compact ? 10 : 11,
                  fontWeight: 950,
                }}
              />
            )}
            {player.evadeReady && (
              <Chip
                size="small"
                label="EVADE"
                sx={{
                  height: compact ? 20 : 22,
                  bgcolor: "rgba(167,139,250,.12)",
                  color: "#c4b5fd",
                  border: "1px solid #a78bfa",
                  fontSize: compact ? 10 : 11,
                  fontWeight: 950,
                }}
              />
            )}
          </Stack>}
        </Stack>
        {density !== "minimal" && <Box sx={{ width: density === "compact" ? "65%" : "100%", minWidth:0, flexShrink: 0, textAlign: "center" }}>
          {density === "normal" && <Typography
            sx={{
              fontWeight: 950,
              fontSize: compact ? 12 : 14,
              lineHeight: formation ? 1.2 : undefined,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textShadow: "0 2px 3px #000, 0 0 6px #000",
            }}
            title={player.name}
          >
            {player.name}
          </Typography>}
          {proportional && <AttackProgressBar sessionId={sessionId} actor={player.code} progress={player.attackProgress} label={`${player.name} attack progress`} compact={compact} dense={density === "compact"} />}
          <StatBar
            value={player.hp}
            max={player.maxHp}
            color={playerHealthColor(player.hp,player.maxHp,player.defeated)}
            height={density === "compact" ? 3 : compact ? 6 : 8}
          />
          {!compact && density === "normal" && (
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {player.hp}/{player.maxHp}
            </Typography>
          )}

        </Box>}
      </Stack>
    </Box>
  );
});

function ProjectileLayer({ projectiles, positions, bossPoint, players, serverNow, personal = false }: {
  projectiles: TypingBossProjectile[];
  positions: Map<string, Point>;
  bossPoint: Point;
  players: TypingBossPlayer[];
  serverNow?: number;
  personal?: boolean;
}) {
  const playerByCode = useMemo(() => new Map(players.map(player => [player.code, player])), [players]);
  const offset = useRef(0);
  if (serverNow) offset.current = serverNow - Date.now();
  return <>{projectiles.map(projectile => {
    const { from, to, targetOffscreen } = projectileEndpoints(projectile, positions, bossPoint);
    return <ProjectileMotion key={projectile.id} projectile={projectile} from={from} to={to}
      art={projectileArtFor(projectile, playerByCode)} serverOffset={offset.current}
      targetOffscreen={targetOffscreen}
      hitPoint={!personal && serverNow && players.length > 1 && projectile.target === "boss" ? from : undefined}
      labelOffset={personal ? 0 : serverNow && players.length > 1 ? projectile.target === "boss" ? -5 : 4 : 0} />;
  })}</>;
}

export default function TypingBossApp() {
  useEffect(() => {
    pruneSavedCredentials();
    const timer = window.setInterval(pruneSavedCredentials, 60000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <ThemeProvider theme={bossTheme}>
      <CssBaseline />
      <Routes>
        {AnimationPreview && <Route path="animations" element={<React.Suspense fallback={<LoadingPanel label="Loading animations..." />}><AnimationPreview /></React.Suspense>} />}
        <Route index element={<CreateGamePage />} />
        <Route path="host/:sessionId" element={<HostSessionPage />} />
        <Route path="join" element={<JoinPage />} />
        <Route path="play/:sessionId" element={<PlayerSessionPage />} />
        <Route path="*" element={<Navigate to="/typing-boss" replace />} />
      </Routes>
    </ThemeProvider>
  );
}
