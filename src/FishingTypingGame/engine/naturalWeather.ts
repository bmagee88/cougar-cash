import { NaturalWeatherState, Random, SaveData, Season, SEASONS, Weather, WEATHERS, WorldOverrides } from './types';
import { worldAt } from './world';

const MINUTE = 60000;
export const WEATHER_DURATIONS: Record<Weather, { min: number; max: number; mean: number; spread: number; persistent: number }> = {
  sunny: { min: 10, max: 240, mean: 48, spread: 12, persistent: .015 },
  overcast: { min: 10, max: 192, mean: 36, spread: 9, persistent: .02 },
  rain: { min: 10, max: 192, mean: 24, spread: 6, persistent: .025 },
  wind: { min: 10, max: 96, mean: 24, spread: 6, persistent: .015 },
  fog: { min: 10, max: 48, mean: 16, spread: 4, persistent: .01 },
  heatwave: { min: 96, max: 240, mean: 144, spread: 24, persistent: .03 },
  'cold-front': { min: 10, max: 48, mean: 20, spread: 5, persistent: .01 },
  thunderstorm: { min: 15, max: 96, mean: 30, spread: 7, persistent: .015 },
  hurricane: { min: 24, max: 144, mean: 48, spread: 12, persistent: .02 },
  snowfall: { min: 10, max: 192, mean: 24, spread: 6, persistent: .025 },
  blizzard: { min: 15, max: 96, mean: 36, spread: 9, persistent: .02 },
};
type Weights = Partial<Record<Weather, number>>;
// Game calibration informed by NWS/NOAA weather lifecycles, not observed transition frequencies.
export const WEATHER_TRANSITIONS: Record<Weather, Weights> = {
  sunny: { overcast: 42, wind: 28, fog: 15, 'cold-front': 10, heatwave: 5 },
  overcast: { rain: 38, sunny: 28, wind: 20, 'cold-front': 12, fog: 1, hurricane: 1 },
  rain: { overcast: 55, wind: 20, fog: 20, 'cold-front': 4, hurricane: 1 },
  wind: { overcast: 35, sunny: 30, 'cold-front': 25, rain: 10 },
  fog: { sunny: 55, overcast: 35, wind: 10 },
  heatwave: { 'cold-front': 60, sunny: 25, overcast: 10, wind: 5 },
  'cold-front': { rain: 45, wind: 25, overcast: 20, sunny: 10 },
  thunderstorm: { rain: 65, overcast: 30, wind: 5 },
  hurricane: { rain: 65, wind: 25, overcast: 10 },
  snowfall: { overcast: 60, wind: 25, sunny: 15 },
  blizzard: { overcast: 70, wind: 30 },
};
export const WEATHER_SPECIAL_ROWS = [
  { label: 'Heat wave → cold front', history: ['heatwave','cold-front'] as Weather[], weights: { thunderstorm: 55, rain: 25, overcast: 10, wind: 10 } as Weights },
  { label: 'Winter: cold front → rain', history: ['cold-front','rain'] as Weather[], weights: { snowfall: 60, overcast: 25, fog: 10, wind: 5 } as Weights },
  { label: 'Winter: wind → cold front → rain', history: ['wind','cold-front','rain'] as Weather[], weights: { blizzard: 35, snowfall: 35, overcast: 20, wind: 10 } as Weights },
];
const tailMatches = (history: readonly Weather[], chain: readonly Weather[]) => chain.length <= history.length && chain.every((w,i) => w === history[history.length - chain.length + i]);
export function weatherAllowed(weather: Weather, season: Season) {
  if (weather === 'heatwave') return season !== 'winter';
  if (weather === 'hurricane') return season === 'summer' || season === 'autumn';
  if (weather === 'snowfall' || weather === 'blizzard') return season === 'winter';
  return true;
}
export function transitionOdds(current: Weather, season: Season, history: readonly Weather[] = [current]) {
  const trail = history[history.length - 1] === current ? history : [...history, current];
  const special = WEATHER_SPECIAL_ROWS.slice().reverse().find(row => tailMatches(trail, row.history) && (row.history[0] === 'heatwave' || season === 'winter'));
  const source = special?.weights ?? WEATHER_TRANSITIONS[current];
  const weights = WEATHERS.map(weather => {
    let weight = source[weather] ?? 0;
    if (!weatherAllowed(weather, season)) weight = 0;
    if (weather === 'heatwave' && (season === 'spring' || season === 'autumn')) weight *= .2;
    if (weather === 'thunderstorm' && !tailMatches(trail, ['heatwave','cold-front'])) weight = 0;
    if (weather === 'snowfall' && !tailMatches(trail, ['cold-front','rain'])) weight = 0;
    if (weather === 'blizzard' && !tailMatches(trail, ['wind','cold-front','rain'])) weight = 0;
    return { weather, weight };
  });
  const total = weights.reduce((sum,row) => sum + row.weight, 0);
  return weights.map(row => ({ weather: row.weather, chance: row.weight / total }));
}
// A bell-shaped core with a small broad persistence tail. Calibrate the core's
// center so the entire distribution's expected duration equals the table mean.
export const DURATION_DISTRIBUTIONS = Object.fromEntries(WEATHERS.map(weather => {
  const d = WEATHER_DURATIONS[weather]; const minutes = Array.from({ length: d.max - d.min + 1 }, (_,i) => d.min + i);
  const gaussian = (center: number, spread: number) => {
    const weights = minutes.map(m => Math.exp(-.5 * ((m-center) / spread) ** 2)); const sum = weights.reduce((a,b) => a+b,0);
    return weights.map(w => w / sum);
  };
  const long = gaussian(d.min + (d.max - d.min) * .82, (d.max-d.min) * .14);
  const mix = (center: number) => gaussian(center,d.spread).map((w,i) => (1-d.persistent) * w + d.persistent * long[i]);
  let low = d.min - d.spread * 5, high = d.max;
  for (let i=0;i<60;i++) { const center=(low+high)/2; const mean=mix(center).reduce((sum,w,index) => sum+w*minutes[index],0); if (mean < d.mean) low=center; else high=center; }
  const weights=mix((low+high)/2); let cumulative=0;
  return [weather, minutes.map((minute,i) => ({ minutes: minute, chance: weights[i], cumulative: cumulative += weights[i] }))];
})) as Record<Weather, { minutes: number; chance: number; cumulative: number }[]>;
export function weatherDuration(weather: Weather, random: Random = Math.random) {
  const roll = Math.max(0, Math.min(1-Number.EPSILON,random())); const rows=DURATION_DISTRIBUTIONS[weather];
  return (rows.find(row => roll < row.cumulative) ?? rows[rows.length-1]).minutes * MINUTE;
}
function nextRandom(seed: number) {
  const next=(seed+0x6D2B79F5) >>> 0; let t=next;
  t=Math.imul(t ^ (t >>> 15), 1 | t); t^=t+Math.imul(t ^ (t >>> 7),61 | t);
  return { seed: next, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}
type SeasonAt = (now: number) => Season;
export const seasonAtTime = (overrides: WorldOverrides = {}): SeasonAt => now => worldAt(now,overrides).season;
function seasonalEnd(weather: Weather, start: number, duration: number, seasonAt: SeasonAt) {
  const end=start+duration;
  if (weatherAllowed(weather,seasonAt(end))) return end;
  let low=start, high=end;
  while (high-low > 1) { const middle=Math.floor((low+high)/2); if (weatherAllowed(weather,seasonAt(middle))) low=middle; else high=middle; }
  return high;
}
function makeEvent(weather: Weather, startedAt: number, seed: number, history: Weather[], seasonAt: SeasonAt): NaturalWeatherState {
  const roll=nextRandom(seed); const durationMs=weatherDuration(weather,() => roll.value);
  return { weather, startedAt, durationMs, endsAt: seasonalEnd(weather,startedAt,durationMs,seasonAt), seed: roll.seed, history: [...history,weather].slice(-4), season: seasonAt(startedAt) };
}
export function startNaturalWeather(save: SaveData, now: number, overrides: WorldOverrides = {}, seed = Math.floor(Math.random()*4294967296)): SaveData {
  const seasonAt=seasonAtTime(overrides); const current=save.settings.weather;
  const weather: Weather = ['sunny','overcast','rain','wind','fog'].includes(current) ? current : 'overcast';
  const naturalWeather=makeEvent(weather,now,seed,[],seasonAt);
  const { stormStartedAt, ...settings }=save.settings;
  return { ...save, settings: { ...settings, weather, weatherMode: 'natural', naturalWeather } };
}
export function nextNaturalWeather(state: NaturalWeatherState, now: number, seasonAt: SeasonAt): NaturalWeatherState {
  const roll=nextRandom(state.seed); const season=seasonAt(now);
  const options=transitionOdds(state.weather,season,state.history); let remaining=roll.value;
  const chosen=options.find(row => (remaining -= row.chance) < 0) ?? options.filter(row=>row.chance>0).slice(-1)[0];
  return makeEvent(chosen.weather,now,roll.seed,state.history,seasonAt);
}
export function advanceNaturalWeather(save: SaveData, now: number, overrides: WorldOverrides = {}): SaveData {
  if (save.settings.weatherMode !== 'natural') return save;
  const seasonAt=seasonAtTime(overrides); let state=save.settings.naturalWeather;
  if (!state) return startNaturalWeather(save,now,overrides,0);
  const original=state;
  // Changing a developer season, or entering an incompatible daily season,
  // ends the incompatible event without inheriting a false trigger chain.
  if (!weatherAllowed(state.weather,seasonAt(now)) && now < state.endsAt) {
    state=makeEvent('overcast',now,state.seed,[],seasonAt);
  }
  let steps=0;
  while (now >= state.endsAt) {
    state=nextNaturalWeather(state,state.endsAt,seasonAt);
    if (++steps>10000 && now>=state.endsAt) { state=makeEvent('overcast',now,state.seed,[],seasonAt); break; }
  }
  if (original === state) return save;
  return { ...save, settings: { ...save.settings, weather: state.weather, naturalWeather: state } };
}
export function readNaturalWeather(value: unknown): NaturalWeatherState | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const s=value as NaturalWeatherState;
  if (!WEATHERS.includes(s.weather) || !SEASONS.includes(s.season) || !weatherAllowed(s.weather,s.season) || !Array.isArray(s.history) || !s.history.length || s.history.length>4 || !s.history.every(w=>WEATHERS.includes(w)) || s.history[s.history.length-1]!==s.weather) return undefined;
  const spec=WEATHER_DURATIONS[s.weather];
  if (!Number.isSafeInteger(s.startedAt) || s.startedAt<=0 || !Number.isSafeInteger(s.seed) || s.seed<0 || s.seed>4294967295 || !Number.isFinite(s.durationMs) || s.durationMs<spec.min*MINUTE || s.durationMs>spec.max*MINUTE || !Number.isSafeInteger(s.endsAt) || s.endsAt<=s.startedAt || s.endsAt>s.startedAt+s.durationMs) return undefined;
  if (s.weather==='thunderstorm' && !tailMatches(s.history,['heatwave','cold-front','thunderstorm'])) return undefined;
  if (s.weather==='snowfall' && !tailMatches(s.history,['cold-front','rain','snowfall'])) return undefined;
  if (s.weather==='blizzard' && !tailMatches(s.history,['wind','cold-front','rain','blizzard'])) return undefined;
  return { ...s, history: [...s.history] };
}
