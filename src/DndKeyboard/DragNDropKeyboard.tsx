// App.tsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  AppBar, Toolbar, IconButton, Drawer, Box, Typography, Paper, Stack,
  Switch, FormControlLabel, Slider, Button, ToggleButton, ToggleButtonGroup,
  Chip, List, ListItem, ListItemText, Divider, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, createTheme, ThemeProvider
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import DarkModeIcon from "@mui/icons-material/DarkMode";

/* -------------------- Keyboard layout (ANSI-ish) -------------------- */
type KeySlot = { label: string; widthU: number };

const ROWS: KeySlot[][] = [
  [{ label: "`", widthU: 1 }, { label: "1", widthU: 1 }, { label: "2", widthU: 1 }, { label: "3", widthU: 1 }, { label: "4", widthU: 1 }, { label: "5", widthU: 1 }, { label: "6", widthU: 1 }, { label: "7", widthU: 1 }, { label: "8", widthU: 1 }, { label: "9", widthU: 1 }, { label: "0", widthU: 1 }, { label: "-", widthU: 1 }, { label: "=", widthU: 1 }, { label: "Backspace", widthU: 2 }],
  [{ label: "Tab", widthU: 1.5 }, { label: "Q", widthU: 1 }, { label: "W", widthU: 1 }, { label: "E", widthU: 1 }, { label: "R", widthU: 1 }, { label: "T", widthU: 1 }, { label: "Y", widthU: 1 }, { label: "U", widthU: 1 }, { label: "I", widthU: 1 }, { label: "O", widthU: 1 }, { label: "P", widthU: 1 }, { label: "[", widthU: 1 }, { label: "]", widthU: 1 }, { label: "\\", widthU: 1.5 }],
  [{ label: "CapsLock", widthU: 1.75 }, { label: "A", widthU: 1 }, { label: "S", widthU: 1 }, { label: "D", widthU: 1 }, { label: "F", widthU: 1 }, { label: "G", widthU: 1 }, { label: "H", widthU: 1 }, { label: "J", widthU: 1 }, { label: "K", widthU: 1 }, { label: "L", widthU: 1 }, { label: ";", widthU: 1 }, { label: "'", widthU: 1 }, { label: "Enter", widthU: 2.25 }],
  [{ label: "Shift", widthU: 2.25 }, { label: "Z", widthU: 1 }, { label: "X", widthU: 1 }, { label: "C", widthU: 1 }, { label: "V", widthU: 1 }, { label: "B", widthU: 1 }, { label: "N", widthU: 1 }, { label: "M", widthU: 1 }, { label: ",", widthU: 1 }, { label: ".", widthU: 1 }, { label: "/", widthU: 1 }, { label: "Shift", widthU: 2.75 }],
  [{ label: "Ctrl", widthU: 1.25 }, { label: "Meta", widthU: 1.25 }, { label: "Alt", widthU: 1.25 }, { label: "Space", widthU: 6.25 }, { label: "Alt", widthU: 1.25 }, { label: "Meta", widthU: 1.25 }, { label: "Menu", widthU: 1.25 }, { label: "Ctrl", widthU: 1.25 }],
];

const SHIFT_ALIAS: Record<string, string> = {
  "!": "1", "@": "2", "#": "3", "$": "4", "%": "5", "^": "6", "&": "7", "*": "8", "(": "9", ")": "0",
  "_": "-", "+": "=", "~": "`", "{": "[", "}": "]", "|": "\\", ":": ";", '"': "'", "<": ",", ">": ".", "?": "/",
};
const BASE_FOR_SHIFT = SHIFT_ALIAS;
const SHIFT_FOR_BASE: Record<string, string> = Object.fromEntries(
  Object.entries(SHIFT_ALIAS).map(([top, base]) => [base, top])
);

/* Difficulty pools */
const LETTERS = Array.from("QWERTYUIOPASDFGHJKLZXCVBNM");
const NUMBERS = Array.from("1234567890");
const PUNCT = ["`", "-", "=", "[", "]", "\\", ";", "'", ",", ".", "/"];
const OTHER_KEYS = ["Backspace", "Tab", "CapsLock", "Enter", "Shift", "Ctrl", "Alt", "Meta", "Menu", "Space"];
const SHIFT_SYMBOLS = Object.keys(SHIFT_ALIAS);

type Difficulty = 1 | 2 | 3 | 4 | 5;

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const shuffle = <T,>(arr: T[]) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

