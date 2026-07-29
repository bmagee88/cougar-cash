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
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
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
} from "./types";

const SESSION_ID_PATTERN = /^boss[0-9A-F]{3}$/;
const PLAYER_CODE_PATTERN = /^hero[0-9A-F]{4}$/;
const MAX_RECONNECT_ATTEMPTS = 5;

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
    name: "Infernal Dragon",
    difficulty: "hard",
    hp: 1550,
    attackIntervalMs: 12000,
    color: "#dc2626",
    description: "Fast charge bar and punishing fireballs.",
  },
];

type TypingProgressStats = {
  accepted: number;
  mistakes: number;
  startedAt: number;
  updatedAt: number;
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

function hostStorageKey(sessionId: string) {
  return `typingBossHost:${sessionId}`;
}

function playerStorageKey(sessionId: string) {
  return `typingBossPlayer:${sessionId}`;
}

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

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function normalizeAnswerText(value: string) {
  return value;
}

function keyMatches(key: string, expected: string) {
  return key === expected;
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

function defensePercentFromAccuracy(accuracy: number) {
  return Math.round((1 - bossHitChanceFromAccuracy(accuracy)) * 100);
}

function attackStrengthForPlayer(player: TypingBossPlayer) {
  const speed = player.averageDps > 0 ? player.averageDps : 1;
  return Math.max(1, Math.round(speed * (1 + player.correctStreak * 0.05) * 10));
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
  const speedMultiplier =
    player.averageDps > 0 ? clamp(effectiveDps / player.averageDps, 0.65, 1.6) : 1;
  const accuracyMultiplier = accuracyBonusMultiplier(accuracy);
  const nextStreak = player.correctStreak + 1;
  const streakMultiplier = 1 + nextStreak * 0.05;
  const answerLength = answerInput.length || Math.max(...challenge.answers.map((answer) => answer.length));
  const baseCharacters = challenge.question.length + answerLength;
  const totalMultiplier =
    challenge.movePower * speedMultiplier * accuracyMultiplier * streakMultiplier;
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

    async function checkSessionStillExists() {
      try {
        await getTypingBossSession(sessionId, activeCredentials);
      } catch (caught) {
        const status = getErrorStatus(caught);
        if (status === 404 || status === 410) {
          source.close();
          setConnected(false);
          setTerminalReason("not-found");
          setStreamError("This boss game is no longer available.");
        }
      }
    }

    source.addEventListener("session", (event) => {
      if (closed) return;
      const message = event as MessageEvent<string>;
      setSession(JSON.parse(message.data));
      setConnected(true);
      setStreamError("");
      setReconnectAttempts(0);
      setTerminalReason("");
      attempts = 0;
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

function DragonSigil({
  size = 96,
  color = "#ef4444",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Box
      component="svg"
      viewBox="0 0 180 140"
      aria-hidden="true"
      sx={{ width: size, height: size, display: "block" }}
    >
      <defs>
        <radialGradient id="dragonGlow" cx="50%" cy="48%" r="58%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="48%" stopColor={color} />
          <stop offset="100%" stopColor="#581c1c" />
        </radialGradient>
      </defs>
      <path
        d="M82 48 22 14 40 70 12 92 70 86z"
        fill="#7f1d1d"
        stroke="#1f0a0a"
        strokeWidth="5"
      />
      <path
        d="M98 48 158 14 140 70 168 92 110 86z"
        fill="#7f1d1d"
        stroke="#1f0a0a"
        strokeWidth="5"
      />
      <path
        d="M90 12 104 36 130 28 117 54 142 70 112 76 118 110 91 92 64 110 70 76 38 70 64 54 50 28 76 36z"
        fill="url(#dragonGlow)"
        stroke="#fed7aa"
        strokeWidth="4"
      />
      <path
        d="M66 64c8-24 40-24 48 0 8 24-4 48-24 59-20-11-32-35-24-59z"
        fill="#240909"
        stroke={color}
        strokeWidth="5"
      />
      <path
        d="M72 52 58 22l27 18M108 52l14-30-27 18"
        fill="none"
        stroke="#fed7aa"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <rect x="76" y="67" width="9" height="8" fill="#facc15" />
      <rect x="96" y="67" width="9" height="8" fill="#facc15" />
      <path
        d="M78 91c8 8 17 8 25 0"
        fill="none"
        stroke="#f97316"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M55 102 32 124M126 102l22 22"
        stroke="#1f0a0a"
        strokeWidth="8"
        strokeLinecap="round"
      />
    </Box>
  );
}

function VolcanicBackdrop() {
  return (
    <>
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, #160912 0%, #241019 34%, #191010 58%, #0d0d10 100%)",
        }}
      />
      {[
        { left: "7%", top: "9%", scale: 1.1 },
        { left: "84%", top: "7%", scale: 1.25 },
        { left: "18%", top: "28%", scale: 0.7 },
        { left: "72%", top: "30%", scale: 0.75 },
      ].map((volcano, index) => (
        <Box
          key={`volcano-${index}`}
          sx={{
            position: "absolute",
            left: volcano.left,
            top: volcano.top,
            width: 92 * volcano.scale,
            height: 120 * volcano.scale,
            transform: "translate(-50%, -12%)",
            clipPath: "polygon(50% 0, 100% 100%, 0 100%)",
            bgcolor: "#1f1113",
            boxShadow: "inset 0 -12px 0 rgba(0,0,0,.35)",
            "&:after": {
              content: '""',
              position: "absolute",
              left: "45%",
              top: 0,
              width: "13%",
              height: "92%",
              bgcolor: "#f97316",
              boxShadow: "0 0 18px #f97316",
            },
          }}
        />
      ))}
      <Box
        sx={{
          position: "absolute",
          inset: "48% 0 0",
          background:
            "linear-gradient(90deg, transparent 0 8%, #ef4444 8% 9%, transparent 9% 23%, #f97316 23% 24%, transparent 24% 39%, #b91c1c 39% 40%, transparent 40% 63%, #ef4444 63% 64%, transparent 64% 78%, #f97316 78% 79%, transparent 79%), linear-gradient(180deg, #1b1b1f, #0d0d10)",
          backgroundSize: "100% 100%, 100% 100%",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          left: "-5%",
          right: "-5%",
          bottom: "-12%",
          height: "58%",
          background:
            "radial-gradient(circle at 20% 20%, #2d2d33 0 3px, transparent 4px), radial-gradient(circle at 55% 65%, #34343a 0 4px, transparent 5px), linear-gradient(135deg, transparent 0 9%, #ef4444 9% 10%, transparent 10% 33%, #7f1d1d 33% 34%, transparent 34% 60%, #f97316 60% 61%, transparent 61%), #141416",
          backgroundSize: "34px 34px, 42px 42px, 100% 100%, 100% 100%",
          transform: "perspective(600px) rotateX(8deg)",
          transformOrigin: "bottom",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 26%, rgba(239,68,68,.25), transparent 30%), linear-gradient(180deg, transparent 65%, rgba(0,0,0,.55))",
        }}
      />
    </>
  );
}

function ClassMark({
  classId,
  size = 42,
}: {
  classId: TypingBossClassId;
  size?: number;
}) {
  const isCleric = classId === "cleric";
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        bgcolor: isCleric ? "#3d3513" : "#3b1720",
        color: isCleric ? "#facc15" : "#fb7185",
        border: `2px solid ${isCleric ? "#facc15" : "#fb7185"}`,
        boxShadow: `0 0 18px ${isCleric ? "rgba(250,204,21,.24)" : "rgba(251,113,133,.24)"}`,
      }}
    >
      {isCleric ? <ShieldIcon /> : <LocalFireDepartmentIcon />}
    </Box>
  );
}

