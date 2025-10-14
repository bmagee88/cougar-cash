import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, CardContent, FormControlLabel, Slider, Stack, Switch, Typography } from "@mui/material";

/**
 * Perfect 2D Maze in React + TypeScript + MUI
 * - Grid of cells with per-side walls {N,S,E,W}
 * - Adjustable size (rows/cols)
 * - Generator uses randomized DFS (recursive backtracker) -> guarantees a perfect maze (unique path between any two cells)
 * - verifySolution(path) to validate a user-provided solution path from entrance to exit
 * - shortestPathFrom(r,c) returns the fastest path to the exit from any cell
 * - findHighDegreeCells() returns cells with >2 open sides (i.e., junctions)
 * - Each cell has greedyDirection: the side that gets you closest to the exit, computed from a BFS distance map
 */

// Cardinal directions & helpers
export type Dir = "N" | "S" | "E" | "W";
const DIRS: Dir[] = ["N", "S", "E", "W"];
const OPP: Record<Dir, Dir> = { N: "S", S: "N", E: "W", W: "E" } as const;
const DELTA: Record<Dir, { dr: number; dc: number }> = {
  N: { dr: -1, dc: 0 },
  S: { dr: 1, dc: 0 },
  E: { dr: 0, dc: 1 },
  W: { dr: 0, dc: -1 },
};

// Cell definition
export interface Cell {
  r: number;
  c: number;
  // walls: true means wall exists on that edge
  walls: Record<Dir, boolean>;
  // derived metadata
  openings: number; // how many sides are open (no wall)
  greedyDirection: Dir | null; // side that most directly leads toward the exit (by distance map)
}

export interface Maze {
  rows: number;
  cols: number;
  cells: Cell[][]; // cells[r][c]
  entrance: { r: number; c: number };
  exit: { r: number; c: number };
}

// Utility: create an empty maze with all walls present
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

// Randomized DFS (recursive backtracker) to carve a perfect maze
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
      // Remove the wall between (r,c) and (nr,nc)
      maze.cells[r][c].walls[d] = false;
      maze.cells[nr][nc].walls[OPP[d]] = false;
      carve(nr, nc);
    }
  }

  carve(0, 0);

  // compute openings and greedyDirection placeholders; greedy filled later
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = maze.cells[r][c];
      cell.openings = DIRS.reduce((acc, d) => acc + (cell.walls[d] ? 0 : 1), 0);
    }
  }

  // (Optional) Ensure explicit openings at entrance/exit outer walls for aesthetics
  maze.cells[maze.entrance.r][maze.entrance.c].walls.W = false; // open west outside
  maze.cells[maze.exit.r][maze.exit.c].walls.E = false; // open east outside

  // Update openings after tweaking borders
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = maze.cells[r][c];
      cell.openings = DIRS.reduce((acc, d) => acc + (cell.walls[d] ? 0 : 1), 0);
    }
  }

  return maze;
}

// Build adjacency list given carved walls
function neighbors(maze: Maze, r: number, c: number): { r: number; c: number; dir: Dir }[] {
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

// BFS distance map from every cell to the exit (shortest path in steps)
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

// Compute greedyDirection for each cell based on the distance map
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

// Shortest path from (r,c) to exit using BFS (fastest way out)
export function shortestPathFrom(maze: Maze, start: { r: number; c: number }): { r: number; c: number }[] {
  const prev = Array.from({ length: maze.rows }, () => Array(maze.cols).fill(null) as (null | { r: number; c: number })[]);
  const q: Array<{ r: number; c: number }> = [];
  const seen = Array.from({ length: maze.rows }, () => Array(maze.cols).fill(false));
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
  // Reconstruct
  const path: { r: number; c: number }[] = [];
  let cur: { r: number; c: number } | null = { r: maze.exit.r, c: maze.exit.c };
  while (cur) {
    path.push(cur);
    const p = prev[cur.r][cur.c];
    cur = p as any;
  }
  path.reverse();
  // If start isn't the first element, there was no path (shouldn't happen in a perfect maze)
  if (!(path[0].r === start.r && path[0].c === start.c)) return [];
  return path;
}

// Verify a supplied path from entrance to exit
// Rules: starts at entrance, ends at exit, adjacent steps only through openings, no illegal jumps
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
    let stepDir: Dir | null = null;
    if (dr === -1 && dc === 0) stepDir = "N";
    else if (dr === 1 && dc === 0) stepDir = "S";
    else if (dr === 0 && dc === 1) stepDir = "E";
    else if (dr === 0 && dc === -1) stepDir = "W";
    else return false; // non-adjacent move
    if (maze.cells[a.r][a.c].walls[stepDir]) return false; // wall blocks
  }
  // Optional: In a perfect maze, any valid path from entrance to exit must be the unique shortest path.
  // We could enforce minimality by comparing to BFS length.
  const shortest = shortestPathFrom(maze, maze.entrance);
  return path.length === shortest.length;
}

