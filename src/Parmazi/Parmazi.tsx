import React, { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Typography,
  FormControlLabel,
} from "@mui/material";

type ColorName =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "white"
  | "black";

type CellPos = {
  ring: number;
  seg: number;
};

type Marble = {
  id: string;
  color: ColorName;
  position: CellPos | null;
  finished: boolean;
  homeIndex: number;
};

type Player = {
  id: string;
  color: ColorName;
  startSeg: number;
  marbles: Marble[];
};

type RingConfig = {
  ring: number;
  segments: number;
  rotatable: boolean;
  walls: boolean[];
};

type DieAssignment = {
  id: string;
  dieValue: number;
  used: boolean;
  kind: "move" | "rotate" | null;
};

const COLORS: ColorName[] = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "white",
  "black",
];

const SEGMENTS_BY_RING = [32, 32, 16, 16, 8];
const TOTAL_RINGS = SEGMENTS_BY_RING.length;
const BOARD_SIZE = 840;
const CENTER = BOARD_SIZE / 2;
const OUTER_RADIUS = 340;
const BOARD_STORAGE_KEY = "cypherMarbleBoardConfigV1";
const RING_THICKNESS = 52;
const STAR_RADIUS = 42;
const MARBLE_RADIUS = 11;

const COLOR_HEX: Record<ColorName, string> = {
  red: "#d32f2f",
  orange: "#ef6c00",
  yellow: "#f9a825",
  green: "#2e7d32",
  blue: "#1565c0",
  purple: "#7b1fa2",
  white: "#f5f5f5",
  black: "#212121",
};

const COLOR_STROKE: Record<ColorName, string> = {
  red: "#7f0000",
  orange: "#8a3c00",
  yellow: "#8d6500",
  green: "#124d18",
  blue: "#0b3c7a",
  purple: "#4f156d",
  white: "#9e9e9e",
  black: "#616161",
};

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

function polarPoint(radius: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(a),
    y: CENTER + radius * Math.sin(a),
  };
}