function PixelHeroSprite({
  classId,
  color,
  size = 62,
}: {
  classId: TypingBossClassId;
  color: string;
  size?: number;
}) {
  const robe = classId === "cleric" ? "#f8fafc" : "#8b451c";
  const trim = classId === "cleric" ? "#facc15" : "#c084fc";
  return (
    <Box
      component="svg"
      viewBox="0 0 64 76"
      aria-hidden="true"
      sx={{
        width: size,
        height: size * 1.18,
        display: "block",
        imageRendering: "pixelated",
        filter: `drop-shadow(0 8px 0 rgba(0,0,0,.35)) drop-shadow(0 0 12px ${color}66)`,
      }}
    >
      <rect x="24" y="8" width="16" height="14" fill="#d6a66a" />
      <rect x="20" y="20" width="24" height="36" fill={robe} />
      <rect x="18" y="30" width="8" height="22" fill={color} />
      <rect x="38" y="30" width="8" height="22" fill={color} />
      <rect x="22" y="54" width="8" height="12" fill="#111827" />
      <rect x="34" y="54" width="8" height="12" fill="#111827" />
      <rect x="20" y="24" width="24" height="6" fill={trim} />
      <rect x="27" y="30" width="10" height="18" fill={trim} opacity="0.75" />
      {classId === "cleric" ? (
        <>
          <rect x="48" y="13" width="4" height="48" fill="#c08b32" />
          <rect x="43" y="14" width="14" height="8" fill="#facc15" />
          <rect x="47" y="8" width="6" height="18" fill="#facc15" />
        </>
      ) : (
        <>
          <rect x="48" y="24" width="4" height="38" fill="#d6a66a" />
          <rect x="44" y="16" width="14" height="14" fill="#9ca3af" />
          <rect x="50" y="10" width="8" height="10" fill="#e5e7eb" />
        </>
      )}
      <rect x="14" y="34" width="7" height="14" fill="#d6a66a" />
      <rect x="43" y="34" width="7" height="14" fill="#d6a66a" />
      <rect x="17" y="66" width="14" height="5" fill="#05070a" />
      <rect x="33" y="66" width="14" height="5" fill="#05070a" />
    </Box>
  );
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
  return classId === "cleric" ? <ShieldIcon /> : <LocalFireDepartmentIcon />;
}

