import { FishSpecies, Quality, Rarity } from './types';
import { artwork } from './artwork';

export const BALANCE = {
  challengeMs: 10000, waitMs: [10000, 20000] as [number, number], castMs: 850, landingMs: 850,
  baseWpm: { Common: 18, Uncommon: 28, Rare: 42, 'Mythic-Rare': 58, 'Ultra-Rare': 74 } as Record<Rarity, number>,
  qualityBonus: { C: 0, B: 6, A: 12, S: 18, SS: 24 } as Record<Quality, number>,
  qualityWeights: { C: 48, B: 30, A: 15, S: 5.5, SS: 1.5 } as Record<Quality, number>,
  albinoChance: 1 / 512, albinoBonus: 12,
  adjustmentMin: -50, adjustmentMax: 10, minWpm: 1, maxWpm: 130,
  phraseTolerance: 3, livewellCapacity: 60, initialBalance: 120, catchCoins: 5,
};
export const LOCATIONS = [
  { id: 'dock', name: 'Cedar Lake', spot: 'The old dock', cost: 0, description: 'A familiar place to find a little quiet.' },
  { id: 'cove', name: 'Cedar Lake', spot: 'Willow cove', cost: 25, description: 'Golden willows, sheltered water, and room to breathe.' },
];
const asset = (id: string, albino = false) => artwork(`fish/${id}${albino ? '-albino' : ''}-painted.png`);
// Rarity is a game encounter classification, never conservation status.
// A fictional Great Lakes connected freshwater biome; ranges are illustrative game sizes.
const fish = (id: string, name: string, scientificName: string, rarity: Rarity, encounterWeight: number, lengthCm: [number, number], weightKg: [number, number], description: string): FishSpecies => ({
  id, name, scientificName, rarity, encounterWeight, lengthCm, weightKg, description,
  biome: 'temperate-lake', artwork: asset(id), albinoArtwork: asset(id, true),
});
export const SPECIES: FishSpecies[] = [
  fish('bluegill', 'Bluegill', 'Lepomis macrochirus', 'Common', 35, [10, 30], [0.05, 1.1], 'A small sunfish with a dark gill flap, often found among shoreline plants.'),
  fish('perch', 'Yellow perch', 'Perca flavescens', 'Common', 25, [12, 38], [0.06, 1.2], 'Golden sides and dark vertical bars make this schooling fish easy to recognize.'),
  fish('crappie', 'Black crappie', 'Pomoxis nigromaculatus', 'Uncommon', 18, [15, 40], [0.08, 1.5], 'A deep-bodied fish with a pattern of dark spots and a fondness for cover.'),
  fish('bass', 'Largemouth bass', 'Micropterus salmoides', 'Uncommon', 13, [20, 65], [0.15, 5.5], 'This ambush hunter shelters near vegetation, logs, and quiet shallows.'),
  fish('walleye', 'Walleye', 'Sander vitreus', 'Rare', 6, [25, 85], [0.2, 7.5], 'Light-sensitive eyes help this freshwater predator hunt in dim water.'),
  fish('pike', 'Northern pike', 'Esox lucius', 'Rare', 2, [30, 110], [0.25, 12], 'A long, spotted predator with a duckbill-shaped snout and fins set far back.'),
  fish('muskie', 'Muskellunge', 'Esox masquinongy', 'Mythic-Rare', 0.85, [40, 140], [0.4, 22], 'A large relative of the pike, with pointed tail lobes and dark markings.'),
  fish('sturgeon', 'Lake sturgeon', 'Acipenser fulvescens', 'Ultra-Rare', 0.15, [50, 190], [0.6, 65], 'An ancient bottom-dwelling fish with bony plates and whisker-like barbels.'),
];
export const RARITY_COLORS: Record<Rarity, string> = { Common: '#aac9b9', Uncommon: '#86cbb9', Rare: '#83bfee', 'Mythic-Rare': '#c9a4ef', 'Ultra-Rare': '#f4cc75' };
