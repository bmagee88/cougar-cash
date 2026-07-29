import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { OBJExporter } from "three-stdlib";
import {
  Box,
  Button,
  Chip,
  Container,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Slider,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import BlurOnIcon from "@mui/icons-material/BlurOn";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

type Point = {
  x: number;
  y: number;
};

type GeneratedLine = {
  id: number;
  start: Point;
  end: Point;
  angle: number;
};

type SegmentNode = {
  id: string;
  point: Point;
  kind: "border" | "intersection";
};

type Breakpoint = {
  t: number;
  nodeId: string;
  point: Point;
};

type Segment = {
  id: string;
  lineId: number;
  start: Point;
  end: Point;
  startNodeId: string;
  endNodeId: string;
  length: number;
  removalRank: number;
};

type GeneratedNetwork = {
  lines: GeneratedLine[];
  nodes: SegmentNode[];
  segments: Segment[];
  intersectionCount: number;
};

type GraphNode = {
  id: string;
  point: Point;
  kind: "border" | "corner" | "intersection";
};

type GraphEdge = {
  id: string;
  from: string;
  to: string;
  kind: "boundary" | "segment";
};

type ShapeTexture = {
  id: string;
  name: string;
  path: string;
};

type ShapeRegion = {
  id: string;
  label: string;
  points: Point[];
  area: number;
  perimeter: number;
  centroid: Point;
  color: string;
  texture: ShapeTexture;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
};

type ProjectionAxis = "xy" | "xz" | "yz";

type StoneViewMode = "3d" | ProjectionAxis;

type StoneProjectionSet = Record<ProjectionAxis, Point[]>;

type StoneGeometryModel = {
  geometry: THREE.BufferGeometry;
  vertexCount: number;
};

type StoneLayerTextures = [ShapeTexture, ShapeTexture, ShapeTexture];

type GrindingTextureStack = {
  textures: StoneLayerTextures;
  isLayered: boolean;
  label: string;
};

type StoneRotation = {
  x: number;
  y: number;
  z: number;
};

type Vector3Point = {
  x: number;
  y: number;
  z: number;
};

type GrindingCut = {
  normal: Vector3Point;
  offset: number;
  gritId: string;
};

type StoneFileKind = "original" | "polished";

type SavedShapeRegion = Omit<ShapeRegion, "texture"> & {
  textureId: string;
};

type StoneSnapshot = {
  version: 1;
  id: string;
  kind: StoneFileKind;
  label: string;
  seed: number;
  shape: SavedShapeRegion;
  textureId: string;
  cuts: GrindingCut[];
  createdAt: string;
};

type PreparedGrindingCut = {
  normal: THREE.Vector3;
  offset: number;
  gritId: string;
};

type GrindingStoneGeometryModel = StoneGeometryModel & {
  groundRatio: number;
  exposedRatio: number;
  deepestLayer: number;
  layerFaceCounts: [number, number, number];
};

type GrindingGrit = {
  id: string;
  label: string;
  description: string;
  feedSpeed: number;
  polishRoughness: number;
  polishMetalness: number;
  polishGlow: number;
};

type RoundnessResolver = (point: Point, index: number) => number;

const DEFAULT_LINE_COUNT = 14;
const DEFAULT_SQUARE_SIZE = 520;
const DEFAULT_STROKE_WIDTH = 8;
const DEFAULT_CORNER_ROUNDNESS = 12;
const STONE_LATITUDE_STEPS = 18;
const STONE_LONGITUDE_STEPS = 30;
const STONE_RADIUS_SEARCH_STEPS = 10;
const GRINDING_WHEEL_Y = 0.78;
const GRINDING_CUT_Y = GRINDING_WHEEL_Y - 0.035;
const GRINDING_FEED_HOME = 0;
const GRINDING_FEED_MIN = 0;
const GRINDING_FEED_MAX = 2.6;
const GRINDING_APPROACH_SPEED = 1.45;
const GRINDING_RETURN_SPEED = 2.15;
const GRINDING_FEED_EPSILON = 0.001;
const GRINDING_REST_BACKOFF = 0.045;
const GRINDING_WHEEL_RADIUS = 0.56;
const GRINDING_WHEEL_CENTER_Y = GRINDING_CUT_Y + GRINDING_WHEEL_RADIUS;
const GRINDING_ROTATION_STEP = Math.PI / 18;
const GRINDING_ROLL_STEP = Math.PI / 14;
const GRINDING_FLIP_STEP = Math.PI;
const GRINDING_MOUSE_ROLL_SPEED = 0.0065;
const GRINDING_POINTER_FRAME_SMOOTHING = 0.34;
const MAX_GRINDING_CUTS = 240;
const DEFAULT_GRINDING_ROTATION: StoneRotation = {
  x: -0.28,
  y: 0.82,
  z: 0,
};
const EPSILON = 0.000001;
const SHAPE_PALETTE = [
  "#0f766e",
  "#118ab2",
  "#ef476f",
  "#f59e0b",
  "#6d28d9",
  "#2563eb",
  "#16a34a",
  "#db2777",
];
const SHAPE_TEXTURES: ShapeTexture[] = [
  {
    id: "lapis-lazuli",
    name: "Lapis Lazuli",
    path: "/assets/shape-textures/lapis-lazuli.png",
  },
  {
    id: "amethyst",
    name: "Amethyst",
    path: "/assets/shape-textures/amethyst.png",
  },
  {
    id: "rose-quartz",
    name: "Rose Quartz",
    path: "/assets/shape-textures/rose-quartz.png",
  },
  {
    id: "smoky-quartz",
    name: "Smoky Quartz",
    path: "/assets/shape-textures/smoky-quartz.png",
  },
  {
    id: "citrine",
    name: "Citrine",
    path: "/assets/shape-textures/citrine.png",
  },
  {
    id: "malachite",
    name: "Malachite",
    path: "/assets/shape-textures/malachite.png",
  },
  {
    id: "turquoise",
    name: "Turquoise",
    path: "/assets/shape-textures/turquoise.png",
  },
  {
    id: "obsidian",
    name: "Obsidian",
    path: "/assets/shape-textures/obsidian.png",
  },
  {
    id: "full-potch-black-opal",
    name: "Full Potch Black Opal",
    path: "/assets/shape-textures/full-potch-black-opal.png",
  },
  {
    id: "dull-half-potchy-black-opal",
    name: "Dull Half Potchy Black Opal",
    path: "/assets/shape-textures/dull-half-potchy-black-opal.png",
  },
  {
    id: "clean-polished-black-opal",
    name: "Clean Polished Black Opal",
    path: "/assets/shape-textures/clean-polished-black-opal.png",
  },
  {
    id: "jade",
    name: "Jade",
    path: "/assets/shape-textures/jade.png",
  },
  {
    id: "garnet",
    name: "Garnet",
    path: "/assets/shape-textures/garnet.png",
  },
  {
    id: "fluorite",
    name: "Fluorite",
    path: "/assets/shape-textures/fluorite.png",
  },
  {
    id: "gneiss",
    name: "Gneiss",
    path: "/assets/shape-textures/gneiss.png",
  },
  {
    id: "granite",
    name: "Granite",
    path: "/assets/shape-textures/granite.png",
  },
  {
    id: "diorite",
    name: "Diorite",
    path: "/assets/shape-textures/diorite.png",
  },
  {
    id: "feldspar",
    name: "Feldspar",
    path: "/assets/shape-textures/feldspar.png",
  },
  {
    id: "schist",
    name: "Schist",
    path: "/assets/shape-textures/schist.png",
  },
  {
    id: "basalt",
    name: "Basalt",
    path: "/assets/shape-textures/basalt.png",
  },
  {
    id: "sandstone",
    name: "Sandstone",
    path: "/assets/shape-textures/sandstone.png",
  },
  {
    id: "limestone",
    name: "Limestone",
    path: "/assets/shape-textures/limestone.png",
  },
  {
    id: "slate",
    name: "Slate",
    path: "/assets/shape-textures/slate.png",
  },
  {
    id: "quartzite",
    name: "Quartzite",
    path: "/assets/shape-textures/quartzite.png",
  },
];

const FULL_POTCH_BLACK_OPAL_TEXTURE =
  SHAPE_TEXTURES.find((texture) => texture.id === "full-potch-black-opal") ??
  SHAPE_TEXTURES[0];
const DULL_HALF_POTCHY_BLACK_OPAL_TEXTURE =
  SHAPE_TEXTURES.find(
    (texture) => texture.id === "dull-half-potchy-black-opal"
  ) ?? FULL_POTCH_BLACK_OPAL_TEXTURE;
const CLEAN_POLISHED_BLACK_OPAL_TEXTURE =
  SHAPE_TEXTURES.find(
    (texture) => texture.id === "clean-polished-black-opal"
  ) ?? DULL_HALF_POTCHY_BLACK_OPAL_TEXTURE;
const GRINDING_LAYER_TEXTURES: StoneLayerTextures = [
  FULL_POTCH_BLACK_OPAL_TEXTURE,
  DULL_HALF_POTCHY_BLACK_OPAL_TEXTURE,
  CLEAN_POLISHED_BLACK_OPAL_TEXTURE,
];
const OPAL_GRINDING_TEXTURE_IDS = new Set(
  GRINDING_LAYER_TEXTURES.map((texture) => texture.id)
);
const GRINDING_GRITS: GrindingGrit[] = [
  {
    id: "80",
    label: "80 grit",
    description: "Fast rough shaping",
    feedSpeed: 0.64,
    polishRoughness: 0.94,
    polishMetalness: 0.01,
    polishGlow: 0.04,
  },
  {
    id: "180",
    label: "180 grit",
    description: "Medium shaping",
    feedSpeed: 0.42,
    polishRoughness: 0.78,
    polishMetalness: 0.015,
    polishGlow: 0.07,
  },
  {
    id: "400",
    label: "400 grit",
    description: "Slow smoothing",
    feedSpeed: 0.25,
    polishRoughness: 0.56,
    polishMetalness: 0.025,
    polishGlow: 0.12,
  },
  {
    id: "800",
    label: "800 grit",
    description: "Fine pre-polish",
    feedSpeed: 0.15,
    polishRoughness: 0.34,
    polishMetalness: 0.035,
    polishGlow: 0.2,
  },
  {
    id: "1500",
    label: "1500 grit",
    description: "Very slow polish",
    feedSpeed: 0.08,
    polishRoughness: 0.16,
    polishMetalness: 0.05,
    polishGlow: 0.3,
  },
];
const DEFAULT_GRINDING_GRIT_ID = "180";
const GRINDING_LAYER_MATERIAL_COUNT = 3;
const GRINDING_GROUND_MATERIAL_OFFSET = GRINDING_LAYER_MATERIAL_COUNT;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function grindingGritIndexForId(gritId?: string | null) {
  const gritIndex = GRINDING_GRITS.findIndex((grit) => grit.id === gritId);

  return gritIndex >= 0 ? gritIndex : 0;
}

function grindingGroundMaterialIndex(layer: number, gritId?: string | null) {
  const safeLayer = Math.min(
    Math.max(Math.round(layer), 0),
    GRINDING_LAYER_MATERIAL_COUNT - 1
  );

  return (
    GRINDING_GROUND_MATERIAL_OFFSET +
    grindingGritIndexForId(gritId) * GRINDING_LAYER_MATERIAL_COUNT +
    safeLayer
  );
}

function grindingTextureStackForTexture(
  texture: ShapeTexture
): GrindingTextureStack {
  if (OPAL_GRINDING_TEXTURE_IDS.has(texture.id)) {
    return {
      textures: GRINDING_LAYER_TEXTURES,
      isLayered: true,
      label: "opal layer stack",
    };
  }

  return {
    textures: [texture, texture, texture],
    isLayered: false,
    label: `${texture.name} single material`,
  };
}

function normalizeAngle(value: number) {
  return Math.atan2(Math.sin(value), Math.cos(value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function mulberry32(seed: number) {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizePoint(point: Point, size: number): Point {
  return {
    x: clamp(point.x, 0, size),
    y: clamp(point.y, 0, size),
  };
}

function lineThroughSquare(
  angle: number,
  offset: number,
  size: number
): Pick<GeneratedLine, "start" | "end"> | null {
  const direction = { x: Math.cos(angle), y: Math.sin(angle) };
  const normal = { x: -Math.sin(angle), y: Math.cos(angle) };
  const center = { x: size / 2, y: size / 2 };
  const origin = {
    x: center.x + normal.x * offset,
    y: center.y + normal.y * offset,
  };

  let tMin = -Infinity;
  let tMax = Infinity;

  const applyAxis = (position: number, delta: number) => {
    if (Math.abs(delta) < EPSILON) {
      return position >= 0 && position <= size;
    }

    const t1 = (0 - position) / delta;
    const t2 = (size - position) / delta;
    const low = Math.min(t1, t2);
    const high = Math.max(t1, t2);
    tMin = Math.max(tMin, low);
    tMax = Math.min(tMax, high);

    return tMin <= tMax;
  };

  if (!applyAxis(origin.x, direction.x) || !applyAxis(origin.y, direction.y)) {
    return null;
  }

  return {
    start: normalizePoint(
      {
        x: origin.x + direction.x * tMin,
        y: origin.y + direction.y * tMin,
      },
      size
    ),
    end: normalizePoint(
      {
        x: origin.x + direction.x * tMax,
        y: origin.y + direction.y * tMax,
      },
      size
    ),
  };
}

function cross(a: Point, b: Point) {
  return a.x * b.y - a.y * b.x;
}

function subtract(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function segmentIntersection(a: GeneratedLine, b: GeneratedLine) {
  const p = a.start;
  const q = b.start;
  const r = subtract(a.end, a.start);
  const s = subtract(b.end, b.start);
  const denominator = cross(r, s);

  if (Math.abs(denominator) < EPSILON) {
    return null;
  }

  const qMinusP = subtract(q, p);
  const t = cross(qMinusP, s) / denominator;
  const u = cross(qMinusP, r) / denominator;

  if (
    t <= EPSILON ||
    t >= 1 - EPSILON ||
    u <= EPSILON ||
    u >= 1 - EPSILON
  ) {
    return null;
  }

  return {
    point: {
      x: p.x + t * r.x,
      y: p.y + t * r.y,
    },
    t,
    u,
  };
}

function createLines(lineCount: number, squareSize: number, seed: number) {
  const rng = mulberry32(seed);
  const lines: GeneratedLine[] = [];
  const maxOffset = (squareSize * Math.SQRT2) / 2;

  for (let i = 0; i < lineCount; i += 1) {
    const baseAngle = (i / Math.max(1, lineCount)) * Math.PI;
    const angleJitter = (rng() - 0.5) * (Math.PI / Math.max(3, lineCount)) * 3;
    const angle = (baseAngle + angleJitter + Math.PI) % Math.PI;
    let chosen: Pick<GeneratedLine, "start" | "end"> | null = null;

    for (let attempt = 0; attempt < 80; attempt += 1) {
      const offset = (rng() * 2 - 1) * maxOffset * 0.86;
      const candidate = lineThroughSquare(angle, offset, squareSize);

      if (!candidate) {
        continue;
      }

      if (distance(candidate.start, candidate.end) >= squareSize * 0.36) {
        chosen = candidate;
        break;
      }
    }

    if (chosen) {
      lines.push({
        id: i,
        angle,
        start: chosen.start,
        end: chosen.end,
      });
    }
  }

  return lines;
}

function addBreakpoint(
  breakpoints: Breakpoint[],
  breakpoint: Breakpoint
) {
  const duplicate = breakpoints.find(
    (item) => Math.abs(item.t - breakpoint.t) < EPSILON * 10
  );

  if (!duplicate) {
    breakpoints.push(breakpoint);
  }
}

function buildNetwork(
  lineCount: number,
  squareSize: number,
  seed: number
): GeneratedNetwork {
  const lines = createLines(lineCount, squareSize, seed);
  const nodes = new Map<string, SegmentNode>();
  const breakpointsByLine = lines.map((line) => {
    const startNodeId = `border-${line.id}-start`;
    const endNodeId = `border-${line.id}-end`;

    nodes.set(startNodeId, {
      id: startNodeId,
      kind: "border",
      point: line.start,
    });
    nodes.set(endNodeId, {
      id: endNodeId,
      kind: "border",
      point: line.end,
    });

    return [
      { t: 0, nodeId: startNodeId, point: line.start },
      { t: 1, nodeId: endNodeId, point: line.end },
    ] as Breakpoint[];
  });

  let intersectionCount = 0;

  for (let i = 0; i < lines.length; i += 1) {
    for (let j = i + 1; j < lines.length; j += 1) {
      const intersection = segmentIntersection(lines[i], lines[j]);

      if (!intersection) {
        continue;
      }

      const nodeId = `intersection-${i}-${j}`;
      const point = normalizePoint(intersection.point, squareSize);
      nodes.set(nodeId, {
        id: nodeId,
        kind: "intersection",
        point,
      });
      addBreakpoint(breakpointsByLine[i], {
        t: intersection.t,
        nodeId,
        point,
      });
      addBreakpoint(breakpointsByLine[j], {
        t: intersection.u,
        nodeId,
        point,
      });
      intersectionCount += 1;
    }
  }

  const removalRng = mulberry32(seed ^ 0xa511e9b3);
  const segments: Segment[] = [];

  lines.forEach((line, lineIndex) => {
    const orderedBreakpoints = [...breakpointsByLine[lineIndex]].sort(
      (a, b) => a.t - b.t
    );

    for (let i = 0; i < orderedBreakpoints.length - 1; i += 1) {
      const start = orderedBreakpoints[i];
      const end = orderedBreakpoints[i + 1];
      const length = distance(start.point, end.point);

      if (length < 1) {
        continue;
      }

      segments.push({
        id: `segment-${line.id}-${i}`,
        lineId: line.id,
        start: start.point,
        end: end.point,
        startNodeId: start.nodeId,
        endNodeId: end.nodeId,
        length,
        removalRank: removalRng(),
      });
    }
  });

  const nodeList: SegmentNode[] = [];
  nodes.forEach((node) => nodeList.push(node));

  return {
    lines,
    nodes: nodeList,
    segments,
    intersectionCount,
  };
}

function pointKey(point: Point) {
  return `${point.x.toFixed(3)},${point.y.toFixed(3)}`;
}

function edgeKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function polygonSignedArea(points: Point[]) {
  let area = 0;

  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }

  return area / 2;
}

function polygonPerimeter(points: Point[]) {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + distance(point, next);
  }, 0);
}

function polygonCentroid(points: Point[]): Point {
  const signedArea = polygonSignedArea(points);

  if (Math.abs(signedArea) < EPSILON) {
    const fallback = points.reduce(
      (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
      { x: 0, y: 0 }
    );

    return {
      x: fallback.x / Math.max(1, points.length),
      y: fallback.y / Math.max(1, points.length),
    };
  }

  let x = 0;
  let y = 0;

  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const factor = current.x * next.y - next.x * current.y;
    x += (current.x + next.x) * factor;
    y += (current.y + next.y) * factor;
  }

  return {
    x: x / (6 * signedArea),
    y: y / (6 * signedArea),
  };
}

function polygonBounds(points: Point[]) {
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
    }
  );
}

function pointInPolygon(point: Point, polygon: Point[]) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const current = polygon[i];
    const previous = polygon[j];
    const crossesScanline =
      (current.y > point.y) !== (previous.y > point.y);
    const intersects =
      crossesScanline &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          (previous.y - current.y + EPSILON) +
          current.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function normalizeShapeForStone(shape: ShapeRegion) {
  const boundsCenter = {
    x: (shape.bounds.minX + shape.bounds.maxX) / 2,
    y: (shape.bounds.minY + shape.bounds.maxY) / 2,
  };
  const centerCandidates = [shape.centroid, boundsCenter];
  const center =
    centerCandidates.find((candidate) => pointInPolygon(candidate, shape.points)) ??
    boundsCenter;
  const scale =
    shape.points.reduce(
      (maxExtent, point) =>
        Math.max(
          maxExtent,
          Math.abs(point.x - center.x),
          Math.abs(point.y - center.y)
        ),
      1
    ) / 0.96;

  return shape.points.map((point) => ({
    x: clamp((point.x - center.x) / scale, -1, 1),
    y: clamp((point.y - center.y) / scale, -1, 1),
  }));
}

function stoneProjectionPoint(
  point: Point,
  index: number,
  axis: ProjectionAxis,
  shapeId: string,
  seed: number
) {
  const jitterA = randomUnitFromKey(`${seed}-${shapeId}-${axis}-${index}-a`) - 0.5;
  const jitterB = randomUnitFromKey(`${seed}-${shapeId}-${axis}-${index}-b`) - 0.5;
  const waveA = Math.sin(point.x * 4.3 + point.y * 2.1 + seed * 0.0003);
  const waveB = Math.cos(point.y * 3.7 - point.x * 1.9 + seed * 0.0002);
  let x = point.x;
  let y = point.y;

  if (axis === "xz") {
    x = point.x * (0.9 + jitterA * 0.12) + waveB * 0.035;
    y = point.y * (0.68 + jitterB * 0.16) + waveA * 0.11;
  } else if (axis === "yz") {
    x = point.y * (0.88 + jitterA * 0.12) + waveA * 0.035;
    y = point.x * (0.72 + jitterB * 0.16) + waveB * 0.1;
  } else {
    x = point.x * (0.94 + jitterA * 0.08) + waveA * 0.025;
    y = point.y * (0.94 + jitterB * 0.08) + waveB * 0.025;
  }

  return {
    x: clamp(x, -0.98, 0.98),
    y: clamp(y, -0.98, 0.98),
  };
}

function buildStoneProjections(shape: ShapeRegion, seed: number): StoneProjectionSet {
  const normalized = normalizeShapeForStone(shape);

  return {
    xy: normalized.map((point, index) =>
      stoneProjectionPoint(point, index, "xy", shape.id, seed)
    ),
    xz: normalized.map((point, index) =>
      stoneProjectionPoint(point, index, "xz", shape.id, seed)
    ),
    yz: normalized.map((point, index) =>
      stoneProjectionPoint(point, index, "yz", shape.id, seed)
    ),
  };
}

function projectionPath(points: Point[]) {
  return points
    .map((point, index) => {
      const x = 50 + point.x * 42;
      const y = 50 + point.y * 42;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ")
    .concat(" Z");
}

function smoothNoiseFade(value: number) {
  return value * value * value * (value * (value * 6 - 15) + 10);
}

function interpolate(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function smoothValueNoise3D(
  x: number,
  y: number,
  z: number,
  seed: number,
  key: string
) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const tx = smoothNoiseFade(x - x0);
  const ty = smoothNoiseFade(y - y0);
  const tz = smoothNoiseFade(z - z0);
  const sample = (ix: number, iy: number, iz: number) =>
    randomUnitFromKey(`${seed}-${key}-${ix}-${iy}-${iz}`);

  const c000 = sample(x0, y0, z0);
  const c100 = sample(x0 + 1, y0, z0);
  const c010 = sample(x0, y0 + 1, z0);
  const c110 = sample(x0 + 1, y0 + 1, z0);
  const c001 = sample(x0, y0, z0 + 1);
  const c101 = sample(x0 + 1, y0, z0 + 1);
  const c011 = sample(x0, y0 + 1, z0 + 1);
  const c111 = sample(x0 + 1, y0 + 1, z0 + 1);
  const x00 = interpolate(c000, c100, tx);
  const x10 = interpolate(c010, c110, tx);
  const x01 = interpolate(c001, c101, tx);
  const x11 = interpolate(c011, c111, tx);
  const y0Value = interpolate(x00, x10, ty);
  const y1Value = interpolate(x01, x11, ty);

  return interpolate(y0Value, y1Value, tz);
}

function gentleDepthNoise(
  point: THREE.Vector3,
  seed: number,
  shapeId: string,
  layer: number
) {
  const base = smoothValueNoise3D(
    point.x * 1.7 + 8.3,
    point.y * 1.7 - 2.1,
    point.z * 1.7 + 4.9,
    seed,
    `${shapeId}-layer-${layer}-base`
  );
  const detail = smoothValueNoise3D(
    point.x * 3.1 - 1.4,
    point.y * 3.1 + 6.7,
    point.z * 3.1 - 9.2,
    seed,
    `${shapeId}-layer-${layer}-detail`
  );

  return clamp(base * 0.72 + detail * 0.28, 0, 1);
}

function grindingLayerBreaks(
  point: THREE.Vector3,
  seed: number,
  shapeId: string,
  distanceToCenter: number
) {
  const availableDepth = Math.max(0.08, distanceToCenter * 0.92);
  const outerNoise = gentleDepthNoise(point, seed, shapeId, 0);
  const middleNoise = gentleDepthNoise(point, seed, shapeId, 1);
  const outerDepth = availableDepth * (0.18 + outerNoise * 0.18);
  const requestedMiddleDepth = availableDepth * (0.24 + middleNoise * 0.2);
  const middleDepth = Math.min(
    requestedMiddleDepth,
    Math.max(0.04, availableDepth * 0.82 - outerDepth)
  );

  return {
    firstBreak: outerDepth,
    secondBreak: outerDepth + middleDepth,
  };
}

function materialLayerForDepth(
  point: THREE.Vector3,
  seed: number,
  shapeId: string,
  distanceToCenter: number,
  grindDepth: number
) {
  if (grindDepth <= EPSILON) {
    return 0;
  }

  const { firstBreak, secondBreak } = grindingLayerBreaks(
    point,
    seed,
    shapeId,
    distanceToCenter
  );

  if (grindDepth <= firstBreak) {
    return 0;
  }

  return grindDepth <= secondBreak ? 1 : 2;
}

function grindingRotationMatrix(rotation: StoneRotation) {
  return new THREE.Matrix4().makeRotationFromEuler(
    new THREE.Euler(rotation.x, rotation.y, rotation.z, "XYZ")
  );
}

function grindingCutFromRotation(
  rotation: StoneRotation,
  feed: number,
  gritId = DEFAULT_GRINDING_GRIT_ID
): GrindingCut {
  const matrix = grindingRotationMatrix(rotation);
  const elements = matrix.elements;
  const normal = new THREE.Vector3(elements[1], elements[5], elements[9])
    .normalize();

  return {
    normal: {
      x: normal.x,
      y: normal.y,
      z: normal.z,
    },
    offset: GRINDING_CUT_Y - feed,
    gritId,
  };
}

function prepareGrindingCuts(cuts: GrindingCut[]): PreparedGrindingCut[] {
  return cuts.map((cut) => ({
    normal: new THREE.Vector3(
      cut.normal.x,
      cut.normal.y,
      cut.normal.z
    ).normalize(),
    offset: cut.offset,
    gritId: cut.gritId ?? DEFAULT_GRINDING_GRIT_ID,
  }));
}

function mergeGrindingCut(cuts: GrindingCut[], nextCut: GrindingCut) {
  const nextNormal = new THREE.Vector3(
    nextCut.normal.x,
    nextCut.normal.y,
    nextCut.normal.z
  );
  const existingIndex = cuts.findIndex((cut) => {
    const cutNormal = new THREE.Vector3(
      cut.normal.x,
      cut.normal.y,
      cut.normal.z
    );

    return cutNormal.dot(nextNormal) > 0.992;
  });

  if (existingIndex >= 0) {
    const merged = [...cuts];
    const existingCut = merged[existingIndex];

    if (nextCut.offset < existingCut.offset) {
      merged[existingIndex] = nextCut;
    }

    return merged;
  }

  return [...cuts, nextCut].slice(-MAX_GRINDING_CUTS);
}

function applyGrindingCuts(point: THREE.Vector3, cuts: PreparedGrindingCut[]) {
  const nextPoint = point.clone();
  let grindDepth = 0;
  let gritId: string | null = null;

  cuts.forEach((cut) => {
    const distancePastCut = nextPoint.dot(cut.normal) - cut.offset;

    if (distancePastCut > 0) {
      nextPoint.addScaledVector(cut.normal, -distancePastCut);
      grindDepth += distancePastCut;
      gritId = cut.gritId;
    }
  });

  return {
    point: nextPoint,
    grindDepth,
    gritId,
  };
}

function estimateGrindingContactFeed(
  projections: StoneProjectionSet,
  seed: number,
  shapeId: string,
  rotation: StoneRotation,
  cuts: GrindingCut[],
  latitudeSteps = Math.max(10, STONE_LATITUDE_STEPS - 4),
  longitudeSteps = Math.max(18, STONE_LONGITUDE_STEPS - 4)
) {
  const normalCut = grindingCutFromRotation(rotation, 0);
  const normal = new THREE.Vector3(
    normalCut.normal.x,
    normalCut.normal.y,
    normalCut.normal.z
  ).normalize();
  const preparedCuts = prepareGrindingCuts(cuts);
  let maxSurfaceDot = -Infinity;
  const isInsideProjectionVolume = (x: number, y: number, z: number) =>
    pointInPolygon({ x, y }, projections.xy) &&
    pointInPolygon({ x, y: z }, projections.xz) &&
    pointInPolygon({ x: y, y: z }, projections.yz);

  const radiusForDirection = (x: number, y: number, z: number) => {
    let low = 0;
    let high = 1.42;

    for (let step = 0; step < STONE_RADIUS_SEARCH_STEPS; step += 1) {
      const middle = (low + high) / 2;

      if (isInsideProjectionVolume(x * middle, y * middle, z * middle)) {
        low = middle;
      } else {
        high = middle;
      }
    }

    return low;
  };

  for (let latIndex = 0; latIndex <= latitudeSteps; latIndex += 1) {
    const v = latIndex / latitudeSteps;
    const phi = -Math.PI / 2 + v * Math.PI;
    const ringRadius = Math.cos(phi);
    const zDirection = Math.sin(phi);

    for (let lonIndex = 0; lonIndex <= longitudeSteps; lonIndex += 1) {
      const u = lonIndex / longitudeSteps;
      const theta = u * Math.PI * 2;
      const xDirection = ringRadius * Math.cos(theta);
      const yDirection = ringRadius * Math.sin(theta);
      const baseRadius = radiusForDirection(
        xDirection,
        yDirection,
        zDirection
      );
      const surfaceNoise =
        randomUnitFromKey(`${seed}-${shapeId}-stone-${latIndex}-${lonIndex}`) *
        0.12;
      const ripple =
        Math.sin(theta * 3 + seed * 0.00007) *
        Math.cos(phi * 4 + seed * 0.00011) *
        0.035;
      const radius = Math.max(0.02, baseRadius * (0.86 + surfaceNoise + ripple));
      const localPoint = new THREE.Vector3(
        xDirection * radius,
        yDirection * radius,
        zDirection * radius
      );
      const groundPoint = applyGrindingCuts(localPoint, preparedCuts);

      maxSurfaceDot = Math.max(maxSurfaceDot, groundPoint.point.dot(normal));
    }
  }

  if (!Number.isFinite(maxSurfaceDot)) {
    return GRINDING_FEED_HOME;
  }

  return clamp(
    GRINDING_CUT_Y - maxSurfaceDot,
    GRINDING_FEED_MIN,
    GRINDING_FEED_MAX
  );
}

function rollRotationFromScreenVector(
  rotation: StoneRotation,
  deltaX: number,
  deltaY: number
): StoneRotation {
  const distancePixels = Math.hypot(deltaX, deltaY);

  if (distancePixels < 0.5) {
    return rotation;
  }

  const axis = new THREE.Vector3(deltaY, deltaX, 0).normalize();
  const deltaQuaternion = new THREE.Quaternion().setFromAxisAngle(
    axis,
    distancePixels * GRINDING_MOUSE_ROLL_SPEED
  );
  const currentQuaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(rotation.x, rotation.y, rotation.z, "XYZ")
  );
  const nextEuler = new THREE.Euler().setFromQuaternion(
    deltaQuaternion.multiply(currentQuaternion),
    "XYZ"
  );

  return {
    x: normalizeAngle(nextEuler.x),
    y: normalizeAngle(nextEuler.y),
    z: normalizeAngle(nextEuler.z),
  };
}

function buildStoneGeometry(
  projections: StoneProjectionSet,
  seed: number,
  shapeId: string,
  latitudeSteps = STONE_LATITUDE_STEPS,
  longitudeSteps = STONE_LONGITUDE_STEPS
): StoneGeometryModel {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const isInsideProjectionVolume = (x: number, y: number, z: number) =>
    pointInPolygon({ x, y }, projections.xy) &&
    pointInPolygon({ x, y: z }, projections.xz) &&
    pointInPolygon({ x: y, y: z }, projections.yz);

  const radiusForDirection = (x: number, y: number, z: number) => {
    let low = 0;
    let high = 1.42;

    for (let step = 0; step < STONE_RADIUS_SEARCH_STEPS; step += 1) {
      const middle = (low + high) / 2;

      if (isInsideProjectionVolume(x * middle, y * middle, z * middle)) {
        low = middle;
      } else {
        high = middle;
      }
    }

    return low;
  };

  for (let latIndex = 0; latIndex <= latitudeSteps; latIndex += 1) {
    const v = latIndex / latitudeSteps;
    const phi = -Math.PI / 2 + v * Math.PI;
    const ringRadius = Math.cos(phi);
    const zDirection = Math.sin(phi);

    for (let lonIndex = 0; lonIndex <= longitudeSteps; lonIndex += 1) {
      const u = lonIndex / longitudeSteps;
      const theta = u * Math.PI * 2;
      const xDirection = ringRadius * Math.cos(theta);
      const yDirection = ringRadius * Math.sin(theta);
      const baseRadius = radiusForDirection(
        xDirection,
        yDirection,
        zDirection
      );
      const surfaceNoise =
        randomUnitFromKey(`${seed}-${shapeId}-stone-${latIndex}-${lonIndex}`) *
        0.12;
      const ripple =
        Math.sin(theta * 3 + seed * 0.00007) *
        Math.cos(phi * 4 + seed * 0.00011) *
        0.035;
      const radius = Math.max(0.02, baseRadius * (0.86 + surfaceNoise + ripple));

      positions.push(
        xDirection * radius,
        yDirection * radius,
        zDirection * radius
      );
      uvs.push(u, 1 - v);
    }
  }

  const ringVertexCount = longitudeSteps + 1;

  for (let latIndex = 0; latIndex < latitudeSteps; latIndex += 1) {
    for (let lonIndex = 0; lonIndex < longitudeSteps; lonIndex += 1) {
      const topLeft = latIndex * ringVertexCount + lonIndex;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + ringVertexCount;
      const bottomRight = bottomLeft + 1;

      indices.push(topLeft, bottomLeft, bottomRight);
      indices.push(topLeft, bottomRight, topRight);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return { geometry, vertexCount: positions.length / 3 };
}

function buildGrindingStoneGeometry(
  projections: StoneProjectionSet,
  seed: number,
  shapeId: string,
  cuts: GrindingCut[],
  useLayeredDepths = true,
  latitudeSteps = STONE_LATITUDE_STEPS + 8,
  longitudeSteps = STONE_LONGITUDE_STEPS + 12
): GrindingStoneGeometryModel {
  const positions: number[] = [];
  const uvs: number[] = [];
  const vertexLayers: number[] = [];
  const vertexGroundDepths: number[] = [];
  const vertexGroundGritIds: Array<string | null> = [];
  const groupedIndices: number[][] = Array.from(
    {
      length:
        GRINDING_GROUND_MATERIAL_OFFSET +
        GRINDING_GRITS.length * GRINDING_LAYER_MATERIAL_COUNT,
    },
    () => []
  );
  const layerFaceCounts: [number, number, number] = [0, 0, 0];
  const preparedCuts = prepareGrindingCuts(cuts);
  let remainingSurfaceVertexCount = 0;
  const isInsideProjectionVolume = (x: number, y: number, z: number) =>
    pointInPolygon({ x, y }, projections.xy) &&
    pointInPolygon({ x, y: z }, projections.xz) &&
    pointInPolygon({ x: y, y: z }, projections.yz);

  const radiusForDirection = (x: number, y: number, z: number) => {
    let low = 0;
    let high = 1.42;

    for (let step = 0; step < STONE_RADIUS_SEARCH_STEPS; step += 1) {
      const middle = (low + high) / 2;

      if (isInsideProjectionVolume(x * middle, y * middle, z * middle)) {
        low = middle;
      } else {
        high = middle;
      }
    }

    return low;
  };

  for (let latIndex = 0; latIndex <= latitudeSteps; latIndex += 1) {
    const v = latIndex / latitudeSteps;
    const phi = -Math.PI / 2 + v * Math.PI;
    const ringRadius = Math.cos(phi);
    const zDirection = Math.sin(phi);

    for (let lonIndex = 0; lonIndex <= longitudeSteps; lonIndex += 1) {
      const u = lonIndex / longitudeSteps;
      const theta = u * Math.PI * 2;
      const xDirection = ringRadius * Math.cos(theta);
      const yDirection = ringRadius * Math.sin(theta);
      const baseRadius = radiusForDirection(
        xDirection,
        yDirection,
        zDirection
      );
      const surfaceNoise =
        randomUnitFromKey(`${seed}-${shapeId}-stone-${latIndex}-${lonIndex}`) *
        0.12;
      const ripple =
        Math.sin(theta * 3 + seed * 0.00007) *
        Math.cos(phi * 4 + seed * 0.00011) *
        0.035;
      const radius = Math.max(0.02, baseRadius * (0.86 + surfaceNoise + ripple));
      const localPoint = new THREE.Vector3(
        xDirection * radius,
        yDirection * radius,
        zDirection * radius
      );

      if (
        preparedCuts.length === 0 ||
        preparedCuts.every(
          (cut) => localPoint.dot(cut.normal) <= cut.offset + EPSILON
        )
      ) {
        remainingSurfaceVertexCount += 1;
      }

      const groundPoint = applyGrindingCuts(localPoint, preparedCuts);
      const layer = useLayeredDepths
        ? materialLayerForDepth(
            localPoint,
            seed,
            shapeId,
            localPoint.length(),
            groundPoint.grindDepth
          )
        : 0;

      positions.push(
        groundPoint.point.x,
        groundPoint.point.y,
        groundPoint.point.z
      );
      uvs.push(u, 1 - v);
      vertexLayers.push(layer);
      vertexGroundDepths.push(groundPoint.grindDepth);
      vertexGroundGritIds.push(groundPoint.gritId);
    }
  }

  const ringVertexCount = longitudeSteps + 1;

  if (preparedCuts.length > 0 && remainingSurfaceVertexCount === 0) {
    return {
      geometry: new THREE.BufferGeometry(),
      vertexCount: 0,
      groundRatio: 1,
      exposedRatio: useLayeredDepths ? 1 : 0,
      deepestLayer: useLayeredDepths ? 2 : 0,
      layerFaceCounts,
    };
  }

  const groundGritForFace = (vertexIndices: [number, number, number]) => {
    let deepestDepth = 0;
    let gritId: string | null = null;

    vertexIndices.forEach((vertexIndex) => {
      const depth = vertexGroundDepths[vertexIndex];

      if (depth > deepestDepth) {
        deepestDepth = depth;
        gritId = vertexGroundGritIds[vertexIndex];
      }
    });

    return gritId;
  };

  for (let latIndex = 0; latIndex < latitudeSteps; latIndex += 1) {
    for (let lonIndex = 0; lonIndex < longitudeSteps; lonIndex += 1) {
      const topLeft = latIndex * ringVertexCount + lonIndex;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + ringVertexCount;
      const bottomRight = bottomLeft + 1;
      const firstLayer = Math.max(
        vertexLayers[topLeft],
        vertexLayers[bottomLeft],
        vertexLayers[bottomRight]
      );
      const secondLayer = Math.max(
        vertexLayers[topLeft],
        vertexLayers[bottomRight],
        vertexLayers[topRight]
      );
      const firstGroundDepth = Math.max(
        vertexGroundDepths[topLeft],
        vertexGroundDepths[bottomLeft],
        vertexGroundDepths[bottomRight]
      );
      const secondGroundDepth = Math.max(
        vertexGroundDepths[topLeft],
        vertexGroundDepths[bottomRight],
        vertexGroundDepths[topRight]
      );
      const firstGroundGritId = groundGritForFace([
        topLeft,
        bottomLeft,
        bottomRight,
      ]);
      const secondGroundGritId = groundGritForFace([
        topLeft,
        bottomRight,
        topRight,
      ]);
      const firstMaterialIndex =
        firstGroundDepth > EPSILON
          ? grindingGroundMaterialIndex(firstLayer, firstGroundGritId)
          : firstLayer;
      const secondMaterialIndex =
        secondGroundDepth > EPSILON
          ? grindingGroundMaterialIndex(secondLayer, secondGroundGritId)
          : secondLayer;

      groupedIndices[firstMaterialIndex].push(topLeft, bottomLeft, bottomRight);
      groupedIndices[secondMaterialIndex].push(topLeft, bottomRight, topRight);
      layerFaceCounts[firstLayer] += 1;
      layerFaceCounts[secondLayer] += 1;
    }
  }

  const indices: number[] = [];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));

  groupedIndices.forEach((layerIndices, layerIndex) => {
    if (layerIndices.length === 0) {
      return;
    }

    const start = indices.length;
    indices.push(...layerIndices);
    geometry.addGroup(start, layerIndices.length, layerIndex);
  });

  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const groundVertices = vertexGroundDepths.filter((depth) => depth > EPSILON)
    .length;
  const exposedVertices = vertexLayers.filter((layer) => layer > 0).length;

  return {
    geometry,
    vertexCount: positions.length / 3,
    groundRatio: groundVertices / Math.max(1, vertexGroundDepths.length),
    exposedRatio: exposedVertices / Math.max(1, vertexLayers.length),
    deepestLayer: Math.max(...vertexLayers),
    layerFaceCounts,
  };
}

function unitVector(from: Point, to: Point): Point {
  const length = distance(from, to);

  if (length < EPSILON) {
    return { x: 0, y: 0 };
  }

  return {
    x: (to.x - from.x) / length,
    y: (to.y - from.y) / length,
  };
}

function randomUnitFromKey(key: string) {
  let hash = 2166136261;

  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}

function randomizedRoundnessForPoint(point: Point, baseRoundness: number, seed: number) {
  const unit = randomUnitFromKey(`${seed}-${pointKey(point)}`);
  return baseRoundness * (0.45 + unit * 1.35);
}

function getConcaveRoundedPath(
  points: Point[],
  roundness: number,
  resolveRoundness?: RoundnessResolver
) {
  if (points.length === 0) {
    return "";
  }

  if (points.length < 3 || roundness <= 0) {
    return points
      .map((point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
      )
      .join(" ")
      .concat(" Z");
  }

  const roundedPoints = points.map((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const cornerRoundness = Math.max(
      0,
      resolveRoundness?.(point, index) ?? roundness
    );
    const trim = Math.min(
      cornerRoundness,
      distance(previous, point) * 0.42,
      distance(point, next) * 0.42
    );
    const towardPrevious = unitVector(point, previous);
    const towardNext = unitVector(point, next);
    const start = {
      x: point.x + towardPrevious.x * trim,
      y: point.y + towardPrevious.y * trim,
    };
    const end = {
      x: point.x + towardNext.x * trim,
      y: point.y + towardNext.y * trim,
    };

    return { start, end, control: point };
  });

  const first = roundedPoints[0];
  const commands = [`M ${first.end.x.toFixed(2)} ${first.end.y.toFixed(2)}`];

  roundedPoints.slice(1).forEach((corner) => {
    commands.push(`L ${corner.start.x.toFixed(2)} ${corner.start.y.toFixed(2)}`);
    commands.push(
      `Q ${corner.control.x.toFixed(2)} ${corner.control.y.toFixed(
        2
      )} ${corner.end.x.toFixed(2)} ${corner.end.y.toFixed(2)}`
    );
  });

  commands.push(`L ${first.start.x.toFixed(2)} ${first.start.y.toFixed(2)}`);
  commands.push(
    `Q ${first.control.x.toFixed(2)} ${first.control.y.toFixed(
      2
    )} ${first.end.x.toFixed(2)} ${first.end.y.toFixed(2)}`
  );
  commands.push("Z");
  return commands.join(" ");
}

function getShapePath(
  shape: ShapeRegion,
  roundness: number,
  randomizeRoundness: boolean,
  seed: number
) {
  return getConcaveRoundedPath(
    shape.points,
    roundness,
    randomizeRoundness
      ? (point) => randomizedRoundnessForPoint(point, roundness, seed)
      : undefined
  );
}

function getBoundaryMembership(point: Point, squareSize: number) {
  const tolerance = 0.01;
  const sides: Array<{
    side: "top" | "right" | "bottom" | "left";
    offset: number;
  }> = [];

  if (Math.abs(point.y) <= tolerance) {
    sides.push({ side: "top", offset: point.x });
  }
  if (Math.abs(point.x - squareSize) <= tolerance) {
    sides.push({ side: "right", offset: point.y });
  }
  if (Math.abs(point.y - squareSize) <= tolerance) {
    sides.push({ side: "bottom", offset: point.x });
  }
  if (Math.abs(point.x) <= tolerance) {
    sides.push({ side: "left", offset: point.y });
  }

  return sides;
}

function getBridgeEdgeIds(nodeIds: string[], edges: GraphEdge[]) {
  const adjacency: Record<string, GraphEdge[]> = {};
  const discoveredAt: Record<string, number> = {};
  const lowLink: Record<string, number> = {};
  const bridgeIds = new Set<string>();
  let time = 0;

  nodeIds.forEach((id) => {
    adjacency[id] = [];
  });
  edges.forEach((edge) => {
    adjacency[edge.from]?.push(edge);
    adjacency[edge.to]?.push(edge);
  });

  const visit = (nodeId: string, parentEdgeId: string | null) => {
    time += 1;
    discoveredAt[nodeId] = time;
    lowLink[nodeId] = time;

    (adjacency[nodeId] ?? []).forEach((edge) => {
      if (edge.id === parentEdgeId) {
        return;
      }

      const nextNodeId = edge.from === nodeId ? edge.to : edge.from;

      if (!discoveredAt[nextNodeId]) {
        visit(nextNodeId, edge.id);
        lowLink[nodeId] = Math.min(lowLink[nodeId], lowLink[nextNodeId]);

        if (lowLink[nextNodeId] > discoveredAt[nodeId]) {
          bridgeIds.add(edge.id);
        }
      } else {
        lowLink[nodeId] = Math.min(lowLink[nodeId], discoveredAt[nextNodeId]);
      }
    });
  };

  nodeIds.forEach((id) => {
    if (!discoveredAt[id]) {
      visit(id, null);
    }
  });

  return bridgeIds;
}

function traceFaces(nodesById: Map<string, GraphNode>, edges: GraphEdge[]) {
  const adjacency: Record<string, string[]> = {};
  const visited = new Set<string>();
  const faces: Point[][] = [];

  nodesById.forEach((node) => {
    adjacency[node.id] = [];
  });
  edges.forEach((edge) => {
    adjacency[edge.from]?.push(edge.to);
    adjacency[edge.to]?.push(edge.from);
  });
  nodesById.forEach((node) => {
    adjacency[node.id].sort((a, b) => {
      const pointA = nodesById.get(a)!.point;
      const pointB = nodesById.get(b)!.point;
      const angleA = Math.atan2(pointA.y - node.point.y, pointA.x - node.point.x);
      const angleB = Math.atan2(pointB.y - node.point.y, pointB.x - node.point.x);
      return angleA - angleB;
    });
  });

  const markKey = (from: string, to: string) => `${from}->${to}`;
  const maxSteps = edges.length * 4 + 12;

  edges.forEach((edge) => {
    [
      [edge.from, edge.to],
      [edge.to, edge.from],
    ].forEach(([startFrom, startTo]) => {
      if (visited.has(markKey(startFrom, startTo))) {
        return;
      }

      const faceNodeIds: string[] = [];
      let from = startFrom;
      let to = startTo;
      let closed = false;

      for (let step = 0; step < maxSteps; step += 1) {
        visited.add(markKey(from, to));
        faceNodeIds.push(from);

        const neighbors = adjacency[to] ?? [];
        const incomingIndex = neighbors.indexOf(from);

        if (incomingIndex < 0 || neighbors.length === 0) {
          break;
        }

        const nextIndex =
          (incomingIndex - 1 + neighbors.length) % neighbors.length;
        const next = neighbors[nextIndex];

        from = to;
        to = next;

        if (from === startFrom && to === startTo) {
          closed = true;
          break;
        }
      }

      if (!closed || faceNodeIds.length < 3) {
        return;
      }

      const points = faceNodeIds.map((id) => nodesById.get(id)!.point);
      const area = polygonSignedArea(points);

      if (area > 1) {
        faces.push(points);
      }
    });
  });

  return faces;
}

function buildShapeRegions(
  network: GeneratedNetwork,
  keptSegments: Segment[],
  squareSize: number
): ShapeRegion[] {
  const sourceNodesById = new Map<string, SegmentNode>();
  const nodesByPointKey = new Map<string, GraphNode>();
  const nodesById = new Map<string, GraphNode>();
  const graphNodes: GraphNode[] = [];
  const graphEdges: GraphEdge[] = [];
  const graphEdgeKeys = new Set<string>();

  network.nodes.forEach((node) => {
    sourceNodesById.set(node.id, node);
  });

  const addNode = (point: Point, kind: GraphNode["kind"]) => {
    const key = pointKey(point);
    let node = nodesByPointKey.get(key);

    if (!node) {
      node = {
        id: `node-${graphNodes.length}`,
        point,
        kind,
      };
      nodesByPointKey.set(key, node);
      nodesById.set(node.id, node);
      graphNodes.push(node);
    }

    return node.id;
  };

  const addEdge = (
    from: string,
    to: string,
    kind: GraphEdge["kind"],
    preferredId?: string
  ) => {
    if (from === to) {
      return;
    }

    const key = edgeKey(from, to);

    if (graphEdgeKeys.has(key)) {
      return;
    }

    graphEdgeKeys.add(key);
    graphEdges.push({
      id: preferredId ?? `${kind}-${graphEdges.length}`,
      from,
      to,
      kind,
    });
  };

  addNode({ x: 0, y: 0 }, "corner");
  addNode({ x: squareSize, y: 0 }, "corner");
  addNode({ x: squareSize, y: squareSize }, "corner");
  addNode({ x: 0, y: squareSize }, "corner");

  keptSegments.forEach((segment) => {
    const sourceStart = sourceNodesById.get(segment.startNodeId);
    const sourceEnd = sourceNodesById.get(segment.endNodeId);
    const startNodeId = addNode(
      segment.start,
      sourceStart?.kind ?? "intersection"
    );
    const endNodeId = addNode(segment.end, sourceEnd?.kind ?? "intersection");

    addEdge(startNodeId, endNodeId, "segment", segment.id);
  });

  const boundaryNodes: Record<
    "top" | "right" | "bottom" | "left",
    Array<{ id: string; offset: number }>
  > = {
    top: [],
    right: [],
    bottom: [],
    left: [],
  };

  graphNodes.forEach((node) => {
    getBoundaryMembership(node.point, squareSize).forEach((membership) => {
      boundaryNodes[membership.side].push({
        id: node.id,
        offset: membership.offset,
      });
    });
  });

  Object.entries(boundaryNodes).forEach(([side, sideNodes]) => {
    sideNodes
      .sort((a, b) => a.offset - b.offset)
      .forEach((node, index, orderedNodes) => {
        if (index === orderedNodes.length - 1) {
          return;
        }

        addEdge(
          node.id,
          orderedNodes[index + 1].id,
          "boundary",
          `boundary-${side}-${index}`
        );
      });
  });

  const bridgeIds = getBridgeEdgeIds(
    graphNodes.map((node) => node.id),
    graphEdges
  );
  const faceEdges = graphEdges.filter(
    (edge) => edge.kind === "boundary" || !bridgeIds.has(edge.id)
  );

  return traceFaces(nodesById, faceEdges)
    .map((points) => {
      const area = Math.abs(polygonSignedArea(points));
      return {
        points,
        area,
        perimeter: polygonPerimeter(points),
        centroid: polygonCentroid(points),
        bounds: polygonBounds(points),
      };
    })
    .filter((shape) => shape.area > Math.max(24, squareSize * 0.02))
    .sort((a, b) => a.centroid.y - b.centroid.y || a.centroid.x - b.centroid.x)
    .map((shape, index) => ({
      id: `shape-${index + 1}`,
      label: `Shape ${index + 1}`,
      points: shape.points,
      area: shape.area,
      perimeter: shape.perimeter,
      centroid: shape.centroid,
      bounds: shape.bounds,
      color: SHAPE_PALETTE[index % SHAPE_PALETTE.length],
      texture: SHAPE_TEXTURES[index % SHAPE_TEXTURES.length],
    }));
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString();
}

function shapeViewBox(shape: ShapeRegion, padding: number) {
  const width = Math.max(1, shape.bounds.maxX - shape.bounds.minX);
  const height = Math.max(1, shape.bounds.maxY - shape.bounds.minY);

  return `${shape.bounds.minX - padding} ${shape.bounds.minY - padding} ${
    width + padding * 2
  } ${height + padding * 2}`;
}

function escapeSvgAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function resolveSvgAssetHref(path: string) {
  if (/^(?:blob:|data:|https?:\/\/)/.test(path)) {
    return path;
  }

  if (typeof window === "undefined") {
    return path;
  }

  return new URL(path, window.location.origin).toString();
}

function blobToDataUri(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Texture could not be converted for SVG export."));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function getTextureHrefForDownload(path: string) {
  if (/^(?:blob:|data:)/.test(path)) {
    return path;
  }

  const response = await fetch(resolveSvgAssetHref(path));

  if (!response.ok) {
    throw new Error(`Texture request failed with ${response.status}.`);
  }

  return blobToDataUri(await response.blob());
}

async function getTextureHrefsForDownload(textures: ShapeTexture[]) {
  const uniqueTextures = Array.from(
    new Map(textures.map((texture) => [texture.id, texture])).values()
  );
  const entries = await Promise.all(
    uniqueTextures.map(async (texture) => [
      texture.id,
      await getTextureHrefForDownload(texture.path),
    ])
  );

  return Object.fromEntries(entries) as Record<string, string>;
}

function getDownloadTexturePatternId(texture: ShapeTexture) {
  return `shape-texture-${texture.id}`;
}

function createSvgDocument({
  shapes,
  squareSize,
  roundness,
  strokeWidth,
  randomizeRoundness,
  seed,
  title,
  targetShape,
  textureByShapeId,
  textureHrefs,
}: {
  shapes: ShapeRegion[];
  squareSize: number;
  roundness: number;
  strokeWidth: number;
  randomizeRoundness: boolean;
  seed: number;
  title: string;
  targetShape?: ShapeRegion;
  textureByShapeId?: Record<string, ShapeTexture>;
  textureHrefs?: Record<string, string>;
}) {
  const activeShapes = targetShape ? [targetShape] : shapes;
  const padding = Math.max(16, roundness + strokeWidth + 8);
  const viewBox = targetShape
    ? shapeViewBox(targetShape, padding)
    : `0 0 ${squareSize} ${squareSize}`;
  const innerShadowId = "shape-inner-shadow";
  const background = targetShape
    ? ""
    : `<rect x="0" y="0" width="${squareSize}" height="${squareSize}" rx="12" fill="#f8fbfc" />`;
  const activeShapeTextures = activeShapes.map(
    (shape) => textureByShapeId?.[shape.id] ?? shape.texture
  );
  const uniqueTextures = Array.from(
    new Map(
      activeShapeTextures.map((texture) => [texture.id, texture] as const)
    ).values()
  );
  const patterns = uniqueTextures
    .map((texture) => {
      const textureSource = escapeSvgAttribute(
        textureHrefs?.[texture.id] ?? resolveSvgAssetHref(texture.path)
      );

      return `<pattern id="${getDownloadTexturePatternId(
        texture
      )}" patternUnits="objectBoundingBox" patternContentUnits="objectBoundingBox" x="0" y="0" width="1" height="1"><image href="${textureSource}" xlink:href="${textureSource}" x="0" y="0" width="1" height="1" preserveAspectRatio="xMidYMid slice" /></pattern>`;
    })
    .join("");
  const defs = `<defs>${patterns}<filter id="${innerShadowId}" x="-35%" y="-35%" width="170%" height="170%"><feOffset dx="0" dy="3" /><feGaussianBlur stdDeviation="4" result="offset-blur" /><feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" /><feFlood flood-color="#020617" flood-opacity="0.4" result="shadow-color" /><feComposite operator="in" in="shadow-color" in2="inverse" result="inner-shadow" /><feComposite operator="over" in="inner-shadow" in2="SourceGraphic" /></filter></defs>`;
  const paths = activeShapes
    .map(
      (shape) => {
        const texture = textureByShapeId?.[shape.id] ?? shape.texture;

        return `<path d="${getShapePath(
          shape,
          roundness,
          randomizeRoundness,
          seed
        )}" fill="url(#${getDownloadTexturePatternId(
          texture
        )})" stroke="#0f172a" stroke-opacity="0.28" stroke-width="${strokeWidth}" stroke-linejoin="round" filter="url(#${innerShadowId})" />`
      }
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${viewBox}" role="img" aria-label="${escapeSvgAttribute(
    title
  )}">${defs}${background}${paths}</svg>`;
}

function downloadTextFile(fileName: string, source: string, type: string) {
  const blob = new Blob([source], {
    type,
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadSvgFile(fileName: string, source: string) {
  downloadTextFile(fileName, source, "image/svg+xml;charset=utf-8");
}

function stoneFileId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function sanitizeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function serializeShapeRegion(
  shape: ShapeRegion,
  texture: ShapeTexture
): SavedShapeRegion {
  return {
    id: shape.id,
    label: shape.label,
    points: shape.points.map((point) => ({ ...point })),
    area: shape.area,
    perimeter: shape.perimeter,
    centroid: { ...shape.centroid },
    color: shape.color,
    bounds: { ...shape.bounds },
    textureId: texture.id,
  };
}

function createStoneSnapshot({
  shape,
  texture,
  seed,
  cuts,
  kind,
}: {
  shape: ShapeRegion;
  texture: ShapeTexture;
  seed: number;
  cuts: GrindingCut[];
  kind: StoneFileKind;
}): StoneSnapshot {
  return {
    version: 1,
    id: stoneFileId(),
    kind,
    label: `${shape.label} ${kind === "original" ? "Original" : "Polished"}`,
    seed,
    shape: serializeShapeRegion(shape, texture),
    textureId: texture.id,
    cuts: cuts.map((cut) => ({
      normal: { ...cut.normal },
      offset: cut.offset,
      gritId: cut.gritId,
    })),
    createdAt: new Date().toISOString(),
  };
}

function textureForStoneSnapshot(
  snapshot: StoneSnapshot,
  textureById: Map<string, ShapeTexture>
) {
  return (
    textureById.get(snapshot.textureId) ??
    textureById.get(snapshot.shape.textureId) ??
    SHAPE_TEXTURES[0]
  );
}

function shapeRegionFromSnapshot(
  snapshot: StoneSnapshot,
  texture: ShapeTexture
): ShapeRegion {
  return {
    id: snapshot.shape.id,
    label: snapshot.shape.label,
    points: snapshot.shape.points.map((point) => ({ ...point })),
    area: snapshot.shape.area,
    perimeter: snapshot.shape.perimeter,
    centroid: { ...snapshot.shape.centroid },
    color: snapshot.shape.color,
    bounds: { ...snapshot.shape.bounds },
    texture,
  };
}

function buildStoneSnapshotModel(
  snapshot: StoneSnapshot,
  textureById: Map<string, ShapeTexture>
) {
  const texture = textureForStoneSnapshot(snapshot, textureById);
  const shape = shapeRegionFromSnapshot(snapshot, texture);
  const projections = buildStoneProjections(shape, snapshot.seed);
  const textureStack = grindingTextureStackForTexture(texture);

  if (snapshot.cuts.length > 0) {
    return buildGrindingStoneGeometry(
      projections,
      snapshot.seed,
      shape.id,
      snapshot.cuts,
      textureStack.isLayered
    );
  }

  return buildStoneGeometry(projections, snapshot.seed, shape.id);
}

function downloadStoneFile(snapshot: StoneSnapshot) {
  downloadTextFile(
    `${sanitizeFileName(snapshot.label)}.stone.json`,
    JSON.stringify(snapshot, null, 2),
    "application/json;charset=utf-8"
  );
}

function downloadStoneObj(
  snapshot: StoneSnapshot,
  textureById: Map<string, ShapeTexture>
) {
  const model = buildStoneSnapshotModel(snapshot, textureById);
  const mesh = new THREE.Mesh(model.geometry.clone());
  mesh.name = sanitizeFileName(snapshot.label) || "stone";
  const source = new OBJExporter().parse(mesh);

  downloadTextFile(
    `${sanitizeFileName(snapshot.label)}.obj`,
    source,
    "text/plain;charset=utf-8"
  );
  model.geometry.dispose();
  mesh.geometry.dispose();
}

function isPointLike(value: unknown): value is Point {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Point).x === "number" &&
    typeof (value as Point).y === "number"
  );
}

function isStoneSnapshot(value: unknown): value is StoneSnapshot {
  const candidate = value as StoneSnapshot;

  return (
    typeof candidate === "object" &&
    candidate !== null &&
    candidate.version === 1 &&
    typeof candidate.id === "string" &&
    (candidate.kind === "original" || candidate.kind === "polished") &&
    typeof candidate.label === "string" &&
    typeof candidate.seed === "number" &&
    typeof candidate.textureId === "string" &&
    Array.isArray(candidate.cuts) &&
    typeof candidate.shape === "object" &&
    candidate.shape !== null &&
    Array.isArray(candidate.shape.points) &&
    candidate.shape.points.every(isPointLike)
  );
}

function sliderValue(value: number | number[]) {
  return Array.isArray(value) ? value[0] : value;
}

function numberFromInput(value: string, fallback: number) {
  if (value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function SettingSlider({
  label,
  value,
  min,
  max,
  step = 1,
  disabled = false,
  valueLabel,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  valueLabel?: string;
  onChange: (value: number) => void;
}) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1}
        sx={{ minWidth: 0 }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {label}
        </Typography>
        <Chip
          size="small"
          label={valueLabel ?? value}
          sx={{ bgcolor: "rgba(17, 24, 39, 0.08)" }}
        />
      </Stack>
      <Slider
        aria-label={label}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(_, nextValue) => onChange(sliderValue(nextValue))}
        valueLabelDisplay="auto"
        sx={{
          mt: 1,
          minWidth: 0,
          color: "#0f766e",
          "& .MuiSlider-thumb": {
            boxShadow: "0 0 0 5px rgba(15, 118, 110, 0.12)",
          },
        }}
      />
    </Box>
  );
}

function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <Chip
      label={`${label}: ${value}`}
      sx={{
        bgcolor: "rgba(255, 255, 255, 0.72)",
        border: "1px solid rgba(15, 23, 42, 0.1)",
        fontWeight: 600,
      }}
    />
  );
}

function StoneMesh({
  model,
  texture,
}: {
  model: StoneGeometryModel;
  texture: ShapeTexture;
}) {
  const textureMap = useTexture(texture.path);

  useEffect(() => {
    textureMap.wrapS = THREE.RepeatWrapping;
    textureMap.wrapT = THREE.RepeatWrapping;
    textureMap.colorSpace = THREE.SRGBColorSpace;
    textureMap.anisotropy = 4;
    textureMap.needsUpdate = true;
  }, [textureMap]);

  return (
    <mesh geometry={model.geometry} rotation={[-0.28, 0.58, 0.08]}>
      <meshStandardMaterial
        map={textureMap}
        roughness={0.88}
        metalness={0.02}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function GrindingStoneMesh({
  model,
  layerTextures,
  rotation,
  feed,
}: {
  model: GrindingStoneGeometryModel;
  layerTextures: StoneLayerTextures;
  rotation: StoneRotation;
  feed: number;
}) {
  const outerMap = useTexture(layerTextures[0].path);
  const middleMap = useTexture(layerTextures[1].path);
  const coreMap = useTexture(layerTextures[2].path);

  useEffect(() => {
    [outerMap, middleMap, coreMap].forEach((textureMap) => {
      textureMap.wrapS = THREE.RepeatWrapping;
      textureMap.wrapT = THREE.RepeatWrapping;
      textureMap.colorSpace = THREE.SRGBColorSpace;
      textureMap.repeat.set(1.35, 1.35);
      textureMap.anisotropy = 6;
      textureMap.needsUpdate = true;
    });
  }, [coreMap, middleMap, outerMap]);

  return (
    <mesh
      geometry={model.geometry}
      position={[0, feed, 0]}
      rotation={[rotation.x, rotation.y, rotation.z]}
    >
      <meshStandardMaterial
        attach="material-0"
        map={outerMap}
        roughness={0.82}
        metalness={0.02}
        side={THREE.DoubleSide}
      />
      <meshStandardMaterial
        attach="material-1"
        map={middleMap}
        emissive="#ffffff"
        emissiveMap={middleMap}
        emissiveIntensity={0.08}
        roughness={0.64}
        metalness={0.02}
        side={THREE.DoubleSide}
      />
      <meshStandardMaterial
        attach="material-2"
        map={coreMap}
        emissive="#ffffff"
        emissiveMap={coreMap}
        emissiveIntensity={0.28}
        roughness={0.34}
        metalness={0.04}
        side={THREE.DoubleSide}
      />
      {GRINDING_GRITS.flatMap((finishGrit, gritIndex) => {
        const materialOffset =
          GRINDING_GROUND_MATERIAL_OFFSET +
          gritIndex * GRINDING_LAYER_MATERIAL_COUNT;

        return [
          <meshStandardMaterial
            key={`${finishGrit.id}-ground-surface`}
            attach={`material-${materialOffset}`}
            map={outerMap}
            roughness={finishGrit.polishRoughness}
            metalness={finishGrit.polishMetalness}
            emissive="#ffffff"
            emissiveMap={outerMap}
            emissiveIntensity={finishGrit.polishGlow * 0.22}
            side={THREE.DoubleSide}
          />,
          <meshStandardMaterial
            key={`${finishGrit.id}-ground-potch`}
            attach={`material-${materialOffset + 1}`}
            map={middleMap}
            roughness={Math.max(0.12, finishGrit.polishRoughness * 0.86)}
            metalness={finishGrit.polishMetalness}
            emissive="#ffffff"
            emissiveMap={middleMap}
            emissiveIntensity={0.08 + finishGrit.polishGlow * 0.46}
            side={THREE.DoubleSide}
          />,
          <meshStandardMaterial
            key={`${finishGrit.id}-ground-polished`}
            attach={`material-${materialOffset + 2}`}
            map={coreMap}
            roughness={Math.max(0.08, finishGrit.polishRoughness * 0.72)}
            metalness={finishGrit.polishMetalness + 0.015}
            emissive="#ffffff"
            emissiveMap={coreMap}
            emissiveIntensity={0.18 + finishGrit.polishGlow * 0.72}
            side={THREE.DoubleSide}
          />,
        ];
      })}
    </mesh>
  );
}

function StoneFilesPanel({
  stones,
  textureById,
  onLoadFile,
  onRemove,
  onClear,
  onDownloadObj,
  onDownloadStoneFile,
}: {
  stones: StoneSnapshot[];
  textureById: Map<string, ShapeTexture>;
  onLoadFile: (file: File | null) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onDownloadObj: (snapshot: StoneSnapshot) => void;
  onDownloadStoneFile: (snapshot: StoneSnapshot) => void;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.5, sm: 2 },
        borderRadius: 2,
        border: "1px solid rgba(15, 23, 42, 0.12)",
        bgcolor: "rgba(255, 255, 255, 0.82)",
        overflow: "hidden",
      }}
    >
      <Stack spacing={1.5}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Stone Files
            </Typography>
            <Typography variant="body2" sx={{ color: "#64748b" }}>
              OBJ and editable stone files
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              component="label"
              size="small"
              variant="outlined"
              sx={{
                borderColor: "rgba(15, 23, 42, 0.14)",
                color: "#0f172a",
                bgcolor: "rgba(255, 255, 255, 0.72)",
              }}
            >
              Load stone
              <input
                hidden
                type="file"
                accept=".stone.json,application/json"
                onChange={(event) => {
                  onLoadFile(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={onClear}
              disabled={stones.length === 0}
              sx={{
                borderColor: "rgba(15, 23, 42, 0.14)",
                color: "#0f172a",
                bgcolor: "rgba(255, 255, 255, 0.72)",
              }}
            >
              Clear
            </Button>
            <Chip
              size="small"
              label={`${stones.length} loaded`}
              sx={{ bgcolor: "rgba(15, 118, 110, 0.1)", fontWeight: 800 }}
            />
          </Stack>
        </Stack>

        {stones.length === 0 ? (
          <Typography variant="body2" sx={{ color: "#64748b" }}>
            No loaded stone files yet.
          </Typography>
        ) : (
          <Stack spacing={0.85}>
            {stones.map((stone) => {
              const texture = textureForStoneSnapshot(stone, textureById);

              return (
                <Stack
                  key={stone.id}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  alignItems={{ xs: "stretch", sm: "center" }}
                  justifyContent="space-between"
                  sx={{
                    border: "1px solid rgba(15, 23, 42, 0.1)",
                    borderRadius: 1,
                    px: 1,
                    py: 0.85,
                    bgcolor: "rgba(255, 255, 255, 0.64)",
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 800, wordBreak: "break-word" }}
                    >
                      {stone.label}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={0.75}
                      flexWrap="wrap"
                      useFlexGap
                      sx={{ mt: 0.45 }}
                    >
                      <Chip
                        size="small"
                        label={stone.kind === "original" ? "Original" : "Polished"}
                        sx={{ height: 22, fontWeight: 700 }}
                      />
                      <Chip
                        size="small"
                        label={texture.name}
                        sx={{
                          height: 22,
                          bgcolor: "rgba(17, 138, 178, 0.1)",
                          fontWeight: 700,
                        }}
                      />
                    </Stack>
                  </Box>

                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    <Tooltip title="Download OBJ">
                      <IconButton
                        aria-label={`Download ${stone.label} OBJ`}
                        size="small"
                        onClick={() => onDownloadObj(stone)}
                        sx={{
                          border: "1px solid rgba(15, 23, 42, 0.12)",
                          bgcolor: "rgba(255, 255, 255, 0.72)",
                        }}
                      >
                        <FileDownloadIcon fontSize="inherit" />
                      </IconButton>
                    </Tooltip>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => onDownloadStoneFile(stone)}
                      sx={{ borderColor: "rgba(15, 23, 42, 0.14)", color: "#0f172a" }}
                    >
                      File
                    </Button>
                    <Button size="small" onClick={() => onRemove(stone.id)}>
                      Remove
                    </Button>
                  </Stack>
                </Stack>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

function GrindingWheel({ grit }: { grit: GrindingGrit }) {
  const wheelRef = useRef<THREE.Group>(null);
  const gritNumber = Number(grit.id);
  const toothCount = Math.round(clamp(gritNumber / 38, 10, 40));

  useFrame((_, delta) => {
    if (wheelRef.current) {
      wheelRef.current.rotation.z -= delta * (1.6 + 140 / gritNumber);
    }
  });

  return (
    <group position={[0, GRINDING_WHEEL_CENTER_Y, -0.12]}>
      <group ref={wheelRef}>
        <mesh>
          <circleGeometry args={[GRINDING_WHEEL_RADIUS, 96]} />
          <meshStandardMaterial
            color="#d7dde2"
            metalness={0.04}
            roughness={0.86}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, 0, 0.018]}>
          <ringGeometry
            args={[GRINDING_WHEEL_RADIUS * 0.76, GRINDING_WHEEL_RADIUS, 96]}
          />
          <meshStandardMaterial
            color="#8f99a3"
            roughness={0.92}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, 0, 0.034]}>
          <ringGeometry
            args={[GRINDING_WHEEL_RADIUS * 0.3, GRINDING_WHEEL_RADIUS * 0.38, 72]}
          />
          <meshStandardMaterial
            color="#eef2f5"
            metalness={0.08}
            roughness={0.58}
            side={THREE.DoubleSide}
          />
        </mesh>
        {Array.from({ length: toothCount }).map((_, index) => (
          <mesh
            key={`grit-spoke-${index}`}
            position={[0, 0, 0.052]}
            rotation={[0, 0, (index / toothCount) * Math.PI * 2]}
          >
            <boxGeometry
              args={[0.009, GRINDING_WHEEL_RADIUS * 1.74, 0.014]}
            />
            <meshStandardMaterial
              color={index % 2 === 0 ? "#6b7280" : "#9ca3af"}
              transparent
              opacity={0.42}
              roughness={0.96}
            />
          </mesh>
        ))}
        <mesh position={[0, 0, 0.07]}>
          <circleGeometry args={[GRINDING_WHEEL_RADIUS * 0.2, 48]} />
          <meshStandardMaterial
            color="#64748b"
            metalness={0.22}
            roughness={0.46}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      <mesh position={[0, -GRINDING_WHEEL_RADIUS, 0.09]}>
        <boxGeometry args={[1.34, 0.05, 0.05]} />
        <meshStandardMaterial
          color="#0f766e"
          emissive="#0f766e"
          emissiveIntensity={0.22}
          roughness={0.62}
        />
      </mesh>
      <mesh position={[0, -GRINDING_WHEEL_RADIUS - 0.04, 0.04]}>
        <boxGeometry args={[1.42, 0.032, 0.025]} />
        <meshStandardMaterial
          color="#cbd5e1"
          transparent
          opacity={0.5}
          roughness={0.9}
        />
      </mesh>
    </group>
  );
}

function GrindingBenchCamera() {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0.18, 0.72, 4.2);
    camera.lookAt(0, 0.22, 0);
    camera.updateProjectionMatrix();
  }, [camera]);

  return null;
}

function GrindingBench({
  shape,
  texture,
  seed,
  onDownloadObj,
  onDownloadStoneFile,
}: {
  shape: ShapeRegion;
  texture: ShapeTexture;
  seed: number;
  onDownloadObj: (snapshot: StoneSnapshot) => void;
  onDownloadStoneFile: (snapshot: StoneSnapshot) => void;
}) {
  const [feed, setFeed] = useState(0);
  const [rotation, setRotation] = useState<StoneRotation>(
    DEFAULT_GRINDING_ROTATION
  );
  const [cuts, setCuts] = useState<GrindingCut[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isKeyboardGrinding, setIsKeyboardGrinding] = useState(false);
  const [isPointerGrinding, setIsPointerGrinding] = useState(false);
  const [isFullBackoff, setIsFullBackoff] = useState(false);
  const [parkFeedTarget, setParkFeedTarget] = useState(GRINDING_FEED_HOME);
  const [gritId, setGritId] = useState(DEFAULT_GRINDING_GRIT_ID);
  const feedRef = useRef(feed);
  const rotationRef = useRef(rotation);
  const contactFeedRef = useRef(GRINDING_FEED_HOME);
  const isGrindingRef = useRef(false);
  const isKeyboardGrindingRef = useRef(false);
  const isPointerGrindingRef = useRef(false);
  const dragStateRef = useRef<{
    active: boolean;
    lastX: number;
    lastY: number;
    pendingX: number;
    pendingY: number;
    smoothedX: number;
    smoothedY: number;
  }>({
    active: false,
    lastX: 0,
    lastY: 0,
    pendingX: 0,
    pendingY: 0,
    smoothedX: 0,
    smoothedY: 0,
  });
  const projections = useMemo(
    () => buildStoneProjections(shape, seed),
    [shape, seed]
  );
  const textureStack = useMemo(
    () => grindingTextureStackForTexture(texture),
    [texture]
  );
  const stoneModel = useMemo(
    () =>
      buildGrindingStoneGeometry(
        projections,
        seed,
        shape.id,
        cuts,
        textureStack.isLayered
      ),
    [cuts, projections, seed, shape.id, textureStack.isLayered]
  );
  const selectedGrit = useMemo(
    () =>
      GRINDING_GRITS.find((grit) => grit.id === gritId) ?? GRINDING_GRITS[1],
    [gritId]
  );
  const selectedGritRef = useRef(selectedGrit);
  const contactFeed = useMemo(
    () =>
      estimateGrindingContactFeed(projections, seed, shape.id, rotation, cuts),
    [cuts, projections, rotation, seed, shape.id]
  );
  const isGrinding = isKeyboardGrinding || isPointerGrinding;
  const deepestLayerLabel = textureStack.isLayered
    ? ["Surface", "Potch", "Polished"][stoneModel.deepestLayer] ?? "Surface"
    : texture.name;
  const exposureLabel = textureStack.isLayered
    ? `Exposed ${Math.round(stoneModel.exposedRatio * 100)}%`
    : "Single material";
  const createSnapshot = useCallback(
    (kind: StoneFileKind) =>
      createStoneSnapshot({
        shape,
        texture,
        seed,
        cuts: kind === "original" ? [] : cuts,
        kind,
      }),
    [cuts, seed, shape, texture]
  );

  useEffect(() => {
    feedRef.current = feed;
  }, [feed]);

  useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);

  useEffect(() => {
    contactFeedRef.current = contactFeed;
  }, [contactFeed]);

  useEffect(() => {
    selectedGritRef.current = selectedGrit;
  }, [selectedGrit]);

  useEffect(() => {
    isGrindingRef.current = isGrinding;
    isKeyboardGrindingRef.current = isKeyboardGrinding;
    isPointerGrindingRef.current = isPointerGrinding;
  }, [isGrinding, isKeyboardGrinding, isPointerGrinding]);

  const commitGrindingCut = useCallback(
    (nextFeed: number, nextRotation = rotationRef.current) => {
      setCuts((current) =>
        mergeGrindingCut(
          current,
          grindingCutFromRotation(
            nextRotation,
            nextFeed,
            selectedGritRef.current.id
          )
        )
      );
    },
    []
  );
  const setGrindingFeed = useCallback(
    (nextFeed: number) => {
      const clampedFeed = clamp(
        Math.round(nextFeed * 1000) / 1000,
        GRINDING_FEED_MIN,
        GRINDING_FEED_MAX
      );

      if (
        clampedFeed > feedRef.current + GRINDING_FEED_EPSILON &&
        clampedFeed >= contactFeedRef.current - GRINDING_FEED_EPSILON
      ) {
        commitGrindingCut(clampedFeed);
      }

      feedRef.current = clampedFeed;
      setFeed(clampedFeed);
    },
    [commitGrindingCut]
  );
  const parkGrindingFeed = useCallback(() => {
    const nextParkFeed = clamp(
      feedRef.current - GRINDING_REST_BACKOFF,
      GRINDING_FEED_MIN,
      GRINDING_FEED_MAX
    );

    setParkFeedTarget(nextParkFeed);
    setIsFullBackoff(false);
  }, []);
  const startKeyboardGrinding = useCallback(() => {
    isKeyboardGrindingRef.current = true;
    isGrindingRef.current = true;
    setIsFullBackoff(false);
    setIsKeyboardGrinding(true);
  }, []);
  const stopKeyboardGrinding = useCallback(() => {
    if (!isKeyboardGrindingRef.current) {
      return;
    }

    isKeyboardGrindingRef.current = false;
    setIsKeyboardGrinding(false);

    if (!isPointerGrindingRef.current) {
      isGrindingRef.current = false;
      parkGrindingFeed();
    }
  }, [parkGrindingFeed]);
  const startPointerGrinding = useCallback(() => {
    isPointerGrindingRef.current = true;
    isGrindingRef.current = true;
    setIsFullBackoff(false);
    setIsPointerGrinding(true);
  }, []);
  const stopPointerGrinding = useCallback(() => {
    if (!isPointerGrindingRef.current) {
      return;
    }

    isPointerGrindingRef.current = false;
    setIsPointerGrinding(false);

    if (!isKeyboardGrindingRef.current) {
      isGrindingRef.current = false;
      parkGrindingFeed();
    }
  }, [parkGrindingFeed]);

  useEffect(() => {
    let animationFrameId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const deltaSeconds = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const targetFeed = isGrinding
        ? GRINDING_FEED_MAX
        : isFullBackoff
        ? GRINDING_FEED_HOME
        : parkFeedTarget;

      setFeed((currentFeed) => {
        const difference = targetFeed - currentFeed;

        if (Math.abs(difference) <= GRINDING_FEED_EPSILON) {
          feedRef.current = targetFeed;
          return targetFeed;
        }

        const isFeedingIntoWheel = difference > 0;
        const hasReachedSurface =
          currentFeed >= contactFeed - GRINDING_FEED_EPSILON;
        const speed = isFeedingIntoWheel
          ? hasReachedSurface
            ? selectedGrit.feedSpeed
            : GRINDING_APPROACH_SPEED
          : GRINDING_RETURN_SPEED;
        const feedDelta =
          Math.sign(difference) *
          Math.min(Math.abs(difference), speed * deltaSeconds);
        const steppedFeed =
          isFeedingIntoWheel &&
          !hasReachedSurface &&
          currentFeed + feedDelta > contactFeed
            ? contactFeed
            : currentFeed + feedDelta;
        const nextFeed = clamp(
          Math.round(steppedFeed * 1000) / 1000,
          GRINDING_FEED_MIN,
          GRINDING_FEED_MAX
        );

        if (
          isFeedingIntoWheel &&
          nextFeed > currentFeed + GRINDING_FEED_EPSILON &&
          nextFeed >= contactFeed - GRINDING_FEED_EPSILON
        ) {
          commitGrindingCut(nextFeed, rotationRef.current);
        }

        feedRef.current = nextFeed;
        return nextFeed;
      });

      animationFrameId = window.requestAnimationFrame(tick);
    };

    animationFrameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [
    commitGrindingCut,
    contactFeed,
    isFullBackoff,
    isGrinding,
    parkFeedTarget,
    selectedGrit.feedSpeed,
  ]);

  useEffect(() => {
    if (isPointerGrinding && feed >= GRINDING_FEED_MAX - GRINDING_FEED_EPSILON) {
      stopPointerGrinding();
    }
  }, [feed, isPointerGrinding, stopPointerGrinding]);

  const setBenchRotation = useCallback(
    (nextRotation: StoneRotation) => {
      setRotation(nextRotation);
      rotationRef.current = nextRotation;

      if (
        isGrindingRef.current &&
        feedRef.current >= contactFeedRef.current - GRINDING_FEED_EPSILON
      ) {
        commitGrindingCut(feedRef.current, nextRotation);
      }
    },
    [commitGrindingCut]
  );
  const rotateStone = useCallback(
    (delta: Partial<StoneRotation>) => {
      setBenchRotation({
        x: normalizeAngle(rotation.x + (delta.x ?? 0)),
        y: normalizeAngle(rotation.y + (delta.y ?? 0)),
        z: normalizeAngle(rotation.z + (delta.z ?? 0)),
      });
    },
    [rotation, setBenchRotation]
  );
  const rollStone = useCallback(
    (amount: number) => {
      rotateStone({ z: amount });
    },
    [rotateStone]
  );
  const resetBench = useCallback(() => {
    feedRef.current = GRINDING_FEED_HOME;
    rotationRef.current = DEFAULT_GRINDING_ROTATION;
    isGrindingRef.current = false;
    isKeyboardGrindingRef.current = false;
    isPointerGrindingRef.current = false;
    dragStateRef.current.active = false;
    dragStateRef.current.pendingX = 0;
    dragStateRef.current.pendingY = 0;
    dragStateRef.current.smoothedX = 0;
    dragStateRef.current.smoothedY = 0;
    setFeed(GRINDING_FEED_HOME);
    setParkFeedTarget(GRINDING_FEED_HOME);
    setCuts([]);
    setIsKeyboardGrinding(false);
    setIsPointerGrinding(false);
    setIsFullBackoff(false);
    setRotation(DEFAULT_GRINDING_ROTATION);
  }, []);

  useEffect(() => {
    feedRef.current = GRINDING_FEED_HOME;
    rotationRef.current = DEFAULT_GRINDING_ROTATION;
    isGrindingRef.current = false;
    isKeyboardGrindingRef.current = false;
    isPointerGrindingRef.current = false;
    dragStateRef.current.active = false;
    dragStateRef.current.pendingX = 0;
    dragStateRef.current.pendingY = 0;
    dragStateRef.current.smoothedX = 0;
    dragStateRef.current.smoothedY = 0;
    setFeed(GRINDING_FEED_HOME);
    setParkFeedTarget(GRINDING_FEED_HOME);
    setCuts([]);
    setIsKeyboardGrinding(false);
    setIsPointerGrinding(false);
    setIsFullBackoff(false);
    setRotation(DEFAULT_GRINDING_ROTATION);
  }, [shape.id, seed]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;

      if (
        target &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      const isSpace = event.code === "Space" || event.key === " ";

      if (event.key === "Shift") {
        event.preventDefault();
        isGrindingRef.current = false;
        isKeyboardGrindingRef.current = false;
        isPointerGrindingRef.current = false;
        setIsKeyboardGrinding(false);
        setIsPointerGrinding(false);
        setIsFullBackoff(true);
      }

      if (isSpace) {
        event.preventDefault();
        startKeyboardGrinding();
      }

      if (key === "a") {
        event.preventDefault();
        rotateStone({ z: GRINDING_ROLL_STEP });
      }

      if (key === "d") {
        event.preventDefault();
        rotateStone({ z: -GRINDING_ROLL_STEP });
      }

      if (key === "w") {
        event.preventDefault();
        rotateStone({ x: -GRINDING_ROTATION_STEP });
      }

      if (key === "s") {
        event.preventDefault();
        rotateStone({ x: GRINDING_ROTATION_STEP });
      }

      if (key === "q") {
        event.preventDefault();
        rotateStone({ y: -GRINDING_FLIP_STEP });
      }

      if (key === "e") {
        event.preventDefault();
        rotateStone({ y: GRINDING_FLIP_STEP });
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.key === " ") {
        event.preventDefault();
        stopKeyboardGrinding();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [rotateStone, startKeyboardGrinding, stopKeyboardGrinding]);

  useEffect(() => {
    let animationFrameId = 0;

    const tick = () => {
      const dragState = dragStateRef.current;

      if (dragState.active) {
        const targetX = dragState.pendingX;
        const targetY = dragState.pendingY;
        dragState.pendingX = 0;
        dragState.pendingY = 0;
        dragState.smoothedX =
          dragState.smoothedX * GRINDING_POINTER_FRAME_SMOOTHING +
          targetX * (1 - GRINDING_POINTER_FRAME_SMOOTHING);
        dragState.smoothedY =
          dragState.smoothedY * GRINDING_POINTER_FRAME_SMOOTHING +
          targetY * (1 - GRINDING_POINTER_FRAME_SMOOTHING);

        if (Math.hypot(dragState.smoothedX, dragState.smoothedY) > 0.05) {
          setBenchRotation(
            rollRotationFromScreenVector(
              rotationRef.current,
              dragState.smoothedX,
              dragState.smoothedY
            )
          );
        }

        if (
          targetX === 0 &&
          targetY === 0 &&
          Math.hypot(dragState.smoothedX, dragState.smoothedY) < 0.05
        ) {
          dragState.smoothedX = 0;
          dragState.smoothedY = 0;
        }
      }

      animationFrameId = window.requestAnimationFrame(tick);
    };

    animationFrameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [setBenchRotation]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      dragStateRef.current = {
        active: true,
        lastX: event.clientX,
        lastY: event.clientY,
        pendingX: 0,
        pendingY: 0,
        smoothedX: 0,
        smoothedY: 0,
      };
      setIsDragging(true);
    },
    []
  );
  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const dragState = dragStateRef.current;

      if (!dragState.active) {
        return;
      }

      const deltaX = event.clientX - dragState.lastX;
      const deltaY = event.clientY - dragState.lastY;
      dragStateRef.current = {
        active: true,
        lastX: event.clientX,
        lastY: event.clientY,
        pendingX: dragState.pendingX + deltaX,
        pendingY: dragState.pendingY + deltaY,
        smoothedX: dragState.smoothedX,
        smoothedY: dragState.smoothedY,
      };
    },
    []
  );
  const stopDragging = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      dragStateRef.current.active = false;
      dragStateRef.current.pendingX = 0;
      dragStateRef.current.pendingY = 0;
      dragStateRef.current.smoothedX = 0;
      dragStateRef.current.smoothedY = 0;
      setIsDragging(false);

      if (
        isGrindingRef.current &&
        feedRef.current >= contactFeedRef.current - GRINDING_FEED_EPSILON
      ) {
        commitGrindingCut(feedRef.current);
      }
    },
    [commitGrindingCut]
  );

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.5, sm: 2 },
        borderRadius: 2,
        border: "1px solid rgba(15, 23, 42, 0.12)",
        bgcolor: "rgba(255, 255, 255, 0.78)",
        overflow: "hidden",
      }}
    >
      <Stack spacing={1.5}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "center" }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Grinding Wheel
            </Typography>
            <Typography variant="body2" sx={{ color: "#64748b" }}>
              {shape.label} · {textureStack.label}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              label={`Ground ${Math.round(stoneModel.groundRatio * 100)}%`}
              sx={{ bgcolor: "rgba(15, 118, 110, 0.1)", fontWeight: 700 }}
            />
            <Chip
              size="small"
              label={exposureLabel}
              sx={{ bgcolor: "rgba(17, 138, 178, 0.12)", fontWeight: 700 }}
            />
            <Chip
              size="small"
              label={deepestLayerLabel}
              sx={{ bgcolor: "rgba(109, 40, 217, 0.1)", fontWeight: 700 }}
            />
            <Chip
              size="small"
              label={`${selectedGrit.label} - ${selectedGrit.feedSpeed.toFixed(
                2
              )}/s`}
              sx={{ bgcolor: "rgba(245, 158, 11, 0.14)", fontWeight: 700 }}
            />
            <Chip
              size="small"
              label={`Contact ${contactFeed.toFixed(2)}`}
              sx={{ bgcolor: "rgba(15, 23, 42, 0.06)", fontWeight: 700 }}
            />
            <Chip
              size="small"
              label={
                isFullBackoff
                  ? "Full backoff"
                  : `Park ${parkFeedTarget.toFixed(2)}`
              }
              sx={{ bgcolor: "rgba(20, 184, 166, 0.1)", fontWeight: 700 }}
            />
          </Stack>
        </Stack>

        <Box
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          sx={{
            height: { xs: 300, md: 360 },
            borderRadius: 1.5,
            border: "1px solid rgba(15, 23, 42, 0.1)",
            bgcolor: "#f8fbfc",
            cursor: isDragging ? "grabbing" : "grab",
            overflow: "hidden",
            touchAction: "none",
          }}
        >
          <Canvas
            camera={{ position: [0, 0, 4.2], fov: 34 }}
            gl={{ antialias: true, alpha: true }}
            style={{ width: "100%", height: "100%" }}
          >
            <GrindingBenchCamera />
            <ambientLight intensity={1.55} />
            <directionalLight position={[2.5, 3, 4]} intensity={1.55} />
            <directionalLight position={[-2, -1.5, 3]} intensity={0.75} />
            <pointLight position={[0.1, 0.15, 2]} intensity={0.75} />
            <GrindingStoneMesh
              model={stoneModel}
              layerTextures={textureStack.textures}
              rotation={rotation}
              feed={feed}
            />
            <GrindingWheel grit={selectedGrit} />
          </Canvas>
        </Box>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.25}
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <Stack direction="row" spacing={1} flexShrink={0}>
            <Button
              size="small"
              variant={isGrinding ? "contained" : "outlined"}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                startPointerGrinding();
              }}
              onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }

                stopPointerGrinding();
              }}
              onPointerCancel={() => {
                stopPointerGrinding();
              }}
              onLostPointerCapture={stopPointerGrinding}
              onMouseDown={(event) => {
                if (event.button === 0) {
                  startPointerGrinding();
                }
              }}
              onMouseUp={stopPointerGrinding}
              onMouseLeave={(event) => {
                if (event.buttons === 0) {
                  stopPointerGrinding();
                }
              }}
              onTouchStart={startPointerGrinding}
              onTouchEnd={stopPointerGrinding}
              onTouchCancel={stopPointerGrinding}
              onBlur={stopPointerGrinding}
              sx={{
                bgcolor: isGrinding ? "#0f766e" : "rgba(255, 255, 255, 0.72)",
                borderColor: "#0f766e",
                color: isGrinding ? "#ffffff" : "#0f766e",
                "&:hover": {
                  bgcolor: isGrinding
                    ? "#115e59"
                    : "rgba(15, 118, 110, 0.08)",
                },
              }}
            >
              Hold Space
            </Button>
            <IconButton
              aria-label="Reset grinding bench"
              onClick={resetBench}
              size="small"
              sx={{
                border: "1px solid rgba(15, 23, 42, 0.12)",
                bgcolor: "rgba(255, 255, 255, 0.7)",
              }}
            >
              <RestartAltIcon fontSize="small" />
            </IconButton>
          </Stack>

          <Box sx={{ flex: 1, minWidth: { xs: 0, sm: 180 } }}>
            <SettingSlider
              label="Lift through wheel"
              min={GRINDING_FEED_MIN}
              max={GRINDING_FEED_MAX}
              step={0.01}
              value={feed}
              valueLabel={`${feed.toFixed(2)}`}
              onChange={setGrindingFeed}
            />
          </Box>
          <TextField
            select
            size="small"
            label="Wheel grit"
            value={gritId}
            onChange={(event) => setGritId(event.target.value)}
            sx={{
              minWidth: { xs: "100%", sm: 148 },
              "& .MuiInputBase-root": {
                bgcolor: "rgba(255, 255, 255, 0.72)",
              },
            }}
          >
            {GRINDING_GRITS.map((grit) => (
              <MenuItem key={grit.id} value={grit.id}>
                {grit.label} - {grit.description}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            size="small"
            variant="outlined"
            onClick={() => rollStone(GRINDING_ROLL_STEP)}
            sx={{ borderColor: "rgba(15, 23, 42, 0.14)", color: "#0f172a" }}
          >
            A CCW
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => rollStone(-GRINDING_ROLL_STEP)}
            sx={{ borderColor: "rgba(15, 23, 42, 0.14)", color: "#0f172a" }}
          >
            D CW
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => rotateStone({ x: -GRINDING_ROTATION_STEP })}
            sx={{ borderColor: "rgba(15, 23, 42, 0.14)", color: "#0f172a" }}
          >
            W Away
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => rotateStone({ x: GRINDING_ROTATION_STEP })}
            sx={{ borderColor: "rgba(15, 23, 42, 0.14)", color: "#0f172a" }}
          >
            S Close
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => rotateStone({ y: -GRINDING_FLIP_STEP })}
            sx={{ borderColor: "rgba(15, 23, 42, 0.14)", color: "#0f172a" }}
          >
            Q Flip L
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => rotateStone({ y: GRINDING_FLIP_STEP })}
            sx={{ borderColor: "rgba(15, 23, 42, 0.14)", color: "#0f172a" }}
          >
            E Flip R
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              isGrindingRef.current = false;
              isKeyboardGrindingRef.current = false;
              isPointerGrindingRef.current = false;
              setIsKeyboardGrinding(false);
              setIsPointerGrinding(false);
              setIsFullBackoff(true);
            }}
            sx={{ borderColor: "rgba(15, 23, 42, 0.14)", color: "#0f172a" }}
          >
            Shift Back
          </Button>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {textureStack.isLayered ? (
            textureStack.textures.map((layerTexture, index) => (
              <Chip
                key={layerTexture.id}
                size="small"
                label={`${index + 1}. ${layerTexture.name}`}
                sx={{
                  bgcolor:
                    index === 2
                      ? "rgba(109, 40, 217, 0.1)"
                      : "rgba(15, 23, 42, 0.06)",
                }}
              />
            ))
          ) : (
            <Chip
              size="small"
              label={`1. ${texture.name}`}
              sx={{ bgcolor: "rgba(15, 23, 42, 0.06)" }}
            />
          )}
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            size="small"
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={() => onDownloadObj(createSnapshot("original"))}
            sx={{ borderColor: "rgba(15, 23, 42, 0.14)", color: "#0f172a" }}
          >
            Original OBJ
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={() => onDownloadObj(createSnapshot("polished"))}
            sx={{ borderColor: "rgba(15, 23, 42, 0.14)", color: "#0f172a" }}
          >
            Polished OBJ
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => onDownloadStoneFile(createSnapshot("original"))}
            sx={{ borderColor: "rgba(15, 23, 42, 0.14)", color: "#0f172a" }}
          >
            Original file
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => onDownloadStoneFile(createSnapshot("polished"))}
            sx={{ borderColor: "rgba(15, 23, 42, 0.14)", color: "#0f172a" }}
          >
            Polished file
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