function CreateGamePage() {
  const navigate = useNavigate();
  const [gameName, setGameName] = useState("Typing Boss Battle");
  const [selectedBossId, setSelectedBossId] =
    useState<TypingBossId>("cindermaw");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedBoss =
    BOSS_CHOICES.find((boss) => boss.id === selectedBossId) || BOSS_CHOICES[1];

  async function handleCreate() {
    const name = gameName.trim();
    if (!name) return;

    setBusy(true);
    setError("");
    try {
      const response = await createTypingBossSession(name, selectedBossId);
      localStorage.setItem(
        hostStorageKey(response.sessionId),
        response.hostToken
      );
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
              Host a shared boss fight where typing speed, quiz answers, class
              choices, accuracy, and streaks all matter.
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
                            {boss.difficulty.toUpperCase()}
                          </Typography>
                        </Stack>
                        <Typography
                          variant="caption"
                          sx={{
                            textAlign: "left",
                            opacity: selected ? 0.9 : 0.72,
                          }}
                        >
                          Charge {Math.round(boss.attackIntervalMs / 1000)}s |
                          HP {boss.hp}
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
              left: "50%",
              top: "40%",
              transform: "translate(-50%, -50%)",
              filter: `drop-shadow(0 20px 45px ${selectedBoss.color}99)`,
            }}
          >
            <DragonSigil size={190} color={selectedBoss.color} />
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
                fontSize: { xs: 22, md: 30 },
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
              {selectedBoss.description}
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
    ? localStorage.getItem(hostStorageKey(normalizedSessionId)) || ""
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
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

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
      setSession(response.session);
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
      <ReconnectOverlay show={reconnecting} />
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="h4" sx={{ fontWeight: 950, letterSpacing: 0 }}>
                {session.name}
              </Typography>
              <StatusChip status={session.status} />
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
              {normalizedSessionId} · {session.players.length} players ·{" "}
              {formatRemaining(session.remainingSeconds)}
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
            <Button
              variant="contained"
              startIcon={<PlayArrowIcon />}
              disabled={busy || session.status !== "setup"}
              onClick={() =>
                runHostAction(() =>
                  startTypingBossSession(normalizedSessionId, hostToken)
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

        <Grid container spacing={2}>
          <Grid item xs={12} lg={8}>
            <HostBattlefield session={session} />
          </Grid>
          <Grid item xs={12} lg={4}>
            <Stack spacing={2}>
              <PlayerRoster players={session.players} />
              <BattleLog session={session} />
            </Stack>
          </Grid>
        </Grid>
      </Stack>
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
  const [name, setName] = useState("");
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
      localStorage.setItem(playerStorageKey(normalizedSessionId), response.code);
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
            Join Battle
          </Typography>
          <Typography sx={{ color: "text.secondary", mt: 1 }}>
            Choose your class, enter your name, and connect to the host session.
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
                  InputProps={{
                    startAdornment: (
                      <Typography sx={{ mr: 0.5, color: "text.secondary" }}>
                        boss
                      </Typography>
                    ),
                  }}
                />
                <TextField
                  fullWidth
                  label="Player name"
                  value={name}
                  inputProps={{ maxLength: 24 }}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleJoin();
                    }
                  }}
                />
                <TextField
                  select
                  fullWidth
                  label="Class"
                  value={classId}
                  onChange={(event) =>
                    setClassId(event.target.value as TypingBossClassId)
                  }
                >
                  <MenuItem value="cleric">Cleric</MenuItem>
                  <MenuItem value="barbarian">Barbarian</MenuItem>
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
              {(["cleric", "barbarian"] as TypingBossClassId[]).map((item) => (
                <Grid item xs={12} sm={6} key={item}>
                  <Paper
                    elevation={0}
                    onClick={() => setClassId(item)}
                    sx={{
                      border:
                        classId === item
                          ? "2px solid #67e8f9"
                          : "1px solid #31394a",
                      borderRadius: 2,
                      p: 2,
                      cursor: "pointer",
                      minHeight: 210,
                      bgcolor:
                        item === "cleric"
                          ? "rgba(250,204,21,.08)"
                          : "rgba(251,113,133,.08)",
                    }}
                  >
                    <Stack spacing={1.5}>
                      <ClassMark classId={item} size={54} />
                      <Typography variant="h5" sx={{ fontWeight: 950 }}>
                        {item === "cleric" ? "Cleric" : "Barbarian"}
                      </Typography>
                      <Typography sx={{ color: "text.secondary" }}>
                        {item === "cleric"
                          ? "Radiant Mend turns medium questions into ally healing."
                          : "Rage Breaker asks a longer hard question for bigger damage."}
                      </Typography>
                    </Stack>
                  </Paper>
                </Grid>
              ))}
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
          localStorage.getItem(playerStorageKey(normalizedSessionId)) || ""
        )
      : ""
  );
  const [verified, setVerified] = useState(false);
  const [verifyError, setVerifyError] = useState("");
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
      .then(() => {
        if (!cancelled) setVerified(true);
      })
      .catch((caught) => {
        if (cancelled) return;
        localStorage.removeItem(playerStorageKey(normalizedSessionId));
        setSavedCode("");
        setVerifyError(messageFromError(caught));
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedSessionId, savedCode]);

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
      <ReconnectOverlay show={reconnecting} />
      <PlayerBattlePanel
        session={session}
        me={me}
        sessionId={normalizedSessionId}
        code={savedCode}
      />
    </PageFrame>
  );
}

