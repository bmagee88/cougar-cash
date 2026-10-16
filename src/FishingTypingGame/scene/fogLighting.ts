import { MoonPhase } from '../engine/types';
import { lightingAt, moonlightAt } from '../engine/world';

/** Scattered daylight becomes blue-grey in darkness; only an elevated moon lifts it. */
export function lakeFogLight(hour: number, moonPhase: MoonPhase) {
  const night = lightingAt(hour, moonPhase).nightAmount;
  const moon = moonlightAt(hour, moonPhase);
  const day = [211, 220, 216];
  const dark = [19 + moon * 18, 32 + moon * 20, 38 + moon * 22];
  const color = day.map((value, i) => Math.round(value * (1 - night) + dark[i] * night));
  return { color: color.join(' '), night, moon, halo: night * moon * .24 };
}
