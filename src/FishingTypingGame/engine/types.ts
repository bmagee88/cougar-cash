import { EnvironmentRender } from './environment';
import { BirdPose, TreeBirdSpeciesId } from './birds';
export const RARITIES = ['Common', 'Uncommon', 'Rare', 'Mythic-Rare', 'Ultra-Rare'] as const;
export const QUALITIES = ['C', 'B', 'A', 'S', 'SS'] as const;
export type Rarity = typeof RARITIES[number];
export type Quality = typeof QUALITIES[number];
export const WEATHERS = ['sunny', 'overcast', 'rain', 'thunderstorm', 'wind', 'fog', 'heatwave', 'cold-front', 'hurricane', 'snowfall', 'blizzard'] as const;
export type Weather = typeof WEATHERS[number];
export type WeatherChoice = Weather | 'natural';
export interface NaturalWeatherState { weather: Weather; startedAt: number; durationMs: number; endsAt: number; seed: number; history: Weather[]; season: Season }
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export const DAY_PERIODS = ['dawn', 'morning', 'afternoon', 'dusk', 'early-night', 'late-night'] as const;
export const MOON_PHASES = ['full', 'waning-three-quarter', 'waning-half', 'waning-quarter', 'new', 'waxing-quarter', 'waxing-half', 'waxing-three-quarter'] as const;
export type Season = typeof SEASONS[number];
export type DayPeriod = typeof DAY_PERIODS[number];
export type MoonPhase = typeof MOON_PHASES[number];
export type LureType = 'worm' | 'minnow' | 'panfish-jig' | 'minnow-jig' | 'plastic-worm' | 'crankbait' | 'jerkbait' | 'spinnerbait' | 'spoon' | 'popper' | 'bucktail' | 'large-crankbait';
export type LureColor = 'natural' | 'silver' | 'perch' | 'chartreuse' | 'black' | 'green-pumpkin';
export type RigType = 'float' | 'slip-float' | 'bottom' | 'jighead' | 'texas' | 'carolina' | 'direct' | 'leader';
export type Retrieve = 'still' | 'lift-pause' | 'slow-drag' | 'slow-roll' | 'steady' | 'burn' | 'twitch-pause' | 'long-pause' | 'pop-pause' | 'figure-eight';
export interface TackleSetup { lure: LureType; color: LureColor; rig: RigType; retrieve: Retrieve }
export interface FishingConditions { fightOptions?: FightOptions; season: Season; period: DayPeriod; moonPhase: MoonPhase; weather?: Weather; stormAgeMs?: number; weatherDurationMs?: number; tackle?: TackleSetup; observedRetrieve?: Retrieve }
export interface WorldConditions extends FishingConditions { hour: number; dayProgress: number; gameDay: number; seasonDate: string }
export interface WorldOverrides { season?: Season; hour?: number; moonPhase?: MoonPhase; plantDay?:number }
export type Random = () => number;
export type FishingMode = 'standard' | 'interactive' | 'fish-fight';
export interface LineGear { equipped: number; spools: Record<string, number> }
export interface FightOptions { testLb: number; spoolM: number; wordCheckpoint: boolean }
export interface FishFightState extends FightOptions {
  fishCursor: number; stamina: number; maxStamina: number; temperament: number;
  lastAt: number; nextJoltAt: number; castLengthM: number;
  jolt?: { ability: string; remaining: number; intervalMs: number; nextAt: number; endsAt: number };
}
export type RetrieveRhythm = 'steady' | 'jerky' | 'dead-stick';
export interface RetrieveMemory { phrase: string; reeled: number; rhythm: RetrieveRhythm; grass: boolean }
export interface FishCheckRow { speciesId: string; weight: number; chance: number; candidateChance: number; bite: number; nibble: number }
export interface FishCheck {
  id: number; at: number; source: 'letter' | 'dead-stick' | 'nibble' | 'standard' | 'forced';
  conditions: FishingConditions; outcome: 'none' | 'nibble' | 'bite' | 'nibble-lost';
  contactChance: number; noFish: number; rows: FishCheckRow[];
  cursor?: number; reeled?: number; grass?: boolean; rhythm?: RetrieveRhythm; elapsedMs?: number;
  speciesId?: string; rolls?: { contact?: number; species?: number; promotion?: number; bite?: number }; forced?: boolean;
}
export interface RetrieveState {
  fight?: FightOptions;
  typing: TypingState; cover: boolean[]; keys: number[]; rhythm: RetrieveRhythm;
  lastKeyAt: number; lastRollAt: number; maxReeled: number;
  nibble?: { speciesId: string; resolvesAt: number; grass: boolean };
  notice?: string;
}
export interface FishSpecies {
  id: string; name: string; scientificName: string; biome: string; rarity: Rarity;
  encounterWeight: number; artwork: string; albinoArtwork: string;
  lengthCm: [number, number]; weightKg: [number, number]; description: string;
}
export interface Encounter {
  id: string; species: FishSpecies; quality: Quality; isAlbino: boolean;
  targetWpm: number; wpmAdjustment: number; conditions?: FishingConditions; phrase: string; lengthCm: number; weightKg: number;
  retrieve?: RetrieveMemory; castDistance?: number;
}
export interface TypingState {
  phrase: string; typed: string; startedAt: number; deadline: number;
  attempts: number; errors: number; finishedAt?: number;
}
export interface Performance { wpm: number; accuracy: number; timeRemaining: number; correctCharacters: number }
export type GameState = (
  | { phase: 'idle' }
  | { phase: 'casting'; fight?: FightOptions; biteAt: number; waitAt: number; tackle?: TackleSetup; waitRange?: [number, number]; mode?: FishingMode; castDistance?: number }
  | { phase: 'waiting'; biteAt: number; tackle?: TackleSetup; waitRange?: [number, number]; castDistance?: number }
  | { phase: 'retrieving'; retrieve: RetrieveState; tackle: TackleSetup; castDistance: number }
  | { phase: 'retrieved' }
  | { phase: 'typing'; encounter: Encounter; typing: TypingState; fight?: FishFightState }
  | { phase: 'landing'; encounter: Encounter; performance: Performance; resultAt: number }
  | { phase: 'result'; outcome: 'caught'; encounter: Encounter; performance: Performance }
  | { phase: 'result'; outcome: 'escaped'; performance: Performance; reason?: 'line-snapped'; lineLossM?: number; lineTestLb?: number }) & { check?: FishCheck };
