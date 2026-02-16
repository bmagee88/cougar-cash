// DiceDuel.tsx
// React + TypeScript + MUI — 2-player (Human vs AI) dice duel
// Layout LEFT column (top→bottom): Opponent row, Center row, Player row
// RIGHT column: menus / game flow + settings drawer (slides from right)
// Human can NEVER see AI hand faces
// Player can view ALL sides of their own dice anytime (cube rotates for first 6; extras listed)
// One-life mode: losing an exchange ends the game immediately
// No CssBaseline / No ThemeProvider here (avoids theme.primary undefined crashes)

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  Paper,
  Radio,
  RadioGroup,
  Slider,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";

import CasinoIcon from "@mui/icons-material/Casino";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import ShieldIcon from "@mui/icons-material/Shield";
import RotateLeftIcon from "@mui/icons-material/RotateLeft";
import RotateRightIcon from "@mui/icons-material/RotateRight";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SettingsIcon from "@mui/icons-material/Settings";

type FaceColor = "Blue" | "Red" | "Green" | "Yellow" | "Purple" | "Orange";
type Face = { color: FaceColor; number: number }; // number 1..numberMax

type FaceKey = "U" | "D" | "N" | "E" | "S" | "W";
type CenterCorner = "UNE" | "UES" | "USW" | "UWN";
type PlayerId = "P1" | "AI";

type Phase =
  | "pickFirst"
  | "turnStart"
  | "swapSelect"
  | "attackPickColor"
  | "secretSelectDice"
  | "reveal"
  | "counterOption"
  | "gameOver";

type SettingsState = {
  sides: number; // 2-12
  colorsCount: number; // 1-6
  numberMax: number; // 2-12 (faces roll 1..numberMax)
  handSize: number; // 1-10
  centerSize: number; // 1-10
  swapCount: number; // 1-5 (how many dice can be swapped in one swap action)
  maxRollDice: number; // 1-10 (limit dice selected for rolling)
};

const DEFAULT_SETTINGS: SettingsState = {
  sides: 6,
  colorsCount: 3,
  numberMax: 6,
  handSize: 5,
  centerSize: 5,
  swapCount: 1,
  maxRollDice: 3,
};

const ALL_COLORS: FaceColor[] = ["Blue", "Red", "Green", "Yellow", "Purple", "Orange"];

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
) as Record<FaceColor, FaceColor>;

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

const CUBE_KEYS: FaceKey[] = ["U", "N", "E", "S", "W", "D"]; // for the 3D cube display

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
function randInt(n: number) {
  return Math.floor(Math.random() * n);
}
function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}
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

/** ------------------ Die model (variable sides) ------------------ **/
type Die = {
  id: string;
  faces: Face[]; // length = settings.sides
};

// Signature: exact face list in order (generation order)
function dieSignature(die: Die) {
  return die.faces.map((f, i) => `${i}:${f.color[0]}${f.number}`).join("|");
}

// "No two dice can have the same 3 adjacent sides":
// treat adjacency as circular triples in face array order.
function tripleSignatures(die: Die) {
  const sigs: string[] = [];
  const n = die.faces.length;
  for (let i = 0; i < n; i++) {
    const a = die.faces[i];
    const b = die.faces[(i + 1) % n];
    const c = die.faces[(i + 2) % n];
    sigs.push(`${a.color[0]}${a.number},${b.color[0]}${b.number},${c.color[0]}${c.number}`);
  }
  return sigs;
}

function rollDie(die: Die): Face {
  return die.faces[randInt(die.faces.length)];
}

function sumForColor(rolls: Face[], color: FaceColor) {
  let total = 0;
  for (let i = 0; i < rolls.length; i++) if (rolls[i].color === color) total += rolls[i].number;
  return total;
}

function expectedValueForColor(die: Die, color: FaceColor) {
  let sum = 0;
  for (let i = 0; i < die.faces.length; i++) if (die.faces[i].color === color) sum += die.faces[i].number;
  return sum / die.faces.length;
}

