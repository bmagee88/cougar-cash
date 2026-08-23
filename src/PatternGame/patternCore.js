const HABITATS = ["V", "W", "R", "O", "D"];
const LURES = ["Frog", "Jig", "Worm", "Crankbait", "Spinnerbait", "Swimbait"];
const COLORS = ["Natural", "Dark", "Bright", "Flash"];
const RETRIEVES = ["Slow", "Steady", "Erratic", "Fast"];
const MOON_PHASES = ["New", "Half", "Full", "Half"];
const BATTLE_START_POSITION = 4;
const BATTLE_ESCAPE_POSITION = 8;

const HABITAT_LABELS = {
  V: "Vegetation",
  W: "Wood",
  R: "Rock",
  O: "Open Water",
  D: "Deep Structure",
  M: "Muck",
};

const SEASONS = [
  { id: "spring", label: "Spring", rounds: [1, 2, 3] },
  { id: "summer", label: "Summer", rounds: [4, 5, 6] },
  { id: "fall", label: "Fall", rounds: [7, 8, 9] },
  { id: "winter", label: "Winter", rounds: [10, 11, 12] },
];

const WEATHER_DECK = [
  "Clear & Calm",
  "Clear & Calm",
  "Overcast",
  "Overcast",
  "Windy",
  "Windy",
  "Rain",
  "Rain",
  "Cold Front",
  "Warm Stable",
  "Light Chop",
  "Storm Front",
];

const WEIGHT_RANGES = {
  small: [1.0, 2.4],
  keeper: [2.5, 3.9],
  quality: [4.0, 5.4],
  trophy: [5.5, 7.0],
  lunker: [7.1, 10.0],
};

const WEIGHT_DISTRIBUTION = {
  small: 6,
  keeper: 6,
  quality: 4,
  trophy: 3,
  lunker: 1,
};

const TELL_TABLE = {
  clear: { weight: 20, lures: 2, colors: 2, retrieves: 2 },
  normal: { weight: 40, lures: 3, colors: 2, retrieves: 2 },
  cloudy: { weight: 25, lures: 3, colors: 3, retrieves: 2 },
  murky: { weight: 15, lures: 3, colors: 3, retrieves: 3 },
};

const PREFERENCE_TABLES = {
  V: {
    lure: { Frog: 25, Jig: 20, Worm: 25, Crankbait: 5, Spinnerbait: 15, Swimbait: 10 },
    color: { Natural: 35, Dark: 35, Bright: 20, Flash: 10 },
    retrieve: { Slow: 35, Steady: 15, Erratic: 35, Fast: 15 },
  },
  W: {
    lure: { Frog: 5, Jig: 30, Worm: 25, Crankbait: 10, Spinnerbait: 20, Swimbait: 10 },
    color: { Natural: 35, Dark: 40, Bright: 15, Flash: 10 },
    retrieve: { Slow: 40, Steady: 25, Erratic: 20, Fast: 15 },
  },
  R: {
    lure: { Frog: 2, Jig: 28, Worm: 22, Crankbait: 25, Spinnerbait: 8, Swimbait: 15 },
    color: { Natural: 45, Dark: 25, Bright: 10, Flash: 20 },
    retrieve: { Slow: 30, Steady: 35, Erratic: 15, Fast: 20 },
  },
  O: {
    lure: { Frog: 2, Jig: 5, Worm: 10, Crankbait: 25, Spinnerbait: 25, Swimbait: 33 },
    color: { Natural: 30, Dark: 10, Bright: 25, Flash: 35 },
    retrieve: { Slow: 10, Steady: 35, Erratic: 15, Fast: 40 },
  },
  D: {
    lure: { Frog: 1, Jig: 30, Worm: 25, Crankbait: 15, Spinnerbait: 5, Swimbait: 24 },
    color: { Natural: 40, Dark: 30, Bright: 10, Flash: 20 },
    retrieve: { Slow: 35, Steady: 35, Erratic: 15, Fast: 15 },
  },
};

const FIGHT_TABLES = {
  small: { 2: 30, 3: 30, 4: 20, 5: 15, 6: 5 },
  keeper: { 3: 30, 4: 30, 5: 25, 6: 15 },
  quality: { 4: 40, 5: 35, 6: 25 },
  trophy: { 5: 55, 6: 45 },
  lunker: { 5: 35, 6: 65 },
};

const ABILITY_TABLES = {
  V: { cover: 35, jump: 25, dive: 20, run: 10, headShake: 10 },
  W: { cover: 40, dive: 20, headShake: 15, run: 15, jump: 10 },
  R: { dive: 30, headShake: 30, run: 15, jump: 15, cover: 10 },
  O: { run: 40, jump: 30, headShake: 15, dive: 10, cover: 5 },
  D: { dive: 40, run: 25, headShake: 20, jump: 10, cover: 5 },
};

