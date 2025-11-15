import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Slider,
  Stack,
  Switch,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  useMediaQuery,
  Fab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
} from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

/**
 * Perfect Maze + Junction Quiz
 * - Wall bumps: animation + lockout (time only).
 * - Junctions: choose wrong exit => errors+1; choose correct exit => award points (once per question id).
 * - Must see ALL unique questions to win (optional). If not complete at exit, loads a new maze and continues.
 * - Options live in a top Accordion.
 * - Junction cells darken when their question id has been seen anywhere.
 * - CSV upload auto-regenerates a fresh maze and resets the run with the new pool.
 */

const EDGE_CROP = 6;

// ---------- Types ----------
export type Dir = "N" | "S" | "E" | "W";
const DIRS: Dir[] = ["N", "S", "E", "W"];
const OPP: Record<Dir, Dir> = { N: "S", S: "N", E: "W", W: "E" } as const;
const DELTA: Record<Dir, { dr: number; dc: number }> = {
  N: { dr: -1, dc: 0 },
  S: { dr: 1, dc: 0 },
  E: { dr: 0, dc: 1 },
  W: { dr: 0, dc: -1 },
};

type VizMode = "god" | "blind_memory" | "blind_now" | "absolute_blind";

export interface QuizQuestion {
  id: string;
  question: string;
  correct: string;
  false1: string;
  false2: string;
  false3: string;
}

export interface Cell {
  r: number;
  c: number;
  walls: Record<Dir, boolean>;
  openings: number;
  greedyDirection: Dir | null;
  quiz?: QuizQuestion;
  answerMap?: Partial<Record<Dir, string>>;
}

export interface Maze {
  rows: number;
  cols: number;
  cells: Cell[][];
  entrance: { r: number; c: number };
  exit: { r: number; c: number };
}

// ---------- Maze construction ----------
function makeGrid(rows: number, cols: number): Maze {
  const cells: Cell[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      r,
      c,
      walls: { N: true, S: true, E: true, W: true },
      openings: 0,
      greedyDirection: null,
    }))
  );
  return {
    rows,
    cols,
    cells,
    entrance: { r: 0, c: 0 },
    exit: { r: rows - 1, c: cols - 1 },
  };
}

function generatePerfectMaze(
  rows: number,
  cols: number,
  rng: () => number = Math.random
): Maze {
  const maze = makeGrid(rows, cols);
  const visited: boolean[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(false)
  );

  function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function inBounds(r: number, c: number) {
    return r >= 0 && c >= 0 && r < rows && c < cols;
  }

  function carve(r: number, c: number) {
    visited[r][c] = true;
    const order = shuffle([...DIRS]);
    for (const d of order) {
      const nr = r + DELTA[d].dr;
      const nc = c + DELTA[d].dc;
      if (!inBounds(nr, nc) || visited[nr][nc]) continue;
      maze.cells[r][c].walls[d] = false;
      maze.cells[nr][nc].walls[OPP[d]] = false;
      carve(nr, nc);
    }
  }

  carve(0, 0);

  // Entrance/Exit openings
  maze.cells[maze.entrance.r][maze.entrance.c].walls.W = false;
  maze.cells[maze.exit.r][maze.exit.c].walls.E = false;

  // openings count
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = maze.cells[r][c];
      cell.openings = DIRS.reduce((acc, d) => acc + (cell.walls[d] ? 0 : 1), 0);
    }
  }

  return maze;
}

function neighbors(
  maze: Maze,
  r: number,
  c: number
): { r: number; c: number; dir: Dir }[] {
  const out: { r: number; c: number; dir: Dir }[] = [];
  for (const d of DIRS) {
    if (!maze.cells[r][c].walls[d]) {
      const nr = r + DELTA[d].dr;
      const nc = c + DELTA[d].dc;
      if (nr >= 0 && nc >= 0 && nr < maze.rows && nc < maze.cols) {
        out.push({ r: nr, c: nc, dir: d });
      }
    }
  }
  return out;
}

function distanceMapToExitFixed(maze: Maze): number[][] {
  const dist = Array.from({ length: maze.rows }, () =>
    Array(maze.cols).fill(Infinity)
  );
  const q: Array<{ r: number; c: number }> = [];
  const { r: er, c: ec } = maze.exit;
  dist[er][ec] = 0;
  q.push({ r: er, c: ec });
  while (q.length) {
    const cur = q.shift()!;
    for (const nb of neighbors(maze, cur.r, cur.c)) {
      if (dist[nb.r][nb.c] > dist[cur.r][cur.c] + 1) {
        dist[nb.r][nb.c] = dist[cur.r][cur.c] + 1;
        q.push({ r: nb.r, c: nb.c });
      }
    }
  }
  return dist;
}

function assignGreedyDirections(maze: Maze) {
  const dist = distanceMapToExitFixed(maze);
  for (let r = 0; r < maze.rows; r++) {
    for (let c = 0; c < maze.cols; c++) {
      let best: { dir: Dir; val: number } | null = null;
      for (const nb of neighbors(maze, r, c)) {
        const d = dist[nb.r][nb.c];
        if (!Number.isFinite(d)) continue;
        if (!best || d < best.val) best = { dir: nb.dir, val: d };
      }
      maze.cells[r][c].greedyDirection = best ? best.dir : null;
    }
  }
}

