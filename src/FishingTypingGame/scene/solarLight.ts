import { SkyEvents } from '../engine/astronomy';
import { WorldConditions } from '../engine/types';
import { celestialPosition } from '../engine/world';
import contours from './skyline-contours';

const ridges = Object.fromEntries(Object.entries(contours).map(([season, points]) => [season,
  points.split(' ').map(point => point.split(',').map(Number)).filter(([x, y]) => x >= 0 && x <= 1 && y < .6),
])) as Record<WorldConditions['season'], number[][]>;
// Samples of the cove artwork's alpha edge, left to right (not a second skyline mask).
const coveRidge = [.264, .274, .257, .247, .260, .303, .290, .354, .330, .371, .380, .396, .378, .394, .374, .351, .338, .313, .331, .352, .361, .345, .319, .341, .359, .364, .273, .199, .143, .198, .084, .143, .131];
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export function ridgeHeight(x: number, season: WorldConditions['season'], location: string) {
  if (location === 'cove') {
    const index = clamp(x) * (coveRidge.length - 1), left = Math.min(coveRidge.length - 2, Math.floor(index));
    return coveRidge[left] + (coveRidge[left + 1] - coveRidge[left]) * (index - left);
  }
  const points = ridges[season];
  const right = points.findIndex(point => point[0] >= clamp(x));
  if (right <= 0) return points[right < 0 ? points.length - 1 : 0][1];
  const a = points[right - 1], b = points[right];
  return a[1] + (b[1] - a[1]) * (clamp(x) - a[0]) / Math.max(.00001, b[0] - a[0]);
}

/** The same 102% cover frame as lakeFrame(), converted back to artwork coordinates. */
export function solarLightAt(world: WorldConditions, location: string, width: number, height: number, events: SkyEvents = {}) {
  width = Math.max(1, width); height = Math.max(1, height);
  const aspect = location === 'cove' ? 1672 / 941 : 2;
  const frameWidth = Math.max(width * 1.02, height * 1.02 * aspect), frameHeight = frameWidth / aspect;
  const sun = celestialPosition(world.hour);
  const x = (sun.x / 100 * width - (width - frameWidth) / 2) / frameWidth;
  const y = (sun.y / 100 * height - (height - frameHeight) / 2) / frameHeight;
  const clearance = (ridgeHeight(x, world.season, location) - y) * frameHeight / height;
  const phase = world.hour < 12 ? 'sunrise' : 'sunset';
  const lowSun = world.hour < 12 ? 1 - smooth(8.8, 10.2, world.hour) : smooth(13.8, 15.2, world.hour);
  const glare = sun.visible ? lowSun * smooth(-.085, -.005, clearance) * (1 - smooth(.025, .15, clearance)) : 0;
  const delight = events.sailorsDelight?.strength ?? 0;
  return { sun, x, y, clearance, phase, glare, delight,
    ridgeDarkening: clamp(glare * .8 + delight * .6),
    core: phase === 'sunrise' ? '#fffde1' : '#fff2c7',
    halo: phase === 'sunrise' ? '255, 229, 130' : '255, 172, 69',
    outer: phase === 'sunrise' ? '237, 193, 92' : '222, 96, 49',
  };
}
export type SolarLight = ReturnType<typeof solarLightAt>;
