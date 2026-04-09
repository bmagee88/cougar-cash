import React, { useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";

type MoveType = "offense" | "defense" | "ability";
type DamageType = "bludgeoning" | "cutting" | "piercing";
type FluxKey =
  | "balance"
  | "grounding"
  | "focus"
  | "stamina"
  | "fatigue"
  | "pain"
  | "adrenaline"
  | "mentalFatigue"
  | "magicPoints";
type InnateKey = "strength" | "knowledge" | "agility" | "endurance" | "technique" | "will";
type CounterKey = "stagger" | "rattled" | "wounded" | "strained";

type InnateStats = Record<InnateKey, number>;
type FluxStats = Record<FluxKey, number>;
type Counters = Record<CounterKey, number>;
type DeltaMap = Record<string, number>;

type Delta = {
  selfFlux?: Partial<Record<FluxKey, number>>;
  targetFlux?: Partial<Record<FluxKey, number>>;
  selfInnate?: Partial<Record<InnateKey, number>>;
  targetInnate?: Partial<Record<InnateKey, number>>;
};

type DamageProfile = Record<DamageType, number>;

type MoveTag =
  | "pressure"
  | "break"
  | "convert"
  | "stabilize"
  | "recover"
  | "scar"
  | "sharp"
  | "heavy"
  | "anti-fallen"
  | "anti-focus-broken"
  | "anti-armor";

type Move = {
  id: string;
  name: string;
  type: MoveType;
  speed: number;
  staminaCost: number;
  magicCost: number;
  hitBase: number;
  immediate: Delta;
  persistent: Delta;
  damage?: DamageProfile;
  primaryType?: DamageType;
  sharpBonus?: number;
  tags: MoveTag[];
  description: string;
};

type Armor = {
  name: string;
  coverage: number;
  resist: DamageProfile;
};

type Stance = {
  id: string;
  name: string;
  description: string;
  resetBalanceTo: number;
  resetGroundingTo: number;
  bonuses: {
    hit: number;
    evade: number;
    speed: number;
    power: number;
    antiPiercing: number;
  };
  moveIds: string[];
};

type StatChanges = {
  hp: number;
  innate: Partial<Record<InnateKey, number>>;
  flux: Partial<Record<FluxKey, number>>;
};

type Fighter = {
  id: string;
  name: string;
  archetype: string;
  innate: InnateStats;
  flux: FluxStats;
  currentInnate: InnateStats;
  currentFlux: FluxStats;
  counters: Counters;
  stances: Stance[];
  activeStanceId: string;
  hp: number;
  armor: Armor;
  lastRoundChanges: StatChanges;
};

type QueuedMove = {
  queueId: string;
  ownerId: string;
  targetId: string;
  move: Move;
  stanceId: string;
  roundAdded: number;
};

type PendingChoice = { stanceId: string; moveId: string };

type CrashState = {
  fallen: boolean;
  groundingBroken: boolean;
  focusBroken: boolean;
  exhausted: boolean;
  overstrained: boolean;
  overwhelmed: boolean;
  mentallyBroken: boolean;
  outOfMagic: boolean;
};

type ResolutionEntry = {
  actorName: string;
  targetName: string;
  moveName: string;
  speed: number;
  hitScore: number;
  evadeScore: number;
  armorThreshold: number;
  outcome: "miss" | "armor" | "flesh" | "support";
  damage: number;
  note: string;
  breakdown: string;
};

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
const STANCE_SWITCH_STAMINA_COST = 6;
const STANCE_SWITCH_SPEED_PENALTY = 2;
const CRASH_TOOLTIPS: Record<keyof CrashState, string> = {
  fallen: "Balance is 0 or below. The fighter is down, easier to exploit, and pushed toward Common Ground.",
  groundingBroken: "Grounding is 0 or below. The fighter loses stable footing and resists force poorly.",
  focusBroken: "Focus is 0 or below. Hit quality and decision-making drop sharply.",
  exhausted: "Stamina is 0 or below. Moves still happen, but with major quality penalties.",
  overstrained: "Fatigue is 0 or below. Force output collapses and long-term wear increases.",
  overwhelmed: "Pain is 0 or below. The fighter can act, but effectiveness is heavily suppressed.",
  mentallyBroken: "Mental fatigue is 0 or below. Knowledge-based and magical performance fall apart.",
  outOfMagic: "Magic points are 0 or below. Magical moves become very hard to sustain.",
};
const CRASH_LABELS: Record<keyof CrashState, string> = {
  fallen: "Fallen",
  groundingBroken: "Grounding Broken",
  focusBroken: "Focus Broken",
  exhausted: "Exhausted",
  overstrained: "Overstrained",
  overwhelmed: "Overwhelmed",
  mentallyBroken: "Mental Break",
  outOfMagic: "No Magic",
};

const emptyChanges = (): StatChanges => ({ hp: 0, innate: {}, flux: {} });

const addPatch = <K extends string>(
  obj: Record<K, number>,
  patch?: Partial<Record<K, number>>
): Record<K, number> => {
  const next: Record<K, number> = { ...obj };
  if (!patch) return next;
  for (const key of Object.keys(patch) as K[]) {
    next[key] = clamp(next[key] + (patch[key] ?? 0));
  }
  return next;
};

const addDeltaPatch = <K extends string>(
  deltas: Partial<Record<K, number>>,
  patch?: Partial<Record<K, number>>
): Partial<Record<K, number>> => {
  const next = { ...deltas };
  if (!patch) return next;
  for (const key of Object.keys(patch) as K[]) {
    next[key] = (next[key] ?? 0) + (patch[key] ?? 0);
  }
  return next;
};

const fmt = (patch?: Record<string, number>) => {
  if (!patch || !Object.keys(patch).length) return "None";
  return Object.entries(patch)
    .map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v}`)
    .join(", ");
};

const getStance = (f: Fighter, id: string) => f.stances.find((s) => s.id === id)!;
const zeroDamage = (): DamageProfile => ({ bludgeoning: 0, cutting: 0, piercing: 0 });
const makeMove = (args: Move): Move => args;

const MOVES: Record<string, Move> = {
  braceWall: makeMove({ id: "braceWall", name: "Brace Wall", type: "defense", speed: 2, staminaCost: 8, magicCost: 0, hitBase: 0, immediate: { selfFlux: { grounding: 22, balance: 18, focus: 10 } }, persistent: { selfFlux: { grounding: 10, balance: 8 } }, tags: ["stabilize"], description: "Solid defensive posture that stabilizes future rounds." }),
  shieldCheck: makeMove({ id: "shieldCheck", name: "Shield Check", type: "offense", speed: 4, staminaCost: 10, magicCost: 0, hitBase: 13, immediate: { targetFlux: { balance: -44, grounding: -26 }, selfFlux: { fatigue: -8 } }, persistent: { targetFlux: { balance: -12 } }, damage: { bludgeoning: 16, cutting: 0, piercing: 0 }, primaryType: "bludgeoning", tags: ["pressure", "break", "heavy"], description: "Forward bash that pressures balance hard." }),
  punishingCut: makeMove({ id: "punishingCut", name: "Punishing Cut", type: "offense", speed: 5, staminaCost: 14, magicCost: 0, hitBase: 15, immediate: { targetFlux: { pain: -32, focus: -16 }, selfFlux: { stamina: -8 } }, persistent: { targetFlux: { pain: -10 } }, damage: { bludgeoning: 2, cutting: 24, piercing: 6 }, primaryType: "cutting", sharpBonus: 18, tags: ["pressure", "scar", "sharp"], description: "Heavy slash with lasting pressure." }),
  rallyBreath: makeMove({ id: "rallyBreath", name: "Rally Breath", type: "ability", speed: 3, staminaCost: 0, magicCost: 0, hitBase: 0, immediate: { selfFlux: { focus: 20, stamina: 16, adrenaline: 12 } }, persistent: { selfFlux: { focus: 8 } }, tags: ["recover", "stabilize"], description: "Steadies breathing and restores composure." }),
  anchorStep: makeMove({ id: "anchorStep", name: "Anchor Step", type: "ability", speed: 4, staminaCost: 6, magicCost: 0, hitBase: 0, immediate: { selfFlux: { balance: 24, grounding: 22 } }, persistent: { selfFlux: { balance: 10, grounding: 8 } }, tags: ["stabilize", "recover"], description: "Re-centers body position." }),
  interceptGuard: makeMove({ id: "interceptGuard", name: "Intercept Guard", type: "defense", speed: 6, staminaCost: 10, magicCost: 0, hitBase: 0, immediate: { selfFlux: { focus: 16, grounding: 16 }, targetFlux: { focus: -8 } }, persistent: { selfFlux: { focus: 6 } }, tags: ["stabilize", "pressure"], description: "Fast defensive response." }),
  rushDrive: makeMove({ id: "rushDrive", name: "Rush Drive", type: "offense", speed: 8, staminaCost: 15, magicCost: 0, hitBase: 16, immediate: { targetFlux: { balance: -34, pain: -22 }, selfFlux: { fatigue: -12, adrenaline: 12 } }, persistent: { targetFlux: { balance: -10 } }, damage: { bludgeoning: 12, cutting: 14, piercing: 2 }, primaryType: "cutting", sharpBonus: 10, tags: ["pressure", "convert"], description: "Fast advancing strike." }),
  cleavingLine: makeMove({ id: "cleavingLine", name: "Cleaving Line", type: "offense", speed: 6, staminaCost: 16, magicCost: 0, hitBase: 17, immediate: { targetFlux: { pain: -36, focus: -12 }, selfFlux: { stamina: -12 } }, persistent: { targetFlux: { pain: -10 } }, damage: { bludgeoning: 0, cutting: 28, piercing: 4 }, primaryType: "cutting", sharpBonus: 20, tags: ["pressure", "scar", "sharp", "heavy"], description: "Forceful committed attack." }),
  forwardScreen: makeMove({ id: "forwardScreen", name: "Forward Screen", type: "defense", speed: 5, staminaCost: 9, magicCost: 0, hitBase: 0, immediate: { selfFlux: { balance: 14, focus: 14 } }, persistent: { selfFlux: { focus: 8 } }, tags: ["stabilize"], description: "Pressure-minded defense." }),
  bloodUp: makeMove({ id: "bloodUp", name: "Blood Up", type: "ability", speed: 4, staminaCost: 0, magicCost: 0, hitBase: 0, immediate: { selfFlux: { adrenaline: 20, pain: 14 } }, persistent: { selfFlux: { adrenaline: 10 } }, tags: ["recover", "stabilize"], description: "Raises aggression and pain tolerance." }),
  pressureBeat: makeMove({ id: "pressureBeat", name: "Pressure Beat", type: "ability", speed: 7, staminaCost: 5, magicCost: 0, hitBase: 0, immediate: { targetFlux: { focus: -40 }, selfFlux: { focus: 12 } }, persistent: { targetFlux: { focus: -12 } }, tags: ["break", "pressure"], description: "Tempo disruption." }),
  hardCover: makeMove({ id: "hardCover", name: "Hard Cover", type: "defense", speed: 3, staminaCost: 10, magicCost: 0, hitBase: 0, immediate: { selfFlux: { grounding: 22, balance: 16 } }, persistent: { selfFlux: { grounding: 10 } }, tags: ["stabilize"], description: "Sturdy fallback." }),
  groundLatch: makeMove({ id: "groundLatch", name: "Ground Latch", type: "defense", speed: 4, staminaCost: 8, magicCost: 0, hitBase: 0, immediate: { selfFlux: { grounding: 24, focus: 10 } }, persistent: { selfFlux: { grounding: 12 } }, tags: ["stabilize"], description: "Defensive survival from the ground." }),
  heelKick: makeMove({ id: "heelKick", name: "Heel Kick", type: "offense", speed: 7, staminaCost: 10, magicCost: 0, hitBase: 14, immediate: { targetFlux: { balance: -34 } }, persistent: { targetFlux: { balance: -10 } }, damage: { bludgeoning: 10, cutting: 0, piercing: 0 }, primaryType: "bludgeoning", tags: ["pressure", "anti-fallen"], description: "Fast low strike." }),
  scrambleRise: makeMove({ id: "scrambleRise", name: "Scramble Rise", type: "ability", speed: 6, staminaCost: 8, magicCost: 0, hitBase: 0, immediate: { selfFlux: { balance: 26, grounding: 16 } }, persistent: { selfFlux: { balance: 10 } }, tags: ["recover", "stabilize"], description: "Recover position." }),
  lowGuard: makeMove({ id: "lowGuard", name: "Low Guard", type: "defense", speed: 5, staminaCost: 7, magicCost: 0, hitBase: 0, immediate: { selfFlux: { focus: 16, grounding: 14 } }, persistent: { selfFlux: { focus: 8 } }, tags: ["stabilize"], description: "Grounded protection." }),
  snagAnkle: makeMove({ id: "snagAnkle", name: "Snag Ankle", type: "offense", speed: 5, staminaCost: 9, magicCost: 0, hitBase: 12, immediate: { targetFlux: { balance: -46, grounding: -20 } }, persistent: { targetFlux: { balance: -14 } }, damage: { bludgeoning: 8, cutting: 0, piercing: 4 }, primaryType: "bludgeoning", tags: ["break", "anti-fallen"], description: "Drags the opponent into a worse next round." }),
  dirtRead: makeMove({ id: "dirtRead", name: "Dirt Read", type: "ability", speed: 4, staminaCost: 0, magicCost: 4, hitBase: 0, immediate: { selfFlux: { focus: 20 }, targetFlux: { focus: -16 } }, persistent: { selfFlux: { focus: 8 } }, tags: ["recover", "pressure"], description: "Tactical reset and read." }),
  veilCut: makeMove({ id: "veilCut", name: "Veil Cut", type: "offense", speed: 9, staminaCost: 8, magicCost: 4, hitBase: 18, immediate: { targetFlux: { focus: -34, pain: -20 }, selfFlux: { magicPoints: -8 } }, persistent: { targetFlux: { focus: -12 } }, damage: { bludgeoning: 0, cutting: 18, piercing: 10 }, primaryType: "cutting", sharpBonus: 12, tags: ["pressure", "sharp", "convert"], description: "Fast precise attack." }),
  feintNeedle: makeMove({ id: "feintNeedle", name: "Feint Needle", type: "offense", speed: 10, staminaCost: 6, magicCost: 5, hitBase: 19, immediate: { targetFlux: { balance: -22, focus: -36 } }, persistent: { targetFlux: { focus: -12 } }, damage: { bludgeoning: 0, cutting: 0, piercing: 24 }, primaryType: "piercing", tags: ["break", "anti-focus-broken"], description: "Low power, high accuracy pressure." }),
  slipWard: makeMove({ id: "slipWard", name: "Slip Ward", type: "defense", speed: 8, staminaCost: 4, magicCost: 4, hitBase: 0, immediate: { selfFlux: { balance: 18, focus: 20 } }, persistent: { selfFlux: { focus: 10 } }, tags: ["stabilize"], description: "Agile defensive response." }),
  glassMind: makeMove({ id: "glassMind", name: "Glass Mind", type: "ability", speed: 6, staminaCost: 0, magicCost: 7, hitBase: 0, immediate: { selfFlux: { focus: 20 }, targetFlux: { mentalFatigue: -42 } }, persistent: { targetFlux: { focus: -8 } }, tags: ["break", "pressure"], description: "Attacks mental clarity over time." }),
  mirageLane: makeMove({ id: "mirageLane", name: "Mirage Lane", type: "ability", speed: 7, staminaCost: 0, magicCost: 6, hitBase: 0, immediate: { selfFlux: { balance: 14, grounding: 10 }, targetFlux: { focus: -24 } }, persistent: { selfFlux: { focus: 6 }, targetFlux: { focus: -8 } }, tags: ["pressure", "stabilize"], description: "Distorts future exchanges." }),
  sidestepSeal: makeMove({ id: "sidestepSeal", name: "Sidestep Seal", type: "defense", speed: 9, staminaCost: 5, magicCost: 3, hitBase: 0, immediate: { selfFlux: { balance: 20, focus: 12 } }, persistent: { selfFlux: { balance: 10 } }, tags: ["stabilize"], description: "Fast protection that keeps mobility online." }),
  pulseBolt: makeMove({ id: "pulseBolt", name: "Pulse Bolt", type: "offense", speed: 6, staminaCost: 2, magicCost: 10, hitBase: 16, immediate: { targetFlux: { pain: -28, grounding: -18 } }, persistent: { targetFlux: { pain: -12 } }, damage: { bludgeoning: 10, cutting: 0, piercing: 12 }, primaryType: "piercing", tags: ["pressure", "anti-armor"], description: "Reliable magical offense." }),
  lanceThread: makeMove({ id: "lanceThread", name: "Lance Thread", type: "offense", speed: 7, staminaCost: 2, magicCost: 12, hitBase: 17, immediate: { targetFlux: { focus: -24, pain: -26 } }, persistent: { targetFlux: { mentalFatigue: -10 } }, damage: { bludgeoning: 0, cutting: 0, piercing: 28 }, primaryType: "piercing", tags: ["convert", "anti-focus-broken"], description: "Focused magical strike." }),
  manaScreen: makeMove({ id: "manaScreen", name: "Mana Screen", type: "defense", speed: 5, staminaCost: 0, magicCost: 8, hitBase: 0, immediate: { selfFlux: { grounding: 18, focus: 18 } }, persistent: { selfFlux: { grounding: 8, focus: 6 } }, tags: ["stabilize"], description: "Resource-backed defense." }),
  reservePulse: makeMove({ id: "reservePulse", name: "Reserve Pulse", type: "ability", speed: 4, staminaCost: 0, magicCost: 0, hitBase: 0, immediate: { selfFlux: { magicPoints: 24, focus: 12 } }, persistent: { selfFlux: { magicPoints: 10 } }, tags: ["recover"], description: "Recovers magical resources." }),
  intentMark: makeMove({ id: "intentMark", name: "Intent Mark", type: "ability", speed: 6, staminaCost: 0, magicCost: 7, hitBase: 0, immediate: { targetFlux: { focus: -30, balance: -18 } }, persistent: { targetFlux: { focus: -10 } }, tags: ["pressure", "convert"], description: "Marks the opponent for future pressure." }),
  quietWard: makeMove({ id: "quietWard", name: "Quiet Ward", type: "defense", speed: 4, staminaCost: 0, magicCost: 6, hitBase: 0, immediate: { selfFlux: { focus: 20, grounding: 12 } }, persistent: { selfFlux: { focus: 8 } }, tags: ["stabilize", "recover"], description: "Stabilizes magical channeling." }),
  rootKnot: makeMove({ id: "rootKnot", name: "Root Knot", type: "defense", speed: 4, staminaCost: 2, magicCost: 5, hitBase: 0, immediate: { selfFlux: { grounding: 24, focus: 14 } }, persistent: { selfFlux: { grounding: 10 } }, tags: ["stabilize"], description: "Ground recovery." }),
  sparkHeel: makeMove({ id: "sparkHeel", name: "Spark Heel", type: "offense", speed: 7, staminaCost: 5, magicCost: 4, hitBase: 14, immediate: { targetFlux: { balance: -36, pain: -16 } }, persistent: { targetFlux: { balance: -10 } }, damage: { bludgeoning: 8, cutting: 4, piercing: 8 }, primaryType: "bludgeoning", tags: ["pressure", "anti-fallen"], description: "Quick low strike." }),
  groundCipher: makeMove({ id: "groundCipher", name: "Ground Cipher", type: "ability", speed: 5, staminaCost: 0, magicCost: 5, hitBase: 0, immediate: { selfFlux: { focus: 20, grounding: 12 }, targetFlux: { focus: -16 } }, persistent: { selfFlux: { focus: 8 } }, tags: ["recover", "pressure"], description: "Rebuilds control from a poor position." }),
  turtleVeil: makeMove({ id: "turtleVeil", name: "Turtle Veil", type: "defense", speed: 3, staminaCost: 1, magicCost: 4, hitBase: 0, immediate: { selfFlux: { balance: 16, grounding: 20 } }, persistent: { selfFlux: { grounding: 8 } }, tags: ["stabilize"], description: "Slow but reliable ground defense." }),
  elbowSpark: makeMove({ id: "elbowSpark", name: "Elbow Spark", type: "offense", speed: 6, staminaCost: 6, magicCost: 3, hitBase: 13, immediate: { targetFlux: { pain: -28, focus: -14 } }, persistent: { targetFlux: { pain: -8 } }, damage: { bludgeoning: 12, cutting: 0, piercing: 6 }, primaryType: "bludgeoning", tags: ["pressure", "scar"], description: "Close-range burst." }),
  riseThread: makeMove({ id: "riseThread", name: "Rise Thread", type: "ability", speed: 6, staminaCost: 2, magicCost: 5, hitBase: 0, immediate: { selfFlux: { balance: 24, focus: 12 } }, persistent: { selfFlux: { balance: 10 } }, tags: ["recover", "stabilize"], description: "Starts recovery back to mobile play." }),
};

const makeStance = (
  id: string,
  name: string,
  description: string,
  resetBalanceTo: number,
  resetGroundingTo: number,
  bonuses: Stance["bonuses"],
  moveIds: string[]
): Stance => ({ id, name, description, resetBalanceTo, resetGroundingTo, bonuses, moveIds });

const makeArmor = (name: string, coverage: number, resist: DamageProfile): Armor => ({ name, coverage, resist });

const createVanguard = (): Fighter => {
  const stances = [
    makeStance("ironGuard", "Iron Guard", "High grounding, measured defense, reliable counter setup.", 70, 82, { hit: 2, evade: 6, speed: -1, power: 3, antiPiercing: 4 }, ["braceWall", "shieldCheck", "punishingCut", "rallyBreath", "anchorStep", "interceptGuard"]),
    makeStance("forwardPressure", "Forward Pressure", "Attack-forward stance with better tempo and adrenaline.", 60, 55, { hit: 5, evade: 1, speed: 2, power: 4, antiPiercing: 1 }, ["rushDrive", "cleavingLine", "forwardScreen", "bloodUp", "pressureBeat", "hardCover"]),
    makeStance("commonGroundV", "Common Ground", "Fallback stance used when fighting from the ground.", 45, 76, { hit: 1, evade: 3, speed: 0, power: 1, antiPiercing: 2 }, ["groundLatch", "heelKick", "scrambleRise", "lowGuard", "snagAnkle", "dirtRead"]),
  ];
  const innate = { strength: 18, knowledge: 10, agility: 11, endurance: 18, technique: 13, will: 15 };
  const flux = { balance: 70, grounding: 82, focus: 58, stamina: 62, fatigue: 64, pain: 60, adrenaline: 30, mentalFatigue: 55, magicPoints: 20 };
  return {
    id: "p1",
    name: "Player 1",
    archetype: "Vanguard",
    innate,
    flux,
    currentInnate: { ...innate },
    currentFlux: { ...flux },
    counters: { stagger: 0, rattled: 0, wounded: 0, strained: 0 },
    stances,
    activeStanceId: "ironGuard",
    hp: 100,
    armor: makeArmor("Half Plate", 11, { bludgeoning: 8, cutting: 12, piercing: 7 }),
    lastRoundChanges: emptyChanges(),
  };
};

const createArcanist = (): Fighter => {
  const stances = [
    makeStance("veilStep", "Veil Step", "Mobile stance with speed and accuracy pressure.", 78, 50, { hit: 6, evade: 5, speed: 3, power: 1, antiPiercing: 6 }, ["veilCut", "feintNeedle", "slipWard", "glassMind", "mirageLane", "sidestepSeal"]),
    makeStance("channelForm", "Channel Form", "Resource-heavy magical posture with strong control.", 62, 60, { hit: 4, evade: 2, speed: 0, power: 5, antiPiercing: 2 }, ["pulseBolt", "lanceThread", "manaScreen", "reservePulse", "intentMark", "quietWard"]),
    makeStance("commonGroundA", "Common Ground", "Ground recovery posture for the arcanist.", 48, 72, { hit: 1, evade: 3, speed: 0, power: 1, antiPiercing: 3 }, ["rootKnot", "sparkHeel", "groundCipher", "turtleVeil", "elbowSpark", "riseThread"]),
  ];
  const innate = { strength: 9, knowledge: 19, agility: 16, endurance: 10, technique: 17, will: 16 };
  const flux = { balance: 78, grounding: 50, focus: 68, stamina: 40, fatigue: 42, pain: 52, adrenaline: 24, mentalFatigue: 64, magicPoints: 72 };
  return {
    id: "p2",
    name: "Player 2",
    archetype: "Arcanist",
    innate,
    flux,
    currentInnate: { ...innate },
    currentFlux: { ...flux },
    counters: { stagger: 0, rattled: 0, wounded: 0, strained: 0 },
    stances,
    activeStanceId: "veilStep",
    hp: 100,
    armor: makeArmor("Layered Robes", 6, { bludgeoning: 4, cutting: 5, piercing: 3 }),
    lastRoundChanges: emptyChanges(),
  };
};

const getMoveList = (fighter: Fighter, stanceId: string) => getStance(fighter, stanceId).moveIds.map((id) => MOVES[id]);

const deriveCrashState = (flux: FluxStats): CrashState => ({
  fallen: flux.balance <= 0,
  groundingBroken: flux.grounding <= 0,
  focusBroken: flux.focus <= 0,
  exhausted: flux.stamina <= 0,
  overstrained: flux.fatigue <= 0,
  overwhelmed: flux.pain <= 0,
  mentallyBroken: flux.mentalFatigue <= 0,
  outOfMagic: flux.magicPoints <= 0,
});

const applyCounterDecay = (counters: Counters): Counters => ({
  stagger: Math.max(0, counters.stagger - 1),
  rattled: Math.max(0, counters.rattled - 1),
  wounded: Math.max(0, counters.wounded - 1),
  strained: Math.max(0, counters.strained - 1),
});

const applyPersistentState = (fighter: Fighter, queue: QueuedMove[]) => {
  let currentInnate = { ...fighter.innate };
  let currentFlux = { ...fighter.flux };

  for (const q of queue) {
    if (q.ownerId === fighter.id) {
      currentInnate = addPatch(currentInnate, q.move.persistent.selfInnate) as InnateStats;
      currentFlux = addPatch(currentFlux, q.move.persistent.selfFlux) as FluxStats;
    }
    if (q.targetId === fighter.id) {
      currentInnate = addPatch(currentInnate, q.move.persistent.targetInnate) as InnateStats;
      currentFlux = addPatch(currentFlux, q.move.persistent.targetFlux) as FluxStats;
    }
  }

  const crash = deriveCrashState(currentFlux);
  const counters = { ...fighter.counters };

  if (crash.fallen) currentFlux.focus = clamp(currentFlux.focus - 25);
  if (crash.groundingBroken) currentFlux.balance = clamp(currentFlux.balance - 10);
  if (crash.focusBroken) currentFlux.stamina = clamp(currentFlux.stamina - 8);
  if (crash.exhausted) currentFlux.focus = clamp(currentFlux.focus - 12);
  if (crash.overstrained) currentInnate.strength = clamp(currentInnate.strength - 3);
  if (crash.overwhelmed) currentFlux.focus = 0;
  if (crash.mentallyBroken) currentInnate.knowledge = clamp(currentInnate.knowledge - 3);
  if (crash.outOfMagic) currentFlux.focus = clamp(currentFlux.focus - 8);

  currentInnate.agility = clamp(currentInnate.agility - counters.stagger);
  currentInnate.technique = clamp(currentInnate.technique - counters.rattled);
  currentInnate.endurance = clamp(currentInnate.endurance - counters.wounded);
  currentInnate.will = clamp(currentInnate.will - counters.strained);

  return { currentInnate, currentFlux, crash };
};

const getCounterChipsFromFluxCrash = (before: FluxStats, after: FluxStats): Partial<Counters> => {
  const chips: Partial<Counters> = {};
  if (before.balance > 0 && after.balance <= 0) chips.stagger = 2;
  if (before.focus > 0 && after.focus <= 0) chips.rattled = 2;
  if (before.pain > 0 && after.pain <= 0) chips.wounded = 1;
  if ((before.stamina > 0 && after.stamina <= 0) || (before.fatigue > 0 && after.fatigue <= 0)) chips.strained = 2;
  return chips;
};

const addCounters = (counters: Counters, patch: Partial<Counters>) => ({
  stagger: clamp(counters.stagger + (patch.stagger ?? 0), 0, 6),
  rattled: clamp(counters.rattled + (patch.rattled ?? 0), 0, 6),
  wounded: clamp(counters.wounded + (patch.wounded ?? 0), 0, 6),
  strained: clamp(counters.strained + (patch.strained ?? 0), 0, 6),
});

const applyInnateAttrition = (fighter: Fighter, move: Move, outcome: "armor" | "flesh", crashBefore: CrashState, crashAfter: CrashState) => {
  let nextInnate = { ...fighter.innate };
  const notes: string[] = [];

  if (outcome === "flesh") {
    if (move.primaryType === "cutting") {
      nextInnate.strength = clamp(nextInnate.strength - 1);
      notes.push("strength -1");
    }
    if (move.primaryType === "piercing") {
      nextInnate.technique = clamp(nextInnate.technique - 1);
      notes.push("technique -1");
    }
    if (move.primaryType === "bludgeoning") {
      nextInnate.endurance = clamp(nextInnate.endurance - 1);
      notes.push("endurance -1");
    }
  }
  if (!crashBefore.fallen && crashAfter.fallen) {
    nextInnate.agility = clamp(nextInnate.agility - 1);
    notes.push("agility -1");
  }
  if (!crashBefore.focusBroken && crashAfter.focusBroken) {
    nextInnate.will = clamp(nextInnate.will - 1);
    notes.push("will -1");
  }
  if (!crashBefore.mentallyBroken && crashAfter.mentallyBroken) {
    nextInnate.knowledge = clamp(nextInnate.knowledge - 1);
    notes.push("knowledge -1");
  }

  return { nextInnate, notes };
};

const damageVsArmor = (move: Move, outcome: "armor" | "flesh", target: Fighter, targetStance: Stance, targetCrash: CrashState) => {
  const damage = move.damage ?? zeroDamage();
  const primary = move.primaryType ?? "bludgeoning";
  const armorResist = target.armor.resist[primary] + (primary === "piercing" ? targetStance.bonuses.antiPiercing : 0);
  const armorHit = Math.max(0, Math.floor(damage.bludgeoning * 1.0) + Math.floor(damage.cutting * 0.4) + Math.floor(damage.piercing * 0.25) - armorResist);

  let fleshHit =
    Math.floor(damage.bludgeoning * 1.15) +
    Math.floor(damage.cutting * 1.35) +
    Math.floor(damage.piercing * 2.1);

  if (move.tags.includes("anti-fallen") && targetCrash.fallen) fleshHit += 10;
  if (move.tags.includes("anti-focus-broken") && targetCrash.focusBroken) fleshHit += 12;
  if (move.tags.includes("anti-armor") && outcome === "armor") fleshHit += 8;
  if (primary === "cutting" && outcome === "flesh") fleshHit += move.sharpBonus ?? 0;

  return outcome === "armor" ? armorHit : fleshHit;
};

const buildLastRoundChanges = (before: Fighter, after: Fighter): StatChanges => {
  const innate: Partial<Record<InnateKey, number>> = {};
  const flux: Partial<Record<FluxKey, number>> = {};

  (Object.keys(before.currentInnate) as InnateKey[]).forEach((key) => {
    const diff = after.currentInnate[key] - before.currentInnate[key];
    if (diff !== 0) innate[key] = diff;
  });
  (Object.keys(before.currentFlux) as FluxKey[]).forEach((key) => {
    const diff = after.currentFlux[key] - before.currentFlux[key];
    if (diff !== 0) flux[key] = diff;
  });

  return { hp: after.hp - before.hp, innate, flux };
};

const StatBar = ({ label, value, delta, max = 100 }: { label: string; value: number; delta?: number; max?: number }) => {
  const positive = (delta ?? 0) > 0;
  const negative = (delta ?? 0) < 0;
  return (
    <Box sx={{ mb: 1 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="body2">{label}</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2">{value}</Typography>
          {delta !== undefined && delta !== 0 && (
            <Typography variant="caption" sx={{ color: positive ? "success.main" : negative ? "error.main" : "text.secondary", fontWeight: 700 }}>
              {delta > 0 ? `+${delta}` : delta}
            </Typography>
          )}
        </Stack>
      </Stack>
      <LinearProgress variant="determinate" value={clamp((value / max) * 100)} sx={{ height: 8, borderRadius: 999 }} />
    </Box>
  );
};

export default function Phase2BattlePrototype() {
  const [fighterA, setFighterA] = useState<Fighter>(() => createVanguard());
  const [fighterB, setFighterB] = useState<Fighter>(() => createArcanist());
  const [queue, setQueue] = useState<QueuedMove[]>([]);
  const [round, setRound] = useState(1);
  const [log, setLog] = useState<string[]>(["Phase 2 ready. Pick visible stances and one move each."]);
  const [lastResolution, setLastResolution] = useState<ResolutionEntry[]>([]);
  const [pendingA, setPendingA] = useState<PendingChoice>({ stanceId: fighterA.activeStanceId, moveId: getStance(fighterA, fighterA.activeStanceId).moveIds[0] });
  const [pendingB, setPendingB] = useState<PendingChoice>({ stanceId: fighterB.activeStanceId, moveId: getStance(fighterB, fighterB.activeStanceId).moveIds[0] });

  const previewA = useMemo(() => applyPersistentState(fighterA, queue), [fighterA, queue]);
  const previewB = useMemo(() => applyPersistentState(fighterB, queue), [fighterB, queue]);

  const applyStartOfRoundState = (fighter: Fighter, stanceId: string, switched: boolean, queueNow: QueuedMove[]) => {
    const stance = getStance(fighter, stanceId);
    const baseFlux: FluxStats = {
      ...fighter.flux,
      balance: stance.resetBalanceTo,
      grounding: stance.resetGroundingTo,
      stamina: clamp(fighter.flux.stamina - (switched ? STANCE_SWITCH_STAMINA_COST : 0)),
    };

    let next: Fighter = {
      ...fighter,
      activeStanceId: stanceId,
      flux: baseFlux,
      counters: applyCounterDecay(fighter.counters),
    };

    const persisted = applyPersistentState(next, queueNow);
    next = { ...next, currentInnate: persisted.currentInnate, currentFlux: persisted.currentFlux };

    if (persisted.crash.fallen) {
      const forced = next.stances.find((s) => s.name === "Common Ground");
      if (forced) next.activeStanceId = forced.id;
    }

    return next;
  };

  const resolveSupportMove = (actor: Fighter, target: Fighter, move: Move) => {
    const actorBefore = actor.currentFlux;
    const targetBefore = target.currentFlux;

    let nextActor: Fighter = {
      ...actor,
      currentFlux: addPatch(actor.currentFlux, move.immediate.selfFlux) as FluxStats,
      currentInnate: addPatch(actor.currentInnate, move.immediate.selfInnate) as InnateStats,
      flux: addPatch(actor.flux, move.immediate.selfFlux) as FluxStats,
      innate: addPatch(actor.innate, move.immediate.selfInnate) as InnateStats,
    };
    let nextTarget: Fighter = {
      ...target,
      currentFlux: addPatch(target.currentFlux, move.immediate.targetFlux) as FluxStats,
      currentInnate: addPatch(target.currentInnate, move.immediate.targetInnate) as InnateStats,
      flux: addPatch(target.flux, move.immediate.targetFlux) as FluxStats,
      innate: addPatch(target.innate, move.immediate.targetInnate) as InnateStats,
    };

    nextActor.counters = addCounters(nextActor.counters, getCounterChipsFromFluxCrash(actorBefore, nextActor.currentFlux));
    nextTarget.counters = addCounters(nextTarget.counters, getCounterChipsFromFluxCrash(targetBefore, nextTarget.currentFlux));

    return { actor: nextActor, target: nextTarget, note: move.type === "defense" ? "Defense applied." : "Ability applied." };
  };

  const resolveOffenseMove = (
    actor: Fighter,
    target: Fighter,
    move: Move,
    stance: Stance,
    targetStance: Stance,
    defenderMove: Move,
    switched: boolean
  ) => {
    const actorCrash = deriveCrashState(actor.currentFlux);
    const targetCrashBefore = deriveCrashState(target.currentFlux);

    const speedPenalty = switched ? STANCE_SWITCH_SPEED_PENALTY : 0;
    const hitScore =
      move.hitBase * 2 +
      move.speed +
      stance.bonuses.speed -
      speedPenalty +
      actor.currentInnate.agility +
      actor.currentInnate.technique +
      Math.floor(actor.currentFlux.focus * 0.22) +
      Math.floor(actor.currentFlux.balance * 0.08) +
      stance.bonuses.hit -
      (actorCrash.focusBroken ? 12 : 0) -
      (actorCrash.exhausted ? 10 : 0) -
      (actorCrash.overwhelmed ? 20 : 0) -
      actor.counters.rattled * 2;

    const defenseBonus = defenderMove.type === "defense" ? 4 + Math.floor(targetStance.bonuses.evade * 0.5) : defenderMove.type === "ability" ? 1 : 0;
    const evadeScore =
      target.currentInnate.agility * 2 +
      Math.floor(target.currentFlux.balance * 0.18) +
      Math.floor(target.currentFlux.focus * 0.18) +
      Math.floor(target.currentFlux.grounding * 0.14) +
      targetStance.bonuses.evade +
      defenseBonus -
      target.counters.stagger * 2 -
      target.counters.rattled;

    const primary = move.primaryType ?? "bludgeoning";
    const armorThreshold = evadeScore + target.armor.coverage + target.armor.resist[primary] + (primary === "piercing" ? targetStance.bonuses.antiPiercing : 0);
    const outcome: ResolutionEntry["outcome"] = hitScore <= evadeScore ? "miss" : hitScore <= armorThreshold ? "armor" : "flesh";

    let nextActor = { ...actor };
    let nextTarget = { ...target };

    nextActor.currentFlux = addPatch(nextActor.currentFlux, move.immediate.selfFlux) as FluxStats;
    nextActor.currentInnate = addPatch(nextActor.currentInnate, move.immediate.selfInnate) as InnateStats;
    nextActor.flux = addPatch(nextActor.flux, move.immediate.selfFlux) as FluxStats;
    nextActor.innate = addPatch(nextActor.innate, move.immediate.selfInnate) as InnateStats;

    nextTarget.currentFlux = addPatch(nextTarget.currentFlux, move.immediate.targetFlux) as FluxStats;
    nextTarget.currentInnate = addPatch(nextTarget.currentInnate, move.immediate.targetInnate) as InnateStats;
    nextTarget.flux = addPatch(nextTarget.flux, move.immediate.targetFlux) as FluxStats;
    nextTarget.innate = addPatch(nextTarget.innate, move.immediate.targetInnate) as InnateStats;

    const targetCrashAfterFlux = deriveCrashState(nextTarget.currentFlux);
    const crashCounters = getCounterChipsFromFluxCrash(target.currentFlux, nextTarget.currentFlux);
    nextTarget.counters = addCounters(nextTarget.counters, crashCounters);

    let rawDamage = 0;
    let note = "Missed.";

    if (outcome !== "miss") {
      rawDamage = damageVsArmor(move, outcome, target, targetStance, targetCrashBefore);
      rawDamage += stance.bonuses.power + nextActor.currentInnate.strength + Math.floor(nextActor.currentInnate.technique / 2);
      rawDamage -= Math.floor(nextTarget.currentInnate.endurance / 2);
      rawDamage -= actorCrash.overstrained ? 10 : 0;
      rawDamage = Math.max(0, rawDamage);
      nextTarget.hp = clamp(nextTarget.hp - rawDamage, 0, 100);
      const attrition = applyInnateAttrition(nextTarget, move, outcome as "armor" | "flesh", targetCrashBefore, targetCrashAfterFlux);
      nextTarget.innate = attrition.nextInnate;
      nextTarget.currentInnate = { ...nextTarget.currentInnate, ...attrition.nextInnate };
      if (outcome === "armor") note = `Hit armor for ${rawDamage}.`;
      if (outcome === "flesh") note = `Hit flesh for ${rawDamage}.${attrition.notes.length ? ` Attrition: ${attrition.notes.join(", ")}.` : ""}`;
    }

    const breakdown = `Hit ${hitScore} vs Evade ${evadeScore}; Armor threshold ${armorThreshold}; outcome ${outcome}.`;

    return {
      actor: nextActor,
      target: nextTarget,
      entry: {
        actorName: actor.name,
        targetName: target.name,
        moveName: move.name,
        speed: move.speed + stance.bonuses.speed - speedPenalty,
        hitScore,
        evadeScore,
        armorThreshold,
        outcome,
        damage: rawDamage,
        note,
        breakdown,
      },
    };
  };

  const resolveRound = () => {
    const beforeA = { ...fighterA, currentInnate: { ...fighterA.currentInnate }, currentFlux: { ...fighterA.currentFlux }, innate: { ...fighterA.innate }, flux: { ...fighterA.flux } };
    const beforeB = { ...fighterB, currentInnate: { ...fighterB.currentInnate }, currentFlux: { ...fighterB.currentFlux }, innate: { ...fighterB.innate }, flux: { ...fighterB.flux } };

    const switchedA = fighterA.activeStanceId !== pendingA.stanceId;
    const switchedB = fighterB.activeStanceId !== pendingB.stanceId;

    let nextA = applyStartOfRoundState(fighterA, pendingA.stanceId, switchedA, queue);
    let nextB = applyStartOfRoundState(fighterB, pendingB.stanceId, switchedB, queue);

    const stanceA = getStance(nextA, nextA.activeStanceId);
    const stanceB = getStance(nextB, nextB.activeStanceId);
    const moveA = MOVES[pendingA.moveId];
    const moveB = MOVES[pendingB.moveId];

    const steps = [
      { key: "A" as const, speed: moveA.speed + stanceA.bonuses.speed - (switchedA ? STANCE_SWITCH_SPEED_PENALTY : 0), move: moveA },
      { key: "B" as const, speed: moveB.speed + stanceB.bonuses.speed - (switchedB ? STANCE_SWITCH_SPEED_PENALTY : 0), move: moveB },
    ].sort((a, b) => b.speed - a.speed);

    const entries: ResolutionEntry[] = [];

    for (const step of steps) {
      if (step.key === "A") {
        if (moveA.type === "offense") {
          const resolved = resolveOffenseMove(nextA, nextB, moveA, stanceA, stanceB, moveB, switchedA);
          nextA = resolved.actor;
          nextB = resolved.target;
          entries.push(resolved.entry);
        } else {
          const support = resolveSupportMove(nextA, nextB, moveA);
          nextA = support.actor;
          nextB = support.target;
          entries.push({ actorName: nextA.name, targetName: nextB.name, moveName: moveA.name, speed: moveA.speed + stanceA.bonuses.speed - (switchedA ? STANCE_SWITCH_SPEED_PENALTY : 0), hitScore: 0, evadeScore: 0, armorThreshold: 0, outcome: "support", damage: 0, note: support.note, breakdown: `${moveA.type} move; immediate and queued effects only.` });
        }
      } else {
        if (moveB.type === "offense") {
          const resolved = resolveOffenseMove(nextB, nextA, moveB, stanceB, stanceA, moveA, switchedB);
          nextB = resolved.actor;
          nextA = resolved.target;
          entries.push(resolved.entry);
        } else {
          const support = resolveSupportMove(nextB, nextA, moveB);
          nextB = support.actor;
          nextA = support.target;
          entries.push({ actorName: nextB.name, targetName: nextA.name, moveName: moveB.name, speed: moveB.speed + stanceB.bonuses.speed - (switchedB ? STANCE_SWITCH_SPEED_PENALTY : 0), hitScore: 0, evadeScore: 0, armorThreshold: 0, outcome: "support", damage: 0, note: support.note, breakdown: `${moveB.type} move; immediate and queued effects only.` });
        }
      }
    }

    let nextQueue = [
      ...queue,
      { queueId: `q-${round}-A-${moveA.id}`, ownerId: nextA.id, targetId: nextB.id, move: moveA, stanceId: stanceA.id, roundAdded: round },
      { queueId: `q-${round}-B-${moveB.id}`, ownerId: nextB.id, targetId: nextA.id, move: moveB, stanceId: stanceB.id, roundAdded: round },
    ];

    const addedLines: string[] = [
      `Round ${round}: ${nextA.name} used ${moveA.name}; ${nextB.name} used ${moveB.name}.`,
      ...(switchedA ? [`${nextA.name} switched stance: stamina -${STANCE_SWITCH_STAMINA_COST}, speed -${STANCE_SWITCH_SPEED_PENALTY}.`] : []),
      ...(switchedB ? [`${nextB.name} switched stance: stamina -${STANCE_SWITCH_STAMINA_COST}, speed -${STANCE_SWITCH_SPEED_PENALTY}.`] : []),
      ...entries.map((e) => `${e.actorName} -> ${e.moveName}: ${e.note} ${e.breakdown}`),
    ];

    if (nextQueue.length >= 6) {
      const removed = nextQueue.slice(0, 2);
      nextQueue = nextQueue.slice(2);
      addedLines.push(`Dequeued: ${removed.map((m) => m.move.name).join(", ")}.`);
    } else {
      addedLines.push(`Queue building: ${nextQueue.length}/6 before dequeue begins.`);
    }

    const persistedA = applyPersistentState(nextA, nextQueue);
    const persistedB = applyPersistentState(nextB, nextQueue);
    nextA = { ...nextA, currentInnate: persistedA.currentInnate, currentFlux: persistedA.currentFlux };
    nextB = { ...nextB, currentInnate: persistedB.currentInnate, currentFlux: persistedB.currentFlux };

    if (persistedA.crash.fallen) {
      const forced = nextA.stances.find((s) => s.name === "Common Ground");
      if (forced) nextA.activeStanceId = forced.id;
    }
    if (persistedB.crash.fallen) {
      const forced = nextB.stances.find((s) => s.name === "Common Ground");
      if (forced) nextB.activeStanceId = forced.id;
    }

    nextA.lastRoundChanges = buildLastRoundChanges(beforeA, nextA);
    nextB.lastRoundChanges = buildLastRoundChanges(beforeB, nextB);

    setFighterA(nextA);
    setFighterB(nextB);
    setQueue(nextQueue);
    setLastResolution(entries);
    setLog((prev) => [...addedLines, ...prev].slice(0, 24));
    setRound((r) => r + 1);
    setPendingA({ stanceId: nextA.activeStanceId, moveId: getStance(nextA, nextA.activeStanceId).moveIds[0] });
    setPendingB({ stanceId: nextB.activeStanceId, moveId: getStance(nextB, nextB.activeStanceId).moveIds[0] });
  };

  const resetBattle = () => {
    const a = createVanguard();
    const b = createArcanist();
    setFighterA(a);
    setFighterB(b);
    setQueue([]);
    setRound(1);
    setLog(["Phase 2 ready. Pick visible stances and one move each."]);
    setLastResolution([]);
    setPendingA({ stanceId: a.activeStanceId, moveId: getStance(a, a.activeStanceId).moveIds[0] });
    setPendingB({ stanceId: b.activeStanceId, moveId: getStance(b, b.activeStanceId).moveIds[0] });
  };

  const renderCrashChips = (crash: CrashState) => {
    const active = (Object.keys(crash) as (keyof CrashState)[]).filter((key) => crash[key]);
    if (!active.length) return <Typography variant="caption">No crash states</Typography>;
    return active.map((key) => (
      <Tooltip key={key} title={CRASH_TOOLTIPS[key]} arrow>
        <Chip size="small" label={CRASH_LABELS[key]} />
      </Tooltip>
    ));
  };

  const renderStatsSection = <K extends string>(
    title: string,
    stats: Record<K, number>,
    deltas: Partial<Record<K, number>>,
    max = 100
  ) => (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>{title}</Typography>
      {(Object.keys(stats) as K[]).map((key) => (
        <StatBar key={key} label={key} value={stats[key]} delta={deltas[key]} max={max} />
      ))}
    </Paper>
  );

  const renderFighter = (
    fighter: Fighter,
    pending: PendingChoice,
    setPending: React.Dispatch<React.SetStateAction<PendingChoice>>,
    preview: ReturnType<typeof applyPersistentState>
  ) => {
    const stance = getStance(fighter, pending.stanceId);
    const moves = getMoveList(fighter, pending.stanceId);
    const selectedMove = MOVES[pending.moveId];

    return (
      <Card sx={{ height: "100%" }}>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h5">{fighter.name}</Typography>
              <Typography variant="subtitle1">{fighter.archetype}</Typography>
              <Typography variant="body2">Armor: {fighter.armor.name}</Typography>
              <Box sx={{ mt: 1 }}>
                <StatBar label="HP" value={fighter.hp} delta={fighter.lastRoundChanges.hp} max={100} />
              </Box>
            </Box>

            <Box>
              <Typography variant="subtitle2">Visible stance choice</Typography>
              <Select
                fullWidth
                size="small"
                value={pending.stanceId}
                onChange={(e) => {
                  const stanceId = e.target.value as string;
                  setPending({ stanceId, moveId: getStance(fighter, stanceId).moveIds[0] });
                }}
              >
                {fighter.stances.map((s) => (
                  <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                ))}
              </Select>
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>{stance.description}</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={`Hit ${stance.bonuses.hit >= 0 ? "+" : ""}${stance.bonuses.hit}`} />
                <Chip size="small" label={`Evade ${stance.bonuses.evade >= 0 ? "+" : ""}${stance.bonuses.evade}`} />
                <Chip size="small" label={`Speed ${stance.bonuses.speed >= 0 ? "+" : ""}${stance.bonuses.speed}`} />
                <Chip size="small" label={`Power ${stance.bonuses.power >= 0 ? "+" : ""}${stance.bonuses.power}`} />
              </Stack>
            </Box>

            <Box>
              <Typography variant="subtitle2">Move choice</Typography>
              <Select fullWidth size="small" value={pending.moveId} onChange={(e) => setPending((p) => ({ ...p, moveId: e.target.value as string }))}>
                {moves.map((m) => (
                  <MenuItem key={m.id} value={m.id}>{m.name} ({m.type})</MenuItem>
                ))}
              </Select>
              <Paper variant="outlined" sx={{ p: 1.5, mt: 1 }}>
                <Typography variant="body2"><strong>{selectedMove.name}</strong> • {selectedMove.type}</Typography>
                <Typography variant="caption" display="block">{selectedMove.description}</Typography>
                <Typography variant="caption" display="block">Speed {selectedMove.speed} | Hit {selectedMove.hitBase} | Stamina {selectedMove.staminaCost} | Magic {selectedMove.magicCost}</Typography>
                <Typography variant="caption" display="block">Immediate self: {fmt(selectedMove.immediate.selfFlux as DeltaMap)}</Typography>
                <Typography variant="caption" display="block">Immediate target: {fmt(selectedMove.immediate.targetFlux as DeltaMap)}</Typography>
                <Typography variant="caption" display="block">Queued self: {fmt(selectedMove.persistent.selfFlux as DeltaMap)}</Typography>
                <Typography variant="caption" display="block">Queued target: {fmt(selectedMove.persistent.targetFlux as DeltaMap)}</Typography>
                <Typography variant="caption" display="block">Tags: {selectedMove.tags.join(", ")}</Typography>
              </Paper>
            </Box>

            <Divider />

            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
              <Box sx={{ gridColumn: "1 / -1" }}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="subtitle2">Crash states</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                    {renderCrashChips(preview.crash)}
                  </Stack>
                </Paper>
              </Box>
              <Box>{renderStatsSection("Innate", preview.currentInnate, fighter.lastRoundChanges.innate, 25)}</Box>
              <Box>{renderStatsSection("Flux", preview.currentFlux, fighter.lastRoundChanges.flux, 100)}</Box>
              <Box sx={{ gridColumn: "1 / -1" }}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="subtitle2">Counters</Typography>
                  {Object.entries(fighter.counters).map(([k, v]) => (
                    <Typography key={k} variant="body2">{k}: {v}</Typography>
                  ))}
                </Paper>
              </Box>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h4">Queued Stance Battle Prototype - Phase 2</Typography>
          <Typography variant="body1">Crash states, armor vs flesh routing, damage identities, counters, innate attrition, bars, tooltips, and recent stat deltas.</Typography>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" }, gap: 2 }}>
          <Box>{renderFighter(fighterA, pendingA, setPendingA, previewA)}</Box>

          <Box>
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6">Round {round}</Typography>
                  <Typography variant="body2">Queue size: {queue.length}</Typography>
                  <Stack direction="row" spacing={1}>
                    <Button fullWidth variant="contained" onClick={resolveRound}>Resolve Round</Button>
                    <Button fullWidth variant="outlined" onClick={resetBattle}>Reset</Button>
                  </Stack>

                  <Box>
                    <Typography variant="subtitle1">Shared queue</Typography>
                    <Stack spacing={1} sx={{ mt: 1, maxHeight: 280, overflow: "auto" }}>
                      {queue.length === 0 ? (
                        <Paper variant="outlined" sx={{ p: 1.5 }}><Typography variant="body2">No queued moves yet.</Typography></Paper>
                      ) : (
                        queue.map((q, i) => (
                          <Paper key={q.queueId} variant="outlined" sx={{ p: 1.5 }}>
                            <Typography variant="body2">#{i + 1} {q.ownerId === fighterA.id ? fighterA.name : fighterB.name} • {q.move.name}</Typography>
                            <Typography variant="caption" display="block">{q.move.type} | round {q.roundAdded}</Typography>
                            <Typography variant="caption" display="block">Queued self: {fmt(q.move.persistent.selfFlux as DeltaMap)}</Typography>
                            <Typography variant="caption" display="block">Queued target: {fmt(q.move.persistent.targetFlux as DeltaMap)}</Typography>
                          </Paper>
                        ))
                      )}
                    </Stack>
                  </Box>

                  <Box>
                    <Typography variant="subtitle1">Last resolution</Typography>
                    <List dense>
                      {lastResolution.length === 0 ? (
                        <ListItem><ListItemText primary="No round resolved yet." /></ListItem>
                      ) : (
                        lastResolution.map((e, i) => (
                          <ListItem key={`${e.moveName}-${i}`}>
                            <ListItemText primary={`${e.actorName}: ${e.moveName} -> ${e.outcome}`} secondary={`${e.note} ${e.breakdown}`} />
                          </ListItem>
                        ))
                      )}
                    </List>
                  </Box>

                  <Box>
                    <Typography variant="subtitle1">Combat log</Typography>
                    <List dense sx={{ maxHeight: 240, overflow: "auto" }}>
                      {log.map((line, i) => (
                        <ListItem key={`${i}-${line}`}>
                          <ListItemText primary={line} />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Box>

          <Box>{renderFighter(fighterB, pendingB, setPendingB, previewB)}</Box>
        </Box>
      </Stack>
    </Box>
  );
}
