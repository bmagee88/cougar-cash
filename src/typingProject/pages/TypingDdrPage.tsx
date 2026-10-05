import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppBar,
  Box,
  Button,
  Chip,
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
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import { keyframes } from "@emotion/react";

type HomeKey = {
  key: string;
  color: string;
};

type Note = {
  id: number;
  laneIndex: number;
  targetTime: number;
  createdAt: number;
  animationDelayMs: number;
};

type RhythmMode = "whole" | "half" | "quarter" | "backbeat" | "syncopated" | "burst";

const HOME_KEYS: HomeKey[] = [
  { key: "a", color: "#ff6b6b" },
  { key: "s", color: "#f59f00" },
  { key: "d", color: "#ffd43b" },
  { key: "f", color: "#69db7c" },
  { key: "j", color: "#38d9a9" },
  { key: "k", color: "#4dabf7" },
  { key: "l", color: "#9775fa" },
  { key: ";", color: "#f06595" },
];

const DEFAULT_ACTIVE_KEYS = ["d", "f", "j", "k"];
const STARTING_SCORE = 20;
const FALL_DURATION_MS = 2600;
const HIT_WINDOW_MS = 520;
const HIT_LINE_PERCENT = 74;

const RHYTHM_PATTERNS: Record<RhythmMode, { label: string; offsets: number[] }> = {
  whole: { label: "Whole", offsets: [0] },
  half: { label: "Half", offsets: [0, 2] },
  quarter: { label: "Quarter", offsets: [0, 1, 2, 3] },
  backbeat: { label: "Backbeat", offsets: [1, 3] },
  syncopated: { label: "Syncopated", offsets: [0, 0.75, 1.5, 2.5, 3.25] },
  burst: { label: "Burst", offsets: [0, 0.5, 1.5, 2, 2.5, 3.5] },
};

const stagePulse = keyframes`
  0% { opacity: 0.44; transform: scale(0.98); }
  100% { opacity: 0; transform: scale(1.05); }
`;

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

const noteFall = keyframes`
  0% {
    top: -8%;
    opacity: 0;
    transform: translate3d(-50%, -50%, 0) scale(0.96);
  }
  8% {
    opacity: 1;
  }
  82% {
    box-shadow: var(--note-shadow);
  }
  92% {
    box-shadow: var(--note-hit-shadow);
  }
  100% {
    top: ${HIT_LINE_PERCENT}%;
    opacity: 1;
    transform: translate3d(-50%, -50%, 0) scale(1);
    box-shadow: var(--note-hit-shadow);
  }
`;

const noteColumns = {
  xs: "repeat(4, minmax(28px, 1fr)) 16px repeat(4, minmax(28px, 1fr))",
  sm: "repeat(4, minmax(48px, 1fr)) 28px repeat(4, minmax(48px, 1fr))",
  md: "repeat(4, minmax(64px, 1fr)) 46px repeat(4, minmax(64px, 1fr))",
};

