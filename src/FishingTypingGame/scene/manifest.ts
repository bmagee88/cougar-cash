import { SceneAsset, Season } from '../engine/types';
export const ASSET_BASE = `${process.env.PUBLIC_URL || ''}/assets/fishing`;
export const BACKGROUND_PARALLAX = 0.02;
export const FOREGROUND_PARALLAX_SCALE = 0.75;
export const DOCK_PARALLAX = 0.72 * FOREGROUND_PARALLAX_SCALE;
export const FISHING_ART = {
  fisherman: `${ASSET_BASE}/characters/angler-painted.png`,
  rod: `${ASSET_BASE}/rods/willow-rod-painted.png`,
  bobber: `${ASSET_BASE}/lures/red-bobber-painted.png`,
  grassCover: `${ASSET_BASE}/effects/grass-cover-painted.png`,
};
export const ANGLER_OUTFITS: Record<Season, string> = {
  spring: FISHING_ART.fisherman,
  summer: `${ASSET_BASE}/characters/angler-summer-painted.png`,
  autumn: `${ASSET_BASE}/characters/angler-autumn-painted.png`,
  winter: `${ASSET_BASE}/characters/angler-winter-painted.png`,
};
export const MOON_ART = `${ASSET_BASE}/weather/moon-painted.png`;
const coveBase = `${ASSET_BASE}/locations/willow-cove/autumn`;
export const COVE_AUTUMN_ART = {
  sky: `${coveBase}/sky-painted.png`, clouds: `${coveBase}/clouds-painted.png`,
  landscape: `${coveBase}/landscape-water-painted.png`, shore: `${coveBase}/shore-seat-painted.png`,
  willowLeft: `${coveBase}/willow-left-painted.png`, willowRight: `${coveBase}/willow-right-painted.png`,
};
// The bank and seated model share this undistorted canvas, including on phones.
export const COVE_GROUND_FRAME = { minWidth: 780, aspectRatio: 1672 / 941, screenSeatX: 0.24 };
export const SEASON_ART = Object.fromEntries((['spring', 'summer', 'autumn', 'winter'] as Season[]).map(season => [season, {
  background: `${ASSET_BASE}/locations/cedar/${season === 'autumn' ? '' : `${season}/`}lake-background-painted.png`,
  bank: `${ASSET_BASE}/locations/cedar/${season === 'autumn' ? '' : `${season}/`}grass-bank-painted.png`,
  reeds: `${ASSET_BASE}/locations/cedar/${season === 'autumn' ? '' : `${season}/`}reeds-painted.png`,
  willow: `${ASSET_BASE}/locations/cedar/${season === 'autumn' ? '' : `${season}/`}willow.svg`,
}])) as Record<Season, { background: string; bank: string; reeds: string; willow: string }>;
export function sceneForSeason(season: Season, manifest: SceneAsset[] = CEDAR_SCENE): SceneAsset[] {
  const art = SEASON_ART[season];
  return manifest.map(layer => layer.id === 'lake-background' ? { ...layer, src: art.background } : ['near-shore', 'cove-bank', 'right-grassy-bank'].includes(layer.id) ? { ...layer, src: art.bank } : layer.id === 'foreground-reeds' ? { ...layer, src: art.reeds } : layer.id === 'willow' ? { ...layer, src: art.willow } : layer);
}
// Normalized attachment points keep separately painted equipment easy to swap.
export const ANGLER_RIG = {
  hand: { x: 0.85, y: 0.435 },
  rod: { width: 1.2, height: 0.63, grip: { x: 0.21, y: 0.75 }, tip: { x: 0.965, y: 0.035 } },
  // Align the painted hips to a point on the dock's top planks, at every size.
  seat: { x: 0.32, y: 0.58 },
  lap: { x: 0.58, y: 0.51, fishWidth: 0.60 },
  dockSeat: { x: 0.70, y: 0.40, characterWidth: 0.34 },
};
const layer = (id: string, file: string, zIndex: number, x: number, y: number, width: number, height: number, extra: Partial<SceneAsset> = {}): SceneAsset => ({
  id, src: `${ASSET_BASE}/${file}`, format: file.endsWith('.png') ? 'png' : 'svg',
  zIndex, position: { x, y, width, height }, opacity: 1, scale: 1, parallax: 0, ...extra,
});
export const CEDAR_SCENE: SceneAsset[] = [
  layer('lake-background', 'locations/cedar/lake-background-painted.png', 0, -1, -1, 102, 102, { parallax: BACKGROUND_PARALLAX, weatherResponse: true }),
  { id: 'clouds', format: 'procedural', zIndex: 2, position: { x: 0, y: 0, width: 100, height: 100 }, opacity: 1, scale: 1, parallax: 0, weatherResponse: true },
  layer('near-shore', 'locations/cedar/grass-bank-painted.png', 5, -6, 48, 49, 49, { parallax: DOCK_PARALLAX, weatherResponse: true, spots: ['dock'] }),
  layer('dock', 'locations/cedar/dock-painted.png', 7, -4, 68, 42, 35, { parallax: DOCK_PARALLAX, spots: ['dock'] }),
  layer('cove-bank', 'locations/cedar/grass-bank-painted.png', 7, -7, 51, 54, 52, { parallax: DOCK_PARALLAX, weatherResponse: true, spots: ['cove'] }),
  layer('right-grassy-bank', 'locations/cedar/grass-bank-painted.png', 6, 80, 72, 30, 34, { parallax: 0.95 * FOREGROUND_PARALLAX_SCALE, flipX: true, weatherResponse: true }),
  layer('waterfall', 'locations/cedar/waterfall.svg', 5, 85, 37, 6, 19, { parallax: 0.2, spots: ['cove'], animation: 'shimmer' }),
  layer('willow', 'locations/cedar/willow.svg', 9, -6, 26, 25, 65, { parallax: 0.9 * FOREGROUND_PARALLAX_SCALE, spots: ['cove'], animation: 'sway', weatherResponse: true }),
  layer('foreground-reeds', 'locations/cedar/reeds-painted.png', 10, -6, 65, 112, 40, { parallax: 1.25 * FOREGROUND_PARALLAX_SCALE, weatherResponse: true, animation: 'sway' }),
  { id: 'weather', format: 'procedural', zIndex: 11, position: { x: 0, y: 0, width: 100, height: 100 }, opacity: 1, scale: 1, parallax: 0, weatherResponse: true },
  { id: 'water-interactions', format: 'procedural', zIndex: 8, position: { x: 0, y: 0, width: 100, height: 100 }, opacity: 1, scale: 1, parallax: BACKGROUND_PARALLAX, interactionResponse: true },
  { id: 'angler', format: 'procedural', zIndex: 8, position: { x: 0, y: 0, width: 100, height: 100 }, opacity: 1, scale: 1, parallax: DOCK_PARALLAX, interactionResponse: true },
];
export const COVE_AUTUMN_SCENE: SceneAsset[] = [
  layer('sky', 'locations/willow-cove/autumn/sky-painted.png', 0, -1, -1, 102, 102),
  ...CEDAR_SCENE.filter(l => l.id === 'clouds'),
  layer('cove-landscape', 'locations/willow-cove/autumn/landscape-water-painted.png', 3, -1, -1, 102, 102, { parallax: BACKGROUND_PARALLAX, weatherResponse: true }),
  layer('cove-seat', 'locations/willow-cove/autumn/shore-seat-painted.png', 7, 0, 0, 100, 100, { parallax: DOCK_PARALLAX, weatherResponse: true, seat: { x: .29, y: .70, characterWidth: .15 } }),
  layer('willow-branches-left', 'locations/willow-cove/autumn/willow-left-painted.png', 9, -7, -12, 72, 50, { parallax: .9 * FOREGROUND_PARALLAX_SCALE, animation: 'willow', weatherResponse: true, aspectRatio: 1672 / 940, minWidth: 580 }),
  layer('willow-branches-right', 'locations/willow-cove/autumn/willow-right-painted.png', 10, 35, -11, 50, 42, { parallax: 1.1 * FOREGROUND_PARALLAX_SCALE, animation: 'willow', weatherResponse: true, aspectRatio: 1672 / 941, minWidth: 320 }),
  ...CEDAR_SCENE.filter(l => ['weather', 'water-interactions', 'angler'].includes(l.id)),
];

export function sceneForLocation(season: Season, location: string, manifest: SceneAsset[] = CEDAR_SCENE) {
  const selected = manifest === CEDAR_SCENE && location === 'cove' && season === 'autumn' ? COVE_AUTUMN_SCENE : manifest;
  return sceneForSeason(season, selected);
}
