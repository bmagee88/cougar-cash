import { MoonPhase, Weather } from './types';
import { lightingAt } from './world';

/** Weather changes the light only; the lake clock and feeding conditions stay live. */
export function weatherLighting(hour: number, moonPhase: MoonPhase, weather: Weather, visuals = weatherVisuals(weather)) {
  const light=lightingAt(hour,moonPhase);
  const cover=Math.max(visuals.greyDeck,visuals.darkDeck);
  if(!cover)return light;
  // Cloud thickness dims the real daylight in weatherVisuals; it never advances the clock to night.
  const channels=light.tint.match(/[\d.]+/g)!.map(Number);
  return {...light,
    tint:`rgba(${channels.slice(0,3).join(',')},${(channels[3]*(1-cover*.95)).toFixed(3)})`};
}

export type StormStage = 'building' | 'arriving' | 'storm' | 'easing';
export const WEATHER_NAMES: Record<Weather, string> = { sunny: 'Clear skies', overcast: 'Cloudy', rain: 'Rain', thunderstorm: 'Thunderstorm', wind: 'Wind', fog: 'Fog', heatwave: 'Heat wave', 'cold-front': 'Cold front', hurricane: 'Hurricane / inland remnants', snowfall: 'Snowfall', blizzard: 'Blizzard' };
export const STORM_TIMING = { deckStarts: 40000, rainStarts: 65000, deckFull: 80000, rainFull: 85000, durationMs: 15 * 60 * 1000, lightningEnds: 15 * 60 * 1000 * .75 };
export const STORM_PREVIEW_MS: Record<StormStage, number> = { building: 25000, arriving: 60000, storm: STORM_TIMING.durationMs / 2, easing: STORM_TIMING.durationMs * .875 };
export function lightningIntervalAt(elapsedMs: number, durationMs = STORM_TIMING.durationMs): number | undefined {
  const progress = Math.max(0, elapsedMs / durationMs);
  if (progress >= .75) return undefined;
  return progress <= .5 ? 90000 - 60000 * progress / .5 : 30000 + 60000 * (progress - .5) / .25;
}
const lightningSchedules = new Map<number, readonly number[]>();
export function stormLightningTimes(durationMs = STORM_TIMING.durationMs): readonly number[] {
  const saved=lightningSchedules.get(durationMs); if (saved) return saved;
  const times: number[] = [];
  for (let at = 90000; at < durationMs * .75; at += lightningIntervalAt(at,durationMs)!) times.push(Math.round(at));
  lightningSchedules.set(durationMs,times);
  while(lightningSchedules.size>8)lightningSchedules.delete(lightningSchedules.keys().next().value!);
  return times;
}
export const STORM_LIGHTNING_TIMES=stormLightningTimes();
export type WeatherVisuals = {
  stage: StormStage | 'steady'; clear: number; tower: number; towerGrowth: number;
  greyDeck: number; darkDeck: number; rain: number; fog: number; snow: number; wind: number; heat: number; lightning: boolean;
  elapsedMs: number; progress: number; complete: boolean; nextLightningMs?: number; lightningIntervalMs?: number;
  brightness: number; saturation: number; contrast: number; veil: number; celestial: number; label: string;
};
const smooth = (start: number, end: number, elapsed: number) => {
  const t = Math.max(0, Math.min(1, (elapsed - start) / (end - start)));
  return t * t * (3 - 2 * t);
};

/** A visual weather sequence; it never changes fish odds or typing deadlines. */
export function weatherVisuals(weather: Weather, elapsedMs = 0, durationMs = STORM_TIMING.durationMs): WeatherVisuals {
  const storm = weather === 'thunderstorm';
  const elapsed = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
  const wintry = weather === 'snowfall' || weather === 'blizzard'; const severe=weather === 'hurricane' || weather === 'blizzard';
  const deck = storm ? smooth(STORM_TIMING.deckStarts, STORM_TIMING.deckFull, elapsed) : ['overcast','rain','hurricane','snowfall','blizzard'].includes(weather) ? 1 : weather === 'cold-front' ? .65 : 0;
  const rain = storm ? smooth(STORM_TIMING.rainStarts, STORM_TIMING.rainFull, elapsed) : Number(weather === 'rain' || weather === 'hurricane');
  const stage = !storm ? 'steady' : elapsed < STORM_TIMING.deckStarts ? 'building' : elapsed < STORM_TIMING.rainFull ? 'arriving' : elapsed < durationMs * .75 ? 'storm' : 'easing';
  const nextLightningMs = storm ? stormLightningTimes(durationMs).find(at => at >= elapsed) : undefined;
  return {
    elapsedMs: elapsed, progress: storm ? Math.min(1, elapsed / durationMs) : 0, complete: storm && elapsed >= durationMs,
    stage, clear: (1 - deck) * (weather === 'fog' ? .4 : 1),
    tower: storm ? (.35 + .65 * smooth(0, 32000, elapsed)) * (1 - smooth(55000, 82000, elapsed)) : 0,
    towerGrowth: storm ? .72 + .28 * smooth(0, 40000, elapsed) : 1,
    greyDeck: weather === 'overcast' || wintry ? 1 : weather === 'cold-front' ? .65 : storm ? deck * (1 - rain) : 0,
    darkDeck: weather === 'rain' || weather === 'hurricane' ? 1 : storm ? deck : 0, rain,
    fog: storm ? deck : severe ? 1 : Number(weather === 'fog'),
    snow: wintry ? weather === 'blizzard' ? 1 : .4 : 0,
    wind: severe ? 1 : weather === 'wind' || weather === 'cold-front' ? .45 : storm ? rain * .6 : 0,
    heat: Number(weather === 'heatwave'),
    lightning: storm && elapsed < durationMs * .75,
    nextLightningMs, lightningIntervalMs: storm ? lightningIntervalAt(elapsed,durationMs) : undefined,
    brightness: 1 - deck * (severe ? .43 : storm ? .30 : weather === 'rain' ? .24 : .10) - (storm ? rain * .10 : 0),
    saturation: 1, contrast: 1-deck*(storm||severe?.20:weather==='rain'?.13:.08),
    veil: deck*(storm||severe?.20:weather==='rain'?.16:.12),
    celestial: weather === 'fog' ? .25 : 1 - deck * (weather === 'overcast' ? .82 : .97),
    label: storm ? stage === 'building' ? 'Thunderheads building' : stage === 'arriving' ? 'Storm clouds rolling in' : stage === 'easing' ? 'Steady rain and mist' : 'Thunderstorm' : ({ sunny: 'Clear skies', overcast: 'Clouds overhead', rain: 'Rain on the water', wind: 'A gentle breeze', fog: 'Mist on the lake', heatwave: 'Heat shimmering over the lake', 'cold-front': 'Cool air and gusting wind', hurricane: 'Hurricane remnants · heavy wind and rain', snowfall: 'Snow falling on the lake', blizzard: 'Blowing snow and strong wind' } as Record<Exclude<Weather,'thunderstorm'>, string>)[weather as Exclude<Weather,'thunderstorm'>],
  };
}