// Find cells with more than 2 open sides (junctions)
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

// ---------- UI COMPONENT ----------

type GridPoint = { r: number; c: number };

const cellPx = 28; // size of a cell in pixels

export default function MazeApp() {
  const [rows, setRows] = useState(15);
  const [cols, setCols] = useState(25);
  const [showGreedy, setShowGreedy] = useState(true);
  const [maze, setMaze] = useState<Maze>(() => {
    const m = generatePerfectMaze(15, 25);
    assignGreedyDirections(m);
    return m;
  });
  const [highlightPath, setHighlightPath] = useState<GridPoint[]>([]);

  const regenerate = useCallback(() => {
    const m = generatePerfectMaze(rows, cols);
    assignGreedyDirections(m);
    setMaze(m);
    setHighlightPath([]);
  }, [rows, cols]);

  const highDegree = useMemo(() => findHighDegreeCells(maze), [maze]);

  useEffect(() => {
    // when size changes via sliders, regen immediately for responsiveness
    const m = generatePerfectMaze(rows, cols);
    assignGreedyDirections(m);
    setMaze(m);
    setHighlightPath([]);
  }, [rows, cols]);

  const onCellClick = (r: number, c: number) => {
    const p = shortestPathFrom(maze, { r, c });
    setHighlightPath(p);
  };

  // Helpers for styling borders based on walls
  const borderStyle = (cell: Cell) => ({
    borderTop: cell.walls.N ? "2px solid #111" : "2px solid transparent",
    borderBottom: cell.walls.S ? "2px solid #111" : "2px solid transparent",
    borderLeft: cell.walls.W ? "2px solid #111" : "2px solid transparent",
    borderRight: cell.walls.E ? "2px solid #111" : "2px solid transparent",
  });

  const inHighlight = (r: number, c: number) => highlightPath.some(p => p.r === r && p.c === c);

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Typography variant="h5">Perfect Maze Builder (2D)</Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
        <Stack sx={{ minWidth: 220 }}>
          <Typography gutterBottom>Rows: {rows}</Typography>
          <Slider min={5} max={50} value={rows} onChange={(_, v) => setRows(v as number)} />
        </Stack>
        <Stack sx={{ minWidth: 220 }}>
          <Typography gutterBottom>Cols: {cols}</Typography>
          <Slider min={5} max={70} value={cols} onChange={(_, v) => setCols(v as number)} />
        </Stack>
        <FormControlLabel
          control={<Switch checked={showGreedy} onChange={e => setShowGreedy(e.target.checked)} />}
          label="Show greedy arrow"
        />
        <Button variant="contained" onClick={regenerate}>Regenerate</Button>
      </Stack>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Click any cell to highlight the fastest path to the exit (bottom-right). Entrance is top-left.
          </Typography>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${maze.cols}, ${cellPx}px)`,
              gridAutoRows: `${cellPx}px`,
              gap: 0,
              userSelect: "none",
              width: maze.cols * cellPx,
              maxWidth: "100%",
              overflow: "auto",
            }}
          >
            {maze.cells.map((row, r) =>
              row.map((cell, c) => {
                const hl = inHighlight(r, c);
                const isEntrance = r === maze.entrance.r && c === maze.entrance.c;
                const isExit = r === maze.exit.r && c === maze.exit.c;
                const deg = cell.openings;
                const bg = hl ? "#a5d6a7" : isEntrance ? "#bbdefb" : isExit ? "#ffcdd2" : deg > 2 ? "#fff9c4" : "#fafafa";
                return (
                  <div
                    key={`${r}-${c}`}
                    onClick={() => onCellClick(r, c)}
                    title={`(${r},${c}) openings:${deg}`}
                    style={{
                      width: cellPx,
                      height: cellPx,
                      boxSizing: "border-box",
                      ...borderStyle(cell),
                      background: bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      position: "relative",
                      cursor: "pointer",
                    }}
                  >
                    {showGreedy && cell.greedyDirection && (
                      <span style={{ opacity: 0.7 }}>
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

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6">Developer API (copy/paste as needed)</Typography>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
{`// Regenerate a perfect maze (unique solution between any two cells)
const m = generatePerfectMaze(${"rows"}, ${"cols"});
assignGreedyDirections(m); // fills cell.greedyDirection based on BFS-to-exit

// Verify a path
const ok = verifySolution(m, [ { r: 0, c: 0 }, /* ... */ { r: m.exit.r, c: m.exit.c } ]);

// Fastest way out from arbitrary cell
const path = shortestPathFrom(m, { r: 3, c: 7 });

// Cells with >2 open sides (junctions)
const junctions = findHighDegreeCells(m);`}
          </pre>
        </CardContent>
      </Card>
    </Stack>
  );
}