export function shortestPathFrom(
  maze: Maze,
  start: { r: number; c: number }
): { r: number; c: number }[] {
  const prev = Array.from(
    { length: maze.rows },
    () => Array(maze.cols).fill(null) as (null | { r: number; c: number })[]
  );
  const seen = Array.from({ length: maze.rows }, () =>
    Array(maze.cols).fill(false)
  );
  const q: Array<{ r: number; c: number }> = [];
  q.push(start);
  seen[start.r][start.c] = true;
  while (q.length) {
    const cur = q.shift()!;
    if (cur.r === maze.exit.r && cur.c === maze.exit.c) break;
    for (const nb of neighbors(maze, cur.r, cur.c)) {
      if (!seen[nb.r][nb.c]) {
        seen[nb.r][nb.c] = true;
        prev[nb.r][nb.c] = cur;
        q.push({ r: nb.r, c: nb.c });
      }
    }
  }
  const path: { r: number; c: number }[] = [];
  let cur: { r: number; c: number } | null = { r: maze.exit.r, c: maze.exit.c };
  while (cur) {
    path.push(cur);
    const p = prev[cur.r][cur.c];
    cur = p as any;
  }
  path.reverse();
  if (!(path[0]?.r === start.r && path[0]?.c === start.c)) return [];
  return path;
}

export function findHighDegreeCells(
  maze: Maze
): { r: number; c: number; openings: number }[] {
  const out: { r: number; c: number; openings: number }[] = [];
  for (let r = 0; r < maze.rows; r++) {
    for (let c = 0; c < maze.cols; c++) {
      const cell = maze.cells[r][c];
      if (cell.openings > 2) out.push({ r, c, openings: cell.openings });
    }
  }
  return out;
}

// ---------- Quiz helpers ----------
const SAMPLE_QUIZ: QuizQuestion[] = [
  {
    id: "1",
    question: "What does CPU stand for?",
    correct: "Central Processing Unit",
    false1: "Computer Primary Utility",
    false2: "Control Program Unit",
    false3: "Central Peripheral Unit",
  },
  {
    id: "2",
    question: "Which number system is base-2?",
    correct: "Binary",
    false1: "Decimal",
    false2: "Hexadecimal",
    false3: "Octal",
  },
  {
    id: "3",
    question: "What does RAM provide for a computer?",
    correct: "Temporary working memory",
    false1: "Permanent storage",
    false2: "Graphics rendering",
    false3: "Network connectivity",
  },
  {
    id: "4",
    question: "Which algorithm has average O(n log n) time?",
    correct: "Merge sort",
    false1: "Bubble sort",
    false2: "Linear search",
    false3: "Selection sort",
  },
  {
    id: "5",
    question: "What is the purpose of an if-statement?",
    correct: "Make a decision based on a condition",
    false1: "Repeat code a fixed number of times",
    false2: "Store multiple values",
    false3: "Convert data types",
  },
  {
    id: "6",
    question: "Which data structure uses FIFO order?",
    correct: "Queue",
    false1: "Stack",
    false2: "Tree",
    false3: "Hash map",
  },
  {
    id: "7",
    question:
      "Which Boolean operator returns true only if both inputs are true?",
    correct: "AND",
    false1: "OR",
    false2: "XOR",
    false3: "NOT",
  },
  {
    id: "8",
    question: "What does HTML stand for?",
    correct: "HyperText Markup Language",
    false1: "High Tech Machine Language",
    false2: "Hyperlink Transfer Method",
    false3: "Home Tool Markup List",
  },
  {
    id: "9",
    question: "Which device stores data even when powered off?",
    correct: "SSD",
    false1: "RAM",
    false2: "Cache",
    false3: "Register",
  },
  {
    id: "10",
    question: "Which protocol secures HTTP traffic?",
    correct: "TLS",
    false1: "FTP",
    false2: "SMTP",
    false3: "UDP",
  },
];