export type CharacterState = 'idle' | 'preparing' | 'casting' | 'waiting' | 'bite' | 'reeling' | 'success' | 'escape' | 'returning';
export interface CatchTypingMemory {
  phrase: string;
  haiku?: { id: string; author: string; translator: string; lines: readonly string[] };
}
export interface CatchRecord extends Performance {
  id: string; speciesId: string; rarity: Rarity; quality: Quality; isAlbino: boolean;
  lengthCm: number; weightKg: number; caughtAt: string; location: string;
  conditions?: FishingConditions;
  typing?: CatchTypingMemory;
  retrieve?: RetrieveMemory;
}
export type MeasurementSystem = 'imperial' | 'metric';
export interface ButterflyPose {frame:number;rotation:number;flipped:boolean;view?:'side'|'front'|'back'}
export type NotebookImage = { kind: 'fish'; speciesId: string; lengthCm: number; weightKg: number; isAlbino: boolean } | { kind: 'butterfly'; speciesId?:string; wingspanMm?:number;pose?:ButterflyPose } | {kind:'visitor';speciesId:string;pose?:ButterflyPose} | {kind:'bird';speciesId:TreeBirdSpeciesId;pose?:BirdPose};
export interface NotebookEntry {
  id: string; caughtAt: string; location: string; title: string; name: string; notes: string;
  weightKg?: number; lengthCm?: number; image?: NotebookImage;
}
export interface FishingStats {
  caught: number; escaped: number; discovered: string[];
  byRarity: Record<Rarity, number>; byQuality: Record<Quality, number>; albinos: number; albinoDiscovered: string[];
  largest: Record<string, { lengthCm: number; weightKg: number }>;
  bestWpm: number; totalWpm: number; currentStreak: number; longestStreak: number;
}
export interface SaveData {
  visitorDiscoveries?: string[]; santaYears?: number[];
  lineGear?: LineGear;
  version: 1; livewell: CatchRecord[]; stats: FishingStats; balance: number;
  location: string; awardedIds: string[]; tackle: TackleSetup; notebook?: NotebookEntry[]; butterflyDiscoveries?:string[]; sizeQualityVersion?: 1;
  settings: { sound: boolean; soundVolume?: number; reducedMotion: boolean; keepScreenAwake?: boolean; hideFishDetails?: boolean; measurements?: MeasurementSystem; weather: Weather; fishingMode?: FishingMode; wordCheckpoint?: boolean; environmentRender?: EnvironmentRender; stormStartedAt?: number; weatherMode?: 'manual' | 'natural'; naturalWeather?: NaturalWeatherState };
}
export interface EncounterOverrides { speciesId?: string; rarity?: Rarity; quality?: Quality; isAlbino?: boolean; targetWpm?: number; wpmAdjustment?: number; lineRemaining?: number; castDistance?: number }
export interface SceneAsset {
  id: string; src?: string; format: 'svg' | 'png' | 'gif' | 'webp' | 'spritesheet' | 'procedural';
  position: { x: number; y: number; width: number; height: number };
  zIndex: number; opacity: number; scale: number; parallax: number;
  flipX?: boolean;
  fadeTop?: number;
  animation?: 'drift' | 'sway' | 'shimmer' | 'willow'; weatherResponse?: boolean; interactionResponse?: boolean;
  aspectRatio?: number; minWidth?: number;
  seat?: { x: number; y: number; characterWidth: number };
  sprite?: { frames: number; fps: number }; spots?: string[];
}
