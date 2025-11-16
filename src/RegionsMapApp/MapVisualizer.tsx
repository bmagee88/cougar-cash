import React, { useMemo, useState } from "react";
import {
  Box,
  Grid,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

// =======================
// TYPES & CONFIG
// =======================

type BiomeName = "sea" | "beach" | "forest" | "mountain" | "desert" | "plains";
type POIType = "city" | "settlement" | "ruin" | "dungeon" | "cave";

interface BiomeConfig {
  name: BiomeName;
  /** probability this biome appears in a given region (0–1) */
  spawnRate: number;
  /** adjacency probabilities: if both biomes exist in region, chance of edge */
  adjacency: Partial<Record<BiomeName, number>>;
  /** weights for POI types for this biome */
  poiWeights: Partial<Record<POIType, number>>;
}

interface PointOfInterest {
  id: string;
  biome: BiomeName;
  depth: number; // 1–5
  type: POIType;
}

interface BiomeDepthLevel {
  depth: number; // 1–5
  pois: PointOfInterest[]; // 1–3 POIs
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
  x: number;
  y: number;
  biomes: RegionBiomeInstance[];
  edges: RegionGraphEdge[];
}

// (We’ll skip inter-region links in this first viz)

// =======================
// BIOME CONFIG
// =======================

const BIOME_CONFIGS: BiomeConfig[] = [
  {
    name: "sea",
    spawnRate: 0.9,
    adjacency: {
      beach: 1.0,
      plains: 0.2,
    },
    poiWeights: {
      city: 0.2,
      settlement: 0.4,
      ruin: 0.2,
      dungeon: 0.1,
      cave: 0.1,
    },
  },
  {
    name: "beach",
    spawnRate: 0.7,
    adjacency: {
      sea: 1.0,
      plains: 0.5,
      forest: 0.3,
    },
    poiWeights: {
      settlement: 0.5,
      city: 0.3,
      ruin: 0.2,
    },
  },
  {
    name: "plains",
    spawnRate: 0.8,
    adjacency: {
      forest: 0.6,
      mountain: 0.2,
      desert: 0.3,
      beach: 0.5,
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
    spawnRate: 0.8,
    adjacency: {
      plains: 0.6,
      mountain: 0.4,
      beach: 0.3,
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
    },
    poiWeights: {
      cave: 0.4,
      dungeon: 0.3,
      ruin: 0.3,
    },
  },
  {
    name: "desert",
    spawnRate: 0.4,
    adjacency: {
      plains: 0.3,
      mountain: 0.3,
    },
    poiWeights: {
      settlement: 0.3,
      ruin: 0.4,
      dungeon: 0.2,
      cave: 0.1,
    },
  },
];

// =======================
// RNG / HELPERS
// =======================

function randInt(min: number, maxInclusive: number): number {
  return min + Math.floor(Math.random() * (maxInclusive - min + 1));
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
  return entries[entries.length - 1][0]; // fallback
}

// =======================
// REGION GENERATION
// =======================

function chooseBiomesForRegion(configs: BiomeConfig[]): BiomeConfig[] {
  let chosen = configs.filter((cfg) => Math.random() < cfg.spawnRate);

  // Ensure at least sea biome
  const hasSea = chosen.some((c) => c.name === "sea");
  if (!hasSea) {
    const seaCfg = configs.find((c) => c.name === "sea");
    if (seaCfg) chosen.push(seaCfg);
  }

  // Ensure at least one land biome
  const hasLand = chosen.some((c) => c.name !== "sea");
  if (!hasLand) {
    const land = configs.find((c) => c.name !== "sea");
    if (land) chosen.push(land);
  }

  return chosen;
}

function buildIntraRegionEdges(biomes: BiomeConfig[]): RegionGraphEdge[] {
  const edges: RegionGraphEdge[] = [];

  for (let i = 0; i < biomes.length; i++) {
    for (let j = i + 1; j < biomes.length; j++) {
      const a = biomes[i];
      const b = biomes[j];

      let prob =
        a.adjacency[b.name] ??
        b.adjacency[a.name] ??
        0;

      // force sea <-> beach connection if present
      if (
        (a.name === "sea" && b.name === "beach") ||
        (a.name === "beach" && b.name === "sea")
      ) {
        prob = 1;
      }

      if (prob > 0 && Math.random() < prob) {
        const kind: "land" | "water" =
          a.name === "sea" || b.name === "sea" ? "water" : "land";

        edges.push({ from: a.name, to: b.name, kind });
        edges.push({ from: b.name, to: a.name, kind });
      }
    }
  }

  return edges;
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

    levels.push({ depth, pois });
  }

  return levels;
}

function generateRegion(
  id: string,
  x: number,
  y: number,
  configs: BiomeConfig[]
): Region {
  const chosenBiomeConfigs = chooseBiomesForRegion(configs);
  const edges = buildIntraRegionEdges(chosenBiomeConfigs);

  const biomeInstances: RegionBiomeInstance[] = chosenBiomeConfigs.map((cfg) => ({
    name: cfg.name,
    depthLevels: generateDepthLevelsForBiome(id, cfg),
  }));

  return {
    id,
    x,
    y,
    biomes: biomeInstances,
    edges,
  };
}

// =======================
// VISUAL STYLING HELPERS
// =======================

const BIOME_COLORS: Record<BiomeName, string> = {
  sea: "#0ea5e9",
  beach: "#fde68a",
  forest: "#22c55e",
  mountain: "#9ca3af",
  desert: "#fbbf24",
  plains: "#86efac",
};

function getRegionMainBiome(region: Region): BiomeName {
  // Prefer a non-sea biome if present, else sea
  const nonSea = region.biomes.find((b) => b.name !== "sea");
  return nonSea?.name ?? "sea";
}

function titleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// =======================
// MAIN COMPONENT
// =======================

const GRID_WIDTH = 5;
const GRID_HEIGHT = 3;

const MapVisualizer: React.FC = () => {
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);

  const regions = useMemo<Region[]>(() => {
    const list: Region[] = [];
    let idCounter = 0;
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const id = `R${idCounter}`;
        // spacing of 10 units just to have coordinates that aren't tiny
        list.push(generateRegion(id, x * 10, y * 10, BIOME_CONFIGS));
        idCounter++;
      }
    }
    return list;
  }, []);

  const selectedRegion = useMemo(
    () => regions.find((r) => r.id === selectedRegionId) ?? regions[0],
    [regions, selectedRegionId]
  );

  React.useEffect(() => {
    if (!selectedRegionId && regions.length > 0) {
      setSelectedRegionId(regions[0].id);
    }
  }, [regions, selectedRegionId]);

  return (
    <Box
      sx={{
        display: "flex",
        gap: 2,
        p: 2,
        height: "100vh",
        boxSizing: "border-box",
        bgcolor: "#020617",
        color: "#f9fafb",
      }}
    >
      {/* LEFT: MAP GRID */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography variant="h5" gutterBottom>
          World Map
        </Typography>
        <Typography variant="body2" sx={{ mb: 1, opacity: 0.8 }}>
          Click a region to inspect its biomes, depth levels, and points of interest.
        </Typography>
        <Grid
          container
          spacing={1}
          sx={{
            flex: 1,
            alignContent: "flex-start",
          }}
        >
          {regions.map((region) => {
            const mainBiome = getRegionMainBiome(region);
            const isSelected = region.id === selectedRegionId;
            return (
              <Grid
                item
                key={region.id}
                xs={12 / GRID_WIDTH}
                sx={{ minWidth: 0 }}
              >
                <Paper
                  onClick={() => setSelectedRegionId(region.id)}
                  elevation={isSelected ? 8 : 2}
                  sx={{
                    cursor: "pointer",
                    p: 1,
                    borderRadius: 2,
                    border: isSelected
                      ? "2px solid #f97316"
                      : "1px solid rgba(148, 163, 184, 0.3)",
                    bgcolor: "rgba(15,23,42,0.9)",
                    position: "relative",
                    overflow: "hidden",
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
                  <Box sx={{ position: "relative" }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {region.id} ({region.x},{region.y})
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={0.5}
                      sx={{
                        mt: 0.5,
                        flexWrap: "wrap",
                      }}
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
                      {region.edges.length / 2} biome connections
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
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
          }}
        >
          <Paper
            elevation={6}
            sx={{
              p: 2,
              borderRadius: 3,
              bgcolor: "rgba(15,23,42,1)",
              border: "1px solid rgba(148, 163, 184, 0.4)",
            }}
          >
            <Typography variant="h6" sx={{ mb: 0.5 }}>
              Region {selectedRegion.id}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              Coords: ({selectedRegion.x}, {selectedRegion.y})
            </Typography>

            <Divider sx={{ my: 1.5, borderColor: "rgba(148, 163, 184, 0.4)" }} />

            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Biomes in Region
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", mb: 1 }}>
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
              {selectedRegion.edges.length === 0
                ? "none"
                : `${selectedRegion.edges.length / 2} unique biome links`}
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
            }}
          >
            <Box sx={{ p: 2, pb: 1 }}>
              <Typography variant="subtitle1">
                Depth & Points of Interest
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.75 }}>
                Each biome has 5 depth levels. Each depth has 1–3 POIs.
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
                  defaultExpanded={biome.name !== "sea"} // keep non-sea open by default
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
                    <Typography variant="subtitle2">
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
                                  sx={{ fontWeight: 600 }}
                                >
                                  Depth {level.depth}
                                </Typography>
                              }
                              secondary={
                                <Stack
                                  direction="row"
                                  spacing={0.5}
                                  sx={{ flexWrap: "wrap", mt: 0.5 }}
                                >
                                  {level.pois.map((poi) => (
                                    <Chip
                                      key={poi.id}
                                      label={titleCase(poi.type)}
                                      size="small"
                                      sx={{
                                        fontSize: "0.65rem",
                                        bgcolor: "rgba(15,23,42,0.9)",
                                        border:
                                          poi.type === "city"
                                            ? "1px solid #22c55e"
                                            : poi.type === "dungeon"
                                            ? "1px solid #ef4444"
                                            : poi.type === "ruin"
                                            ? "1px solid #a855f7"
                                            : "1px solid rgba(148,163,184,0.6)",
                                      }}
                                    />
                                  ))}
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
