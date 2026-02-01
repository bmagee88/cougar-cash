import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CssBaseline,
  Divider,
  Paper,
  Stack,
  Switch,
  TextField,
  ThemeProvider,
  Typography,
  createTheme,
} from "@mui/material";
import Papa from "papaparse";

/** =========================
 *  CONFIG (easy to modify)
 *  ========================= */
const CONFIG = {
  // Round rules
  ROUND_SIZE: 10,
  LEADERBOARD_SIZE: 10,

  // Scoring
  MISTAKE_PENALTY: 2, // points lost per mistake (per question)
  FIRST_CHOICE_CORRECT_BONUS: 25, // bonus if first a/b choice was correct
  QUESTION_STREAK_MULT_PER: 0.25, // each correctly-answered question in a row adds +0.25
  KEY_STREAK_MULT_PER: 0.01, // each correct key in a row (no mistakes) adds +0.01
  MAX_KEY_STREAK_FOR_MULT: 200, // cap multiplier boost from key-streak

  // Storage
  STORAGE_KEY: "TypingQuiz_v2_state",

  // Visual
  REQUIRED_BG: "rgba(255, 235, 59, 0.65)",
  ERROR_BG: "rgba(244, 67, 54, 0.25)",
  SUCCESS_BG: "rgba(76, 175, 80, 0.22)",
};

type Phase = "prompt" | "answer" | "round_end";
type Rank = "Perfect" | "Clean" | "Rough" | "Off Track";
type LaneId = "a" | "b";

type BankItem = {
  id: string;
  prompt: string;
  correct: string;
  wrong: string;
};

type QuestionInstance = {
  bankId: string;
  prompt: string;

  // lanes are randomized each time the instance is created
  aText: string;
  bText: string;

  correctLane: LaneId; // which lane is correct for this instance
};

type LeaderboardEntry = {
  id: string;
  name: string;
  score: number;
  correctFirstChoice: number; // how many questions first-choice correct (out of ROUND_SIZE)
  totalMistakes: number;
  endedAt: number;
};

type Persisted = {
  version: 2;

  // user
  playerName: string;
  mode: "light" | "dark";

  // bank
  bank: BankItem[];

  // rng + ordering
  seed: number;
  order: string[]; // array of bankIds
  pos: number; // current position in order (0..)

  // current queue
  current: QuestionInstance | null;
  next: QuestionInstance | null;

  // phase + cursors
  phase: Phase;
  promptCursor: number;
  answerCursor: number;
  lockedLane: LaneId | null;

  // eliminated lanes
  hideA: boolean;
  hideB: boolean;

  // per-question flags
  firstChoiceWasCorrect: boolean | null;
  questionMistakes: number;

  // streaks + scoring
  scoreTotal: number;

  // round state
  roundIndex: number; // how many rounds completed
  roundQuestionCount: number; // 0..ROUND_SIZE
  roundScore: number;
  roundMistakes: number;
  roundCorrectFirstChoice: number;
  streakCorrectQuestions: number;
  keyStreak: number;

  // leaderboard
  leaderboard: LeaderboardEntry[];
};

/** =========================
 *  Small utilities
 *  ========================= */
function nowId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

// seeded RNG (mulberry32)
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildOption(id: LaneId, text: string) {
  return `${id}. ${text}`;
}

function getRankFromRoundMistakes(m: number): Rank {
  if (m === 0) return "Perfect";
  if (m <= 5) return "Clean";
  if (m <= 15) return "Rough";
  return "Off Track";
}

// flair helpers
function getRankEmoji(rank: Rank) {
  switch (rank) {
    case "Perfect":
      return "🏆";
    case "Clean":
      return "✨";
    case "Rough":
      return "🛠️";
    case "Off Track":
      return "🚧";
    default:
      return "⭐";
  }
}

function getStreakEmoji(streak: number) {
  if (streak >= 10) return "🔥";
  if (streak >= 5) return "⚡";
  if (streak >= 2) return "🌟";
  return "🙂";
}

function getMultiplierEmoji(mult: number) {
  if (mult >= 4) return "🚀";
  if (mult >= 3) return "⚡";
  if (mult >= 2) return "🌟";
  return "🔁";
}