function ProjectionPreview({
  axis,
  projections,
  texture,
  texturePatternId,
}: {
  axis: ProjectionAxis;
  projections: StoneProjectionSet;
  texture: ShapeTexture;
  texturePatternId: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox="0 0 100 100"
      width="100%"
      height="100%"
      role="img"
      aria-label={`${axis.toUpperCase()} stone projection`}
      style={{ display: "block" }}
    >
      <defs>
        <pattern
          id={texturePatternId}
          patternUnits="objectBoundingBox"
          patternContentUnits="objectBoundingBox"
          x="0"
          y="0"
          width="1"
          height="1"
        >
          <image
            href={texture.path}
            xlinkHref={texture.path}
            x="0"
            y="0"
            width="1"
            height="1"
            preserveAspectRatio="xMidYMid slice"
          />
        </pattern>
        <filter id={`${texturePatternId}-shadow`} x="-35%" y="-35%" width="170%" height="170%">
          <feOffset dx="0" dy="2" />
          <feGaussianBlur stdDeviation="2.2" result="offset-blur" />
          <feComposite
            operator="out"
            in="SourceGraphic"
            in2="offset-blur"
            result="inverse"
          />
          <feFlood floodColor="#0f172a" floodOpacity="0.42" result="shadow-color" />
          <feComposite
            operator="in"
            in="shadow-color"
            in2="inverse"
            result="inner-shadow"
          />
          <feComposite operator="over" in="inner-shadow" in2="SourceGraphic" />
        </filter>
      </defs>
      <rect x="0" y="0" width="100" height="100" rx="8" fill="#f8fbfc" />
      <path
        d={projectionPath(projections[axis])}
        fill={`url(#${texturePatternId})`}
        filter={`url(#${texturePatternId}-shadow)`}
      />
    </svg>
  );
}

