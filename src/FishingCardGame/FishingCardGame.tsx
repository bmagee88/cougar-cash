import React, { useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  CssBaseline,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { alpha, createTheme, ThemeProvider } from "@mui/material/styles";
import AnchorIcon from "@mui/icons-material/Anchor";
import CasinoIcon from "@mui/icons-material/Casino";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import NorthIcon from "@mui/icons-material/North";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SouthIcon from "@mui/icons-material/South";
import SpeedIcon from "@mui/icons-material/Speed";
import StraightenIcon from "@mui/icons-material/Straighten";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import TuneIcon from "@mui/icons-material/Tune";
import WavesIcon from "@mui/icons-material/Waves";

type AnglerAction = "pull" | "reel" | "slack" | "rest";
type FishAction =
  | "moveAway"
  | "moveToward"
  | "moveUp"
  | "moveDown"
  | "jump"
  | "shake"
  | "hide";
type RodPosition = "up" | "down";
type RodStiffness = "soft" | "stiff";
type Terrain = "clear" | "muck" | "cover";
type GameStatus = "playing" | "caught" | "escaped" | "snapped";
type Depth = 0 | 1 | 2;

type Settings = {
  rodStiffness: RodStiffness;
  reelGear: number;
  lineTest: number;
  drag: number;
  castDistance: number;
  spoolCapacity: number;
  fishVigor: number;
  muckChance: number;
  coverChance: number;
};

type FishProfile = {
  id: string;
  name: string;
  vigor: number;
  strength: number;
  weight: number;
  temperament: string;
  detail: string;
  color: string;
  legendary?: boolean;
};

type EscapeRoll = {
  kind: "jump" | "hide" | "shake";
  target: number;
  die: number;
  escaped: boolean;
};

type RoundSummary = {
  round: number;
  anglerAction: AnglerAction;
  fishAction: FishAction;
  rawFishAction: FishAction;
  fishForce: number;
  tensionBefore: number;
  tensionAfter: number;
  lineBefore: number;
  lineAfter: number;
  depthBefore: Depth;
  depthAfter: Depth;
  terrainBefore: Terrain;
  terrainAfter: Terrain;
  escapeRoll?: EscapeRoll;
  notes: string[];
  status: GameStatus;
};

type GameState = {
  tension: number;
  rodPosition: RodPosition;
  lineOut: number;
  fishDepth: Depth;
  terrain: Terrain;
  status: GameStatus;
  round: number;
  fish: FishProfile;
  log: string[];
  lastRound?: RoundSummary;
};

type GameBundle = {
  settings: Settings;
  game: GameState;
};

type RollNotice = {
  id: string;
  kind: EscapeRoll["kind"];
  phase: "waiting" | "result" | "leaving";
  roll?: EscapeRoll;
  noRollReason?: string;
};

const TENSION_MIN = -20;
const TENSION_MAX = 20;

const BASE_SETTINGS: Settings = {
  rodStiffness: "stiff",
  reelGear: 2,
  lineTest: 12,
  drag: 8,
  castDistance: 18,
  spoolCapacity: 36,
  fishVigor: 2,
  muckChance: 17,
  coverChance: 17,
};

const DEPTH_LABELS: Record<Depth, string> = {
  0: "Top",
  1: "Mid",
  2: "Bottom",
};

const TERRAIN_LABELS: Record<Terrain, string> = {
  clear: "Clear water",
  muck: "Muck",
  cover: "Grass cover",
};

const FISH_ACTIONS: FishAction[] = [
  "moveAway",
  "moveToward",
  "moveUp",
  "moveDown",
  "jump",
  "shake",
  "hide",
];

const FISH_ACTION_LABELS: Record<FishAction, string> = {
  moveAway: "Move away",
  moveToward: "Move toward",
  moveUp: "Move up",
  moveDown: "Move down",
  jump: "Jump",
  shake: "Shake",
  hide: "Hide",
};

const ANGLER_ACTION_LABELS: Record<AnglerAction, string> = {
  pull: "Pull",
  reel: "Reel",
  slack: "Slack",
  rest: "Rest",
};

const FISH_LIBRARY: Omit<FishProfile, "id">[] = [
  {
    name: "Creek smallmouth",
    vigor: 1,
    strength: 1,
    weight: 2,
    temperament: "quick turns",
    detail: "Light runs, quick direction changes, and a low ceiling on brute force.",
    color: "#b88352",
  },
  {
    name: "River trout",
    vigor: 2,
    strength: 2,
    weight: 3,
    temperament: "surface bursts",
    detail: "Likes to climb in the water column and punish loose line with sudden jumps.",
    color: "#7da5a8",
  },
  {
    name: "Channel catfish",
    vigor: 2,
    strength: 3,
    weight: 5,
    temperament: "bottom pressure",
    detail: "Leans downward, digs into cover, and makes steady pressure dangerous.",
    color: "#6f7d68",
  },
  {
    name: "Northern pike",
    vigor: 3,
    strength: 3,
    weight: 4,
    temperament: "hard runs",
    detail: "Explosive runs away from the angler and violent head shakes near the boat.",
    color: "#6c8c43",
  },
  {
    name: "Old lake sturgeon",
    vigor: 4,
    strength: 4,
    weight: 8,
    temperament: "legendary weight",
    detail: "A legendary fish that can strip drag fast if the line is already tight.",
    color: "#7a7480",
    legendary: true,
  },
];

const fishingTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#0f766e",
      dark: "#115e59",
      light: "#5eead4",
      contrastText: "#f8fafc",
    },
    secondary: {
      main: "#be123c",
    },
    success: {
      main: "#15803d",
    },
    warning: {
      main: "#b45309",
    },
    error: {
      main: "#b91c1c",
    },
    background: {
      default: "#f4f7ef",
      paper: "#fffdf7",
    },
    text: {
      primary: "#17211f",
      secondary: "#52615d",
    },
    divider: "rgba(31, 41, 55, 0.16)",
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 800,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid rgba(31, 41, 55, 0.14)",
          boxShadow: "0 14px 30px rgba(15, 23, 42, 0.10)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
  },
});

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function rollInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function plural(value: number, word: string) {
  return `${value} ${word}${value === 1 ? "" : "s"}`;
}

function signed(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}

function stiffnessUnits(stiffness: RodStiffness) {
  return stiffness === "stiff" ? 2 : 1;
}