function getLaneGridColumn(laneIndex: number) {
  return laneIndex < 4 ? laneIndex + 1 : laneIndex + 2;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
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
  const [tempo, setTempo] = useState(84);
  const [rhythmMode, setRhythmMode] = useState<RhythmMode>("quarter");
  const [activeKeys, setActiveKeys] = useState<string[]>(DEFAULT_ACTIVE_KEYS);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(STARTING_SCORE);
  const [hits, setHits] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [combo, setCombo] = useState(0);
  const [notes, setNotes] = useState<Note[]>([]);
  const [stagePulseEvent, setStagePulseEvent] = useState<{ token: number; color: string } | null>(null);
  const [pulseLane, setPulseLane] = useState<{ laneIndex: number; token: number } | null>(null);
  const [mistakeToken, setMistakeToken] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [showKeyLetters, setShowKeyLetters] = useState(false);

  const runningRef = useRef(running);
  const gameOverRef = useRef(gameOver);
  const notesRef = useRef(notes);
  const nextBarStartRef = useRef(0);
  const nextNoteIdRef = useRef(1);
  const lastLaneRef = useRef<number | null>(null);
  const beatCountRef = useRef(0);
  const stagePulseTimeoutsRef = useRef<Record<number, number>>({});

  const beatMs = useMemo(() => 60000 / tempo, [tempo]);
  const activeLaneIndexes = useMemo(
    () =>
      HOME_KEYS.map((homeKey, index) => (activeKeys.includes(homeKey.key) ? index : -1)).filter(
        (index) => index !== -1
      ),
    [activeKeys]
  );
  const activeKeySet = useMemo(() => new Set(activeKeys), [activeKeys]);
  const notesByLane = useMemo(
    () => HOME_KEYS.map((_, laneIndex) => notes.filter((note) => note.laneIndex === laneIndex)),
    [notes]
  );
  const { prime, playBeat } = useBeatSound(soundOn);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    gameOverRef.current = gameOver;
  }, [gameOver]);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const clearNotesAndReseed = useCallback(() => {
    const startAt = performance.now() + FALL_DURATION_MS + beatMs;
    nextBarStartRef.current = startAt;
    lastLaneRef.current = null;
    setNotes([]);
  }, [beatMs]);

  const resetGame = useCallback(() => {
    clearNotesAndReseed();
    setScore(STARTING_SCORE);
    setHits(0);
    setMistakes(0);
    setCombo(0);
    setGameOver(false);
    setRunning(false);
    setPulseLane(null);
    setStagePulseEvent(null);
  }, [clearNotesAndReseed]);

  const startGame = useCallback(() => {
    prime();
    if (gameOverRef.current) {
      resetGame();
    }
    if (!runningRef.current) {
      const nowMs = performance.now();
      if (nextBarStartRef.current < nowMs + beatMs) {
        nextBarStartRef.current = nowMs + FALL_DURATION_MS + beatMs;
      }
    }
    setGameOver(false);
    setRunning(true);
  }, [beatMs, prime, resetGame]);

  const registerMistake = useCallback(() => {
    setMistakes((previous) => previous + 1);
    setCombo(0);
    setMistakeToken((previous) => previous + 1);
    setScore((previous) => {
      const nextScore = Math.max(0, previous - 1);
      if (nextScore === 0) {
        setRunning(false);
        setGameOver(true);
      }
      return nextScore;
    });
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || isEditableTarget(event.target)) {
        return;
      }

      if (event.key === "Enter" && !runningRef.current) {
        event.preventDefault();
        startGame();
        return;
      }

      if (!runningRef.current || gameOverRef.current || event.key.length !== 1) return;

      const pressedKey = event.key.toLowerCase();
      const homeKeyIndex = HOME_KEYS.findIndex((homeKey) => homeKey.key === pressedKey);

      if (homeKeyIndex === -1 || !activeKeySet.has(pressedKey)) {
        registerMistake();
        return;
      }

      const pressTime = performance.now();
      const candidate = notesRef.current
        .filter((note) => note.laneIndex === homeKeyIndex)
        .map((note) => ({ note, distance: Math.abs(note.targetTime - pressTime) }))
        .filter(({ distance }) => distance <= HIT_WINDOW_MS)
        .sort((a, b) => a.distance - b.distance)[0];

      if (!candidate) {
        registerMistake();
        return;
      }

      setNotes((previous) => previous.filter((note) => note.id !== candidate.note.id));
      setHits((previous) => previous + 1);
      setCombo((previous) => previous + 1);
      setPulseLane({ laneIndex: homeKeyIndex, token: candidate.note.id });
    },
    [activeKeySet, registerMistake, startGame]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (!running || gameOver) return;

    beatCountRef.current = 0;
    const beatIntervalId = window.setInterval(() => {
      const accent = beatCountRef.current % 4 === 0;
      playBeat(accent);
      beatCountRef.current += 1;
    }, beatMs);

    return () => window.clearInterval(beatIntervalId);
  }, [beatMs, gameOver, playBeat, running]);

  useEffect(() => {
    if (!running || gameOver) return;

    const scheduleIntervalId = window.setInterval(() => {
      const nowMs = performance.now();
      const horizon = nowMs + FALL_DURATION_MS + beatMs * 9;
      const pattern = RHYTHM_PATTERNS[rhythmMode];
      const newNotes: Note[] = [];

      if (!nextBarStartRef.current) {
        nextBarStartRef.current = nowMs + FALL_DURATION_MS + beatMs;
      }

      while (nextBarStartRef.current < horizon) {
        pattern.offsets.forEach((offset) => {
          const laneIndex = getRandomLane(activeLaneIndexes, lastLaneRef.current);
          lastLaneRef.current = laneIndex;
          const targetTime = nextBarStartRef.current + offset * beatMs;
          newNotes.push({
            id: nextNoteIdRef.current,
            laneIndex,
            targetTime,
            createdAt: targetTime - FALL_DURATION_MS,
            animationDelayMs: targetTime - FALL_DURATION_MS - nowMs,
          });
          nextNoteIdRef.current += 1;
        });
        nextBarStartRef.current += beatMs * 4;
      }

      setNotes((previous) => {
        const liveNotes = previous.filter((note) => nowMs - note.targetTime < HIT_WINDOW_MS + 900);

        if (newNotes.length === 0 && liveNotes.length === previous.length) {
          return previous;
        }

        return [...liveNotes, ...newNotes];
      });
    }, 140);

    return () => window.clearInterval(scheduleIntervalId);
  }, [activeLaneIndexes, beatMs, gameOver, rhythmMode, running]);

  useEffect(() => {
    const activeNoteIds = new Set(notes.map((note) => note.id));

    Object.entries(stagePulseTimeoutsRef.current).forEach(([noteId, timeoutId]) => {
      const noteIsGone = !activeNoteIds.has(Number(noteId));
      if (!running || gameOver || noteIsGone) {
        window.clearTimeout(timeoutId);
        delete stagePulseTimeoutsRef.current[Number(noteId)];
      }
    });

    if (!running || gameOver) return;

    const nowMs = performance.now();
    notes.forEach((note) => {
      if (stagePulseTimeoutsRef.current[note.id] !== undefined) return;

      stagePulseTimeoutsRef.current[note.id] = window.setTimeout(() => {
        setStagePulseEvent({ token: note.id, color: HOME_KEYS[note.laneIndex].color });
        delete stagePulseTimeoutsRef.current[note.id];
      }, Math.max(0, note.targetTime - nowMs));
    });
  }, [gameOver, notes, running]);

  useEffect(() => {
    return () => {
      Object.values(stagePulseTimeoutsRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, []);

  useEffect(() => {
    if (running) {
      clearNotesAndReseed();
    }
  }, [activeKeys, clearNotesAndReseed, rhythmMode, tempo, running]);

  const handleActiveKeysChange = (_: React.MouseEvent<HTMLElement>, nextKeys: string[]) => {
    if (nextKeys.length === 0) return;
    const orderedKeys = HOME_KEYS.map((homeKey) => homeKey.key).filter((key) => nextKeys.includes(key));
    setActiveKeys(orderedKeys);
  };

  const healthPercent = (score / STARTING_SCORE) * 100;
  const stagePulseColor = stagePulseEvent?.color ?? "#38d9a9";

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

      <Box
        aria-hidden
        key={stagePulseEvent?.token ?? "idle"}
        sx={{
          position: "absolute",
          inset: -40,
          pointerEvents: "none",
          opacity: 0,
          background: `radial-gradient(circle at 50% 55%, ${stagePulseColor}66, transparent 35%), radial-gradient(circle at 24% 20%, ${stagePulseColor}2e, transparent 26%), radial-gradient(circle at 80% 12%, ${stagePulseColor}24, transparent 22%)`,
          animation:
            running && stagePulseEvent ? `${stagePulse} ${Math.min(380, beatMs * 0.52)}ms ease-out forwards` : "none",
        }}
      />

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
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: { xs: "100%", md: "auto" } }}>
            <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: 0 }}>
              Home Row DDR
            </Typography>
            <Chip
              size="small"
              icon={<FavoriteIcon sx={{ color: "inherit !important" }} />}
              label={score}
              sx={{
                bgcolor: healthPercent <= 25 ? "#7f1d1d" : "#163b34",
                color: healthPercent <= 25 ? "#fecaca" : "#b8f8dc",
                fontWeight: 900,
                borderRadius: 1,
              }}
            />
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title={running ? "Pause" : "Start"}>
              <IconButton
                color="inherit"
                onClick={() => {
                  if (running) {
                    setRunning(false);
                  } else {
                    startGame();
                  }
                }}
                aria-label={running ? "Pause" : "Start"}
              >
                {running ? <PauseIcon /> : <PlayArrowIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Restart">
              <IconButton color="inherit" onClick={resetGame} aria-label="Restart">
                <RestartAltIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={soundOn ? "Mute beat" : "Unmute beat"}>
              <IconButton color="inherit" onClick={() => setSoundOn((previous) => !previous)} aria-label="Toggle beat sound">
                {soundOn ? <VolumeUpIcon /> : <VolumeOffIcon />}
              </IconButton>
            </Tooltip>
          </Stack>

          <Box sx={{ minWidth: { xs: "100%", sm: 230 }, width: { xs: "100%", sm: 250 } }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 800, whiteSpace: "nowrap" }}>{tempo} BPM</Typography>
              <Slider
                size="small"
                min={48}
                max={148}
                step={2}
                value={tempo}
                onChange={(_, value) => setTempo(value as number)}
                sx={{ color: "#38d9a9" }}
                aria-label="Tempo"
              />
            </Stack>
          </Box>

          <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 160 } }}>
            <InputLabel sx={{ color: "#cbd5e1" }}>Rhythm</InputLabel>
            <Select
              value={rhythmMode}
              label="Rhythm"
              onChange={(event) => setRhythmMode(event.target.value as RhythmMode)}
              sx={{
                color: "#f8fafc",
                ".MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.24)" },
                ".MuiSvgIcon-root": { color: "#f8fafc" },
              }}
            >
              {Object.entries(RHYTHM_PATTERNS).map(([mode, pattern]) => (
                <MenuItem key={mode} value={mode}>
                  {pattern.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

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
                aria-label={`${homeKey.key} key`}
                sx={{
                  color: "#e2e8f0",
                  minWidth: 36,
                  px: 1,
                  fontWeight: 900,
                  "&.Mui-selected": {
                    color: "#05070d",
                    bgcolor: homeKey.color,
                    "&:hover": { bgcolor: homeKey.color },
                  },
                }}
              >
                {homeKey.key.toUpperCase()}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Toolbar>
      </AppBar>

      <Box
        component="main"
        sx={{
          position: "relative",
          zIndex: 1,
          height: "calc(100vh - 88px)",
          minHeight: 560,
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
          px: { xs: 1.5, sm: 2.5, md: 4 },
          py: { xs: 2, md: 3 },
          gap: 2,
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="space-between"
          sx={{
            width: "min(1100px, 100%)",
            mx: "auto",
            px: { xs: 0, sm: 1 },
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Chip label={`Hits ${hits}`} size="small" sx={{ bgcolor: "#102a43", color: "#dbeafe", borderRadius: 1 }} />
            <Chip label={`Combo ${combo}`} size="small" sx={{ bgcolor: "#2f1b45", color: "#f3d9ff", borderRadius: 1 }} />
            <Chip
              label={`Mistakes ${mistakes}`}
              size="small"
              sx={{ bgcolor: "#3b1d1d", color: "#fecaca", borderRadius: 1 }}
            />
          </Stack>
          <Box
            sx={{
              width: { xs: 120, sm: 220 },
              height: 10,
              borderRadius: 1,
              bgcolor: "rgba(255,255,255,0.12)",
              overflow: "hidden",
            }}
            aria-label="Score meter"
          >
            <Box
              sx={{
                width: `${healthPercent}%`,
                height: "100%",
                bgcolor: healthPercent <= 25 ? "#ff6b6b" : "#38d9a9",
                transition: "width 180ms ease",
              }}
            />
          </Box>
        </Stack>

        <Box
          sx={{
            width: "min(1100px, 100%)",
            mx: "auto",
            position: "relative",
            display: "grid",
            gridTemplateColumns: noteColumns,
            gap: { xs: 0.7, sm: 1, md: 1.25 },
            alignItems: "stretch",
            minHeight: 0,
            mt: { xs: 3, md: 5 },
          }}
        >
          {HOME_KEYS.map((homeKey, laneIndex) => {
            const active = activeKeySet.has(homeKey.key);
            const laneNotes = notesByLane[laneIndex];
            const shouldPulse = pulseLane?.laneIndex === laneIndex;

            return (
              <Box
                key={homeKey.key}
                sx={{
                  gridColumn: getLaneGridColumn(laneIndex),
                  position: "relative",
                  zIndex: 1,
                  borderLeft: "1px solid rgba(255,255,255,0.08)",
                  borderRight: "1px solid rgba(255,255,255,0.08)",
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
                        "--note-shadow": `0 8px 22px ${homeKey.color}4d`,
                        "--note-hit-shadow": `0 0 0 4px ${homeKey.color}33, 0 0 24px ${homeKey.color}`,
                        position: "absolute",
                        top: "-8%",
                        left: "50%",
                        transform: "translate3d(-50%, -50%, 0)",
                        zIndex: 2,
                        width: { xs: 28, sm: 38, md: 46 },
                        aspectRatio: "1 / 1",
                        bgcolor: homeKey.color,
                        borderRadius: 1,
                        boxShadow: `0 8px 22px ${homeKey.color}4d`,
                        willChange: "top, transform, opacity, box-shadow",
                        animation: `${noteFall} ${FALL_DURATION_MS}ms linear ${note.animationDelayMs}ms both`,
                        pointerEvents: "none",
                      }}
                    />
                  );
                })}

                <Box
                  key={`${homeKey.key}-${pulseLane?.token ?? "idle"}`}
                  sx={{
                    position: "absolute",
                    top: `${HIT_LINE_PERCENT}%`,
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    zIndex: 3,
                    width: { xs: 34, sm: 48, md: 58 },
                    aspectRatio: "1 / 1",
                    borderRadius: 1,
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
                        fontSize: { xs: 13, sm: 16, md: 18 },
                        lineHeight: 1,
                        textTransform: "uppercase",
                        textShadow: active ? `0 0 12px ${homeKey.color}99` : "none",
                        userSelect: "none",
                      }}
                    >
                      {homeKey.key}
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
          direction="row"
          justifyContent="center"
          alignItems="center"
          spacing={2}
          sx={{
            width: "min(1100px, 100%)",
            mx: "auto",
          }}
        >
          {!running && !gameOver && (
            <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={startGame} sx={{ bgcolor: "#38d9a9", color: "#03110e" }}>
              Start
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
        </Stack>
      </Box>
    </Box>
  );
}
