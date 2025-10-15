import React, { useCallback, useEffect, useMemo, useState, useLayoutEffect, useRef } from "react";
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
} from "@mui/material";

/**
 * Maze + Quiz with Visibility Modes (God / Blind+Memory / Blind-Now)
 * - Perfect maze generation (unique paths)
 * - Player movement (WASD / Arrow keys), wall and bounds checks
 * - Click any cell to highlight shortest path to exit; Esc/Clear to unhighlight
 * - Quiz attaches to junctions; answers positioned N/E/S/W
 * - Floating quiz panel follows player's row and clamps within vertical bounds
 * - CSV upload (id, question, correct, false1, false2, false3)
 * - CSV splitting uses: text.split(/\r?\n/).filter(Boolean)
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

type VizMode = "god" | "blind_memory" | "blind_now";

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
  walls: Record<Dir, boolean>; // true => wall exists
  openings: number; // count of open sides
  greedyDirection: Dir | null; // best move toward exit by BFS
  // Quiz attachments for junctions
  quiz?: QuizQuestion;
  answerMap?: Partial<Record<Dir, string>>; // text per open direction; correct is on greedyDirection
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
  return { rows, cols, cells, entrance: { r: 0, c: 0 }, exit: { r: rows - 1, c: cols - 1 } };
}

function generatePerfectMaze(rows: number, cols: number, rng: () => number = Math.random): Maze {
  const maze = makeGrid(rows, cols);
  const visited: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));

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

  // aesthetics: openings at outer border for entrance/exit
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

function neighbors(maze: Maze, r: number, c: number): { r: number; c: number; dir: Dir }[] {
  const out: { r: number; c: number; dir: Dir }[] = [];
  for (const d of DIRS) {
    if (!maze.cells[r][c].walls[d]) {
      const nr = r + DELTA[d].dr;
      const nc = c + DELTA[d].dc;
      if (nr >= 0 && nc >= 0 && nr < maze.rows && nc < maze.cols) out.push({ r: nr, c: nc, dir: d });
    }
  }
  return out;
}

function distanceMapToExit(maze: Maze): number[][] {
  const dist = Array.from({ length: maze.rows }, () => Array(maze.cols).fill(Infinity));
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

export function shortestPathFrom(maze: Maze, start: { r: number; c: number }): { r: number; c: number }[] {
  const prev = Array.from({ length: maze.rows }, () => Array(maze.cols).fill(null) as (null | { r: number; c: number })[]);
  const seen = Array.from({ length: maze.rows }, () => Array(maze.cols).fill(false));
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

export function verifySolution(maze: Maze, path: { r: number; c: number }[]): boolean {
  if (!path.length) return false;
  const startOK = path[0].r === maze.entrance.r && path[0].c === maze.entrance.c;
  const endOK = path[path.length - 1].r === maze.exit.r && path[path.length - 1].c === maze.exit.c;
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

export function findHighDegreeCells(maze: Maze): { r: number; c: number; openings: number }[] {
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
  { id: "1", question: "Which way points to the exit?", correct: "The greedy side", false1: "The longest loop", false2: "Random backtrack", false3: "Dead end" },
  { id: "2", question: "Pick the shortest path step.", correct: "Toward lower distance", false1: "Toward higher distance", false2: "Into a wall", false3: "Out of bounds" },
  { id: "3", question: "BFS finds?", correct: "Shortest path", false1: "Random path", false2: "Longest path", false3: "No path" },
  { id: "4", question: "Perfect maze means…", correct: "One unique path", false1: "Two exits only", false2: "All loops", false3: "No walls" },
  { id: "5", question: "Opposite of North?", correct: "South", false1: "East", false2: "West", false3: "Up" },
];

function parseCSV(text: string): QuizQuestion[] {
  // Lightweight CSV parser (handles basic quoted fields)
  const lines = text.split(/\r?\n/).filter(Boolean); // ✅ per your preference
  const out: QuizQuestion[] = [];
  for (const line of lines) {
    const cells: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQ = !inQ; }
      } else if (ch === "," && !inQ) {
        cells.push(cur.trim()); cur = "";
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
  // Clear existing
  for (let r = 0; r < maze.rows; r++) for (let c = 0; c < maze.cols; c++) { delete maze.cells[r][c].quiz; delete maze.cells[r][c].answerMap; }
  const junctions = findHighDegreeCells(maze);
  if (!junctions.length || !pool.length) return;
  let qi = 0;
  for (const j of junctions) {
    const cell = maze.cells[j.r][j.c];
    const q = pool[qi % pool.length];
    qi++;
    cell.quiz = q;
    const openDirs = DIRS.filter(d => !cell.walls[d]);
    const map: Partial<Record<Dir, string>> = {};
    const greedy = cell.greedyDirection && openDirs.includes(cell.greedyDirection) ? cell.greedyDirection : openDirs[0];
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
const PANEL_WIDTH = 340;
const PANEL_GAP = 16;

export default function MazeQuizApp() {
  const [rows, setRows] = useState(15);
  const [cols, setCols] = useState(25);
  const [showGreedy, setShowGreedy] = useState(true);
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

  // --- Visibility state ---
  const [vizMode, setVizMode] = useState<VizMode>("god");
  const [explored, setExplored] = useState<Set<string>>(new Set());
  const key = (r: number, c: number) => `${r},${c}`;

  // Quiz panel clamp refs/state
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelTop, setPanelTop] = useState(0);

  const highDegree = useMemo(() => findHighDegreeCells(maze), [maze]);

  const computeVisibleCells = useCallback((m: Maze, pos: GridPoint) => {
    const s = new Set<string>();
    s.add(key(pos.r, pos.c)); // current cell always visible
    for (const d of DIRS) {
      let cr = pos.r;
      let cc = pos.c;
      while (!m.cells[cr][cc].walls[d]) {
        cr += DELTA[d].dr;
        cc += DELTA[d].dc;
        if (cr < 0 || cc < 0 || cr >= m.rows || cc >= m.cols) break;
        s.add(key(cr, cc));
        if (m.cells[cr][cc].walls[d]) break; // next step would be blocked
      }
    }
    return s;
  }, []);

  const currentVisible = useMemo(
    () => computeVisibleCells(maze, player),
    [maze, player, computeVisibleCells]
  );

  // When switching *into* blind_memory, merge the current visibility into memory.
  useEffect(() => {
    if (vizMode === "blind_memory") {
      setExplored(prev => {
        const merged = new Set<string>();
        prev.forEach(v => merged.add(v));
        currentVisible.forEach(v => merged.add(v));
        return merged;
      });
    }
    // NOTE: We don't clear memory when leaving blind_memory — it persists.
  }, [vizMode, currentVisible]);

  // Clamp floating quiz panel within grid vertical bounds
  useLayoutEffect(() => {
    const ph = panelRef.current?.offsetHeight ?? 0;
    const gridH = maze.rows * cellPx;
    const desired = player.r * cellPx + cellPx / 2 - ph / 2; // center on player row
    const clamped = Math.max(0, Math.min(desired, gridH - ph));
    setPanelTop(clamped);
  }, [player.r, maze.rows, currentVisible]); // recalc when row or content changes

  const isCellVisible = (r: number, c: number) => {
    if (vizMode === "god") return true;
    const keyRC = key(r, c);
    if (vizMode === "blind_now") return currentVisible.has(keyRC);
    // blind_memory => show union of explored and current rays
    return explored.has(keyRC) || currentVisible.has(keyRC);
  };

  const regenerate = useCallback(() => {
    const m = generatePerfectMaze(rows, cols);
    assignGreedyDirections(m);
    attachQuestionsToJunctions(m, quizPool);
    setMaze(m);
    const start = { r: m.entrance.r, c: m.entrance.c };
    setPlayer(start);
    setPathHighlight([]);
    setWinOpen(false);
    // Reset memory on a new maze
    const vis = computeVisibleCells(m, start);
    if (vizMode === "blind_memory") {
      setExplored(vis);
    } else {
      setExplored(new Set());
    }
  }, [rows, cols, quizPool, vizMode, computeVisibleCells]);

  // click-to-highlight shortest path from any cell
  const onCellClick = (r: number, c: number) => {
    setPathHighlight(shortestPathFrom(maze, { r, c }));
  };

  // movement handler (ES5-safe Set merge)
  const attemptMove = useCallback((dir: Dir) => {
    const { r, c } = player;
    if (maze.cells[r][c].walls[dir]) return; // blocked by wall
    const nr = r + DELTA[dir].dr;
    const nc = c + DELTA[dir].dc;
    if (nr < 0 || nc < 0 || nr >= maze.rows || nc >= maze.cols) return; // out of bounds
    const next = { r: nr, c: nc };
    setPlayer(next);
    setPathHighlight([]); // auto-clear highlight on move
    if (vizMode === "blind_memory") {
      const vis = computeVisibleCells(maze, next);
      setExplored(prev => {
        const merged = new Set<string>();
        prev.forEach(v => merged.add(v));
        vis.forEach(v => merged.add(v));
        return merged;
      });
    }
    if (next.r === maze.exit.r && next.c === maze.exit.c) setWinOpen(true);
  }, [player, maze, vizMode, computeVisibleCells]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["w", "arrowup"].includes(k)) { e.preventDefault(); attemptMove("N"); }
      else if (["s", "arrowdown"].includes(k)) { e.preventDefault(); attemptMove("S"); }
      else if (["a", "arrowleft"].includes(k)) { e.preventDefault(); attemptMove("W"); }
      else if (["d", "arrowright"].includes(k)) { e.preventDefault(); attemptMove("E"); }
      else if (k === "escape") { e.preventDefault(); setPathHighlight([]); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [attemptMove]);

  // CSV upload
  const onCsvUpload = async (file: File) => {
    const text = await file.text();
    const parsed = parseCSV(text);
    if (parsed.length) setQuizPool(parsed);
  };

  const currentCell = maze.cells[player.r][player.c];
  const inHighlight = (r: number, c: number) => pathHighlight.some(p => p.r === r && p.c === c);

  const borderStyle = (cell: Cell) => ({
    borderTop: cell.walls.N ? "2px solid #111" : "2px solid transparent",
    borderBottom: cell.walls.S ? "2px solid #111" : "2px solid transparent",
    borderLeft: cell.walls.W ? "2px solid #111" : "2px solid transparent",
    borderRight: cell.walls.E ? "2px solid #111" : "2px solid transparent",
  });

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Typography variant="h5">Perfect Maze + Junction Quiz</Typography>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
        <Stack sx={{ minWidth: 220 }}>
          <Typography gutterBottom>Rows: {rows}</Typography>
          <Slider min={5} max={50} value={rows} onChange={(_, v) => setRows(v as number)} />
        </Stack>
        <Stack sx={{ minWidth: 220 }}>
          <Typography gutterBottom>Cols: {cols}</Typography>
          <Slider min={5} max={70} value={cols} onChange={(_, v) => setCols(v as number)} />
        </Stack>
        <FormControlLabel control={<Switch checked={showGreedy} onChange={e => setShowGreedy(e.target.checked)} />} label="Show greedy arrow" />
        <ToggleButtonGroup
          exclusive
          size="small"
          value={vizMode}
          onChange={(_, v) => v && setVizMode(v)}
        >
          <ToggleButton value="god">God</ToggleButton>
          <ToggleButton value="blind_memory">Blind + Memory</ToggleButton>
          <ToggleButton value="blind_now">Blind (No Memory)</ToggleButton>
        </ToggleButtonGroup>
        <Button variant="contained" onClick={regenerate}>Regenerate</Button>
        <Button variant="outlined" onClick={() => setPathHighlight([])}>Clear Highlight</Button>
        <label>
          <input type="file" accept=".csv" style={{ display: "none" }} onChange={e => e.target.files && onCsvUpload(e.target.files[0])} />
          <Button variant="outlined" component="span">Upload CSV</Button>
        </label>
      </Stack>

      <div
        style={{
          position: "relative",
          width: Math.min(maze.cols * cellPx + PANEL_WIDTH + PANEL_GAP, (typeof window !== "undefined" ? window.innerWidth : 1200) - 64),
          overflow: "auto",
        }}
      >
        {/* Maze board */}
        <Card variant="outlined" sx={{ overflow: "hidden" }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Move with WASD / Arrow Keys. Click any cell to highlight its fastest path to the exit. Press Esc or click Clear Highlight to unhighlight.
            </Typography>
            <div
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
                  const isEntrance = r === maze.entrance.r && c === maze.entrance.c;
                  const isExit = r === maze.exit.r && c === maze.exit.c;
                  const isPlayer = player.r === r && player.c === c;
                  const deg = cell.openings;

                  const baseBg =
                    isPlayer ? "#90caf9" :
                    hl ? "#a5d6a7" :
                    isEntrance ? "#bbdefb" :
                    isExit ? "#ffcdd2" :
                    deg > 2 ? "#fff9c4" : "#fafafa";

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
                        ...(visible ? borderStyle(cell) : { border: "2px solid #111" }),
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

        {/* Floating Quiz Panel aligned to player's row, clamped vertically */}
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
              <Typography variant="h6" gutterBottom>Junction Quiz</Typography>
              {currentCell.quiz && currentCell.answerMap ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(3, auto)", gap: 8 }}>
                  <div style={{ gridColumn: "2 / 3", gridRow: "1 / 2", textAlign: "center" }}>
                    {/* North */}
                    {currentCell.answerMap.N && (
                      <Button fullWidth variant="outlined">↑ {currentCell.answerMap.N}</Button>
                    )}
                  </div>
                  <div style={{ gridColumn: "1 / 2", gridRow: "2 / 3", textAlign: "left" }}>
                    {/* West */}
                    {currentCell.answerMap.W && (
                      <Button fullWidth variant="outlined">← {currentCell.answerMap.W}</Button>
                    )}
                  </div>
                  <div style={{ gridColumn: "2 / 3", gridRow: "2 / 3", textAlign: "center" }}>
                    {/* Center question */}
                    <Typography variant="subtitle1" sx={{ p: 1, borderRadius: 1, bgcolor: "#f5f5f5" }}>
                      {currentCell.quiz.question}
                    </Typography>
                  </div>
                  <div style={{ gridColumn: "3 / 4", gridRow: "2 / 3", textAlign: "right" }}>
                    {/* East */}
                    {currentCell.answerMap.E && (
                      <Button fullWidth variant="outlined">{currentCell.answerMap.E} →</Button>
                    )}
                  </div>
                  <div style={{ gridColumn: "2 / 3", gridRow: "3 / 4", textAlign: "center" }}>
                    {/* South */}
                    {currentCell.answerMap.S && (
                      <Button fullWidth variant="outlined">↓ {currentCell.answerMap.S}</Button>
                    )}
                  </div>
                  <Typography variant="caption" sx={{ gridColumn: "1 / 4", opacity: 0.7 }}>
                    Tip: the correct answer is placed on the side that leads toward the exit.
                  </Typography>

                  <Stack spacing={1} sx={{ mt: 1 }}>
                    <Typography variant="body2">Player: ({player.r},{player.c})</Typography>
                    <Typography variant="body2">Exit: ({maze.exit.r},{maze.exit.c})</Typography>
                    <Typography variant="body2">Junctions: {highDegree.length}</Typography>
                    <Button size="small" onClick={() => setPathHighlight(shortestPathFrom(maze, player))}>Highlight Fastest Path from Here</Button>
                  </Stack>
                </div>
              ) : (
                <Typography color="text.secondary">No quiz here — find a junction (yellow cell)!</Typography>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Win Modal */}
      <Dialog open={winOpen} onClose={() => {}} disableEscapeKeyDown>
        <DialogTitle>🏁 You reached the exit!</DialogTitle>
        <DialogContent>
          <Typography>Nice! Want to play again?</Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={regenerate}>Play Again</Button>
        </DialogActions>
      </Dialog>

      {/* Dev API helper */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6">Developer API (copy/paste)</Typography>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
{`// Attach a custom quiz pool (after upload)
attachQuestionsToJunctions(maze, quizPool);

// Verify a path
autoValid = verifySolution(maze, [ { r: 0, c: 0 }, /*...*/ { r: maze.exit.r, c: maze.exit.c } ]);

// From any cell -> exit
const p = shortestPathFrom(maze, { r: 3, c: 7 });

// Junctions (>2 openings)
const jx = findHighDegreeCells(maze);`}
          </pre>
        </CardContent>
      </Card>
    </Stack>
  );
}