/* Build a count map of how many slots each label has on the keyboard (for duplicates in pool) */
const SLOT_COUNT: Record<string, number> = ROWS.flat().reduce((acc, k) => {
  acc[k.label] = (acc[k.label] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

/* Return an array of labels for a difficulty, with duplicates for multi-slot keys (Shift/Ctrl/etc.) */
function labelsForDifficulty(d: Difficulty): string[] {
  const list: string[] = [];
  const pushWithCount = (label: string) => {
    const count = SLOT_COUNT[label] || 1;
    for (let i = 0; i < count; i++) list.push(i ? `${label} (${i + 1})` : label); // visually distinguish duplicates in pool
  };

  if (d >= 1) LETTERS.forEach((k) => pushWithCount(k));
  if (d >= 2) NUMBERS.forEach((k) => pushWithCount(k));
  if (d >= 3) PUNCT.forEach((k) => pushWithCount(k));
  if (d >= 4) OTHER_KEYS.forEach((k) => pushWithCount(k));
  if (d >= 5) SHIFT_SYMBOLS.forEach((k) => list.push(k)); // shift tops (no duplicate slots)

  return list;
}

/* Map pool name back to its base label (strip "(2)" etc.) */
const baseName = (label: string) => label.replace(/\s+\(\d+\)$/, "");

/* Types */
type KeyStatus = "idle" | "pending" | "correct" | "aliased";
type KeyStateMap = Record<string, { slot: string | null; status: KeyStatus }>;
type SlotStateMap = Record<string, { keyLabel: string | null; spotlight: boolean; stars: boolean }>;

const ALL_SLOTS = ROWS.flatMap((row, rIdx) =>
  row.map((k, cIdx) => ({ slotId: `${rIdx}-${cIdx}`, expected: k.label, widthU: k.widthU }))
);
const EXPECTED_BY_SLOT: Record<string, string> = ALL_SLOTS.reduce((acc, s) => { acc[s.slotId] = s.expected; return acc; }, {} as Record<string, string>);
const WIDTHU_BY_LABEL: Record<string, number[]> = ROWS.flat().reduce((acc, k) => {
  (acc[k.label] ||= []).push(k.widthU);
  return acc;
}, {} as Record<string, number[]>);
const ROW_SUM_U = ROWS.map((row) => row.reduce((sum, k) => sum + k.widthU, 0));
const ROW_COUNT_KEYS = ROWS.map((row) => row.length);

/* Local Storage */
const LS_SETTINGS = "kb-trainer-settings-v5";
const LS_LEADER = "kb-trainer-leaderboard-v1";
type SavedSettings = { showHints: boolean; waitSeconds: number; difficulty: Difficulty; roundSeconds: number; themeMode: "light"|"dark" };
type LeaderEntry = { name: string; score: number; when: number };

function loadSettings(): SavedSettings {
  try {
    const raw = localStorage.getItem(LS_SETTINGS);
    if (!raw) throw new Error("no settings");
    const o = JSON.parse(raw);
    return {
      showHints: o.showHints ?? false,          // default hidden
      waitSeconds: clamp(o.waitSeconds ?? 2, 1, 5), // default 2s
      difficulty: clamp(o.difficulty ?? 1, 1, 5) as Difficulty, // default level 1
      roundSeconds: clamp(o.roundSeconds ?? 60, 10, 300),
      themeMode: (o.themeMode === "dark" ? "dark" : "light"),
    };
  } catch {
    return { showHints: false, waitSeconds: 2, difficulty: 1, roundSeconds: 60, themeMode: "light" };
  }
}
function saveSettings(s: SavedSettings) { localStorage.setItem(LS_SETTINGS, JSON.stringify(s)); }
function loadLeaderboard(): LeaderEntry[] {
  try { const raw = localStorage.getItem(LS_LEADER); if (!raw) return []; return (JSON.parse(raw) as LeaderEntry[]).sort((a,b)=>b.score-a.score).slice(0,10); }
  catch { return []; }
}
function saveLeaderboard(list: LeaderEntry[]) {
  const sorted = list.sort((a,b)=>b.score-a.score).slice(0,10);
  localStorage.setItem(LS_LEADER, JSON.stringify(sorted));
}

/* Scoring */
function speedMultiplier(secondsSinceLast: number) {
  const m = 3 - Math.log2(1 + Math.max(0, secondsSinceLast));
  return clamp(m, 1, 3);
}

/* Goals */
type Goal =
  | { kind: "streak"; target: number; reward: number }
  | { kind: "avg"; targetMs: number; reward: number }
  | { kind: "placed"; target: number; reward: number };
function randomGoal(totalKeys: number): Goal {
  const choices: Goal[] = [
    { kind: "streak", target: 3 + Math.floor(Math.random() * 4), reward: 150 },              // 3..6
    { kind: "avg", targetMs: 1400 + Math.floor(Math.random() * 800), reward: 150 },          // <1.4–2.2s
    { kind: "placed", target: Math.min(totalKeys, 4 + Math.floor(Math.random() * 6)), reward: 120 } // 4..9
  ];
  return choices[Math.floor(Math.random() * choices.length)];
}

/* ---- Audio (simple WebAudio beeps) ---- */
function useSfx() {
  const ctxRef = useRef<AudioContext | null>(null);
  const ensureCtx = useCallback(async () => {
    if (!ctxRef.current) {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
      if (Ctx) ctxRef.current = new Ctx();
    }
    if (ctxRef.current && ctxRef.current.state === "suspended") await ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const tone = useCallback(async (freq: number, durMs = 140, type: OscillatorType = "sine", gain = 0.08) => {
    const ctx = await ensureCtx(); if (!ctx) return;
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.type = type; osc.frequency.value = freq; g.gain.value = gain;
    osc.connect(g).connect(ctx.destination);
    osc.start();
    setTimeout(() => { g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12); osc.stop(ctx.currentTime + 0.12); }, durMs);
  }, [ensureCtx]);

  return {
    correct: () => { tone(880, 120, "triangle", 0.09); setTimeout(() => tone(1244.5, 120, "triangle", 0.07), 120); },
    wrong:   () => { tone(200, 200, "sawtooth", 0.06); },
    goal:    () => { tone(932, 100, "square", 0.07); setTimeout(() => tone(1175, 100, "square", 0.07), 100); },
    finish:  () => { tone(659, 140, "triangle", 0.09); setTimeout(() => tone(784, 140, "triangle", 0.09), 150); setTimeout(() => tone(988, 200, "triangle", 0.09), 300); },
    prime: ensureCtx,
  };
}

export default function App() {
  /* Options / Theme */
  const init = loadSettings();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showHints, setShowHints] = useState<boolean>(init.showHints);         // default false
  const [waitSeconds, setWaitSeconds] = useState<number>(init.waitSeconds);    // default 2
  const [difficulty, setDifficulty] = useState<Difficulty>(init.difficulty);   // default 1
  const [roundSeconds, setRoundSeconds] = useState<number>(init.roundSeconds);
  const [themeMode, setThemeMode] = useState<"light" | "dark">(init.themeMode);

  useEffect(() => saveSettings({ showHints, waitSeconds, difficulty, roundSeconds, themeMode }), [showHints, waitSeconds, difficulty, roundSeconds, themeMode]);

  /* Game state */
  const allowedLabels = useMemo(() => labelsForDifficulty(difficulty), [difficulty]);
  const [keysState, setKeysState] = useState<KeyStateMap>({});
  const [slotState, setSlotState] = useState<SlotStateMap>(() => {
    const initSlots: SlotStateMap = {}; ALL_SLOTS.forEach(({ slotId }) => (initSlots[slotId] = { keyLabel: null, spotlight: false, stars: false }));
    return initSlots;
  });

  const [poolOrder, setPoolOrder] = useState<string[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>(() => loadLeaderboard());
  const [score, setScore] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [streak, setStreak] = useState(0);
  const [roundActive, setRoundActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(roundSeconds);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);
  const [returningAnim, setReturningAnim] = useState<Record<string, boolean>>({});
  const [showFireworks, setShowFireworks] = useState(false);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [pendingScore, setPendingScore] = useState<number | null>(null);
  const [playerName, setPlayerName] = useState("");

  const [goal, setGoal] = useState<Goal>(() => randomGoal(allowedLabels.length));
  const lastCorrectRef = useRef<number | null>(null);
  const [avgPlaceMs, setAvgPlaceMs] = useState<number>(0);
  const [correctCount, setCorrectCount] = useState<number>(0);

  /* SFX */
  const sfx = useSfx();
  // Prime audio after first user interaction
  const primeAudio = useCallback(() => { sfx.prime(); }, [sfx]);

  /* Timer */
  useEffect(() => { if (!roundActive) return; if (timeLeft <= 0) { endRound(); return; } const id = window.setInterval(() => setTimeLeft((t) => t - 1), 1000); return () => window.clearInterval(id); }, [roundActive, timeLeft]);
  useEffect(() => { if (!roundActive) setTimeLeft(roundSeconds); }, [roundSeconds, roundActive]);

  /* Reset on difficulty change */
  useEffect(() => { hardReset(false); }, [difficulty]);

  /* All correct? */
  const allCorrect = useMemo(
    () => Object.keys(keysState).length > 0 && Object.values(keysState).every((k) => k.status === "correct" || k.status === "aliased"),
    [keysState]
  );
  useEffect(() => { if (allCorrect && Object.keys(keysState).length > 0) endRound(true); }, [allCorrect]);

  /* Pointer-based DnD (mouse + touch unified) */
  const slotRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const setSlotRef = useCallback((slotId: string) => (el: HTMLDivElement | null) => { slotRefs.current[slotId] = el; }, []);
  const findHoveredSlot = useCallback((clientX: number, clientY: number): string | null => {
    for (const [slotId, el] of Object.entries(slotRefs.current)) {
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) return slotId;
    }
    return null;
  }, []);

  const beginDrag = (e: React.PointerEvent, keyLabel: string) => {
    if (!roundActive) return;
    if (!keysState[keyLabel] || keysState[keyLabel].slot !== null) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDraggingKey(keyLabel);
    setDragPos({ x: e.clientX, y: e.clientY });
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!draggingKey) return;
    setDragPos({ x: e.clientX, y: e.clientY });
    setHoveredSlot(findHoveredSlot(e.clientX, e.clientY));
  };
  const onPointerUp = (e: PointerEvent) => {
    if (!draggingKey) return;
    const dropSlot = findHoveredSlot(e.clientX, e.clientY);
    finishDrop(draggingKey, dropSlot);
    setDraggingKey(null); setDragPos(null); setHoveredSlot(null);
  };
  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove as any);
      window.removeEventListener("pointerup", onPointerUp as any);
    };
  });

  /* Unit sizing for squares */
  const kbWrapRef = useRef<HTMLDivElement | null>(null);
  const [unitPx, setUnitPx] = useState<number>(56);
  const KEY_GAP_PX = 8;

  const recomputeUnit = useCallback(() => {
    const el = kbWrapRef.current; if (!el) return;
    const containerWidth = el.clientWidth - 32; // account for inner padding
    const candidates = ROWS.map((row, idx) => {
      const sumU = ROW_SUM_U[idx];
      const gaps = Math.max(0, ROW_COUNT_KEYS[idx] - 1);
      return Math.floor((containerWidth - gaps * KEY_GAP_PX) / sumU);
    });
    const nextUnit = clamp(Math.min(...candidates), 34, 80);
    setUnitPx(nextUnit);
  }, []);
  useEffect(() => {
    recomputeUnit();
    const onResize = () => recomputeUnit();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [recomputeUnit]);

  /* Round controls */
  const hardReset = (keepDiff = true) => {
    const labels = labelsForDifficulty(difficulty);
    const next: KeyStateMap = {};
    labels.forEach((k) => (next[k] = { slot: null, status: "idle" }));
    setKeysState(next);

    const fresh: SlotStateMap = {};
    ALL_SLOTS.forEach(({ slotId }) => (fresh[slotId] = { keyLabel: null, spotlight: false, stars: false }));
    setSlotState(fresh);

    setPoolOrder(shuffle(labels)); // shuffle before start
    setScore(0); setStreak(0); setBestStreak(0);
    setShowFireworks(false); setReturningAnim({});
    setCorrectCount(0); setAvgPlaceMs(0); lastCorrectRef.current = null;
    setTimeLeft(roundSeconds); setRoundActive(false);
    setGoal(randomGoal(labels.length));
  };

  const startRound = () => { hardReset(true); setRoundActive(true); sfx.prime(); };

  const endRound = (completedAll: boolean = false) => {
    setRoundActive(false);
    const bonus = timeLeft > 0 ? timeLeft * 10 : 0;
    const finalScore = score + bonus;
    setScore(finalScore);
    if (completedAll) { setShowFireworks(true); sfx.finish(); }

    const updated = [...leaderboard, { name: "", score: finalScore, when: Date.now() }].sort((a, b) => b.score - a.score);
    const rank = updated.findIndex((e) => e.score === finalScore);
    if (rank >= 0 && rank < 10) { setPendingScore(finalScore); setNameDialogOpen(true); }
  };

  /* Goals advancement */
  useEffect(() => {
    if (!roundActive) return;
    let achieved = false;
    if (goal.kind === "streak" && bestStreak >= goal.target) achieved = true;
    if (goal.kind === "avg" && avgPlaceMs > 0 && avgPlaceMs < goal.targetMs) achieved = true;
    if (goal.kind === "placed" && correctCount >= goal.target) achieved = true;

    if (achieved) {
      setScore((s) => s + goal.reward);
      sfx.goal();
      setGoal(randomGoal(allowedLabels.length));
    }
  }, [bestStreak, avgPlaceMs, correctCount, goal, roundActive, allowedLabels.length, sfx]);

  /* Validation + alias handling */
  const isCorrectForSlot = (labelInPool: string, slotId: string) => {
    const expected = EXPECTED_BY_SLOT[slotId];
    const label = baseName(labelInPool); // strip (2)
    return label === expected || BASE_FOR_SHIFT[label] === expected;
  };

  const finishDrop = (labelInPool: string, slotId: string | null) => {
    if (!roundActive) return;
    if (!slotId || slotState[slotId].keyLabel !== null || !keysState[labelInPool] || keysState[labelInPool].status === "correct") return;

    setKeysState((prev) => ({ ...prev, [labelInPool]: { slot: slotId, status: "pending" } }));
    setSlotState((prev) => ({ ...prev, [slotId]: { ...prev[slotId], keyLabel: labelInPool, spotlight: true, stars: false } }));

    window.setTimeout(() => {
      setSlotState((currSlots) => {
        const stillHere = currSlots[slotId].keyLabel === labelInPool;
        if (!stillHere) return currSlots;

        const correct = isCorrectForSlot(labelInPool, slotId);
        if (correct) {
          const now = performance.now();
          const deltaMs = lastCorrectRef.current ? now - lastCorrectRef.current : 3000;
          lastCorrectRef.current = now;

          const newCorrect = correctCount + 1;
          const newAvg = (avgPlaceMs * correctCount + deltaMs) / newCorrect;
          setCorrectCount(newCorrect); setAvgPlaceMs(newAvg);

          const mult = speedMultiplier(deltaMs / 1000);
          const add = Math.round(100 * mult);
          setScore((s) => s + add);
          setStreak((st) => { const ns = st + 1; if (ns > bestStreak) setBestStreak(ns); return ns; });

          sfx.correct();

          setKeysState((kPrev) => ({ ...kPrev, [labelInPool]: { slot: slotId, status: "correct" } }));

          // satisfy alias partner (hide if present)
          const expected = EXPECTED_BY_SLOT[slotId];
          const partnerTop = SHIFT_FOR_BASE[expected];
          const placedBase = baseName(labelInPool);
          if (partnerTop && placedBase === expected) {
            // if top symbol exists in pool, mark it aliased
            const topIdx = Object.keys(keysState).find((k) => baseName(k) === partnerTop && keysState[k]?.status === "idle");
            if (topIdx) setKeysState((kPrev) => ({ ...kPrev, [topIdx]: { slot: "__alias__", status: "aliased" } as any }));
          }

          return { ...currSlots, [slotId]: { ...currSlots[slotId], spotlight: false, stars: true } };
        } else {
          sfx.wrong();
          setScore((s) => s - 25);
          setStreak(0);
          setReturningAnim((rPrev) => ({ ...rPrev, [labelInPool]: true }));
          setKeysState((kPrev) => ({ ...kPrev, [labelInPool]: { slot: null, status: "idle" } }));
          const cleared: SlotStateMap = { ...currSlots, [slotId]: { ...currSlots[slotId], keyLabel: null, spotlight: false, stars: false } };
          window.setTimeout(() => setReturningAnim((r) => ({ ...r, [labelInPool]: false })), 600);
          return cleared;
        }
      });
    }, clamp(waitSeconds, 1, 5) * 1000);
  };

  /* Derived pool */
  const poolKeys = useMemo(() => {
    const inPool = Object.keys(keysState).filter((k) => keysState[k].slot === null && keysState[k].status === "idle");
    const orderIdx: Record<string, number> = {}; poolOrder.forEach((k, i) => (orderIdx[k] = i));
    return inPool.sort((a, b) => (orderIdx[a] ?? 0) - (orderIdx[b] ?? 0));
  }, [keysState, poolOrder]);

  /* Theming */
  const theme = useMemo(() => createTheme({ palette: { mode: themeMode } }), [themeMode]);
  const isLight = themeMode === "light";
  const colors = {
    bgMain: isLight ? "#f1f5f9" : "#0b1220",
    text: isLight ? "#0f172a" : "#e5e7eb",
    keyBg: isLight ? "#ffffff" : "#0f172a",
    keyBorder: isLight ? "#cbd5e1" : "#334155",
    keyHover: isLight ? "#f59e0b" : "#fde68a",
    correctBg: "#34d399",
    correctBorder: "#059669",
    keyboardBg: isLight ? "#f5f7ff" : "#0b1730",
    keyboardBorder: isLight ? "#e2e8f0" : "#1f2a44",
    poolBg: isLight ? "#eaf3ff" : "#0e192e",
  };

  /* HUD / Goals */
  const GoalsBar = () => {
    const chip = (() => {
      switch (goal.kind) {
        case "streak": return `GOAL: Streak ${goal.target} (+${goal.reward})`;
        case "avg": return `GOAL: Avg < ${(goal.targetMs/1000).toFixed(1)}s (+${goal.reward})`;
        case "placed": return `GOAL: Place ${goal.target} (+${goal.reward})`;
      }
    })();
    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: "wrap" }}>
        <Chip color="primary" label={`Score: ${score}`} />
        <Chip variant="outlined" label={`Time: ${timeLeft}s`} />
        <Chip variant="outlined" label={`Streak: ${streak} (Best: ${bestStreak})`} />
        <Chip sx={{ fontWeight: 700 }} label={chip} />
        <Chip variant="outlined" label="End Bonus = time × 10" />
      </Stack>
    );
  };

  const renderSlotKeycap = (slotId: string) => {
    const slotInfo = slotState[slotId];
    const k = slotInfo.keyLabel;
    if (!k) return null;
    const keyInfo = keysState[k];
    const isCorrect = keyInfo?.status === "correct";
    const base = EXPECTED_BY_SLOT[slotId];
    const top = SHIFT_FOR_BASE[base];

    return (
      <Box
        sx={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: "12px",
          bgcolor: isCorrect ? colors.correctBg : colors.keyBg,
          color: colors.text,
          border: "3px solid",
          borderColor: isCorrect ? colors.correctBorder : colors.keyBorder,
          fontWeight: 800,
          fontSize: `${Math.max(12, Math.min(16, unitPx * 0.34))}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          userSelect: "none",
          px: 0.5,
          textAlign: "center",
        }}
      >
        {k}
        {slotInfo.spotlight && (
          <Box className="spotlight-overlay" sx={{ position: "absolute", inset: 0, borderRadius: "12px", pointerEvents: "none", mixBlendMode: "screen" }} />
        )}
        {slotInfo.stars && (
          <Box sx={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            <Box className="star-pop star1">★</Box>
            <Box className="star-pop star2">★</Box>
            <Box className="star-pop star3">★</Box>
          </Box>
        )}
        {showHints && (base || top) && (
          <Box sx={{ position: "absolute", inset: 6, display: "flex", flexDirection: "column", justifyContent: "space-between", pointerEvents: "none" }}>
            {top && <Typography sx={{ fontSize: `${Math.max(10, unitPx * 0.24)}px`, opacity: 0.55, fontWeight: 700, lineHeight: 1, textAlign: "left" }}>{top}</Typography>}
            <Typography sx={{ fontSize: `${Math.max(11, unitPx * 0.28)}px`, opacity: 0.7, fontWeight: 800, lineHeight: 1, textAlign: "right" }}>{base}</Typography>
          </Box>
        )}
      </Box>
    );
  };

  const renderKeyboard = () => (
    <Box
      ref={kbWrapRef}
      sx={{
        flexGrow: 2,
        bgcolor: colors.keyboardBg,
        borderBottom: `4px solid ${colors.keyboardBorder}`,
        display: "flex",
        flexDirection: "column",
        p: 2,
        px: 4,
        gap: 1.25,
      }}
    >
      <GoalsBar />

      {ROWS.map((row, rIdx) => (
        <Box key={rIdx} sx={{ display: "flex", flexDirection: "row", gap: `${KEY_GAP_PX}px` }}>
          {row.map((k, cIdx) => {
            const slotId = `${rIdx}-${cIdx}`;
            const isHovered = hoveredSlot === slotId && draggingKey !== null;
            const isFilled = slotState[slotId].keyLabel !== null;
            const keyInSlot = slotState[slotId].keyLabel;
            const keyIsCorrect = keyInSlot && keysState[keyInSlot]?.status === "correct";

            const w = Math.round(k.widthU * unitPx);
            const h = unitPx;

            const base = k.label;
            const top = SHIFT_FOR_BASE[base];

            return (
              <Box
                key={slotId}
                ref={setSlotRef(slotId)}
                sx={{
                  width: `${w}px`,
                  height: `${h}px`,
                  borderRadius: "12px",
                  border: "3px solid",
                  borderColor: isHovered ? colors.keyHover : keyIsCorrect ? colors.correctBorder : colors.keyBorder,
                  backgroundColor: colors.keyBg,
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: colors.text,
                  fontWeight: 800,
                  fontSize: `${Math.max(11, Math.min(14, unitPx * 0.28))}px`,
                  userSelect: "none",
                  px: 0.5,
                  textAlign: "center",
                  boxShadow: isHovered ? (isLight ? "0 0 0 4px rgba(245,158,11,0.15)" : "0 0 0 4px rgba(253,230,138,0.15)")
                    : isFilled ? "0 2px 6px rgba(2,6,23,0.12)" : "inset 0 2px 4px rgba(2,6,23,0.10)",
                }}
              >
                {showHints && (base || top) && (
                  <Box sx={{ position: "absolute", inset: 6, display: "flex", flexDirection: "column", justifyContent: "space-between", pointerEvents: "none" }}>
                    {top && <Typography sx={{ fontSize: `${Math.max(10, unitPx * 0.24)}px`, opacity: 0.55, fontWeight: 700, lineHeight: 1, textAlign: "left" }}>{top}</Typography>}
                    <Typography sx={{ fontSize: `${Math.max(11, unitPx * 0.28)}px`, opacity: 0.7, fontWeight: 800, lineHeight: 1, textAlign: "right" }}>{base}</Typography>
                  </Box>
                )}

                {renderSlotKeycap(slotId)}
              </Box>
            );
          })}
        </Box>
      ))}

      {showFireworks && (
        <Box sx={{ position: "relative", pointerEvents: "none", overflow: "hidden", height: 0 }}>
          {Array.from({ length: 20 }).map((_, idx) => {
            const left = 10 + Math.random() * 80;
            const dx = (Math.random() * 200 - 100).toFixed(0);
            const dy = (Math.random() * -180).toFixed(0);
            return (
              <Box
                key={idx}
                className="firework-particle"
                sx={{
                  position: "absolute",
                  left: `${left}vw`,
                  top: `8vh`,
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  backgroundColor: isLight ? "#fb7185" : "#fbbf24",
                  "--dx": `${dx}px`,
                  "--dy": `${dy}px`,
                } as any}
              />
            );
          })}
        </Box>
      )}
    </Box>
  );

  const renderPool = () => (
    <Box
      sx={{
        flexGrow: 1,
        bgcolor: colors.poolBg,
        p: 2,
        pt: 1,
        display: "flex",
        flexWrap: "wrap",
        alignContent: "flex-start",
        gap: 0.5, // tighter
        overflowY: "auto",
        borderTop: `4px solid ${colors.keyboardBorder}`,
        touchAction: draggingKey ? "none" as any : "auto", // prevent scroll while dragging
      }}
    >
      <Typography sx={{ width: "100%", color: colors.text, fontSize: "1rem", mb: 0.75, fontWeight: 900 }}>
        Drag the keys to the correct spots:
      </Typography>

      {poolKeys.map((label) => {
        const animClass = returningAnim[label] ? "key-return" : "";
        const plain = baseName(label);
        const isLong = ["Space", "Enter", "Shift", "CapsLock", "Backspace", "Tab"].includes(plain);
        const baseW = Math.max(44, Math.min(80, unitPx + 6));
        const width = isLong ? baseW * 2.2 : baseW;

        return (
          <Box
            key={label}
            className={animClass}
            onPointerDown={(e) => { primeAudio(); beginDrag(e, label); }}
            sx={{
              minWidth: width,
              height: baseW,
              px: 1.25,
              borderRadius: "12px",
              bgcolor: colors.keyBg,
              color: colors.text,
              border: `3px solid ${colors.keyBorder}`,
              fontWeight: 900,
              fontSize: `${Math.max(12, Math.min(18, baseW * 0.36))}px`,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              userSelect: "none",
              cursor: roundActive ? "grab" : "not-allowed",
              boxShadow: "0 2px 6px rgba(2,6,23,0.12)",
              "&:active": { cursor: roundActive ? "grabbing" : "not-allowed" },
              position: "relative",
              textAlign: "center",
              whiteSpace: "nowrap",
              touchAction: "none",
            }}
            title={BASE_FOR_SHIFT[plain] ? `${plain} (shift of ${BASE_FOR_SHIFT[plain]})` : plain}
          >
            {label}
          </Box>
        );
      })}

      {draggingKey && dragPos && roundActive && (
        <Box
          sx={{
            position: "fixed",
            left: dragPos.x - (unitPx / 2),
            top: dragPos.y - (unitPx / 2),
            width: (() => {
              // stretch preview to hovered slot width so it "fits perfectly"
              if (hoveredSlot) {
                const expected = EXPECTED_BY_SLOT[hoveredSlot];
                const wU = WIDTHU_BY_LABEL[expected]?.[0] ?? 1;
                return Math.round(wU * unitPx);
              }
              // otherwise size based on the label's first known width
              const plain = baseName(draggingKey);
              const wU = WIDTHU_BY_LABEL[plain]?.[0] ?? 1;
              return Math.round(wU * unitPx);
            })(),
            height: unitPx,
            borderRadius: "12px",
            bgcolor: colors.keyBg,
            color: colors.text,
            border: `3px solid ${colors.keyHover}`,
            fontWeight: 900,
            fontSize: `${Math.max(12, Math.min(16, unitPx * 0.34))}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            userSelect: "none",
            pointerEvents: "none",
            boxShadow: isLight ? "0 0 0 6px rgba(245,158,11,0.12)" : "0 0 0 6px rgba(253,230,138,0.12)",
            zIndex: 5,
          }}
        >
          {draggingKey}
        </Box>
      )}
    </Box>
  );

  const renderLeaderboard = () => (
    <Paper elevation={0} sx={{ m: 2, p: 1, borderRadius: 3, backgroundColor: theme.palette.background.paper, border: `4px solid ${colors.keyboardBorder}`, color: colors.text, height: "calc(100% - 16px)", overflow: "hidden" }}>
      <Typography sx={{ fontWeight: 900, p: 1, pb: 0.5 }}>Top 10</Typography>
      <List dense sx={{ overflowY: "auto", maxHeight: "calc(100% - 40px)" }}>
        {leaderboard.length === 0 && (<ListItem><ListItemText primary="No scores yet. Be the first!" /></ListItem>)}
        {leaderboard.map((e, i) => (
          <React.Fragment key={i}>
            <ListItem>
              <ListItemText primaryTypographyProps={{ sx: { fontWeight: 800 } }} primary={`${i + 1}. ${e.name || "—"} — ${e.score}`} secondary={new Date(e.when).toLocaleDateString()} />
            </ListItem>
            {i < leaderboard.length - 1 && <Divider component="li" />}
          </React.Fragment>
        ))}
      </List>
    </Paper>
  );

  const renderDrawer = () => (
    <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
      <Box sx={{ width: { xs: 300, sm: 340 }, bgcolor: theme.palette.background.paper, color: colors.text, height: "100%", p: 2 }} role="presentation">
        <Typography sx={{ fontWeight: 900, mb: 1.5 }}>Options</Typography>

        <FormControlLabel control={<Switch checked={showHints} onChange={(e) => setShowHints(e.target.checked)} />} label="Show correct letters" />

        <Box sx={{ mt: 2 }}>
          <Typography sx={{ fontSize: "0.95rem", mb: 0.5, fontWeight: 700 }}>Answer wait time: {waitSeconds}s</Typography>
          <Slider min={1} max={5} step={1} value={waitSeconds} onChange={(_, v) => setWaitSeconds(v as number)} valueLabelDisplay="auto" />
        </Box>

        <Box sx={{ mt: 2 }}>
          <Typography sx={{ fontSize: "0.95rem", mb: 0.75, fontWeight: 700 }}>Difficulty (1–5)</Typography>
          <ToggleButtonGroup exclusive value={difficulty} onChange={(_, v) => v && setDifficulty(v as Difficulty)} size="small">
            <ToggleButton value={1}>1</ToggleButton><ToggleButton value={2}>2</ToggleButton><ToggleButton value={3}>3</ToggleButton>
            <ToggleButton value={4}>4</ToggleButton><ToggleButton value={5}>5</ToggleButton>
          </ToggleButtonGroup>
          <Typography sx={{ mt: 0.75, opacity: 0.7, fontSize: "0.9rem" }}>
            1: letters · 2: +numbers · 3: +punctuation · 4: +other keys · 5: +shift symbols
          </Typography>
        </Box>

        <Box sx={{ mt: 2 }}>
          <Typography sx={{ fontSize: "0.95rem", mb: 0.5, fontWeight: 700 }}>Round length: {roundSeconds}s</Typography>
          <Slider min={10} max={300} step={5} value={roundSeconds} onChange={(_, v) => setRoundSeconds(v as number)} valueLabelDisplay="auto" />
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Button variant="contained" onClick={() => { startRound(); setDrawerOpen(false); }}>
              {roundActive ? "Restart Round" : "Start Round"}
            </Button>
            <Button variant="outlined" onClick={() => { setRoundActive(false); setTimeLeft(roundSeconds); }}>
              Stop
            </Button>
          </Stack>
        </Box>

        <Box sx={{ mt: 3 }}>
          <Button variant="outlined" color="error" onClick={() => { saveLeaderboard([]); setLeaderboard([]); }}>
            Clear Leaderboard
          </Button>
        </Box>
      </Box>
    </Drawer>
  );

  const renderNameDialog = () => (
    <Dialog open={nameDialogOpen} onClose={() => setNameDialogOpen(false)}>
      <DialogTitle>Top 10! Enter your name</DialogTitle>
      <DialogContent>
        <TextField autoFocus margin="dense" label="Name" fullWidth variant="standard" value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setNameDialogOpen(false)}>Cancel</Button>
        <Button
          onClick={() => {
            if (pendingScore == null) return;
            const entry: LeaderEntry = { name: playerName.trim() || "Player", score: pendingScore, when: Date.now() };
            const updated = [...leaderboard, entry].sort((a, b) => b.score - a.score).slice(0, 10);
            setLeaderboard(updated); saveLeaderboard(updated);
            setNameDialogOpen(false); setPendingScore(null); setPlayerName("");
          }}
          variant="contained"
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <ThemeProvider theme={theme}>
      <style>{`
        @keyframes sweep { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .spotlight-overlay { background: linear-gradient(75deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.75) 50%, rgba(255,255,255,0) 100%); background-size: 200% 200%; animation: sweep 1s linear infinite; border-radius: 12px; opacity: 0.9; }
        @keyframes star-pop { 0% { transform: scale(0) translate(0,0); opacity:1; } 70% { transform: scale(1) translate(0,-16px); opacity:1; } 100% { transform: scale(0.5) translate(0,-28px); opacity:0; } }
        .star-pop { position: absolute; font-size: 0.9rem; font-weight: 900; color: #f59e0b; text-shadow: 0 0 4px rgba(245,158,11,0.7), 0 0 8px rgba(245,158,11,0.4); animation: star-pop 0.8s ease-out forwards; }
        .star1 { left: 6px; bottom: 6px; } .star2 { right: 6px; bottom: 6px; } .star3 { left: 50%; bottom: 10px; transform: translateX(-50%); }
        @keyframes spinDown { 0% { transform: translateY(0px) rotate(0deg); } 30% { transform: translateY(-8px) rotate(180deg); } 100% { transform: translateY(16px) rotate(360deg); } }
        .key-return { animation: spinDown 0.65s ease-out; }
        @keyframes fireworkBurst { 0% { transform: translate(0,0) scale(1); opacity:1; } 100% { transform: translate(var(--dx), var(--dy)) scale(0.5); opacity:0; } }
        .firework-particle { animation: fireworkBurst 0.9s ease-out forwards; box-shadow: 0 0 6px rgba(255,255,255,0.8), 0 0 12px rgba(255,255,255,0.5); }
      `}</style>

      <AppBar position="static" color="primary">
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => setDrawerOpen(true)} aria-label="menu">
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" sx={{ fontWeight: 900 }}>
            DragNDropKeyboard
          </Typography>

          {/* Sun/Moon toggle to the right of the Title */}
          <IconButton color="inherit" onClick={() => setThemeMode((m) => (m === "light" ? "dark" : "light"))} sx={{ ml: 1 }} aria-label="toggle theme">
            {isLight ? <DarkModeIcon /> : <WbSunnyIcon />}
          </IconButton>

          <Box sx={{ flexGrow: 1 }} />

          <Stack direction="row" spacing={1}>
            <Button color="inherit" onClick={startRound}>{roundActive ? "Restart" : "Start"}</Button>
            <Button color="inherit" onClick={() => { setRoundActive(false); setTimeLeft(roundSeconds); }}>Stop</Button>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Single-layer main area */}
      <Box
        sx={{
          bgcolor: colors.bgMain,
          color: colors.text,
          height: "calc(100vh - 64px)",
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "280px 1fr" },
          gridAutoRows: "1fr",
          gap: 0,
          overflow: "hidden",
        }}
        onPointerDown={primeAudio}
      >
        <Box sx={{ display: { xs: "none", md: "block" } }}>
          {renderLeaderboard()}
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
          {renderKeyboard()}
          {renderPool()}
        </Box>
      </Box>

      {renderDrawer()}
      {renderNameDialog()}
    </ThemeProvider>
  );
}
