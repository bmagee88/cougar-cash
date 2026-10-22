import type { WordEdge, WordNode } from "./graph";
import type { Camera, Point, Size } from "./layout";

export interface DotCluster extends Point {
  id: string;
  members: string[];
  representative: string;
  radius: number;
  onTrail: boolean;
}
export interface SceneEdge extends WordEdge { onTrail: boolean }

/** Do not paint a connection before either of its visible endpoints is ready. */
export function buildDrawingFrame(scene: { nodes: WordNode[]; clusters: DotCluster[]; edges: SceneEdge[] }, nodeBudget: number, edgeBudget: number) {
  if (nodeBudget >= scene.nodes.length + scene.clusters.length && edgeBudget >= scene.edges.length) return scene;
  const nodes = scene.nodes.slice(0, nodeBudget);
  const clusters = scene.clusters.slice(0, Math.max(0, nodeBudget - scene.nodes.length));
  const waiting = new Set([
    ...scene.nodes.slice(nodes.length).map(node => node.id),
    ...scene.clusters.slice(clusters.length).map(cluster => cluster.id),
  ]);
  const edges = scene.edges.slice(0, edgeBudget).filter(edge => !waiting.has(edge.from) && !waiting.has(edge.to));
  return { nodes, clusters, edges };
}

/** Presentation only: never changes the saved graph, positions, or navigation trail. */
export function buildRenderScene(nodes: WordNode[], edges: WordEdge[], camera: Camera, viewport: Size,
  degrees: Map<string, number>, trail: Set<string>, trailEdges: Set<string>, important: Set<string>, baseFont = 19, selectedWord?: string | null, labelsOnly = false) {
  const positions = new Map<string, Point>();
  const projected = new Map<Point, Point>();
  const dots = new Set<string>();
  const onscreen: WordNode[] = [];
  const screen = (point: Point) => {
    let cached = projected.get(point);
    if (!cached) { cached = { x: camera.x + point.x * camera.zoom, y: camera.y + point.y * camera.zoom }; projected.set(point, cached); }
    return cached;
  };
  const buffer = 160;
  const intersects = (left: number, top: number, right: number, bottom: number) => right >= -buffer && left <= viewport.width + buffer && bottom >= -buffer && top <= viewport.height + buffer;
  const segmentVisible = (start: Point, end: Point, curve: number) => {
    let near = 0, far = 1;
    const margin = buffer + curve;
    for (let axis = 0; axis < 2; axis++) {
      const origin = axis === 0 ? start.x : start.y;
      const delta = (axis === 0 ? end.x : end.y) - origin;
      const min = -margin, max = (axis === 0 ? viewport.width : viewport.height) + margin;
      if (delta === 0) { if (origin < min || origin > max) return false; continue; }
      const a = (min - origin) / delta, b = (max - origin) / delta;
      near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
      if (near > far) return false;
    }
    return true;
  };
  for (const node of nodes) {
    positions.set(node.id, node);
    const font = Math.max(baseFont + (degrees.get(node.id) || 0) * 4, selectedWord === node.id && camera.zoom < .45 ? 14 / camera.zoom : 0);
    const dot = labelsOnly ? false : selectedWord && camera.zoom < .45
      ? node.id !== selectedWord
      : font * camera.zoom < 10 && !important.has(node.id);
    const point = screen(node);
    const halfWidth = dot ? 8 : (node.id.length * font * .4 + 30) * camera.zoom;
    const halfHeight = dot ? 8 : (font + 24) * camera.zoom;
    if (!intersects(point.x - halfWidth, point.y - halfHeight, point.x + halfWidth, point.y + halfHeight)) continue;
    onscreen.push(node);
    if (dot) dots.add(node.id);
  }

  // Spatial bins only compare nearby dots. Adjacent bins are checked too, so
  // clusters are not split simply because a pair straddles a cell boundary.
  const radius = 42, cellSize = 20, cells = new Map<string, number>();
  // Trail dots remain individual nodes so their route never collapses into a cluster.
  const candidates = onscreen.filter(node => dots.has(node.id) && !trail.has(node.id) && !important.has(node.id));
  const parents = candidates.map((_, index) => index);
  const find = (index: number): number => {
    let root = index;
    while (parents[root] !== root) root = parents[root];
    while (parents[index] !== index) { const next = parents[index]; parents[index] = root; index = next; }
    return root;
  };
  candidates.forEach((node, index) => {
    const point = screen(node), cx = Math.floor(point.x / cellSize), cy = Math.floor(point.y / cellSize);
    for (let x = cx - 2; x <= cx + 2; x++) for (let y = cy - 2; y <= cy + 2; y++) {
      const other = cells.get(`${x},${y}`);
      if (other !== undefined) {
        const neighbor = screen(candidates[other]);
        if (Math.hypot(point.x - neighbor.x, point.y - neighbor.y) <= radius) parents[find(index)] = find(other);
      }
    }
    const key = `${cx},${cy}`;
    // One representative bounds dense-cluster work instead of comparing every pair.
    if (!cells.has(key)) cells.set(key, index);
  });
  const groups = new Map<number, WordNode[]>();
  candidates.forEach((node, index) => {
    const root = find(index);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(node);
  });
  const clusters: DotCluster[] = [], replacements = new Map<string, string>();
  groups.forEach(members => {
    if (members.length < 2) return;
    const id = `cluster:${members[0].id}`;
    const representative = members.reduce((best, node) => (degrees.get(node.id) || 0) > (degrees.get(best.id) || 0) ? node : best).id;
    const cluster = { id, members: members.map(node => node.id), representative, x: members.reduce((sum, node) => sum + node.x, 0) / members.length,
      y: members.reduce((sum, node) => sum + node.y, 0) / members.length, radius: Math.min(26, 5 + Math.sqrt(members.length) * 2), onTrail: members.some(node => trail.has(node.id)) };
    clusters.push(cluster); positions.set(id, cluster);
    members.forEach(node => replacements.set(node.id, id));
  });

  const sceneEdges = new Map<string, SceneEdge>();
  for (const edge of edges) {
    const from = replacements.get(edge.from) || edge.from, to = replacements.get(edge.to) || edge.to;
    if (from === to) continue;
    const a = positions.get(from), b = positions.get(to);
    if (!a || !b) continue;
    const start = screen(a), end = screen(b);
    // The curve control point is at most 20 world units off the segment.
    const curve = 20 * camera.zoom;
    if (!intersects(Math.min(start.x, end.x) - curve, Math.min(start.y, end.y) - curve, Math.max(start.x, end.x) + curve, Math.max(start.y, end.y) + curve)) continue;
    if (!segmentVisible(start, end, curve)) continue;
    const merged = from !== edge.from || to !== edge.to;
    const id = merged ? JSON.stringify([...([from, to].sort()), edge.kind]) : edge.id;
    const prior = sceneEdges.get(id);
    sceneEdges.set(id, { ...edge, id, from, to, traversed: edge.traversed || Boolean(prior?.traversed), onTrail: trailEdges.has(edge.id) || Boolean(prior?.onTrail) });
  }
  const priorityNodes: WordNode[] = [], trailNodes: WordNode[] = [], otherNodes: WordNode[] = [];
  for (const node of onscreen) {
    if (replacements.has(node.id)) continue;
    if (important.has(node.id)) priorityNodes.push(node);
    else if (trail.has(node.id)) trailNodes.push(node);
    else otherNodes.push(node);
  }
  const visibleNodes = onscreen.filter(node => !replacements.has(node.id));
  const needsBatches = visibleNodes.length + clusters.length + sceneEdges.size > 500;
  return { nodes: needsBatches ? [...priorityNodes, ...trailNodes, ...otherNodes] : visibleNodes, edges: Array.from(sceneEdges.values()), dots, clusters, positions, lowDetail: camera.zoom < .45 };
}
