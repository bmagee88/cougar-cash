export type Trait =
  | "adept"
  | "resistance"
  | "mastery"
  | "proficient"
  | "normal"
  | "struggle"
  | "weakness";

export const TRAIT_LABELS: Record<Trait, string> = {
  adept: "Adept",
  resistance: "Resistance",
  mastery: "Mastery",
  proficient: "Proficient",
  normal: "Normal",
  struggle: "Struggle",
  weakness: "Weakness",
};
export type Effectiveness = "Super Effective" | "Effective" | "Not Effective";
export type BattlePhase = "idle" | "menu" | "fight" | "switch" | "item" | "ended";

export type HiddenSkill = {
  current: number;
  maxReached: number;
  growthPotential: number;
  trait: Trait;
};

export type Move = {
  id: string;
  name: string;
  type: string;
  emoji: string;
  basePower: number;
  skillUsed: string;
  resistedBy: string;
  effects: string[];
};

export type Creature = {
  id: string;
  name: string;
  emoji: string;
  type: string;
  hp: number;
  maxHp: number;
  level: string;
  hiddenSkills: Record<string, HiddenSkill>;
  moves: Move[];
};

export type RollResult = {
  roll: number;
  rolls: number[];
  note: string;
  isWeakness: boolean;
};

export type RollBandData = {
  title: string;
  skillName: string;
  skillValue: number;
  trait: Trait;
  roll: number;
  note: string;
  effectiveness: Effectiveness;
};

export type BattleMessage = {
  id: string;
  text: string;
  rollBar?: RollBandData;
};

export type BattleLogEntry = BattleMessage;