function parseCSV(text: string): QuizQuestion[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const out: QuizQuestion[] = [];
  for (const line of lines) {
    const cells: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (ch === "," && !inQ) {
        cells.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    if (cells.length < 6) continue;
    const [id, question, correct, f1, f2, f3] = cells;
    out.push({ id, question, correct, false1: f1, false2: f2, false3: f3 });
  }
  return out;
}

function attachQuestionsToJunctions(maze: Maze, pool: QuizQuestion[]) {
  for (let r = 0; r < maze.rows; r++)
    for (let c = 0; c < maze.cols; c++) {
      delete maze.cells[r][c].quiz;
      delete maze.cells[r][c].answerMap;
    }
  const junctions = findHighDegreeCells(maze);
  if (!junctions.length || !pool.length) return;
  let qi = 0;
  for (const j of junctions) {
    const cell = maze.cells[j.r][j.c];
    const q = pool[qi % pool.length];
    qi++;
    cell.quiz = q;
    const openDirs = DIRS.filter((d) => !cell.walls[d]);
    const map: Partial<Record<Dir, string>> = {};
    const greedy =
      cell.greedyDirection && openDirs.includes(cell.greedyDirection)
        ? cell.greedyDirection
        : openDirs[0];
    map[greedy] = q.correct;
    const wrongs = [q.false1, q.false2, q.false3].filter(Boolean);
    let wi = 0;
    for (const d of openDirs) {
      if (d === greedy) continue;
      map[d] = wrongs[wi % wrongs.length];
      wi++;
    }
    cell.answerMap = map;
  }
}

// ---------- Rotation helpers ----------
function worldToScreenDir(world: Dir, facing: Dir): Dir {
  if (facing === "N") return world;
  if (facing === "E")
    return ({ E: "N", S: "E", W: "S", N: "W" } as Record<Dir, Dir>)[world];
  if (facing === "S")
    return ({ S: "N", W: "E", N: "S", E: "W" } as Record<Dir, Dir>)[world];
  return ({ W: "N", N: "E", E: "S", S: "W" } as Record<Dir, Dir>)[world];
}

function rotateOffsetToWorld(
  drS: number,
  dcS: number,
  facing: Dir
): { dr: number; dc: number } {
  if (facing === "N") return { dr: drS, dc: dcS };
  if (facing === "E") return { dr: dcS, dc: -drS };
  if (facing === "S") return { dr: -drS, dc: -dcS };
  return { dr: -dcS, dc: drS };
}

function rotateWallsToScreen(
  walls: Record<Dir, boolean>,
  facing: Dir
): Record<Dir, boolean> {
  const out: Record<Dir, boolean> = { N: true, E: true, S: true, W: true };
  (["N", "E", "S", "W"] as Dir[]).forEach((world) => {
    const screen = worldToScreenDir(world, facing);
    out[screen] = walls[world];
  });
  return out;
}

// ---------- UI ----------
type GridPoint = { r: number; c: number };
const cellPx = 56;
const PANEL_WIDTH = 460;
const PANEL_GAP = 32;

const keyRC = (r: number, c: number) => `${r},${c}`;

function computeRayVisible(
  maze: Maze,
  at: { r: number; c: number }
): Set<string> {
  const vis = new Set<string>();
  const here = maze.cells[at.r][at.c];
  vis.add(keyRC(at.r, at.c));
  for (const d of DIRS) {
    if (here.walls[d]) continue;
    let r = at.r,
      c = at.c;
    while (true) {
      const nr = r + DELTA[d].dr;
      const nc = c + DELTA[d].dc;
      if (nr < 0 || nc < 0 || nr >= maze.rows || nc >= maze.cols) break;
      const curCell = maze.cells[r][c];
      if (curCell.walls[d]) break;
      r = nr;
      c = nc;
      vis.add(keyRC(r, c));
      if (maze.cells[r][c].walls[d]) break;
    }
  }
  return vis;
}

function computeAbsoluteBlind(
  maze: Maze,
  at: { r: number; c: number },
  facing: Dir
): Set<string> {
  const vis = new Set<string>();
  vis.add(keyRC(at.r, at.c));
  const cell = maze.cells[at.r][at.c];
  if (!cell.walls[facing]) {
    const nr = at.r + DELTA[facing].dr;
    const nc = at.c + DELTA[facing].dc;
    if (nr >= 0 && nc >= 0 && nr < maze.rows && nc < maze.cols)
      vis.add(keyRC(nr, nc));
  }
  return vis;
}

export default function MazeQuizApp() {
  // ===== Maze & UI state =====
  const [rows, setRows] = useState(15);
  const [cols, setCols] = useState(25);
  const [showGreedy, setShowGreedy] = useState(false);
  const [vizMode, setVizMode] = useState<VizMode>("god");
  const [viewRadius, setViewRadius] = useState<number>(1); // default zoom = 1

  // ===== Scoring variables =====
  const [baseScore, setBaseScore] = useState<number>(1000);
  const [uniqueQWeight, setUniqueQWeight] = useState<number>(20);
  const [pathLenWeight, setPathLenWeight] = useState<number>(10);
  const [wrongMovePenalty, setWrongMovePenalty] = useState<number>(50);
  const [timePenaltyPerSec, setTimePenaltyPerSec] = useState<number>(5); // default time penalty = 5/sec
  const [correctReward, setCorrectReward] = useState<number>(25); // NEW: per-correct question reward
  const [clampScoreAtZero, setClampScoreAtZero] = useState<boolean>(true);

  // ===== Collision animation config =====
  const [wallPenaltyMs, setWallPenaltyMs] = useState<number>(1000);

  // ===== Progression option: must see all questions to win =====
  const [requireAllQuestions, setRequireAllQuestions] = useState<boolean>(true);

  // ===== Maze model =====
  const [quizPool, setQuizPool] = useState<QuizQuestion[]>(SAMPLE_QUIZ);
  const [maze, setMaze] = useState<Maze>(() => {
    const m = generatePerfectMaze(15, 25);
    assignGreedyDirections(m);
    attachQuestionsToJunctions(m, SAMPLE_QUIZ);
    return m;
  });

  const [player, setPlayer] = useState<GridPoint>({ r: 0, c: 0 });
  const [facing, setFacing] = useState<Dir>("N");
  const [pathHighlight, setPathHighlight] = useState<GridPoint[]>([]);
  const [winOpen, setWinOpen] = useState(false);

  // Timer & scoring tracking
  // questionIdsSeen persists across mazes until win or reset
  const [questionIdsSeen, setQuestionIdsSeen] = useState<Set<string>>(
    new Set()
  );
  // NEW: unique questions correctly answered (credited once per question id)
  const [correctQuestionIds, setCorrectQuestionIds] = useState<Set<string>>(
    new Set()
  );

  const [hasStarted, setHasStarted] = useState(false);
  const [startTs, setStartTs] = useState<number | null>(null);
  const [nowTs, setNowTs] = useState<number>(Date.now());
  const [endTs, setEndTs] = useState<number | null>(null);
  const [shortestLenFromStart, setShortestLenFromStart] = useState<number>(0);
  const [wrongMoves, setWrongMoves] = useState(0); // only increments on wrong junction choice
  const [mazeCount, setMazeCount] = useState(1);

  const [explored, setExplored] = useState<Set<string>>(() => new Set());
  const isMobile = useMediaQuery("(max-width:900px)");
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const highDegree = useMemo(() => findHighDegreeCells(maze), [maze]);
  const currentCell = maze.cells[player.r][player.c];

  const totalUniqueQuestions = useMemo(
    () => new Set(quizPool.map((q) => q.id)).size,
    [quizPool]
  );

  // Initialize explored on maze set
  useEffect(() => {
    const start = { r: maze.entrance.r, c: maze.entrance.c };
    setExplored(computeRayVisible(maze, start));
  }, [maze]);

  // Mark question seen when standing on a junction that holds a question
  useEffect(() => {
    if (currentCell.openings > 2 && currentCell.quiz?.id) {
      setQuestionIdsSeen((prev) => {
        if (prev.has(currentCell.quiz!.id)) return prev;
        const next = new Set(prev);
        next.add(currentCell.quiz!.id);
        return next;
      });
    }
  }, [currentCell]);

  // Timer tick + elapsed
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const endOrNow = endTs ?? nowTs;
  const elapsedMs = hasStarted && startTs ? Math.max(0, endOrNow - startTs) : 0;
  const timeStr = new Date(elapsedMs).toISOString().substring(14, 19);
  const timeSec = Math.round(elapsedMs / 1000);
  const uniqueQ = questionIdsSeen.size;
  const correctUniqueQ = correctQuestionIds.size;

  // INITIAL shortest path from the start (of the current maze)
  useEffect(() => {
    const start = { r: maze.entrance.r, c: maze.entrance.c };
    const sp = shortestPathFrom(maze, start);
    setShortestLenFromStart(sp.length);
  }, [maze]);

  // Score with customizable weights + correct reward
  const rawScore =
    baseScore +
    uniqueQ * uniqueQWeight +
    shortestLenFromStart * pathLenWeight +
    correctUniqueQ * correctReward - // NEW: reward for unique correct answers
    wrongMoves * wrongMovePenalty -
    timeSec * timePenaltyPerSec;

  const liveScore = clampScoreAtZero ? Math.max(0, rawScore) : rawScore;
  const finalScore = liveScore;

  // Helpers to start a brand-new run or just advance to another maze
  const hardResetRun = useCallback(() => {
    const m = generatePerfectMaze(rows, cols);
    assignGreedyDirections(m);
    attachQuestionsToJunctions(m, quizPool);
    setMaze(m);
    setExplored(computeRayVisible(m, { r: m.entrance.r, c: m.entrance.c }));
    setPlayer({ r: m.entrance.r, c: m.entrance.c });
    setFacing("N");
    setPathHighlight([]);
    setWinOpen(false);
    setQuestionIdsSeen(new Set());
    setCorrectQuestionIds(new Set());
    setHasStarted(false);
    setStartTs(null);
    setEndTs(null);
    setWrongMoves(0);
    setMazeCount(1);
    setBump(null);
  }, [rows, cols, quizPool]);

  const advanceMaze = useCallback(() => {
    const m = generatePerfectMaze(rows, cols);
    assignGreedyDirections(m);
    attachQuestionsToJunctions(m, quizPool);
    setMaze(m);
    setExplored(computeRayVisible(m, { r: m.entrance.r, c: m.entrance.c }));
    setPlayer({ r: m.entrance.r, c: m.entrance.c });
    setFacing("N");
    setPathHighlight([]);
    setWinOpen(false);
    setEndTs(null);
    setMazeCount((n) => n + 1);
    setBump(null);
  }, [rows, cols, quizPool]);

  // Manual regenerate (keeps progress)
  const regenerate = useCallback(() => {
    advanceMaze();
  }, [advanceMaze]);

  // Click-to-highlight
  const onCellClick = (r: number, c: number) => {
    setPathHighlight(shortestPathFrom(maze, { r, c }));
  };

  // Rotation helpers
  const turnCW = (d: Dir): Dir =>
    (({ N: "E", E: "S", S: "W", W: "N" } as Record<Dir, Dir>)[d]);
  const turnCCW = (d: Dir): Dir =>
    (({ N: "W", W: "S", S: "E", E: "N" } as Record<Dir, Dir>)[d]);
  const turn180 = (d: Dir): Dir =>
    (({ N: "S", S: "N", E: "W", W: "E" } as Record<Dir, Dir>)[d]);

  // ---- BUMP (collision) animation & lockout ----
  type Bump = { start: number; screenDir: Dir };
  const [bump, setBump] = useState<Bump | null>(null);
  const [animNow, setAnimNow] = useState<number>(0);

  // Drive animation while active (RAF loop)
  useEffect(() => {
    let raf: number | null = null;
    const step = () => {
      setAnimNow(performance.now());
      raf = requestAnimationFrame(step);
    };
    if (bump) {
      raf = requestAnimationFrame(step);
    }
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [bump]);

  // Auto-clear bump after wallPenaltyMs total
  useEffect(() => {
    if (!bump) return;
    const id = setTimeout(() => setBump(null), wallPenaltyMs);
    return () => clearTimeout(id);
  }, [bump, wallPenaltyMs]);

  // Movement blocked while bump is active
  const controlsLocked = !!bump;

  // Move forward one cell in given world direction
  const moveForwardWorld = useCallback(
    (dir: Dir) => {
      if (controlsLocked) return;

      const { r, c } = player;
      const here = maze.cells[r][c];

      // COLLISION: bump if wall blocks the move (no error added)
      if (here.walls[dir]) {
        const screenDir = worldToScreenDir(dir, facing);
        setBump({ start: performance.now(), screenDir });
        return;
      }

      // Determine junction correctness BEFORE moving
      if (here.openings > 2 && here.quiz && here.answerMap) {
        const ansLabel = here.answerMap[dir];
        if (typeof ansLabel === "string") {
          if (ansLabel === here.quiz.correct) {
            // correct: award once per question id
            setCorrectQuestionIds((prev) => {
              if (prev.has(here.quiz!.id)) return prev;
              const next = new Set(prev);
              next.add(here.quiz!.id);
              return next;
            });
          } else {
            // wrong: increment errors
            setWrongMoves((x) => x + 1);
          }
        }
      }

      // Normal movement
      const nr = r + DELTA[dir].dr;
      const nc = c + DELTA[dir].dc;
      if (nr < 0 || nc < 0 || nr >= maze.rows || nc >= maze.cols) return;

      const next = { r: nr, c: nc };
      setPlayer(next);

      if (vizMode === "blind_memory") {
        const v = computeRayVisible(maze, next);
        setExplored((prev) => {
          const merged = new Set(prev);
          v.forEach((x) => merged.add(x));
          return merged;
        });
      }

      setFacing(dir);
      setPathHighlight([]);

      if (!hasStarted) {
        setHasStarted(true);
        setStartTs(Date.now());
      }

      // Check for exit
      if (next.r === maze.exit.r && next.c === maze.exit.c) {
        if (
          !requireAllQuestions ||
          questionIdsSeen.size >= totalUniqueQuestions
        ) {
          setEndTs(Date.now());
          setWinOpen(true);
        } else {
          advanceMaze();
        }
      }
    },
    [
      player,
      maze,
      vizMode,
      facing,
      hasStarted,
      controlsLocked,
      requireAllQuestions,
      questionIdsSeen.size,
      totalUniqueQuestions,
      advanceMaze,
    ]
  );

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (controlsLocked) return;

      const k = e.key.toLowerCase();

      if (["w", "arrowup"].includes(k)) {
        e.preventDefault();
        moveForwardWorld(facing);
        return;
      }

      if (["a", "arrowleft"].includes(k)) {
        e.preventDefault();
        setFacing((f) => turnCCW(f));
        return;
      }

      if (["d", "arrowright"].includes(k)) {
        e.preventDefault();
        setFacing((f) => turnCW(f));
        return;
      }

      if (["s", "arrowdown"].includes(k)) {
        e.preventDefault();
        setFacing((f) => turn180(f));
        return;
      }

      if (k === "escape") {
        e.preventDefault();
        setPathHighlight([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moveForwardWorld, facing, controlsLocked]);

  const nowRays = useMemo(
    () => computeRayVisible(maze, player),
    [maze, player]
  );
  const absNow = useMemo(
    () => computeAbsoluteBlind(maze, player, facing),
    [maze, player, facing]
  );

  // Swipe
  const onTouchStart = (e: React.TouchEvent) => {
    if (controlsLocked) return;
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (controlsLocked) return;
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    const TH = 24;
    if (Math.abs(dx) < TH && Math.abs(dy) < TH) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) setFacing((f) => turnCW(f));
      else setFacing((f) => turnCCW(f));
    } else {
      if (dy > 0) setFacing((f) => turn180(f));
      else moveForwardWorld(facing);
    }
  };

  // CSV upload — auto regenerate maze & reset run using the new pool
  const onCsvUpload = async (file: File) => {
    const text = await file.text();
    const parsed = parseCSV(text);
    if (!parsed.length) return;

    setQuizPool(parsed);

    // Build a new maze immediately with the parsed pool, and reset the run.
    const m = generatePerfectMaze(rows, cols);
    assignGreedyDirections(m);
    attachQuestionsToJunctions(m, parsed);

    setMaze(m);
    setExplored(computeRayVisible(m, { r: m.entrance.r, c: m.entrance.c }));
    setPlayer({ r: m.entrance.r, c: m.entrance.c });
    setFacing("N");
    setPathHighlight([]);
    setWinOpen(false);
    setQuestionIdsSeen(new Set());
    setCorrectQuestionIds(new Set());
    setHasStarted(false);
    setStartTs(null);
    setEndTs(null);
    setWrongMoves(0);
    setMazeCount(1);
    setBump(null);
  };

  // ------- RENDER -------
  const windowSize = 2 * viewRadius + 1;

  // Helper: bump transform & color
  function playerBumpStyle(): {
    transform: string;
    transition: string;
    background: string;
  } {
    const base = {
      transform: "translate(0px, 0px)",
      transition: "transform 0ms linear, background-color 0ms linear",
      background: "#1e88e5",
    };
    if (!bump) return base;

    const total = Math.max(100, wallPenaltyMs);
    const forwardMs = Math.max(50, Math.round(total * 0.2));
    const backMs = Math.max(50, total - forwardMs);
    const maxOffset = 14;
    const elapsed = Math.max(0, animNow - bump.start);

    if (elapsed <= forwardMs) {
      const t = Math.min(1, elapsed / forwardMs);
      const d = maxOffset * (1 - (1 - t) * (1 - t));
      const { x, y } = offsetForDir(bump.screenDir, d);
      return {
        transform: `translate(${x}px, ${y}px)`,
        transition: "transform 16ms linear, background-color 16ms linear",
        background: "#e53935",
      };
    }

    const backElapsed = Math.min(backMs, elapsed - forwardMs);
    const t = backElapsed / backMs;
    const d = maxOffset * (1 - t * t);
    const { x, y } = offsetForDir(bump.screenDir, d);
    return {
      transform: `translate(${x}px, ${y}px)`,
      transition: "transform 16ms linear, background-color 16ms linear",
      background: "#1e88e5",
    };
  }

  function offsetForDir(
    screenDir: Dir,
    dist: number
  ): { x: number; y: number } {
    switch (screenDir) {
      case "N":
        return { x: 0, y: -dist };
      case "S":
        return { x: 0, y: dist };
      case "E":
        return { x: dist, y: 0 };
      case "W":
        return { x: -dist, y: 0 };
    }
  }

  return (
    <Stack spacing={2} sx={{ p: { xs: 1, md: 2 }, width: "100%" }}>
      {/* Header with metrics */}
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={1}
        alignItems={{ xs: "flex-start", lg: "center" }}
        justifyContent="space-between"
      >
        <Typography variant="h5">Perfect Maze + Junction Quiz</Typography>

        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Typography variant="body2">⏱ {timeStr}</Typography>
          <Typography variant="body2">❌ {wrongMoves}</Typography>
          <Typography variant="body2">
            🧩 {questionIdsSeen.size}/{totalUniqueQuestions}
          </Typography>
          <Typography variant="body2">✅ {correctQuestionIds.size}</Typography>
          <Typography variant="body2">🧭 Mazes: {mazeCount}</Typography>
          <Typography variant="body2">
            📏 Shortest (this maze): {shortestLenFromStart}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            🏆 {liveScore}
          </Typography>
        </Stack>
      </Stack>

      {/* OPTIONS ACCORDION */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">Options</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            {/* Scoring */}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  Scoring
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <Stack sx={{ minWidth: 220, flex: 1 }}>
                    <Typography gutterBottom>
                      Base Score: {baseScore}
                    </Typography>
                    <Slider
                      min={0}
                      max={5000}
                      step={50}
                      value={baseScore}
                      onChange={(_, v) => setBaseScore(v as number)}
                    />
                  </Stack>
                  <Stack sx={{ minWidth: 220, flex: 1 }}>
                    <Typography gutterBottom>
                      Unique Q Weight: {uniqueQWeight}
                    </Typography>
                    <Slider
                      min={-100}
                      max={200}
                      step={1}
                      value={uniqueQWeight}
                      onChange={(_, v) => setUniqueQWeight(v as number)}
                    />
                  </Stack>
                  <Stack sx={{ minWidth: 220, flex: 1 }}>
                    <Typography gutterBottom>
                      Path Length Weight: {pathLenWeight}
                    </Typography>
                    <Slider
                      min={-100}
                      max={200}
                      step={1}
                      value={pathLenWeight}
                      onChange={(_, v) => setPathLenWeight(v as number)}
                    />
                  </Stack>
                </Stack>

                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={2}
                  sx={{ mt: 2 }}
                >
                  <Stack sx={{ minWidth: 220, flex: 1 }}>
                    <Typography gutterBottom>
                      Wrong Move Penalty: {wrongMovePenalty}
                    </Typography>
                    <Slider
                      min={0}
                      max={200}
                      step={1}
                      value={wrongMovePenalty}
                      onChange={(_, v) => setWrongMovePenalty(v as number)}
                    />
                  </Stack>
                  <Stack sx={{ minWidth: 220, flex: 1 }}>
                    <Typography gutterBottom>
                      Time Penalty / sec: {timePenaltyPerSec}
                    </Typography>
                    <Slider
                      min={0}
                      max={10}
                      step={0.5}
                      value={timePenaltyPerSec}
                      onChange={(_, v) => setTimePenaltyPerSec(v as number)}
                    />
                  </Stack>
                  <Stack sx={{ minWidth: 220, flex: 1 }}>
                    <Typography gutterBottom>
                      Points per correct question: {correctReward}
                    </Typography>
                    <Slider
                      min={0}
                      max={200}
                      step={1}
                      value={correctReward}
                      onChange={(_, v) => setCorrectReward(v as number)}
                    />
                  </Stack>
                  <Stack sx={{ minWidth: 220, justifyContent: "center" }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={clampScoreAtZero}
                          onChange={(e) =>
                            setClampScoreAtZero(e.target.checked)
                          }
                        />
                      }
                      label="Clamp score at 0"
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setBaseScore(1000);
                        setUniqueQWeight(20);
                        setPathLenWeight(10);
                        setWrongMovePenalty(50);
                        setTimePenaltyPerSec(5);
                        setCorrectReward(25);
                        setClampScoreAtZero(true);
                      }}
                      sx={{ mt: 1 }}
                    >
                      Reset scoring
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            {/* Gameplay / View */}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  Gameplay & View
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack
                  direction={{ xs: "column", xl: "row" }}
                  spacing={2}
                  alignItems={{ xs: "stretch", xl: "center" }}
                >
                  <Stack sx={{ minWidth: 180, flex: 1 }}>
                    <Typography gutterBottom>Rows: {rows}</Typography>
                    <Slider
                      min={5}
                      max={50}
                      value={rows}
                      onChange={(_, v) => setRows(v as number)}
                    />
                  </Stack>
                  <Stack sx={{ minWidth: 180, flex: 1 }}>
                    <Typography gutterBottom>Cols: {cols}</Typography>
                    <Slider
                      min={5}
                      max={70}
                      value={cols}
                      onChange={(_, v) => setCols(v as number)}
                    />
                  </Stack>
                  <Stack sx={{ minWidth: 220, flex: 1 }}>
                    <Typography gutterBottom>
                      Zoom (view radius): {viewRadius}
                    </Typography>
                    <Slider
                      min={1}
                      max={8}
                      step={1}
                      value={viewRadius}
                      onChange={(_, v) => setViewRadius(v as number)}
                    />
                  </Stack>
                  <Stack sx={{ minWidth: 220, flex: 1 }}>
                    <Typography gutterBottom>
                      Wall hit penalty (ms): {wallPenaltyMs}
                    </Typography>
                    <Slider
                      min={200}
                      max={3000}
                      step={50}
                      value={wallPenaltyMs}
                      onChange={(_, v) => setWallPenaltyMs(v as number)}
                    />
                  </Stack>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showGreedy}
                        onChange={(e) => setShowGreedy(e.target.checked)}
                      />
                    }
                    label="Show greedy arrow"
                  />
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={vizMode}
                    onChange={(_, v) => v && setVizMode(v)}
                  >
                    <ToggleButton value="god">God</ToggleButton>
                    <ToggleButton value="blind_memory">
                      Blind+Memory
                    </ToggleButton>
                    <ToggleButton value="blind_now">Blind</ToggleButton>
                    <ToggleButton value="absolute_blind">Absolute</ToggleButton>
                  </ToggleButtonGroup>
                </Stack>

                <Stack
                  direction="row"
                  spacing={2}
                  sx={{ mt: 2 }}
                  alignItems="center"
                  flexWrap="wrap"
                >
                  <Button variant="contained" onClick={regenerate}>
                    Regenerate Maze (keep progress)
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => setPathHighlight([])}
                  >
                    Clear Highlight
                  </Button>
                  <label>
                    <input
                      type="file"
                      accept=".csv"
                      style={{ display: "none" }}
                      onChange={(e) =>
                        e.target.files && onCsvUpload(e.target.files[0])
                      }
                    />
                    <Button variant="outlined" component="span">
                      Upload CSV
                    </Button>
                  </label>
                </Stack>
              </CardContent>
            </Card>

            {/* Progression controls */}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  Progression
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  alignItems="center"
                >
                  <FormControlLabel
                    control={
                      <Switch
                        checked={requireAllQuestions}
                        onChange={(e) =>
                          setRequireAllQuestions(e.target.checked)
                        }
                      />
                    }
                    label="Require all questions to win"
                  />
                  <Typography variant="body2" color="text.secondary">
                    Progress: {questionIdsSeen.size} / {totalUniqueQuestions}{" "}
                    unique seen
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={hardResetRun}
                  >
                    Reset Run (clear progress & timer)
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Main content area — radius view + quiz panel */}
      <div style={{ position: "relative", width: "100%" }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems="flex-start"
        >
          {/* Radius Maze View */}
          <Card variant="outlined" sx={{ width: "max-content" }}>
            <CardContent>
              <Typography
                variant="subtitle1"
                gutterBottom
                sx={{ whiteSpace: "pre-line" }}
              >
                {isMobile
                  ? "Swipe: Up=forward, Left/Right/Down=turn. Tap a cell to show its fastest path."
                  : "W/↑=forward. A/D/←/→=turn left/right. S/↓=turn around.\nClick any cell to highlight its fastest path to the exit."}
                {controlsLocked ? "\n(Hit a wall — controls locked)" : ""}
              </Typography>

              <div
                style={{
                  position: "relative",
                  overflow: "hidden",
                  width: windowSize * cellPx - EDGE_CROP * 2,
                  height: windowSize * cellPx - EDGE_CROP * 2,
                  borderRadius: 4, // optional, looks nice; remove if you want sharp edges
                }}
              >
                {/* Offset the actual grid outwards so edges are hidden */}
                <div
                  onTouchStart={onTouchStart}
                  onTouchEnd={onTouchEnd}
                  style={{
                    position: "absolute",
                    left: -EDGE_CROP,
                    top: -EDGE_CROP,
                    display: "grid",
                    gridTemplateColumns: `repeat(${windowSize}, ${cellPx}px)`,
                    gridAutoRows: `${cellPx}px`,
                    gap: 0,
                    userSelect: "none",
                    width: windowSize * cellPx + EDGE_CROP * 2,
                    height: windowSize * cellPx + EDGE_CROP * 2,
                    filter: controlsLocked ? "grayscale(0.2)" : undefined,
                  }}
                >
                  {Array.from(
                    { length: windowSize },
                    (_, i) => i - viewRadius
                  ).map((sr) =>
                    Array.from(
                      { length: windowSize },
                      (_, j) => j - viewRadius
                    ).map((sc) => {
                      const off = rotateOffsetToWorld(sr, sc, facing);
                      const wr = player.r + off.dr;
                      const wc = player.c + off.dc;

                      if (
                        wr < 0 ||
                        wc < 0 ||
                        wr >= maze.rows ||
                        wc >= maze.cols
                      ) {
                        return (
                          <div
                            key={`${sr},${sc}`}
                            style={{
                              width: cellPx,
                              height: cellPx,
                              background: "#111",
                              border: "2px solid #111",
                            }}
                          />
                        );
                      }

                      const cell = maze.cells[wr][wc];
                      const isPlayerHere = sr === 0 && sc === 0;
                      const isExit = wr === maze.exit.r && wc === maze.exit.c;
                      const isEntrance =
                        wr === maze.entrance.r && wc === maze.entrance.c;
                      const hl = pathHighlight.some(
                        (p) => p.r === wr && p.c === wc
                      );

                      const k = `${wr},${wc}`;
                      let visible = true;
                      switch (vizMode) {
                        case "god":
                          visible = true;
                          break;
                        case "blind_now":
                          visible = nowRays.has(k);
                          break;
                        case "blind_memory":
                          visible = explored.has(k);
                          break;
                        case "absolute_blind":
                          visible = absNow.has(k);
                          break;
                      }

                      const w = rotateWallsToScreen(cell.walls, facing);

                      // Junction color depends on whether that question id is seen
                      const isJunction = cell.openings > 2;
                      const qId = cell.quiz?.id;
                      const seenThisQ = qId ? questionIdsSeen.has(qId) : false;
                      const junctionBg = seenThisQ
                        ? "#ffd54f" /* darker yellow-orange */
                        : "#fff9c4"; /* light yellow */
                      const wallColor = visible ? "#111" : "#222";
                      const bg = visible
                        ? hl
                          ? "#a5d6a7"
                          : isEntrance
                          ? "#bbdefb"
                          : isExit
                          ? "#ffcdd2"
                          : isJunction
                          ? junctionBg
                          : "#fafafa"
                        : "#0a0a0a";

                      return (
                        <div
                          key={`${sr},${sc}`}
                          onClick={() => onCellClick(wr, wc)}
                          title={
                            visible
                              ? `(${wr},${wc}) openings:${cell.openings}${
                                  qId
                                    ? ` • Q:${qId}${seenThisQ ? " (seen)" : ""}`
                                    : ""
                                }`
                              : undefined
                          }
                          style={{
                            width: cellPx,
                            height: cellPx,
                            boxSizing: "border-box",
                            borderTop: w.N
                              ? `2px solid ${wallColor}`
                              : "2px solid transparent",
                            borderBottom: w.S
                              ? `2px solid ${wallColor}`
                              : "2px solid transparent",
                            borderLeft: w.W
                              ? `2px solid ${wallColor}`
                              : "2px solid transparent",
                            borderRight: w.E
                              ? `2px solid ${wallColor}`
                              : "2px solid transparent",
                            background: isPlayerHere ? "#e3f2fd" : bg,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            position: "relative",
                            cursor: "pointer",
                            transition:
                              "background 160ms, border-color 120ms, opacity 120ms",
                            opacity: visible ? 1 : 0.95,
                          }}
                        >
                          {/* Player dot (with bump animation) */}
                          {isPlayerHere && (
                            <div
                              style={{
                                position: "absolute",
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                                ...playerBumpStyle(),
                              }}
                            />
                          )}

                          {showGreedy && cell.greedyDirection && visible && (
                            <span
                              style={{ opacity: 0.7, fontSize: 14, zIndex: 1 }}
                            >
                              {worldToScreenDir(
                                cell.greedyDirection,
                                facing
                              ) === "N" && "↑"}
                              {worldToScreenDir(
                                cell.greedyDirection,
                                facing
                              ) === "S" && "↓"}
                              {worldToScreenDir(
                                cell.greedyDirection,
                                facing
                              ) === "E" && "→"}
                              {worldToScreenDir(
                                cell.greedyDirection,
                                facing
                              ) === "W" && "←"}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quiz Panel (read-only) */}
          <Card
            variant="outlined"
            sx={{
              width: { xs: "100%", md: PANEL_WIDTH },
              mt: { xs: 2, md: 0 },
              ml: { md: `${PANEL_GAP}px` },
            }}
          >
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Junction Quiz
              </Typography>
              <QuizReadOnly currentCell={currentCell} facing={facing} />
              <StatsBlock
                player={player}
                maze={maze}
                highDegreeCount={highDegree.length}
                onHighlight={() =>
                  setPathHighlight(shortestPathFrom(maze, player))
                }
              />
            </CardContent>
          </Card>
        </Stack>
      </div>

      {/* Mobile D-pad */}
      {isMobile && (
        <div
          style={{
            position: "fixed",
            right: 12,
            bottom: 12,
            display: "grid",
            gridTemplateColumns: "56px 56px 56px",
            gridTemplateRows: "56px 56px 56px",
            gap: 6,
            zIndex: 10,
            opacity: controlsLocked ? 0.5 : 1,
            pointerEvents: controlsLocked ? "none" : "auto",
          }}
        >
          <div />
          <Fab
            color="primary"
            size="small"
            onClick={() => moveForwardWorld(facing)}
            disabled={controlsLocked}
          >
            <ArrowUpwardIcon />
          </Fab>
          <div />
          <Fab
            color="primary"
            size="small"
            onClick={() => setFacing((f) => turnCCW(f))}
            disabled={controlsLocked}
          >
            <ArrowBackIcon />
          </Fab>
          <div />
          <Fab
            color="primary"
            size="small"
            onClick={() => setFacing((f) => turnCW(f))}
            disabled={controlsLocked}
          >
            <ArrowForwardIcon />
          </Fab>
          <div />
          <Fab
            color="primary"
            size="small"
            onClick={() => setFacing((f) => turn180(f))}
            disabled={controlsLocked}
          >
            <ArrowDownwardIcon />
          </Fab>
          <div />
        </div>
      )}

      {/* Win Modal with final score */}
      <Dialog open={winOpen} onClose={() => {}} disableEscapeKeyDown>
        <DialogTitle>
          🏁 You collected all questions and reached the exit!
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            <Typography>⏱ Time: {timeStr}</Typography>
            <Typography>❌ Wrong moves: {wrongMoves}</Typography>
            <Typography>
              🧩 Unique questions seen: {questionIdsSeen.size} /{" "}
              {totalUniqueQuestions}
            </Typography>
            <Typography>
              ✅ Unique questions correct: {correctQuestionIds.size}
            </Typography>
            <Typography>🧭 Mazes completed: {mazeCount}</Typography>
            <Typography>
              📏 Shortest path length (current maze): {shortestLenFromStart}
            </Typography>
            <Typography variant="h6">🏆 Score: {finalScore}</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={() => {
              // start a brand-new run
              hardResetRun();
            }}
          >
            Play Again
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

/** Shared small blocks */
function StatsBlock({
  player,
  maze,
  highDegreeCount,
  onHighlight,
}: {
  player: { r: number; c: number };
  maze: Maze;
  highDegreeCount: number;
  onHighlight: () => void;
}) {
  return (
    <Stack spacing={1} sx={{ mt: 1 }}>
      <Typography variant="body2">
        Player: ({player.r},{player.c})
      </Typography>
      <Typography variant="body2">
        Exit: ({maze.exit.r},{maze.exit.c})
      </Typography>
      <Typography variant="body2">Junctions: {highDegreeCount}</Typography>
      <Button size="small" onClick={onHighlight}>
        Highlight Fastest Path from Here
      </Button>
    </Stack>
  );
}

/** Quiz panel content (read-only; answers rotated to screen) */
function QuizReadOnly({
  currentCell,
  facing,
}: {
  currentCell: Cell;
  facing: Dir;
}) {
  if (!currentCell.quiz || !currentCell.answerMap) {
    return (
      <Typography color="text.secondary">
        No quiz here — find a junction (yellow cell)!
      </Typography>
    );
  }

  const screenAnswers: Partial<Record<Dir, string>> = {};
  (Object.keys(currentCell.answerMap) as Dir[]).forEach((worldDir) => {
    const label = currentCell.answerMap![worldDir];
    if (!label) return;
    const sdir = worldToScreenDir(worldDir, facing);
    screenAnswers[sdir] = label;
  });

  const pill = (text?: string) =>
    text ? (
      <div
        style={{
          padding: "6px 8px",
          borderRadius: 8,
          background: "#f0f0f0",
          border: "1px solid #ddd",
          fontSize: 13,
          textAlign: "center",
        }}
      >
        {text}
      </div>
    ) : (
      <div />
    );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gridTemplateRows: "repeat(3, auto)",
        gap: 8,
      }}
    >
      <div
        style={{ gridColumn: "2 / 3", gridRow: "1 / 2", textAlign: "center" }}
      >
        {pill(screenAnswers.N)}
      </div>
      <div style={{ gridColumn: "1 / 2", gridRow: "2 / 3" }}>
        {pill(screenAnswers.W)}
      </div>
      <div
        style={{ gridColumn: "2 / 3", gridRow: "2 / 3", textAlign: "center" }}
      >
        <Typography
          variant="subtitle1"
          sx={{ p: 1, borderRadius: 1, bgcolor: "#f5f5f5" }}
        >
          {currentCell.quiz.question}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Move whenever you like — answers are just hints.
        </Typography>
      </div>
      <div style={{ gridColumn: "3 / 4", gridRow: "2 / 3" }}>
        {pill(screenAnswers.E)}
      </div>
      <div style={{ gridColumn: "2 / 3", gridRow: "3 / 4" }}>
        {pill(screenAnswers.S)}
      </div>
    </div>
  );
}
