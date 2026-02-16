// DiceDuel.tsx
// React + TypeScript + MUI — 2-player (Human vs AI) dice duel
// UPDATE (Option 2): CSS 3D cube dice rendering (true 3D via transforms)
// UPDATE: Layout = LEFT column (top→bottom): Opponent row, Center row, Player row
//         RIGHT column: menus / game flow
// UPDATE: Human can NEVER see AI hand faces (only face-down cubes + count)
// UPDATE: Player can view ALL sides of their own dice anytime via rotate controls (U/N/E/S/W/D)
// ES5-safe: no Set spread/for..of over Set — uses Array.from

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CssBaseline,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  ThemeProvider,
  Tooltip,
  Typography,
  createTheme,
} from "@mui/material";
import CasinoIcon from "@mui/icons-material/Casino";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import ShieldIcon from "@mui/icons-material/Shield";
import QuestionMarkIcon from "@mui/icons-material/QuestionMark";
import RotateLeftIcon from "@mui/icons-material/RotateLeft";
import RotateRightIcon from "@mui/icons-material/RotateRight";

type FaceColor = "Blue" | "Red" | "Green" | "Yellow" | "Purple" | "Orange";
type Face = { color: FaceColor; number: 1 | 2 | 3 | 4 | 5 | 6 };

type FaceKey = "U" | "D" | "N" | "E" | "S" | "W";
type Die = { id: string; faces: Record<FaceKey, Face> };

type CenterCorner = "UNE" | "UES" | "USW" | "UWN";
type CenterDie = { die: Die; p1Corner: CenterCorner };

type PlayerId = "P1" | "AI";

type Phase =
  | "pickFirst"
  | "turnStart"
  | "swapSelect"
  | "attackPickColor"
  | "secretSelectDice"
  | "reveal"
  | "counterOption"
  | "roundEnd";

const COLORS: FaceColor[] = ["Blue", "Red", "Green", "Yellow", "Purple", "Orange"];

const COLOR_BEATS: Record<FaceColor, FaceColor> = {
  Blue: "Red",
  Red: "Green",
  Green: "Blue",
  Yellow: "Purple",
  Purple: "Orange",
  Orange: "Yellow",
};

// Defense color = the color that beats the attack color
const COLOR_COUNTER: Record<FaceColor, FaceColor> = Object.fromEntries(
  Object.entries(COLOR_BEATS).map(([atk, beaten]) => [beaten, atk])
) as any;

const FACE_ORDER: FaceKey[] = ["U", "N", "E", "W", "S", "D"];

const CORNERS: Array<[FaceKey, FaceKey, FaceKey]> = [
  ["U", "N", "E"],
  ["U", "E", "S"],
  ["U", "S", "W"],
  ["U", "W", "N"],
  ["D", "N", "E"],
  ["D", "E", "S"],
  ["D", "S", "W"],
  ["D", "W", "N"],
];

const CORNER_TO_KEYS: Record<CenterCorner, [FaceKey, FaceKey, FaceKey]> = {
  UNE: ["U", "N", "E"],
  UES: ["U", "E", "S"],
  USW: ["U", "S", "W"],
  UWN: ["U", "W", "N"],
};

const OPPOSITE_CORNER: Record<CenterCorner, CenterCorner> = {
  UNE: "USW",
  UES: "UWN",
  USW: "UNE",
  UWN: "UES",
};

function randInt(n: number) {
  return Math.floor(Math.random() * n);
}
function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function faceSig(f: Face) {
  return `${f.color[0]}${f.number}`;
}
function dieFullSignature(die: Die) {
  return FACE_ORDER.map((k) => `${k}:${faceSig(die.faces[k])}`).join("|");
}
function cornerSignature(die: Die, keys: [FaceKey, FaceKey, FaceKey]) {
  return keys.map((k) => `${k}:${faceSig(die.faces[k])}`).join(",");
}

function rollDie(die: Die): Face {
  const k = FACE_ORDER[randInt(FACE_ORDER.length)];
  return die.faces[k];
}

function sumForColor(rolls: Face[], color: FaceColor) {
  let total = 0;
  for (let i = 0; i < rolls.length; i++) {
    const r = rolls[i];
    if (r.color === color) total += r.number;
  }
  return total;
}

function expectedValueForColor(die: Die, color: FaceColor) {
  const faces = Object.values(die.faces);
  let sum = 0;
  for (let i = 0; i < faces.length; i++) {
    const f = faces[i];
    if (f.color === color) sum += f.number;
  }
  return sum / 6;
}

function pickBestAttackColor(hand: Die[]) {
  let best: FaceColor = "Blue";
  let bestScore = -Infinity;
  for (let i = 0; i < COLORS.length; i++) {
    const c = COLORS[i];
    let score = 0;
    for (let j = 0; j < hand.length; j++) score += expectedValueForColor(hand[j], c);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

function pickDiceToRoll(hand: Die[], target: FaceColor, maxToRoll: number) {
  const scored = hand
    .map((d, idx) => ({ idx, ev: expectedValueForColor(d, target) }))
    .sort((a, b) => b.ev - a.ev);

  const picks = new Set<number>();
  for (let i = 0; i < scored.length; i++) {
    if (picks.size >= maxToRoll) break;
    if (scored[i].ev > 0.05) picks.add(scored[i].idx);
  }
  if (picks.size === 0 && hand.length > 0) picks.add(0);
  return picks;
}

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    background: { default: "#0b0f14", paper: "#101722" },
    primary: { main: "#7dd3fc" },
    secondary: { main: "#c4b5fd" },
    success: { main: "#34d399" },
    warning: { main: "#fbbf24" },
    error: { main: "#fb7185" },
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif',
  },
});

function colorToHex(c: FaceColor) {
  switch (c) {
    case "Blue":
      return "#3b82f6";
    case "Red":
      return "#ef4444";
    case "Green":
      return "#22c55e";
    case "Yellow":
      return "#eab308";
    case "Purple":
      return "#a855f7";
    case "Orange":
      return "#f97316";
  }
}

function ColorChip({ color }: { color: FaceColor }) {
  const bg = colorToHex(color);
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        px: 1.25,
        py: 0.5,
        borderRadius: 999,
        bgcolor: alpha(bg, 0.18),
        border: `1px solid ${alpha(bg, 0.35)}`,
      }}
    >
      <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: bg }} />
      <Typography variant="body2" sx={{ fontWeight: 800 }}>
        {color}
      </Typography>
    </Box>
  );
}

/** ------------ CSS 3D Cube ------------ */

