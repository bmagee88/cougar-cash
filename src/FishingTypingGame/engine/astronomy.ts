import { WorldConditions } from './types';

// Degrees per mean solar day: Earth's sidereal spin minus the Moon's orbital drift.
export const SKY_RATES = { stars: 360.985647, moon: 360.985647 - 13.176358 };
const radians = Math.PI / 180;
export const wrapDegrees = (angle: number) => ((angle % 360) + 360) % 360;
export const siderealAngle = (world: Pick<WorldConditions, 'gameDay' | 'hour'>) => wrapDegrees(20 + (world.gameDay + world.hour / 24) * SKY_RATES.stars);

/** South-facing lake at 45 N. Actual equatorial coordinates become local azimuth/altitude. */
export function projectStar(ra: number, dec: number, angle: number, shoreline = .5) {
  const hourAngle = (angle - ra) * radians, latitude = 45 * radians, declination = dec * radians;
  const west = Math.cos(declination) * Math.sin(hourAngle);
  const north = Math.cos(latitude) * Math.sin(declination) - Math.sin(latitude) * Math.cos(declination) * Math.cos(hourAngle);
  const up = Math.sin(latitude) * Math.sin(declination) + Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle);
  const altitude = Math.asin(Math.max(-1, Math.min(1, up))) / radians;
  const azimuth = Math.atan2(west, -north) / radians;
  return { x: .5 + azimuth / 160, y: shoreline - altitude / 120, altitude };
}

export type SkyPreview = { aurora?: boolean; meteors?: boolean };
export interface SkyEvent { id: string; night: number; startHour: number; endHour: number; strength: number }
export interface SkyEvents { aurora?: SkyEvent; meteors?: SkyEvent }
export function skyRandom(seed: number) {
  let n = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
/** Independent game-calendar events, never chosen from or gated by the weather enum. */
export function skyEventsAt(world: Pick<WorldConditions, 'gameDay' | 'hour'>, preview: SkyPreview = {}): SkyEvents {
  const night = world.gameDay - (world.hour < 12 ? 1 : 0);
  const hour = world.hour < 12 ? world.hour + 24 : world.hour;
  const event = (kind: keyof SkyEvents, salt: number, chance: number, start: number, duration: number): SkyEvent | undefined => {
    const seed = Math.imul(night, 1013) + salt;
    const startHour = start + skyRandom(seed + 1) * 3;
    const endHour = startHour + duration + skyRandom(seed + 2) * 3;
    const natural = skyRandom(seed) < chance && hour >= startHour && hour < endHour;
    return (preview[kind] ?? natural) ? { id: `${kind}-${night}`, night, startHour, endHour, strength: .55 + skyRandom(seed + 3) * .45 } : undefined;
  };
  return { aurora: event('aurora', 17377, .07, 20, 4), meteors: event('meteors', 83047, .14, 21, 4) };
}

/** All shower trails extrapolate back toward one celestial radiant. */
export function showerRadiant(event: SkyEvent, angle: number, shoreline: number) {
  const ra = siderealAngle({ gameDay: event.night + 1, hour: 0 }) + (skyRandom(event.night + 674) - .5) * 40;
  return projectStar(ra, 25 + skyRandom(event.night + 687) * 20, angle, shoreline);
}
