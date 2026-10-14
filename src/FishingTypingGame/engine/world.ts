import { DAY_PERIODS, DayPeriod, MOON_PHASES, MoonPhase, SEASONS, Season, WorldConditions, WorldOverrides } from './types';

export const WORLD = { dayMs: 48 * 60 * 1000, timezone: 'America/New_York', epoch: Date.parse('2026-10-10T00:00:00-04:00') };
export const SEASON_LABELS: Record<Season, string> = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };
export const PERIOD_LABELS: Record<DayPeriod, string> = { dawn: 'Dawn', morning: 'Morning', afternoon: 'Afternoon', dusk: 'Dusk', 'early-night': 'Early night', 'late-night': 'Late night' };
export const MOON_LABELS: Record<MoonPhase, string> = { full: 'Full moon', 'waning-three-quarter': 'Three-quarters full · waning', 'waning-half': 'Half full · waning', 'waning-quarter': 'One-quarter full · waning', new: 'New moon', 'waxing-quarter': 'One-quarter full · waxing', 'waxing-half': 'Half full · waxing', 'waxing-three-quarter': 'Three-quarters full · waxing' };
export const MOON_LIGHT = [1, 0.75, 0.5, 0.25, 0, 0.25, 0.5, 0.75];
const dateFormatter = new Intl.DateTimeFormat('en-US', { timeZone: WORLD.timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
const mod = (n: number, divisor: number) => ((n % divisor) + divisor) % divisor;
export function periodAt(hour: number): DayPeriod { return DAY_PERIODS[mod(Math.floor(mod(hour, 24) / 4) - 1, 6)]; }
export function worldAt(now: number, overrides: WorldOverrides = {}): WorldConditions {
  const parts = dateFormatter.formatToParts(now);
  const part = (kind: string) => parts.find(p => p.type === kind)!.value;
  const seasonDate = `${part('year')}-${part('month')}-${part('day')}`;
  const calendarDays = Math.round((Date.parse(`${seasonDate}T00:00:00Z`) - Date.parse('2026-10-10T00:00:00Z')) / 86400000);
  const gameDay = Math.floor((now - WORLD.epoch) / WORLD.dayMs);
  const hour = overrides.hour === undefined ? mod(now - WORLD.epoch, WORLD.dayMs) / WORLD.dayMs * 24 : mod(overrides.hour, 24);
  return { season: overrides.season ?? SEASONS[mod(calendarDays, 4)], period: periodAt(hour), moonPhase: overrides.moonPhase ?? MOON_PHASES[mod(gameDay, 8)], hour, dayProgress: hour / 24, gameDay, seasonDate };
}
export function gameClock(hour: number) { const minutes = Math.floor(hour * 60); return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; }
export function celestialPosition(hour: number, moon = false) {
  const elapsed = moon ? mod(hour - 18, 24) : mod(hour - 6, 24);
  const travel = Math.min(1, elapsed / 12);
  return { x: 10 + travel * 80, y: 35 - Math.sin(travel * Math.PI) * 26, visible: elapsed < 12 };
}
const LIGHT = [
  { hour: 0, brightness: 0.43, saturation: 0.88, tint: [10, 22, 57, 0.35] },
  { hour: 4, brightness: 0.43, saturation: 0.88, tint: [10, 22, 57, 0.35] },
  { hour: 6, brightness: 0.73, saturation: 0.91, tint: [202, 108, 116, 0.24] },
  { hour: 8, brightness: 1, saturation: 1.02, tint: [245, 219, 145, 0.08] },
  { hour: 12, brightness: 1.02, saturation: 1.03, tint: [220, 239, 230, 0] },
  { hour: 16, brightness: 0.98, saturation: 1.08, tint: [244, 193, 111, 0.08] },
  { hour: 18, brightness: 0.75, saturation: 0.96, tint: [187, 91, 91, 0.25] },
  { hour: 20, brightness: 0.48, saturation: 0.90, tint: [20, 31, 70, 0.33] },
  { hour: 24, brightness: 0.43, saturation: 0.88, tint: [10, 22, 57, 0.35] },
];
export function lightingAt(hour: number, moonPhase: MoonPhase) {
  const hi = LIGHT.findIndex(p => p.hour > hour); const a = LIGHT[Math.max(0, hi - 1)]; const b = LIGHT[hi < 0 ? LIGHT.length - 1 : hi];
  const blend = Math.max(0, Math.min(1, (hour - a.hour) / Math.max(1, b.hour - a.hour)));
  const mix = (x: number, y: number) => x + (y - x) * blend;
  const night = hour < 6 ? Math.min(1, (6 - hour) / 2) : Math.max(0, Math.min(1, (hour - 18) / 2));
  const brightness = mix(a.brightness, b.brightness) + MOON_LIGHT[MOON_PHASES.indexOf(moonPhase)] * night * 0.07;
  // Fully developed night uses half the former brightness; twilight eases into it.
  return { brightness: brightness * (1 - night * .5), saturation: mix(a.saturation, b.saturation), nightAmount: night, tint: `rgba(${a.tint.slice(0, 3).map((v, i) => Math.round(mix(v, b.tint[i]))).join(',')},${mix(a.tint[3], b.tint[3]).toFixed(3)})`, stars: night * (hour < 6 ? .5 + .5 * Math.min(1, hour / 2) : .5) };
}

/** Visible moonlight follows the real sky, even when weather borrows a night preset. */
export function moonlightAt(hour: number, moonPhase: MoonPhase, skyVisibility = 1) {
  const moon = celestialPosition(hour, true);
  const elevation = moon.visible ? Math.max(0, (35 - moon.y) / 26) : 0;
  const phase = MOON_LIGHT[MOON_PHASES.indexOf(moonPhase)];
  return phase * Math.pow(elevation, 1.2) * lightingAt(hour, moonPhase).nightAmount * Math.max(0, Math.min(1, skyVisibility));
}
