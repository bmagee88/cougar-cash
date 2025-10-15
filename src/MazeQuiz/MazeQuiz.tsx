import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useLayoutEffect,
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
} from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import { SAMPLE_QUIZ } from "./quizHelpers";

/**
 * Maze + Junction Quiz (Full-Width + Mobile + Junction Lock + Scoring)
 * - Perfect maze generation, unique path, greedy hints
 * - Movement: WASD/Arrows, swipe, D-pad (mobile)
 * - CSV upload for quiz. CSV split: text.split(/\r?\n/).filter(Boolean)
 * - Visibility modes: god / blind_memory / blind_now / absolute_blind
 * - Junction lock: at junctions (>2 openings) movement is disabled until an answer is chosen.
 * - Wrong answer counter, timer, scoring (shown on finish).
 */

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

function distanceMapToExit(maze: Maze): number[][] {
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
  const dist = distanceMapToExit(maze);
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

export function verifySolution(
  maze: Maze,
  path: { r: number; c: number }[]
): boolean {
  if (!path.length) return false;
  const startOK =
    path[0].r === maze.entrance.r && path[0].c === maze.entrance.c;
  const endOK =
    path[path.length - 1].r === maze.exit.r &&
    path[path.length - 1].c === maze.exit.c;
  if (!startOK || !endOK) return false;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const dr = b.r - a.r;
    const dc = b.c - a.c;
    let dir: Dir | null = null;
    if (dr === -1 && dc === 0) dir = "N";
    else if (dr === 1 && dc === 0) dir = "S";
    else if (dr === 0 && dc === 1) dir = "E";
    else if (dr === 0 && dc === -1) dir = "W";
    else return false;
    if (maze.cells[a.r][a.c].walls[dir]) return false;
  }
  const shortest = shortestPathFrom(maze, maze.entrance);
  return path.length === shortest.length;
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

function parseCSV(text: string): QuizQuestion[] {
  const lines = text.split(/\r?\n/).filter(Boolean); // <-- as requested
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

// ---------- UI ----------

type GridPoint = { r: number; c: number };
const cellPx = 28;
const PANEL_WIDTH = 460;
const PANEL_GAP = 32;

export default function MazeQuizApp() {
  const [rows, setRows] = useState(15);
  const [cols, setCols] = useState(25);
  const [showGreedy, setShowGreedy] = useState(false);
  const [quizPool, setQuizPool] = useState<QuizQuestion[]>(SAMPLE_QUIZ);
  const [maze, setMaze] = useState<Maze>(() => {
    const m = generatePerfectMaze(15, 25);
    assignGreedyDirections(m);
    attachQuestionsToJunctions(m, SAMPLE_QUIZ);
    return m;
  });

  const [player, setPlayer] = useState<GridPoint>({ r: 0, c: 0 });
  const [pathHighlight, setPathHighlight] = useState<GridPoint[]>([]);
  const [winOpen, setWinOpen] = useState(false);

  // Visibility state
  const [vizMode, setVizMode] = useState<VizMode>("god");
  const [explored, setExplored] = useState<Set<string>>(new Set());
  const key = (r: number, c: number) => `${r},${c}`;

  // Scoring/timer state
  const [wrongMoves, setWrongMoves] = useState(0);
  const [questionIdsSeen, setQuestionIdsSeen] = useState<Set<string>>(
    new Set()
  );
  const [hasStarted, setHasStarted] = useState(false);
  const [startTs, setStartTs] = useState<number | null>(null);
  const [nowTs, setNowTs] = useState<number>(Date.now());
  const [endTs, setEndTs] = useState<number | null>(null); // <-- NEW


  // Layout & mobile
  const isMobile = useMediaQuery("(max-width:900px)");

  // Quiz panel clamp refs/state (desktop floating)
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelTop, setPanelTop] = useState(0);

  const highDegree = useMemo(() => findHighDegreeCells(maze), [maze]);

  // --- Visibility helpers ---
  const computeVisibleRays = useCallback((m: Maze, pos: GridPoint) => {
    const s = new Set<string>();
    s.add(key(pos.r, pos.c));
    for (const d of DIRS) {
      let cr = pos.r;
      let cc = pos.c;
      while (!m.cells[cr][cc].walls[d]) {
        cr += DELTA[d].dr;
        cc += DELTA[d].dc;
        if (cr < 0 || cc < 0 || cr >= m.rows || cc >= m.cols) break;
        s.add(key(cr, cc));
        if (m.cells[cr][cc].walls[d]) break;
      }
    }
    return s;
  }, []);

  const computeAdjacentVisible = useCallback((m: Maze, pos: GridPoint) => {
    const s = new Set<string>();
    s.add(key(pos.r, pos.c));
    for (const d of DIRS) {
      if (!m.cells[pos.r][pos.c].walls[d]) {
        const nr = pos.r + DELTA[d].dr;
        const nc = pos.c + DELTA[d].dc;
        if (nr >= 0 && nc >= 0 && nr < m.rows && nc < m.cols)
          s.add(key(nr, nc));
      }
    }
    return s;
  }, []);

  const currentRays = useMemo(
    () => computeVisibleRays(maze, player),
    [maze, player, computeVisibleRays]
  );
  const currentAdjacent = useMemo(
    () => computeAdjacentVisible(maze, player),
    [maze, player, computeAdjacentVisible]
  );

  // Blind memory: merge current rays into memory on entry; memory persists across mode toggles
  useEffect(() => {
    if (vizMode === "blind_memory") {
      setExplored((prev) => {
        const merged = new Set<string>();
        prev.forEach((v) => merged.add(v));
        currentRays.forEach((v) => merged.add(v));
        return merged;
      });
    }
  }, [vizMode, currentRays]);

  // Clamp floating quiz panel within grid vertical bounds (desktop only)
  useLayoutEffect(() => {
    if (isMobile) return;
    const ph = panelRef.current?.offsetHeight ?? 0;
    const gridH = maze.rows * cellPx;
    const desired = player.r * cellPx + cellPx / 2 - ph / 2;
    const clamped = Math.max(0, Math.min(desired, gridH - ph));
    setPanelTop(clamped);
  }, [player.r, maze.rows, currentRays, currentAdjacent, isMobile]);

  const isCellVisible = (r: number, c: number) => {
    if (vizMode === "god") return true;
    const id = key(r, c);
    if (vizMode === "blind_now") return currentRays.has(id);
    if (vizMode === "absolute_blind") return currentAdjacent.has(id);
    // blind_memory
    return explored.has(id) || currentRays.has(id);
  };

  // Determine if we're currently at a junction (locks movement)
  const currentCell = maze.cells[player.r][player.c];
  const atJunction = currentCell.openings > 2;

  // Track unique questions encountered (when entering a junction)
  useEffect(() => {
    if (atJunction && currentCell.quiz?.id) {
      setQuestionIdsSeen((prev) => {
        if (prev.has(currentCell.quiz!.id)) return prev;
        const next = new Set(prev);
        next.add(currentCell.quiz!.id);
        return next;
      });
    }
  }, [atJunction, currentCell.quiz?.id]);

  // Timer: start on first move/answer; tick every 250ms
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
const endOrNow = endTs ?? nowTs;
const elapsedMs = hasStarted && startTs ? Math.max(0, endOrNow - startTs) : 0;
  const timeStr = new Date(elapsedMs).toISOString().substring(14, 19); // mm:ss

  // Reset / regenerate
  const regenerate = useCallback(() => {
    const m = generatePerfectMaze(rows, cols);
    assignGreedyDirections(m);
    attachQuestionsToJunctions(m, quizPool);
    setMaze(m);
    const start = { r: m.entrance.r, c: m.entrance.c };
    setPlayer(start);
    setPathHighlight([]);
    setWinOpen(false);
    setWrongMoves(0);
    setQuestionIdsSeen(new Set());
    setHasStarted(false);
    setStartTs(null);
    setEndTs(null);
    if (vizMode === "blind_memory") {
      setExplored(computeVisibleRays(m, start));
    } else {
      setExplored(new Set());
    }
  }, [rows, cols, quizPool, vizMode, computeVisibleRays]);

  // Click-to-highlight
  const inHighlight = (r: number, c: number) =>
    pathHighlight.some((p) => p.r === r && p.c === c);
  const onCellClick = (r: number, c: number) => {
    setPathHighlight(shortestPathFrom(maze, { r, c }));
  };

  // Core movement (respects junction lock unless force is true)
  const move = useCallback(
    (dir: Dir, force = false) => {
      if (!force && atJunction) return; // locked at junction
      const { r, c } = player;
      if (maze.cells[r][c].walls[dir]) return;
      const nr = r + DELTA[dir].dr;
      const nc = c + DELTA[dir].dc;
      if (nr < 0 || nc < 0 || nr >= maze.rows || nc >= maze.cols) return;
      const next = { r: nr, c: nc };
      setPlayer(next);
      setPathHighlight([]);
      if (!hasStarted) {
        setHasStarted(true);
        setStartTs(Date.now());
      }
      if (vizMode === "blind_memory") {
        const vis = computeVisibleRays(maze, next);
        setExplored((prev) => {
          const merged = new Set<string>();
          prev.forEach((v) => merged.add(v));
          vis.forEach((v) => merged.add(v));
          return merged;
        });
      }
      if (next.r === maze.exit.r && next.c === maze.exit.c) {
  setEndTs(Date.now());       // <-- stop the timer
  setWinOpen(true);
}
    },
    [player, maze, vizMode, computeVisibleRays, atJunction, hasStarted]
  );

  // Keyboard handler (blocked at junction)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (atJunction) return; // locked; ignore keyboard
      const k = e.key.toLowerCase();
      if (["w", "arrowup"].includes(k)) {
        e.preventDefault();
        move("N");
      } else if (["s", "arrowdown"].includes(k)) {
        e.preventDefault();
        move("S");
      } else if (["a", "arrowleft"].includes(k)) {
        e.preventDefault();
        move("W");
      } else if (["d", "arrowright"].includes(k)) {
        e.preventDefault();
        move("E");
      } else if (k === "escape") {
        e.preventDefault();
        setPathHighlight([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, atJunction]);

  // Touch swipe on the grid (blocked at junction)
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if (atJunction) return;
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (atJunction) return;
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    const TH = 24;
    if (Math.abs(dx) < TH && Math.abs(dy) < TH) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "E" : "W");
    else move(dy > 0 ? "S" : "N");
  };

  // CSV upload
  const onCsvUpload = async (file: File) => {
    const text = await file.text();
    const parsed = parseCSV(text);
    if (parsed.length) setQuizPool(parsed);
  };

  // Answer from quiz (forces movement even at junction)
  const onAnswer = (dir: Dir) => {
    const correctDir = currentCell.greedyDirection;
    const isCorrect = correctDir === dir;
    if (!isCorrect) setWrongMoves((x) => x + 1);
    move(dir, true); // force movement from junction via answer
  };

  // Live score (optional display); final score computed on win
  const timeSec = Math.round(elapsedMs / 1000);
  const uniqueQ = questionIdsSeen.size;
  const liveScore = Math.max(
    0,
    1000 + uniqueQ * 20 - wrongMoves * 50 - timeSec * 2
  );

  // Compute final score on win (shown in modal)
  const finalScore = liveScore;

  // ------- RENDER -------
  return (
    <Stack spacing={2} sx={{ p: { xs: 1, md: 2 }, width: "100%" }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ width: "100%" }}
      >
        <Typography variant="h5">Perfect Maze + Junction Quiz</Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="body2">⏱ {timeStr}</Typography>
          <Typography variant="body2">❌ {wrongMoves}</Typography>
          <Typography variant="body2">🧩 {uniqueQ}</Typography>
          <Typography variant="body2">🏆 {liveScore}</Typography>
        </Stack>
      </Stack>

      {/* Top controls */}
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", md: "center" }}
        sx={{ width: "100%" }}
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
          <ToggleButton value="blind_memory">Blind + Memory</ToggleButton>
          <ToggleButton value="blind_now">Blind (No Memory)</ToggleButton>
          <ToggleButton value="absolute_blind">Absolute Blind</ToggleButton>
        </ToggleButtonGroup>
        <Button variant="contained" onClick={regenerate}>
          Regenerate
        </Button>
        <Button variant="outlined" onClick={() => setPathHighlight([])}>
          Clear Highlight
        </Button>
        <label>
          <input
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            onChange={(e) => e.target.files && onCsvUpload(e.target.files[0])}
          />
          <Button variant="outlined" component="span">
            Upload CSV
          </Button>
        </label>
      </Stack>

      {/* Main content area — full width; maze scrolls if larger than viewport */}
      <div
        style={{
          position: "relative",
          width: "100%",
          overflowX: "auto",
          overflowY: "hidden",
        }}
      >
        {/* Maze board */}
        <Card variant="outlined" sx={{ width: "max-content" }}>
          <CardContent>
            <Typography
              variant="subtitle1"
              gutterBottom
              sx={{ whiteSpace: "pre-line" }}
            >
              {isMobile
                ? "Swipe over the maze or use the D-pad to move. Tap a cell to show its fastest path."
                : "Move with WASD / Arrow Keys. Click any cell to highlight its fastest path to the exit.\nPress Esc or click Clear Highlight to unhighlight."}
            </Typography>

            <div
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              style={{
                position: "relative",
                display: "grid",
                gridTemplateColumns: `repeat(${maze.cols}, ${cellPx}px)`,
                gridAutoRows: `${cellPx}px`,
                gap: 0,
                userSelect: "none",
                width: maze.cols * cellPx,
              }}
            >
              {maze.cells.map((row, r) =>
                row.map((cell, c) => {
                  const hl = inHighlight(r, c);
                  const isEntrance =
                    r === maze.entrance.r && c === maze.entrance.c;
                  const isExit = r === maze.exit.r && c === maze.exit.c;
                  const isPlayer = player.r === r && player.c === c;
                  const deg = cell.openings;

                  const baseBg = isPlayer
                    ? "#90caf9"
                    : hl
                    ? "#a5d6a7"
                    : isEntrance
                    ? "#bbdefb"
                    : isExit
                    ? "#ffcdd2"
                    : deg > 2
                    ? "#fff9c4"
                    : "#fafafa";

                  const visible = isCellVisible(r, c);

                  return (
                    <div
                      key={`${r}-${c}`}
                      onClick={() => onCellClick(r, c)}
                      title={`(${r},${c}) openings:${deg}`}
                      style={{
                        width: cellPx,
                        height: cellPx,
                        boxSizing: "border-box",
                        ...(visible
                          ? {
                              borderTop: cell.walls.N
                                ? "2px solid #111"
                                : "2px solid transparent",
                              borderBottom: cell.walls.S
                                ? "2px solid #111"
                                : "2px solid transparent",
                              borderLeft: cell.walls.W
                                ? "2px solid #111"
                                : "2px solid transparent",
                              borderRight: cell.walls.E
                                ? "2px solid #111"
                                : "2px solid transparent",
                            }
                          : { border: "2px solid #111" }),
                        background: visible ? baseBg : "#111",
                        color: visible ? undefined : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        position: "relative",
                        cursor: "pointer",
                      }}
                    >
                      {showGreedy && cell.greedyDirection && (
                        <span style={{ opacity: visible ? 0.7 : 0 }}>
                          {cell.greedyDirection === "N" && "↑"}
                          {cell.greedyDirection === "S" && "↓"}
                          {cell.greedyDirection === "E" && "→"}
                          {cell.greedyDirection === "W" && "←"}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* QUIZ PANEL */}
        {isMobile ? (
          // Mobile: stack quiz under the maze (full width)
          <Card variant="outlined" sx={{ mt: 2, width: "100%", maxWidth: 600 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Junction Quiz
              </Typography>
              <QuizView
                currentCell={currentCell}
                atJunction={atJunction}
                onAnswer={onAnswer}
              />
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
        ) : (
          // Desktop: float to the right of the grid, aligned to player's row (clamped)
          <div
            ref={panelRef}
            style={{
              position: "absolute",
              left: maze.cols * cellPx + PANEL_GAP,
              top: panelTop,
              width: PANEL_WIDTH,
              pointerEvents: "auto",
            }}
          >
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Junction Quiz
                </Typography>
                <QuizView
                  currentCell={currentCell}
                  atJunction={atJunction}
                  onAnswer={onAnswer}
                />
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
          </div>
        )}
      </div>

      {/* Mobile D-pad (disabled while at junction) */}
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
          }}
        >
          <div />
          <Fab
            color="primary"
            size="small"
            onClick={() => move("N")}
            disabled={atJunction}
          >
            <ArrowUpwardIcon />
          </Fab>
          <div />
          <Fab
            color="primary"
            size="small"
            onClick={() => move("W")}
            disabled={atJunction}
          >
            <ArrowBackIcon />
          </Fab>
          <div />
          <Fab
            color="primary"
            size="small"
            onClick={() => move("E")}
            disabled={atJunction}
          >
            <ArrowForwardIcon />
          </Fab>
          <div />
          <Fab
            color="primary"
            size="small"
            onClick={() => move("S")}
            disabled={atJunction}
          >
            <ArrowDownwardIcon />
          </Fab>
          <div />
        </div>
      )}

      {/* Win Modal with final score */}
      <Dialog open={winOpen} onClose={() => {}} disableEscapeKeyDown>
        <DialogTitle>🏁 You reached the exit!</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            <Typography>⏱ Time: {timeStr}</Typography>
            <Typography>❌ Wrong answers: {wrongMoves}</Typography>
            <Typography>🧩 Unique questions: {uniqueQ}</Typography>
            <Typography variant="h6">🏆 Score: {finalScore}</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={regenerate}>
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

/** Quiz panel content with junction lock + answer movement */
function QuizView({
  currentCell,
  atJunction,
  onAnswer,
}: {
  currentCell: Cell;
  atJunction: boolean;
  onAnswer: (dir: Dir) => void;
}) {
  const btn = (dir: Dir, label?: string) =>
    label ? (
      <Button
        fullWidth
        variant={atJunction ? "contained" : "outlined"}
        onClick={() => onAnswer(dir)}
        disabled={!atJunction}
      >
        {dir === "N" && "↑ "}
        {dir === "W" && "← "}
        {dir === "S" && "↓ "}
        {dir === "E" && "→ "}
        {label}
      </Button>
    ) : null;

  if (!currentCell.quiz || !currentCell.answerMap) {
    return (
      <Typography color="text.secondary">
        No quiz here — find a junction (yellow cell)!
      </Typography>
    );
  }

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
        {btn("N", currentCell.answerMap.N)}
      </div>
      <div style={{ gridColumn: "1 / 2", gridRow: "2 / 3", textAlign: "left" }}>
        {btn("W", currentCell.answerMap.W)}
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
        {!atJunction && (
          <Typography variant="caption" color="text.secondary">
            (Not a junction — move freely)
          </Typography>
        )}
        {atJunction && (
          <Typography variant="caption" color="text.secondary">
            Choose an answer to move.
          </Typography>
        )}
      </div>
      <div
        style={{ gridColumn: "3 / 4", gridRow: "2 / 3", textAlign: "right" }}
      >
        {btn("E", currentCell.answerMap.E)}
      </div>
      <div
        style={{ gridColumn: "2 / 3", gridRow: "3 / 4", textAlign: "center" }}
      >
        {btn("S", currentCell.answerMap.S)}
      </div>
    </div>
  );
}