const LOCATION_TEMPLATES = [
  tile("01", "Mixed Cove", [
    ["OD", "OO", "DR"],
    ["VO", "VRO", "WR"],
    ["VW", "V", "WR"],
  ], [
    ["DD", "OD", "OR"],
    ["VO", "WRO", "VR"],
    ["V", "VW", "R"],
  ]),
  tile("02", "Creek Bend", [
    ["O", "OD", "D"],
    ["WO", "WRO", "RO"],
    ["WW", "VW", "VR"],
  ], [
    ["OD", "OO", "RD"],
    ["WO", "VWD", "VR"],
    ["W", "VW", "RR"],
  ]),
  tile("03", "Main-Lake Point", [
    ["OD", "DD", "OO"],
    ["RO", "ROD", "VO"],
    ["RR", "WR", "VR"],
  ], [
    ["OO", "OD", "DD"],
    ["RO", "VRO", "RD"],
    ["R", "WR", "V"],
  ]),
  tile("04", "Protected Pocket", [
    ["O", "OD", "D"],
    ["VO", "VWR", "WO"],
    ["VV", "M", "WR"],
  ], [
    ["OD", "O", "RD"],
    ["VO", "VWO", "WR"],
    ["VW", "V", "RR"],
  ]),
  tile("05", "Basin Corner", [
    ["DD", "OOD", "OD"],
    ["RD", "VRO", "WO"],
    ["RR", "VW", "V"],
  ], [
    ["OD", "DD", "OO"],
    ["RO", "WRD", "VO"],
    ["R", "VW", "VV"],
  ]),
  tile("06", "Hydrilla Bay", [
    ["VO", "OV", "RO"],
    ["VV", "VVV", "VW"],
    ["VV", "M", "VW"],
  ], [
    ["O", "VO", "VD"],
    ["VV", "VVV", "VR"],
    ["VW", "VV", "V"],
  ]),
  tile("07", "Flooded Timber", [
    ["OW", "OD", "OW"],
    ["WW", "WWW", "WR"],
    ["WW", "VW", "W"],
  ], [
    ["O", "OW", "WD"],
    ["WW", "WWW", "WO"],
    ["VW", "WW", "M"],
  ]),
  tile("08", "Riprap Bank", [
    ["OR", "OD", "OR"],
    ["RR", "RRR", "RD"],
    ["RR", "VR", "R"],
  ], [
    ["O", "RO", "RD"],
    ["RR", "RRR", "RO"],
    ["R", "RR", "VR"],
  ]),
  tile("09", "Windblown Flat", [
    ["OOO", "OOO", "OOD"],
    ["OO", "OOO", "OR"],
    ["R", "V", "VR"],
  ], [
    ["OOD", "OOO", "OOO"],
    ["RO", "OOO", "VO"],
    ["R", "VR", "V"],
  ]),
  tile("10", "Channel Drop", [
    ["DDD", "DDD", "ODD"],
    ["RD", "DDD", "OD"],
    ["R", "VR", "RR"],
  ], [
    ["ODD", "DDD", "DDD"],
    ["RD", "DDD", "DD"],
    ["RR", "R", "VR"],
  ]),
  tile("11", "Pad-Stump Pocket", [
    ["O", "VO", "WO"],
    ["VV", "VVW", "WW"],
    ["VW", "VW", "WW"],
  ], [
    ["VO", "O", "WO"],
    ["VW", "VWW", "VV"],
    ["VV", "M", "WW"],
  ]),
  tile("12", "Weed-Rock Point", [
    ["OR", "OD", "RO"],
    ["VR", "VVR", "RR"],
    ["VV", "VR", "RR"],
  ], [
    ["RO", "OD", "OR"],
    ["VR", "VRR", "VV"],
    ["V", "VR", "RR"],
  ]),
  tile("13", "Grass-to-Open Edge", [
    ["OOO", "OO", "OOD"],
    ["VO", "VVO", "VO"],
    ["VV", "V", "VV"],
  ], [
    ["OO", "OOO", "OD"],
    ["VO", "VOO", "VV"],
    ["V", "VV", "M"],
  ]),
  tile("14", "Weedline Drop", [
    ["DD", "DDD", "OD"],
    ["VD", "VVD", "VD"],
    ["VV", "VR", "V"],
  ], [
    ["DDD", "DD", "OD"],
    ["VD", "VDD", "VV"],
    ["VV", "V", "VR"],
  ]),
  tile("15", "Laydown on Riprap", [
    ["OR", "OD", "O"],
    ["WR", "WWR", "RR"],
    ["WW", "WR", "RR"],
  ], [
    ["RO", "OD", "OR"],
    ["WR", "WRR", "WW"],
    ["W", "WR", "RR"],
  ]),
  tile("16", "Flooded Timber Mouth", [
    ["OOO", "OO", "OOD"],
    ["WO", "WWO", "WO"],
    ["WW", "VW", "W"],
  ], [
    ["OO", "OOO", "OD"],
    ["WO", "WOO", "WW"],
    ["W", "WW", "VW"],
  ]),
  tile("17", "Timber Channel Edge", [
    ["DD", "DDD", "OD"],
    ["WD", "WWD", "WD"],
    ["WW", "WR", "W"],
  ], [
    ["DDD", "DD", "OD"],
    ["WD", "WDD", "WW"],
    ["W", "WW", "WR"],
  ]),
  tile("18", "Rocky Bait Point", [
    ["OOO", "OOO", "OOD"],
    ["RO", "RRO", "RO"],
    ["RR", "R", "VR"],
  ], [
    ["OO", "OOO", "OD"],
    ["RO", "ROO", "RR"],
    ["R", "RR", "VR"],
  ]),
  tile("19", "Rock Ledge Drop", [
    ["DDD", "DD", "ODD"],
    ["RD", "RRD", "RD"],
    ["RR", "RR", "VR"],
  ], [
    ["DD", "DDD", "OD"],
    ["RD", "RDD", "RR"],
    ["R", "RR", "VR"],
  ]),
  tile("20", "Baitfish Channel", [
    ["OOD", "DDD", "OOD"],
    ["OD", "OOD", "DD"],
    ["R", "VR", "R"],
  ], [
    ["OOO", "ODD", "DDD"],
    ["OD", "ODD", "OO"],
    ["VR", "R", "RR"],
  ]),
];

