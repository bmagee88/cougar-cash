export type Team = "heroes" | "monsters";
export type RowIndex = 0 | 1 | 2 | 3;

export type BodyPart =
  | "feet"
  | "legs"
  | "hands"
  | "arms"
  | "chest"
  | "shoulders"
  | "neck"
  | "head";

export type DamageType = "slash" | "pierce" | "blunt";

export type AttackMove =
  | "slashHigh"
  | "slashMid"
  | "slashLow"
  | "cleave"
  | "stabHead"
  | "stabChest"
  | "stabLegs";

export type ReachLevel = "none" | "reach" | "doubleReach";
export type WeaponType = "sword" | "spear" | "axe" | "mace" | "dagger" | "bow";
export type HitKind = "miss" | "armor" | "flesh";

export type DurationType =
  | "instant"
  | "endOfTurn"
  | "endOfBattle"
  | "endOfDay"
  | "endOfWeek"
  | "permanent";

export type AttackStep = "idle" | "initial" | "evaded" | "corrected" | "resolved";

export interface Range {
  start: number;
  end: number;
}

export interface BodyRange extends Range {
  part: BodyPart;
  label: string;
}

export interface MissZone extends Range {
  label: string;
}

export interface Stats {
  physicalStrength: number;
  dexterity: number;
  balance: number;
  magicka: number;
  willpower: number;
  intellect: number;
  charisma: number;
  guts: number;
  toughness: number;
}

export interface StatusEffect {
  id: string;
  name: string;
  duration: DurationType;
  description: string;
}

export interface Weapon {
  id: string;
  name: string;
  weaponType: WeaponType;
  slotSize: 1 | 2 | 4;
  handSlotsOccupied: number[];
  weight: number;
  reach: ReachLevel;
  sharpness: number;
  piercing: number;
  bluntForce: number;
  critEffects: Record<DamageType, string>;
  canCritArmor?: boolean;
}

export interface ArmorPiece {
  id: string;
  name: string;
  weight: number;
  clunk: number;
  sharpMitigation: number;
  pierceMitigation: number;
  bluntMitigation: number;
  coverageRanges: Range[];
}

export interface WeaponTraining {
  [weaponType: string]: 0 | 1 | 2 | 3;
}

export interface WeaponAttunement {
  [weaponId: string]: {
    xp: number;
    level: 0 | 1 | 2 | 3 | 4;
  };
}

export interface Combatant {
  id: string;
  name: string;
  team: Team;
  row: RowIndex;
  stats: Stats;
  fight: number;
  maxFight: number;
  blood: number;
  maxBlood: number;
  concussion: number;
  maxConcussion: number;
  weapons: Weapon[];
  armor: ArmorPiece[];
  weaponTraining: WeaponTraining;
  weaponAttunement: WeaponAttunement;
  statuses: StatusEffect[];
}

export interface BattleGroup {
  id: string;
  name: string;
  effects: string[];
  combatantIds: string[];
}

export interface BattleState {
  combatants: Record<string, Combatant>;
  groups: BattleGroup[];
  tavernIds: string[];
  lairIds: string[];
  log: string[];
}

export interface AttackPlan {
  attackerId: string;
  defenderId: string;
  weaponId: string;
  move: AttackMove;
  damageType: DamageType;
  initialMarker: number;
  initialBodyPart?: BodyPart;
  defenderShift: number;
  afterDefenderMarker: number;
  attackerShift: number;
  finalMarker: number;
  hitKind: HitKind;
  bodyPart?: BodyPart;
  armorNames: string[];
  damage: number;
  critEffect?: string;
  force: number;
  multiplier: number;
  rawDamage: number;
  totalMitigation: number;
  mitigationDetails: { armorName: string; mitigation: number }[];
  messages: string[];
  applied: boolean;
}
