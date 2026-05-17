export type DurationType =
  | "instant"
  | "endOfTurn"
  | "endOfBattle"
  | "endOfDay"
  | "endOfWeek"
  | "permanent";

export type StatusCategory =
  | "control"
  | "wound"
  | "elemental"
  | "sensory"
  | "movement"
  | "terrain"
  | "environment";

export interface StatusEffect {
  id: string;
  name: string;
  category: StatusCategory;
  description: string;
  duration: DurationType;
  severity?: number;
}

export interface TerrainEffect {
  id: string;
  name: string;
  description: string;
}

export interface SlotEffect {
  id: string;
  name: string;
  description: string;
}

export interface EnvironmentEffect {
  id: string;
  name: string;
  description: string;
}
