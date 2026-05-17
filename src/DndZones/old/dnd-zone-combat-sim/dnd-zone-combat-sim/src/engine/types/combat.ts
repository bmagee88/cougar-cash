import type { Combatant } from "./character";
import type { BattleGroup, GroupRow } from "./battlefield";
import type { ArmorPiece, AttackMove, DamageType, Weapon } from "./equipment";

export interface AttackIntent {
  attackerId: string;
  defenderId: string;
  weaponId: string;
  move: AttackMove;
  damageType: DamageType;
  chosenBodyPartId?: string;
}

export interface BodyPartRange {
  id: string;
  name: string;
  start: number;
  end: number;
}

export interface MissZone {
  id: string;
  name: string;
  start: number;
  end: number;
}

export type HitKind = "miss" | "flesh" | "armor";

export interface HitEvaluation {
  kind: HitKind;
  marker: number;
  bodyPart?: BodyPartRange;
  armorPieces: ArmorPiece[];
  score: number;
  reason: string;
}

export interface AttackResult {
  attacker: Combatant;
  defender: Combatant;
  weapon: Weapon;
  attackerGroup: BattleGroup;
  defenderGroup: BattleGroup;
  attackerRow: GroupRow;
  defenderRow: GroupRow;
  initialMarker: number;
  defenderAdjustment: number;
  attackerAdjustment: number;
  finalMarker: number;
  evaluation: HitEvaluation;
  baseDamage: number;
  typedDamage: number;
  mitigatedDamage: number;
  finalDamage: number;
  critApplied: boolean;
  logs: string[];
}
