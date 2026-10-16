import { skyRandom } from './astronomy';
import { SEASONS, WorldConditions } from './types';

type FogWorld = Pick<WorldConditions, 'gameDay' | 'hour' | 'season'>;
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const fogSeed = (world: FogWorld) => Math.imul(world.gameDay, 1009) + SEASONS.indexOf(world.season) * 7919 + 0x4c414b45;

/** Lake mist has its own daily roll, independent of the weather and reloads.
 * The 48-minute world clock already provides all the updates this needs. */
export function lakeFogAt(world: FogWorld) {
  const seed = fogSeed(world), winter = world.season === 'winter';
  const occurs = skyRandom(seed) < (winter ? .22 : .85);
  const startHour = 2.2 + skyRandom(seed + 1) * .9;
  const peakHour = 4.8 + skyRandom(seed + 2) * .6;
  const liftHour = 5.9 + skyRandom(seed + 3) * .8;
  const endHour = 9.3 + skyRandom(seed + 4) * 2.1;
  const peak = (world.season === 'autumn' ? .55 : .38) + skyRandom(seed + 5) * (world.season === 'autumn' ? .45 : .60);
  const envelope = smooth((world.hour - startHour) / (peakHour - startHour)) * (1 - smooth((world.hour - liftHour) / (endHour - liftHour)));
  const density = occurs ? peak * envelope : 0;
  return { id: `lake-fog-${world.gameDay}-${world.season}`, occurs, startHour, peakHour, liftHour, endHour, peak, density: density < .005 ? 0 : density };
}

/** Keep manually selected/natural fog weather, with slowly varying thickness. */
export function weatherFogDensity(world: FogWorld) {
  const seed = fogSeed(world) + 35771;
  const base = .62 + skyRandom(seed) * .30;
  return base + Math.sin(world.hour * Math.PI / 5 + skyRandom(seed + 1) * Math.PI * 2) * .05;
}