function StoneInspectPreview({
  shape,
  texture,
  seed,
  startIn3d,
}: {
  shape: ShapeRegion;
  texture: ShapeTexture;
  seed: number;
  startIn3d: boolean;
}) {
  const [viewMode, setViewMode] = useState<StoneViewMode>(
    startIn3d ? "3d" : "xy"
  );
  const projections = useMemo(
    () => buildStoneProjections(shape, seed),
    [shape, seed]
  );
  const stoneModel = useMemo(
    () =>
      viewMode === "3d" ? buildStoneGeometry(projections, seed, shape.id) : null,
    [projections, seed, shape.id, viewMode]
  );
  const patternId = `stone-projection-${seed}-${shape.id}-${texture.id}-${viewMode}`;

  return (
    <Box
      sx={{
        width: { xs: "100%", sm: 148 },
        flexShrink: 0,
        borderRadius: 1.25,
        border: "1px solid rgba(15, 23, 42, 0.1)",
        bgcolor: "#f8fbfc",
        overflow: "hidden",
      }}
    >
      <Tabs
        value={viewMode}
        onChange={(_, nextValue) => setViewMode(nextValue)}
        variant="fullWidth"
        sx={{
          minHeight: 26,
          borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
          "& .MuiTab-root": {
            minHeight: 26,
            minWidth: 0,
            p: 0,
            fontSize: 10,
            fontWeight: 800,
            color: "#475569",
          },
          "& .Mui-selected": {
            color: "#0f766e",
          },
          "& .MuiTabs-indicator": {
            height: 2,
            bgcolor: "#0f766e",
          },
        }}
      >
        <Tab value="3d" label="3D" />
        <Tab value="xy" label="XY" />
        <Tab value="xz" label="XZ" />
        <Tab value="yz" label="YZ" />
      </Tabs>

      <Box sx={{ height: 116, position: "relative" }}>
        {viewMode === "3d" && stoneModel ? (
          <Canvas
            camera={{ position: [2.4, 2, 2.6], fov: 38 }}
            gl={{ antialias: true, alpha: true }}
            style={{ width: "100%", height: "100%" }}
          >
            <ambientLight intensity={1.8} />
            <directionalLight position={[3, 4, 5]} intensity={1.7} />
            <directionalLight position={[-3, -2, -4]} intensity={0.7} />
            <StoneMesh model={stoneModel} texture={texture} />
            <OrbitControls
              enablePan={false}
              enableZoom={false}
              autoRotate
              autoRotateSpeed={0.9}
            />
          </Canvas>
        ) : (
          <ProjectionPreview
            axis={viewMode as ProjectionAxis}
            projections={projections}
            texture={texture}
            texturePatternId={patternId}
          />
        )}
      </Box>
    </Box>
  );
}