function PlayerBattlePanel({
  session,
  me,
  sessionId,
  code,
}: {
  session: TypingBossSessionSnapshot;
  me: TypingBossPlayer;
  sessionId: string;
  code: string;
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
    setTypingStats({
      accepted: typingRef.current.accepted,
      mistakes: typingRef.current.mistakes,
      startedAt: typingRef.current.startedAt || Date.now(),
      updatedAt: Date.now(),
    });
  }, []);

  const moves = useMemo(
    () => [
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
        label: me.classId === "cleric" ? "Radiant Mend" : "Rage Breaker",
        detail: me.classId === "cleric" ? "Ally heal" : "Hard+",
      },
      {
        id: "potion" as TypingBossMoveId,
        label: "Potion",
        detail: "Self heal",
      },
    ],
    [me.classId]
  );

  const targetCandidates = useMemo(() => {
    const alive = session.players.filter((player) => !player.defeated);
    const allies = alive.filter((player) => player.code !== me.code);
    return allies.length > 0 ? allies : alive;
  }, [me.code, session.players]);

  const canAct = session.status === "active" && !me.defeated && !busy;

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
          startedAt: Date.now(),
          submitting: false,
        };
        setTypingStats({
          accepted: 0,
          mistakes: 0,
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

    if (move.id === "special" && meRef.current.classId === "cleric") {
      setTargetIndex(0);
      setMode("target");
      return;
    }

    startChallenge(move.id);
  }, [canAct, menuIndex, moves, startChallenge]);

  const recordMistake = useCallback(() => {
    typingRef.current.mistakes += 1;
    publishTypingStats();
  }, [publishTypingStats]);

  const completeAnswer = useCallback(
    async (answerText: string, acceptedCharacters: number) => {
      const activeChallenge = challengeRef.current;
      if (!activeChallenge || typingRef.current.submitting) return;

      typingRef.current.submitting = true;
      setBusy(true);
      setError("");
      setStatusText("Adding attack bonuses.");
      const finalTypingStats = {
        accepted: acceptedCharacters,
        mistakes: typingRef.current.mistakes,
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
      const steps = [
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
          label: activeChallenge.kind === "damage" ? "Attack" : "Heal",
          value: `${preview.estimatedAmount}`,
        },
      ];
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
        recordMistake();
        return;
      }

      if (event.key.length !== 1) return;
      event.preventDefault();

      const typedQuestionValue = typingRef.current.question;
      if (typedQuestionValue.length < activeChallenge.question.length) {
        const expected = activeChallenge.question[typedQuestionValue.length];
        if (keyMatches(event.key, expected)) {
          const next = typedQuestionValue + expected;
          typingRef.current.question = next;
          typingRef.current.accepted += 1;
          setTypedQuestion(next);
          publishTypingStats();
        } else {
          recordMistake();
        }
        return;
      }

      const proposed = typingRef.current.answer + event.key;
      const matches = activeChallenge.answers.filter((answer) =>
        normalizeAnswerText(answer).startsWith(proposed)
      );

      if (matches.length === 0) {
        recordMistake();
        return;
      }

      typingRef.current.answer = proposed;
      typingRef.current.accepted += 1;
      setAnswerInput(proposed);
      publishTypingStats();

      const exact = matches.filter((answer) => normalizeAnswerText(answer) === proposed);
      if (matches.length === 1 && exact.length === 1) {
        completeAnswer(exact[0], typingRef.current.accepted);
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
            <StatBar value={me.hp} max={me.maxHp} color="#22c55e" />
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
  moves: { id: TypingBossMoveId; label: string; detail: string }[];
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
              disabled={disabled}
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
      <Button variant="contained" disabled={disabled} onClick={onConfirm}>
        Select
      </Button>
    </Stack>
  );
}

