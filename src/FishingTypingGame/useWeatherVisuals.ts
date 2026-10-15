import { useEffect, useMemo, useRef, useState } from 'react';
import { Weather } from './engine/types';
import { STORM_PREVIEW_MS, STORM_TIMING, StormStage, weatherVisuals } from './engine/weather';

export function useWeatherVisuals(weather: Weather, preview?: StormStage, startedAt?: number, onStormEnd?: () => void, durationMs = STORM_TIMING.durationMs) {
  const fallback = useRef({ weather, startedAt: Date.now() });
  if (fallback.current.weather !== weather) fallback.current = { weather, startedAt: Date.now() };
  const stormStart = startedAt ?? fallback.current.startedAt;
  const [clock, setClock] = useState({ weather, start: stormStart, elapsed: Math.max(0, Date.now() - stormStart) });
  const endRef = useRef(onStormEnd); endRef.current = onStormEnd;
  const ended = useRef<number | undefined>(undefined);
  useEffect(() => {
    const update = () => {
      const elapsed = weather === 'thunderstorm' ? Math.min(durationMs, Math.max(0, Date.now() - stormStart)) : 0;
      setClock({ weather, start: stormStart, elapsed });
      if (!preview && weather === 'thunderstorm' && elapsed >= durationMs && ended.current !== stormStart) {
        ended.current = stormStart; endRef.current?.();
      }
      return elapsed;
    };
    const elapsed = update();
    if (weather !== 'thunderstorm' || elapsed >= durationMs) return;
    const timer = window.setInterval(() => { if (update() >= durationMs) window.clearInterval(timer); }, 250);
    const visible = () => { if (document.visibilityState === 'visible') update(); };
    document.addEventListener('visibilitychange', visible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [weather, preview, stormStart, durationMs]);
  const elapsed = clock.weather === weather && clock.start === stormStart ? clock.elapsed : Math.max(0, Date.now() - stormStart);
  const previewTime = preview === 'storm' ? durationMs / 2 : preview === 'easing' ? durationMs * .875 : preview ? STORM_PREVIEW_MS[preview] : elapsed;
  return useMemo(() => weatherVisuals(weather, previewTime, durationMs), [weather, previewTime, durationMs]);
}