function ShapeListItem({
  shape,
  texture,
  textures,
  startIn3d,
  isGrindingSelected,
  seed,
  onDownload,
  onGrind,
  onTextureChange,
}: {
  shape: ShapeRegion;
  texture: ShapeTexture;
  textures: ShapeTexture[];
  startIn3d: boolean;
  isGrindingSelected: boolean;
  seed: number;
  onDownload: (shape: ShapeRegion) => void;
  onGrind: (shape: ShapeRegion) => void;
  onTextureChange: (shapeId: string, textureId: string) => void;
}) {
  return (
    <Box
      sx={{
        p: 1.1,
        borderRadius: 1.5,
        border: isGrindingSelected
          ? "1px solid rgba(15, 118, 110, 0.42)"
          : "1px solid rgba(15, 23, 42, 0.1)",
        bgcolor: isGrindingSelected
          ? "rgba(15, 118, 110, 0.07)"
          : "rgba(255, 255, 255, 0.58)",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.25}
        alignItems={{ xs: "stretch", sm: "flex-start" }}
        sx={{ minWidth: 0 }}
      >
        <StoneInspectPreview
          shape={shape}
          texture={texture}
          seed={seed}
          startIn3d={startIn3d}
        />

        <Box sx={{ minWidth: 0, flex: "1 1 150px", width: "100%" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            {shape.label}
          </Typography>
          <TextField
            select
            size="small"
            label="Texture"
            value={texture.id}
            onChange={(event) => onTextureChange(shape.id, event.target.value)}
            sx={{
              mt: 0.75,
              width: "100%",
              "& .MuiInputBase-root": {
                bgcolor: "rgba(255, 255, 255, 0.72)",
              },
              "& .MuiSelect-select": {
                pr: 3.5,
              },
            }}
          >
            {textures.map((option) => (
              <MenuItem key={option.id} value={option.id}>
                {option.name}
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="caption" sx={{ display: "block", color: "#64748b" }}>
            Area {formatNumber(shape.area)} sq px
          </Typography>
          <Typography variant="caption" sx={{ display: "block", color: "#64748b" }}>
            Perimeter {formatNumber(shape.perimeter)} px
          </Typography>
          <Button
            size="small"
            variant={isGrindingSelected ? "contained" : "outlined"}
            onClick={() => onGrind(shape)}
            sx={{
              mt: 0.75,
              minHeight: 28,
              bgcolor: isGrindingSelected ? "#0f766e" : "rgba(255, 255, 255, 0.7)",
              color: isGrindingSelected ? "#ffffff" : "#0f766e",
              borderColor: "rgba(15, 118, 110, 0.42)",
              "&:hover": {
                bgcolor: isGrindingSelected ? "#115e59" : "rgba(15, 118, 110, 0.08)",
                borderColor: "#0f766e",
              },
            }}
          >
            Wheel
          </Button>
        </Box>

        <Tooltip title={`Download ${shape.label}`}>
          <IconButton
            aria-label={`Download ${shape.label}`}
            onClick={() => onDownload(shape)}
            size="small"
            sx={{
              alignSelf: "flex-start",
              bgcolor: "rgba(15, 118, 110, 0.08)",
              color: "#0f766e",
              "&:hover": {
                bgcolor: "rgba(15, 118, 110, 0.16)",
              },
            }}
          >
            <FileDownloadIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
}

export default function IrregularShapeGenerator() {
  const [seed, setSeed] = useState(() =>
    Math.floor(Math.random() * 1_000_000_000)
  );
  const [lineCount, setLineCount] = useState(DEFAULT_LINE_COUNT);
  const [squareSize, setSquareSize] = useState(DEFAULT_SQUARE_SIZE);
  const [strokeWidth, setStrokeWidth] = useState(DEFAULT_STROKE_WIDTH);
  const [cornerRoundness, setCornerRoundness] = useState(
    DEFAULT_CORNER_ROUNDNESS
  );
  const [randomizeRoundness, setRandomizeRoundness] = useState(false);
  const [showRemovedSegments, setShowRemovedSegments] = useState(true);
  const [removedCountOverride, setRemovedCountOverride] = useState<
    number | null
  >(null);
  const [textureAssignments, setTextureAssignments] = useState<
    Record<string, string>
  >({});
  const [grindingShapeId, setGrindingShapeId] = useState<string | null>(null);
  const [loadedStoneSnapshots, setLoadedStoneSnapshots] = useState<
    StoneSnapshot[]
  >([]);

  const network = useMemo(
    () => buildNetwork(lineCount, squareSize, seed),
    [lineCount, squareSize, seed]
  );
  const totalSegments = network.segments.length;
  const removedCount = clamp(
    removedCountOverride ?? Math.round(totalSegments / 2),
    0,
    totalSegments
  );

  const { keptSegments, removedSegments } = useMemo(() => {
    const removedIds = new Set(
      [...network.segments]
        .sort((a, b) => a.removalRank - b.removalRank)
        .slice(0, removedCount)
        .map((segment) => segment.id)
    );

    return {
      keptSegments: network.segments.filter(
        (segment) => !removedIds.has(segment.id)
      ),
      removedSegments: network.segments.filter((segment) =>
        removedIds.has(segment.id)
      ),
    };
  }, [network.segments, removedCount]);

  const shapeRegions = useMemo(
    () => buildShapeRegions(network, keptSegments, squareSize),
    [network, keptSegments, squareSize]
  );
  const selectedGrindingShape = useMemo(
    () =>
      shapeRegions.find((shape) => shape.id === grindingShapeId) ??
      shapeRegions[0],
    [grindingShapeId, shapeRegions]
  );
  const textureById = useMemo(
    () =>
      new Map(SHAPE_TEXTURES.map((texture) => [texture.id, texture] as const)),
    []
  );
  const textureByShapeId = useMemo(() => {
    return shapeRegions.reduce<Record<string, ShapeTexture>>((acc, shape) => {
      acc[shape.id] =
        textureById.get(textureAssignments[shape.id]) ?? shape.texture;
      return acc;
    }, {});
  }, [shapeRegions, textureAssignments, textureById]);
  const getSelectedTexture = useCallback(
    (shape: ShapeRegion) => textureByShapeId[shape.id] ?? shape.texture,
    [textureByShapeId]
  );
  const selectedCanvasTextures = useMemo(
    () =>
      Array.from(
        new Map(
          shapeRegions.map((shape) => {
            const texture = getSelectedTexture(shape);
            return [texture.id, texture] as const;
          })
        ).values()
      ),
    [getSelectedTexture, shapeRegions]
  );
  const roundedCornerCount = shapeRegions.reduce(
    (sum, shape) => sum + shape.points.length,
    0
  );
  const gridId = `shape-grid-${seed}`;
  const canvasShadowId = `shape-soft-shadow-${seed}`;
  const canvasInnerShadowId = `shape-inner-shadow-${seed}`;
  const getCanvasTexturePatternId = useCallback(
    (texture: ShapeTexture) => `shape-texture-${seed}-${texture.id}`,
    [seed]
  );

  const randomizeSeed = useCallback(() => {
    setSeed(Math.floor(Math.random() * 1_000_000_000));
  }, []);

  const resetDefaults = useCallback(() => {
    setLineCount(DEFAULT_LINE_COUNT);
    setSquareSize(DEFAULT_SQUARE_SIZE);
    setStrokeWidth(DEFAULT_STROKE_WIDTH);
    setCornerRoundness(DEFAULT_CORNER_ROUNDNESS);
    setRandomizeRoundness(false);
    setRemovedCountOverride(null);
    setShowRemovedSegments(true);
    setTextureAssignments({});
  }, []);

  const updateShapeTexture = useCallback(
    (shapeId: string, textureId: string) => {
      setTextureAssignments((current) => ({
        ...current,
        [shapeId]: textureId,
      }));
    },
    []
  );
  const selectGrindingShape = useCallback((shape: ShapeRegion) => {
    setGrindingShapeId(shape.id);
  }, []);
  const removeLoadedStoneSnapshot = useCallback((id: string) => {
    setLoadedStoneSnapshots((current) =>
      current.filter((stone) => stone.id !== id)
    );
  }, []);
  const clearLoadedStoneSnapshots = useCallback(() => {
    setLoadedStoneSnapshots([]);
  }, []);
  const downloadStoneObjFromSnapshot = useCallback(
    (snapshot: StoneSnapshot) => {
      downloadStoneObj(snapshot, textureById);
    },
    [textureById]
  );
  const loadStoneFile = useCallback((file: File | null) => {
    if (!file) {
      return;
    }

    file
      .text()
      .then((source) => {
        const parsed = JSON.parse(source);
        const normalizedKind =
          parsed.kind === "original" || parsed.kind === "polished"
            ? parsed.kind
            : Array.isArray(parsed.cuts) && parsed.cuts.length > 0
            ? "polished"
            : "original";
        const normalizedSnapshot = {
          ...parsed,
          kind: normalizedKind,
        };

        if (!isStoneSnapshot(normalizedSnapshot)) {
          throw new Error("Invalid stone file");
        }

        const snapshot: StoneSnapshot = {
          ...normalizedSnapshot,
          id: stoneFileId(),
          label:
            normalizedSnapshot.label ||
            file.name.replace(/\.stone\.json$/i, ""),
        };

        setLoadedStoneSnapshots((current) => [snapshot, ...current]);
      })
      .catch(() => {
        window.alert("That stone file could not be loaded.");
      });
  }, []);

  const randomizeShapeTextures = useCallback(() => {
    setTextureAssignments(() => {
      const next: Record<string, string> = {};

      shapeRegions.forEach((shape) => {
        const texture =
          SHAPE_TEXTURES[Math.floor(Math.random() * SHAPE_TEXTURES.length)];
        next[shape.id] = texture.id;
      });

      return next;
    });
  }, [shapeRegions]);

  useEffect(() => {
    if (shapeRegions.length === 0) {
      setGrindingShapeId(null);
      return;
    }

    if (!shapeRegions.some((shape) => shape.id === grindingShapeId)) {
      setGrindingShapeId(shapeRegions[0].id);
    }
  }, [grindingShapeId, shapeRegions]);

  const downloadAllShapes = useCallback(async () => {
    let textureHrefs: Record<string, string>;

    try {
      const selectedTextures = shapeRegions.map((shape) =>
        getSelectedTexture(shape)
      );
      textureHrefs = await getTextureHrefsForDownload(selectedTextures);
    } catch {
      window.alert("The selected texture images could not be embedded.");
      return;
    }

    downloadSvgFile(
      `shape-gen-${seed}-all.svg`,
      createSvgDocument({
        shapes: shapeRegions,
        squareSize,
        roundness: cornerRoundness,
        strokeWidth: 0,
        randomizeRoundness,
        seed,
        title: `All generated shapes for seed ${seed}`,
        textureByShapeId,
        textureHrefs,
      })
    );
  }, [
    cornerRoundness,
    getSelectedTexture,
    randomizeRoundness,
    seed,
    shapeRegions,
    squareSize,
    textureByShapeId,
  ]);

  const downloadShape = useCallback(
    async (shape: ShapeRegion) => {
      const texture = getSelectedTexture(shape);
      let textureHrefs: Record<string, string>;

      try {
        textureHrefs = await getTextureHrefsForDownload([texture]);
      } catch {
        window.alert(`${texture.name} could not be embedded in the SVG.`);
        return;
      }

      downloadSvgFile(
        `shape-gen-${seed}-${shape.id}.svg`,
        createSvgDocument({
          shapes: shapeRegions,
          squareSize,
          roundness: cornerRoundness,
          strokeWidth: 0,
          randomizeRoundness,
          seed,
          title: `${shape.label} from seed ${seed}`,
          targetShape: shape,
          textureByShapeId,
          textureHrefs,
        })
      );
    },
    [
      cornerRoundness,
      getSelectedTexture,
      randomizeRoundness,
      seed,
      shapeRegions,
      squareSize,
      textureByShapeId,
    ]
  );

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, #eef7ff 0%, #f7fbf5 45%, #fff5f5 100%)",
        color: "#111827",
      }}
    >
      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
        <Stack spacing={2.5}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", md: "center" }}
            justifyContent="space-between"
          >
            <Box>
              <Typography
                variant="overline"
                sx={{ color: "#0f766e", fontWeight: 700, letterSpacing: 1.4 }}
              >
                Geometry Studio
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>
                Irregular Shape Generator
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                variant="contained"
                startIcon={<AutoAwesomeIcon />}
                onClick={randomizeSeed}
                sx={{
                  bgcolor: "#0f766e",
                  "&:hover": { bgcolor: "#115e59" },
                }}
              >
                New Pattern
              </Button>
              <Tooltip title="Reset controls">
                <IconButton
                  aria-label="Reset controls"
                  onClick={resetDefaults}
                  sx={{
                    bgcolor: "rgba(255, 255, 255, 0.7)",
                    border: "1px solid rgba(15, 23, 42, 0.12)",
                  }}
                >
                  <RestartAltIcon />
                </IconButton>
              </Tooltip>
              <Button
                variant="outlined"
                startIcon={<FileDownloadIcon />}
                onClick={downloadAllShapes}
                disabled={shapeRegions.length === 0}
                sx={{
                  borderColor: "rgba(15, 23, 42, 0.18)",
                  color: "#111827",
                  bgcolor: "rgba(255, 255, 255, 0.7)",
                  "&:hover": {
                    borderColor: "#0f766e",
                    bgcolor: "rgba(15, 118, 110, 0.08)",
                  },
                }}
              >
                Download All
              </Button>
            </Stack>
          </Stack>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "minmax(0, 1fr)",
                lg: "300px minmax(430px, 1fr) minmax(390px, 420px)",
                xl: "320px minmax(0, 1fr) 420px",
              },
              gap: 2,
              alignItems: "start",
            }}
          >
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, sm: 2.5 },
                borderRadius: 2,
                border: "1px solid rgba(15, 23, 42, 0.12)",
                bgcolor: "rgba(255, 255, 255, 0.82)",
                backdropFilter: "blur(14px)",
                minWidth: 0,
              }}
            >
              <Stack spacing={2.25}>
                <SettingSlider
                  label="Lines"
                  min={2}
                  max={40}
                  value={lineCount}
                  valueLabel={`${lineCount}`}
                  onChange={(value) => setLineCount(Math.round(value))}
                />

                <Box>
                  <SettingSlider
                    label="Segments removed"
                    min={0}
                    max={Math.max(1, totalSegments)}
                    value={removedCount}
                    valueLabel={`${removedCount} / ${totalSegments}`}
                    disabled={totalSegments === 0}
                    onChange={(value) =>
                      setRemovedCountOverride(
                        clamp(Math.round(value), 0, totalSegments)
                      )
                    }
                  />
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setRemovedCountOverride(null)}
                      sx={{ borderColor: "#0f766e", color: "#0f766e" }}
                    >
                      Half
                    </Button>
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => setRemovedCountOverride(0)}
                      sx={{ color: "#374151" }}
                    >
                      None
                    </Button>
                  </Stack>
                </Box>

                <SettingSlider
                  label="Square size"
                  min={260}
                  max={760}
                  step={10}
                  value={squareSize}
                  valueLabel={`${squareSize}px`}
                  onChange={(value) => setSquareSize(Math.round(value))}
                />

                <SettingSlider
                  label="Stroke width"
                  min={2}
                  max={18}
                  value={strokeWidth}
                  valueLabel={`${strokeWidth}px`}
                  onChange={(value) => setStrokeWidth(Math.round(value))}
                />

                <SettingSlider
                  label="Concave roundness"
                  min={0}
                  max={30}
                  value={cornerRoundness}
                  valueLabel={`${cornerRoundness}px`}
                  onChange={(value) => setCornerRoundness(Math.round(value))}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={randomizeRoundness}
                      onChange={(event) =>
                        setRandomizeRoundness(event.target.checked)
                      }
                      sx={{
                        "& .MuiSwitch-switchBase.Mui-checked": {
                          color: "#0f766e",
                        },
                        "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track":
                          {
                            backgroundColor: "#0f766e",
                          },
                      }}
                    />
                  }
                  label="Randomize roundness"
                />

                <Divider />

                <TextField
                  label="Seed"
                  value={seed}
                  type="number"
                  onChange={(event) =>
                    setSeed(
                      clamp(
                        Math.round(numberFromInput(event.target.value, seed)),
                        0,
                        1_000_000_000
                      )
                    )
                  }
                  size="small"
                  fullWidth
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={showRemovedSegments}
                      onChange={(event) =>
                        setShowRemovedSegments(event.target.checked)
                      }
                      sx={{
                        "& .MuiSwitch-switchBase.Mui-checked": {
                          color: "#0f766e",
                        },
                        "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track":
                          {
                            backgroundColor: "#0f766e",
                          },
                      }}
                    />
                  }
                  label="Show removed segments"
                />
              </Stack>
            </Paper>

            <Stack spacing={1.5} sx={{ minWidth: 0 }}>
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 1.5, sm: 2 },
                  borderRadius: 2,
                  border: "1px solid rgba(15, 23, 42, 0.12)",
                  bgcolor: "rgba(255, 255, 255, 0.78)",
                  overflow: "hidden",
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  flexWrap="wrap"
                  useFlexGap
                  sx={{ mb: 1.5 }}
                >
                  <StatChip label="Captured" value={totalSegments} />
                  <StatChip label="Visible" value={keptSegments.length} />
                  <StatChip label="Removed" value={removedSegments.length} />
                  <StatChip label="Shapes" value={shapeRegions.length} />
                  <StatChip
                    label="Intersections"
                    value={network.intersectionCount}
                  />
                </Stack>

                <Box
                  sx={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  <Box
                    sx={{
                      width: "100%",
                      maxWidth: squareSize,
                      aspectRatio: "1 / 1",
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      xmlnsXlink="http://www.w3.org/1999/xlink"
                      viewBox={`0 0 ${squareSize} ${squareSize}`}
                      width="100%"
                      height="100%"
                      role="img"
                      aria-label={`${shapeRegions.length} generated shapes from ${network.lines.length} generated lines`}
                      style={{ display: "block" }}
                    >
                      <defs>
                        <pattern
                          id={gridId}
                          width={Math.max(32, squareSize / 12)}
                          height={Math.max(32, squareSize / 12)}
                          patternUnits="userSpaceOnUse"
                        >
                          <path
                            d={`M ${Math.max(32, squareSize / 12)} 0 L 0 0 0 ${Math.max(
                              32,
                              squareSize / 12
                            )}`}
                            fill="none"
                            stroke="#dbe6ea"
                            strokeWidth="0.8"
                          />
                        </pattern>
                        {selectedCanvasTextures.map((texture) => (
                          <pattern
                            key={`${texture.id}-texture-pattern`}
                            id={getCanvasTexturePatternId(texture)}
                            patternUnits="objectBoundingBox"
                            patternContentUnits="objectBoundingBox"
                            x="0"
                            y="0"
                            width="1"
                            height="1"
                          >
                            <image
                              href={texture.path}
                              xlinkHref={texture.path}
                              x="0"
                              y="0"
                              width="1"
                              height="1"
                              preserveAspectRatio="xMidYMid slice"
                            />
                          </pattern>
                        ))}
                        <filter
                          id={canvasShadowId}
                          x="-8%"
                          y="-8%"
                          width="116%"
                          height="116%"
                        >
                          <feDropShadow
                            dx="0"
                            dy="10"
                            stdDeviation="9"
                            floodColor="#0f172a"
                            floodOpacity="0.12"
                          />
                        </filter>
                        <filter
                          id={canvasInnerShadowId}
                          x="-35%"
                          y="-35%"
                          width="170%"
                          height="170%"
                        >
                          <feOffset dx="0" dy="3" />
                          <feGaussianBlur
                            stdDeviation="4"
                            result="offset-blur"
                          />
                          <feComposite
                            operator="out"
                            in="SourceGraphic"
                            in2="offset-blur"
                            result="inverse"
                          />
                          <feFlood
                            floodColor="#020617"
                            floodOpacity="0.38"
                            result="shadow-color"
                          />
                          <feComposite
                            operator="in"
                            in="shadow-color"
                            in2="inverse"
                            result="inner-shadow"
                          />
                          <feComposite
                            operator="over"
                            in="inner-shadow"
                            in2="SourceGraphic"
                          />
                        </filter>
                      </defs>

                      <rect
                        x="0"
                        y="0"
                        width={squareSize}
                        height={squareSize}
                        rx={Math.max(8, strokeWidth)}
                        fill="#f8fbfc"
                      />
                      <rect
                        x="0"
                        y="0"
                        width={squareSize}
                        height={squareSize}
                        rx={Math.max(8, strokeWidth)}
                        fill={`url(#${gridId})`}
                        opacity="0.72"
                      />
                      <rect
                        x={strokeWidth / 2}
                        y={strokeWidth / 2}
                        width={squareSize - strokeWidth}
                        height={squareSize - strokeWidth}
                        rx={Math.max(8, strokeWidth)}
                        fill="none"
                        stroke="#111827"
                        strokeOpacity="0.18"
                        strokeWidth={strokeWidth}
                      />

                      {showRemovedSegments && (
                        <g opacity="0.55">
                          {removedSegments.map((segment) => (
                            <line
                              key={segment.id}
                              x1={segment.start.x}
                              y1={segment.start.y}
                              x2={segment.end.x}
                              y2={segment.end.y}
                              stroke="#94a3b8"
                              strokeWidth={Math.max(1.5, strokeWidth * 0.32)}
                              strokeDasharray={`${Math.max(
                                3,
                                strokeWidth * 0.9
                              )} ${Math.max(5, strokeWidth * 1.35)}`}
                              strokeLinecap="round"
                            />
                          ))}
                        </g>
                      )}

                      <g filter={`url(#${canvasShadowId})`}>
                        {shapeRegions.map((shape) => (
                          <path
                            key={`${shape.id}-underlay`}
                            d={getShapePath(
                              shape,
                              cornerRoundness,
                              randomizeRoundness,
                              seed
                            )}
                            fill="none"
                            stroke="#111827"
                            strokeOpacity="0.18"
                            strokeWidth={strokeWidth + 7}
                            strokeLinejoin="round"
                          />
                        ))}

                        {shapeRegions.map((shape) => (
                          <path
                            key={shape.id}
                            d={getShapePath(
                              shape,
                              cornerRoundness,
                              randomizeRoundness,
                              seed
                            )}
                            fill={`url(#${getCanvasTexturePatternId(
                              getSelectedTexture(shape)
                            )})`}
                            stroke="#0f172a"
                            strokeOpacity="0.28"
                            strokeWidth={strokeWidth}
                            strokeLinejoin="round"
                            filter={`url(#${canvasInnerShadowId})`}
                          />
                        ))}
                      </g>
                    </svg>
                  </Box>
                </Box>
              </Paper>

              {selectedGrindingShape && (
                <GrindingBench
                  shape={selectedGrindingShape}
                  texture={getSelectedTexture(selectedGrindingShape)}
                  seed={seed}
                  onDownloadObj={downloadStoneObjFromSnapshot}
                  onDownloadStoneFile={downloadStoneFile}
                />
              )}

              <StoneFilesPanel
                stones={loadedStoneSnapshots}
                textureById={textureById}
                onLoadFile={loadStoneFile}
                onRemove={removeLoadedStoneSnapshot}
                onClear={clearLoadedStoneSnapshots}
                onDownloadObj={downloadStoneObjFromSnapshot}
                onDownloadStoneFile={downloadStoneFile}
              />

              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: "1px solid rgba(15, 23, 42, 0.1)",
                  bgcolor: "rgba(255, 255, 255, 0.62)",
                }}
              >
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1.25}
                  alignItems={{ xs: "stretch", md: "center" }}
                  justifyContent="space-between"
                >
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip
                      icon={<BlurOnIcon />}
                      label={`${roundedCornerCount} concave corners`}
                      sx={{
                        bgcolor: "rgba(15, 118, 110, 0.1)",
                        color: "#115e59",
                        fontWeight: 700,
                      }}
                    />
                    {randomizeRoundness && (
                      <Chip
                        label="Variable roundness"
                        sx={{
                          bgcolor: "rgba(17, 138, 178, 0.12)",
                          color: "#075985",
                          fontWeight: 700,
                        }}
                      />
                    )}
                    <Chip
                      label={`${network.lines.length} square-cut lines`}
                      sx={{
                        bgcolor: "rgba(239, 71, 111, 0.11)",
                        color: "#9f1239",
                        fontWeight: 700,
                      }}
                    />
                  </Stack>
                  <Typography variant="body2" sx={{ color: "#475569" }}>
                    {Math.round((keptSegments.length / Math.max(1, totalSegments)) * 100)}
                    % of captured segments kept
                  </Typography>
                </Stack>
              </Paper>
            </Stack>

            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 2,
                border: "1px solid rgba(15, 23, 42, 0.12)",
                bgcolor: "rgba(255, 255, 255, 0.82)",
                backdropFilter: "blur(14px)",
                minWidth: 0,
              }}
            >
              <Stack spacing={1.5}>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      Shapes
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#64748b" }}>
                      Closed regions from the remaining segments
                    </Typography>
                  </Box>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    justifyContent="flex-end"
                    flexWrap="wrap"
                    useFlexGap
                  >
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AutoAwesomeIcon />}
                      onClick={randomizeShapeTextures}
                      disabled={shapeRegions.length === 0}
                      sx={{
                        borderColor: "rgba(15, 23, 42, 0.14)",
                        color: "#0f172a",
                        bgcolor: "rgba(255, 255, 255, 0.72)",
                        "&:hover": {
                          borderColor: "#0f766e",
                          bgcolor: "rgba(15, 118, 110, 0.08)",
                        },
                      }}
                    >
                      Random textures
                    </Button>
                    <Chip
                      label={shapeRegions.length}
                      sx={{
                        bgcolor: "rgba(15, 118, 110, 0.1)",
                        color: "#115e59",
                        fontWeight: 800,
                      }}
                    />
                  </Stack>
                </Stack>

                <Divider />

                <Stack
                  spacing={1}
                  sx={{
                    maxHeight: { lg: "calc(100vh - 230px)" },
                    overflowY: { lg: "auto" },
                    pr: { lg: 0.5 },
                  }}
                >
                  {shapeRegions.map((shape, index) => (
                    <ShapeListItem
                      key={shape.id}
                      shape={shape}
                      texture={getSelectedTexture(shape)}
                      textures={SHAPE_TEXTURES}
                      startIn3d={index === 0}
                      isGrindingSelected={shape.id === selectedGrindingShape?.id}
                      seed={seed}
                      onDownload={downloadShape}
                      onGrind={selectGrindingShape}
                      onTextureChange={updateShapeTexture}
                    />
                  ))}
                </Stack>
              </Stack>
            </Paper>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