function wedgePath(innerR: number, outerR: number, startDeg: number, endDeg: number) {
  const p1 = polarPoint(outerR, startDeg);
  const p2 = polarPoint(outerR, endDeg);
  const p3 = polarPoint(innerR, endDeg);
  const p4 = polarPoint(innerR, startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
}

function arcPath(radius: number, startDeg: number, endDeg: number) {
  const p1 = polarPoint(radius, startDeg);
  const p2 = polarPoint(radius, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${p1.x} ${p1.y} A ${radius} ${radius} 0 ${largeArc} 1 ${p2.x} ${p2.y}`;
}

function samePos(a: CellPos, b: CellPos) {
  return a.ring === b.ring && a.seg === b.seg;
}

function mappedSeg(seg: number, fromSegments: number, toSegments: number) {
  return mod(Math.floor((seg / fromSegments) * toSegments), toSegments);
}

function createDefaultRings(): RingConfig[] {
  const templates: number[][] = [
    [1, 5, 9, 13, 17, 21, 25, 29],
    [0, 4, 8, 12, 16, 20, 24, 28],
    [1, 5, 8, 12, 15],
    [0, 4, 7, 11, 14],
    [1, 3, 5, 7],
  ];

  const defaults = SEGMENTS_BY_RING.map((segments, ring) => {
    const walls = Array.from({ length: segments }, () => false);
    for (const seg of templates[ring] ?? []) {
      walls[seg % segments] = true;
    }
    return {
      ring,
      segments,
      rotatable: true,
      walls,
    };
  });

  try {
    const saved = localStorage.getItem(BOARD_STORAGE_KEY);
    if (!saved) return defaults;
    const parsed = JSON.parse(saved) as RingConfig[];
    if (!Array.isArray(parsed) || parsed.length !== defaults.length) return defaults;
    return defaults.map((ring, index) => ({
      ...ring,
      walls:
        Array.isArray(parsed[index]?.walls) && parsed[index].walls.length === ring.segments
          ? parsed[index].walls.map(Boolean)
          : ring.walls,
    }));
  } catch {
    return defaults;
  }
}

function getStartSegs(playerCount: number) {
  const spacing = SEGMENTS_BY_RING[0] / playerCount;
  return Array.from({ length: playerCount }, (_, i) => Math.floor(i * spacing));
}

function createPlayers(playerCount: number): Player[] {
  const startSegs = getStartSegs(playerCount);
  return COLORS.slice(0, playerCount).map((color, index) => ({
    id: color,
    color,
    startSeg: startSegs[index],
    marbles: Array.from({ length: 4 }, (_, homeIndex) => ({
      id: `${color}-${homeIndex}`,
      color,
      position: null,
      finished: false,
      homeIndex,
    })),
  }));
}

function getOccupants(players: Player[], target: CellPos) {
  const found: { player: Player; marble: Marble }[] = [];
  for (const player of players) {
    for (const marble of player.marbles) {
      if (marble.position && samePos(marble.position, target)) found.push({ player, marble });
    }
  }
  return found;
}

function countOwnOccupants(players: Player[], player: Player, target: CellPos) {
  return getOccupants(players, target).filter((o) => o.player.id === player.id).length;
}

function pathHasBlockade(players: Player[], mover: Player, from: CellPos, steps: number, direction: -1 | 1) {
  const segments = SEGMENTS_BY_RING[from.ring];
  for (let i = 1; i <= steps; i += 1) {
    const pos = { ring: from.ring, seg: mod(from.seg + direction * i, segments) };
    if (isBlockedByEnemyBlockade(players, mover, pos)) return true;
  }
  return false;
}

function isBlockedByEnemyBlockade(players: Player[], mover: Player, target: CellPos) {
  const occupants = getOccupants(players, target);
  const enemyGroups = occupants.filter((o) => o.player.id !== mover.id);
  return enemyGroups.length >= 2 && enemyGroups.every((o) => o.player.id === enemyGroups[0].player.id);
}

function canMoveBetweenRings(
  from: CellPos,
  toRing: number,
  rings: RingConfig[]
) {
  if (Math.abs(from.ring - toRing) !== 1) return false;

  // moving inward
  if (toRing > from.ring) {
    const targetSeg = mappedSeg(
      from.seg,
      SEGMENTS_BY_RING[from.ring],
      SEGMENTS_BY_RING[toRing]
    );

    // 🔑 BOTH sides must be open now
    return (
      !rings[from.ring].walls[from.seg] &&
      !rings[toRing].walls[targetSeg]
    );
  }

  // moving outward
  const outerSeg = mappedSeg(
    from.seg,
    SEGMENTS_BY_RING[from.ring],
    SEGMENTS_BY_RING[toRing]
  );

  return !rings[toRing].walls[outerSeg];
}

function getCellCenter(pos: CellPos) {
  const radius = OUTER_RADIUS - pos.ring * RING_THICKNESS - RING_THICKNESS / 2;
  const segments = SEGMENTS_BY_RING[pos.ring];
  const angle = (pos.seg + 0.5) * (360 / segments);
  return polarPoint(radius, angle);
}

function getTrayCoords(player: Player, marble: Marble) {
  const segWidth = 360 / SEGMENTS_BY_RING[0];
  const startAngle = player.startSeg * segWidth;
  const angle = startAngle + (marble.homeIndex + 0.5) * segWidth;
  return polarPoint(OUTER_RADIUS + 24, angle);
}

function getLegalMoveTargetsForDie(
  marble: Marble,
  player: Player,
  players: Player[],
  rings: RingConfig[],
  dieValue: number,
  rolledDoubles: boolean,
  allFourHome: boolean
): CellPos[] {
  const targets: CellPos[] = [];

  if (marble.finished) return targets;

  if (marble.position === null) {
    const entry = { ring: 0, seg: player.startSeg };
    if ((rolledDoubles || allFourHome) && !rings[0].walls[player.startSeg] && !isBlockedByEnemyBlockade(players, player, entry) && countOwnOccupants(players, player, entry) < 2) {
      targets.push(entry);
    }
    return targets;
  }

  const pos = marble.position;
  const ringSegments = SEGMENTS_BY_RING[pos.ring];

  const left = { ring: pos.ring, seg: mod(pos.seg - dieValue, ringSegments) };
  const right = { ring: pos.ring, seg: mod(pos.seg + dieValue, ringSegments) };

  if (!pathHasBlockade(players, player, pos, dieValue, -1) && !isBlockedByEnemyBlockade(players, player, left) && countOwnOccupants(players, player, left) < 2) {
    targets.push(left);
  }
  if (!pathHasBlockade(players, player, pos, dieValue, 1) && !isBlockedByEnemyBlockade(players, player, right) && countOwnOccupants(players, player, right) < 2) {
    targets.push(right);
  }

  if (rolledDoubles && pos.ring < TOTAL_RINGS - 1 && canMoveBetweenRings(pos, pos.ring + 1, rings)) {
    const inward = {
      ring: pos.ring + 1,
      seg: mappedSeg(pos.seg, SEGMENTS_BY_RING[pos.ring], SEGMENTS_BY_RING[pos.ring + 1]),
    };
    if (!isBlockedByEnemyBlockade(players, player, inward) && countOwnOccupants(players, player, inward) < 2) {
      targets.push(inward);
    }
  }

  return targets;
}

function canEnterCenter(marble: Marble, rings: RingConfig[], rolledDoubles: boolean) {
  if (!rolledDoubles || !marble.position) return false;
  if (marble.position.ring !== TOTAL_RINGS - 1) return false;
  return !rings[marble.position.ring].walls[marble.position.seg];
}

export default function CypherMarbleGame() {
  const [playerCount, setPlayerCount] = useState(4);
  const [started, setStarted] = useState(false);
  const [players, setPlayers] = useState<Player[]>(() => createPlayers(4));
  const [rings, setRings] = useState<RingConfig[]>(() => createDefaultRings());
  const [turnIndex, setTurnIndex] = useState(0);
  const [dice, setDice] = useState<[number, number] | null>(null);
  const [assignments, setAssignments] = useState<DieAssignment[]>([]);
  const [selectedMarbleId, setSelectedMarbleId] = useState<string | null>(null);
  const [selectedDieId, setSelectedDieId] = useState<string | null>(null);
  const [message, setMessage] = useState("Choose player count, then start.");
  const [winner, setWinner] = useState<ColorName | null>(null);
  const [editMode, setEditMode] = useState(false);

  const currentPlayer = players[turnIndex] ?? null;
  const allFourHome = !!currentPlayer && currentPlayer.marbles.every((m) => !m.position && !m.finished);
  const rolledDoubles = !!dice && dice[0] === dice[1];

  const selectedMarble = useMemo(() => {
    if (!currentPlayer || !selectedMarbleId) return null;
    return currentPlayer.marbles.find((m) => m.id === selectedMarbleId) ?? null;
  }, [currentPlayer, selectedMarbleId]);

  const selectedDie = assignments.find((a) => a.id === selectedDieId) ?? null;

  const legalMoveTargets = useMemo(() => {
    if (!started || !currentPlayer || !selectedMarble || !selectedDie || selectedDie.used || selectedDie.kind !== "move") return [] as CellPos[];
    return getLegalMoveTargetsForDie(selectedMarble, currentPlayer, players, rings, selectedDie.dieValue, rolledDoubles, allFourHome);
  }, [started, currentPlayer, selectedMarble, selectedDie, players, rings, rolledDoubles]);

  const canSelectedEnterCenter = useMemo(() => {
    if (!selectedMarble || !selectedDie || selectedDie.used || selectedDie.kind !== "move") return false;
    return canEnterCenter(selectedMarble, rings, rolledDoubles);
  }, [selectedMarble, selectedDie, rings, rolledDoubles]);

  function persistBoard(nextRings: RingConfig[]) {
    try {
      localStorage.setItem(
        BOARD_STORAGE_KEY,
        JSON.stringify(nextRings.map((r) => ({ ring: r.ring, segments: r.segments, rotatable: r.rotatable, walls: r.walls })))
      );
    } catch {}
  }

  function startGame() {
    setPlayers(createPlayers(playerCount));
    setRings(createDefaultRings());
    setTurnIndex(0);
    setDice(null);
    setAssignments([]);
    setSelectedDieId(null);
    setSelectedMarbleId(null);
    setWinner(null);
    setStarted(true);
    setMessage("Roll 2d6 to begin.");
  }

  function toggleWall(ringIndex: number, segIndex: number) {
    setRings((prev) => {
      const next = prev.map((ring, i) => {
        if (i !== ringIndex) return ring;
        const nextWalls = [...ring.walls];
        nextWalls[segIndex] = !nextWalls[segIndex];
        return { ...ring, walls: nextWalls };
      });
      if (!started) persistBoard(next);
      return next;
    });
  }

  function resetBoardToDefault() {
    const defaults = SEGMENTS_BY_RING.map((segments, ring) => ({
      ring,
      segments,
      rotatable: true,
      walls: Array.from({ length: segments }, () => false),
    }));
    persistBoard(defaults);
    setRings(defaults);
  }

  function rollDice() {
    if (!started || winner) return;
    const d1 = Math.ceil(Math.random() * 6);
    const d2 = Math.ceil(Math.random() * 6);
    setDice([d1, d2]);
    setAssignments([
      { id: "d1", dieValue: d1, used: false, kind: null },
      { id: "d2", dieValue: d2, used: false, kind: null },
    ]);
    setSelectedMarbleId(null);
    setSelectedDieId(null);
    setMessage(d1 === d2 ? "Doubles rolled. You may move inward by 1 ring or enter from tray." : "Assign each die to a move or a ring rotation.");
  }

  function markDie(id: string, kind: "move" | "rotate") {
    setAssignments((prev) => prev.map((a) => (a.id === id ? { ...a, kind } : a)));
    setSelectedDieId(id);
  }

  function consumeDie(id: string) {
    const nextAssignments = assignments.map((a) => (a.id === id ? { ...a, used: true } : a));
    setAssignments(nextAssignments);
    setSelectedDieId(null);
    setSelectedMarbleId(null);
    if (nextAssignments.every((a) => a.used)) {
      const nextTurn = (turnIndex + 1) % players.length;
      setTurnIndex(nextTurn);
      setDice(null);
      setAssignments([]);
      setMessage("Next player: roll 2d6.");
    }
  }

  function rotateRing(ringIndex: number, direction: -1 | 1) {
    if (!started || winner || editMode) return;
    if (!selectedDie || selectedDie.used || selectedDie.kind !== "rotate") return;
    
    const steps = selectedDie.dieValue;

    setRings((prev) =>
      prev.map((ring, index) => {
        if (index !== ringIndex) return ring;
        const nextWalls = Array.from({ length: ring.segments }, (_, seg) => ring.walls[mod(seg - direction * steps, ring.segments)]);
        return { ...ring, walls: nextWalls };
      })
    );

    setPlayers((prev) =>
      prev.map((player) => ({
        ...player,
        marbles: player.marbles.map((marble) => {
          if (!marble.position || marble.position.ring !== ringIndex) return marble;
          return {
            ...marble,
            position: {
              ring: ringIndex,
              seg: mod(marble.position.seg + direction * steps, SEGMENTS_BY_RING[ringIndex]),
            },
          };
        }),
      }))
    );

    consumeDie(selectedDie.id);
    setMessage(`Rotated ring ${ringIndex + 1} by ${steps}.`);
  }

  function applyCapture(target: CellPos, mover: Player, sourcePlayers: Player[]) {
    const occupants = getOccupants(sourcePlayers, target);
    const enemies = occupants.filter((o) => o.player.id !== mover.id);
    if (enemies.length === 0) return sourcePlayers;

    return sourcePlayers.map((player) => {
      if (!enemies.some((e) => e.player.id === player.id)) return player;
      return {
        ...player,
        marbles: player.marbles.map((m) => {
          const hit = enemies.find((e) => e.marble.id === m.id);
          return hit ? { ...m, position: null } : m;
        }),
      };
    });
  }

  function moveSelected(target: CellPos | "center") {
    if (!started || winner || !currentPlayer || !selectedMarble || !selectedDie || selectedDie.used || selectedDie.kind !== "move") return;

    const inwardMove = target !== "center" && selectedMarble.position && target.ring === selectedMarble.position.ring + 1;
    const enteringFromHome = target !== "center" && selectedMarble.position === null;

    let nextPlayers = [...players];
    if (target !== "center") nextPlayers = applyCapture(target, currentPlayer, nextPlayers);

    nextPlayers = nextPlayers.map((player) => {
      if (player.id !== currentPlayer.id) return player;
      return {
        ...player,
        marbles: player.marbles.map((m) => {
          if (m.id !== selectedMarble.id) return m;
          if (target === "center") return { ...m, position: null, finished: true };
          return { ...m, position: target };
        }),
      };
    });

    setPlayers(nextPlayers);
    const finishedPlayer = nextPlayers.find((p) => p.marbles.every((m) => m.finished));
    if (finishedPlayer) {
      setWinner(finishedPlayer.color);
      setMessage(`${finishedPlayer.color.toUpperCase()} wins by getting all 4 marbles to the star.`);
      return;
    }

    if (inwardMove || target === "center") {
      const nextTurn = (turnIndex + 1) % players.length;
      setTurnIndex(nextTurn);
      setDice(null);
      setAssignments([]);
      setSelectedDieId(null);
      setSelectedMarbleId(null);
      setMessage("Next player: roll 2d6.");
      return;
    }

    if (enteringFromHome && !rolledDoubles && allFourHome) {
      consumeDie(selectedDie.id);
      setMessage("Piece entered from home. Use your other die to move it.");
      return;
    }

    if (enteringFromHome) {
      const nextTurn = (turnIndex + 1) % players.length;
      setTurnIndex(nextTurn);
      setDice(null);
      setAssignments([]);
      setSelectedDieId(null);
      setSelectedMarbleId(null);
      setMessage("Next player: roll 2d6.");
      return;
    }

    consumeDie(selectedDie.id);
  }

  return (
    <Box className="min-h-screen bg-slate-100 p-4 md:p-6">
      <Stack spacing={3} className="mx-auto max-w-7xl">
        <Typography variant="h4" className="font-bold">
          Cypher Marble Game
        </Typography>

        <Stack direction={{ xs: "column", lg: "row" }} spacing={3} alignItems="flex-start">
          <Card className="w-full max-w-sm rounded-3xl shadow-lg">
            <CardContent>
              <Stack spacing={2.5}>
                <Typography variant="h6">Game Setup</Typography>

                <FormControl fullWidth>
                  <InputLabel id="player-count-label">Players</InputLabel>
                  <Select
                    labelId="player-count-label"
                    label="Players"
                    value={playerCount}
                    onChange={(e) => setPlayerCount(Number(e.target.value))}
                    disabled={started && !winner}
                  >
                    {[2, 3, 4, 5, 6, 7, 8].map((count) => (
                      <MenuItem key={count} value={count}>{count}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Stack direction="row" spacing={1}>
                  <Button variant="contained" size="large" onClick={startGame}>
                    {started ? "Restart Game" : "Start Game"}
                  </Button>
                  {!started && (
                    <Button variant="outlined" size="large" onClick={resetBoardToDefault}>
                      Reset Board
                    </Button>
                  )}
                </Stack>

                <FormControlLabel
                  control={<Switch checked={editMode} onChange={(e) => setEditMode(e.target.checked)} />}
                  label="Edit mode: click a cell wall to add or remove it"
                />

                <Alert severity={winner ? "success" : "info"}>{message}</Alert>

                {started && currentPlayer && (
                  <Stack spacing={1.25}>
                    <Typography variant="subtitle1" className="font-semibold">
                      Current Turn: {currentPlayer.color}
                    </Typography>
                    <Button variant="outlined" onClick={rollDice} disabled={!!dice && assignments.some((a) => !a.used)}>
                      Roll 2d6
                    </Button>
                    {dice && (
                        <>
                      <Button
                        variant="outlined"
                        color="secondary"
                        onClick={() => {
                          const nextTurn = (turnIndex + 1) % players.length;
                          setTurnIndex(nextTurn);
                          setDice(null);
                          setAssignments([]);
                          setSelectedDieId(null);
                          setSelectedMarbleId(null);
                          setMessage("Turn passed. Next player: roll 2d6.");
                        }}
                      >
                        Pass Turn
                      </Button>

                      (
                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          {assignments.map((a, idx) => (
                            <Stack key={a.id} spacing={0.5}>
                              <Chip
                                label={`Die ${idx + 1}: ${a.dieValue}${a.used ? " used" : ""}`}
                                color={selectedDieId === a.id ? "primary" : "default"}
                                variant={a.used ? "outlined" : "filled"}
                              />
                              {!a.used && (
                                <Stack direction="row" spacing={0.5}>
                                  <Button size="small" variant={a.kind === "move" ? "contained" : "outlined"} onClick={() => markDie(a.id, "move")}>Move</Button>
                                  <Button size="small" variant={a.kind === "rotate" ? "contained" : "outlined"} onClick={() => markDie(a.id, "rotate")}>Rotate</Button>
                                </Stack>
                              )}
                            </Stack>
                          ))}
                        </Stack>
                        <Typography variant="body2">
                          Doubles let you move inward by 1 ring, including entering from the tray. If all 4 of your marbles are home, you may use one die to enter and the other die to move that marble.
                        </Typography>
                      </Stack></>
                    )}
                  </Stack>
                )}

                <Stack spacing={1.25}>
                  <Typography variant="subtitle1" className="font-semibold">Rules in this version</Typography>
                  <Chip label="Outer tray is unfilled, editable, and split into 4-space starts" />
                  <Chip label="Rings: 32, 32, 16, 16, 8" />
                  <Chip label="Center has 8 gates aligned to the inner ring" />
                  <Chip label="Use each die for move or rotation" />
                  <Chip label="Two of your marbles on one cell create a blockade" />
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Card className="w-full rounded-3xl shadow-lg">
            <CardContent>
              <Stack spacing={2} alignItems="center">
                <Typography variant="h6">Board</Typography>
                <Box className="w-full overflow-auto">
                  <svg viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`} width="100%" style={{ maxWidth: 820, display: "block", margin: "0 auto" }}>
                    <rect x="0" y="0" width={BOARD_SIZE} height={BOARD_SIZE} fill="#f8fafc" rx="24" />
                    <circle cx={CENTER} cy={CENTER} r={OUTER_RADIUS + 84} fill="#e5e7eb" />
                    

                    {(() => {
                      const outerSegments = SEGMENTS_BY_RING[0];
                      const starts = getStartSegs(playerCount);
                      return Array.from({ length: outerSegments }, (_, seg) => {
                        const start = seg * (360 / outerSegments);
                        const end = (seg + 1) * (360 / outerSegments);
                        const d = wedgePath(OUTER_RADIUS + 2, OUTER_RADIUS + 44, start, end);
                        const ownerIndex = starts.findIndex((s) => seg >= s && seg < s + 4);
                        const isTray = ownerIndex >= 0;
                        return (
                          <g key={`tray-${seg}`}>
                            <path d={d} fill="none" stroke={isTray ? COLOR_STROKE[COLORS[ownerIndex]] : "#6b7280"} strokeWidth={isTray ? 3 : 1.25} />
                            {editMode && (
                              <path
                                d={arcPath(OUTER_RADIUS + 2, start + 2, end - 2)}
                                stroke="rgba(25,118,210,0.001)"
                                strokeWidth="16"
                                strokeLinecap="round"
                                fill="none"
                                style={{ cursor: "pointer" }}
                                onClick={() => toggleWall(0, seg)}
                              />
                            )}
                          </g>
                        );
                      });
                    })()}

                    {rings.map((ring) => {
                      const outerR = OUTER_RADIUS - ring.ring * RING_THICKNESS;
                      const innerR = outerR - RING_THICKNESS;
                      const segAngle = 360 / ring.segments;

                      return (
                        <g key={`ring-${ring.ring}`}>
                          {Array.from({ length: ring.segments }, (_, seg) => {
                            const start = seg * segAngle;
                            const end = (seg + 1) * segAngle;
                            return <path key={`cell-${ring.ring}-${seg}`} d={wedgePath(innerR, outerR, start, end)} fill="#f5ead9" stroke="#8b6b4f" strokeWidth="1.1" />;
                          })}

                          {Array.from({ length: ring.segments }, (_, seg) => {
                            const angle = seg * segAngle;
                            const p1 = polarPoint(innerR, angle);
                            const p2 = polarPoint(outerR, angle);
                            return <line key={`radial-${ring.ring}-${seg}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#9a7a5d" strokeWidth="1" />;
                          })}

                          {ring.walls.map((hasWall, seg) => {
                            const start = seg * segAngle + 2;
                            const end = (seg + 1) * segAngle - 2;
                            return (
                              <g key={`wall-${ring.ring}-${seg}`}>
                                {hasWall && <path d={arcPath(outerR, start, end)} stroke="#2b2118" strokeWidth="6" strokeLinecap="round" fill="none" />}
                                {editMode && (
                                  <path
                                    d={arcPath(outerR, start, end)}
                                    stroke="rgba(25,118,210,0.001)"
                                    strokeWidth="18"
                                    strokeLinecap="round"
                                    fill="none"
                                    style={{ cursor: "pointer" }}
                                    onClick={() => toggleWall(ring.ring, seg)}
                                  />
                                )}
                              </g>
                            );
                          })}

                          {!editMode && ring.rotatable && selectedDie && !selectedDie.used && selectedDie.kind === "rotate" && (
                            <>
                              {(() => {
                                const left = polarPoint((innerR + outerR) / 2, 270);
                                const right = polarPoint((innerR + outerR) / 2, 90);
                                return (
                                  <>
                                    <g onClick={() => rotateRing(ring.ring, -1)} style={{ cursor: "pointer" }}>
                                      <circle cx={left.x} cy={left.y} r={16} fill="#1976d2" />
                                      <text x={left.x} y={left.y + 5} textAnchor="middle" fontSize="16" fill="white" fontWeight="bold">↺</text>
                                    </g>
                                    <g onClick={() => rotateRing(ring.ring, 1)} style={{ cursor: "pointer" }}>
                                      <circle cx={right.x} cy={right.y} r={16} fill="#1976d2" />
                                      <text x={right.x} y={right.y + 5} textAnchor="middle" fontSize="16" fill="white" fontWeight="bold">↻</text>
                                    </g>
                                  </>
                                );
                              })()}
                            </>
                          )}
                        </g>
                      );
                    })}

                    {Array.from({ length: 8 }, (_, gate) => {
                      const start = gate * 45 + 3;
                      const end = (gate + 1) * 45 - 3;
                      return <path key={`center-wall-${gate}`} d={arcPath(STAR_RADIUS + 20, start, end)} stroke="#2b2118" strokeWidth="5" fill="none" />;
                    })}

                    <g onClick={() => canSelectedEnterCenter && moveSelected("center")} style={{ cursor: canSelectedEnterCenter ? "pointer" : "default" }}>
                      <circle cx={CENTER} cy={CENTER} r={STAR_RADIUS + 16} fill="#d3b07e" stroke="#7f5b3a" strokeWidth="4" />
                      <circle cx={CENTER} cy={CENTER} r={STAR_RADIUS} fill={canSelectedEnterCenter ? "#ffe082" : "#f6d88a"} stroke="#6d4c41" strokeWidth="3" />
                      <text x={CENTER} y={CENTER + 8} textAnchor="middle" fontSize="30" fill="#4e342e" fontWeight="bold">★</text>
                    </g>

                    {players.slice(0, playerCount).flatMap((player) =>
                      player.marbles.map((marble) => {
                        if (marble.finished) return null;
                        const coords = marble.position ? getCellCenter(marble.position) : getTrayCoords(player, marble);
                        const clickable = !!selectedDie && !selectedDie.used && selectedDie.kind === "move" && currentPlayer?.id === player.id && !editMode;
                        const isSelected = selectedMarbleId === marble.id;
                        const ownOccupants = marble.position ? getOccupants(players, marble.position).filter((o) => o.player.id === player.id).length : 1;
                        return (
                          <g key={marble.id} onClick={() => clickable && setSelectedMarbleId((prev) => (prev === marble.id ? null : marble.id))} style={{ cursor: clickable ? "pointer" : "default" }}>
                            {isSelected && <circle cx={coords.x} cy={coords.y} r={MARBLE_RADIUS + 7} fill="none" stroke="#1976d2" strokeWidth="3" />}
                            <circle cx={coords.x} cy={coords.y} r={MARBLE_RADIUS} fill={COLOR_HEX[marble.color]} stroke={COLOR_STROKE[marble.color]} strokeWidth="3" />
                            {ownOccupants >= 2 && <circle cx={coords.x} cy={coords.y} r={MARBLE_RADIUS + 4} fill="none" stroke="#111827" strokeWidth="2" strokeDasharray="3 2" />}
                          </g>
                        );
                      })
                    )}

                    {!editMode && legalMoveTargets.map((target, index) => {
                      const p = getCellCenter(target);
                      return (
                        <g key={`move-target-${index}`} onClick={() => moveSelected(target)} style={{ cursor: "pointer" }}>
                          <circle cx={p.x} cy={p.y} r={8} fill="#1976d2" opacity={0.9} />
                          <circle cx={p.x} cy={p.y} r={16} fill="none" stroke="#1976d2" strokeWidth="2" opacity={0.6} />
                        </g>
                      );
                    })}
                  </svg>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Stack>
    </Box>
  );
}
