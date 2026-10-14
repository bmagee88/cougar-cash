import React, { CSSProperties, useEffect, useState } from 'react';
import { Weather } from '../engine/types';
import { WeatherVisuals } from '../engine/weather';
import WindSystem from './WindSystem';

export default function WeatherParticles({ weather, visuals, location, reducedMotion, active, entering }: {
  weather: Weather; visuals: WeatherVisuals; location: string; reducedMotion: boolean; active: boolean; entering: boolean;
}) {
  const [shown, setShown] = useState(!entering || reducedMotion || document.hidden);
  useEffect(() => {
    if (reducedMotion) { setShown(true); return; }
    if (shown) return;
    // Paint the incoming layer at zero opacity before starting its transition.
    let second = 0;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => setShown(true)); });
    const fallback = window.setTimeout(() => setShown(true), 100);
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); window.clearTimeout(fallback); };
  }, [shown, reducedMotion]);
  const heavy = weather === 'thunderstorm' || weather === 'hurricane';
  const drops = weather === 'hurricane' ? 520 : weather === 'thunderstorm' ? 320 : 42;
  const distant = weather === 'hurricane' ? 240 : weather === 'thunderstorm' ? 160 : 0;
  return <div className={`f-weather f-weather-${weather} f-weather-particles`} data-weather-layer={weather} data-weather-active={active} aria-hidden="true" style={{ opacity: active && (shown || reducedMotion) ? 1 : 0 }}>
    {['rain', 'thunderstorm', 'hurricane'].includes(weather) && <div className={`f-rainfall ${heavy ? 'f-rainfall-heavy' : ''}`} data-rain-intensity={visuals.rain.toFixed(3)} style={{ opacity: visuals.rain }}>
      {Array.from({ length: distant }, (_, i) => <i className="f-raindrop f-raindrop-distant" key={`d${i}`} style={{ left: `${i * 31.73 % 116 - 8}%`, top: `${i * 17.19 % 100}%`, animationDelay: `${-i * .073}s`, animationDuration: `${.45 + i % 5 * .035}s` }} />)}
      {Array.from({ length: drops }, (_, i) => <i className="f-raindrop" key={i} style={{ left: `${i * 37.17 % 116 - 8}%`, top: `${i * 23.41 % 100}%`, animationDelay: `${-i * .137}s`, animationDuration: `${(weather === 'hurricane' ? .27 : heavy ? .38 : .7) + i % 5 * (heavy ? .025 : .12)}s` }} />)}
      {Array.from({ length: weather === 'hurricane' ? 96 : heavy ? 64 : 12 }, (_, i) => <i key={`r${i}`} className="f-rain-ring" style={{ left: `${heavy ? 4 + i * 17.31 % 94 : 60 + i * 17 % 34}%`, top: `${heavy ? 53 + i * 7.17 % 42 : 54 + i * 7 % 17}%`, animationDelay: `${-i * .32}s`, animationDuration: `${heavy ? .65 + i % 4 * .1 : 1.4}s` }} />)}
    </div>}
    {['wind', 'cold-front', 'thunderstorm', 'hurricane', 'blizzard'].includes(weather) && <WindSystem strength={visuals.wind} location={location} reducedMotion={reducedMotion} />}
    {visuals.snow > 0 && <div className={`f-snowfall ${weather === 'blizzard' ? 'f-blowing-snow' : ''}`} data-testid="weather-snow" data-snow-intensity={visuals.snow}>{Array.from({ length: weather === 'blizzard' ? 90 : 38 }, (_, i) => <i key={i} className="f-snowflake" style={{ left: `${i * 37 % 120 - 10}%`, top: `${i * 23 % 100 - 10}%`, '--flake-size': `${2 + i % 4}px`, animationDelay: `${-i * .7}s`, animationDuration: `${weather === 'blizzard' ? 2 + i % 3 : 7 + i % 5}s` } as CSSProperties} />)}</div>}
  </div>;
}