function getStreakGlowSx(streak: number) {
  if (streak >= 10) return { boxShadow: "0 0 18px rgba(255, 140, 0, 0.55)" };
  if (streak >= 5) return { boxShadow: "0 0 14px rgba(255, 235, 59, 0.5)" };
  if (streak >= 2) return { boxShadow: "0 0 10px rgba(0, 200, 255, 0.45)" };
  return {};
}

function getMultiplierGlowSx(mult: number) {
  if (mult >= 4) return { boxShadow: "0 0 18px rgba(0, 255, 160, 0.55)" };
  if (mult >= 3) return { boxShadow: "0 0 14px rgba(0, 200, 255, 0.5)" };
  if (mult >= 2) return { boxShadow: "0 0 10px rgba(255, 235, 59, 0.45)" };
  return {};
}

function getRankGlowSx(rank: Rank) {
  if (rank === "Perfect")
    return { boxShadow: "0 0 18px rgba(255, 215, 0, 0.6)" };
  if (rank === "Clean")
    return { boxShadow: "0 0 14px rgba(180, 255, 255, 0.5)" };
  if (rank === "Rough")
    return { boxShadow: "0 0 12px rgba(255, 160, 80, 0.5)" };
  return { boxShadow: "0 0 10px rgba(255, 80, 80, 0.4)" };
}

function isRelevantKey(e: React.KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  return e.key.length === 1;
}

function flashFor(ms: number, set: (v: boolean) => void) {
  set(true);
  window.setTimeout(() => set(false), ms);
}

/** =========================
 *  UI line renderers
 *  ========================= */
function RemainingTextLine({
  text,
  cursor,
  active,
  flashBg, // "none" | "red" | "green"
}: {
  text: string;
  cursor: number;
  active: boolean;
  flashBg: "none" | "red" | "green";
}) {
  const remaining = text.slice(cursor);
  const required = remaining.slice(0, 1);
  const after = remaining.slice(1);
  const requiredRender = required === " " ? "\u00A0" : required;

  const bg =
    flashBg === "red"
      ? CONFIG.ERROR_BG
      : flashBg === "green"
        ? CONFIG.SUCCESS_BG
        : "transparent";

  return (
    <Box
      sx={{
        display: "inline-block",
        borderRadius: 2,
        px: 0.5,
        backgroundColor: bg,
      }}
    >
      <span
        style={{
          display: "inline-block",
          minWidth: "0.6ch",
          background: active && required ? CONFIG.REQUIRED_BG : "transparent",
          borderRadius: active && required ? "4px" : "0px",
          padding: active && required ? "0 0.15ch" : "0",
        }}
      >
        {requiredRender || "\u00A0"}
      </span>
      <span>{after}</span>
    </Box>
  );
}

/** =========================
 *  CSV -> bank parsing
 *  Accepts headers:
 *   - prompt/question
 *   - correct
 *   - wrong/incorrect
 *  ========================= */
function rowsToBank(rows: any[]): BankItem[] {
  const out: BankItem[] = [];
  for (const r of rows) {
    const prompt = (r.prompt ?? r.question ?? r.q ?? "").toString().trim();
    const correct = (r.correct ?? r.answer ?? r.a ?? "").toString().trim();
    const wrong = (r.wrong ?? r.incorrect ?? r.b ?? r.distractor ?? "")
      .toString()
      .trim();
    if (!prompt || !correct || !wrong) continue;
    out.push({ id: nowId(), prompt, correct, wrong });
  }
  return out;
}

/** =========================
 *  Default bank
 *  ========================= */
const DEFAULT_BANK: BankItem[] = [
  {
    id: "d1",
    prompt: "change over time?",
    correct: "line",
    wrong: "bar",
  },
//   {
//     id: "d2",
//     prompt: "What does frequency mean in a data table?",
//     correct: "Frequency means how many times something happens.",
//     wrong: "Frequency means how many categories are in the data.",
//   },
//   {
//     id: "d3",
//     prompt: "Which graph is best for showing parts of a whole?",
//     correct: "A pie chart is best for showing parts of a whole.",
//     wrong: "A line graph is best for showing parts of a whole.",
//   },
];

/** =========================
 *  Main component
 *  ========================= */
