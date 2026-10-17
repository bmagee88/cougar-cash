import { SceneAsset, Season } from '../engine/types';
import { artwork } from '../engine/artwork';
export { ASSET_BASE } from '../engine/artwork';
export const BACKGROUND_PARALLAX = 0.02;
export const FOREGROUND_PARALLAX_SCALE = 0.75;
export const DOCK_PARALLAX = 0.72 * FOREGROUND_PARALLAX_SCALE;
export const FISHING_ART = {
  fisherman: artwork('characters/angler-painted.png'),
  rod: artwork('rods/willow-rod-painted.png'),
  bobber: artwork('lures/red-bobber-painted.png'),
  grassCover: artwork('effects/grass-cover-painted.png'),
  lantern: artwork('effects/lantern-painted.png'),
};
export const ANGLER_OUTFITS: Record<Season, string> = {
  spring: FISHING_ART.fisherman,
  summer: artwork('characters/angler-summer-painted.png'),
  autumn: artwork('characters/angler-autumn-painted.png'),
  winter: artwork('characters/angler-winter-painted.png'),
};
export const MOON_ART = artwork('weather/moon-painted.png');
const coveBase = 'locations/willow-cove/autumn';
export const COVE_SEASON_ART = Object.fromEntries((['spring','summer','autumn','winter'] as Season[]).map(season=>{
  const base=`locations/willow-cove/${season}`;
  return [season,{sky:artwork(`${base}/sky-painted.png`),landscape:artwork(`${base}/landscape-water-painted.png`),shore:artwork(`${base}/shore-seat-painted.png`),willowLeft:artwork(`${base}/willow-left-painted.png`),willowRight:artwork(`${base}/willow-right-painted.png`)}];
})) as Record<Season,{sky:string;landscape:string;shore:string;willowLeft:string;willowRight:string}>;
export const COVE_AUTUMN_ART = {
  sky: artwork(`${coveBase}/sky-painted.png`), clouds: artwork(`${coveBase}/clouds-painted.png`),
  landscape: artwork(`${coveBase}/landscape-water-painted.png`), shore: artwork(`${coveBase}/shore-seat-painted.png`),
  willowLeft: artwork(`${coveBase}/willow-left-painted.png`), willowRight: artwork(`${coveBase}/willow-right-painted.png`),
};
// The bank and seated model share this undistorted canvas, including on phones.
export const COVE_GROUND_FRAME = { minWidth: 780, aspectRatio: 1672 / 941, screenSeatX: 0.24 };
export const BIRCH_GROUND_FRAME = { minWidth: 780, aspectRatio: 2, screenSeatX: 0.24 };
export const BIRCH_SEAT = { x: .24, y: .76, characterWidth: .13 };
/** Shared by foreground art, angler and the foreground tree-map overlay. */
export function shoreFrameStyle(location: string, seatX: number, parallax = DOCK_PARALLAX) {
  const frame = location === 'birch' ? BIRCH_GROUND_FRAME : COVE_GROUND_FRAME;
  return {
    '--cove-min-width': `${frame.minWidth}px`, '--cove-cover-width': `${frame.aspectRatio * 100}cqh`,
    '--cove-seat-screen-x': `${frame.screenSeatX * 100}%`, '--cove-seat-x': seatX,
    '--ground-parallax': parallax, aspectRatio: frame.aspectRatio,
  };
}
export const SEASON_ART = Object.fromEntries((['spring', 'summer', 'autumn', 'winter'] as Season[]).map(season => [season, {
  background: artwork(`locations/cedar/${season === 'autumn' ? '' : `${season}/`}lake-background-painted.png`),
  bank: artwork(`locations/cedar/${season === 'autumn' ? '' : `${season}/`}grass-bank-painted.png`),
  reeds: artwork(`locations/cedar/${season === 'autumn' ? '' : `${season}/`}reeds-painted.png`),
  willow: artwork(`locations/cedar/${season === 'autumn' ? '' : `${season}/`}willow.svg`),
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
  id, src: artwork(file), format: file.endsWith('.png') ? 'webp' : 'svg',
  zIndex, position: { x, y, width, height }, opacity: 1, scale: 1, parallax: 0, ...extra,
});
export const CEDAR_SCENE: SceneAsset[] = [
  layer('lake-background', 'locations/cedar/lake-background-painted.png', 0, -1, -1, 102, 102, { parallax: BACKGROUND_PARALLAX, weatherResponse: true }),
  { id: 'clouds', format: 'procedural', zIndex: 2, position: { x: 0, y: 0, width: 100, height: 100 }, opacity: 1, scale: 1, parallax: 0, weatherResponse: true },
  layer('near-shore', 'locations/cedar/grass-bank-painted.png', 5, -6, 48, 49, 49, { aspectRatio:1.5, parallax: DOCK_PARALLAX, weatherResponse: true, spots: ['dock'] }),
  layer('dock', 'locations/cedar/dock-painted.png', 7, -4, 60, 42, 56, { aspectRatio:1.5, parallax: DOCK_PARALLAX, spots: ['dock'] }),
  layer('cove-bank', 'locations/cedar/grass-bank-painted.png', 7, -7, 20, 54, 52, { aspectRatio:1.5, parallax: DOCK_PARALLAX, weatherResponse: true, spots: ['cove'] }),
  layer('right-grassy-bank', 'locations/cedar/grass-bank-painted.png', 6, 80, 72, 30, 34, { parallax: 0.95 * FOREGROUND_PARALLAX_SCALE, flipX: true, weatherResponse: true }),
  layer('waterfall', 'locations/cedar/waterfall.svg', 5, 85, 37, 6, 19, { parallax: 0.2, spots: ['cove'], animation: 'shimmer' }),
  layer('willow', 'locations/cedar/willow.svg', 9, -6, 26, 25, 65, { parallax: 0.9 * FOREGROUND_PARALLAX_SCALE, spots: ['cove'], animation: 'sway', weatherResponse: true }),
  layer('foreground-reeds', 'locations/cedar/reeds-painted.png', 10, -6, 65, 112, 40, { parallax: 1.25 * FOREGROUND_PARALLAX_SCALE, weatherResponse: true, animation: 'sway' }),
  { id: 'weather', format: 'procedural', zIndex: 11, position: { x: 0, y: 0, width: 100, height: 100 }, opacity: 1, scale: 1, parallax: 0, weatherResponse: true },
  { id: 'water-interactions', format: 'procedural', zIndex: 8, position: { x: 0, y: 0, width: 100, height: 100 }, opacity: 1, scale: 1, parallax: BACKGROUND_PARALLAX, interactionResponse: true },
  { id: 'angler', format: 'procedural', zIndex: 8, position: { x: 0, y: 0, width: 100, height: 100 }, opacity: 1, scale: 1, parallax: DOCK_PARALLAX, interactionResponse: true },
];
function coveScene(season:Season):SceneAsset[] {
  const base=`locations/willow-cove/${season}`;
  return [
  layer('sky', `${base}/sky-painted.png`, 0, -1, -1, 102, 102),
  ...CEDAR_SCENE.filter(l => l.id === 'clouds'),
  layer('cove-landscape', `${base}/landscape-water-painted.png`, 3, -1, -1, 102, 102, { parallax: BACKGROUND_PARALLAX, weatherResponse: true }),
  layer('cove-seat', `${base}/shore-seat-painted.png`, 7, 0, 0, 100, 100, { parallax: DOCK_PARALLAX, weatherResponse: true, seat: { x: .29, y: .70, characterWidth: .15 } }),
  layer('willow-branches-left', `${base}/willow-left-painted.png`, 9, -7, -12, 72, 50, { parallax: .9 * FOREGROUND_PARALLAX_SCALE, animation: 'willow', weatherResponse: true, aspectRatio: 1672 / 940, minWidth: 580 }),
  layer('willow-branches-right', `${base}/willow-right-painted.png`, 10, 35, -11, 50, 42, { parallax: 1.1 * FOREGROUND_PARALLAX_SCALE, animation: 'willow', weatherResponse: true, aspectRatio: 1672 / 941, minWidth: 320 }),
  ...CEDAR_SCENE.filter(l => ['weather', 'water-interactions', 'angler'].includes(l.id)),
];
}
export const COVE_SCENES=Object.fromEntries((['spring','summer','autumn','winter'] as Season[]).map(season=>[season,coveScene(season)])) as Record<Season,SceneAsset[]>;
export const COVE_AUTUMN_SCENE=COVE_SCENES.autumn;

function birchScene(season: Season): SceneAsset[] {
  const base = `locations/birch-point/${season}`;
  return [
    layer('birch-sky', 'locations/birch-point/shared/sky-painted.png', 0, 0, 0, 100, 100),
    ...CEDAR_SCENE.filter(l => l.id === 'clouds'),
    layer('birch-mountains', `${base}/mountains-painted.png`, 3, 0, 0, 100, 100, { parallax: BACKGROUND_PARALLAX, weatherResponse: true }),
    layer('birch-far-trees', `${base}/far-trees-painted.png`, 3, 0, 0, 100, 100, { parallax: BACKGROUND_PARALLAX, weatherResponse: true }),
    layer('birch-treeline-water', `${base}/treeline-water-painted.png`, 3, 0, 0, 100, 100, { parallax: BACKGROUND_PARALLAX, weatherResponse: true }),
    layer('birch-seat', `${base}/shore-seat-painted.png`, 7, 0, 0, 100, 100, { parallax: DOCK_PARALLAX, weatherResponse: true, seat: BIRCH_SEAT }),
    layer('birch-trunks', `${base}/birches-painted.png`, 9, 0, 0, 100, 100, { weatherResponse: true }),
    layer('birch-right-plants', `${base}/right-plants-painted.png`, 10, 0, 0, 100, 100, { weatherResponse: true }),
    ...CEDAR_SCENE.filter(l => ['weather', 'water-interactions', 'angler'].includes(l.id)),
  ];
}
export const BIRCH_SCENES = Object.fromEntries((['spring', 'summer', 'autumn', 'winter'] as Season[]).map(season => [season, birchScene(season)])) as Record<Season, SceneAsset[]>;

export function sceneForLocation(season: Season, location: string, manifest: SceneAsset[] = CEDAR_SCENE) {
  const selected = manifest === CEDAR_SCENE ? location === 'birch' ? BIRCH_SCENES[season] : location === 'cove' ? COVE_SCENES[season] : manifest : manifest;
  return sceneForSeason(season, selected);
}