function TargetSelector({
  targets,
  selectedIndex,
  onSelect,
  onConfirm,
}: {
  targets: TypingBossPlayer[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onConfirm: () => void;
}) {
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6" sx={{ fontWeight: 950 }}>
          Heal Target
        </Typography>
        <Chip size="small" label="Enter" variant="outlined" sx={{ fontWeight: 900 }} />
      </Stack>
      <Stack spacing={1}>
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
              <StatBar value={target.hp} max={target.maxHp} color="#22c55e" />
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
  const questionDone = typedQuestion.length >= challenge.question.length;
  const uniqueAnswer =
    answerInput && activeAnswerMatches.length === 1
      ? activeAnswerMatches[0]
      : "";
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
            label: challenge.kind === "damage" ? "Attack" : "Healing",
            value: `${preview.estimatedAmount}`,
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
            const active = index === typedQuestion.length;
            return (
              <Box
                key={`${char}-${index}`}
                component="span"
                sx={{
                  color: typed ? "#facc15" : active ? "#f8fafc" : "#94a3b8",
                  bgcolor: active ? "rgba(103,232,249,.18)" : "transparent",
                  borderRadius: active ? 1 : 0,
                  px: active ? 0.25 : 0,
                }}
              >
                {char === " " ? "\u00a0" : char}
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
            {answerInput || "\u00a0"}
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
                  color={player.defeated ? "#64748b" : "#22c55e"}
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
    hit: "#67e8f9",
    miss: "#fda4af",
    heal: "#86efac",
    danger: "#fb7185",
    evade: "#facc15",
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

function bossChargePercent(session: TypingBossSessionSnapshot, now: number) {
  if (session.status !== "active") return 0;
  const start = session.boss.lastAttackAt;
  const end = session.boss.nextAttackAt;
  return clamp(((now - start) / Math.max(1, end - start)) * 100, 0, 100);
}

function playerHostPositions(players: TypingBossPlayer[]) {
  const positions = new Map<string, Point>();
  const perRow = players.length > 10 ? 5 : players.length > 6 ? 4 : 6;

  players.forEach((player, index) => {
    const row = Math.floor(index / perRow);
    const rowStart = row * perRow;
    const rowItems = players.slice(rowStart, rowStart + perRow);
    const rowIndex = index - rowStart;
    const rowCount = Math.max(1, rowItems.length);
    const x = rowCount === 1 ? 50 : 16 + (68 * rowIndex) / (rowCount - 1);
    const y = 60 + row * 14;
    positions.set(player.code, { x, y });
  });

  return positions;
}

function playerPersonalPositions(
  players: TypingBossPlayer[],
  me: TypingBossPlayer
) {
  const positions = new Map<string, Point>();
  const allies = players.filter((player) => player.code !== me.code);
  positions.set(me.code, { x: 50, y: 78 });
  allies.forEach((player, index) => {
    const side = index % 2 === 0 ? 18 : 82;
    const row = Math.floor(index / 2);
    positions.set(player.code, { x: side, y: 66 - row * 12 });
  });
  return positions;
}

function projectilePosition(
  projectile: TypingBossProjectile,
  now: number,
  positions: Map<string, Point>,
  bossPoint: Point
) {
  const from =
    projectile.source === "boss" ? bossPoint : positions.get(projectile.source) || bossPoint;
  const to =
    projectile.target === "boss" ? bossPoint : positions.get(projectile.target) || bossPoint;
  const progress = easeOutCubic(
    clamp(
      (now - projectile.startedAt) /
        Math.max(1, projectile.impactAt - projectile.startedAt),
      0,
      1
    )
  );

  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
}

function HostBattlefield({ session }: { session: TypingBossSessionSnapshot }) {
  const now = useNow(120);
  const bossPoint = { x: 50, y: 28 };
  const positions = useMemo(
    () => playerHostPositions(session.players),
    [session.players]
  );

  return (
    <BattlefieldShell minHeight={640}>
      <BossNode session={session} point={bossPoint} now={now} size="host" />
      {session.players.map((player) => (
        <PlayerNode
          key={player.code}
          player={player}
          point={positions.get(player.code) || { x: 50, y: 80 }}
          compact={session.players.length > 6}
        />
      ))}
      <ProjectileLayer
        projectiles={session.projectiles}
        now={now}
        positions={positions}
        bossPoint={bossPoint}
      />
    </BattlefieldShell>
  );
}

function PlayerBattlefield({
  session,
  me,
}: {
  session: TypingBossSessionSnapshot;
  me: TypingBossPlayer;
}) {
  const now = useNow(120);
  const bossPoint = { x: 50, y: 28 };
  const positions = useMemo(
    () => playerPersonalPositions(session.players, me),
    [me, session.players]
  );

  return (
    <BattlefieldShell minHeight={600}>
      <BossNode session={session} point={bossPoint} now={now} size="player" />
      {session.players.map((player) => (
        <PlayerNode
          key={player.code}
          player={player}
          point={positions.get(player.code) || { x: 50, y: 80 }}
          compact={player.code !== me.code}
          highlight={player.code === me.code}
        />
      ))}
      <ProjectileLayer
        projectiles={session.projectiles}
        now={now}
        positions={positions}
        bossPoint={bossPoint}
      />
    </BattlefieldShell>
  );
}

function BattlefieldShell({
  children,
  minHeight,
}: {
  children: React.ReactNode;
  minHeight: number;
}) {
  return (
    <Box
      sx={{
        position: "relative",
        minHeight,
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
    </Box>
  );
}

function BossNode({
  session,
  point,
  now,
  size,
}: {
  session: TypingBossSessionSnapshot;
  point: Point;
  now: number;
  size: "host" | "player";
}) {
  const dragonSize = size === "host" ? 230 : 260;
  return (
    <Box
      sx={{
        position: "absolute",
        left: `${point.x}%`,
        top: "3%",
        transform: "translateX(-50%)",
        width: { xs: "88%", md: size === "host" ? 760 : 720 },
        textAlign: "center",
        zIndex: 2,
      }}
    >
      <Typography
        sx={{
          fontFamily: "'Courier New', monospace",
          fontWeight: 950,
          fontSize: { xs: 22, md: 30 },
          letterSpacing: 0,
          textShadow: "0 3px 0 #000",
        }}
      >
        {session.boss.name.toUpperCase()}
      </Typography>
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
        {Math.round(session.boss.hp)} / {session.boss.maxHp} HP
      </Typography>
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          mt: 0.5,
          filter: `drop-shadow(0 18px 34px ${session.boss.glow})`,
        }}
      >
        <DragonSigil size={dragonSize} color={session.boss.color} />
      </Box>
      <Box sx={{ width: { xs: "72%", md: 380 }, mx: "auto", mt: -1 }}>
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
    </Box>
  );
}

function PlayerNode({
  player,
  point,
  compact = false,
  highlight = false,
}: {
  player: TypingBossPlayer;
  point: Point;
  compact?: boolean;
  highlight?: boolean;
}) {
  const width = compact ? 132 : 170;
  const defense = defensePercentFromAccuracy(player.accuracy);
  const attack = attackStrengthForPlayer(player);
  return (
    <Box
      sx={{
        position: "absolute",
        left: `${point.x}%`,
        top: `${point.y}%`,
        transform: "translate(-50%, -50%)",
        width,
        zIndex: 3,
        opacity: player.defeated ? 0.58 : 1,
      }}
    >
      <Stack spacing={0.5} alignItems="center">
        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          justifyContent="center"
        >
          <PixelHeroSprite
            classId={player.classId}
            color={highlight ? "#67e8f9" : player.color}
            size={compact ? 42 : 58}
          />
          <Stack spacing={0.35}>
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
          </Stack>
        </Stack>
        <Box sx={{ width: "100%", textAlign: "center" }}>
          <Typography
            sx={{
              fontWeight: 950,
              fontSize: compact ? 12 : 14,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {player.name}
          </Typography>
          <StatBar
            value={player.hp}
            max={player.maxHp}
            color={player.defeated ? "#64748b" : "#22c55e"}
            height={compact ? 6 : 8}
          />
          {!compact && (
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {player.hp}/{player.maxHp}
            </Typography>
          )}
        </Box>
      </Stack>
    </Box>
  );
}

function ProjectileLayer({
  projectiles,
  now,
  positions,
  bossPoint,
}: {
  projectiles: TypingBossProjectile[];
  now: number;
  positions: Map<string, Point>;
  bossPoint: Point;
}) {
  return (
    <>
      {projectiles.map((projectile) => {
        const point = projectilePosition(projectile, now, positions, bossPoint);
        const isPending = projectile.result === "pending";
        const color =
          projectile.kind === "heal"
            ? "#86efac"
            : projectile.kind === "boss"
            ? "#fb7185"
            : "#67e8f9";

        return (
          <Box
            key={projectile.id}
            sx={{
              position: "absolute",
              left: `${point.x}%`,
              top: `${point.y}%`,
              transform: "translate(-50%, -50%)",
              zIndex: 8,
              pointerEvents: "none",
            }}
          >
            <Box
              sx={{
                width: projectile.kind === "boss" ? 24 : 18,
                height: projectile.kind === "boss" ? 24 : 18,
                borderRadius: "50%",
                bgcolor: color,
                boxShadow: `0 0 22px ${color}`,
                border: "2px solid rgba(255,255,255,.65)",
              }}
            />
            {!isPending && (
              <Chip
                size="small"
                label={
                  projectile.result === "miss"
                    ? "MISS"
                    : projectile.kind === "heal"
                    ? `+${projectile.amount}`
                    : `-${projectile.amount}`
                }
                sx={{
                  mt: 0.5,
                  bgcolor: projectile.result === "miss" ? "#34212a" : "#10131a",
                  color: projectile.result === "miss" ? "#fda4af" : color,
                  border: `1px solid ${projectile.result === "miss" ? "#fda4af" : color}`,
                  fontWeight: 950,
                }}
              />
            )}
          </Box>
        );
      })}
    </>
  );
}

export default function TypingBossApp() {
  return (
    <ThemeProvider theme={bossTheme}>
      <CssBaseline />
      <Routes>
        <Route index element={<CreateGamePage />} />
        <Route path="host/:sessionId" element={<HostSessionPage />} />
        <Route path="join" element={<JoinPage />} />
        <Route path="play/:sessionId" element={<PlayerSessionPage />} />
        <Route path="*" element={<Navigate to="/typing-boss" replace />} />
      </Routes>
    </ThemeProvider>
  );
}
