export interface WaterPoint { x: number; y: number }
export interface ReelPath { far: WaterPoint; near: WaterPoint }

// Shared by the float and cover patches: normalized scene coordinates.
export function reelPath(distance: number, near: WaterPoint = { x: .39, y: .88 }): ReelPath {
  return { far: { x: .60 + (distance - 1) * .18, y: .6775 - (distance - 1) * .055 }, near };
}
export function pointOnReelPath(path: ReelPath, progress: number): WaterPoint {
  const at = Math.max(0, Math.min(1, progress));
  return { x: path.far.x + (path.near.x - path.far.x) * at, y: path.far.y + (path.near.y - path.far.y) * at };
}
export function coverPatches(cover: readonly boolean[], phraseLength: number) {
  const patches: { start: number; end: number; at: number }[] = [];
  for (let i = 0; i < Math.min(cover.length, phraseLength); i++) {
    if (!cover[i]) continue;
    const start = i;
    while (i + 1 < phraseLength && cover[i + 1]) i++;
    patches.push({ start, end: i, at: (start + i) / 2 / phraseLength });
  }
  return patches;
}