type CubeView =
  | { kind: "corner"; corner: CenterCorner } // show U + two adjacent (nice 3-face view)
  | { kind: "face"; face: FaceKey }; // show a single face front

function cubeRotation(view: CubeView): { rx: number; ry: number } {
  // Assumes cube faces are positioned:
  // front=N, back=S, right=E, left=W, top=U, bottom=D
  if (view.kind === "corner") {
    switch (view.corner) {
      case "UNE":
        return { rx: -25, ry: 45 }; // top + front + right
      case "UES":
        return { rx: -25, ry: 135 }; // top + right + back
      case "USW":
        return { rx: -25, ry: 225 }; // top + back + left
      case "UWN":
        return { rx: -25, ry: 315 }; // top + left + front
    }
  }

  // face front
  switch (view.face) {
    case "N":
      return { rx: 0, ry: 0 };
    case "E":
      return { rx: 0, ry: -90 };
    case "S":
      return { rx: 0, ry: 180 };
    case "W":
      return { rx: 0, ry: 90 };
    case "U":
      return { rx: -90, ry: 0 };
    case "D":
      return { rx: 90, ry: 0 };
  }
}

function FaceTile({
  face,
  size,
  hidden,
}: {
  face?: Face;
  size: number;
  hidden?: boolean;
}) {
  const bg = face ? colorToHex(face.color) : "#1f2937";

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        borderRadius: Math.max(8, Math.floor(size * 0.16)),
        position: "relative",
        overflow: "hidden",
        border: `1px solid ${hidden ? alpha("#94a3b8", 0.25) : alpha(bg, 0.45)}`,
        bgcolor: hidden ? alpha("#94a3b8", 0.10) : alpha(bg, 0.20),
        boxShadow: hidden
          ? `inset 0 0 0 1px ${alpha("#0b0f14", 0.25)}`
          : `inset 0 0 0 1px ${alpha("#0b0f14", 0.25)}`,
      }}
    >
      {/* highlight */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.02) 45%, rgba(0,0,0,0.12))",
          pointerEvents: "none",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 1000,
          letterSpacing: -0.4,
          fontSize: Math.max(12, Math.floor(size * 0.33)),
          color: hidden ? alpha("#e2e8f0", 0.6) : "#e2e8f0",
          textShadow: "0 1px 0 rgba(0,0,0,0.35)",
          userSelect: "none",
        }}
      >
        {hidden ? "?" : face ? face.number : ""}
      </Box>
    </Box>
  );
}