export default function TypingQuiz() {
  /** ---------
   *  Load persisted (once)
   *  --------- */
  const loaded = useMemo(() => {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Persisted;
      if (!parsed || parsed.version !== 2) return null;
      return parsed;
    } catch {
      return null;
    }
  }, []);

  // user settings
  const [mode, setMode] = useState<"light" | "dark">(loaded?.mode ?? "dark");
  const [playerName, setPlayerName] = useState<string>(
    loaded?.playerName ?? "Player",
  );

  // bank
  const [bank, setBank] = useState<BankItem[]>(
    loaded?.bank?.length ? loaded.bank : DEFAULT_BANK,
  );

  // rng / ordering
  const [seed, setSeed] = useState<number>(loaded?.seed ?? Date.now() >>> 0);
  const rand = useMemo(() => mulberry32(seed), [seed]);

  const [order, setOrder] = useState<string[]>(
    loaded?.order?.length
      ? loaded.order
      : shuffle(
          bank.map((b) => b.id),
          rand,
        ),
  );
  const [pos, setPos] = useState<number>(loaded?.pos ?? 0);

  // queue
  const [current, setCurrent] = useState<QuestionInstance | null>(
    loaded?.current ?? null,
  );
  const [next, setNext] = useState<QuestionInstance | null>(
    loaded?.next ?? null,
  );

  // phase + cursors
  const [phase, setPhase] = useState<Phase>(loaded?.phase ?? "prompt");
  const [promptCursor, setPromptCursor] = useState<number>(
    loaded?.promptCursor ?? 0,
  );
  const [answerCursor, setAnswerCursor] = useState<number>(
    loaded?.answerCursor ?? 0,
  );
  const [lockedLane, setLockedLane] = useState<LaneId | null>(
    loaded?.lockedLane ?? null,
  );

  // eliminate lanes
  const [hideA, setHideA] = useState<boolean>(loaded?.hideA ?? false);
  const [hideB, setHideB] = useState<boolean>(loaded?.hideB ?? false);

  // per-question flags
  const [firstChoiceWasCorrect, setFirstChoiceWasCorrect] = useState<
    boolean | null
  >(loaded?.firstChoiceWasCorrect ?? null);
  const [questionMistakes, setQuestionMistakes] = useState<number>(
    loaded?.questionMistakes ?? 0,
  );

  // totals
  const [scoreTotal, setScoreTotal] = useState<number>(loaded?.scoreTotal ?? 0);

  // round state
  const [roundIndex, setRoundIndex] = useState<number>(loaded?.roundIndex ?? 0);
  const [roundQuestionCount, setRoundQuestionCount] = useState<number>(
    loaded?.roundQuestionCount ?? 0,
  );
  const [roundScore, setRoundScore] = useState<number>(loaded?.roundScore ?? 0);
  const [roundMistakes, setRoundMistakes] = useState<number>(
    loaded?.roundMistakes ?? 0,
  );
  const [roundCorrectFirstChoice, setRoundCorrectFirstChoice] =
    useState<number>(loaded?.roundCorrectFirstChoice ?? 0);

  const [streakCorrectQuestions, setStreakCorrectQuestions] = useState<number>(
    loaded?.streakCorrectQuestions ?? 0,
  );
  const [keyStreak, setKeyStreak] = useState<number>(loaded?.keyStreak ?? 0);

  // leaderboard
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(
    loaded?.leaderboard ?? [],
  );

  // flashes
  const [promptFlashRed, setPromptFlashRed] = useState(false);
  const [answerFlashRed, setAnswerFlashRed] = useState(false);
  const [answerFlashGreen, setAnswerFlashGreen] = useState(false);

  // theme
  const theme = useMemo(
    () =>
      createTheme({
        palette: { mode },
        shape: { borderRadius: 12 },
      }),
    [mode],
  );

  // keyboard focus
  const hostRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    hostRef.current?.focus();
  }, [phase, current?.bankId, roundQuestionCount]);

  /** ---------
   *  Helpers: get bank item by id
   *  --------- */
  const bankMap = useMemo(() => {
    const m = new Map<string, BankItem>();
    for (const b of bank) m.set(b.id, b);
    return m;
  }, [bank]);

  function makeInstance(
    bankId: string,
    localSeedBump: number,
  ): QuestionInstance | null {
    const b = bankMap.get(bankId);
    if (!b) return null;

    // Use a deterministic per-instance RNG derived from seed + bump + bankId hash-ish
    let h = 2166136261 >>> 0;
    for (let i = 0; i < bankId.length; i++)
      h = Math.imul(h ^ bankId.charCodeAt(i), 16777619);
    const r = mulberry32((seed ^ h ^ localSeedBump) >>> 0);

    const correctOnTop = r() < 0.5; // randomize answer placement
    const aText = buildOption("a", correctOnTop ? b.correct : b.wrong);
    const bText = buildOption("b", correctOnTop ? b.wrong : b.correct);
    const correctLane: LaneId = correctOnTop ? "a" : "b";

    return {
      bankId: b.id,
      prompt: b.prompt,
      aText,
      bText,
      correctLane,
    };
  }

  /** ---------
   *  Ensure current + next exist
   *  --------- */
  useEffect(() => {
    // if order doesn't cover bank, rebuild
    const bankIds = bank.map((b) => b.id);
    const setIds = new Set(bankIds);
    const filteredOrder = order.filter((id) => setIds.has(id));
    const missing = bankIds.filter((id) => !filteredOrder.includes(id));
    if (missing.length || filteredOrder.length !== order.length) {
      const r = mulberry32(seed);
      const newOrder = shuffle([...filteredOrder, ...missing], r);
      setOrder(newOrder);
      if (pos >= newOrder.length) setPos(0);
      return;
    }

    // current instance
    if (!current) {
      const id = order[pos % order.length];
      const inst = makeInstance(id, pos);
      setCurrent(inst);
      return;
    }

    // next instance
    if (!next) {
      const id = order[(pos + 1) % order.length];
      const inst = makeInstance(id, pos + 1);
      setNext(inst);
      return;
    }
  }, [bank, bankMap, current, next, order, pos, seed]);

  /** ---------
   *  Multiplier
   *  --------- */
  const keyStreakCapped = clamp(keyStreak, 0, CONFIG.MAX_KEY_STREAK_FOR_MULT);
  const multiplier =
    1 +
    CONFIG.QUESTION_STREAK_MULT_PER * streakCorrectQuestions +
    CONFIG.KEY_STREAK_MULT_PER * keyStreakCapped;

  // Rank based on ROUND mistakes
  const rank: Rank = getRankFromRoundMistakes(roundMistakes);

  /** ---------
   *  LocalStorage save (whenever important state changes)
   *  --------- */
  useEffect(() => {
    const payload: Persisted = {
      version: 2,
      playerName,
      mode,
      bank,

      seed,
      order,
      pos,

      current,
      next,

      phase,
      promptCursor,
      answerCursor,
      lockedLane,

      hideA,
      hideB,

      firstChoiceWasCorrect,
      questionMistakes,

      scoreTotal,

      roundIndex,
      roundQuestionCount,
      roundScore,
      roundMistakes,
      roundCorrectFirstChoice,
      streakCorrectQuestions,
      keyStreak,

      leaderboard,
    };

    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage errors
    }
  }, [
    playerName,
    mode,
    bank,
    seed,
    order,
    pos,
    current,
    next,
    phase,
    promptCursor,
    answerCursor,
    lockedLane,
    hideA,
    hideB,
    firstChoiceWasCorrect,
    questionMistakes,
    scoreTotal,
    roundIndex,
    roundQuestionCount,
    roundScore,
    roundMistakes,
    roundCorrectFirstChoice,
    streakCorrectQuestions,
    keyStreak,
    leaderboard,
  ]);

  /** ---------
   *  Per-key behavior
   *  --------- */
  function onCorrectKey() {
    setKeyStreak((k) => clamp(k + 1, 0, 999999));
  }

  function onMistake() {
    setQuestionMistakes((m) => m + 1);
    setRoundMistakes((m) => m + 1);
    setKeyStreak(0);
  }

  /** ---------
   *  Round end + leaderboard
   *  --------- */
  function finalizeRoundWithScore(finalRoundScore: number) {
    const entry: LeaderboardEntry = {
      id: nowId(),
      name: playerName.trim() ? playerName.trim() : "Player",
      score: finalRoundScore,
      correctFirstChoice: roundCorrectFirstChoice,
      totalMistakes: roundMistakes,
      endedAt: Date.now(),
    };

    setLeaderboard((prev) =>
      [entry, ...prev]
        .sort((a, b) => b.score - a.score)
        .slice(0, CONFIG.LEADERBOARD_SIZE),
    );

    // reset round values NOW (no pending +earned can override anymore)
    setRoundIndex((r) => r + 1);
    setRoundQuestionCount(0);
    setRoundScore(0);
    setRoundMistakes(0);
    setRoundCorrectFirstChoice(0);

    setStreakCorrectQuestions(0);
    setKeyStreak(0);
    setScoreTotal(0);

    // new shuffle for next round
    const newSeed = ((seed + 0x9e3779b9) >>> 0) ^ (Date.now() >>> 0);
    const r = mulberry32(newSeed);
    setSeed(newSeed);
    setOrder(
      shuffle(
        bank.map((b) => b.id),
        r,
      ),
    );
    setPos(0);

    // reset queue/typing
    setCurrent(null);
    setNext(null);
    setPhase("prompt");
    setPromptCursor(0);
    setAnswerCursor(0);
    setLockedLane(null);
    setHideA(false);
    setHideB(false);
    setFirstChoiceWasCorrect(null);
    setQuestionMistakes(0);

  }

  /** ---------
   *  Advance question (shift next -> current, create new next)
   *  Also: generate next question+answers and append below (UI does this by rendering both current and next)
   *  --------- */
 function advanceQuestion() {
  // update position
  const newPos = (pos + 1) % Math.max(1, order.length);
  setPos(newPos);

  // shift queue
  setCurrent(next);
  setNext(null); // effect will create the next-next

  // reset per-question typing state
  setPhase("prompt");
  setPromptCursor(0);
  setAnswerCursor(0);
  setLockedLane(null);
  setHideA(false);
  setHideB(false);
  setFirstChoiceWasCorrect(null);
  setQuestionMistakes(0);

  // ✅ ONLY increment here — DO NOT end the round in this function
  setRoundQuestionCount((c) => c + 1);
}


  /** ---------
   *  Score a completed question
   *  --------- */
  function awardQuestionPoints(inst: QuestionInstance) {
    const correctChars =
      inst.prompt.length +
      (inst.correctLane === "a" ? inst.aText.length : inst.bText.length);
    const answeredCorrectly = firstChoiceWasCorrect === true;

    const nextStreakCorrectQuestions = answeredCorrectly
      ? streakCorrectQuestions + 1
      : 0;
    const keyStreakForMult = clamp(
      keyStreak,
      0,
      CONFIG.MAX_KEY_STREAK_FOR_MULT,
    );
    const multAfter =
      1 +
      CONFIG.QUESTION_STREAK_MULT_PER * nextStreakCorrectQuestions +
      CONFIG.KEY_STREAK_MULT_PER * keyStreakForMult;

    const base =
      correctChars -
      CONFIG.MISTAKE_PENALTY * questionMistakes +
      (answeredCorrectly ? CONFIG.FIRST_CHOICE_CORRECT_BONUS : 0);

    const earned = Math.max(0, Math.round(base * multAfter));

    setScoreTotal((s) => s + earned);
    const nextRoundScore = roundScore + earned;
    setRoundScore(nextRoundScore);

    if (answeredCorrectly) {
      setRoundCorrectFirstChoice((c) => c + 1);
      setStreakCorrectQuestions(nextStreakCorrectQuestions);
    } else {
      setStreakCorrectQuestions(0);
    }
    return { earned, nextRoundScore, answeredCorrectly };
  }

  /** ---------
   *  Key handling
   *  --------- */
  function handlePromptKey(ch: string, inst: QuestionInstance) {
    const expected = inst.prompt[promptCursor] ?? "";
    if (ch === expected) {
      onCorrectKey();
      const nextCursor = promptCursor + 1;
      setPromptCursor(nextCursor);
      if (nextCursor >= inst.prompt.length) {
        setPhase("answer");
        setAnswerCursor(0);
        setLockedLane(null);
      }
    } else {
      onMistake();
      flashFor(140, setPromptFlashRed);
      // no reset, no advance
    }
  }

  function handleAnswerKey(ch: string, inst: QuestionInstance) {
    // First character locks lane: must be 'a' or 'b'
    if (lockedLane === null) {
      if (ch !== "a" && ch !== "b") {
        onMistake();
        flashFor(140, setAnswerFlashRed);
        return;
      }

      const chosen = ch as LaneId;

      if (chosen !== inst.correctLane) {
        // wrong first choice: flash red, remove wrong option, lock to correct lane, require typing correct lane
        setFirstChoiceWasCorrect(false);
        onMistake();
        flashFor(220, setAnswerFlashRed);

        if (chosen === "a") setHideA(true);
        if (chosen === "b") setHideB(true);

        setLockedLane(inst.correctLane);
        setAnswerCursor(0);
        return;
      }

      // correct first choice
      setFirstChoiceWasCorrect(true);
      setLockedLane(chosen);
      if (chosen === "a") setHideB(true);
      if (chosen === "b") setHideA(true);

      // they typed the correct lane letter
      onCorrectKey();
      setAnswerCursor(1);
      flashFor(180, setAnswerFlashGreen);
      return;
    }

    // Locked lane: must type remaining characters of correct lane string
    const target = lockedLane === "a" ? inst.aText : inst.bText;
    const expected = target[answerCursor] ?? "";

    if (ch === expected) {
      onCorrectKey();
      const nextCursor = answerCursor + 1;
      setAnswerCursor(nextCursor);

      if (nextCursor >= target.length) {
        // completed the correct answer
        const { nextRoundScore } = awardQuestionPoints(inst);

        const willEndRound = roundQuestionCount + 1 >= CONFIG.ROUND_SIZE;

        if (willEndRound) {
          finalizeRoundWithScore(nextRoundScore);
        } else {
          advanceQuestion();
        }
      }
    } else {
      onMistake();
      flashFor(140, setAnswerFlashRed);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isRelevantKey(e)) return;
    e.preventDefault();
    if (!current) return;
    if (phase === "round_end") return;

    const ch = e.key;

    if (phase === "prompt") {
      handlePromptKey(ch, current);
      return;
    }

    if (phase === "answer") {
      handleAnswerKey(ch, current);
      return;
    }
  }

  /** ---------
   *  CSV upload
   *  --------- */
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function onUploadClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(file: File | null) {
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rows = (res.data as any[]) ?? [];
        const parsedBank = rowsToBank(rows);

        if (!parsedBank.length) return;

        // Replace bank, rebuild ordering + queue
        const newSeed =
          ((Date.now() >>> 0) ^ (Math.random() * 0xffffffff)) >>> 0;
        const r = mulberry32(newSeed);

        setBank(parsedBank);
        setSeed(newSeed);
        setOrder(
          shuffle(
            parsedBank.map((b) => b.id),
            r,
          ),
        );
        setPos(0);

        setCurrent(null);
        setNext(null);

        // reset round & typing
        setPhase("prompt");
        setPromptCursor(0);
        setAnswerCursor(0);
        setLockedLane(null);
        setHideA(false);
        setHideB(false);
        setFirstChoiceWasCorrect(null);
        setQuestionMistakes(0);

        setRoundQuestionCount(0);
        setRoundScore(0);
        setRoundMistakes(0);
        setRoundCorrectFirstChoice(0);
        setStreakCorrectQuestions(0);
        setKeyStreak(0);
      },
    });
  }

  /** ---------
   *  Render helpers
   *  --------- */
  const rankNow = rank;
  const multiplierNow = multiplier;

  const answeredSoFar = roundQuestionCount; // counts completed questions in this round
  const roundProgressLabel = `🧩 Round: ${answeredSoFar}/${CONFIG.ROUND_SIZE}`;

  function renderTrack(inst: QuestionInstance, active: boolean, dim: boolean) {
    const promptActive =
      active && phase === "prompt" && inst.bankId === current?.bankId;
    const answerActive =
      active && phase === "answer" && inst.bankId === current?.bankId;

    const showAnswerCursors = inst.bankId === current?.bankId;

    const localPromptCursor = showAnswerCursors ? promptCursor : 0;
    const localLocked = showAnswerCursors ? lockedLane : null;
    const localAnswerCursor = showAnswerCursors ? answerCursor : 0;
    const localHideA = showAnswerCursors ? hideA : false;
    const localHideB = showAnswerCursors ? hideB : false;

    const flashBgPrompt: "none" | "red" | "green" =
      promptFlashRed && showAnswerCursors ? "red" : "none";
    const flashBgA: "none" | "red" | "green" =
      showAnswerCursors && answerFlashRed && localLocked !== "a"
        ? "red"
        : showAnswerCursors && answerFlashGreen && localLocked === "a"
          ? "green"
          : "none";
    const flashBgB: "none" | "red" | "green" =
      showAnswerCursors && answerFlashRed && localLocked !== "b"
        ? "red"
        : showAnswerCursors && answerFlashGreen && localLocked === "b"
          ? "green"
          : "none";

    // Answer text remaining is shown always, attached to prompt remaining.
    // The correct lane is determined by instance.correctLane (randomized each question instance).
    const aCursor = localLocked === "a" ? localAnswerCursor : 0;
    const bCursor = localLocked === "b" ? localAnswerCursor : 0;

    const aActive =
      answerActive && (localLocked === null || localLocked === "a");
    const bActive =
      answerActive && (localLocked === null || localLocked === "b");

    return (
      <Box
        sx={{
          opacity: dim ? 0.5 : 1,
          filter: dim ? "grayscale(10%)" : "none",
          transition: "opacity 150ms",
        }}
      >
        <Box
          sx={{
            p: 1,
          }}
        >
          <Box
            sx={{
              width: "fit-content",
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: { xs: 16, sm: 18 },
              lineHeight: 1.7,
              whiteSpace: "nowrap",
              color: "text.secondary",
              userSelect: "none",
            }}
          >
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "flex-start",
                gap: "1ch",
              }}
            >
              {/* Prompt (shrinks as cursor advances) */}
              <RemainingTextLine
                text={inst.prompt}
                cursor={localPromptCursor}
                active={promptActive}
                flashBg={flashBgPrompt}
              />

              {/* Answers block appended after prompt */}
              {/* Answers block appended after prompt (CONTRIBUTES WIDTH) */}
              <Box
                sx={{
                  display: "inline-flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: "0.5em",
                }}
              >
                {!localHideA && (
                  <Box sx={{ transform: "translateY(-0.15em)" }}>
                    <RemainingTextLine
                      text={inst.aText}
                      cursor={aCursor}
                      active={aActive}
                      flashBg={flashBgA}
                    />
                  </Box>
                )}

                {!localHideB && (
                  <Box sx={{ transform: "translateY(0.15em)" }}>
                    <RemainingTextLine
                      text={inst.bText}
                      cursor={bCursor}
                      active={bActive}
                      flashBg={flashBgB}
                    />
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }

  /** ---------
   *  Leaderboard UI
   *  --------- */
  const leaderboardRows = leaderboard.slice(0, CONFIG.LEADERBOARD_SIZE);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ p: 2, maxWidth: 1200, mx: "auto" }}>
        {/* Top HUD */}
        <Stack
          direction="row"
          spacing={1}
          sx={{ mb: 1 }}
          alignItems="center"
          flexWrap="wrap"
        >
          <Chip label={`🎯 Total: ${scoreTotal}`} />

          <Chip
            label={`${getMultiplierEmoji(multiplierNow)} Mult: x${multiplierNow.toFixed(2)}`}
            sx={{ fontWeight: 700, ...getMultiplierGlowSx(multiplierNow) }}
            color={
              multiplierNow >= 3
                ? "success"
                : multiplierNow >= 2
                  ? "info"
                  : "default"
            }
          />

          <Chip
            label={`${getStreakEmoji(streakCorrectQuestions)} Q-Streak: ${streakCorrectQuestions}`}
            sx={{ ...getStreakGlowSx(streakCorrectQuestions) }}
          />
          <Chip label={`⌨️ Key-Streak: ${keyStreak}`} variant="outlined" />
          <Chip label={roundProgressLabel} variant="outlined" />

          <Chip
            label={`${getRankEmoji(rankNow)} Rank: ${rankNow}`}
            sx={{ fontWeight: 700, ...getRankGlowSx(rankNow) }}
            color={
              rankNow === "Perfect"
                ? "warning"
                : rankNow === "Clean"
                  ? "info"
                  : rankNow === "Rough"
                    ? "default"
                    : "error"
            }
          />

          <Chip
            label={`❌ Round Mistakes: ${roundMistakes}`}
            variant="outlined"
          />

          <Box sx={{ flex: 1 }} />

          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              size="small"
              label="Name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              sx={{ width: 160 }}
            />
            <Typography variant="body2" color="text.secondary">
              {mode === "dark" ? "Dark" : "Light"}
            </Typography>
            <Switch
              checked={mode === "dark"}
              onChange={(e) => setMode(e.target.checked ? "dark" : "light")}
              inputProps={{ "aria-label": "Toggle dark mode" }}
            />
          </Stack>
        </Stack>

        {/* Controls */}
        <Stack
          direction="row"
          spacing={1}
          sx={{ mb: 2 }}
          alignItems="center"
          flexWrap="wrap"
        >
          <Button variant="contained" onClick={onUploadClick}>
            📄 Upload CSV
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          />

          <Button
            variant="outlined"
            onClick={() => {
              // Hard reset gameplay but keep bank
              const newSeed =
                ((Date.now() >>> 0) ^ (Math.random() * 0xffffffff)) >>> 0;
              const r = mulberry32(newSeed);

              setSeed(newSeed);
              setOrder(
                shuffle(
                  bank.map((b) => b.id),
                  r,
                ),
              );
              setPos(0);

              setCurrent(null);
              setNext(null);

              setPhase("prompt");
              setPromptCursor(0);
              setAnswerCursor(0);
              setLockedLane(null);
              setHideA(false);
              setHideB(false);
              setFirstChoiceWasCorrect(null);
              setQuestionMistakes(0);

              setRoundQuestionCount(0);
              setRoundScore(0);
              setRoundMistakes(0);
              setRoundCorrectFirstChoice(0);
              setStreakCorrectQuestions(0);
              setKeyStreak(0);
              setScoreTotal(0);

            }}
          >
            🔄 New Round
          </Button>

          <Button
            variant="text"
            color="error"
            onClick={() => {
              // Clear everything
              localStorage.removeItem(CONFIG.STORAGE_KEY);
              window.location.reload();
            }}
          >
            🧹 Clear Save
          </Button>

          <Chip label={`🏁 Round Score: ${roundScore}`} />
          <Chip
            label={`✅ First-Choice Correct: ${roundCorrectFirstChoice}`}
            variant="outlined"
          />
          <Chip
            label={`❌ This Q Mistakes: ${questionMistakes}`}
            variant="outlined"
          />
        </Stack>

        <Paper
          elevation={4}
          sx={{ p: 2, borderRadius: 3, outline: "none" }}
          tabIndex={0}
          ref={hostRef}
          onKeyDown={handleKeyDown}
          onClick={() => hostRef.current?.focus()}
        >
          <Stack spacing={2}>
            <Typography variant="h6">
              {phase === "prompt" && "Type the question"}
              {phase === "answer" && "Type the correct answer (a. or b.)"}
              {phase === "round_end" && "Round complete!"}
            </Typography>

            {/* TRACKS: current + next appended below */}
            <Box
              sx={{
                overflow: "hidden",
                borderRadius: 2,
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "2ch",
                  width: "max-content", // lets it extend off-screen to the right
                }}
              >
                {current && renderTrack(current, true, false)}
                {next && renderTrack(next, false, true)}
              </Box>
            </Box>

            <Divider />

            <Stack spacing={0.6}>
              <Typography variant="caption" color="text.secondary">
                🧠 Scoring uses: correct characters, mistakes, first-choice
                correctness, question-streak (+0.25 each), and key-streak (+0.01
                each correct key, resets on mistakes).
              </Typography>
              <Typography variant="caption" color="text.secondary">
                🎲 Questions are shuffled each round. Answers are randomized so
                the correct answer is sometimes on top (a) and sometimes on
                bottom (b).
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ⤵️ The next question is pre-generated and shown underneath the
                current one.
              </Typography>
            </Stack>
          </Stack>
        </Paper>

        {/* Leaderboard */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            🏅 Round Leaderboard (Top {CONFIG.LEADERBOARD_SIZE})
          </Typography>

          <Paper elevation={2} sx={{ p: 2, borderRadius: 3 }}>
            {leaderboardRows.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No completed rounds yet. Finish a 10-question round to post a
                score.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {leaderboardRows.map((e, i) => (
                  <Box
                    key={e.id}
                    sx={{
                      display: "flex",
                      gap: 1,
                      alignItems: "center",
                      justifyContent: "space-between",
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                      px: 1.5,
                      py: 1,
                    }}
                  >
                    <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                      <Typography sx={{ width: 26 }}>
                        {i === 0
                          ? "🥇"
                          : i === 1
                            ? "🥈"
                            : i === 2
                              ? "🥉"
                              : `#${i + 1}`}
                      </Typography>
                      <Typography sx={{ fontWeight: 700 }}>{e.name}</Typography>
                      <Chip size="small" label={`🎯 ${e.score}`} />
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`✅ ${e.correctFirstChoice}/${CONFIG.ROUND_SIZE}`}
                      />
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`❌ ${e.totalMistakes}`}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(e.endedAt).toLocaleString()}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