const CARD_DEFINITIONS = [
  { key: "trailerHook", name: "Trailer Hook", category: "tackle", copies: 2, tradeValue: 1, text: "+1 Hook Set when using Spinnerbait." },
  { key: "sharpHooks", name: "Sharp Hooks", category: "tackle", copies: 2, tradeValue: 3, text: "Once per turn reroll failed Hook Set." },
  { key: "scentGel", name: "Scent Gel", category: "tackle", copies: 2, tradeValue: 2, text: "+1 Nibble when Retrieve = Slow." },
  { key: "weedGuard", name: "Weed Guard", category: "tackle", copies: 2, tradeValue: 2, text: "Once per Battle ignore one Vegetation Tangle." },
  { key: "tungstenWeight", name: "Tungsten Weight", category: "tackle", copies: 2, tradeValue: 2, text: "+1 Nibble with Jig or Worm, Slow, in Rock or Deep." },
  { key: "rattleChamber", name: "Rattle Chamber", category: "tackle", copies: 2, tradeValue: 1, text: "+1 Nibble with Jig or Crankbait during Rain." },
  { key: "polarizedGlasses", name: "Polarized Glasses", category: "tackle", copies: 2, tradeValue: 4, text: "Once per turn reroll mixed-cell Habitat selection." },
  { key: "fishFinder", name: "Fish Finder", category: "tackle", copies: 2, tradeValue: 4, text: "In O/D cells, replace selected Habitat with O or D that exists." },
  { key: "landingNet", name: "Landing Net", category: "tackle", copies: 2, tradeValue: 3, text: "Once per Battle at space 1, 4+ lands immediately." },
  { key: "peggedWeight", name: "Pegged Weight", category: "tackle", copies: 2, tradeValue: 2, text: "+1 Hook Set with Jig or Worm in Vegetation or Wood." },
  { key: "luckyCast", name: "Lucky Cast", category: "trick", copies: 2, text: "After Cast roll, reroll Cast and keep the new result." },
  { key: "quickChange", name: "Quick Change", category: "trick", copies: 2, text: "After Bite Box, change one presentation and check again." },
  { key: "perfectHookset", name: "Perfect Hookset", category: "trick", copies: 2, text: "Before Hook Set roll: +2 Hook Set." },
  { key: "rodTipDown", name: "Rod Tip Down!", category: "trick", copies: 2, text: "When Jump triggers, cancel Jump effect." },
  { key: "thumbSpool", name: "Thumb the Spool", category: "trick", copies: 2, text: "When Run triggers, cancel Run extra movement." },
  { key: "popItFree", name: "Pop It Free", category: "trick", copies: 2, text: "When Tangled, remove Tangle immediately." },
  { key: "oneMoreCast", name: "One More Cast", category: "trick", copies: 2, text: "After failed Nibble, immediately attempt the same Fish again." },
  { key: "netJob", name: "Net Job", category: "trick", copies: 2, text: "When Fish is on Battle space 1, move directly to LANDED." },
  { key: "boatWake", name: "Boat Wake", category: "interference", copies: 2, text: "Before another player's Battle roll: -1." },
  { key: "snag", name: "SNAG!", category: "interference", copies: 2, text: "After another player fails in V, W, or R: add Tangle." },
  { key: "birdsNest", name: "Bird's Nest", category: "interference", copies: 2, text: "At another player's Battle start, their Reel has no effect." },
  { key: "spookedShadow", name: "Spooked by a Shadow", category: "interference", copies: 2, text: "Before another player's Nibble roll: -1 Nibble." },
  { key: "lineCross", name: "Line Cross", category: "interference", copies: 2, text: "Same Location after opponent Hook Set: add Tension." },
  { key: "feedingWindow", name: "Feeding Window", category: "event", copies: 1, immediate: true, text: "All players +1 Nibble this round." },
  { key: "risingWater", name: "Rising Water", category: "event", copies: 1, immediate: true, text: "V/W habitat cells gain one matching virtual icon this round." },
  { key: "baitfishBlitz", name: "Baitfish Blitz", category: "event", copies: 1, immediate: true, text: "+1 Nibble in Open Water this round." },
  { key: "shadSpawn", name: "Shad Spawn", category: "event", copies: 1, immediate: true, text: "Shore row Flash +1 Nibble this round." },
  { key: "crawfishCrawl", name: "Crawfish Crawl", category: "event", copies: 1, immediate: true, text: "Jig or Worm +1 Nibble in Rock or Wood this round." },
  { key: "tournamentPressure", name: "Tournament Pressure", category: "event", copies: 1, immediate: true, text: "Alert penalty is -2 Nibble this round." },
];