function DieCube3D({
  die,
  size = 68,
  view,
  hiddenAll = false,
  label,
}: {
  die?: Die;
  size?: number;
  view: CubeView;
  hiddenAll?: boolean;
  label?: string;
}) {
  const { rx, ry } = cubeRotation(view);
  const z = size / 2;

  const face = (k: FaceKey) => (die ? die.faces[k] : undefined);

  return (
    <Box sx={{ display: "inline-flex", flexDirection: "column", gap: 0.75 }}>
      {label && (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {label}
        </Typography>
      )}

      <Box
        sx={{
          width: size,
          height: size,
          perspective: `${size * 6}px`,
        }}
      >
        <Box
          sx={{
            width: "100%",
            height: "100%",
            position: "relative",
            transformStyle: "preserve-3d",
            transform: `rotateX(${rx}deg) rotateY(${ry}deg)`,
            transition: "transform 220ms ease",
          }}
        >
          {/* FRONT (N) */}
          <Box
            sx={{
              position: "absolute",
              width: size,
              height: size,
              transform: `translateZ(${z}px)`,
            }}
          >
            <FaceTile face={face("N")} size={size} hidden={hiddenAll} />
          </Box>

          {/* BACK (S) */}
          <Box
            sx={{
              position: "absolute",
              width: size,
              height: size,
              transform: `rotateY(180deg) translateZ(${z}px)`,
            }}
          >
            <FaceTile face={face("S")} size={size} hidden={hiddenAll} />
          </Box>

          {/* RIGHT (E) */}
          <Box
            sx={{
              position: "absolute",
              width: size,
              height: size,
              transform: `rotateY(90deg) translateZ(${z}px)`,
            }}
          >
            <FaceTile face={face("E")} size={size} hidden={hiddenAll} />
          </Box>

          {/* LEFT (W) */}
          <Box
            sx={{
              position: "absolute",
              width: size,
              height: size,
              transform: `rotateY(-90deg) translateZ(${z}px)`,
            }}
          >
            <FaceTile face={face("W")} size={size} hidden={hiddenAll} />
          </Box>

          {/* TOP (U) */}
          <Box
            sx={{
              position: "absolute",
              width: size,
              height: size,
              transform: `rotateX(90deg) translateZ(${z}px)`,
            }}
          >
            <FaceTile face={face("U")} size={size} hidden={hiddenAll} />
          </Box>

          {/* BOTTOM (D) */}
          <Box
            sx={{
              position: "absolute",
              width: size,
              height: size,
              transform: `rotateX(-90deg) translateZ(${z}px)`,
            }}
          >
            <FaceTile face={face("D")} size={size} hidden={hiddenAll} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function CenterDieCube({
  centerDie,
  viewer,
  selected,
  onClick,
}: {
  centerDie: CenterDie;
  viewer: PlayerId;
  selected?: boolean;
  onClick?: () => void;
}) {
  const corner =
    viewer === "P1" ? centerDie.p1Corner : OPPOSITE_CORNER[centerDie.p1Corner];

  return (
    <Paper
      onClick={onClick}
      elevation={0}
      sx={{
        p: 1.25,
        borderRadius: 3,
        cursor: onClick ? "pointer" : "default",
        border: `1px solid ${selected ? alpha("#7dd3fc", 0.55) : alpha("#94a3b8", 0.16)}`,
        bgcolor: selected ? alpha("#7dd3fc", 0.08) : alpha("#0b1220", 0.28),
        transition: "140ms",
        "&:hover": onClick
          ? { borderColor: alpha("#7dd3fc", 0.65), bgcolor: alpha("#7dd3fc", 0.1) }
          : undefined,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Center
        </Typography>
        <Chip size="small" label={corner} variant="outlined" sx={{ opacity: 0.85 }} />
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center">
        <DieCube3D die={centerDie.die} size={66} view={{ kind: "corner", corner }} />
      </Stack>
    </Paper>
  );
}

function FaceDownCube({ label }: { label: string }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.25,
        borderRadius: 3,
        border: `1px solid ${alpha("#94a3b8", 0.16)}`,
        bgcolor: alpha("#0b1220", 0.28),
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {label}
        </Typography>
        <Tooltip title="Hidden">
          <IconButton size="small">
            <ShieldIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <DieCube3D
          die={undefined}
          size={66}
          view={{ kind: "corner", corner: "UNE" }}
          hiddenAll
        />
        <Stack spacing={0.25}>
          <Typography sx={{ fontWeight: 900, opacity: 0.85 }}>Hidden</Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            AI-only info
          </Typography>
        </Stack>
      </Box>
    </Paper>
  );
}

/** ------------ Game UI pieces ------------ */

type PlayerState = { id: PlayerId; name: string; hand: Die[] };

type ExchangeState = {
  attacker: PlayerId;
  defender: PlayerId;
  attackColor: FaceColor | null;

  attackerPick: Set<number>;
  defenderPick: Set<number>;

  attackerRolls: Face[];
  defenderRolls: Face[];
  attackerScore: number;
  defenderScore: number;
  winner: PlayerId | null;
};

function DiceSelector({
  hand,
  picks,
  setPicks,
  disabled,
  title,
}: {
  hand: Die[];
  picks: Set<number>;
  setPicks: (s: Set<number>) => void;
  disabled?: boolean;
  title: string;
}) {
  return (
    <Card elevation={0} sx={{ border: `1px solid ${alpha("#94a3b8", 0.16)}` }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography sx={{ fontWeight: 900 }}>{title}</Typography>
          <Chip size="small" label={`${picks.size}/${hand.length}`} variant="outlined" sx={{ opacity: 0.85 }} />
        </Stack>

        <Stack spacing={1}>
          {hand.map((die, idx) => {
            const checked = picks.has(idx);
            return (
              <Paper
                key={die.id}
                elevation={0}
                sx={{
                  p: 1.25,
                  borderRadius: 3,
                  border: `1px solid ${checked ? alpha("#34d399", 0.5) : alpha("#94a3b8", 0.14)}`,
                  bgcolor: checked ? alpha("#34d399", 0.08) : alpha("#0b1220", 0.25),
                }}
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Switch
                      disabled={disabled}
                      checked={checked}
                      onChange={() => {
                        const next = new Set(picks);
                        if (next.has(idx)) next.delete(idx);
                        else next.add(idx);
                        setPicks(next);
                      }}
                    />
                    <Typography sx={{ fontWeight: 900 }}>Die {idx + 1}</Typography>
                  </Stack>
                  <Tooltip title="Hidden until reveal">
                    <IconButton size="small">
                      <VisibilityOffIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}

function ColorPicker({
  value,
  onChange,
  label,
}: {
  value: FaceColor | null;
  onChange: (c: FaceColor) => void;
  label?: string;
}) {
  return (
    <Stack spacing={1.25}>
      {label && (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {label}
        </Typography>
      )}
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {COLORS.map((c) => {
          const selected = value === c;
          return (
            <Button
              key={c}
              onClick={() => onChange(c)}
              variant={selected ? "contained" : "outlined"}
              sx={{
                borderRadius: 999,
                textTransform: "none",
                fontWeight: 900,
                ...(selected ? {} : { borderColor: alpha("#94a3b8", 0.25) }),
              }}
              startIcon={
                <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: colorToHex(c) }} />
              }
            >
              {c}
            </Button>
          );
        })}
      </Stack>
      {value && (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Beats <b>{COLOR_BEATS[value]}</b> • Loses to <b>{COLOR_COUNTER[value]}</b>
        </Typography>
      )}
    </Stack>
  );
}

/** ------------ Main Component ------------ */

export default function DiceDuel() {
  const seenDieSigsRef = useRef<Set<string>>(new Set());
  const seenCornerSigsRef = useRef<Set<string>>(new Set());

  const [phase, setPhase] = useState<Phase>("pickFirst");
  const [showHelp, setShowHelp] = useState(true);

  const [players, setPlayers] = useState<Record<PlayerId, PlayerState>>({
    P1: { id: "P1", name: "You", hand: [] },
    AI: { id: "AI", name: "AI", hand: [] },
  });

  const [center, setCenter] = useState<CenterDie[]>([]);
  const [turnAttacker, setTurnAttacker] = useState<PlayerId>("P1");

  const [exchange, setExchange] = useState<ExchangeState>({
    attacker: "P1",
    defender: "AI",
    attackColor: null,
    attackerPick: new Set(),
    defenderPick: new Set(),
    attackerRolls: [],
    defenderRolls: [],
    attackerScore: 0,
    defenderScore: 0,
    winner: null,
  });

  // Swap UI selections
  const [swapCenterIdx, setSwapCenterIdx] = useState<number | null>(null);
  const [swapHandIdx, setSwapHandIdx] = useState<number | null>(null);
  const [swapPlaceCorner, setSwapPlaceCorner] = useState<CenterCorner>("UNE");

  // Player die viewing controls (always can view all sides)
  const [p1DieViews, setP1DieViews] = useState<Record<string, CubeView>>({});

  const attacker = exchange.attacker;
  const defender = exchange.defender;

  function ensureP1Views(hand: Die[]) {
    setP1DieViews((prev) => {
      const next = { ...prev };
      for (let i = 0; i < hand.length; i++) {
        const id = hand[i].id;
        if (!next[id]) next[id] = { kind: "corner", corner: "UNE" };
      }
      return next;
    });
  }

  function generateUniqueDie(): Die {
    for (let guard = 0; guard < 20000; guard++) {
      const faces: Record<FaceKey, Face> = {
        U: { color: COLORS[randInt(6)], number: (randInt(6) + 1) as any },
        D: { color: COLORS[randInt(6)], number: (randInt(6) + 1) as any },
        N: { color: COLORS[randInt(6)], number: (randInt(6) + 1) as any },
        E: { color: COLORS[randInt(6)], number: (randInt(6) + 1) as any },
        S: { color: COLORS[randInt(6)], number: (randInt(6) + 1) as any },
        W: { color: COLORS[randInt(6)], number: (randInt(6) + 1) as any },
      };
      const die: Die = { id: uid("die"), faces };

      const fullSig = dieFullSignature(die);
      if (seenDieSigsRef.current.has(fullSig)) continue;

      const cornerSigs = CORNERS.map((keys) => cornerSignature(die, keys));
      let collision = false;
      for (let i = 0; i < cornerSigs.length; i++) {
        if (seenCornerSigsRef.current.has(cornerSigs[i])) {
          collision = true;
          break;
        }
      }
      if (collision) continue;

      seenDieSigsRef.current.add(fullSig);
      for (let i = 0; i < cornerSigs.length; i++) seenCornerSigsRef.current.add(cornerSigs[i]);
      return die;
    }

    // Keep game playable if constraints get too tight
    seenCornerSigsRef.current.clear();
    return generateUniqueDie();
  }

  function genCenterDie(): CenterDie {
    const die = generateUniqueDie();
    const corners: CenterCorner[] = ["UNE", "UES", "USW", "UWN"];
    return { die, p1Corner: corners[randInt(corners.length)] };
  }

  function refillHand(pid: PlayerId, countTo: number) {
    setPlayers((prev) => {
      const cur = prev[pid];
      if (cur.hand.length >= countTo) return prev;
      const needed = countTo - cur.hand.length;
      const added = Array.from({ length: needed }, () => generateUniqueDie());
      const next = { ...prev, [pid]: { ...cur, hand: [...cur.hand, ...added] } };
      return next;
    });
  }

  function refillCenter(countTo: number) {
    setCenter((prev) => {
      if (prev.length >= countTo) return prev;
      const needed = countTo - prev.length;
      const added = Array.from({ length: needed }, () => genCenterDie());
      return [...prev, ...added];
    });
  }

  function initGame(first: PlayerId) {
    seenDieSigsRef.current = new Set();
    seenCornerSigsRef.current = new Set();

    const p1Hand = Array.from({ length: 5 }, () => generateUniqueDie());
    const aiHand = Array.from({ length: 5 }, () => generateUniqueDie());
    const c = Array.from({ length: 5 }, () => genCenterDie());

    setPlayers({
      P1: { id: "P1", name: "You", hand: p1Hand },
      AI: { id: "AI", name: "AI", hand: aiHand },
    });
    setCenter(c);

    setTurnAttacker(first);
    setExchange({
      attacker: first,
      defender: first === "P1" ? "AI" : "P1",
      attackColor: null,
      attackerPick: new Set(),
      defenderPick: new Set(),
      attackerRolls: [],
      defenderRolls: [],
      attackerScore: 0,
      defenderScore: 0,
      winner: null,
    });

    setSwapCenterIdx(null);
    setSwapHandIdx(null);
    setSwapPlaceCorner("UNE");

    setP1DieViews({});
    setPhase("turnStart");

    // init view map
    ensureP1Views(p1Hand);
  }

  // Keep P1 view map filled for new dice
  useEffect(() => {
    ensureP1Views(players.P1.hand);
  }, [players.P1.hand.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function startAttackFlow() {
    setExchange((ex) => ({
      ...ex,
      attackColor: null,
      attackerPick: new Set(),
      defenderPick: new Set(),
      attackerRolls: [],
      defenderRolls: [],
      attackerScore: 0,
      defenderScore: 0,
      winner: null,
    }));
    setPhase("attackPickColor");
  }

  function doSwapHuman() {
    if (swapCenterIdx == null || swapHandIdx == null) return;
    const attackerId = turnAttacker;
    if (attackerId !== "P1") return;

    const outgoingDie = players[attackerId].hand[swapHandIdx];
    const incomingDie = center[swapCenterIdx].die;

    setPlayers((prev) => {
      const atk = prev[attackerId];
      const newHand = [...atk.hand];
      newHand[swapHandIdx] = incomingDie;
      return { ...prev, [attackerId]: { ...atk, hand: newHand } };
    });

    setCenter((prev) => {
      const next = [...prev];
      next[swapCenterIdx] = { die: outgoingDie, p1Corner: swapPlaceCorner };
      return next;
    });

    setSwapCenterIdx(null);
    setSwapHandIdx(null);
    setSwapPlaceCorner("UNE");

    const nextAttacker: PlayerId = "AI";
    setTurnAttacker(nextAttacker);
    setExchange({
      attacker: nextAttacker,
      defender: "P1",
      attackColor: null,
      attackerPick: new Set(),
      defenderPick: new Set(),
      attackerRolls: [],
      defenderRolls: [],
      attackerScore: 0,
      defenderScore: 0,
      winner: null,
    });
    setPhase("turnStart");
  }

  function aiDecideTurn() {
    const ai = players.AI;

    // Swap only when low on dice (simple AI)
    if (ai.hand.length <= 1 && center.length > 0) {
      const centerIdx = randInt(center.length);

      // give away "worst" die (lowest best EV across colors)
      const handScores = ai.hand
        .map((d, i) => ({
          i,
          best: Math.max.apply(
            null,
            COLORS.map((c) => expectedValueForColor(d, c))
          ),
        }))
        .sort((a, b) => a.best - b.best);

      const handIdx = handScores[0]?.i ?? 0;
      const chosenCorner = (["UNE", "UES", "USW", "UWN"] as CenterCorner[])[randInt(4)];

      const outgoingDie = players.AI.hand[handIdx];
      const incomingDie = center[centerIdx].die;

      setPlayers((prev) => {
        const atk = prev.AI;
        const newHand = [...atk.hand];
        newHand[handIdx] = incomingDie;
        return { ...prev, AI: { ...atk, hand: newHand } };
      });

      setCenter((prev) => {
        const next = [...prev];
        next[centerIdx] = { die: outgoingDie, p1Corner: chosenCorner };
        return next;
      });

      const nextAttacker: PlayerId = "P1";
      setTurnAttacker(nextAttacker);
      setExchange({
        attacker: nextAttacker,
        defender: "AI",
        attackColor: null,
        attackerPick: new Set(),
        defenderPick: new Set(),
        attackerRolls: [],
        defenderRolls: [],
        attackerScore: 0,
        defenderScore: 0,
        winner: null,
      });
      setPhase("turnStart");
      return;
    }

    // Otherwise attack
    setTurnAttacker("AI");
    setExchange({
      attacker: "AI",
      defender: "P1",
      attackColor: null,
      attackerPick: new Set(),
      defenderPick: new Set(),
      attackerRolls: [],
      defenderRolls: [],
      attackerScore: 0,
      defenderScore: 0,
      winner: null,
    });
    setPhase("attackPickColor");
  }

  // AI acts when it's their turn start
  useEffect(() => {
    if (phase === "turnStart" && turnAttacker === "AI") {
      const t = setTimeout(() => aiDecideTurn(), 220);
      return () => clearTimeout(t);
    }
  }, [phase, turnAttacker]); // eslint-disable-line react-hooks/exhaustive-deps

  // AI auto-picks attack color
  useEffect(() => {
    if (phase === "attackPickColor" && attacker === "AI") {
      const c = pickBestAttackColor(players.AI.hand);
      setExchange((ex) => ({ ...ex, attackColor: c }));
      const t = setTimeout(() => setPhase("secretSelectDice"), 200);
      return () => clearTimeout(t);
    }
  }, [phase, attacker, players.AI.hand]);

  const canLockIn =
    phase === "secretSelectDice" &&
    exchange.attackColor != null &&
    (attacker !== "P1" || exchange.attackerPick.size > 0) &&
    (defender !== "P1" || exchange.defenderPick.size > 0);

  function lockInSelectionsAndReveal() {
    const atkHand = players[attacker].hand;
    const defHand = players[defender].hand;
    const attackColor = exchange.attackColor;
    if (!attackColor) return;

    let attackerPick = exchange.attackerPick;
    let defenderPick = exchange.defenderPick;

    if (attacker === "AI") attackerPick = pickDiceToRoll(atkHand, attackColor, 3);
    if (defender === "AI") defenderPick = pickDiceToRoll(defHand, COLOR_COUNTER[attackColor], 3);

    const atkIdxs = Array.from(attackerPick).filter((i) => i >= 0 && i < atkHand.length);
    const defIdxs = Array.from(defenderPick).filter((i) => i >= 0 && i < defHand.length);

    const atkRollFaces: Face[] = [];
    const defRollFaces: Face[] = [];

    for (let i = 0; i < atkIdxs.length; i++) atkRollFaces.push(rollDie(atkHand[atkIdxs[i]]));
    for (let i = 0; i < defIdxs.length; i++) defRollFaces.push(rollDie(defHand[defIdxs[i]]));

    const defColor = COLOR_COUNTER[attackColor];
    const atkScore = sumForColor(atkRollFaces, attackColor);
    const defScore = sumForColor(defRollFaces, defColor);

    const winner: PlayerId | null =
      atkScore === defScore ? null : atkScore > defScore ? attacker : defender;

    setPlayers((prev) => {
      const next = { ...prev };
      const removeIdx = (hand: Die[], idxs: number[]) => {
        const s = new Set(idxs);
        return hand.filter((_, idx) => !s.has(idx));
      };
      next[attacker] = { ...next[attacker], hand: removeIdx(next[attacker].hand, atkIdxs) };
      next[defender] = { ...next[defender], hand: removeIdx(next[defender].hand, defIdxs) };
      return next;
    });

    setExchange((ex) => ({
      ...ex,
      attackerPick,
      defenderPick,
      attackerRolls: atkRollFaces,
      defenderRolls: defRollFaces,
      attackerScore: atkScore,
      defenderScore: defScore,
      winner,
    }));

    setPhase("reveal");
  }

  function proceedAfterReveal() {
    const w = exchange.winner;
    if (!w) return setPhase("roundEnd");
    if (w === exchange.attacker) return setPhase("roundEnd");
    setPhase("counterOption");
  }

  function doCounter(yes: boolean) {
    if (!yes) return setPhase("roundEnd");

    const nextAttacker = exchange.defender;
    const nextDefender = exchange.attacker;

    if (nextAttacker === "AI") {
      const attackColor = pickBestAttackColor(players.AI.hand);
      setExchange({
        attacker: "AI",
        defender: "P1",
        attackColor,
        attackerPick: new Set(),
        defenderPick: new Set(),
        attackerRolls: [],
        defenderRolls: [],
        attackerScore: 0,
        defenderScore: 0,
        winner: null,
      });
      setPhase("secretSelectDice");
    } else {
      setExchange({
        attacker: "P1",
        defender: "AI",
        attackColor: null,
        attackerPick: new Set(),
        defenderPick: new Set(),
        attackerRolls: [],
        defenderRolls: [],
        attackerScore: 0,
        defenderScore: 0,
        winner: null,
      });
      setPhase("attackPickColor");
    }
  }

  function endRoundAndRefill() {
    refillHand("P1", 5);
    refillHand("AI", 5);
    refillCenter(5);

    const nextAttacker: PlayerId = turnAttacker === "P1" ? "AI" : "P1";
    setTurnAttacker(nextAttacker);
    setExchange({
      attacker: nextAttacker,
      defender: nextAttacker === "P1" ? "AI" : "P1",
      attackColor: null,
      attackerPick: new Set(),
      defenderPick: new Set(),
      attackerRolls: [],
      defenderRolls: [],
      attackerScore: 0,
      defenderScore: 0,
      winner: null,
    });
    setPhase("turnStart");
  }

  const isHumanAttacker = attacker === "P1";
  const isHumanDefender = defender === "P1";

  /** ---------- Render helpers ---------- */

  function PlayerDieCard({ die, index }: { die: Die; index: number }) {
    const view = p1DieViews[die.id] ?? ({ kind: "corner", corner: "UNE" } as CubeView);

    const setView = (v: CubeView) => {
      setP1DieViews((prev) => ({ ...prev, [die.id]: v }));
    };

    const cornerCycle: CenterCorner[] = ["UNE", "UES", "USW", "UWN"];

    return (
      <Paper
        elevation={0}
        sx={{
          p: 1.25,
          borderRadius: 3,
          border: `1px solid ${alpha("#94a3b8", 0.14)}`,
          bgcolor: alpha("#0b1220", 0.25),
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Your Die {index + 1}
          </Typography>
          <Chip size="small" label={view.kind === "face" ? `Face ${view.face}` : `Corner ${view.corner}`} variant="outlined" />
        </Stack>

        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1 }}>
          <DieCube3D die={die} size={74} view={view} />

          <Stack spacing={1} sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              View any side anytime
            </Typography>

            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {(["U", "N", "E", "S", "W", "D"] as FaceKey[]).map((k) => (
                <Button
                  key={k}
                  size="small"
                  variant={view.kind === "face" && view.face === k ? "contained" : "outlined"}
                  onClick={() => setView({ kind: "face", face: k })}
                  sx={{
                    minWidth: 40,
                    borderRadius: 2,
                    fontWeight: 900,
                    borderColor: alpha("#94a3b8", 0.22),
                  }}
                >
                  {k}
                </Button>
              ))}
            </Stack>

            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                startIcon={<RotateLeftIcon />}
                onClick={() => {
                  const cur =
                    view.kind === "corner"
                      ? view.corner
                      : "UNE";
                  const idx = cornerCycle.indexOf(cur as CenterCorner);
                  const next = cornerCycle[(idx - 1 + cornerCycle.length) % cornerCycle.length];
                  setView({ kind: "corner", corner: next });
                }}
                variant="outlined"
                sx={{ borderRadius: 2, fontWeight: 900, borderColor: alpha("#94a3b8", 0.22) }}
              >
                Corner
              </Button>
              <Button
                size="small"
                startIcon={<RotateRightIcon />}
                onClick={() => {
                  const cur =
                    view.kind === "corner"
                      ? view.corner
                      : "UNE";
                  const idx = cornerCycle.indexOf(cur as CenterCorner);
                  const next = cornerCycle[(idx + 1) % cornerCycle.length];
                  setView({ kind: "corner", corner: next });
                }}
                variant="outlined"
                sx={{ borderRadius: 2, fontWeight: 900, borderColor: alpha("#94a3b8", 0.22) }}
              >
                Corner
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Paper>
    );
  }

  /** ---------- UI ---------- */

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ minHeight: "100vh", p: { xs: 2, md: 3 } }}>
        <Stack spacing={2} sx={{ maxWidth: 1400, mx: "auto" }}>
          {/* Header */}
          <Stack direction={{ xs: "column", md: "row" }} alignItems={{ md: "center" }} justifyContent="space-between" spacing={1}>
            <Stack spacing={0.25}>
              <Typography variant="h4" sx={{ fontWeight: 1000, letterSpacing: -0.6 }}>
                Dice Duel (3D Cubes)
              </Typography>
              <Typography sx={{ color: "text.secondary" }}>
                Left = board (opponent / center / you) • Right = game menus
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              <FormControlLabel
                control={<Switch checked={showHelp} onChange={(e) => setShowHelp(e.target.checked)} />}
                label="Show help"
              />
              <Button
                variant="outlined"
                onClick={() => initGame("P1")}
                sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
              >
                New Game
              </Button>
            </Stack>
          </Stack>

          {showHelp && (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 4,
                border: `1px solid ${alpha("#94a3b8", 0.16)}`,
                bgcolor: alpha("#0b1220", 0.35),
              }}
            >
              <Stack spacing={1}>
                <Typography sx={{ fontWeight: 900 }}>Rules snapshot</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  On your turn as attacker: <b>Attack</b> (pick a color) or <b>Swap</b> a hand die with a center die (you choose
                  which 3 faces the opponent sees on the die you place into center). If attacking, both sides secretly pick dice to roll.
                  Attacker scores numbers on faces matching attack color; defender scores numbers on faces matching the counter color.
                  If defender wins, they may counterattack.
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {COLORS.map((c) => (
                    <Box key={c} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <ColorChip color={c} />
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        beats {COLOR_BEATS[c]}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Privacy: AI hand is never revealed.
                </Typography>
              </Stack>
            </Paper>
          )}

          {/* Main layout */}
          <Grid container spacing={2}>
            {/* LEFT: board */}
            <Grid item xs={12} lg={8}>
              <Stack spacing={2}>
                {/* Opponent row */}
                <Card elevation={0} sx={{ border: `1px solid ${alpha("#94a3b8", 0.16)}` }}>
                  <CardContent>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Typography sx={{ fontWeight: 1000 }}>Opponent (AI)</Typography>
                      <Chip
                        size="small"
                        label={turnAttacker === "AI" ? "Attacking turn" : "Waiting"}
                        color={turnAttacker === "AI" ? "primary" : "default"}
                        variant={turnAttacker === "AI" ? "filled" : "outlined"}
                      />
                    </Stack>

                    <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
                      Hand: <b>{players.AI.hand.length}</b> dice (hidden)
                    </Typography>

                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {Array.from({ length: players.AI.hand.length }).map((_, i) => (
                        <FaceDownCube key={i} label={`AI Die ${i + 1}`} />
                      ))}
                    </Stack>
                  </CardContent>
                </Card>

                {/* Center row */}
                <Card elevation={0} sx={{ border: `1px solid ${alpha("#94a3b8", 0.16)}` }}>
                  <CardContent>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Typography sx={{ fontWeight: 1000 }}>Center Pool</Typography>
                      <Chip size="small" label={`${center.length}/5`} variant="outlined" />
                    </Stack>

                    <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
                      You see 3 faces (one corner). AI sees the opposite corner.
                    </Typography>

                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {center.map((cd, idx) => (
                        <Box key={cd.die.id} sx={{ minWidth: 160 }}>
                          <CenterDieCube
                            centerDie={cd}
                            viewer="P1"
                            selected={phase === "swapSelect" && swapCenterIdx === idx}
                            onClick={
                              phase === "swapSelect" && turnAttacker === "P1"
                                ? () => setSwapCenterIdx(idx)
                                : undefined
                            }
                          />
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>

                {/* Player row */}
                <Card elevation={0} sx={{ border: `1px solid ${alpha("#94a3b8", 0.16)}` }}>
                  <CardContent>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Typography sx={{ fontWeight: 1000 }}>You</Typography>
                      <Chip
                        size="small"
                        label={turnAttacker === "P1" ? "Attacking turn" : "Waiting"}
                        color={turnAttacker === "P1" ? "primary" : "default"}
                        variant={turnAttacker === "P1" ? "filled" : "outlined"}
                      />
                    </Stack>

                    <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
                      Hand: <b>{players.P1.hand.length}</b> dice (you can view all sides anytime)
                    </Typography>

                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {players.P1.hand.map((d, i) => (
                        <Box key={d.id} sx={{ minWidth: 320, flex: "1 1 320px" }}>
                          <PlayerDieCard die={d} index={i} />
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
            </Grid>

            {/* RIGHT: menus / flow */}
            <Grid item xs={12} lg={4}>
              <Stack spacing={2}>
                {phase === "pickFirst" && (
                  <Card elevation={0} sx={{ border: `1px solid ${alpha("#94a3b8", 0.16)}` }}>
                    <CardContent>
                      <Stack spacing={2}>
                        <Typography variant="h6" sx={{ fontWeight: 1000 }}>
                          Who goes first?
                        </Typography>
                        <Stack spacing={1}>
                          <Button
                            startIcon={<PlayArrowIcon />}
                            onClick={() => initGame("P1")}
                            variant="contained"
                            sx={{ borderRadius: 3, py: 1.25, fontWeight: 900 }}
                          >
                            You go first
                          </Button>
                          <Button
                            startIcon={<SmartToyIcon />}
                            onClick={() => initGame("AI")}
                            variant="outlined"
                            sx={{ borderRadius: 3, py: 1.25, fontWeight: 900 }}
                          >
                            AI goes first
                          </Button>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                )}

                {phase !== "pickFirst" && (
                  <Card elevation={0} sx={{ border: `1px solid ${alpha("#94a3b8", 0.16)}` }}>
                    <CardContent>
                      <Stack spacing={1}>
                        <Typography sx={{ fontWeight: 1000 }}>Game Flow</Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          Attacker: <b>{turnAttacker === "P1" ? "You" : "AI"}</b>
                        </Typography>
                        <Chip
                          label={`Phase: ${phase}`}
                          variant="outlined"
                          sx={{ alignSelf: "flex-start", opacity: 0.9 }}
                        />
                      </Stack>

                      <Divider sx={{ my: 1.5, opacity: 0.25 }} />

                      {/* Turn start */}
                      {phase === "turnStart" && (
                        <Stack spacing={1.25}>
                          {turnAttacker === "P1" ? (
                            <>
                              <Typography sx={{ fontWeight: 900 }}>Choose your action</Typography>
                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                <Button
                                  startIcon={<CasinoIcon />}
                                  variant="contained"
                                  onClick={startAttackFlow}
                                  sx={{ borderRadius: 3, fontWeight: 900 }}
                                >
                                  Attack
                                </Button>
                                <Button
                                  startIcon={<SwapHorizIcon />}
                                  variant="outlined"
                                  onClick={() => setPhase("swapSelect")}
                                  sx={{ borderRadius: 3, fontWeight: 900 }}
                                >
                                  Swap (ends turn)
                                </Button>
                              </Stack>
                            </>
                          ) : (
                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                              AI is deciding…
                            </Typography>
                          )}
                        </Stack>
                      )}

                      {/* Swap */}
                      {phase === "swapSelect" && (
                        <Stack spacing={1.25}>
                          {turnAttacker !== "P1" ? (
                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                              AI swapping…
                            </Typography>
                          ) : (
                            <>
                              <Typography sx={{ fontWeight: 900 }}>Swap</Typography>
                              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                Pick a center die (on the board), then pick one of your dice (by index below),
                                choose the AI-facing corner, and confirm.
                              </Typography>

                              <FormControl>
                                <Typography variant="caption" sx={{ color: "text.secondary", mb: 0.5 }}>
                                  AI-facing corner on the die you place into center
                                </Typography>
                                <RadioGroup
                                  row
                                  value={swapPlaceCorner}
                                  onChange={(e) => setSwapPlaceCorner(e.target.value as CenterCorner)}
                                >
                                  {(["UNE", "UES", "USW", "UWN"] as CenterCorner[]).map((c) => (
                                    <FormControlLabel
                                      key={c}
                                      value={c}
                                      control={<Radio />}
                                      label={<Typography sx={{ fontWeight: 800 }}>{c}</Typography>}
                                    />
                                  ))}
                                </RadioGroup>
                              </FormControl>

                              <Stack spacing={1}>
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                  Choose which of your dice to trade:
                                </Typography>
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                  {players.P1.hand.map((d, i) => (
                                    <Button
                                      key={d.id}
                                      variant={swapHandIdx === i ? "contained" : "outlined"}
                                      onClick={() => setSwapHandIdx(i)}
                                      sx={{ borderRadius: 2, fontWeight: 900, borderColor: alpha("#94a3b8", 0.22) }}
                                    >
                                      Die {i + 1}
                                    </Button>
                                  ))}
                                </Stack>

                                <Chip
                                  label={`Selected: center=${swapCenterIdx == null ? "-" : swapCenterIdx + 1}, yourDie=${
                                    swapHandIdx == null ? "-" : swapHandIdx + 1
                                  }`}
                                  variant="outlined"
                                  sx={{ alignSelf: "flex-start", opacity: 0.9 }}
                                />
                              </Stack>

                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                <Button
                                  startIcon={<SwapHorizIcon />}
                                  disabled={swapCenterIdx == null || swapHandIdx == null}
                                  onClick={doSwapHuman}
                                  variant="contained"
                                  sx={{ borderRadius: 3, fontWeight: 900 }}
                                >
                                  Confirm Swap (ends turn)
                                </Button>
                                <Button
                                  variant="outlined"
                                  onClick={() => {
                                    setSwapCenterIdx(null);
                                    setSwapHandIdx(null);
                                    setSwapPlaceCorner("UNE");
                                    setPhase("turnStart");
                                  }}
                                  sx={{ borderRadius: 3, fontWeight: 900 }}
                                >
                                  Cancel
                                </Button>
                              </Stack>
                            </>
                          )}
                        </Stack>
                      )}

                      {/* Attack color */}
                      {phase === "attackPickColor" && (
                        <Stack spacing={1.25}>
                          {attacker === "P1" ? (
                            <>
                              <Typography sx={{ fontWeight: 900 }}>Pick an attack color</Typography>
                              <ColorPicker
                                value={exchange.attackColor}
                                onChange={(c) => setExchange((ex) => ({ ...ex, attackColor: c }))}
                              />
                              <Button
                                disabled={!exchange.attackColor}
                                variant="contained"
                                onClick={() => setPhase("secretSelectDice")}
                                sx={{ borderRadius: 3, fontWeight: 900 }}
                              >
                                Continue
                              </Button>
                            </>
                          ) : (
                            <>
                              <Typography sx={{ fontWeight: 900 }}>AI is choosing an attack color…</Typography>
                              {exchange.attackColor && (
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                    AI attacks with
                                  </Typography>
                                  <ColorChip color={exchange.attackColor} />
                                </Stack>
                              )}
                            </>
                          )}
                        </Stack>
                      )}

                      {/* Secret selections */}
                      {phase === "secretSelectDice" && exchange.attackColor && (
                        <Stack spacing={1.25}>
                          <Stack spacing={0.5}>
                            <Typography sx={{ fontWeight: 1000 }}>
                              Secret selections
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                Attack:
                              </Typography>
                              <ColorChip color={exchange.attackColor} />
                              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                Defense:
                              </Typography>
                              <ColorChip color={COLOR_COUNTER[exchange.attackColor]} />
                            </Stack>
                          </Stack>

                          {isHumanAttacker ? (
                            <DiceSelector
                              title="Pick your attack dice to roll"
                              hand={players.P1.hand}
                              picks={exchange.attackerPick}
                              setPicks={(s) => setExchange((ex) => ({ ...ex, attackerPick: s }))}
                            />
                          ) : (
                            <Paper
                              elevation={0}
                              sx={{
                                p: 2,
                                borderRadius: 4,
                                border: `1px solid ${alpha("#94a3b8", 0.16)}`,
                                bgcolor: alpha("#0b1220", 0.3),
                              }}
                            >
                              <Typography sx={{ fontWeight: 900 }}>AI is selecting attack dice (hidden)</Typography>
                              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                Lock in to reveal.
                              </Typography>
                            </Paper>
                          )}

                          {isHumanDefender ? (
                            <DiceSelector
                              title="Pick your defense dice to roll"
                              hand={players.P1.hand}
                              picks={exchange.defenderPick}
                              setPicks={(s) => setExchange((ex) => ({ ...ex, defenderPick: s }))}
                            />
                          ) : (
                            <Paper
                              elevation={0}
                              sx={{
                                p: 2,
                                borderRadius: 4,
                                border: `1px solid ${alpha("#94a3b8", 0.16)}`,
                                bgcolor: alpha("#0b1220", 0.3),
                              }}
                            >
                              <Typography sx={{ fontWeight: 900 }}>AI is selecting defense dice (hidden)</Typography>
                              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                Lock in to reveal.
                              </Typography>
                            </Paper>
                          )}

                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Button
                              startIcon={<VisibilityIcon />}
                              disabled={!canLockIn}
                              onClick={lockInSelectionsAndReveal}
                              variant="contained"
                              sx={{ borderRadius: 3, fontWeight: 900 }}
                            >
                              Lock In & Reveal
                            </Button>
                            <Button
                              variant="outlined"
                              onClick={() => setPhase("turnStart")}
                              sx={{ borderRadius: 3, fontWeight: 900 }}
                            >
                              Cancel
                            </Button>
                          </Stack>
                        </Stack>
                      )}

                      {/* Reveal */}
                      {phase === "reveal" && exchange.attackColor && (
                        <Stack spacing={1.25}>
                          <Typography sx={{ fontWeight: 1000 }}>Reveal</Typography>

                          <Paper
                            elevation={0}
                            sx={{
                              p: 1.5,
                              borderRadius: 4,
                              border: `1px solid ${alpha("#94a3b8", 0.16)}`,
                              bgcolor: alpha("#0b1220", 0.3),
                            }}
                          >
                            <Stack spacing={1}>
                              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                  Attack:
                                </Typography>
                                <ColorChip color={exchange.attackColor} />
                                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                  Defense:
                                </Typography>
                                <ColorChip color={COLOR_COUNTER[exchange.attackColor]} />
                              </Stack>

                              <Divider sx={{ opacity: 0.25 }} />

                              <Stack spacing={1}>
                                <Typography sx={{ fontWeight: 900 }}>
                                  {exchange.attacker === "P1" ? "You" : "AI"} rolled
                                </Typography>
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                  {exchange.attackerRolls.map((r, i) => (
                                    <Chip
                                      key={`a_${i}`}
                                      label={`${r.color} ${r.number}`}
                                      variant="outlined"
                                      sx={{
                                        borderColor: alpha(colorToHex(r.color), 0.45),
                                        bgcolor: alpha(colorToHex(r.color), 0.08),
                                        fontWeight: 900,
                                      }}
                                    />
                                  ))}
                                </Stack>
                                <Typography sx={{ fontWeight: 1000 }}>
                                  Score (matching {exchange.attackColor}):{" "}
                                  <Box component="span" sx={{ color: "primary.main" }}>
                                    {exchange.attackerScore}
                                  </Box>
                                </Typography>
                              </Stack>

                              <Divider sx={{ opacity: 0.25 }} />

                              <Stack spacing={1}>
                                <Typography sx={{ fontWeight: 900 }}>
                                  {exchange.defender === "P1" ? "You" : "AI"} rolled
                                </Typography>
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                  {exchange.defenderRolls.map((r, i) => (
                                    <Chip
                                      key={`d_${i}`}
                                      label={`${r.color} ${r.number}`}
                                      variant="outlined"
                                      sx={{
                                        borderColor: alpha(colorToHex(r.color), 0.45),
                                        bgcolor: alpha(colorToHex(r.color), 0.08),
                                        fontWeight: 900,
                                      }}
                                    />
                                  ))}
                                </Stack>
                                <Typography sx={{ fontWeight: 1000 }}>
                                  Score (matching {COLOR_COUNTER[exchange.attackColor]}):{" "}
                                  <Box component="span" sx={{ color: "secondary.main" }}>
                                    {exchange.defenderScore}
                                  </Box>
                                </Typography>
                              </Stack>

                              <Divider sx={{ opacity: 0.25 }} />

                              <Typography sx={{ fontWeight: 1000 }}>
                                Result:{" "}
                                {exchange.winner == null
                                  ? "Tie — exchange ends."
                                  : exchange.winner === exchange.attacker
                                  ? `${exchange.attacker === "P1" ? "You" : "AI"} wins — defender cannot counter.`
                                  : `${exchange.defender === "P1" ? "You" : "AI"} wins — counter is possible.`}
                              </Typography>

                              <Button
                                variant="contained"
                                onClick={proceedAfterReveal}
                                sx={{ borderRadius: 3, fontWeight: 900 }}
                              >
                                Continue
                              </Button>
                            </Stack>
                          </Paper>
                        </Stack>
                      )}

                      {/* Counter option */}
                      {phase === "counterOption" && (
                        <Stack spacing={1.25}>
                          <Typography sx={{ fontWeight: 1000 }}>Counterattack?</Typography>
                          <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            The defender won and may counter with remaining dice.
                          </Typography>

                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Button
                              variant="contained"
                              onClick={() => doCounter(true)}
                              sx={{ borderRadius: 3, fontWeight: 900 }}
                              disabled={players[exchange.defender].hand.length === 0}
                            >
                              Counterattack
                            </Button>
                            <Button
                              variant="outlined"
                              onClick={() => doCounter(false)}
                              sx={{ borderRadius: 3, fontWeight: 900 }}
                            >
                              Stop (end exchange)
                            </Button>
                          </Stack>

                          {players[exchange.defender].hand.length === 0 && (
                            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                              No dice left to counter.
                            </Typography>
                          )}
                        </Stack>
                      )}

                      {/* Round end */}
                      {phase === "roundEnd" && (
                        <Stack spacing={1.25}>
                          <Typography sx={{ fontWeight: 1000 }}>Exchange ended</Typography>
                          <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            Both players refill to 5 dice. Center refills to 5 dice.
                          </Typography>
                          <Button
                            variant="contained"
                            onClick={endRoundAndRefill}
                            sx={{ borderRadius: 3, fontWeight: 900 }}
                          >
                            Refill & Next Turn
                          </Button>
                        </Stack>
                      )}
                    </CardContent>
                  </Card>
                )}
              </Stack>
            </Grid>
          </Grid>
        </Stack>
      </Box>
    </ThemeProvider>
  );
}
