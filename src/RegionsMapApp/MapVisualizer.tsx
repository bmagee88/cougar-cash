import React, { useMemo, useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  Chip,
  Divider,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Button,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

// =======================
// TYPES & CONFIG
// =======================

type BiomeName =
  | "sea"
  | "beach"
  | "lake"
  | "forest"
  | "mountain"
  | "desert"
  | "plains"
  | "tundra"
  | "volcano"
  | "meadow"
  | "swamp"
  | "bog"
  | "sandDesert"
  | "foothills"
  | "jungle";

type POIType =
  | "city"
  | "settlement"
  | "ruin"
  | "dungeon"
  | "cave"
  | "landCrossing"
  | "seaCrossing";

// Primary resource types

const ORE_TYPES = [
  "dranthium",
  "korvel",
  "sundral",
  "mornak",
  "vessrum",
  "quirnstone",
  "talvarn",
  "brumek",
  "xendral",
  "pallusk",
  "garneth",
  "dulvarn",
  "forgelux",
  "kaldrum",
  "mithrene",
  "obrecite",
  "pyromark",
  "quendral",
  "ruskane",
  "selvor",
  "tarnusk",
  "ulvren",
  "vekral",
  "wornyx",
  "yorveth",
  "zandrum",
  "corthun",
  "delvark",
  "embern",
  "flintar",
  "grunvek",
  "haldrith",
  "ironvek",
  "jorlum",
  "krendel",
  "lumrath",
  "morvane",
  "nerthul",
  "ornak",
  "prendrum",
  "quessal",
  "rildrum",
  "stonekith",
  "thalvorn",
  "umbracite",
  "valdrum",
  "wyrnstone",
  "yendrak",
  "borveth",
] as const;
type OreName = (typeof ORE_TYPES)[number];

const GEM_TYPES = [
  "auratite",
  "quorlite",
  "sylvatite",
  "mornalite",
  "zeratite",
  "pyralite",
  "lunatite",
  "kestrelite",
  "drimlite",
  "voratite",
  "astralite",
  "coralite",
  "ferralite",
  "glimmlite",
  "opalite",
  "crystite",
  "shardlite",
  "velolite",
  "duskylite",
  "cindertite",
  "frostlite",
  "echotite",
  "nebulite",
  "prismalite",
  "runetite",
  "starlite",
  "gravatite",
  "selentite",
  "mirralite",
  "onyxlite",
  "theralite",
  "voltatite",
  "glimralite",
  "aetherlite",
  "cryptite",
  "phasealite",
  "aurorlite",
  "emberlite",
  "shadowtite",
  "silvalite",
  "tempestite",
  "radiantite",
  "lunalite",
  "mossalite",
  "cavernlite",
  "mythrilite",
  "zenitite",
  "solatite",
  "iritite",
  "stellatite",
] as const; // all end with -tite or -lite
type GemName = (typeof GEM_TYPES)[number];

const HERB_TYPES = [
  "florensia",
  "valeruna",
  "cresciana",
  "lyrphora",
  "tessavia",
  "morvalis",
  "brunalia",
  "cerronia",
  "numellia",
  "xyrthesia",
  "ardenvia",
  "belladrixa",
  "corynthia",
  "dulcaris",
  "elvaria",
  "feronia",
  "galentis",
  "halveria",
  "ismeris",
  "jolandria",
  "kalthera",
  "luminara",
  "meridella",
  "norphesia",
  "olvaris",
  "prunelia",
  "quelvenia",
  "rasilia",
  "selveris",
  "thandoria",
  "ulmeria",
  "veridella",
  "wyllasia",
  "ysmara",
  "zelphoria",
  "ambrasia",
  "borrelia",
  "calvaris",
  "dresenia",
  "ephyrella",
  "falminia",
  "galleris",
  "hyrvenna",
  "illystria",
  "jasmoria",
  "korvenia",
  "lyrentis",
  "marcellia",
  "novarina",
  "orphesia",
] as const; // vaguely Latin-ish
type HerbName = (typeof HERB_TYPES)[number];

const ENEMY_TYPES = [
  "grimvark",
  "skraith",
  "murnokk",
  "veldrin",
  "borlusk",
  "tarkeen",
  "drevil",
  "kryzth",
  "loomark",
  "fenvar",
  "ashgroth",
  "balgorn",
  "cindrath",
  "dregmaar",
  "eldrakk",
  "forvusk",
  "gorlith",
  "hexrune",
  "ironshad",
  "jorvask",
  "krallin",
  "lurveth",
  "malgrix",
  "nethrak",
  "orvane",
  "pyrlokk",
  "quilnarr",
  "rathgor",
  "skulvane",
  "thraxim",
  "ulgrath",
  "vornak",
  "wyrveth",
  "xenrak",
  "yarvonn",
  "zulgrim",
  "blightvar",
  "cowlisk",
  "duskreen",
  "fenvorax",
  "gnarveth",
  "hallowrend",
  "inkraith",
  "jaskorn",
  "kevrusk",
  "morvask",
  "nightvarn",
  "rancoril",
  "shadevark",
  "tornhusk",
] as const;
type EnemyName = (typeof ENEMY_TYPES)[number];

type ResourceCategory = "ore" | "gem" | "herb" | "enemy";

type ResourceNameByCategory = {
  ore: OreName;
  gem: GemName;
  herb: HerbName;
  enemy: EnemyName;
};

const RESOURCE_LISTS: {
  [K in ResourceCategory]: readonly ResourceNameByCategory[K][];
} = {
  ore: ORE_TYPES,
  gem: GEM_TYPES,
  herb: HERB_TYPES,
  enemy: ENEMY_TYPES,
};

// The order here MUST match your BiomeName union
const BIOME_ORDER: BiomeName[] = [
  "sea",
  "beach",
  "lake",
  "forest",
  "mountain",
  "desert",
  "plains",
  "tundra",
  "volcano",
  "meadow",
  "swamp",
  "bog",
  "sandDesert",
  "foothills",
  "jungle",
];

// Category-specific shifts so each category "peaks" on different names
const CATEGORY_SHIFT: Record<ResourceCategory, number> = {
  ore: 0,
  gem: 7,
  herb: 14,
  enemy: 21,
};

// Max probability for any single resource (e.g., 45%)
const MAX_PROB_PER_ITEM = 0.45;

interface DepthResources {
  ore: OreName;
  gem: GemName;
  herb: HerbName;
  enemy: EnemyName;
}

interface BiomeConfig {
  name: BiomeName;
  spawnRate: number;
  adjacency: Partial<Record<BiomeName, number>>;
  poiWeights: Partial<Record<POIType, number>>; // excluding crossings
}

interface PointOfInterest {
  id: string;
  biome: BiomeName;
  depth: number; // 1–5
  type: POIType;
}

// Primary resources associated with a biome depth
interface DepthResources {
  ore: OreName;
  gem: GemName;
  herb: HerbName;
  enemy: EnemyName;
}

interface BiomeDepthLevel {
  depth: number; // 1–5
  pois: PointOfInterest[];
  primaryResources: DepthResources;
}

interface RegionBiomeInstance {
  name: BiomeName;
  depthLevels: BiomeDepthLevel[];
}

interface RegionGraphEdge {
  from: BiomeName;
  to: BiomeName;
  kind: "land" | "water";
}

interface Region {
  id: string;
  x: number; // region coordinates
  y: number;
  biomes: RegionBiomeInstance[];
  edges: RegionGraphEdge[];
}

// zoom 1 = 1x1, 2 = 3x3, 3 = 5x5
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

// =======================
// BIOME CONFIG
// =======================

const BIOME_CONFIGS: BiomeConfig[] = [
  {
    name: "sea",
    spawnRate: 0.5,
    adjacency: {
      beach: 1.0,
      plains: 0.2,
      jungle: 0.2,
      swamp: 0.3,
    },
    poiWeights: {
      city: 0.2,
      settlement: 0.3,
      ruin: 0.2,
      dungeon: 0.15,
      cave: 0.15,
    },
  },
  {
    name: "beach",
    spawnRate: 0.5,
    adjacency: {
      sea: 1.0,
      plains: 0.5,
      forest: 0.3,
      jungle: 0.4,
      sandDesert: 0.4,
    },
    poiWeights: {
      settlement: 0.5,
      city: 0.3,
      ruin: 0.2,
    },
  },
  {
    name: "lake",
    spawnRate: 0.2,
    adjacency: {
      meadow: 0.6,
      forest: 0.5,
      plains: 0.4,
      swamp: 0.5,
      bog: 0.4,
    },
    poiWeights: {
      settlement: 0.3,
      ruin: 0.3,
      cave: 0.2,
      city: 0.2,
    },
  },
  {
    name: "plains",
    spawnRate: 0.8,
    adjacency: {
      forest: 0.6,
      mountain: 0.2,
      desert: 0.3,
      sandDesert: 0.3,
      beach: 0.5,
      meadow: 0.6,
      foothills: 0.4,
      swamp: 0.2,
    },
    poiWeights: {
      city: 0.3,
      settlement: 0.4,
      ruin: 0.2,
      dungeon: 0.05,
      cave: 0.05,
    },
  },
  {
    name: "forest",
    spawnRate: 0.7,
    adjacency: {
      plains: 0.6,
      mountain: 0.4,
      beach: 0.3,
      swamp: 0.4,
      meadow: 0.5,
      foothills: 0.5,
      jungle: 0.4,
      bog: 0.2,
    },
    poiWeights: {
      settlement: 0.3,
      ruin: 0.3,
      dungeon: 0.2,
      cave: 0.2,
    },
  },
  {
    name: "mountain",
    spawnRate: 0.5,
    adjacency: {
      forest: 0.4,
      plains: 0.2,
      desert: 0.3,
      tundra: 0.4,
      volcano: 0.5,
      foothills: 0.6,
    },
    poiWeights: {
      cave: 0.4,
      dungeon: 0.3,
      ruin: 0.3,
    },
  },
  {
    name: "desert",
    spawnRate: 0.3,
    adjacency: {
      plains: 0.3,
      mountain: 0.3,
      sandDesert: 0.6,
      volcano: 0.3,
    },
    poiWeights: {
      settlement: 0.3,
      ruin: 0.4,
      dungeon: 0.2,
      cave: 0.1,
    },
  },
  {
    name: "sandDesert",
    spawnRate: 0.25,
    adjacency: {
      desert: 0.6,
      plains: 0.3,
      beach: 0.4,
      volcano: 0.4,
    },
    poiWeights: {
      settlement: 0.2,
      ruin: 0.5,
      dungeon: 0.2,
      cave: 0.1,
    },
  },
  {
    name: "tundra",
    spawnRate: 0.3,
    adjacency: {
      mountain: 0.5,
      bog: 0.4,
      forest: 0.3,
      plains: 0.3,
    },
    poiWeights: {
      ruin: 0.4,
      cave: 0.3,
      settlement: 0.3,
    },
  },
  {
    name: "volcano",
    spawnRate: 0.1,
    adjacency: {
      mountain: 0.6,
      desert: 0.4,
      sandDesert: 0.4,
    },
    poiWeights: {
      dungeon: 0.5,
      cave: 0.3,
      ruin: 0.2,
    },
  },
  {
    name: "meadow",
    spawnRate: 0.6,
    adjacency: {
      plains: 0.6,
      forest: 0.5,
      foothills: 0.4,
      lake: 0.6,
    },
    poiWeights: {
      settlement: 0.5,
      city: 0.3,
      ruin: 0.2,
    },
  },
  {
    name: "swamp",
    spawnRate: 0.4,
    adjacency: {
      forest: 0.5,
      plains: 0.2,
      bog: 0.5,
      lake: 0.5,
      jungle: 0.4,
    },
    poiWeights: {
      ruin: 0.3,
      dungeon: 0.3,
      cave: 0.2,
      settlement: 0.2,
    },
  },
  {
    name: "bog",
    spawnRate: 0.3,
    adjacency: {
      tundra: 0.4,
      forest: 0.3,
      swamp: 0.5,
      lake: 0.4,
    },
    poiWeights: {
      ruin: 0.4,
      cave: 0.3,
      dungeon: 0.2,
      settlement: 0.1,
    },
  },
  {
    name: "foothills",
    spawnRate: 0.5,
    adjacency: {
      mountain: 0.6,
      plains: 0.4,
      forest: 0.5,
      meadow: 0.4,
    },
    poiWeights: {
      cave: 0.3,
      settlement: 0.4,
      ruin: 0.3,
    },
  },
  {
    name: "jungle",
    spawnRate: 0.4,
    adjacency: {
      forest: 0.5,
      beach: 0.4,
      swamp: 0.4,
    },
    poiWeights: {
      ruin: 0.3,
      dungeon: 0.3,
      settlement: 0.2,
      cave: 0.2,
    },
  },
];

// =======================
// RNG / HELPERS
// =======================

function randInt(min: number, maxInclusive: number): number {
  return min + Math.floor(Math.random() * (maxInclusive - min + 1));
}

function chooseRandom<T>(values: readonly T[]): T {
  if (values.length === 0) {
    throw new Error("chooseRandom: empty array");
  }
  return values[randInt(0, values.length - 1)];
}

function chooseWeighted<T extends string>(
  weights: Partial<Record<T, number>>
): T {
  const entries = Object.entries(weights) as [T, number][];
  if (entries.length === 0) {
    throw new Error("chooseWeighted called with empty weights");
  }
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [value, w] of entries) {
    r -= w;
    if (r <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

// Build a smooth, biased probability distribution for a resource list,
// specific to a given biome + category.
// - Every resource gets a probability (some may be 0).
// - Sum of probabilities ~= 1 (=> 100%).
// - No single resource exceeds MAX_PROB_PER_ITEM.
function getResourceWeightsForBiome<C extends ResourceCategory>(
  category: C,
  biome: BiomeName
): Partial<Record<ResourceNameByCategory[C], number>> {
  const values = RESOURCE_LISTS[
    category
  ] as readonly ResourceNameByCategory[C][];
  const N = values.length;

  const biomeIndex = BIOME_ORDER.indexOf(biome);
  const shift = CATEGORY_SHIFT[category];

  // "Center" of the distribution for this biome+category
  const center = (biomeIndex * 5 + shift) % N;

  const raw: number[] = [];
  let total = 0;

  for (let i = 0; i < N; i++) {
    const distance = Math.abs(i - center);
    const wrappedDist = Math.min(distance, N - distance); // circular distance

    // Linear falloff from the center; tweak multipliers to taste
    let w = Math.max(0, 1.0 - wrappedDist * 0.08); // dist >= 13 => 0

    // Small weights get rounded down to zero => true "0%" entries
    if (w < 0.02) w = 0;

    raw.push(w);
    total += w;
  }

  // If everything was zero (shouldn't happen often), fallback to uniform
  if (total <= 0) {
    const uniform = 1 / N;
    const out: Partial<Record<ResourceNameByCategory[C], number>> = {};
    for (let i = 0; i < N; i++) {
      out[values[i]] = uniform;
    }
    return out;
  }

  // Normalize to probabilities that sum to ~1
  let probs = raw.map((w) => w / total);

  // Enforce MAX_PROB_PER_ITEM and renormalize the rest
  let remainingTotal = 1;
  let remainingIndices: number[] = [];
  const output: Partial<Record<ResourceNameByCategory[C], number>> = {};

  for (let i = 0; i < N; i++) {
    let p = probs[i];
    if (p > MAX_PROB_PER_ITEM) {
      p = MAX_PROB_PER_ITEM;
    } else {
      remainingIndices.push(i);
    }
    output[values[i]] = p;
    remainingTotal -= p;
  }

  if (remainingTotal > 0 && remainingIndices.length > 0) {
    const remainingSum = remainingIndices.reduce(
      (sum, idx) => sum + probs[idx],
      0
    );
    if (remainingSum > 0) {
      for (const idx of remainingIndices) {
        const extra = (probs[idx] / remainingSum) * remainingTotal;
        const name = values[idx];
        output[name] = (output[name] ?? 0) + extra;
      }
    }
  }

  return output;
}

function titleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function poiLabel(type: POIType): string {
  if (type === "landCrossing") return "Land Crossing";
  if (type === "seaCrossing") return "Sea Crossing";
  return titleCase(type);
}

const WATER_BIOMES: BiomeName[] = ["sea", "lake"];
function isWaterBiome(name: BiomeName): boolean {
  return WATER_BIOMES.includes(name);
}

// =======================
// REGION GENERATION
// =======================

function chooseBiomesForRegion(configs: BiomeConfig[]): BiomeConfig[] {
  let chosen = configs.filter((cfg) => Math.random() < cfg.spawnRate * 0.75);

  if (chosen.length === 0) {
    const random = configs[randInt(0, configs.length - 1)];
    chosen = [random];
  }

  const hasSea = chosen.some((c) => c.name === "sea");
  const hasBeach = chosen.some((c) => c.name === "beach");

  // Beach must have sea in same region
  if (hasBeach && !hasSea) {
    const seaCfg = configs.find((c) => c.name === "sea");
    if (seaCfg) chosen.push(seaCfg);
  }

  return chosen;
}

function buildIntraRegionEdges(biomes: BiomeConfig[]): RegionGraphEdge[] {
  const edges: RegionGraphEdge[] = [];

  for (let i = 0; i < biomes.length; i++) {
    for (let j = i + 1; j < biomes.length; j++) {
      const a = biomes[i];
      const b = biomes[j];

      let prob = a.adjacency[b.name] ?? b.adjacency[a.name] ?? 0;

      // force sea <-> beach connection if present
      if (
        (a.name === "sea" && b.name === "beach") ||
        (a.name === "beach" && b.name === "sea")
      ) {
        prob = 1;
      }

      if (prob > 0 && Math.random() < prob) {
        const kind: "land" | "water" =
          isWaterBiome(a.name) || isWaterBiome(b.name) ? "water" : "land";

        edges.push({ from: a.name, to: b.name, kind });
        edges.push({ from: b.name, to: a.name, kind });
      }
    }
  }

  return edges;
}

// Ensure each biome has at least one connection
function ensureAllBiomesConnected(
  biomes: BiomeConfig[],
  edges: RegionGraphEdge[]
): RegionGraphEdge[] {
  const result = [...edges];

  function hasEdge(name: BiomeName): boolean {
    return result.some((e) => e.from === name || e.to === name);
  }

  for (const biome of biomes) {
    if (!hasEdge(biome.name) && biomes.length > 1) {
      const candidates = biomes.filter((b) => b.name !== biome.name);
      const other = candidates[randInt(0, candidates.length - 1)];
      const kind: "land" | "water" =
        isWaterBiome(biome.name) || isWaterBiome(other.name) ? "water" : "land";

      result.push({ from: biome.name, to: other.name, kind });
      result.push({ from: other.name, to: biome.name, kind });
    }
  }

  return result;
}

// Beach must connect to at least one non-sea biome
function enforceBeachNonSeaEdges(
  biomes: BiomeConfig[],
  edges: RegionGraphEdge[]
): RegionGraphEdge[] {
  const result = [...edges];
  const beach = biomes.find((b) => b.name === "beach");
  if (!beach) return result;

  const biomeNames = biomes.map((b) => b.name);

  const hasNonSeaConnection = result.some(
    (e) =>
      e.from === "beach" &&
      e.to !== "sea" &&
      e.to !== "beach" &&
      biomeNames.includes(e.to)
  );

  if (!hasNonSeaConnection) {
    const candidates = biomes.filter(
      (b) => b.name !== "sea" && b.name !== "beach"
    );
    if (candidates.length > 0) {
      const other = candidates[randInt(0, candidates.length - 1)];
      const kind: "land" | "water" =
        isWaterBiome(other.name) || isWaterBiome("beach") ? "water" : "land";

      result.push({ from: "beach", to: other.name, kind });
      result.push({ from: other.name, to: "beach", kind });
    }
  }

  return result;
}

// Find connected components (islands) in the biome graph
function findBiomeComponents(
  biomes: BiomeConfig[],
  edges: RegionGraphEdge[]
): BiomeName[][] {
  const names = biomes.map((b) => b.name);

  // adjacency list using arrays (TS target-safe)
  const adj: Record<BiomeName, BiomeName[]> = {} as any;
  names.forEach((n) => {
    adj[n] = [];
  });

  // undirected connections
  for (const e of edges) {
    if (adj[e.from] && !adj[e.from].includes(e.to)) {
      adj[e.from].push(e.to);
    }
    if (adj[e.to] && !adj[e.to].includes(e.from)) {
      adj[e.to].push(e.from);
    }
  }

  const visited = new Set<BiomeName>();
  const components: BiomeName[][] = [];

  for (const n of names) {
    if (visited.has(n)) continue;

    const queue: BiomeName[] = [n];
    visited.add(n);
    const comp: BiomeName[] = [];

    while (queue.length) {
      const cur = queue.shift()!;
      comp.push(cur);

      const neighbors = adj[cur] || [];
      for (const neigh of neighbors) {
        if (!visited.has(neigh)) {
          visited.add(neigh);
          queue.push(neigh);
        }
      }
    }

    components.push(comp);
  }

  return components;
}

// Add lake if there are islands and connect it to one biome from each island
function addLakeForIslands(
  biomes: BiomeConfig[],
  edges: RegionGraphEdge[]
): { biomes: BiomeConfig[]; edges: RegionGraphEdge[] } {
  const components = findBiomeComponents(biomes, edges);
  if (components.length <= 1) {
    return { biomes, edges };
  }

  let resultEdges = [...edges];
  let resultBiomes = [...biomes];

  let lakeBiome = resultBiomes.find((b) => b.name === "lake");
  if (!lakeBiome) {
    const lakeCfg = BIOME_CONFIGS.find((b) => b.name === "lake");
    if (lakeCfg) {
      lakeBiome = lakeCfg;
      resultBiomes = [...resultBiomes, lakeCfg];
    }
  }

  if (!lakeBiome) return { biomes, edges }; // fallback

  for (const comp of components) {
    const targetName = comp.find((n) => n !== "lake") ?? comp[0];
    if (!targetName) continue;

    const kind: "land" | "water" =
      isWaterBiome("lake") || isWaterBiome(targetName) ? "water" : "land";

    resultEdges.push({ from: "lake", to: targetName, kind });
    resultEdges.push({ from: targetName, to: "lake", kind });
  }

  return { biomes: resultBiomes, edges: resultEdges };
}

function generateDepthLevelsForBiome(
  regionId: string,
  biomeConfig: BiomeConfig
): BiomeDepthLevel[] {
  const levels: BiomeDepthLevel[] = [];

  for (let depth = 1; depth <= 5; depth++) {
    const poiCount = randInt(1, 3);
    const pois: PointOfInterest[] = [];

    for (let n = 0; n < poiCount; n++) {
      const type = chooseWeighted<POIType>(biomeConfig.poiWeights);
      const id = `${regionId}-${biomeConfig.name}-d${depth}-${n}`;
      pois.push({
        id,
        biome: biomeConfig.name,
        depth,
        type,
      });
    }

    // Use per-biome probabilities for each resource category
    const primaryResources: DepthResources = {
      ore: chooseWeighted<OreName>(
        getResourceWeightsForBiome("ore", biomeConfig.name)
      ),
      gem: chooseWeighted<GemName>(
        getResourceWeightsForBiome("gem", biomeConfig.name)
      ),
      herb: chooseWeighted<HerbName>(
        getResourceWeightsForBiome("herb", biomeConfig.name)
      ),
      enemy: chooseWeighted<EnemyName>(
        getResourceWeightsForBiome("enemy", biomeConfig.name)
      ),
    };

    levels.push({ depth, pois, primaryResources });
  }

  return levels;
}

function biomeConnectsToSeaOrBeach(
  region: Region,
  biomeName: BiomeName
): boolean {
  return region.edges.some(
    (e) =>
      (e.from === biomeName && (e.to === "sea" || e.to === "beach")) ||
      (e.to === biomeName && (e.from === "sea" || e.from === "beach"))
  );
}

function addRequiredCrossings(region: Region): void {
  for (const biomeInst of region.biomes) {
    // SEA: depth 5 "sea crossing"
    if (biomeInst.name === "sea") {
      const level5 = biomeInst.depthLevels.find((l) => l.depth === 5);
      if (level5) {
        const hasSeaCrossing = level5.pois.some(
          (p) => p.type === "seaCrossing"
        );
        if (!hasSeaCrossing) {
          level5.pois.push({
            id: `${region.id}-${biomeInst.name}-d5-seaCrossing`,
            biome: biomeInst.name,
            depth: 5,
            type: "seaCrossing",
          });
        }
      }
      continue;
    }

    // LAND: any biome not connecting to sea or beach gets depth 1 "land crossing"
    if (biomeInst.name !== "beach") {
      const connected = biomeConnectsToSeaOrBeach(region, biomeInst.name);
      if (!connected) {
        const level1 = biomeInst.depthLevels.find((l) => l.depth === 1);
        if (level1) {
          const hasLandCrossing = level1.pois.some(
            (p) => p.type === "landCrossing"
          );
          if (!hasLandCrossing) {
            level1.pois.push({
              id: `${region.id}-${biomeInst.name}-d1-landCrossing`,
              biome: biomeInst.name,
              depth: 1,
              type: "landCrossing",
            });
          }
        }
      }
    }
  }
}

function regionIdFromCoords(x: number, y: number): string {
  return `R_${x}_${y}`;
}

function generateRegion(x: number, y: number, configs: BiomeConfig[]): Region {
  let chosenBiomeConfigs = chooseBiomesForRegion(configs);
  let edges = buildIntraRegionEdges(chosenBiomeConfigs);
  edges = ensureAllBiomesConnected(chosenBiomeConfigs, edges);
  edges = enforceBeachNonSeaEdges(chosenBiomeConfigs, edges);

  // Island check → lake biome
  const islandResult = addLakeForIslands(chosenBiomeConfigs, edges);
  chosenBiomeConfigs = islandResult.biomes;
  edges = islandResult.edges;

  const biomeInstances: RegionBiomeInstance[] = chosenBiomeConfigs.map(
    (cfg) => ({
      name: cfg.name,
      depthLevels: generateDepthLevelsForBiome(regionIdFromCoords(x, y), cfg),
    })
  );

  const region: Region = {
    id: regionIdFromCoords(x, y),
    x,
    y,
    biomes: biomeInstances,
    edges,
  };

  addRequiredCrossings(region);

  return region;
}

// =======================
// VISUAL STYLING HELPERS
// =======================

const BIOME_COLORS: Record<BiomeName, string> = {
  sea: "#0ea5e9",
  beach: "#fde68a",
  lake: "#38bdf8",
  forest: "#22c55e",
  mountain: "#9ca3af",
  desert: "#fbbf24",
  plains: "#86efac",
  tundra: "#bfdbfe",
  volcano: "#f97316",
  meadow: "#bbf7d0",
  swamp: "#15803d",
  bog: "#4b5563",
  sandDesert: "#facc15",
  foothills: "#a3e635",
  jungle: "#16a34a",
};

const BIOME_EMOJIS: Record<BiomeName, string> = {
  sea: "🌊",
  beach: "🏖️",
  lake: "💧",
  forest: "🌲",
  mountain: "⛰️",
  desert: "🏜️",
  plains: "🌾",
  tundra: "❄️",
  volcano: "🌋",
  meadow: "🌼",
  swamp: "🪵",
  bog: "🪨",
  sandDesert: "🌵",
  foothills: "🏕️",
  jungle: "🌴",
};

function isWaterMain(biome: BiomeName): boolean {
  return biome === "sea" || biome === "lake";
}

function getRegionMainBiome(region: Region): BiomeName {
  const nonWater = region.biomes.find((b) => !isWaterMain(b.name));
  if (nonWater) return nonWater.name;
  return region.biomes[0]?.name ?? "sea";
}

// place biomes in a circle inside tile
function layoutBiomePositions(
  biomeNames: BiomeName[]
): Record<BiomeName, { x: number; y: number }> {
  const positions: Record<BiomeName, { x: number; y: number }> = {} as any;
  const n = biomeNames.length;
  const centerX = 50;
  const centerY = 50;
  const radius = n === 1 ? 0 : 28;

  if (n === 1) {
    positions[biomeNames[0]] = { x: centerX, y: centerY };
    return positions;
  }

  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    positions[biomeNames[i]] = { x, y };
  }

  return positions;
}

function getUniqueEdges(region: Region): RegionGraphEdge[] {
  const seen = new Set<string>();
  const result: RegionGraphEdge[] = [];

  for (const e of region.edges) {
    const key = e.from < e.to ? `${e.from}-${e.to}` : `${e.to}-${e.from}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(e);
  }

  return result;
}

// compute point where a ray from biome outward hits tile edge
function computeEdgePointFromBiome(pos: { x: number; y: number }): {
  x: number;
  y: number;
} {
  const cx = 50;
  const cy = 50;
  const dx = pos.x - cx;
  const dy = pos.y - cy;

  if (dx === 0 && dy === 0) {
    return { x: cx, y: 0 };
  }

  const dirX = dx;
  const dirY = dy;

  const tVals: number[] = [];

  if (dirX > 0) tVals.push((100 - pos.x) / dirX);
  else if (dirX < 0) tVals.push((0 - pos.x) / dirX);

  if (dirY > 0) tVals.push((100 - pos.y) / dirY);
  else if (dirY < 0) tVals.push((0 - pos.y) / dirY);

  const t = Math.min(...tVals.filter((v) => v > 0));
  return {
    x: pos.x + dirX * t,
    y: pos.y + dirY * t,
  };
}

// check if a region has a biome by name
function regionHasBiome(region: Region | undefined, biomeName: BiomeName) {
  if (!region) return false;
  return region.biomes.some((b) => b.name === biomeName);
}

// does this region have at least one adjacent region with same biome?
function hasSameBiomeNeighbor(
  region: Region,
  biomeName: BiomeName,
  regionMap: Record<string, Region>
): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = region.x + dx;
      const ny = region.y + dy;
      const neighbor = regionMap[`${nx},${ny}`];
      if (neighbor && regionHasBiome(neighbor, biomeName)) {
        return true;
      }
    }
  }
  return false;
}

// =======================
// MAIN COMPONENT
// =======================

const MapVisualizer: React.FC = () => {
  const [centerX, setCenterX] = useState(0);
  const [centerY, setCenterY] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(2);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [selectedBiome, setSelectedBiome] = useState<{
    regionId: string;
    biome: BiomeName;
  } | null>(null);

  // regionMap keyed by "x,y"
  const [regionMap, setRegionMap] = useState<Record<string, Region>>(() => {
    const origin = generateRegion(0, 0, BIOME_CONFIGS);
    return { "0,0": origin };
  });

  // ensure visible regions exist whenever center/zoom changes
  useEffect(() => {
    const half = zoomLevel - 1;

    setRegionMap((prev) => {
      const newMap = { ...prev };
      let changed = false;

      for (let y = centerY + half; y >= centerY - half; y--) {
        for (let x = centerX - half; x <= centerX + half; x++) {
          const key = `${x},${y}`;
          if (!newMap[key]) {
            newMap[key] = generateRegion(x, y, BIOME_CONFIGS);
            changed = true;
          }
        }
      }

      return changed ? newMap : prev;
    });
  }, [centerX, centerY, zoomLevel]);

  const allRegions: Region[] = useMemo(
    () => Object.values(regionMap),
    [regionMap]
  );

  const half = zoomLevel - 1;
  const cols = 2 * zoomLevel - 1;

  const visibleRegions: Region[] = useMemo(() => {
    const arr: Region[] = [];
    for (let y = centerY + half; y >= centerY - half; y--) {
      for (let x = centerX - half; x <= centerX + half; x++) {
        const key = `${x},${y}`;
        const region = regionMap[key];
        if (region) {
          arr.push(region);
        }
      }
    }
    return arr;
  }, [centerX, centerY, half, regionMap]);

  const selectedRegion = useMemo(
    () =>
      allRegions.find((r) => r.id === selectedRegionId) ??
      regionMap[`${centerX},${centerY}`] ??
      allRegions[0],
    [allRegions, selectedRegionId, regionMap, centerX, centerY]
  );

  const selectedBiomeRegion = useMemo(() => {
    if (!selectedBiome) return null;
    return allRegions.find((r) => r.id === selectedBiome.regionId) ?? null;
  }, [selectedBiome, allRegions]);

  // initialize selected region once we have data
  useEffect(() => {
    if (!selectedRegionId && allRegions.length > 0) {
      const origin = regionMap["0,0"] ?? allRegions[0];
      setSelectedRegionId(origin.id);
    }
  }, [allRegions, regionMap, selectedRegionId]);

  // controls
  const zoomIn = () => setZoomLevel((z) => Math.min(MAX_ZOOM, z + 1));

  const zoomOut = () => setZoomLevel((z) => Math.max(MIN_ZOOM, z - 1));

  const moveUp = () => setCenterY((y) => y + 1);
  const moveDown = () => setCenterY((y) => y - 1);
  const moveLeft = () => setCenterX((x) => x - 1);
  const moveRight = () => setCenterX((x) => x + 1);

  // helper: is this biome node highlighted?
  function isBiomeHighlighted(region: Region, biomeName: BiomeName): boolean {
    if (!selectedBiome || !selectedBiomeRegion) return false;

    // directly selected biome
    if (
      selectedBiome.regionId === region.id &&
      selectedBiome.biome === biomeName
    ) {
      return true;
    }

    // same biome in adjacent region (8-neighborhood)
    const dx = region.x - selectedBiomeRegion.x;
    const dy = region.y - selectedBiomeRegion.y;
    const isAdjacent =
      Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && !(dx === 0 && dy === 0);

    if (isAdjacent && biomeName === selectedBiome.biome) {
      return true;
    }

    return false;
  }

  // helper: is this biome directly connected (via intra-region edge) to the selected biome?
  function isConnectedBiome(region: Region, biomeName: BiomeName): boolean {
    if (!selectedBiome || !selectedBiomeRegion) return false;

    // Only consider biomes within the same region as the selection
    if (selectedBiome.regionId !== region.id) return false;

    // The selected biome itself is handled by isBiomeHighlighted
    if (biomeName === selectedBiome.biome) return false;

    const edges = getUniqueEdges(region);
    return edges.some(
      (e) =>
        (e.from === selectedBiome.biome && e.to === biomeName) ||
        (e.to === selectedBiome.biome && e.from === biomeName)
    );
  }

  // helper: is this outward crossing line highlighted?
  function isCrossingHighlighted(
    region: Region,
    biomeName: BiomeName
  ): boolean {
    if (!selectedBiome || !selectedBiomeRegion) return false;

    const sameBiome = biomeName === selectedBiome.biome;
    if (!sameBiome) return false;

    // origin biome crossing
    if (selectedBiome.regionId === region.id) return true;

    // neighbor biome crossing
    const dx = region.x - selectedBiomeRegion.x;
    const dy = region.y - selectedBiomeRegion.y;
    const isAdjacent =
      Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && !(dx === 0 && dy === 0);

    return isAdjacent;
  }

  return (
    <Box
      sx={{
        display: "flex",
        gap: 2,
        p: 2,
        minHeight: "100vh",
        boxSizing: "border-box",
        bgcolor: "#020617",
        color: "#f9fafb",
      }}
    >
      {/* LEFT: MAP GRID & CONTROLS */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography variant="h5" gutterBottom>
          World Map
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.8 }}>
          Click a biome to highlight its local graph and any matching crossings
          in adjacent regions.
        </Typography>

        {/* Controls */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            flexWrap: "wrap",
            mt: 1,
            mb: 1,
          }}
        >
          <Typography variant="body2">Zoom:</Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={zoomOut}
            disabled={zoomLevel === MIN_ZOOM}
          >
            -
          </Button>
          <Typography variant="body2">Level {zoomLevel}</Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={zoomIn}
            disabled={zoomLevel === MAX_ZOOM}
          >
            +
          </Button>

          <Box sx={{ flexGrow: 1 }} />

          <Typography variant="body2">Move:</Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(3, auto)",
              gap: 0.5,
            }}
          >
            <Box />
            <Button size="small" variant="outlined" onClick={moveUp}>
              ↑
            </Button>
            <Box />
            <Button size="small" variant="outlined" onClick={moveLeft}>
              ←
            </Button>
            <Button size="small" variant="outlined" onClick={moveDown}>
              ↓
            </Button>
            <Button size="small" variant="outlined" onClick={moveRight}>
              →
            </Button>
          </Box>
        </Box>

        {/* Map grid */}
        <Box
          sx={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gap: 1,
            alignContent: "flex-start",
          }}
        >
          {visibleRegions.map((region) => {
            const mainBiome = getRegionMainBiome(region);
            const isSelectedRegion = region.id === selectedRegionId;
            const biomeNames = region.biomes.map((b) => b.name);
            const positions = layoutBiomePositions(biomeNames);
            const uniqueEdges = getUniqueEdges(region);

            return (
              <Paper
                key={region.id}
                onClick={() => {
                  setSelectedRegionId(region.id);
                  // don't clear selectedBiome unless user changes manually
                }}
                elevation={isSelectedRegion ? 8 : 2}
                sx={{
                  cursor: "pointer",
                  p: 1,
                  borderRadius: 2,
                  border: isSelectedRegion
                    ? "2px solid #f97316"
                    : "1px solid rgba(148, 163, 184, 0.3)",
                  bgcolor: "rgba(15,23,42,0.9)",
                  position: "relative",
                  overflow: "hidden",
                  minHeight: 0,
                  aspectRatio: "1 / 1", // ⬅️ square card
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* biome color backdrop */}
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    opacity: 0.25,
                    bgcolor: BIOME_COLORS[mainBiome],
                    pointerEvents: "none",
                  }}
                />
                <Box
                  sx={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    ({region.x},{region.y})
                  </Typography>

                  {/* Mini biome graph */}
                  <Box
                    sx={{
                      mt: 0.5,
                      width: "100%",
                      flex: 1,
                    }}
                  >
                    <svg viewBox="0 0 100 100" width="100%" height="100%">
                      {/* outward land / sea connection lines, conditioned on matching biomes in neighbors */}
                      {region.biomes.map((b) => {
                        const pos = positions[b.name];
                        if (!pos) return null;

                        const isWater = isWaterBiome(b.name);

                        // Allow ALL non-water biomes, including beaches, to create land crossings
                        // as long as there is at least one neighboring region that also has this biome.
                        const hasNeighborSameBiome = hasSameBiomeNeighbor(
                          region,
                          b.name,
                          regionMap
                        );
                        if (!hasNeighborSameBiome) return null;

                        const highlighted = isCrossingHighlighted(
                          region,
                          b.name
                        );
                        const edgePoint = computeEdgePointFromBiome(pos);

                        return (
                          <line
                            key={`${region.id}-${b.name}-edge`}
                            x1={pos.x}
                            y1={pos.y}
                            x2={edgePoint.x}
                            y2={edgePoint.y}
                            stroke={
                              isWater
                                ? highlighted
                                  ? "#7dd3fc" // bright blue highlight for sea/lake
                                  : "#38bdf8"
                                : highlighted
                                ? "#fed7aa" // bright highlight for land/beach
                                : "#92400e"
                            }
                            strokeWidth={highlighted ? 3 : 2}
                            strokeLinecap="round"
                            strokeDasharray={isWater ? "4 2" : undefined}
                          />
                        );
                      })}

                      {/* intra-region biome edges */}
                      {uniqueEdges.map((e) => {
                        const fromPos = positions[e.from];
                        const toPos = positions[e.to];
                        if (!fromPos || !toPos) return null;

                        const highlighted =
                          !!selectedBiome &&
                          selectedBiome.regionId === region.id &&
                          (e.from === selectedBiome.biome ||
                            e.to === selectedBiome.biome);

                        return (
                          <line
                            key={`${region.id}-${e.from}-${e.to}`}
                            x1={fromPos.x}
                            y1={fromPos.y}
                            x2={toPos.x}
                            y2={toPos.y}
                            stroke={
                              highlighted
                                ? e.kind === "water"
                                  ? "#7dd3fc"
                                  : "#f97316"
                                : e.kind === "water"
                                ? "rgba(56,189,248,0.9)"
                                : "rgba(148,163,184,0.9)"
                            }
                            strokeWidth={highlighted ? 3 : 1.5}
                            strokeLinecap="round"
                          />
                        );
                      })}

                      {/* biome nodes */}
                      {biomeNames.map((name) => {
                        const pos = positions[name];
                        const radius = 6;

                        const primary = isBiomeHighlighted(region, name); // selected + same-biome neighbors
                        const secondary =
                          !primary && isConnectedBiome(region, name); // directly connected biomes in same region
                        const anyHighlight = primary || secondary;

                        return (
                          <g
                            key={`${region.id}-${name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBiome({
                                regionId: region.id,
                                biome: name,
                              });
                            }}
                            style={{ cursor: "pointer" }}
                          >
                            <title>{titleCase(name)}</title>
                            <circle
                              cx={pos.x}
                              cy={pos.y}
                              r={anyHighlight ? radius + 1.5 : radius}
                              fill={BIOME_COLORS[name]}
                              stroke={
                                primary
                                  ? "#f97316" // selected biome + same biome in adjacent regions
                                  : secondary
                                  ? "#22c55e" // connected biomes in same region (different color)
                                  : "#020617" // default
                              }
                              strokeWidth={anyHighlight ? 2 : 1.5}
                            />
                            <text
                              x={pos.x}
                              y={pos.y + 3}
                              textAnchor="middle"
                              fontSize={anyHighlight ? 8 : 7}
                              fill="#020617"
                            >
                              {BIOME_EMOJIS[name]}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </Box>

                  {/* Biome chips */}
                  {/* <Stack
                    direction="row"
                    spacing={0.5}
                    sx={{ flexWrap: "wrap" }}
                  >
                    {region.biomes.map((b) => (
                      <Chip
                        key={b.name}
                        label={titleCase(b.name)}
                        size="small"
                        sx={{
                          bgcolor: "rgba(15,23,42,0.8)",
                          border: `1px solid ${BIOME_COLORS[b.name]}`,
                          color: "#e5e7eb",
                          fontSize: "0.65rem",
                        }}
                      />
                    ))}
                  </Stack>
                  <Typography
                    variant="caption"
                    sx={{ display: "block", mt: 0.5, opacity: 0.75 }}
                  >
                    {getUniqueEdges(region).length} biome connections
                  </Typography> */}
                </Box>
              </Paper>
            );
          })}
        </Box>
      </Box>

      {/* RIGHT: REGION DETAIL */}
      {selectedRegion && (
        <Box
          sx={{
            flexBasis: 360,
            maxWidth: 400,
            minWidth: 280,
            display: "flex",
            flexDirection: "column",
            gap: 1,
            alignSelf: "stretch", // ⬅️ match left column height
          }}
        >
          <Paper
            elevation={6}
            sx={{
              p: 2,
              borderRadius: 3,
              bgcolor: "rgba(15,23,42,1)",
              border: "1px solid rgba(148, 163, 184, 0.4)",
              color: "#ffffff", // ⬅️ make text white
            }}
          >
            <Typography
              variant="overline"
              sx={{ letterSpacing: 1.5, color: "rgba(148, 163, 184, 0.9)" }}
            >
              Region Overview
            </Typography>

            <Typography variant="h6" sx={{ mb: 0.5 }}>
              ({selectedRegion.x}, {selectedRegion.y})
            </Typography>

            <Divider
              sx={{ my: 1.5, borderColor: "rgba(148, 163, 184, 0.4)" }}
            />

            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Biomes in Region
            </Typography>
            <Stack
              direction="row"
              spacing={0.5}
              sx={{ flexWrap: "wrap", mb: 1 }}
            >
              {selectedRegion.biomes.map((b) => (
                <Chip
                  key={b.name}
                  label={titleCase(b.name)}
                  size="small"
                  sx={{
                    bgcolor: BIOME_COLORS[b.name],
                    color: "#0f172a",
                    fontWeight: 600,
                    fontSize: "0.7rem",
                  }}
                />
              ))}
            </Stack>

            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              Connections:{" "}
              {getUniqueEdges(selectedRegion).length === 0
                ? "none"
                : `${getUniqueEdges(selectedRegion).length} biome links`}
            </Typography>
          </Paper>

          <Paper
            elevation={4}
            sx={{
              flex: 1,
              minHeight: 0,
              borderRadius: 3,
              bgcolor: "rgba(15,23,42,1)",
              border: "1px solid rgba(148, 163, 184, 0.4)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              color: "#ffffff", // ⬅️ make text white
            }}
          >
            <Box sx={{ p: 2, pb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Depth, Resources & Points of Interest
              </Typography>
              <Typography
                variant="caption"
                sx={{ opacity: 0.8, display: "block", mt: 0.5 }}
              >
                Each depth shows its primary <strong>ore</strong>,{" "}
                <strong>gem</strong>,<strong> herb</strong>, and{" "}
                <strong>enemy</strong>, plus any points of interest. Land biomes
                not touching sea or beach get a depth 1{" "}
                <strong>Land Crossing</strong>. Sea biomes get a depth 5{" "}
                <strong>Sea Crossing</strong>.
              </Typography>
            </Box>

            <Divider sx={{ borderColor: "rgba(148, 163, 184, 0.4)" }} />

            <Box
              sx={{
                flex: 1,
                overflowY: "auto",
                p: 1,
              }}
            >
              {selectedRegion.biomes.map((biome) => (
                <Accordion
                  key={biome.name}
                  disableGutters
                  defaultExpanded={biome.name !== "sea"}
                  sx={{
                    bgcolor: "transparent",
                    "&::before": { display: "none" },
                    borderRadius: 2,
                    mb: 1,
                    border: `1px solid rgba(148,163,184,0.4)`,
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon sx={{ color: "#e5e7eb" }} />}
                    sx={{
                      bgcolor: "rgba(15,23,42,0.9)",
                      borderRadius: 2,
                      "& .MuiAccordionSummary-content": {
                        alignItems: "center",
                        gap: 1,
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: "999px",
                        bgcolor: BIOME_COLORS[biome.name],
                      }}
                    />
                    <Typography variant="subtitle2"  sx={{ color: "#ffffff" }}>
                      {titleCase(biome.name)}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ bgcolor: "rgba(15,23,42,0.6)" }}>
                    <List dense disablePadding>
                      {biome.depthLevels.map((level) => (
                        <React.Fragment key={level.depth}>
                          <ListItem sx={{ alignItems: "flex-start" }}>
                            <ListItemText
                              primary={
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: 600, color: "white" }}
                                >
                                  Depth {level.depth}
                                </Typography>
                              }
                              secondary={
                                <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                                  {/* Resources row */}
                                  <Stack
                                    direction="row"
                                    spacing={0.5}
                                    sx={{
                                      flexWrap: "wrap",
                                      alignItems: "center",
                                    }}
                                  >
                                    <Typography
                                      variant="caption"
                                      sx={{ opacity: 0.7, minWidth: 64, color: "white" }}
                                    >
                                      Resources
                                    </Typography>

                                    <Chip
                                      label={`Ore: ${level.primaryResources.ore}`}
                                      size="small"
                                      sx={{
                                        fontSize: "0.65rem",
                                        bgcolor: "rgba(15,23,42,0.9)", color: "white",
                                        border:
                                          "1px solid rgba(251, 191, 36, 0.7)", // warm gold, color: "white"
                                      }}
                                    />
                                    <Chip
                                      label={`Gem: ${level.primaryResources.gem}`}
                                      size="small"
                                      sx={{
                                        fontSize: "0.65rem",
                                        bgcolor: "rgba(15,23,42,0.9)", color: "white",
                                        border:
                                          "1px solid rgba(56, 189, 248, 0.7)", // cyan
                                      }}
                                    />
                                    <Chip
                                      label={`Herb: ${level.primaryResources.herb}`}
                                      size="small"
                                      sx={{
                                        fontSize: "0.65rem",
                                        bgcolor: "rgba(15,23,42,0.9)", color: "white",
                                        border:
                                          "1px solid rgba(74, 222, 128, 0.7)", // green
                                      }}
                                    />
                                    <Chip
                                      label={`Enemy: ${level.primaryResources.enemy}`}
                                      size="small"
                                      sx={{
                                        fontSize: "0.65rem",
                                        bgcolor: "rgba(15,23,42,0.9)", color: "white",
                                        border:
                                          "1px solid rgba(248, 113, 113, 0.7)", // red
                                      }}
                                    />
                                  </Stack>

                                  {/* POIs row */}
                                  <Stack
                                    direction="row"
                                    spacing={0.5}
                                    sx={{
                                      flexWrap: "wrap",
                                      alignItems: "flex-start",
                                    }}
                                  >
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        opacity: 0.7,
                                        minWidth: 64,
                                        mt: 0.25, color: "white"
                                      }}
                                    >
                                      POIs
                                    </Typography>

                                    {level.pois.length === 0 ? (
                                      <Typography
                                        variant="caption"
                                        sx={{ opacity: 0.6, color: "white" }}
                                      >
                                        none
                                      </Typography>
                                    ) : (
                                      level.pois.map((poi) => (
                                        <Chip
                                          key={poi.id}
                                          label={poiLabel(poi.type)}
                                          size="small"
                                          sx={{
                                            fontSize: "0.65rem", color: "white",
                                            bgcolor: "rgba(15,23,42,0.9)",
                                            border:
                                              poi.type === "city"
                                                ? "1px solid #22c55e"
                                                : poi.type === "dungeon"
                                                ? "1px solid #ef4444"
                                                : poi.type === "ruin"
                                                ? "1px solid #a855f7"
                                                : poi.type === "landCrossing"
                                                ? "1px solid #facc15"
                                                : poi.type === "seaCrossing"
                                                ? "1px solid #38bdf8"
                                                : "1px solid rgba(148,163,184,0.6)",
                                          }}
                                        />
                                      ))
                                    )}
                                  </Stack>
                                </Stack>
                              }
                            />
                          </ListItem>

                          {level.depth !== 5 && (
                            <Divider
                              component="li"
                              sx={{
                                borderColor: "rgba(51, 65, 85, 0.7)",
                                my: 0.5,
                              }}
                            />
                          )}
                        </React.Fragment>
                      ))}
                    </List>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default MapVisualizer;