function randomChoice<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function createFishProfile() {
  const base = randomChoice(FISH_LIBRARY);
  return {
    ...base,
    id: `fish-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
  };
}

function createGame(settings: Settings, fish: FishProfile): GameState {
  return {
    tension: 0,
    rodPosition: "down",
    lineOut: settings.castDistance,
    fishDepth: 1,
    terrain: "clear",
    status: "playing",
    round: 1,
    fish,
    log: [
      `A fish is on. Cast distance set to ${plural(
        settings.castDistance,
        "line unit",
      )}.`,
    ],
  };
}

function createInitialBundle(): GameBundle {
  const fish = createFishProfile();
  const settings = { ...BASE_SETTINGS, fishVigor: fish.vigor };
  return {
    settings,
    game: createGame(settings, fish),
  };
}

function normalizeFishAction(action: FishAction, depth: Depth): FishAction {
  if (action === "moveUp" && depth === 0) return "jump";
  if (action === "jump" && depth !== 0) return "moveUp";
  if (action === "moveDown" && depth === 2) return "hide";
  if (action === "hide" && depth !== 2) return "moveDown";
  return action;
}

function moveDepth(depth: Depth, delta: number): Depth {
  return clamp(depth + delta, 0, 2) as Depth;
}

function rollTerrain(settings: Settings): Terrain {
  const muck = clamp(settings.muckChance, 0, 100);
  const cover = clamp(settings.coverChance, 0, 100 - muck);
  const roll = Math.random() * 100;
  if (roll < muck) return "muck";
  if (roll < muck + cover) return "cover";
  return "clear";
}

function statusCopy(status: GameStatus) {
  if (status === "caught") return "Fish caught";
  if (status === "escaped") return "Fish escaped";
  if (status === "snapped") return "Line snapped";
  return "Fish on";
}

function resolveRound(
  game: GameState,
  settings: Settings,
  anglerAction: AnglerAction,
): GameState {
  if (game.status !== "playing") return game;

  const round = game.round;
  const rawFishAction = randomChoice(FISH_ACTIONS);
  const fishAction = normalizeFishAction(rawFishAction, game.fishDepth);
  const fishForce = rollInt(1, settings.fishVigor);
  const rodForce = stiffnessUnits(settings.rodStiffness);
  const reelForce = settings.reelGear;
  const initialRodPosition = game.rodPosition;
  const tensionBefore = game.tension;
  const lineBefore = game.lineOut;
  const depthBefore = game.fishDepth;
  const terrainBefore = game.terrain;
  const notes: string[] = [];

  let tension = game.tension;
  let lineOut = game.lineOut;
  let fishDepth = game.fishDepth;
  let terrain = game.terrain;
  let rodPosition = game.rodPosition;
  let status: GameStatus = "playing";
  let escapeRoll: EscapeRoll | undefined;

  const canPull = anglerAction === "pull" && initialRodPosition === "down";
  const canSlack = anglerAction === "slack" && initialRodPosition === "up";
  const pullForce = canPull ? rodForce : 0;
  const slackForce = canSlack ? rodForce : 0;

  if (anglerAction === "pull") {
    if (canPull) rodPosition = "up";
    else notes.push("Pull had no rod force because the tip was already up.");
  }

  if (anglerAction === "slack") {
    if (canSlack) rodPosition = "down";
    else notes.push("Slack had no rod force because the tip was already down.");
  }

  if (rawFishAction !== fishAction) {
    notes.push(
      `${FISH_ACTION_LABELS[rawFishAction]} converted to ${FISH_ACTION_LABELS[
        fishAction
      ].toLowerCase()} at the boundary.`,
    );
  }

  if (anglerAction === "rest") {
    notes.push("Rest added no angler force; the fish set the pressure direction.");
  }

  const checkSpool = () => {
    if (lineOut > settings.spoolCapacity) {
      const excess = lineOut - settings.spoolCapacity;
      lineOut = settings.spoolCapacity;
      const spoolTension = tension + excess;
      tension = spoolTension;
      notes.push(
        `The spool is maxed; extra outgoing line became ${plural(
          excess,
          "tension unit",
        )}.`,
      );
      if (spoolTension > settings.lineTest) {
        status = "snapped";
        notes.push(
          `No line remained for drag, so tension ${spoolTension} beat the ${settings.lineTest} line test.`,
        );
      }
      tension = clamp(tension, TENSION_MIN, TENSION_MAX);
    }
  };

  const applyLine = (delta: number, reason: string) => {
    if (delta === 0 || status !== "playing") return;
    const next = lineOut + delta;
    lineOut = clamp(next, 0, settings.spoolCapacity);
    notes.push(`${reason}: line ${signed(delta)}.`);
    checkSpool();
  };

  const applyTension = (delta: number, reason: string) => {
    if (delta === 0 || status !== "playing") return;

    if (delta > 0) {
      const target = tension + delta;
      if (target > settings.drag) {
        const slip = target - settings.drag;
        tension = settings.drag;
        lineOut += slip;
        notes.push(
          `${reason}: tension wanted ${signed(
            delta,
          )}, drag slipped ${plural(slip, "line unit")}.`,
        );
        checkSpool();
      } else {
        tension = target;
        notes.push(`${reason}: tension ${signed(delta)}.`);
      }

      if (status === "playing" && tension > settings.lineTest) {
        status = "snapped";
        notes.push(
          `Tension ${tension} beat the ${settings.lineTest} line test.`,
        );
      }
    } else {
      tension = clamp(tension + delta, TENSION_MIN, TENSION_MAX);
      notes.push(`${reason}: tension ${signed(delta)}.`);
    }

    tension = clamp(tension, TENSION_MIN, TENSION_MAX);
  };

  const resolveEscape = (
    kind: EscapeRoll["kind"],
    rawTarget: number,
    reason: string,
  ) => {
    if (status !== "playing") return;
    const target = clamp(rawTarget, 0, 6);
    const die = rollInt(1, 6);
    const escaped = die <= target;
    escapeRoll = { kind, target, die, escaped };
    notes.push(`${reason}: escape check triggered.`);
    if (escaped) {
      status = "escaped";
    }
  };

  switch (fishAction) {
    case "moveAway": {
      terrain = rollTerrain(settings);
      if (anglerAction === "pull") {
        applyTension(pullForce + fishForce, "Pull versus away run");
      } else if (anglerAction === "reel") {
        applyTension(reelForce + fishForce, "Reel versus away run");
        if (reelForce > fishForce) {
          applyLine(-(reelForce - fishForce), "Reel gained ground");
        }
      } else if (anglerAction === "slack") {
        applyTension(fishForce - slackForce, "Slack versus away run");
      } else {
        applyTension(fishForce, "Rest let the away run load the line");
      }
      notes.push(`Travel tile became ${TERRAIN_LABELS[terrain]}.`);
      break;
    }

    case "moveToward": {
      terrain = rollTerrain(settings);
      if (anglerAction === "pull") {
        applyTension(pullForce - fishForce, "Pull versus toward rush");
      } else if (anglerAction === "reel") {
        applyLine(-reelForce, "Reel picked up line");
        applyTension(reelForce - fishForce, "Reel versus toward rush");
      } else if (anglerAction === "slack") {
        applyTension(-(slackForce + fishForce), "Slack plus toward rush");
      } else {
        applyTension(-fishForce, "Rest let the toward rush slacken the line");
      }
      notes.push(`Travel tile became ${TERRAIN_LABELS[terrain]}.`);
      break;
    }

    case "moveUp": {
      if (anglerAction === "pull") {
        fishDepth = moveDepth(fishDepth, -2);
        applyTension(pullForce, "Pull lifted the fish");
      } else if (anglerAction === "reel") {
        fishDepth = moveDepth(fishDepth, -1);
        applyLine(-reelForce, "Reel picked up line");
        applyTension(reelForce - fishForce, "Reel versus upward move");
      } else if (anglerAction === "slack") {
        fishDepth = moveDepth(fishDepth, -1);
        applyTension(-slackForce, "Slack let the fish rise");
      } else {
        fishDepth = moveDepth(fishDepth, -1);
        applyTension(-fishForce, "Rest let the fish rise and slacken the line");
      }
      break;
    }

    case "moveDown": {
      if (anglerAction === "pull") {
        applyTension(pullForce, "Pull held the fish level");
      } else if (anglerAction === "reel") {
        fishDepth = moveDepth(fishDepth, 1);
        applyLine(-reelForce, "Reel picked up line");
        applyTension(reelForce + fishForce, "Reel versus downward dig");
      } else if (anglerAction === "slack") {
        fishDepth = moveDepth(fishDepth, 2);
        notes.push("Slack let the fish dive two layers without changing tension.");
      } else {
        fishDepth = moveDepth(fishDepth, 1);
        applyTension(fishForce, "Rest let the fish dig down and load the line");
      }
      break;
    }

    case "jump": {
      notes.push("Jump did not move the fish or add fish force.");
      if (anglerAction === "pull") {
        applyTension(pullForce, "Pull against jump");
        resolveEscape(
          "jump",
          terrain === "muck" ? 2 : 3,
          terrain === "muck" ? "Jump in muck" : "Jump",
        );
      } else if (anglerAction === "reel") {
        if (initialRodPosition === "up") {
          applyLine(-reelForce, "Reel picked up line during jump");
          notes.push("Rod up absorbed the jump without changing tension.");
        } else {
          applyLine(-reelForce, "Reel picked up line during jump");
          applyTension(reelForce, "Reel against jump");
        }
        const tipTarget = initialRodPosition === "up" ? 3 : 1;
        resolveEscape(
          "jump",
          terrain === "muck" ? tipTarget - 1 : tipTarget,
          terrain === "muck" ? "Jump in muck" : "Jump",
        );
      } else if (anglerAction === "slack") {
        applyTension(-slackForce, "Slack against jump");
        resolveEscape(
          "jump",
          terrain === "muck" ? 0 : 1,
          terrain === "muck" ? "Jump in muck" : "Jump",
        );
      } else {
        notes.push("Rest watched the jump without adding line pressure.");
        resolveEscape(
          "jump",
          terrain === "muck" ? 1 : 2,
          terrain === "muck" ? "Jump in muck" : "Jump",
        );
      }
      break;
    }

    case "hide": {
      notes.push("Hide did not move the fish or add fish force.");
      const canHideRoll = terrain === "cover";
      if (anglerAction === "pull") {
        applyTension(pullForce, "Pull against hide");
        if (canHideRoll) {
          resolveEscape("hide", 2, "Hide in grass cover");
        }
      } else if (anglerAction === "reel") {
        if (initialRodPosition === "down") {
          notes.push("Rod down kept the line from moving while the fish hid.");
        } else {
          applyLine(-reelForce, "Reel picked up line during hide");
        }
        applyTension(reelForce, "Reel against hide");
        if (canHideRoll) {
          resolveEscape(
            "hide",
            initialRodPosition === "down" ? 4 : 2,
            "Hide in grass cover",
          );
        }
      } else if (anglerAction === "slack") {
        applyTension(-slackForce, "Slack against hide");
        if (canHideRoll) {
          resolveEscape("hide", 4, "Hide in grass cover");
        }
      } else {
        notes.push("Rest gave the fish time in cover without moving line.");
        if (canHideRoll) {
          resolveEscape("hide", 3, "Hide in grass cover");
        }
      }
      if (!canHideRoll) {
        notes.push("No hide roll because the fish is not in grass cover.");
      }
      break;
    }

    case "shake": {
      if (anglerAction === "pull") {
        applyLine(-pullForce, "Shake converted rod pressure into line gain");
      } else if (anglerAction === "reel") {
        applyLine(-reelForce, "Shake converted reel pressure into line gain");
      } else if (anglerAction === "slack") {
        applyTension(-slackForce, "Slack during shake");
      } else {
        notes.push("Rest added no pressure during the shake.");
      }
      resolveEscape("shake", tension < 0 ? 2 : 1, tension < 0 ? "Shake with slack" : "Shake");
      break;
    }
  }

  if (status === "playing" && lineOut <= 0) {
    lineOut = 0;
    status = "caught";
    notes.push("Line reached zero. The fish is landed.");
  }

  const summary: RoundSummary = {
    round,
    anglerAction,
    fishAction,
    rawFishAction,
    fishForce,
    tensionBefore,
    tensionAfter: tension,
    lineBefore,
    lineAfter: lineOut,
    depthBefore,
    depthAfter: fishDepth,
    terrainBefore,
    terrainAfter: terrain,
    escapeRoll,
    notes,
    status,
  };

  const headline = `Round ${round}: ${ANGLER_ACTION_LABELS[anglerAction]} vs ${
    FISH_ACTION_LABELS[fishAction]
  } -> tension ${tensionBefore} to ${tension}, line ${lineBefore} to ${lineOut}.`;

  return {
    ...game,
    tension,
    lineOut,
    fishDepth,
    terrain,
    rodPosition,
    status,
    round: round + 1,
    lastRound: summary,
    log: [headline, ...notes, ...game.log].slice(0, 14),
  };
}

function terminalFishStatus(status?: GameStatus) {
  return status === "caught" || status === "escaped" || status === "snapped";
}

function fishPose(summary?: RoundSummary, status?: GameStatus) {
  if (status === "caught") {
    return { facing: -1, angle: -8, lift: 3, jumping: false, hiding: false };
  }

  if (status === "escaped" || status === "snapped") {
    return { facing: 1, angle: 0, lift: 0, jumping: false, hiding: false };
  }

  const action = summary?.fishAction;
  let facing = 1;

  if (action === "moveToward") facing = -1;
  if (action === "moveAway") facing = 1;

  let angle = 0;
  let lift = 0;
  const jumping = action === "jump";
  const hiding = action === "hide";

  if (action === "moveUp") angle = -12;
  if (action === "moveDown") angle = 12;
  if (jumping) {
    angle = -21;
    lift = -17;
  }
  if (hiding) {
    angle = 7;
    lift = 9;
  }
  if (action === "shake") angle = -7;

  return { facing, angle, lift, jumping, hiding };
}

function FishShape({
  color,
  summary,
  status,
}: {
  color: string;
  summary?: RoundSummary;
  status?: GameStatus;
}) {
  const pose = fishPose(summary, status);

  return (
    <Box
      sx={{
        position: "relative",
        width: { xs: 42, sm: 58 },
        height: { xs: 20, sm: 28 },
        transform: `translateY(${pose.lift}px) rotate(${pose.angle}deg)`,
        transformOrigin: "50% 50%",
        transition: "transform 260ms ease",
      }}
    >
      {pose.jumping && (
        <>
          <Box
            sx={{
              position: "absolute",
              left: "48%",
              bottom: { xs: -18, sm: -22 },
              width: { xs: 48, sm: 66 },
              height: { xs: 15, sm: 20 },
              transform: "translateX(-50%)",
              borderTop: "3px solid rgba(236, 254, 255, 0.9)",
              borderRadius: "50%",
              boxShadow: "0 -5px 0 rgba(186, 230, 253, 0.32)",
              zIndex: 0,
            }}
          />
          {[0, 1, 2].map((drop) => (
            <Box
              key={`jump-drop-${drop}`}
              sx={{
                position: "absolute",
                left: `${28 + drop * 18}%`,
                bottom: { xs: -8 - drop * 3, sm: -9 - drop * 3 },
                width: { xs: 4, sm: 5 },
                height: { xs: 4, sm: 5 },
                borderRadius: "50%",
                bgcolor: "rgba(236, 254, 255, 0.88)",
                boxShadow: "0 1px 3px rgba(15,23,42,0.18)",
                zIndex: 2,
              }}
            />
          ))}
        </>
      )}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          transform: `scaleX(${pose.facing})`,
          transformOrigin: "50% 50%",
          transition: "transform 260ms ease, opacity 260ms ease",
          opacity: pose.hiding ? 0.62 : 1,
          filter: pose.hiding ? "brightness(0.76) saturate(0.82)" : undefined,
          bgcolor: color,
          borderRadius: "52% 45% 45% 52%",
          border: "2px solid rgba(23, 33, 31, 0.35)",
          boxShadow: "0 8px 16px rgba(15, 23, 42, 0.22)",
          zIndex: 1,
          "&::before": {
            content: '""',
            position: "absolute",
            left: { xs: -14, sm: -18 },
            top: "50%",
            transform: "translateY(-50%) rotate(0deg)",
            width: { xs: 18, sm: 24 },
            height: { xs: 18, sm: 25 },
            bgcolor: color,
            clipPath: "polygon(100% 50%, 0 0, 22% 50%, 0 100%)",
            filter: "brightness(0.82)",
          },
          "&::after": {
            content: '""',
            position: "absolute",
            right: { xs: 7, sm: 9 },
            top: { xs: 5, sm: 7 },
            width: { xs: 4, sm: 5 },
            height: { xs: 4, sm: 5 },
            borderRadius: "50%",
            bgcolor: "#0f172a",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.28)",
          },
        }}
      />
      {pose.hiding && (
        <Box
          sx={{
            position: "absolute",
            left: { xs: -12, sm: -16 },
            right: { xs: -8, sm: -12 },
            bottom: { xs: -9, sm: -12 },
            height: { xs: 17, sm: 22 },
            borderRadius: "50%",
            bgcolor: "rgba(22, 78, 70, 0.68)",
            borderTop: "2px solid rgba(187, 247, 208, 0.6)",
            boxShadow: "0 -5px 12px rgba(20,83,45,0.26)",
            zIndex: 2,
          }}
        />
      )}
    </Box>
  );
}

function TerrainMarker({ terrain }: { terrain: Terrain }) {
  if (terrain === "clear") {
    return (
      <Box
        sx={{
          width: 70,
          height: 18,
          borderRadius: 999,
          border: "1px solid rgba(255, 255, 255, 0.5)",
          bgcolor: "rgba(255, 255, 255, 0.14)",
        }}
      />
    );
  }

  if (terrain === "muck") {
    return (
      <Box
        sx={{
          width: 76,
          height: 24,
          borderRadius: "50%",
          bgcolor: "rgba(92, 64, 45, 0.6)",
          border: "1px solid rgba(67, 45, 32, 0.5)",
          boxShadow:
            "inset 10px 0 rgba(111, 79, 50, 0.5), inset -12px 2px rgba(54, 42, 30, 0.28)",
        }}
      />
    );
  }

  return (
    <Stack direction="row" spacing={0.4} alignItems="flex-end">
      {[14, 25, 18, 30, 21].map((height, index) => (
        <Box
          key={index}
          sx={{
            width: 6,
            height,
            borderRadius: "6px 6px 0 0",
            bgcolor: index % 2 === 0 ? "#2f7d32" : "#6a9d35",
            transform: `rotate(${index % 2 === 0 ? -8 : 8}deg)`,
          }}
        />
      ))}
    </Stack>
  );
}

function sceneFishPoint(lineOut: number, depth: Depth, capacity: number) {
  return {
    x: clamp(22 + (lineOut / capacity) * 68, 22, 91),
    y: [24, 52, 78][depth],
  };
}

function terminalScenePoint(basePoint: { x: number; y: number }, status: GameStatus) {
  if (status === "caught") return { x: 12, y: 72 };
  if (status === "escaped" || status === "snapped") return { x: 96, y: basePoint.y };
  return basePoint;
}

function ResultMovementArrow({
  summary,
  capacity,
  status,
}: {
  summary?: RoundSummary;
  capacity: number;
  status: GameStatus;
}) {
  if (!summary) return null;

  const from = sceneFishPoint(summary.lineBefore, summary.depthBefore, capacity);
  const roundEnd = sceneFishPoint(summary.lineAfter, summary.depthAfter, capacity);
  const to = terminalScenePoint(roundEnd, terminalFishStatus(status) ? status : "playing");
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const moved = Math.abs(dx) + Math.abs(dy) > 0.25;

  if (!moved) return null;

  return (
    <g pointerEvents="none">
      <defs>
        <marker
          id="result-movement-arrow"
          markerHeight="8"
          markerWidth="8"
          orient="auto"
          refX="7"
          refY="4"
        >
          <path d="M0,0 L8,4 L0,8 L2.2,4 Z" fill="#fbbf24" />
        </marker>
      </defs>
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke="rgba(15, 23, 42, 0.6)"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke="#fbbf24"
        strokeWidth="2"
        strokeLinecap="round"
        markerEnd="url(#result-movement-arrow)"
      />
      <circle cx={from.x} cy={from.y} r="1.35" fill="#fbbf24" stroke="rgba(15,23,42,0.46)" strokeWidth="0.55" />
    </g>
  );
}

function TensionDeltaBubble({
  summary,
  fishX,
  depthY,
}: {
  summary?: RoundSummary;
  fishX: number;
  depthY: number;
}) {
  if (!summary) return null;

  const delta = summary.tensionAfter - summary.tensionBefore;
  const tone =
    delta > 0
      ? { fg: "#9f1239", bg: "rgba(255, 241, 242, 0.94)", ring: "rgba(190, 18, 60, 0.28)" }
      : delta < 0
        ? { fg: "#1d4ed8", bg: "rgba(219, 234, 254, 0.95)", ring: "rgba(37, 99, 235, 0.24)" }
        : { fg: "#334155", bg: "rgba(248, 250, 252, 0.94)", ring: "rgba(100, 116, 139, 0.22)" };

  return (
    <Box
      sx={{
        position: "absolute",
        left: `${clamp(fishX + 10, 11, 87)}%`,
        top: `${clamp(depthY - 13, 10, 74)}%`,
        transform: "translate(-50%, -50%)",
        zIndex: 5,
        width: 42,
        height: 42,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        bgcolor: tone.bg,
        color: tone.fg,
        border: "2px solid rgba(255,255,255,0.92)",
        boxShadow: `0 0 0 5px ${tone.ring}, 0 8px 18px rgba(15, 23, 42, 0.18)`,
        fontSize: 15,
        fontWeight: 950,
        pointerEvents: "none",
      }}
    >
      {signed(delta)}
    </Box>
  );
}

function AnglerActionIcon({ action }: { action?: AnglerAction }) {
  if (action === "pull") return <NorthIcon fontSize="small" />;
  if (action === "slack") return <SouthIcon fontSize="small" />;
  if (action === "rest") return <HourglassEmptyIcon fontSize="small" />;
  return <AnchorIcon fontSize="small" />;
}

function FishActionIcon({ action }: { action?: FishAction }) {
  if (action === "moveUp" || action === "jump") return <NorthIcon fontSize="small" />;
  if (action === "moveDown" || action === "hide") return <SouthIcon fontSize="small" />;
  if (action === "shake") return <SwapHorizIcon fontSize="small" />;
  if (action === "moveToward") return <SwapHorizIcon fontSize="small" sx={{ transform: "scaleX(-1)" }} />;
  return <SwapHorizIcon fontSize="small" />;
}

function SceneRoundPanel({ summary }: { summary?: RoundSummary }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        borderRadius: 2,
        bgcolor: "rgba(255, 253, 247, 0.72)",
        border: "1px solid rgba(15, 23, 42, 0.16)",
      }}
    >
      {!summary ? (
        <Typography variant="body2" fontWeight={950}>
          Choose an angler card
        </Typography>
      ) : (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <Box sx={{ color: "primary.main", display: "flex" }}>
              <AnglerActionIcon action={summary.anglerAction} />
            </Box>
            <Typography variant="body2" fontWeight={950}>
              Angler: {ANGLER_ACTION_LABELS[summary.anglerAction]}
            </Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <Box sx={{ color: "#9a3412", display: "flex" }}>
              <FishActionIcon action={summary.fishAction} />
            </Box>
            <Typography variant="body2" fontWeight={950}>
              Fish: {FISH_ACTION_LABELS[summary.fishAction]}
            </Typography>
          </Stack>
        </Stack>
      )}
    </Paper>
  );
}

function RollNoticeBox({ notice }: { notice: RollNotice | null }) {
  if (!notice) return null;

  const title = `${notice.kind.charAt(0).toUpperCase()}${notice.kind.slice(1)} check`;
  const escapeRange =
    notice.roll && notice.roll.target > 0
      ? notice.roll.target === 1
        ? "escapes on 1"
        : `escapes on 1-${notice.roll.target}`
      : "no escape numbers";
  const resultText = notice.roll
    ? `Rolled d6: ${notice.roll.die}; ${escapeRange} (${notice.roll.target}/6)`
    : notice.noRollReason ?? "No roll";
  const outcomeText = notice.roll
    ? notice.roll.escaped
      ? "Fish got away"
      : "Line held"
    : "No escape check";

  return (
    <Paper
      elevation={8}
      sx={{
        position: "absolute",
        left: "50%",
        top: "47%",
        transform:
          notice.phase === "leaving"
            ? "translate(-50%, -44%) scale(0.96)"
            : "translate(-50%, -50%) scale(1)",
        opacity: notice.phase === "leaving" ? 0 : 1,
        transition: "opacity 420ms ease, transform 420ms ease",
        zIndex: 5,
        minWidth: { xs: 230, sm: 280 },
        maxWidth: "calc(100% - 32px)",
        p: 2,
        textAlign: "center",
        borderRadius: 2,
        bgcolor: "rgba(255, 253, 247, 0.94)",
        border: "2px solid rgba(15, 118, 110, 0.32)",
        pointerEvents: "none",
      }}
    >
      <Typography variant="subtitle1" fontWeight={950}>
        {title}
      </Typography>
      <Typography variant="h6" fontWeight={950} sx={{ my: 0.75 }}>
        {notice.phase === "waiting" ? "Waiting on the roll..." : resultText}
      </Typography>
      <Typography variant="body2" color="text.secondary" fontWeight={800}>
        {notice.phase === "waiting" ? "The line is still in play." : outcomeText}
      </Typography>
    </Paper>
  );
}

function LineOutRuler({
  lineOut,
  capacity,
}: {
  lineOut: number;
  capacity: number;
}) {
  const ticks = Array.from({ length: capacity + 1 }, (_, index) => index);
  const markerLeft = `${(clamp(lineOut, 0, capacity) / capacity) * 100}%`;

  return (
    <Box
      sx={{
        position: "absolute",
        left: "19%",
        right: "6%",
        bottom: 24,
        zIndex: 4,
        height: 52,
        pointerEvents: "none",
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography
          variant="caption"
          fontWeight={950}
          sx={{ color: "#ecfeff", textShadow: "0 1px 3px rgba(15,23,42,0.8)" }}
        >
          Line out
        </Typography>
        <Typography
          variant="caption"
          fontWeight={950}
          sx={{ color: "#ecfeff", textShadow: "0 1px 3px rgba(15,23,42,0.8)" }}
        >
          {lineOut}/{capacity}
        </Typography>
      </Stack>
      <Box
        sx={{
          position: "relative",
          height: 32,
          mt: 0.2,
        }}
      >
        <Box
          sx={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 13,
            height: 3,
            borderRadius: 999,
            bgcolor: "rgba(207, 250, 254, 0.95)",
            boxShadow: "0 1px 4px rgba(15,23,42,0.35)",
          }}
        />
        {ticks.map((tick) => {
          const major = tick % 6 === 0 || tick === capacity;
          const left = `${(tick / capacity) * 100}%`;
          return (
            <Box
              key={`line-ruler-${tick}`}
              sx={{
                position: "absolute",
                left,
                top: major ? 3 : 7,
                transform: "translateX(-50%)",
                width: major ? 2 : 1,
                height: major ? 21 : 13,
                borderRadius: 999,
                bgcolor: "rgba(236, 254, 255, 0.92)",
                boxShadow: "0 1px 3px rgba(15,23,42,0.35)",
              }}
            >
              {major && (
                <Typography
                  component="span"
                  sx={{
                    position: "absolute",
                    left: "50%",
                    top: 23,
                    transform: "translateX(-50%)",
                    fontSize: 9,
                    lineHeight: 1,
                    fontWeight: 900,
                    color: "#ecfeff",
                    textShadow: "0 1px 3px rgba(15,23,42,0.85)",
                  }}
                >
                  {tick}
                </Typography>
              )}
            </Box>
          );
        })}
        <Box
          sx={{
            position: "absolute",
            left: markerLeft,
            top: 0,
            bottom: 3,
            width: 4,
            transform: "translateX(-50%)",
            borderRadius: 999,
            bgcolor: "#be123c",
            border: "1px solid rgba(255,255,255,0.9)",
            boxShadow: "0 0 0 4px rgba(190, 18, 60, 0.2), 0 2px 6px rgba(15,23,42,0.35)",
          }}
        />
      </Box>
    </Box>
  );
}

function FishingScene({
  game,
  settings,
  rollNotice,
  displayStatus,
}: {
  game: GameState;
  settings: Settings;
  rollNotice: RollNotice | null;
  displayStatus: GameStatus;
}) {
  const fishPoint = sceneFishPoint(game.lineOut, game.fishDepth, settings.spoolCapacity);
  const displayFishPoint = terminalScenePoint(fishPoint, displayStatus);
  const depthY = displayFishPoint.y;
  const fishX = displayFishPoint.x;
  const lineEndPoint = displayStatus === "caught" ? displayFishPoint : fishPoint;
  const rodTip = game.rodPosition === "up" ? { x: 17, y: 26 } : { x: 17, y: 65 };
  const terrainTop = game.terrain === "cover" ? "calc(100% - 82px)" : `calc(${fishPoint.y}% + 26px)`;
  const lineColor =
    game.tension < 0 ? "#2563eb" : game.tension > settings.lineTest - 2 ? "#b91c1c" : "#8a5a18";

  return (
    <Paper
      sx={{
        position: "relative",
        overflow: "hidden",
        minHeight: { xs: 360, md: 380 },
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "#c8f3f1",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, #8dbd6a 0 15%, transparent 15%), linear-gradient(180deg, #bff5f1 0%, #4daaad 58%, #2f7278 100%)",
        }}
      />
      {[0, 1, 2].map((depth) => (
        <Box
          key={depth}
          sx={{
            position: "absolute",
            left: "15%",
            right: 0,
            top: `${depth * 33.333}%`,
            height: "33.333%",
            borderTop: depth === 0 ? "none" : "1px solid rgba(255, 255, 255, 0.36)",
            background:
              depth === 0
                ? "repeating-linear-gradient(0deg, rgba(255,255,255,0.08) 0 4px, transparent 4px 18px)"
                : "transparent",
          }}
        >
          <Typography
            variant="caption"
            sx={{
              position: "absolute",
              left: 12,
              top: 10,
              px: 1,
              py: 0.25,
              borderRadius: 1,
              bgcolor: "rgba(255,255,255,0.52)",
              fontWeight: 900,
              color: "#14413f",
            }}
          >
            {DEPTH_LABELS[depth as Depth]}
          </Typography>
        </Box>
      ))}

      <Box
        sx={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: "15%",
          height: "100%",
          background:
            "linear-gradient(180deg, rgba(73, 117, 55, 0.18), rgba(64, 89, 44, 0.52)), repeating-linear-gradient(90deg, rgba(73, 94, 41, 0.16) 0 8px, transparent 8px 18px)",
        }}
      />

      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 1 }}
      >
        <line
          x1="7.5"
          y1="73"
          x2={rodTip.x}
          y2={rodTip.y}
          stroke="#3f3327"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <line
          x1={rodTip.x}
          y1={rodTip.y}
          x2={lineEndPoint.x}
          y2={lineEndPoint.y}
          stroke={lineColor}
          strokeWidth="0.75"
          strokeLinecap="round"
          strokeDasharray={game.tension < 0 ? "2.5 2.5" : undefined}
        />
      </svg>
      <RollNoticeBox notice={rollNotice} />

      <Box
        sx={{
          position: "absolute",
          left: "6.5%",
          top: "66%",
          width: 28,
          height: 28,
          borderRadius: "50%",
          bgcolor: "#513b2c",
          border: "2px solid rgba(255,255,255,0.55)",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          left: "6.8%",
          top: "73%",
          width: 24,
          height: 62,
          borderRadius: "12px 12px 5px 5px",
          bgcolor: "#1f3b36",
          boxShadow: "inset 0 -10px rgba(0,0,0,0.16)",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          left: `${fishPoint.x}%`,
          top: terrainTop,
          transform: "translate(-50%, -50%)",
          opacity: 0.92,
        }}
      >
        <TerrainMarker terrain={game.terrain} />
      </Box>
      <Box
        sx={{
          position: "absolute",
          left: `${fishX}%`,
          top: `${depthY}%`,
          transform: "translate(-50%, -50%)",
          transition: "left 260ms ease, top 260ms ease",
        }}
      >
        <FishShape color={game.fish.color} summary={game.lastRound} status={displayStatus} />
      </Box>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          zIndex: 4,
          pointerEvents: "none",
        }}
      >
        <ResultMovementArrow
          summary={game.lastRound}
          capacity={settings.spoolCapacity}
          status={displayStatus}
        />
      </svg>
      <TensionDeltaBubble summary={game.lastRound} fishX={fishX} depthY={depthY} />
      <LineOutRuler lineOut={game.lineOut} capacity={settings.spoolCapacity} />
    </Paper>
  );
}

function TensionGauge({
  value,
  drag,
  lineTest,
}: {
  value: number;
  drag: number;
  lineTest: number;
}) {
  const positiveWidth = value > 0 ? (value / TENSION_MAX) * 50 : 0;
  const negativeWidth = value < 0 ? (Math.abs(value) / Math.abs(TENSION_MIN)) * 50 : 0;
  const ticks = Array.from({ length: TENSION_MAX - TENSION_MIN + 1 }, (_, index) => TENSION_MIN + index);
  const markerLeft = (marker: number) =>
    `${((clamp(marker, TENSION_MIN, TENSION_MAX) - TENSION_MIN) / (TENSION_MAX - TENSION_MIN)) * 100}%`;

  return (
    <Paper
      sx={{
        p: 2,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.25 }}>
        <Typography variant="subtitle2" fontWeight={900}>
          Tension / Slack
        </Typography>
        <Typography variant="body2" fontWeight={950} color={value < 0 ? "primary.main" : "text.primary"}>
          {value < 0 ? `${Math.abs(value)} slack` : `${value} tension`}
        </Typography>
      </Stack>
      <Box
        sx={{
          position: "relative",
          height: 86,
          px: 0.5,
        }}
      >
        <Box
          sx={{
            position: "absolute",
            left: markerLeft(drag),
            top: 0,
            transform: "translateX(-50%)",
            color: "#0f766e",
            fontSize: 11,
            fontWeight: 950,
            whiteSpace: "nowrap",
          }}
        >
          Drag {drag}
        </Box>
        <Box
          sx={{
            position: "absolute",
            left: markerLeft(lineTest),
            top: 0,
            transform: "translateX(-50%)",
            color: "#b91c1c",
            fontSize: 11,
            fontWeight: 950,
            whiteSpace: "nowrap",
          }}
        >
          Test {lineTest}
        </Box>
        <Box
          sx={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 22,
            height: 32,
            borderRadius: 1,
            bgcolor: "#f6faf7",
            overflow: "hidden",
            border: "1px solid rgba(31, 41, 55, 0.16)",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              top: 0,
              bottom: 0,
              right: "50%",
              width: `${negativeWidth}%`,
              bgcolor: "#60a5fa",
            }}
          />
          <Box
            sx={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: "50%",
              width: `${positiveWidth}%`,
              bgcolor: value >= lineTest - 1 ? "#ef4444" : "#f59e0b",
            }}
          />
          <Box
            sx={{
              position: "absolute",
              left: "50%",
              top: 0,
              bottom: 0,
              width: 2,
              bgcolor: "#17211f",
            }}
          />
          <Box
            sx={{
              position: "absolute",
              left: markerLeft(drag),
              top: 0,
              bottom: 0,
              width: 2,
              bgcolor: "#0f766e",
            }}
          />
          <Box
            sx={{
              position: "absolute",
              left: markerLeft(lineTest),
              top: 0,
              bottom: 0,
              width: 2,
              bgcolor: "#b91c1c",
            }}
          />
        </Box>
        {ticks.map((tick) => (
          <Typography
            key={`tick-label-${tick}`}
            component="span"
            sx={{
              position: "absolute",
              left: markerLeft(tick),
              top: 58,
              transform: "translateX(-50%)",
              fontSize: { xs: 7, sm: 8 },
              lineHeight: 1,
              color: tick < 0 ? "#2563eb" : tick > 0 ? "#8a5a18" : "#17211f",
              fontWeight: tick % 5 === 0 || tick === value ? 950 : 700,
            }}
          >
            {tick}
          </Typography>
        ))}
      </Box>
    </Paper>
  );
}

function MetricTile({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Paper
      sx={{
        height: "100%",
        minHeight: 104,
        p: 1.5,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Box sx={{ color: "primary.main", display: "flex" }}>{icon}</Box>
        <Typography variant="caption" color="text.secondary" fontWeight={900}>
          {label}
        </Typography>
      </Stack>
      <Typography variant="h6" fontWeight={950} lineHeight={1.1}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {sub}
      </Typography>
    </Paper>
  );
}

type SettingOption<T extends string | number> = {
  value: T;
  label: string;
};

function SettingSelect<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: SettingOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <FormControl size="small" fullWidth>
      <InputLabel>{label}</InputLabel>
      <Select
        label={label}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function SettingsPanel({
  settings,
  onSetting,
}: {
  settings: Settings;
  onSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}) {
  const clearChance = Math.max(0, 100 - settings.muckChance - settings.coverChance);

  return (
    <Paper
      sx={{
        p: 2,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <TuneIcon color="primary" />
        <Typography variant="h6" fontWeight={950}>
          Variables
        </Typography>
      </Stack>
      <Grid container spacing={1.5}>
        <Grid item xs={12} sm={6}>
          <SettingSelect
            label="Rod stiffness"
            value={settings.rodStiffness}
            options={[
              { value: "soft", label: "Soft (+1)" },
              { value: "stiff", label: "Stiff (+2)" },
            ]}
            onChange={(value) => onSetting("rodStiffness", value)}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <SettingSelect
            label="Reel gear"
            value={settings.reelGear}
            options={[
              { value: 1, label: "1 line unit" },
              { value: 2, label: "2 line units" },
              { value: 3, label: "3 line units" },
            ]}
            onChange={(value) => onSetting("reelGear", Number(value))}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <SettingSelect
            label="Line test"
            value={settings.lineTest}
            options={[6, 8, 10, 12, 14, 16, 18, 20].map((value) => ({
              value,
              label: `${value} tension`,
            }))}
            onChange={(value) => onSetting("lineTest", Number(value))}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <SettingSelect
            label="Drag set"
            value={settings.drag}
            options={[2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map((value) => ({
              value,
              label: `${value} tension`,
            }))}
            onChange={(value) => onSetting("drag", Number(value))}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <SettingSelect
            label="Cast distance"
            value={settings.castDistance}
            options={[6, 10, 14, 18, 22, 26, 30].map((value) => ({
              value,
              label: `${value} line`,
            }))}
            onChange={(value) => onSetting("castDistance", Number(value))}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <SettingSelect
            label="Spool capacity"
            value={settings.spoolCapacity}
            options={[24, 30, 36, 42].map((value) => ({
              value,
              label: `${value} line`,
            }))}
            onChange={(value) => onSetting("spoolCapacity", Number(value))}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <SettingSelect
            label="Fish vigor"
            value={settings.fishVigor}
            options={[
              { value: 1, label: "1 mild" },
              { value: 2, label: "2 strong" },
              { value: 3, label: "3 fierce" },
              { value: 4, label: "4 legendary" },
            ]}
            onChange={(value) => onSetting("fishVigor", Number(value))}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <SettingSelect
            label="Muck chance"
            value={settings.muckChance}
            options={[0, 10, 17, 25, 33, 50].map((value) => ({
              value,
              label: `${value}%`,
            }))}
            onChange={(value) => onSetting("muckChance", Number(value))}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <SettingSelect
            label="Grass chance"
            value={settings.coverChance}
            options={[0, 10, 17, 25, 33, 50].map((value) => ({
              value,
              label: `${value}%`,
            }))}
            onChange={(value) => onSetting("coverChance", Number(value))}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <Paper
            variant="outlined"
            sx={{
              height: 40,
              px: 1.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderRadius: 1,
              bgcolor: alpha("#f8fafc", 0.76),
            }}
          >
            <Typography variant="caption" color="text.secondary" fontWeight={900}>
              Clear chance
            </Typography>
            <Typography variant="body2" fontWeight={950}>
              {clearChance}%
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Paper>
  );
}

function ActionCard({
  action,
  disabled,
  settings,
  onPlay,
}: {
  action: AnglerAction;
  disabled: boolean;
  settings: Settings;
  onPlay: (action: AnglerAction) => void;
}) {
  const config = {
    pull: {
      icon: <NorthIcon />,
      color: "#be123c",
      value: `+${stiffnessUnits(settings.rodStiffness)} tension`,
      detail: "Rod down only",
    },
    reel: {
      icon: <AnchorIcon />,
      color: "#0f766e",
      value: `${settings.reelGear} line`,
      detail: "Gear ratio",
    },
    slack: {
      icon: <SouthIcon />,
      color: "#2563eb",
      value: `-${stiffnessUnits(settings.rodStiffness)} tension`,
      detail: "Rod up only",
    },
    rest: {
      icon: <HourglassEmptyIcon />,
      color: "#8a5a18",
      value: "fish force only",
      detail: "No rod or reel force",
    },
  }[action];

  return (
    <Card
      sx={{
        height: "100%",
        borderColor: disabled ? "divider" : alpha(config.color, 0.5),
      }}
    >
      <CardActionArea
        disabled={disabled}
        onClick={() => onPlay(action)}
        sx={{ height: "100%" }}
      >
        <CardContent sx={{ minHeight: 146 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 1.5,
                display: "grid",
                placeItems: "center",
                bgcolor: alpha(config.color, 0.12),
                color: config.color,
              }}
            >
              {config.icon}
            </Box>
            <Chip
              size="small"
              label={disabled ? "Blocked" : "Ready"}
              color={disabled ? "default" : "primary"}
            />
          </Stack>
          <Typography variant="h6" fontWeight={950}>
            {ANGLER_ACTION_LABELS[action]}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ minHeight: 22 }}>
            {config.value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {config.detail}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function FishAccordion({ fish }: { fish: FishProfile }) {
  return (
    <Accordion
      disableGutters
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "8px !important",
        overflow: "hidden",
        boxShadow: "none",
        "&::before": { display: "none" },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1} alignItems="center">
          <WavesIcon color="primary" />
          <Typography fontWeight={950}>Fish on the line</Typography>
          <Chip size="small" label="Details hidden" />
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1.5}>
          <Typography variant="h6" fontWeight={950}>
            {fish.name}
          </Typography>
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Chip sx={{ width: "100%" }} label={`Vigor ${fish.vigor}`} color="primary" />
            </Grid>
            <Grid item xs={6}>
              <Chip sx={{ width: "100%" }} label={`Strength ${fish.strength}`} color="warning" />
            </Grid>
            <Grid item xs={6}>
              <Chip sx={{ width: "100%" }} label={`${fish.weight} lb class`} />
            </Grid>
            <Grid item xs={6}>
              <Chip
                sx={{ width: "100%" }}
                label={fish.legendary ? "Legendary" : "Standard"}
                color={fish.legendary ? "secondary" : "default"}
              />
            </Grid>
          </Grid>
          <Typography variant="body2" color="text.secondary">
            {fish.temperament}: {fish.detail}
          </Typography>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

function LogPanel({ log }: { log: string[] }) {
  return (
    <Paper
      sx={{
        p: 2,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography variant="h6" fontWeight={950} sx={{ mb: 1 }}>
        Log
      </Typography>
      <Stack spacing={0.75} sx={{ maxHeight: 260, overflowY: "auto", pr: 0.5 }}>
        {log.map((entry, index) => (
          <Typography
            key={`${entry}-${index}`}
            variant="body2"
            sx={{
              px: 1,
              py: 0.75,
              borderRadius: 1,
              bgcolor: index === 0 ? alpha("#0f766e", 0.1) : alpha("#f8fafc", 0.74),
              border: "1px solid rgba(31, 41, 55, 0.08)",
            }}
          >
            {entry}
          </Typography>
        ))}
      </Stack>
    </Paper>
  );
}

function StatusBanner({
  status,
  onReset,
}: {
  status: GameStatus;
  onReset: () => void;
}) {
  if (status === "playing") return null;

  const color =
    status === "caught" ? "#15803d" : status === "snapped" ? "#b91c1c" : "#b45309";

  return (
    <Paper
      sx={{
        p: 2,
        borderRadius: 2,
        border: "2px solid",
        borderColor: color,
        bgcolor: alpha(color, 0.08),
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
      >
        <Typography variant="h5" fontWeight={950} color={color}>
          {statusCopy(status)}
        </Typography>
        <Button
          variant="contained"
          startIcon={<RestartAltIcon />}
          onClick={onReset}
          sx={{ alignSelf: { xs: "stretch", sm: "center" } }}
        >
          Reset
        </Button>
      </Stack>
    </Paper>
  );
}

export default function FishingCardGame() {
  const [bundle, setBundle] = useState<GameBundle>(() => createInitialBundle());
  const [rollNotice, setRollNotice] = useState<RollNotice | null>(null);
  const { settings, game } = bundle;

  const actionDisabled = useMemo(
    () => ({
      pull: game.status !== "playing" || game.rodPosition === "up" || Boolean(rollNotice),
      reel: game.status !== "playing" || Boolean(rollNotice),
      slack: game.status !== "playing" || game.rodPosition === "down" || Boolean(rollNotice),
      rest: game.status !== "playing" || Boolean(rollNotice),
    }),
    [game.rodPosition, game.status, rollNotice],
  );

  useEffect(() => {
    const summary = game.lastRound;
    const kind =
      summary?.fishAction === "jump"
        ? "jump"
        : summary?.fishAction === "hide"
        ? "hide"
        : summary?.fishAction === "shake"
        ? "shake"
        : null;

    if (!summary || !kind) {
      setRollNotice(null);
      return undefined;
    }

    const id = `${summary.round}-${kind}-${summary.escapeRoll?.die ?? "none"}-${
      summary.escapeRoll?.target ?? "none"
    }`;
    const noRollReason = summary.escapeRoll
      ? undefined
      : summary.notes.find((note) => note.includes("No hide roll"))
      ? "No grass cover"
      : summary.status !== "playing"
      ? "Line failed first"
      : kind === "jump"
      ? "Fish is not at the top"
      : "No roll";
    const waitMs = rollInt(2000, 5000);

    setRollNotice({
      id,
      kind,
      phase: "waiting",
      noRollReason,
    });

    const resultTimer = window.setTimeout(() => {
      setRollNotice((current) =>
        current?.id === id
          ? {
              ...current,
              phase: "result",
              roll: summary.escapeRoll,
            }
          : current,
      );
    }, waitMs);
    const leavingTimer = window.setTimeout(() => {
      setRollNotice((current) =>
        current?.id === id ? { ...current, phase: "leaving" } : current,
      );
    }, waitMs + 2500);
    const removeTimer = window.setTimeout(() => {
      setRollNotice((current) => (current?.id === id ? null : current));
    }, waitMs + 2950);

    return () => {
      window.clearTimeout(resultTimer);
      window.clearTimeout(leavingTimer);
      window.clearTimeout(removeTimer);
    };
  }, [game.lastRound]);

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setBundle((current) => {
      const settings = { ...current.settings, [key]: value };
      let game = current.game;

      if (key === "castDistance") {
        game = {
          ...game,
          lineOut: Number(value),
          log: [`Cast distance set to ${value} line.`, ...game.log].slice(0, 14),
        };
      }

      if (key === "spoolCapacity" && game.lineOut > Number(value)) {
        game = {
          ...game,
          lineOut: Number(value),
          log: [`Line out capped at new spool capacity ${value}.`, ...game.log].slice(0, 14),
        };
      }

      if (key === "fishVigor") {
        game = {
          ...game,
          fish: {
            ...game.fish,
            vigor: Number(value),
            strength: Math.max(game.fish.strength, Number(value)),
            legendary: Number(value) === 4 ? true : game.fish.legendary,
          },
        };
      }

      if (key === "muckChance" && Number(value) + settings.coverChance > 100) {
        settings.coverChance = 100 - Number(value);
      }

      if (key === "coverChance" && Number(value) + settings.muckChance > 100) {
        settings.muckChance = 100 - Number(value);
      }

      return { settings, game };
    });
  };

  const playRound = (action: AnglerAction) => {
    setBundle((current) => ({
      ...current,
      game: resolveRound(current.game, current.settings, action),
    }));
  };

  const resetGame = () => {
    setRollNotice(null);
    setBundle((current) => ({
      ...current,
      game: createGame(current.settings, current.game.fish),
    }));
  };

  const generateFish = () => {
    setRollNotice(null);
    setBundle((current) => {
      const fish = createFishProfile();
      const settings = { ...current.settings, fishVigor: fish.vigor };
      return {
        settings,
        game: createGame(settings, fish),
      };
    });
  };

  const displayStatus = rollNotice?.phase === "waiting" ? "playing" : game.status;

  return (
    <ThemeProvider theme={fishingTheme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: "100vh",
          overflowX: "hidden",
          bgcolor: "background.default",
          color: "text.primary",
          py: { xs: 2, md: 3 },
          background:
            "linear-gradient(180deg, #f4f7ef 0%, #e7f0e5 48%, #f8faf5 100%)",
        }}
      >
        <Container maxWidth="xl">
          <Stack spacing={2}>
            <Paper
              sx={{
                p: 2,
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1.5}
                alignItems={{ xs: "stretch", md: "center" }}
                justifyContent="space-between"
              >
                <Box>
                  <Typography variant="h4" fontWeight={950}>
                    Fishing Card Duel
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                    <Chip label={statusCopy(displayStatus)} color={displayStatus === "playing" ? "primary" : "warning"} />
                    <Chip label={`Round ${game.round}`} />
                    <Chip label={`Rod ${game.rodPosition}`} />
                    <Chip label={TERRAIN_LABELS[game.terrain]} />
                  </Stack>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Button
                    variant="outlined"
                    startIcon={<CasinoIcon />}
                    onClick={generateFish}
                  >
                    New fish
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<RestartAltIcon />}
                    onClick={resetGame}
                  >
                    Reset
                  </Button>
                </Stack>
              </Stack>
            </Paper>

            <StatusBanner status={displayStatus} onReset={resetGame} />

            <Grid container spacing={2}>
              <Grid item xs={12} lg={8}>
                <Stack spacing={2}>
                  <TensionGauge
                    value={game.tension}
                    drag={settings.drag}
                    lineTest={settings.lineTest}
                  />

                  <SceneRoundPanel summary={game.lastRound} />

                  <FishingScene
                    game={game}
                    settings={settings}
                    rollNotice={rollNotice}
                    displayStatus={displayStatus}
                  />

                  <Grid container spacing={1.5}>
                    {(["pull", "reel", "slack", "rest"] as AnglerAction[]).map((action) => (
                      <Grid item xs={12} sm={6} md={3} key={action}>
                        <ActionCard
                          action={action}
                          disabled={actionDisabled[action]}
                          settings={settings}
                          onPlay={playRound}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Stack>
              </Grid>

              <Grid item xs={12} lg={4}>
                <Stack spacing={2}>
                  <Grid container spacing={1.5}>
                    <Grid item xs={6}>
                      <MetricTile
                        icon={<FitnessCenterIcon />}
                        label="Rod"
                        value={settings.rodStiffness}
                        sub={`${stiffnessUnits(settings.rodStiffness)} force`}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <MetricTile
                        icon={<SpeedIcon />}
                        label="Reel"
                        value={`${settings.reelGear}x`}
                        sub={`${settings.reelGear} line per card`}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <MetricTile
                        icon={<SwapHorizIcon />}
                        label="Drag"
                        value={`${settings.drag}`}
                        sub="excess becomes line"
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <MetricTile
                        icon={<StraightenIcon />}
                        label="Line test"
                        value={`${settings.lineTest}`}
                        sub="snap threshold"
                      />
                    </Grid>
                  </Grid>

                  <FishAccordion fish={game.fish} />
                  <SettingsPanel settings={settings} onSetting={updateSetting} />
                  <LogPanel log={game.log} />
                </Stack>
              </Grid>
            </Grid>
          </Stack>
        </Container>
      </Box>
    </ThemeProvider>
  );
}
