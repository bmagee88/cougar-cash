import { useLayoutEffect, useRef, useState } from 'react';
import { Weather } from '../engine/types';
import { WeatherVisuals } from '../engine/weather';

export const WEATHER_FADE_MS = 12000;
type Layer = { weather: Weather; entering: boolean };

/** Keep outgoing particles alive until their fade ends, including interrupted changes. */
export function useWeatherLayers(weather: Weather, visuals: WeatherVisuals, reducedMotion: boolean) {
  const [retained, setRetained] = useState<Layer[]>([{ weather, entering: false }]);
  const samples = useRef(new Map<Weather, WeatherVisuals>());
  samples.current.set(weather, visuals);
  const layers = reducedMotion ? [{ weather, entering: false }] : retained.some(layer => layer.weather === weather) ? retained : [...retained, { weather, entering: true }];
  const latest = useRef(layers); latest.current = layers;
  useLayoutEffect(() => {
    setRetained(latest.current);
    if (reducedMotion || !latest.current.some(layer => layer.weather !== weather)) return;
    const timer = window.setTimeout(() => {
      setRetained([{ weather, entering: false }]);
      samples.current.forEach((_, key) => { if (key !== weather) samples.current.delete(key); });
    }, WEATHER_FADE_MS + 50);
    return () => window.clearTimeout(timer);
  }, [weather, reducedMotion]);
  return layers.map(layer => ({ ...layer, visuals: samples.current.get(layer.weather)!, active: layer.weather === weather }));
}