function tile(id, name, sideA, sideB) {
  return {
    id,
    name,
    sides: {
      A: parseGrid(sideA),
      B: parseGrid(sideB),
    },
  };
}

function parseGrid(rows) {
  return rows.map((row) => row.map(parseCell));
}

function parseCell(value) {
  if (value === "M") return ["M"];
  return value.split("").filter(Boolean);
}

function hashSeed(value) {
  const raw = String(value || "");
  let hash = 2166136261;
  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seed) {
  if (seed === undefined || seed === null || seed === "") {
    return Math.random;
  }

  let state = hashSeed(seed);
  return function rng() {
    state += 0x6d2b79f5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function randomHex(rng, length) {
  let result = "";
  while (result.length < length) {
    result += Math.floor(rng() * 16).toString(16).toUpperCase();
  }
  return result.slice(0, length);
}

function shuffleCopy(items, rng = Math.random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function weightedChoice(table, rng = Math.random) {
  const entries = Array.isArray(table)
    ? table
    : Object.entries(table).map(([value, weight]) => ({ value, weight }));
  const total = entries.reduce((sum, entry) => sum + Number(entry.weight || 0), 0);
  let roll = rng() * total;

  for (const entry of entries) {
    roll -= Number(entry.weight || 0);
    if (roll <= 0) return entry.value;
  }

  return entries[entries.length - 1]?.value;
}

function sampleUnique(values, count, rng = Math.random, weightTable = null) {
  const result = [];
  const available = [...values];

  while (available.length > 0 && result.length < count) {
    const choice = weightTable
      ? weightedChoice(
          available.map((value) => ({
            value,
            weight: weightTable[value] || 1,
          })),
          rng
        )
      : available[Math.floor(rng() * available.length)];
    result.push(choice);
    available.splice(available.indexOf(choice), 1);
  }

  return result;
}

function weightedPreference(habitat, category, rng = Math.random) {
  return weightedChoice(PREFERENCE_TABLES[habitat][category], rng);
}

function randomWeightForTier(tier, rng = Math.random) {
  const [min, max] = WEIGHT_RANGES[tier];
  return Number((min + rng() * (max - min)).toFixed(1));
}

function generateTell(habitat, innateProfile, rng = Math.random, difficulty = null) {
  const tellDifficulty =
    difficulty ||
    weightedChoice(
      Object.entries(TELL_TABLE).map(([value, config]) => ({
        value,
        weight: config.weight,
      })),
      rng
    );
  const config = TELL_TABLE[tellDifficulty];

  const lures = withTruthAndDistractors(
    innateProfile.lure,
    LURES,
    config.lures,
    rng,
    PREFERENCE_TABLES[habitat].lure
  );
  const colors = withTruthAndDistractors(
    innateProfile.color,
    COLORS,
    config.colors,
    rng,
    PREFERENCE_TABLES[habitat].color
  );
  const retrieves = withTruthAndDistractors(
    innateProfile.retrieve,
    RETRIEVES,
    config.retrieves,
    rng,
    PREFERENCE_TABLES[habitat].retrieve
  );

  return {
    tellDifficulty,
    tell: {
      lures,
      colors,
      retrieves,
    },
  };
}

function withTruthAndDistractors(truth, values, size, rng, weightTable) {
  const distractors = sampleUnique(
    values.filter((value) => value !== truth),
    size - 1,
    rng,
    weightTable
  );
  return shuffleCopy([truth, ...distractors], rng);
}

function generateFishPopulation(rng = Math.random) {
  const fish = [];

  for (const habitat of HABITATS) {
    const tiers = Object.entries(WEIGHT_DISTRIBUTION).flatMap(([tier, count]) =>
      Array.from({ length: count }, () => tier)
    );

    shuffleCopy(tiers, rng).forEach((weightTier, index) => {
      const innateProfile = {
        lure: weightedPreference(habitat, "lure", rng),
        color: weightedPreference(habitat, "color", rng),
        retrieve: weightedPreference(habitat, "retrieve", rng),
      };
      const tellResult = generateTell(habitat, innateProfile, rng);
      const fight = Number(weightedChoice(FIGHT_TABLES[weightTier], rng));
      const ability = weightedChoice(ABILITY_TABLES[habitat], rng);

      fish.push({
        id: `bass-${habitat}-${index + 1}-${randomHex(rng, 6)}`,
        habitat,
        weightTier,
        weight: randomWeightForTier(weightTier, rng),
        innateProfile,
        tellDifficulty: tellResult.tellDifficulty,
        tell: tellResult.tell,
        fight,
        ability,
        poolState: "available",
        activeLocation: null,
        alert: false,
        publicId: null,
        fightRevealed: false,
        guessHistory: [],
      });
    });
  }

  return fish;
}

function rotateGrid180(grid) {
  return [...grid].reverse().map((row) => [...row].reverse());
}

function generateLake(width = 3, rng = Math.random) {
  const columns = Math.max(2, Math.min(4, Number(width) || 3));
  const selectedTemplates = shuffleCopy(LOCATION_TEMPLATES, rng).slice(0, columns * 2);
  const tiles = [];

  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const template = selectedTemplates[row * columns + column];
      const side = rng() < 0.5 ? "A" : "B";
      const rotation = row === 0 ? 180 : 0;
      const canonicalGrid = template.sides[side];
      const displayGrid = rotation === 180 ? rotateGrid180(canonicalGrid) : canonicalGrid;

      tiles.push({
        id: `tile-${row}-${column}-${template.id}`,
        templateId: template.id,
        name: template.name,
        side,
        rotation,
        row,
        column,
        grid: displayGrid.map((gridRow) => gridRow.map((cell) => [...cell])),
      });
    }
  }

  return {
    width: columns,
    height: 2,
    tiles,
  };
}

function findTile(lake, tileId) {
  return lake?.tiles?.find((tileItem) => tileItem.id === tileId) || null;
}

function adjacentTileIds(lake, tileId) {
  const tileItem = findTile(lake, tileId);
  if (!tileItem) return [];

  return lake.tiles
    .filter(
      (candidate) =>
        Math.abs(candidate.row - tileItem.row) + Math.abs(candidate.column - tileItem.column) === 1
    )
    .map((candidate) => candidate.id);
}

function canMoveToTile(lake, fromTileId, toTileId) {
  return fromTileId === toTileId || adjacentTileIds(lake, fromTileId).includes(toTileId);
}

function castRollToCell(roll) {
  const map = {
    1: [0, 0],
    2: [0, 1],
    3: [0, 2],
    4: [1, 2],
    5: [2, 2],
    6: [2, 1],
    7: [2, 0],
    8: [1, 0],
    9: [1, 1],
    10: [1, 1],
  };
  return map[roll] || [1, 1];
}

function chooseHabitatFromCell(cell, rng = Math.random, options = {}) {
  if (!cell || cell.includes("M")) {
    return {
      habitat: null,
      pool: ["M"],
    };
  }

  const pool = [...cell];
  const eventKey = options.activeEvent?.key || "";
  if (eventKey === "risingWater") {
    if (cell.includes("V") && cell.includes("W")) {
      pool.push(options.risingWaterChoice === "W" ? "W" : "V");
    } else if (cell.includes("V")) {
      pool.push("V");
    } else if (cell.includes("W")) {
      pool.push("W");
    }
  }

  return {
    habitat: pool[Math.floor(rng() * pool.length)],
    pool,
  };
}

function generateMood(fish, rng = Math.random, forcedCategory = null) {
  const moodCategory =
    forcedCategory || ["neutral", "lure", "color", "retrieve"][Math.floor(rng() * 4)];
  const hiddenMoodOptions = {};

  if (moodCategory === "lure") {
    hiddenMoodOptions.lures = sampleUnique(
      LURES.filter((lure) => lure !== fish.innateProfile.lure),
      2,
      rng
    );
  }

  if (moodCategory === "color") {
    hiddenMoodOptions.colors = sampleUnique(
      COLORS.filter((color) => color !== fish.innateProfile.color),
      1,
      rng
    );
  }

  if (moodCategory === "retrieve") {
    hiddenMoodOptions.retrieves = sampleUnique(
      RETRIEVES.filter((retrieve) => retrieve !== fish.innateProfile.retrieve),
      1,
      rng
    );
  }

  return {
    moodCategory,
    hiddenMoodOptions,
  };
}

function resolveBiteBox(fish, mood, declaration) {
  const lureResult = categoryMatch(
    declaration.lure,
    fish.innateProfile.lure,
    mood.hiddenMoodOptions.lures
  );
  const colorResult = categoryMatch(
    declaration.color,
    fish.innateProfile.color,
    mood.hiddenMoodOptions.colors
  );
  const retrieveResult = categoryMatch(
    declaration.retrieve,
    fish.innateProfile.retrieve,
    mood.hiddenMoodOptions.retrieves
  );
  const results = [lureResult, colorResult, retrieveResult];

  return {
    matchCount: results.filter((result) => result.match).length,
    hotHit: results.some((result) => result.hot),
  };
}

function categoryMatch(value, innate, moodOptions = []) {
  if (value === innate) {
    return { match: true, hot: false };
  }

  if (moodOptions.includes(value)) {
    return { match: true, hot: true };
  }

  return { match: false, hot: false };
}

function calculateNibble(input) {
  const {
    matchCount,
    hotHit,
    lure,
    color,
    retrieve,
    habitat,
    alert,
    weather,
    season,
    line,
    tackle = [],
    activeEvent,
    shoreAdjacent,
  } = input;
  const details = [];

  if (hotHit) details.push({ label: "Hot Hit", value: 1 });
  if (lure === "Jig" && retrieve === "Slow" && ["W", "R", "D"].includes(habitat)) {
    details.push({ label: "Jig in cover/structure", value: 1 });
  }
  if (lure === "Worm" && retrieve === "Slow") {
    details.push({ label: "Slow Worm", value: 1 });
  }
  if (
    lure === "Crankbait" &&
    ["Steady", "Fast"].includes(retrieve) &&
    ["R", "O"].includes(habitat)
  ) {
    details.push({ label: "Crankbait lane", value: 1 });
  }
  if (
    lure === "Spinnerbait" &&
    ["Steady", "Fast"].includes(retrieve) &&
    ["Windy", "Rain"].includes(weather)
  ) {
    details.push({ label: "Spinnerbait weather", value: 1 });
  }
  if (lure === "Frog" && retrieve === "Erratic" && habitat === "V") {
    details.push({ label: "Erratic Frog", value: 1 });
  }
  if (lure === "Swimbait" && retrieve === "Steady" && ["O", "D"].includes(habitat)) {
    details.push({ label: "Steady Swimbait", value: 1 });
  }

  addWeatherNibble(details, { lure, color, retrieve, weather });
  addSeasonNibble(details, { retrieve, habitat, season });

  if (line === "Fluorocarbon" && weather === "Clear & Calm") {
    details.push({ label: "Fluorocarbon in Clear & Calm", value: 1 });
  }

  if (tackle.includes("scentGel") && retrieve === "Slow") {
    details.push({ label: "Scent Gel", value: 1 });
  }
  if (
    tackle.includes("tungstenWeight") &&
    ["Jig", "Worm"].includes(lure) &&
    retrieve === "Slow" &&
    ["R", "D"].includes(habitat)
  ) {
    details.push({ label: "Tungsten Weight", value: 1 });
  }
  if (
    tackle.includes("rattleChamber") &&
    ["Jig", "Crankbait"].includes(lure) &&
    weather === "Rain"
  ) {
    details.push({ label: "Rattle Chamber", value: 1 });
  }

  if (activeEvent?.key === "feedingWindow") {
    details.push({ label: "Feeding Window", value: 1 });
  }
  if (activeEvent?.key === "baitfishBlitz" && habitat === "O") {
    details.push({ label: "Baitfish Blitz", value: 1 });
  }
  if (activeEvent?.key === "shadSpawn" && shoreAdjacent && color === "Flash") {
    details.push({ label: "Shad Spawn", value: 1 });
  }
  if (
    activeEvent?.key === "crawfishCrawl" &&
    ["Jig", "Worm"].includes(lure) &&
    ["R", "W"].includes(habitat)
  ) {
    details.push({ label: "Crawfish Crawl", value: 1 });
  }

  if (alert) {
    details.push({
      label: activeEvent?.key === "tournamentPressure" ? "Tournament Alert" : "Alert",
      value: activeEvent?.key === "tournamentPressure" ? -2 : -1,
    });
  }

  const rawModifier = details.reduce((sum, item) => sum + item.value, 0);
  const modifier = Math.max(-2, Math.min(2, rawModifier));
  const baseTarget = [5, 4, 3, 2][matchCount] || 5;

  return {
    baseTarget,
    rawModifier,
    modifier,
    target: baseTarget,
    details,
  };
}

function addWeatherNibble(details, { lure, color, retrieve, weather }) {
  if (weather === "Clear & Calm" && color === "Natural") {
    details.push({ label: "Clear & Calm Natural", value: 1 });
  }
  if (
    weather === "Overcast" &&
    ["Crankbait", "Spinnerbait", "Swimbait"].includes(lure)
  ) {
    details.push({ label: "Overcast moving lure", value: 1 });
  }
  if (weather === "Windy" && ["Spinnerbait", "Crankbait"].includes(lure)) {
    details.push({ label: "Windy moving lure", value: 1 });
  }
  if (weather === "Rain" && ["Dark", "Bright"].includes(color)) {
    details.push({ label: "Rain color", value: 1 });
  }
  if (weather === "Cold Front" && retrieve === "Slow") {
    details.push({ label: "Cold Front Slow", value: 1 });
  }
  if (weather === "Cold Front" && retrieve === "Fast") {
    details.push({ label: "Cold Front Fast", value: -1 });
  }
  if (weather === "Warm Stable" && retrieve === "Steady") {
    details.push({ label: "Warm Stable Steady", value: 1 });
  }
  if (weather === "Light Chop" && color === "Flash") {
    details.push({ label: "Light Chop Flash", value: 1 });
  }
  if (weather === "Storm Front" && ["Spinnerbait", "Swimbait"].includes(lure)) {
    details.push({ label: "Storm Front moving lure", value: 1 });
  }
}

function addSeasonNibble(details, { retrieve, habitat, season }) {
  if (season === "Spring" && ["V", "W"].includes(habitat)) {
    details.push({ label: "Spring bank bite", value: 1 });
  }
  if (season === "Summer" && habitat === "D") {
    details.push({ label: "Summer deep bite", value: 1 });
  }
  if (season === "Fall" && ["O", "R"].includes(habitat)) {
    details.push({ label: "Fall bait bite", value: 1 });
  }
  if (season === "Winter" && retrieve === "Slow") {
    details.push({ label: "Winter Slow", value: 1 });
  }
  if (season === "Winter" && retrieve === "Fast") {
    details.push({ label: "Winter Fast", value: -1 });
  }
}

function resolveNibbleRoll(roll, calculation) {
  return {
    roll,
    modifiedRoll: roll + calculation.modifier,
    success: roll !== 1 && roll + calculation.modifier >= calculation.target,
  };
}

function calculateHookSet(input) {
  const { lure, habitat, rod, tackle = [], hardSet, waitBonus, cardBonus } = input;
  const details = [];

  if (hardSet) details.push({ label: "Hard Set", value: 2 });
  if (waitBonus) details.push({ label: "Committed Bite", value: waitBonus });
  if (cardBonus) details.push({ label: "Card", value: cardBonus });
  if (rod === "Medium-Heavy Rod" && ["V", "W"].includes(habitat)) {
    details.push({ label: "Medium-Heavy Rod", value: 1 });
  }
  if (tackle.includes("trailerHook") && lure === "Spinnerbait") {
    details.push({ label: "Trailer Hook", value: 1 });
  }
  if (
    tackle.includes("peggedWeight") &&
    ["Jig", "Worm"].includes(lure) &&
    ["V", "W"].includes(habitat)
  ) {
    details.push({ label: "Pegged Weight", value: 1 });
  }

  const modifier = details.reduce((sum, item) => sum + item.value, 0);
  return {
    modifier,
    target: Math.max(2, 4 - modifier),
    details,
  };
}

function resolveHookSetRoll(roll, calculation) {
  return {
    roll,
    success: roll >= calculation.target,
  };
}

function resolveSpookCheck(roll) {
  return {
    roll,
    spooked: roll <= 2,
  };
}

function createBattleState({ fishId, playerId, hardSet = false }) {
  return {
    fishId,
    playerId,
    position: BATTLE_START_POSITION,
    tension: Boolean(hardSet),
    tangled: false,
    abilityUsed: false,
    balancedReelRerollUsed: false,
    moderateRodJumpIgnoreUsed: false,
    heavyRodCoverIgnoreUsed: false,
    braidTangleIgnoreUsed: false,
    terminal: null,
    history: [],
  };
}

function resolveBattleStep(input) {
  const { fish, battle, action, roll, cell = [], equipment = {}, tackle = [] } = input;
  const next = {
    ...battle,
    history: [...(battle.history || [])],
  };
  const step = {
    action,
    roll: action === "giveLine" ? null : roll,
    modifier: 0,
    success: false,
    movement: 0,
    notes: [],
  };

  if (battle.terminal) return { battle: next, step };

  if (action === "giveLine") {
    next.position += 1;
    next.tension = false;
    step.movement = 1;
    step.notes.push("Gave line; ability suppressed for this step.");
    finalizeBattlePosition(next, step);
    next.history.push(step);
    return { battle: next, step };
  }

  let modifier = 0;
  if (action === "pressure") modifier += 1;
  if (action === "pressure" && equipment.reel === "Power Reel") modifier += 1;

  step.modifier = modifier;
  const success = roll + modifier >= fish.fight;
  step.success = success;

  if (success) {
    if (next.tangled) {
      next.tangled = false;
      step.notes.push("Success cleared Tangle instead of moving toward landed.");
    } else {
      next.position -= 1;
      step.movement = -1;
    }
  } else {
    next.position += action === "pressure" ? 2 : 1;
    step.movement = action === "pressure" ? 2 : 1;
    triggerBattleAbility({ fish, battle: next, step, action, cell, equipment, tackle });
  }

  if (success && tackle.includes("landingNet") && next.position === 1) {
    step.notes.push("Landing Net is ready at space 1.");
  }

  finalizeBattlePosition(next, step);
  next.history.push(step);
  return { battle: next, step };
}

function triggerBattleAbility({ fish, battle, step, action, cell, equipment }) {
  if (battle.abilityUsed) return;
  const ability = fish.ability;
  const hasCover = cell.includes("V") || cell.includes("W");
  const hasDiveCover =
    cell.includes("V") || cell.includes("W") || cell.includes("R") || cell.includes("D");

  if (ability === "jump" && battle.tension) {
    if (equipment.rod === "Moderate Rod" && !battle.moderateRodJumpIgnoreUsed) {
      battle.moderateRodJumpIgnoreUsed = true;
      battle.abilityUsed = true;
      step.notes.push("Moderate Rod ignored Jump.");
      return;
    }
    battle.position += 1;
    battle.abilityUsed = true;
    step.notes.push("Jump moved the Fish one extra space toward escape.");
  }

  if (ability === "run") {
    if (equipment.reel === "Fast Reel") {
      battle.abilityUsed = true;
      step.notes.push("Fast Reel cancelled Run.");
      return;
    }
    battle.position += 1;
    battle.abilityUsed = true;
    step.notes.push("Run moved the Fish one extra space toward escape.");
  }

  if (ability === "cover" && hasCover) {
    if (equipment.rod === "Heavy Rod" && !battle.heavyRodCoverIgnoreUsed) {
      battle.heavyRodCoverIgnoreUsed = true;
      battle.abilityUsed = true;
      step.notes.push("Heavy Rod ignored Cover.");
      return;
    }
    addTangle(battle, step, equipment, "Cover added Tangle.");
    battle.abilityUsed = true;
  }

  if (ability === "headShake" && action === "pressure") {
    battle.position += 1;
    battle.abilityUsed = true;
    step.notes.push("Head Shake punished Pressure with extra escape movement.");
  }

  if (ability === "dive" && battle.position >= 5 && hasDiveCover) {
    addTangle(battle, step, equipment, "Dive added Tangle.");
    battle.abilityUsed = true;
  }
}

function addTangle(battle, step, equipment, note) {
  if (battle.tangled) {
    step.notes.push("Tangle did not stack.");
    return;
  }

  if (equipment.line === "Braid" && !battle.braidTangleIgnoreUsed) {
    battle.braidTangleIgnoreUsed = true;
    step.notes.push("Braid ignored Tangle.");
    return;
  }

  battle.tangled = true;
  step.notes.push(note);
}

function finalizeBattlePosition(battle, step) {
  if (battle.position <= 0) {
    battle.position = 0;
    battle.terminal = "landed";
    step.notes.push("Fish reached LANDED.");
  } else if (battle.position >= BATTLE_ESCAPE_POSITION) {
    battle.position = BATTLE_ESCAPE_POSITION;
    battle.terminal = "escaped";
    step.notes.push("Fish reached ESCAPED.");
  }
}

function seasonForRound(round) {
  const found = SEASONS.find((season) => season.rounds.includes(round));
  return found?.label || "Spring";
}

function moonForRound(round) {
  return MOON_PHASES[(Math.max(1, round) - 1) % MOON_PHASES.length];
}

function buildActionDeck(rng = Math.random) {
  const cards = [];
  for (const definition of CARD_DEFINITIONS) {
    for (let copy = 0; copy < definition.copies; copy += 1) {
      cards.push({
        id: `card-${definition.key}-${copy + 1}-${randomHex(rng, 6)}`,
        key: definition.key,
        name: definition.name,
        category: definition.category,
        tradeValue: definition.tradeValue || null,
        text: definition.text,
        immediate: Boolean(definition.immediate),
        dead: false,
      });
    }
  }
  return shuffleCopy(cards, rng);
}

function buildWeatherDeck(rng = Math.random) {
  return shuffleCopy(WEATHER_DECK, rng);
}

function fullFishCard(fish) {
  return {
    id: fish.id,
    habitat: fish.habitat,
    habitatLabel: HABITAT_LABELS[fish.habitat],
    weightTier: fish.weightTier,
    weight: fish.weight,
    innateProfile: { ...fish.innateProfile },
    tellDifficulty: fish.tellDifficulty,
    tell: copyTell(fish.tell),
    guessHistory: copyGuessHistory(fish.guessHistory),
    fight: fish.fight,
    ability: fish.ability,
  };
}

function publicFishCard(fish) {
  return {
    publicId: fish.publicId,
    habitat: fish.habitat,
    habitatLabel: HABITAT_LABELS[fish.habitat],
    tellDifficulty: fish.tellDifficulty,
    tell: copyTell(fish.tell),
    guessHistory: copyGuessHistory(fish.guessHistory),
    alert: Boolean(fish.alert),
    fight: fish.fightRevealed ? fish.fight : null,
    ability: fish.fightRevealed ? fish.ability : null,
  };
}

function copyGuessHistory(guessHistory = []) {
  return guessHistory.map((guess) => ({
    ...guess,
    declaration: { ...guess.declaration },
  }));
}

function copyTell(tellValue) {
  return {
    lures: [...tellValue.lures],
    colors: [...tellValue.colors],
    retrieves: [...tellValue.retrieves],
  };
}

module.exports = {
  ABILITY_TABLES,
  BATTLE_ESCAPE_POSITION,
  BATTLE_START_POSITION,
  CARD_DEFINITIONS,
  COLORS,
  FIGHT_TABLES,
  HABITATS,
  HABITAT_LABELS,
  LOCATION_TEMPLATES,
  LURES,
  MOON_PHASES,
  PREFERENCE_TABLES,
  RETRIEVES,
  TELL_TABLE,
  WEATHER_DECK,
  WEIGHT_DISTRIBUTION,
  WEIGHT_RANGES,
  adjacentTileIds,
  buildActionDeck,
  buildWeatherDeck,
  calculateHookSet,
  calculateNibble,
  canMoveToTile,
  castRollToCell,
  chooseHabitatFromCell,
  createBattleState,
  createRng,
  findTile,
  fullFishCard,
  generateFishPopulation,
  generateLake,
  generateMood,
  generateTell,
  moonForRound,
  publicFishCard,
  randomHex,
  randomInt,
  resolveBattleStep,
  resolveBiteBox,
  resolveHookSetRoll,
  resolveNibbleRoll,
  resolveSpookCheck,
  seasonForRound,
  shuffleCopy,
  weightedChoice,
};