function pickBestAttackColor(hand: Die[], activeColors: FaceColor[]) {
  let best: FaceColor = activeColors[0] ?? "Blue";
  let bestScore = -Infinity;
  for (let i = 0; i < activeColors.length; i++) {
    const c = activeColors[i];
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

/** ------------------ UI atoms ------------------ **/
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

type CubeView =
  | { kind: "corner"; corner: CenterCorner }
  | { kind: "face"; face: FaceKey };

function cubeRotation(view: CubeView): { rx: number; ry: number } {
  if (view.kind === "corner") {
    switch (view.corner) {
      case "UNE":
        return { rx: -25, ry: 45 };
      case "UES":
        return { rx: -25, ry: 135 };
      case "USW":
        return { rx: -25, ry: 225 };
      case "UWN":
        return { rx: -25, ry: 315 };
    }
  }
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

function FaceTile({ face, size, hidden }: { face?: Face; size: number; hidden?: boolean }) {
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
        bgcolor: hidden ? alpha("#94a3b8", 0.1) : alpha(bg, 0.2),
      }}
    >
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

  // map first 6 faces to cube keys (U,N,E,S,W,D)
  const cubeMap = useMemo(() => {
    const map: Partial<Record<FaceKey, Face>> = {};
    if (!die) return map;
    for (let i = 0; i < 6; i++) {
      if (i >= die.faces.length) break;
      map[CUBE_KEYS[i]] = die.faces[i];
    }
    return map;
  }, [die]);

  const face = (k: FaceKey) => (die ? cubeMap[k] : undefined);

  return (
    <Box sx={{ display: "inline-flex", flexDirection: "column", gap: 0.75 }}>
      {label && (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {label}
        </Typography>
      )}

      <Box sx={{ width: size, height: size, perspective: `${size * 6}px` }}>
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
          <Box sx={{ position: "absolute", width: size, height: size, transform: `translateZ(${z}px)` }}>
            <FaceTile face={face("N")} size={size} hidden={hiddenAll} />
          </Box>
          <Box sx={{ position: "absolute", width: size, height: size, transform: `rotateY(180deg) translateZ(${z}px)` }}>
            <FaceTile face={face("S")} size={size} hidden={hiddenAll} />
          </Box>
          <Box sx={{ position: "absolute", width: size, height: size, transform: `rotateY(90deg) translateZ(${z}px)` }}>
            <FaceTile face={face("E")} size={size} hidden={hiddenAll} />
          </Box>
          <Box sx={{ position: "absolute", width: size, height: size, transform: `rotateY(-90deg) translateZ(${z}px)` }}>
            <FaceTile face={face("W")} size={size} hidden={hiddenAll} />
          </Box>
          <Box sx={{ position: "absolute", width: size, height: size, transform: `rotateX(90deg) translateZ(${z}px)` }}>
            <FaceTile face={face("U")} size={size} hidden={hiddenAll} />
          </Box>
          <Box sx={{ position: "absolute", width: size, height: size, transform: `rotateX(-90deg) translateZ(${z}px)` }}>
            <FaceTile face={face("D")} size={size} hidden={hiddenAll} />
          </Box>
        </Box>
      </Box>
    </Box>
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
        <DieCube3D die={undefined} size={66} view={{ kind: "corner", corner: "UNE" }} hiddenAll />
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

function ColorPicker({
  activeColors,
  value,
  onChange,
  label,
}: {
  activeColors: FaceColor[];
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
        {activeColors.map((c) => {
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
              startIcon={<Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: colorToHex(c) }} />}
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

type PlayerState = { id: PlayerId; name: string; hand: Die[] };

type CenterDie = { die: Die; p1Corner: CenterCorner };

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

  winner: PlayerId | null; // null = tie
};

function DiceSelector({
  hand,
  picks,
  setPicks,
  disabled,
  title,
  maxPick,
}: {
  hand: Die[];
  picks: Set<number>;
  setPicks: (s: Set<number>) => void;
  disabled?: boolean;
  title: string;
  maxPick: number;
}) {
  return (
    <Card elevation={0} sx={{ border: `1px solid ${alpha("#94a3b8", 0.16)}` }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography sx={{ fontWeight: 900 }}>{title}</Typography>
          <Chip size="small" label={`${picks.size}/${Math.min(maxPick, hand.length)}`} variant="outlined" sx={{ opacity: 0.85 }} />
        </Stack>

        <Stack spacing={1}>
          {hand.map((die, idx) => {
            const checked = picks.has(idx);
            const atLimit = !checked && picks.size >= Math.min(maxPick, hand.length);

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
                      disabled={disabled || atLimit}
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
                  <Tooltip title={atLimit ? `Max ${maxPick}` : "Secret until reveal"}>
                    <Chip size="small" label={checked ? "Selected" : atLimit ? "Limit" : "Hidden"} variant="outlined" sx={{ opacity: 0.85 }} />
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

/** ------------------ Main component ------------------ **/
export default function DiceDuel() {
  const theme = useTheme();

  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const activeColors = useMemo(
    () => ALL_COLORS.slice(0, clamp(settings.colorsCount, 1, 6)),
    [settings.colorsCount]
  );

  const seenDieSigsRef = useRef<Set<string>>(new Set());
  const seenTripleSigsRef = useRef<Set<string>>(new Set());

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

  const [swapCenterIdxs, setSwapCenterIdxs] = useState<number[]>([]);
  const [swapHandIdxs, setSwapHandIdxs] = useState<number[]>([]);
  const [swapPlaceCorner, setSwapPlaceCorner] = useState<CenterCorner>("UNE");

  // player view controls
  const [p1DieViews, setP1DieViews] = useState<Record<string, CubeView>>({});

  const attacker = exchange.attacker;
  const defender = exchange.defender;

  const canLockIn =
    phase === "secretSelectDice" &&
    exchange.attackColor != null &&
    (attacker !== "P1" || exchange.attackerPick.size > 0) &&
    (defender !== "P1" || exchange.defenderPick.size > 0);

  /** ---------- generation ---------- */
  function generateUniqueDie(): Die {
    const sides = clamp(settings.sides, 2, 12);
    const numberMax = clamp(settings.numberMax, 2, 12);
    const colors = activeColors.length ? activeColors : (["Blue"] as FaceColor[]);

    for (let guard = 0; guard < 25000; guard++) {
      const faces: Face[] = Array.from({ length: sides }, () => ({
        color: colors[randInt(colors.length)],
        number: randInt(numberMax) + 1,
      }));

      const die: Die = { id: uid("die"), faces };

      const sig = dieSignature(die);
      if (seenDieSigsRef.current.has(sig)) continue;

      const triples = tripleSignatures(die);
      let collision = false;
      for (let i = 0; i < triples.length; i++) {
        if (seenTripleSigsRef.current.has(triples[i])) {
          collision = true;
          break;
        }
      }
      if (collision) continue;

      seenDieSigsRef.current.add(sig);
      for (let i = 0; i < triples.length; i++) seenTripleSigsRef.current.add(triples[i]);

      return die;
    }

    // If constraints get too tight, relax triple uniqueness (keep full uniqueness)
    seenTripleSigsRef.current.clear();
    return generateUniqueDie();
  }

  function genCenterDie(): CenterDie {
    const corners: CenterCorner[] = ["UNE", "UES", "USW", "UWN"];
    return { die: generateUniqueDie(), p1Corner: corners[randInt(4)] };
  }

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

  /** ---------- init / reset ---------- */
  function initGame(first: PlayerId) {
    // clear seen sets (new “world”)
    seenDieSigsRef.current = new Set();
    seenTripleSigsRef.current = new Set();

    const handSize = clamp(settings.handSize, 1, 10);
    const centerSize = clamp(settings.centerSize, 1, 10);

    const p1Hand = Array.from({ length: handSize }, () => generateUniqueDie());
    const aiHand = Array.from({ length: handSize }, () => generateUniqueDie());
    const c = Array.from({ length: centerSize }, () => genCenterDie());

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

    setSwapCenterIdxs([]);
    setSwapHandIdxs([]);
    setSwapPlaceCorner("UNE");

    setP1DieViews({});
    ensureP1Views(p1Hand);

    setPhase("turnStart");
  }

  useEffect(() => {
    ensureP1Views(players.P1.hand);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.P1.hand.length]);

  /** ---------- turn actions ---------- */
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
    if (turnAttacker !== "P1") return;

    const swapCount = clamp(settings.swapCount, 1, 5);
    if (swapCenterIdxs.length !== swapCount || swapHandIdxs.length !== swapCount) return;

    // perform swap pairs by index order
    setPlayers((prev) => {
      const p1 = prev.P1;
      const newHand = [...p1.hand];

      // incoming dice collected first (so multiple swaps don’t overwrite)
      const incomingDice: Die[] = swapCenterIdxs.map((ci) => center[ci].die);
      for (let k = 0; k < swapCount; k++) {
        newHand[swapHandIdxs[k]] = incomingDice[k];
      }

      return { ...prev, P1: { ...p1, hand: newHand } };
    });

    setCenter((prev) => {
      const next = [...prev];

      // outgoing dice
      const outgoingDice: Die[] = swapHandIdxs.map((hi) => players.P1.hand[hi]);

      for (let k = 0; k < swapCount; k++) {
        next[swapCenterIdxs[k]] = { die: outgoingDice[k], p1Corner: swapPlaceCorner };
      }
      return next;
    });

    setSwapCenterIdxs([]);
    setSwapHandIdxs([]);
    setSwapPlaceCorner("UNE");

    // end turn
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
    const centerSize = center.length;
    const swapCount = clamp(settings.swapCount, 1, 5);

    // simple AI: if it has fewer dice than handSize, prioritize swap when possible
    if (centerSize >= swapCount && ai.hand.length >= swapCount && Math.random() < 0.35) {
      // choose center dice
      const chosenCenter: number[] = [];
      const used = new Set<number>();
      while (chosenCenter.length < swapCount) {
        const idx = randInt(centerSize);
        if (!used.has(idx)) {
          used.add(idx);
          chosenCenter.push(idx);
        }
      }

      // give away “worst” dice
      const scored = ai.hand
        .map((d, i) => ({
          i,
          best: Math.max.apply(
            null,
            activeColors.map((c) => expectedValueForColor(d, c))
          ),
        }))
        .sort((a, b) => a.best - b.best)
        .slice(0, swapCount)
        .map((x) => x.i);

      const chosenCorner = (["UNE", "UES", "USW", "UWN"] as CenterCorner[])[randInt(4)];

      const incomingDice = chosenCenter.map((ci) => center[ci].die);
      const outgoingDice = scored.map((hi) => ai.hand[hi]);

      setPlayers((prev) => {
        const next = { ...prev };
        const newHand = [...next.AI.hand];
        for (let k = 0; k < swapCount; k++) {
          newHand[scored[k]] = incomingDice[k];
        }
        next.AI = { ...next.AI, hand: newHand };
        return next;
      });

      setCenter((prev) => {
        const next = [...prev];
        for (let k = 0; k < swapCount; k++) {
          next[chosenCenter[k]] = { die: outgoingDice[k], p1Corner: chosenCorner };
        }
        return next;
      });

      // end turn
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

  useEffect(() => {
    if (phase === "turnStart" && turnAttacker === "AI") {
      const t = window.setTimeout(() => aiDecideTurn(), 220);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, turnAttacker]);

  useEffect(() => {
    if (phase === "attackPickColor" && exchange.attacker === "AI") {
      const c = pickBestAttackColor(players.AI.hand, activeColors);
      setExchange((ex) => ({ ...ex, attackColor: c }));
      const t = window.setTimeout(() => setPhase("secretSelectDice"), 200);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, exchange.attacker, players.AI.hand.length, activeColors.join("|")]);

  function lockInSelectionsAndReveal() {
    const atkHand = players[attacker].hand;
    const defHand = players[defender].hand;
    const attackColor = exchange.attackColor;
    if (!attackColor) return;

    let attackerPick = exchange.attackerPick;
    let defenderPick = exchange.defenderPick;

    const maxRoll = clamp(settings.maxRollDice, 1, 10);

    if (attacker === "AI") attackerPick = pickDiceToRoll(atkHand, attackColor, maxRoll);
    if (defender === "AI") defenderPick = pickDiceToRoll(defHand, COLOR_COUNTER[attackColor], maxRoll);

    const atkIdxs = Array.from(attackerPick).filter((i) => i >= 0 && i < atkHand.length).slice(0, maxRoll);
    const defIdxs = Array.from(defenderPick).filter((i) => i >= 0 && i < defHand.length).slice(0, maxRoll);

    const atkRollFaces: Face[] = [];
    const defRollFaces: Face[] = [];

    for (let i = 0; i < atkIdxs.length; i++) atkRollFaces.push(rollDie(atkHand[atkIdxs[i]]));
    for (let i = 0; i < defIdxs.length; i++) defRollFaces.push(rollDie(defHand[defIdxs[i]]));

    const defColor = COLOR_COUNTER[attackColor];
    const atkScore = sumForColor(atkRollFaces, attackColor);
    const defScore = sumForColor(defRollFaces, defColor);

    const winner: PlayerId | null =
      atkScore === defScore ? null : atkScore > defScore ? attacker : defender;

    // remove rolled dice from hands
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
    // ONE LIFE:
    // - tie => exchange ends, but nobody loses
    // - attacker wins => defender loses game now
    // - defender wins => defender may counter OR stop (stopping means attacker loses now)
    const w = exchange.winner;
    if (!w) {
      // no death, next turn
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
      return;
    }

    if (w === exchange.attacker) {
      // defender dies immediately
      setPhase("gameOver");
      return;
    }

    // defender won => can counter
    setPhase("counterOption");
  }

  function doCounter(yes: boolean) {
    if (!exchange.attackColor) return;

    if (!yes) {
      // defender stops => attacker dies (one life)
      setPhase("gameOver");
      return;
    }

    const nextAttacker = exchange.defender;
    const nextDefender = exchange.attacker;

    if (nextAttacker === "AI") {
      const attackColor = pickBestAttackColor(players.AI.hand, activeColors);
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

  /** ---------- view widgets ---------- */
  function PlayerDieCard({ die, index }: { die: Die; index: number }) {
    const view = p1DieViews[die.id] ?? ({ kind: "corner", corner: "UNE" } as CubeView);

    const setView = (v: CubeView) => setP1DieViews((prev) => ({ ...prev, [die.id]: v }));

    const cornerCycle: CenterCorner[] = ["UNE", "UES", "USW", "UWN"];

    return (
      <Paper
        elevation={0}
        sx={{
          p: 1.25,
          borderRadius: 3,
          border: `1px solid ${alpha("#94a3b8", 0.14)}`,
          bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.12 : 0.82),
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Your Die {index + 1} • {die.faces.length} sides
          </Typography>
          <Chip
            size="small"
            label={view.kind === "face" ? `Face ${view.face}` : `Corner ${view.corner}`}
            variant="outlined"
            sx={{ opacity: 0.9 }}
          />
        </Stack>

        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1 }}>
          <DieCube3D die={die} size={74} view={view} />

          <Stack spacing={1} sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Rotate faces (cube shows first 6; extra faces listed)
            </Typography>

            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {(["U", "N", "E", "S", "W", "D"] as FaceKey[]).map((k) => (
                <Button
                  key={k}
                  size="small"
                  variant={view.kind === "face" && view.face === k ? "contained" : "outlined"}
                  onClick={() => setView({ kind: "face", face: k })}
                  sx={{ minWidth: 40, borderRadius: 2, fontWeight: 900, borderColor: alpha("#94a3b8", 0.22) }}
                >
                  {k}
                </Button>
              ))}
              <Button
                size="small"
                variant={view.kind === "corner" ? "contained" : "outlined"}
                onClick={() => setView({ kind: "corner", corner: "UNE" })}
                sx={{ borderRadius: 2, fontWeight: 900, borderColor: alpha("#94a3b8", 0.22) }}
              >
                3D
              </Button>
            </Stack>

            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                startIcon={<RotateLeftIcon />}
                onClick={() => {
                  const cur = view.kind === "corner" ? view.corner : "UNE";
                  const idx = cornerCycle.indexOf(cur);
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
                  const cur = view.kind === "corner" ? view.corner : "UNE";
                  const idx = cornerCycle.indexOf(cur);
                  const next = cornerCycle[(idx + 1) % cornerCycle.length];
                  setView({ kind: "corner", corner: next });
                }}
                variant="outlined"
                sx={{ borderRadius: 2, fontWeight: 900, borderColor: alpha("#94a3b8", 0.22) }}
              >
                Corner
              </Button>
            </Stack>

            {die.faces.length > 6 && (
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                {die.faces.slice(6).map((f, i) => (
                  <Chip
                    key={i}
                    size="small"
                    label={`${f.color} ${f.number}`}
                    variant="outlined"
                    sx={{
                      borderColor: alpha(colorToHex(f.color), 0.45),
                      bgcolor: alpha(colorToHex(f.color), 0.08),
                      fontWeight: 900,
                    }}
                  />
                ))}
              </Stack>
            )}
          </Stack>
        </Stack>
      </Paper>
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
    const corner = viewer === "P1" ? centerDie.p1Corner : OPPOSITE_CORNER[centerDie.p1Corner];
    return (
      <Paper
        onClick={onClick}
        elevation={0}
        sx={{
          p: 1.25,
          borderRadius: 3,
          cursor: onClick ? "pointer" : "default",
          border: `1px solid ${selected ? alpha(theme.palette.primary.main, 0.55) : alpha("#94a3b8", 0.16)}`,
          bgcolor: selected ? alpha(theme.palette.primary.main, 0.08) : alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.12 : 0.85),
          transition: "140ms",
          "&:hover": onClick
            ? { borderColor: alpha(theme.palette.primary.main, 0.65), bgcolor: alpha(theme.palette.primary.main, 0.1) }
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

  /** ---------- Swap selection helpers ---------- */
  const swapCount = clamp(settings.swapCount, 1, 5);

  const togglePick = (arr: number[], idx: number, max: number) => {
    const has = arr.includes(idx);
    if (has) return arr.filter((x) => x !== idx);
    if (arr.length >= max) return arr;
    return [...arr, idx];
  };

  /** ------------------ Render ------------------ **/
  const bgCard = alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.22 : 0.9);

  const winnerText = useMemo(() => {
    if (phase !== "gameOver") return "";
    const w = exchange.winner;
    if (!w) return "Game Over";
    if (w === exchange.attacker) return `${exchange.attacker === "P1" ? "You" : "AI"} won the exchange.`;
    // defender won and chose stop => attacker lost
    return `${exchange.defender === "P1" ? "You" : "AI"} ended the exchange and won.`;
  }, [phase, exchange]);

  return (
    <Box sx={{ minHeight: "100vh", p: { xs: 2, md: 3 } }}>
      <Stack spacing={2} sx={{ maxWidth: 1400, mx: "auto" }}>
        {/* Header */}
        <Stack direction={{ xs: "column", md: "row" }} alignItems={{ md: "center" }} justifyContent="space-between" spacing={1}>
          <Stack spacing={0.25}>
            <Typography variant="h4" sx={{ fontWeight: 1000, letterSpacing: -0.6 }}>
              Dice Duel (One Life)
            </Typography>
            <Typography sx={{ color: "text.secondary" }}>
              Left = board (AI / center / you) • Right = flow + settings
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <FormControlLabel
              control={<Switch checked={showHelp} onChange={(e) => setShowHelp(e.target.checked)} />}
              label="Show help"
            />
            <Button
              startIcon={<SettingsIcon />}
              variant="outlined"
              onClick={() => setSettingsOpen(true)}
              sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
            >
              Settings
            </Button>
            <Button
              startIcon={<RestartAltIcon />}
              variant="outlined"
              onClick={() => setPhase("pickFirst")}
              sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
            >
              Reset
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
              bgcolor: bgCard,
            }}
          >
            <Stack spacing={1}>
              <Typography sx={{ fontWeight: 900 }}>Rules snapshot (one life)</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                On your turn as attacker: <b>Attack</b> (pick a color) or <b>Swap</b> dice with the center (ends turn).
                If you lose an exchange, you lose the game immediately.
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {activeColors.map((c) => (
                  <Box key={c} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <ColorChip color={c} />
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      beats {COLOR_BEATS[c]}
                    </Typography>
                  </Box>
                ))}
              </Stack>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                AI hand is always hidden.
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
              <Card elevation={0} sx={{ border: `1px solid ${alpha("#94a3b8", 0.16)}`, bgcolor: bgCard }}>
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
              <Card elevation={0} sx={{ border: `1px solid ${alpha("#94a3b8", 0.16)}`, bgcolor: bgCard }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                    <Typography sx={{ fontWeight: 1000 }}>Center Pool</Typography>
                    <Chip size="small" label={`${center.length}/${clamp(settings.centerSize, 1, 10)}`} variant="outlined" />
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
                          selected={phase === "swapSelect" && swapCenterIdxs.includes(idx)}
                          onClick={
                            phase === "swapSelect" && turnAttacker === "P1"
                              ? () => setSwapCenterIdxs((prev) => togglePick(prev, idx, swapCount))
                              : undefined
                          }
                        />
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>

              {/* Player row */}
              <Card elevation={0} sx={{ border: `1px solid ${alpha("#94a3b8", 0.16)}`, bgcolor: bgCard }}>
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
                    Hand: <b>{players.P1.hand.length}</b> dice
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
                <Card elevation={0} sx={{ border: `1px solid ${alpha("#94a3b8", 0.16)}`, bgcolor: bgCard }}>
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
                <Card elevation={0} sx={{ border: `1px solid ${alpha("#94a3b8", 0.16)}`, bgcolor: bgCard }}>
                  <CardContent>
                    <Stack spacing={1}>
                      <Typography sx={{ fontWeight: 1000 }}>Game Flow</Typography>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Attacker: <b>{turnAttacker === "P1" ? "You" : "AI"}</b>
                      </Typography>
                      <Chip label={`Phase: ${phase}`} variant="outlined" sx={{ alignSelf: "flex-start", opacity: 0.9 }} />
                    </Stack>

                    <Divider sx={{ my: 1.5, opacity: 0.25 }} />

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
                                Swap ×{swapCount} (ends turn)
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

                    {phase === "swapSelect" && (
                      <Stack spacing={1.25}>
                        {turnAttacker !== "P1" ? (
                          <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            AI swapping…
                          </Typography>
                        ) : (
                          <>
                            <Typography sx={{ fontWeight: 900 }}>Swap ×{swapCount}</Typography>
                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                              Select {swapCount} center dice (click in center row), then select {swapCount} of your dice below,
                              choose the AI-facing corner, and confirm.
                            </Typography>

                            <FormControl>
                              <Typography variant="caption" sx={{ color: "text.secondary", mb: 0.5 }}>
                                AI-facing corner on the die you place into center
                              </Typography>
                              <RadioGroup row value={swapPlaceCorner} onChange={(e) => setSwapPlaceCorner(e.target.value as CenterCorner)}>
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
                                Choose your dice to trade:
                              </Typography>
                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                {players.P1.hand.map((d, i) => (
                                  <Button
                                    key={d.id}
                                    variant={swapHandIdxs.includes(i) ? "contained" : "outlined"}
                                    onClick={() => setSwapHandIdxs((prev) => togglePick(prev, i, swapCount))}
                                    sx={{ borderRadius: 2, fontWeight: 900, borderColor: alpha("#94a3b8", 0.22) }}
                                  >
                                    Die {i + 1}
                                  </Button>
                                ))}
                              </Stack>

                              <Chip
                                label={`Selected: center=${swapCenterIdxs.length}/${swapCount}, yourDice=${swapHandIdxs.length}/${swapCount}`}
                                variant="outlined"
                                sx={{ alignSelf: "flex-start", opacity: 0.9 }}
                              />
                            </Stack>

                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                              <Button
                                startIcon={<SwapHorizIcon />}
                                disabled={swapCenterIdxs.length !== swapCount || swapHandIdxs.length !== swapCount}
                                onClick={doSwapHuman}
                                variant="contained"
                                sx={{ borderRadius: 3, fontWeight: 900 }}
                              >
                                Confirm Swap (ends turn)
                              </Button>
                              <Button
                                variant="outlined"
                                onClick={() => {
                                  setSwapCenterIdxs([]);
                                  setSwapHandIdxs([]);
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

                    {phase === "attackPickColor" && (
                      <Stack spacing={1.25}>
                        {attacker === "P1" ? (
                          <>
                            <Typography sx={{ fontWeight: 900 }}>Pick an attack color</Typography>
                            <ColorPicker
                              activeColors={activeColors}
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

                    {phase === "secretSelectDice" && exchange.attackColor && (
                      <Stack spacing={1.25}>
                        <Stack spacing={0.5}>
                          <Typography sx={{ fontWeight: 1000 }}>Secret selections</Typography>
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

                        {attacker === "P1" ? (
                          <DiceSelector
                            title="Pick your attack dice to roll"
                            hand={players.P1.hand}
                            picks={exchange.attackerPick}
                            setPicks={(s) => setExchange((ex) => ({ ...ex, attackerPick: s }))}
                            maxPick={clamp(settings.maxRollDice, 1, 10)}
                          />
                        ) : (
                          <Paper elevation={0} sx={{ p: 2, borderRadius: 4, border: `1px solid ${alpha("#94a3b8", 0.16)}`, bgcolor: bgCard }}>
                            <Typography sx={{ fontWeight: 900 }}>AI is selecting attack dice (hidden)</Typography>
                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                              Lock in to reveal.
                            </Typography>
                          </Paper>
                        )}

                        {defender === "P1" ? (
                          <DiceSelector
                            title="Pick your defense dice to roll"
                            hand={players.P1.hand}
                            picks={exchange.defenderPick}
                            setPicks={(s) => setExchange((ex) => ({ ...ex, defenderPick: s }))}
                            maxPick={clamp(settings.maxRollDice, 1, 10)}
                          />
                        ) : (
                          <Paper elevation={0} sx={{ p: 2, borderRadius: 4, border: `1px solid ${alpha("#94a3b8", 0.16)}`, bgcolor: bgCard }}>
                            <Typography sx={{ fontWeight: 900 }}>AI is selecting defense dice (hidden)</Typography>
                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                              Lock in to reveal.
                            </Typography>
                          </Paper>
                        )}

                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          <Button
                            disabled={!canLockIn}
                            onClick={lockInSelectionsAndReveal}
                            variant="contained"
                            sx={{ borderRadius: 3, fontWeight: 900 }}
                          >
                            Lock In & Reveal
                          </Button>
                          <Button variant="outlined" onClick={() => setPhase("turnStart")} sx={{ borderRadius: 3, fontWeight: 900 }}>
                            Cancel
                          </Button>
                        </Stack>
                      </Stack>
                    )}

                    {phase === "reveal" && exchange.attackColor && (
                      <Stack spacing={1.25}>
                        <Typography sx={{ fontWeight: 1000 }}>Reveal</Typography>

                        <Paper elevation={0} sx={{ p: 1.5, borderRadius: 4, border: `1px solid ${alpha("#94a3b8", 0.16)}`, bgcolor: bgCard }}>
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
                              <Typography sx={{ fontWeight: 900 }}>{exchange.attacker === "P1" ? "You" : "AI"} rolled</Typography>
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
                              <Typography sx={{ fontWeight: 900 }}>{exchange.defender === "P1" ? "You" : "AI"} rolled</Typography>
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
                                ? "Tie — nobody loses (one-life)."
                                : exchange.winner === exchange.attacker
                                ? `${exchange.attacker === "P1" ? "You" : "AI"} won — game ends now.`
                                : `${exchange.defender === "P1" ? "You" : "AI"} won — may counter or stop.`}
                            </Typography>

                            <Button variant="contained" onClick={proceedAfterReveal} sx={{ borderRadius: 3, fontWeight: 900 }}>
                              Continue
                            </Button>
                          </Stack>
                        </Paper>
                      </Stack>
                    )}

                    {phase === "counterOption" && (
                      <Stack spacing={1.25}>
                        <Typography sx={{ fontWeight: 1000 }}>Counterattack?</Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          Defender won. In one-life mode, choosing <b>Stop</b> ends the game (attacker loses). Choosing <b>Counter</b> continues.
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
                          <Button variant="outlined" onClick={() => doCounter(false)} sx={{ borderRadius: 3, fontWeight: 900 }}>
                            Stop (win now)
                          </Button>
                        </Stack>

                        {players[exchange.defender].hand.length === 0 && (
                          <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            No dice left to counter.
                          </Typography>
                        )}
                      </Stack>
                    )}

                    {phase === "gameOver" && (
                      <Stack spacing={1.25}>
                        <Typography variant="h6" sx={{ fontWeight: 1000 }}>
                          Game Over
                        </Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          {winnerText}
                        </Typography>

                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          <Button variant="contained" onClick={() => setPhase("pickFirst")} sx={{ borderRadius: 3, fontWeight: 900 }}>
                            New Game
                          </Button>
                          <Button variant="outlined" onClick={() => setSettingsOpen(true)} sx={{ borderRadius: 3, fontWeight: 900 }}>
                            Adjust Settings
                          </Button>
                        </Stack>
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              )}
            </Stack>
          </Grid>
        </Grid>
      </Stack>

      {/* Settings drawer */}
      <Drawer anchor="right" open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <Box sx={{ width: 340, p: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography sx={{ fontWeight: 1000, fontSize: 18 }}>Game Settings</Typography>
            <IconButton onClick={() => setSettingsOpen(false)}>
              <SettingsIcon />
            </IconButton>
          </Stack>

          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Changing settings affects new games (click Reset → pick first).
          </Typography>

          <Divider sx={{ my: 1.5 }} />

          <Stack spacing={2}>
            <SettingSlider
              label="Die sides"
              value={settings.sides}
              min={2}
              max={12}
              step={1}
              onChange={(v) => setSettings((s) => ({ ...s, sides: v }))}
            />
            <SettingSlider
              label="Colors used"
              value={settings.colorsCount}
              min={1}
              max={6}
              step={1}
              onChange={(v) => setSettings((s) => ({ ...s, colorsCount: v }))}
            />
            <SettingSlider
              label="Max number on face"
              value={settings.numberMax}
              min={2}
              max={12}
              step={1}
              onChange={(v) => setSettings((s) => ({ ...s, numberMax: v }))}
            />

            <Divider />

            <SettingSlider
              label="Hand size"
              value={settings.handSize}
              min={1}
              max={10}
              step={1}
              onChange={(v) => setSettings((s) => ({ ...s, handSize: v }))}
            />
            <SettingSlider
              label="Center dice"
              value={settings.centerSize}
              min={1}
              max={10}
              step={1}
              onChange={(v) => setSettings((s) => ({ ...s, centerSize: v }))}
            />
            <SettingSlider
              label="Dice swapped per swap"
              value={settings.swapCount}
              min={1}
              max={5}
              step={1}
              onChange={(v) => setSettings((s) => ({ ...s, swapCount: v }))}
            />
            <SettingSlider
              label="Max dice rolled per side"
              value={settings.maxRollDice}
              min={1}
              max={10}
              step={1}
              onChange={(v) => setSettings((s) => ({ ...s, maxRollDice: v }))}
            />

            <Divider />

            <Button
              startIcon={<RestartAltIcon />}
              variant="contained"
              onClick={() => {
                setSettingsOpen(false);
                setPhase("pickFirst");
              }}
              sx={{ borderRadius: 3, fontWeight: 900 }}
            >
              Apply & Start New Game
            </Button>
          </Stack>
        </Box>
      </Drawer>
    </Box>
  );
}

/** small helper component for sliders */
function SettingSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography sx={{ fontWeight: 900 }}>{label}</Typography>
        <Chip size="small" label={value} variant="outlined" sx={{ opacity: 0.9 }} />
      </Stack>
      <Slider value={value} min={min} max={max} step={step} onChange={(_, v) => onChange(v as number)} />
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        {min}–{max}
      </Typography>
    </Box>
  );
}
