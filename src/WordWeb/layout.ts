import { WebSnapshot, WordEdge } from "./graph";

export interface Size { width: number; height: number }
export interface Point { x: number; y: number }
export interface Camera extends Point { zoom: number }

/** Move the camera, never the world. All nodes and curves share this one transform. */
export function cameraForFocus(web: WebSnapshot, viewport: Size, zoom: number, pan: Point = { x: 0, y: 0 }): Camera {
  const focus = web.nodes.find(node => node.id === web.focus) || { x: 0, y: 0 };
  // Pan is in world units, keeping the same map center when zoom changes.
  return { x: viewport.width / 2 + (pan.x - focus.x) * zoom, y: viewport.height / 2 + (pan.y - focus.y) * zoom, zoom };
}

/** Screen coordinates are useful for testing camera invariants, without re-laying out nodes. */
export function projectWeb(web: WebSnapshot, viewport: Size, zoom: number, pan?: Point): Map<string, Point> {
  const camera = cameraForFocus(web, viewport, zoom, pan);
  return new Map(web.nodes.map(node => [node.id, { x: camera.x + node.x * zoom, y: camera.y + node.y * zoom }]));
}

/** Curves are constructed in world coordinates, independent of focus and viewport size. */
export function worldEdgePath(edge: WordEdge, from: Point, to: Point): string {
  const offset = edge.kind === "synonym" ? 20 : edge.kind === "antonym" ? -20 : 0;
  const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy) || 1;
  return `M ${from.x} ${from.y} Q ${(from.x + to.x) / 2 - dy / length * offset} ${(from.y + to.y) / 2 + dx / length * offset} ${to.x} ${to.y}`;
}
