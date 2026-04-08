import React, { useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Grid2,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";

// Phase 1 prototype goals:
// - 2 local players
// - 2 archetypes
// - 3 stances each
// - 6 moves per stance
// - visible shared queue
// - simultaneous move selection
// - speed-based resolution
// - persistent queue modifiers
// - dequeue starts when queue reaches 6 cards
// - dequeue 2 each round

// ----------------------------
// Types
// ----------------------------

type MoveType = "offense" | "defense" | "ability";

type InnateStats = {
  strength: number;
  knowledge: number;
  agility: number;
  endurance: number;
  technique: number;
  will: number;
};

type FluxStats = {
  balance: number;
  grounding: number;
  focus: number;
  stamina: number;
  fatigue: number;
  pain: number;
  adrenaline: number;
  mentalFatigue: number;
  magicPoints: number;
};

type FluxKey = keyof FluxStats;
type InnateKey = keyof InnateStats;

type StatDelta = {
  selfFlux?: Partial<Record<FluxKey, number>>;
  targetFlux?: Partial<Record<FluxKey, number>>;
  selfInnate?: Partial<Record<InnateKey, number>>;
  targetInnate?: Partial<Record<InnateKey, number>>;
};

type Move = {
  id: string;
  name: string;
  type: MoveType;
  speed: number;
  staminaCost: number;
  magicCost: number;
  hitBase: number;
  power: number;
  immediate: StatDelta;
  persistent: StatDelta;
  description: string;
};

type Stance = {
  id: string;
  name: string;
  description: string;
  resetBalanceTo: number;
  resetGroundingTo: number;
  bonuses: {
    hitBonus: number;
    evasionBonus: number;
    speedBonus: number;
    powerBonus: number;
  };
  moveIds: string[];
};

type FighterTemplate = {
  id: string;
  name: string;
  archetype: string;
  innate: InnateStats;
  flux: FluxStats;
  stances: Stance[];
};

type FighterState = FighterTemplate & {
  currentInnate: InnateStats;
  currentFlux: FluxStats;
  activeStanceId: string;
  hp: number;
};

type QueuedMove = {
  queueId: string;
  ownerId: string;
  targetId: string;
  move: Move;
  stanceId: string;
  roundAdded: number;
};

type PendingChoice = {
  stanceId: string;
  moveId: string;
};

type ResolutionEntry = {
  actorName: string;
  targetName: string;
  moveName: string;
  speed: number;
  hitScore: number;
  evadeScore: number;
  hit: boolean;
  damage: number;
  note: string;
};

// ----------------------------
// Helpers
// ----------------------------

const clamp = (n: number, min = 0, max = 999) => Math.max(min, Math.min(max, n));

const applyFluxPatch = (flux: FluxStats, patch?: Partial<Record<FluxKey, number>>) => {
  if (!patch) return flux;
  const next = { ...flux };
  (Object.keys(patch) as FluxKey[]).forEach((key) => {
    next[key] = clamp(next[key] + (patch[key] ?? 0), 0, 100);
  });
  return next;
};

const applyInnatePatch = (
  innate: InnateStats,
  patch?: Partial<Record<InnateKey, number>>
) => {
  if (!patch) return innate;
  const next = { ...innate };
  (Object.keys(patch) as InnateKey[]).forEach((key) => {
    next[key] = clamp(next[key] + (patch[key] ?? 0), 0, 100);
  });
  return next;
};

const getStance = (fighter: FighterState, stanceId: string) =>
  fighter.stances.find((s) => s.id === stanceId)!;

const sumPersistentEffects = (
  fighter: FighterState,
  opponent: FighterState,
  queue: QueuedMove[]
) => {
  let innate = { ...fighter.innate };
  let flux = { ...fighter.flux };

  queue.forEach((q) => {
    if (q.ownerId === fighter.id) {
      innate = applyInnatePatch(innate, q.move.persistent.selfInnate);
      flux = applyFluxPatch(flux, q.move.persistent.selfFlux);
    }
    if (q.targetId === fighter.id) {
      innate = applyInnatePatch(innate, q.move.persistent.targetInnate);
      flux = applyFluxPatch(flux, q.move.persistent.targetFlux);
    }
  });

  // simple state conditions for phase 1
  if (flux.balance === 0) {
    flux.focus = clamp(flux.focus - 20, 0, 100);
  }
  if (flux.pain === 0) {
    flux.focus = 0;
    flux.stamina = clamp(flux.stamina - 20, 0, 100);
  }
  if (flux.fatigue === 0) {
    innate.strength = clamp(innate.strength - 10, 0, 100);
  }
  if (flux.mentalFatigue === 0) {
    innate.knowledge = clamp(innate.knowledge - 10, 0, 100);
  }

  return { innate, flux, opponentId: opponent.id };
};

const formatPatch = (patch?: Record<string, number>) => {
  if (!patch) return "None";
  const entries = Object.entries(patch);
  if (!entries.length) return "None";
  return entries
    .map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v}`)
    .join(", ");
};

// ----------------------------
// Moves
// ----------------------------

const MOVES: Record<string, Move> = {
  // Vanguard - Iron Guard
  braceWall: {
    id: "braceWall",
    name: "Brace Wall",
    type: "defense",
    speed: 2,
    staminaCost: 8,
    magicCost: 0,
    hitBase: 0,
    power: 0,
    immediate: {
      selfFlux: { grounding: 12, balance: 8, focus: 4 },
    },
    persistent: {
      selfFlux: { grounding: 6, balance: 4 },
      targetFlux: {},
    },
    description: "Solid defensive posture that stabilizes future rounds.",
  },
  shieldCheck: {
    id: "shieldCheck",
    name: "Shield Check",
    type: "offense",
    speed: 4,
    staminaCost: 10,
    magicCost: 0,
    hitBase: 12,
    power: 10,
    immediate: {
      targetFlux: { balance: -10, grounding: -6 },
      selfFlux: { fatigue: -4 },
    },
    persistent: {
      targetFlux: { balance: -4 },
    },
    description: "Forward bash that pressures balance.",
  },
  punishingCut: {
    id: "punishingCut",
    name: "Punishing Cut",
    type: "offense",
    speed: 5,
    staminaCost: 14,
    magicCost: 0,
    hitBase: 14,
    power: 16,
    immediate: {
      targetFlux: { pain: -10, focus: -4 },
      selfFlux: { stamina: -4 },
    },
    persistent: {
      targetFlux: { pain: -4 },
    },
    description: "Heavy slash with lasting pressure.",
  },
  rallyBreath: {
    id: "rallyBreath",
    name: "Rally Breath",
    type: "ability",
    speed: 3,
    staminaCost: 0,
    magicCost: 0,
    hitBase: 0,
    power: 0,
    immediate: {
      selfFlux: { focus: 10, stamina: 8, adrenaline: 4 },
    },
    persistent: {
      selfFlux: { focus: 3 },
    },
    description: "Steadies breathing and restores composure.",
  },
  anchorStep: {
    id: "anchorStep",
    name: "Anchor Step",
    type: "ability",
    speed: 4,
    staminaCost: 6,
    magicCost: 0,
    hitBase: 0,
    power: 0,
    immediate: {
      selfFlux: { balance: 10, grounding: 10 },
    },
    persistent: {
      selfFlux: { balance: 2, grounding: 2 },
    },
    description: "Re-centers body position for upcoming exchanges.",
  },
  interceptGuard: {
    id: "interceptGuard",
    name: "Intercept Guard",
    type: "defense",
    speed: 6,
    staminaCost: 10,
    magicCost: 0,
    hitBase: 0,
    power: 0,
    immediate: {
      selfFlux: { focus: 8, grounding: 8 },
      targetFlux: { focus: -2 },
    },
    persistent: {
      selfFlux: { focus: 3 },
    },
    description: "Fast defensive response that improves current round defense.",
  },

  // Vanguard - Forward Pressure
  rushDrive: {
    id: "rushDrive",
    name: "Rush Drive",
    type: "offense",
    speed: 8,
    staminaCost: 15,
    magicCost: 0,
    hitBase: 16,
    power: 14,
    immediate: {
      targetFlux: { balance: -8, pain: -8 },
      selfFlux: { fatigue: -6, adrenaline: 4 },
    },
    persistent: {
      targetFlux: { balance: -3 },
    },
    description: "Fast advancing strike that opens the opponent up.",
  },
  cleavingLine: {
    id: "cleavingLine",
    name: "Cleaving Line",
    type: "offense",
    speed: 6,
    staminaCost: 16,
    magicCost: 0,
    hitBase: 15,
    power: 18,
    immediate: {
      targetFlux: { pain: -12 },
      selfFlux: { stamina: -6 },
    },
    persistent: {
      targetFlux: { focus: -3 },
    },
    description: "Forceful committed attack.",
  },
  forwardScreen: {
    id: "forwardScreen",
    name: "Forward Screen",
    type: "defense",
    speed: 5,
    staminaCost: 9,
    magicCost: 0,
    hitBase: 0,
    power: 0,
    immediate: {
      selfFlux: { balance: 6, focus: 6 },
    },
    persistent: {
      selfFlux: { focus: 4 },
    },
    description: "Keeps pressure while guarding lanes.",
  },
  bloodUp: {
    id: "bloodUp",
    name: "Blood Up",
    type: "ability",
    speed: 4,
    staminaCost: 0,
    magicCost: 0,
    hitBase: 0,
    power: 0,
    immediate: {
      selfFlux: { adrenaline: 10, pain: 6 },
    },
    persistent: {
      selfFlux: { adrenaline: 4 },
    },
    description: "Raises aggression and pain tolerance.",
  },
  pressureBeat: {
    id: "pressureBeat",
    name: "Pressure Beat",
    type: "ability",
    speed: 7,
    staminaCost: 5,
    magicCost: 0,
    hitBase: 0,
    power: 0,
    immediate: {
      targetFlux: { focus: -8 },
      selfFlux: { focus: 4 },
    },
    persistent: {
      targetFlux: { focus: -3 },
    },
    description: "Tempo disruption that affects later turns.",
  },
  hardCover: {
    id: "hardCover",
    name: "Hard Cover",
    type: "defense",
    speed: 3,
    staminaCost: 10,
    magicCost: 0,
    hitBase: 0,
    power: 0,
    immediate: {
      selfFlux: { grounding: 10, balance: 6 },
    },
    persistent: {
      selfFlux: { grounding: 4 },
    },
    description: "Sturdy fallback against counter-pressure.",
  },

  // Vanguard - Common Ground
  groundLatch: {
    id: "groundLatch",
    name: "Ground Latch",
    type: "defense",
    speed: 4,
    staminaCost: 8,
    magicCost: 0,
    hitBase: 0,
    power: 0,
    immediate: {
      selfFlux: { grounding: 14, focus: 4 },
    },
    persistent: {
      selfFlux: { grounding: 5 },
    },
    description: "Defensive survival from the ground.",
  },
  heelKick: {
    id: "heelKick",
    name: "Heel Kick",
    type: "offense",
    speed: 7,
    staminaCost: 10,
    magicCost: 0,
    hitBase: 13,
    power: 11,
    immediate: {
      targetFlux: { balance: -7 },
    },
    persistent: {
      targetFlux: { balance: -2 },
    },
    description: "Fast low strike from unstable footing.",
  },
  scrambleRise: {
    id: "scrambleRise",
    name: "Scramble Rise",
    type: "ability",
    speed: 6,
    staminaCost: 8,
    magicCost: 0,
    hitBase: 0,
    power: 0,
    immediate: {
      selfFlux: { balance: 12, grounding: 8 },
    },
    persistent: {
      selfFlux: { balance: 3 },
    },
    description: "Recover position after being brought low.",
  },
  lowGuard: {
    id: "lowGuard",
    name: "Low Guard",
    type: "defense",
    speed: 5,
    staminaCost: 7,
    magicCost: 0,
    hitBase: 0,
    power: 0,
    immediate: {
      selfFlux: { focus: 8, grounding: 6 },
    },
    persistent: {
      selfFlux: { focus: 3 },
    },
    description: "Grounded protection that stays relevant.",
  },
  snagAnkle: {
    id: "snagAnkle",
    name: "Snag Ankle",
    type: "offense",
    speed: 5,
    staminaCost: 9,
    magicCost: 0,
    hitBase: 11,
    power: 10,
    immediate: {
      targetFlux: { balance: -9, grounding: -5 },
    },
    persistent: {
      targetFlux: { balance: -3 },
    },
    description: "Drags the opponent into a worse next round.",
  },
  dirtRead: {
    id: "dirtRead",
    name: "Dirt Read",
    type: "ability",
    speed: 4,
    staminaCost: 0,
    magicCost: 4,
    hitBase: 0,
    power: 0,
    immediate: {
      selfFlux: { focus: 10 },
      targetFlux: { focus: -4 },
    },
    persistent: {
      selfFlux: { focus: 4 },
    },
    description: "A tactical reset and read of the opponent.",
  },

  // Arcanist - Veil Step
  veilCut: {
    id: "veilCut",
    name: "Veil Cut",
    type: "offense",
    speed: 9,
    staminaCost: 8,
    magicCost: 4,
    hitBase: 18,
    power: 13,
    immediate: {
      targetFlux: { focus: -10, pain: -6 },
      selfFlux: { magicPoints: -4 },
    },
    persistent: {
      targetFlux: { focus: -4 },
    },
    description: "Fast precise attack from a mobile stance.",
  },
  feintNeedle: {
    id: "feintNeedle",
    name: "Feint Needle",
    type: "offense",
    speed: 10,
    staminaCost: 6,
    magicCost: 5,
    hitBase: 19,
    power: 9,
    immediate: {
      targetFlux: { balance: -6, focus: -8 },
    },
    persistent: {
      targetFlux: { focus: -3 },
    },
    description: "Low power but high accuracy pressure.",
  },
  slipWard: {
    id: "slipWard",
    name: "Slip Ward",
    type: "defense",
    speed: 8,
    staminaCost: 4,
    magicCost: 4,
    hitBase: 0,
    power: 0,
    immediate: {
      selfFlux: { balance: 8, focus: 10 },
    },
    persistent: {
      selfFlux: { focus: 4 },
    },
    description: "Agile defensive response.",
  },
  glassMind: {
    id: "glassMind",
    name: "Glass Mind",
    type: "ability",
    speed: 6,
    staminaCost: 0,
    magicCost: 7,
    hitBase: 0,
    power: 0,
    immediate: {
      selfFlux: { focus: 12 },
      targetFlux: { mentalFatigue: -8 },
    },
    persistent: {
      targetFlux: { focus: -2 },
    },
    description: "Attacks mental clarity over time.",
  },
  mirageLane: {
    id: "mirageLane",
    name: "Mirage Lane",
    type: "ability",
    speed: 7,
    staminaCost: 0,
    magicCost: 6,
    hitBase: 0,
    power: 0,
    immediate: {
      selfFlux: { balance: 6, grounding: 4 },
      targetFlux: { focus: -5 },
    },
    persistent: {
      selfFlux: { focus: 2 },
      targetFlux: { focus: -2 },
    },
    description: "Distorts the rhythm of future exchanges.",
  },
  sidestepSeal: {
    id: "sidestepSeal",
    name: "Sidestep Seal",
    type: "defense",
    speed: 9,
    staminaCost: 5,
    magicCost: 3,
    hitBase: 0,
    power: 0,
    immediate: {
      selfFlux: { balance: 10, focus: 6 },
    },
    persistent: {
      selfFlux: { balance: 3 },
    },
    description: "Fast protection that keeps mobility online.",
  },

  // Arcanist - Channel Form
  pulseBolt: {
    id: "pulseBolt",
    name: "Pulse Bolt",
    type: "offense",
    speed: 6,
    staminaCost: 2,
    magicCost: 10,
    hitBase: 16,
    power: 15,
    immediate: {
      targetFlux: { pain: -9, grounding: -4 },
    },
    persistent: {
      targetFlux: { pain: -3 },
    },
    description: "Reliable magical offense with lasting sting.",
  },
  lanceThread: {
    id: "lanceThread",
    name: "Lance Thread",
    type: "offense",
    speed: 7,
    staminaCost: 2,
    magicCost: 12,
    hitBase: 17,
    power: 17,
    immediate: {
      targetFlux: { focus: -6, pain: -8 },
    },
    persistent: {
      targetFlux: { mentalFatigue: -3 },
    },
    description: "Focused magical strike.",
  },
  manaScreen: {
    id: "manaScreen",
    name: "Mana Screen",
    type: "defense",
    speed: 5,
    staminaCost: 0,
    magicCost: 8,
    hitBase: 0,
    power: 0,
    immediate: {
      selfFlux: { grounding: 8, focus: 8 },
    },
    persistent: {
      selfFlux: { grounding: 3, focus: 2 },
    },
    description: "Resource-backed defense that lingers.",
  },
  reservePulse: {
    id: "reservePulse",
    name: "Reserve Pulse",
    type: "ability",
    speed: 4,
    staminaCost: 0,
    magicCost: 0,
    hitBase: 0,
    power: 0,
    immediate: {
      selfFlux: { magicPoints: 10, focus: 6 },
    },
    persistent: {
      selfFlux: { magicPoints: 3 },
    },
    description: "Recovers magical resources for later turns.",
  },
  intentMark: {
    id: "intentMark",
    name: "Intent Mark",
    type: "ability",
    speed: 6,
    staminaCost: 0,
    magicCost: 7,
    hitBase: 0,
    power: 0,
    immediate: {
      targetFlux: { focus: -7, balance: -4 },
    },
    persistent: {
      targetFlux: { focus: -3 },
    },
    description: "Marks the opponent for future pressure.",
  },
  quietWard: {
    id: "quietWard",
    name: "Quiet Ward",
    type: "defense",
    speed: 4,
    staminaCost: 0,
    magicCost: 6,
    hitBase: 0,
    power: 0,
    immediate: {
      selfFlux: { focus: 10, grounding: 6 },
    },
    persistent: {
      selfFlux: { focus: 3 },
    },
    description: "Stabilizes magical channeling.",
  },

  // Arcanist - Common Ground
  rootKnot: {
    id: "rootKnot",
    name: "Root Knot",
    type: "defense",
    speed: 4,
    staminaCost: 2,
    magicCost: 5,
    hitBase: 0,
    power: 0,
    immediate: {
      selfFlux: { grounding: 14, focus: 6 },
    },
    persistent: {
      selfFlux: { grounding: 5 },
    },
    description: "Ground recovery for the arcanist.",
  },
  sparkHeel: {
    id: "sparkHeel",
    name: "Spark Heel",
    type: "offense",
    speed: 7,
    staminaCost: 5,
    magicCost: 4,
    hitBase: 14,
    power: 10,
    immediate: {
      targetFlux: { balance: -7, pain: -5 },
    },
    persistent: {
      targetFlux: { balance: -2 },
    },
    description: "A quick low strike to create space.",
  },
  groundCipher: {
    id: "groundCipher",
    name: "Ground Cipher",
    type: "ability",
    speed: 5,
    staminaCost: 0,
    magicCost: 5,
    hitBase: 0,
    power: 0,
    immediate: {
      selfFlux: { focus: 10, grounding: 6 },
      targetFlux: { focus: -4 },
    },
    persistent: {
      selfFlux: { focus: 3 },
    },
    description: "Rebuilds control from a poor position.",
  },
  turtleVeil: {
    id: "turtleVeil",
    name: "Turtle Veil",
    type: "defense",
    speed: 3,
    staminaCost: 1,
    magicCost: 4,
    hitBase: 0,
    power: 0,
    immediate: {
      selfFlux: { balance: 8, grounding: 10 },
    },
    persistent: {
      selfFlux: { grounding: 4 },
    },
    description: "Slow but reliable ground defense.",
  },
  elbowSpark: {
    id: "elbowSpark",
    name: "Elbow Spark",
    type: "offense",
    speed: 6,
    staminaCost: 6,
    magicCost: 3,
    hitBase: 13,
    power: 12,
    immediate: {
      targetFlux: { pain: -8, focus: -4 },
    },
    persistent: {
      targetFlux: { pain: -2 },
    },
    description: "Close-range burst from grounded posture.",
  },
  riseThread: {
    id: "riseThread",
    name: "Rise Thread",
    type: "ability",
    speed: 6,
    staminaCost: 2,
    magicCost: 5,
    hitBase: 0,
    power: 0,
    immediate: {
      selfFlux: { balance: 12, focus: 6 },
    },
    persistent: {
      selfFlux: { balance: 3 },
    },
    description: "Starts the recovery back to mobile play.",
  },
};

// ----------------------------
// Fighters and Stances
// ----------------------------

const createVanguard = (): FighterState => {
  const stances: Stance[] = [
    {
      id: "ironGuard",
      name: "Iron Guard",
      description: "High grounding, measured defense, reliable counter setup.",
      resetBalanceTo: 70,
      resetGroundingTo: 80,
      bonuses: { hitBonus: 2, evasionBonus: 6, speedBonus: -1, powerBonus: 3 },
      moveIds: [
        "braceWall",
        "shieldCheck",
        "punishingCut",
        "rallyBreath",
        "anchorStep",
        "interceptGuard",
      ],
    },
    {
      id: "forwardPressure",
      name: "Forward Pressure",
      description: "Attack-forward stance with better tempo and adrenaline.",
      resetBalanceTo: 60,
      resetGroundingTo: 55,
      bonuses: { hitBonus: 5, evasionBonus: 1, speedBonus: 2, powerBonus: 4 },
      moveIds: [
        "rushDrive",
        "cleavingLine",
        "forwardScreen",
        "bloodUp",
        "pressureBeat",
        "hardCover",
      ],
    },
    {
      id: "commonGroundV",
      name: "Common Ground",
      description: "Fallback stance used when fighting from the ground.",
      resetBalanceTo: 45,
      resetGroundingTo: 75,
      bonuses: { hitBonus: 1, evasionBonus: 3, speedBonus: 0, powerBonus: 1 },
      moveIds: [
        "groundLatch",
        "heelKick",
        "scrambleRise",
        "lowGuard",
        "snagAnkle",
        "dirtRead",
      ],
    },
  ];

  const innate: InnateStats = {
    strength: 18,
    knowledge: 10,
    agility: 11,
    endurance: 18,
    technique: 13,
    will: 15,
  };

  const flux: FluxStats = {
    balance: 70,
    grounding: 80,
    focus: 58,
    stamina: 62,
    fatigue: 64,
    pain: 60,
    adrenaline: 30,
    mentalFatigue: 55,
    magicPoints: 20,
  };

  return {
    id: "p1",
    name: "Player 1",
    archetype: "Vanguard",
    innate,
    flux,
    currentInnate: { ...innate },
    currentFlux: { ...flux },
    activeStanceId: "ironGuard",
    stances,
    hp: 100,
  };
};

const createArcanist = (): FighterState => {
  const stances: Stance[] = [
    {
      id: "veilStep",
      name: "Veil Step",
      description: "Mobile stance with speed and accuracy pressure.",
      resetBalanceTo: 78,
      resetGroundingTo: 50,
      bonuses: { hitBonus: 6, evasionBonus: 5, speedBonus: 3, powerBonus: 1 },
      moveIds: [
        "veilCut",
        "feintNeedle",
        "slipWard",
        "glassMind",
        "mirageLane",
        "sidestepSeal",
      ],
    },
    {
      id: "channelForm",
      name: "Channel Form",
      description: "Resource-heavy magical posture with strong control.",
      resetBalanceTo: 62,
      resetGroundingTo: 60,
      bonuses: { hitBonus: 4, evasionBonus: 2, speedBonus: 0, powerBonus: 5 },
      moveIds: [
        "pulseBolt",
        "lanceThread",
        "manaScreen",
        "reservePulse",
        "intentMark",
        "quietWard",
      ],
    },
    {
      id: "commonGroundA",
      name: "Common Ground",
      description: "Ground recovery posture for the arcanist.",
      resetBalanceTo: 48,
      resetGroundingTo: 72,
      bonuses: { hitBonus: 1, evasionBonus: 3, speedBonus: 0, powerBonus: 1 },
      moveIds: [
        "rootKnot",
        "sparkHeel",
        "groundCipher",
        "turtleVeil",
        "elbowSpark",
        "riseThread",
      ],
    },
  ];

  const innate: InnateStats = {
    strength: 9,
    knowledge: 19,
    agility: 16,
    endurance: 10,
    technique: 17,
    will: 16,
  };

  const flux: FluxStats = {
    balance: 78,
    grounding: 50,
    focus: 68,
    stamina: 40,
    fatigue: 42,
    pain: 52,
    adrenaline: 24,
    mentalFatigue: 64,
    magicPoints: 72,
  };

  return {
    id: "p2",
    name: "Player 2",
    archetype: "Arcanist",
    innate,
    flux,
    currentInnate: { ...innate },
    currentFlux: { ...flux },
    activeStanceId: "veilStep",
    stances,
    hp: 100,
  };
};

// ----------------------------
// Main component
// ----------------------------

export default function Phase1BattlePrototype() {
  const [fighterA, setFighterA] = useState<FighterState>(() => createVanguard());
  const [fighterB, setFighterB] = useState<FighterState>(() => createArcanist());
  const [queue, setQueue] = useState<QueuedMove[]>([]);
  const [round, setRound] = useState(1);
  const [combatLog, setCombatLog] = useState<string[]>([
    "Phase 1 ready. Pick a visible stance for each player, then choose one move each.",
  ]);
  const [lastResolution, setLastResolution] = useState<ResolutionEntry[]>([]);

  const [pendingA, setPendingA] = useState<PendingChoice>({
    stanceId: fighterA.activeStanceId,
    moveId: getStance(fighterA, fighterA.activeStanceId).moveIds[0],
  });
  const [pendingB, setPendingB] = useState<PendingChoice>({
    stanceId: fighterB.activeStanceId,
    moveId: getStance(fighterB, fighterB.activeStanceId).moveIds[0],
  });

  const previewA = useMemo(() => {
    return sumPersistentEffects(fighterA, fighterB, queue);
  }, [fighterA, fighterB, queue]);

  const previewB = useMemo(() => {
    return sumPersistentEffects(fighterB, fighterA, queue);
  }, [fighterA, fighterB, queue]);

  const getMoveList = (fighter: FighterState, stanceId: string) => {
    const stance = getStance(fighter, stanceId);
    return stance.moveIds.map((id) => MOVES[id]);
  };

  const applyImmediateEffects = (
    actor: FighterState,
    target: FighterState,
    move: Move
  ): { actor: FighterState; target: FighterState } => {
    const nextActor: FighterState = {
      ...actor,
      currentFlux: applyFluxPatch(actor.currentFlux, move.immediate.selfFlux),
      currentInnate: applyInnatePatch(actor.currentInnate, move.immediate.selfInnate),
    };

    const nextTarget: FighterState = {
      ...target,
      currentFlux: applyFluxPatch(target.currentFlux, move.immediate.targetFlux),
      currentInnate: applyInnatePatch(target.currentInnate, move.immediate.targetInnate),
    };

    return { actor: nextActor, target: nextTarget };
  };

  const resolveMove = (
    actor: FighterState,
    target: FighterState,
    move: Move,
    stance: Stance,
    defenderChosenMove: Move,
    defenderStance: Stance
  ): {
    actor: FighterState;
    target: FighterState;
    entry: ResolutionEntry;
  } => {
    const attackHit =
      move.hitBase +
      move.speed +
      actor.currentInnate.agility +
      actor.currentInnate.technique +
      actor.currentFlux.focus +
      stance.bonuses.hitBonus +
      stance.bonuses.speedBonus -
      Math.max(0, 20 - actor.currentFlux.stamina);

    const defenseBonusFromChosenMove =
      defenderChosenMove.type === "defense" ? 8 : defenderChosenMove.type === "ability" ? 2 : 0;

    const evade =
      target.currentInnate.agility +
      target.currentFlux.balance +
      target.currentFlux.focus +
      target.currentFlux.grounding +
      defenderStance.bonuses.evasionBonus +
      defenseBonusFromChosenMove;

    const isHit = move.type === "offense" && attackHit > evade;

    const baseDamage = isHit
      ? Math.max(
          0,
          move.power +
            actor.currentInnate.strength +
            actor.currentInnate.technique +
            stance.bonuses.powerBonus -
            Math.max(0, 20 - actor.currentFlux.fatigue) -
            Math.floor(target.currentInnate.endurance / 2)
        )
      : 0;

    let updatedActor = actor;
    let updatedTarget = target;

    if (move.type === "offense") {
      const applied = applyImmediateEffects(updatedActor, updatedTarget, move);
      updatedActor = applied.actor;
      updatedTarget = applied.target;

      if (isHit) {
        updatedTarget = {
          ...updatedTarget,
          hp: clamp(updatedTarget.hp - baseDamage, 0, 100),
          currentFlux: applyFluxPatch(updatedTarget.currentFlux, {
            pain: -Math.max(2, Math.floor(baseDamage / 3)),
          }),
        };
      }
    } else {
      const applied = applyImmediateEffects(updatedActor, updatedTarget, move);
      updatedActor = applied.actor;
      updatedTarget = applied.target;
    }

    const note =
      move.type === "offense"
        ? isHit
          ? `Hit for ${baseDamage}.`
          : "Missed."
        : move.type === "defense"
        ? "Defensive move applied current-round protection and queued effects."
        : "Ability move applied immediate and queued effects.";

    return {
      actor: updatedActor,
      target: updatedTarget,
      entry: {
        actorName: actor.name,
        targetName: target.name,
        moveName: move.name,
        speed: move.speed + stance.bonuses.speedBonus,
        hitScore: move.type === "offense" ? attackHit : 0,
        evadeScore: move.type === "offense" ? evade : 0,
        hit: isHit,
        damage: baseDamage,
        note,
      },
    };
  };

  const recalcPersistentStates = (
    nextA: FighterState,
    nextB: FighterState,
    nextQueue: QueuedMove[]
  ) => {
    const a = sumPersistentEffects(nextA, nextB, nextQueue);
    const b = sumPersistentEffects(nextB, nextA, nextQueue);

    return {
      a: {
        ...nextA,
        currentInnate: a.innate,
        currentFlux: a.flux,
      },
      b: {
        ...nextB,
        currentInnate: b.innate,
        currentFlux: b.flux,
      },
    };
  };

  const beginRound = () => {
    let nextA: FighterState = {
      ...fighterA,
      activeStanceId: pendingA.stanceId,
      currentFlux: {
        ...fighterA.currentFlux,
        balance: getStance(fighterA, pendingA.stanceId).resetBalanceTo,
        grounding: getStance(fighterA, pendingA.stanceId).resetGroundingTo,
      },
    };

    let nextB: FighterState = {
      ...fighterB,
      activeStanceId: pendingB.stanceId,
      currentFlux: {
        ...fighterB.currentFlux,
        balance: getStance(fighterB, pendingB.stanceId).resetBalanceTo,
        grounding: getStance(fighterB, pendingB.stanceId).resetGroundingTo,
      },
    };

    const moveA = MOVES[pendingA.moveId];
    const moveB = MOVES[pendingB.moveId];
    const stanceA = getStance(nextA, pendingA.stanceId);
    const stanceB = getStance(nextB, pendingB.stanceId);

    const order = [
      {
        actorKey: "A" as const,
        speed: moveA.speed + stanceA.bonuses.speedBonus,
        move: moveA,
        stance: stanceA,
        defenderMove: moveB,
        defenderStance: stanceB,
      },
      {
        actorKey: "B" as const,
        speed: moveB.speed + stanceB.bonuses.speedBonus,
        move: moveB,
        stance: stanceB,
        defenderMove: moveA,
        defenderStance: stanceA,
      },
    ].sort((x, y) => y.speed - x.speed);

    const resolutionEntries: ResolutionEntry[] = [];

    order.forEach((step) => {
      if (step.actorKey === "A") {
        const resolved = resolveMove(
          nextA,
          nextB,
          step.move,
          step.stance,
          step.defenderMove,
          step.defenderStance
        );
        nextA = resolved.actor;
        nextB = resolved.target;
        resolutionEntries.push(resolved.entry);
      } else {
        const resolved = resolveMove(
          nextB,
          nextA,
          step.move,
          step.stance,
          step.defenderMove,
          step.defenderStance
        );
        nextB = resolved.actor;
        nextA = resolved.target;
        resolutionEntries.push(resolved.entry);
      }
    });

    let nextQueue = [
      ...queue,
      {
        queueId: `q-${round}-A-${moveA.id}`,
        ownerId: nextA.id,
        targetId: nextB.id,
        move: moveA,
        stanceId: stanceA.id,
        roundAdded: round,
      },
      {
        queueId: `q-${round}-B-${moveB.id}`,
        ownerId: nextB.id,
        targetId: nextA.id,
        move: moveB,
        stanceId: stanceB.id,
        roundAdded: round,
      },
    ];

    const logBits: string[] = [];
    logBits.push(
      `Round ${round}: ${nextA.name} used ${moveA.name} from ${stanceA.name}; ${nextB.name} used ${moveB.name} from ${stanceB.name}.`
    );
    resolutionEntries.forEach((r) => {
      logBits.push(
        `${r.actorName} -> ${r.moveName} (spd ${r.speed}) | ${r.note}${
          r.hitScore ? ` Hit ${r.hitScore} vs Evade ${r.evadeScore}.` : ""
        }`
      );
    });

    if (nextQueue.length >= 6) {
      const removed = nextQueue.slice(0, 2);
      nextQueue = nextQueue.slice(2);
      logBits.push(
        `Dequeued: ${removed.map((m) => `${m.move.name} (${m.ownerId === nextA.id ? nextA.name : nextB.name})`).join(", ")}.`
      );
    } else {
      logBits.push(`Queue building: ${nextQueue.length}/6 before dequeue begins.`);
    }

    const recalculated = recalcPersistentStates(nextA, nextB, nextQueue);
    nextA = recalculated.a;
    nextB = recalculated.b;

    setFighterA(nextA);
    setFighterB(nextB);
    setQueue(nextQueue);
    setLastResolution(resolutionEntries);
    setCombatLog((prev) => [...logBits, ...prev].slice(0, 18));
    setRound((r) => r + 1);

    setPendingA({
      stanceId: nextA.activeStanceId,
      moveId: getStance(nextA, nextA.activeStanceId).moveIds[0],
    });
    setPendingB({
      stanceId: nextB.activeStanceId,
      moveId: getStance(nextB, nextB.activeStanceId).moveIds[0],
    });
  };

  const resetBattle = () => {
    const a = createVanguard();
    const b = createArcanist();
    setFighterA(a);
    setFighterB(b);
    setQueue([]);
    setRound(1);
    setLastResolution([]);
    setCombatLog(["Phase 1 ready. Pick a visible stance for each player, then choose one move each."]);
    setPendingA({ stanceId: a.activeStanceId, moveId: getStance(a, a.activeStanceId).moveIds[0] });
    setPendingB({ stanceId: b.activeStanceId, moveId: getStance(b, b.activeStanceId).moveIds[0] });
  };

  const renderFighterCard = (
    fighter: FighterState,
    opponent: FighterState,
    pending: PendingChoice,
    setPending: React.Dispatch<React.SetStateAction<PendingChoice>>,
    preview: { innate: InnateStats; flux: FluxStats }
  ) => {
    const stance = getStance(fighter, pending.stanceId);
    const moves = getMoveList(fighter, pending.stanceId);

    return (
      <Card sx={{ height: "100%" }}>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h5">{fighter.name}</Typography>
              <Typography variant="subtitle1">{fighter.archetype}</Typography>
              <Typography variant="body2">HP: {fighter.hp}</Typography>
              <Typography variant="body2">Opponent: {opponent.archetype}</Typography>
            </Box>

            <Box>
              <Typography variant="subtitle1">Visible stance choice</Typography>
              <Select
                fullWidth
                size="small"
                value={pending.stanceId}
                onChange={(e) => {
                  const stanceId = e.target.value;
                  setPending((prev) => ({
                    stanceId,
                    moveId: getStance(fighter, stanceId).moveIds[0],
                  }));
                }}
              >
                {fighter.stances.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </Select>
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                {stance.description}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                <Chip label={`Hit ${stance.bonuses.hitBonus >= 0 ? "+" : ""}${stance.bonuses.hitBonus}`} size="small" />
                <Chip label={`Evade ${stance.bonuses.evasionBonus >= 0 ? "+" : ""}${stance.bonuses.evasionBonus}`} size="small" />
                <Chip label={`Speed ${stance.bonuses.speedBonus >= 0 ? "+" : ""}${stance.bonuses.speedBonus}`} size="small" />
                <Chip label={`Power ${stance.bonuses.powerBonus >= 0 ? "+" : ""}${stance.bonuses.powerBonus}`} size="small" />
              </Stack>
            </Box>

            <Box>
              <Typography variant="subtitle1">Move choice</Typography>
              <Select
                fullWidth
                size="small"
                value={pending.moveId}
                onChange={(e) =>
                  setPending((prev) => ({ ...prev, moveId: e.target.value }))
                }
              >
                {moves.map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    {m.name} ({m.type})
                  </MenuItem>
                ))}
              </Select>
              <Paper variant="outlined" sx={{ p: 1.5, mt: 1 }}>
                {(() => {
                  const move = MOVES[pending.moveId];
                  return (
                    <Stack spacing={0.5}>
                      <Typography variant="body2"><strong>{move.name}</strong> • {move.type}</Typography>
                      <Typography variant="body2">{move.description}</Typography>
                      <Typography variant="caption">Speed {move.speed} | Hit {move.hitBase} | Power {move.power}</Typography>
                      <Typography variant="caption">Stamina {move.staminaCost} | Magic {move.magicCost}</Typography>
                      <Typography variant="caption">Immediate self: {formatPatch(move.immediate.selfFlux as Record<string, number>)}</Typography>
                      <Typography variant="caption">Immediate target: {formatPatch(move.immediate.targetFlux as Record<string, number>)}</Typography>
                      <Typography variant="caption">Queued self: {formatPatch(move.persistent.selfFlux as Record<string, number>)}</Typography>
                      <Typography variant="caption">Queued target: {formatPatch(move.persistent.targetFlux as Record<string, number>)}</Typography>
                    </Stack>
                  );
                })()}
              </Paper>
            </Box>

            <Divider />

            <Grid2 container spacing={1}>
              <Grid2 size={6 as any}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="subtitle2">Innate preview</Typography>
                  {Object.entries(preview.innate).map(([k, v]) => (
                    <Typography key={k} variant="body2">
                      {k}: {v}
                    </Typography>
                  ))}
                </Paper>
              </Grid2>
              <Grid2 size={6 as any}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="subtitle2">Flux preview</Typography>
                  {Object.entries(preview.flux).map(([k, v]) => (
                    <Typography key={k} variant="body2">
                      {k}: {v}
                    </Typography>
                  ))}
                </Paper>
              </Grid2>
            </Grid2>
          </Stack>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h4">Queued Stance Battle Prototype</Typography>
          <Typography variant="body1">
            Phase 1: visible stance choice, simultaneous move selection, shared queue, persistent queued effects, dequeue after 6 cards.
          </Typography>
        </Box>

        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Box sx={{ flex: 1 }}>
            {renderFighterCard(fighterA, fighterB, pendingA, setPendingA, previewA)}
          </Box>

          <Box sx={{ width: { xs: "100%", md: 430 } }}>
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6">Round {round}</Typography>
                  <Typography variant="body2">Queue size: {queue.length}</Typography>

                  <Box>
                    <Typography variant="subtitle1">Shared queue</Typography>
                    <Stack spacing={1} sx={{ mt: 1, maxHeight: 360, overflow: "auto" }}>
                      {queue.length === 0 ? (
                        <Paper variant="outlined" sx={{ p: 1.5 }}>
                          <Typography variant="body2">No queued moves yet.</Typography>
                        </Paper>
                      ) : (
                        queue.map((q, index) => (
                          <Paper key={q.queueId} variant="outlined" sx={{ p: 1.5 }}>
                            <Typography variant="body2">
                              #{index + 1} {q.ownerId === fighterA.id ? fighterA.name : fighterB.name} • {q.move.name}
                            </Typography>
                            <Typography variant="caption" display="block">
                              {q.move.type} | speed {q.move.speed} | round {q.roundAdded}
                            </Typography>
                            <Typography variant="caption" display="block">
                              Queued self: {formatPatch(q.move.persistent.selfFlux as Record<string, number>)}
                            </Typography>
                            <Typography variant="caption" display="block">
                              Queued target: {formatPatch(q.move.persistent.targetFlux as Record<string, number>)}
                            </Typography>
                          </Paper>
                        ))
                      )}
                    </Stack>
                  </Box>

                  <Stack direction="row" spacing={1}>
                    <Button fullWidth variant="contained" onClick={beginRound}>
                      Resolve Round
                    </Button>
                    <Button fullWidth variant="outlined" onClick={resetBattle}>
                      Reset
                    </Button>
                  </Stack>

                  <Box>
                    <Typography variant="subtitle1">Last resolution</Typography>
                    <List dense>
                      {lastResolution.length === 0 ? (
                        <ListItem>
                          <ListItemText primary="No round resolved yet." />
                        </ListItem>
                      ) : (
                        lastResolution.map((r, i) => (
                          <ListItem key={`${r.actorName}-${r.moveName}-${i}`}>
                            <ListItemText
                              primary={`${r.actorName}: ${r.moveName}`}
                              secondary={`${r.note} ${r.hitScore ? `Hit ${r.hitScore} vs Evade ${r.evadeScore}.` : ""}`}
                            />
                          </ListItem>
                        ))
                      )}
                    </List>
                  </Box>

                  <Box>
                    <Typography variant="subtitle1">Combat log</Typography>
                    <List dense>
                      {combatLog.map((line, i) => (
                        <ListItem key={`${line}-${i}`}>
                          <ListItemText primary={line} />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Box>

          <Box sx={{ flex: 1 }}>
            {renderFighterCard(fighterB, fighterA, pendingB, setPendingB, previewB)}
          </Box>
        </Stack>
      </Stack>
    </Box>
  );
}
