import type { EnvironmentEffect, SlotEffect, TerrainEffect } from "./effects";
import type { Combatant, Team } from "./character";

export type GroupRow = 0 | 1 | 2 | 3;

export interface GroupSlot {
  id: string;
  row: GroupRow;
  col: 0 | 1 | 2 | 3;
  occupantId?: string;
  effects: SlotEffect[];
}

export interface BattleGroup {
  id: string;
  name: string;
  gridX: number;
  gridY: number;
  effects: TerrainEffect[];
  slots: GroupSlot[];
}

export interface BattleState {
  groups: BattleGroup[];
  combatants: Record<string, Combatant>;
  environmentEffects: EnvironmentEffect[];
  activeCombatantId?: string;
  log: string[];
}

export function frontRowForTeam(team: Team): GroupRow {
  return team === "heroes" ? 1 : 2;
}

export function backRowForTeam(team: Team): GroupRow {
  return team === "heroes" ? 0 : 3;
}
