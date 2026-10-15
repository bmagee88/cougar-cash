import React, { CSSProperties, memo, useEffect, useState } from 'react';
import { Weather } from '../engine/types';
import { WeatherVisuals } from '../engine/weather';
import WindSystem from './WindSystem';
import RainCanvas from './RainCanvas';

export default memo(function WeatherParticles({ weather, visuals, location, reducedMotion, active, entering }: {
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
  return <div className={`f-weather f-weather-${weather} f-weather-particles`} data-weather-layer={weather} data-weather-active={active} aria-hidden="true" style={{ opacity: active && (shown || reducedMotion) ? 1 : 0 }}>
    {['rain', 'thunderstorm', 'hurricane'].includes(weather) && <div className={`f-rainfall ${heavy ? 'f-rainfall-heavy' : ''}`} data-rain-intensity={visuals.rain.toFixed(3)} style={{ opacity: visuals.rain }}>
      {heavy ? <RainCanvas weather={weather as 'thunderstorm' | 'hurricane'} intensity={visuals.rain} reducedMotion={reducedMotion} /> : <>
      {Array.from({ length: 42 }, (_, i) => <i className="f-raindrop" key={i} style={{ left: `${i * 37.17 % 116 - 8}%`, top: `${i * 23.41 % 100}%`, animationDelay: `${-i * .137}s`, animationDuration: `${.7 + i % 5 * .12}s` }} />)}
      {Array.from({ length: 12 }, (_, i) => <i key={`r${i}`} className="f-rain-ring" style={{ left: `${60 + i * 17 % 34}%`, top: `${54 + i * 7 % 17}%`, animationDelay: `${-i * .32}s`, animationDuration: '1.4s' }} />)}
      </>}
    </div>}
    {['wind', 'cold-front', 'thunderstorm', 'hurricane', 'blizzard'].includes(weather) && <WindSystem strength={visuals.wind} location={location} reducedMotion={reducedMotion} />}
    {visuals.snow > 0 && <div className={`f-snowfall ${weather === 'blizzard' ? 'f-blowing-snow' : ''}`} data-testid="weather-snow" data-snow-intensity={visuals.snow}>{Array.from({ length: weather === 'blizzard' ? 90 : 38 }, (_, i) => <i key={i} className="f-snowflake" style={{ left: `${i * 37 % 120 - 10}%`, top: `${i * 23 % 100 - 10}%`, '--flake-size': `${2 + i % 4}px`, animationDelay: `${-i * .7}s`, animationDuration: `${weather === 'blizzard' ? 2 + i % 3 : 7 + i % 5}s` } as CSSProperties} />)}</div>}
  </div>;
});
