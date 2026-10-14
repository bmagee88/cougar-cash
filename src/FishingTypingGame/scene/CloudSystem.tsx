import React, { CSSProperties, useEffect, useRef, useState } from 'react';
import { WeatherVisuals } from '../engine/weather';
import { ASSET_BASE } from './manifest';

export const CLOUD_ART = Object.fromEntries(['cirrus', 'cumulus', 'stratus', 'cumulonimbus', 'overcast', 'rain'].map(kind => [kind, `${ASSET_BASE}/weather/clouds/${kind}-painted.png`])) as Record<'cirrus' | 'cumulus' | 'stratus' | 'cumulonimbus' | 'overcast' | 'rain', string>;
const CLOUDS = [
  { kind: 'cirrus', x: -12, y: -9, width: 58, alpha: .58, life: 170, delay: -52 },
  { kind: 'cirrus', x: 40, y: -6, width: 52, alpha: .45, life: 193, delay: -134 },
  { kind: 'cumulus', x: 5, y: 4, width: 30, alpha: .93, life: 137, delay: -41 },
  { kind: 'cumulus', x: 54, y: -1, width: 36, alpha: .85, life: 157, delay: -101 },
  { kind: 'cumulus', x: 31, y: 15, width: 23, alpha: .74, life: 181, delay: -173 },
  { kind: 'stratus', x: 18, y: 7, width: 64, alpha: .32, life: 211, delay: -77 },
] as const;

export default function CloudSystem({ visuals, reducedMotion = false, lightningPreview = 0 }: { visuals: WeatherVisuals; reducedMotion?: boolean; lightningPreview?: number }) {
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [flash, setFlash] = useState<number | null>(null); const flashCount = useRef(0);
  const lastPreview = useRef(0);
  const elapsed = useRef(visuals.elapsedMs); elapsed.current = visuals.elapsedMs;
  const { lightning, nextLightningMs } = visuals;
  useEffect(() => {
    if (reducedMotion) { setFlash(null); return; }
    if (!lightning) return;
    if (nextLightningMs === undefined) return;
    const timer = window.setTimeout(() => setFlash(++flashCount.current), Math.max(0, nextLightningMs - elapsed.current));
    return () => window.clearTimeout(timer);
  }, [lightning, nextLightningMs, reducedMotion]);
  useEffect(() => { if (visuals.stage === 'easing') setFlash(null); }, [visuals.stage]);
  useEffect(() => {
    if (flash === null) return;
    const timer = window.setTimeout(() => setFlash(null), 1000);
    return () => window.clearTimeout(timer);
  }, [flash]);
  useEffect(() => {
    if (lastPreview.current === lightningPreview) return;
    lastPreview.current = lightningPreview;
    if (lightningPreview && lightning && !reducedMotion) setFlash(++flashCount.current);
  }, [lightningPreview, lightning, reducedMotion]);
  const artwork = (kind: keyof typeof CLOUD_ART, className = '', style: CSSProperties = {}) => <img
    className={`f-cloud-art ${loaded[kind] ? 'f-cloud-art-loaded' : ''} ${className}`}
    src={CLOUD_ART[kind]} data-cloud-type={kind} alt="" draggable={false} style={style}
    onLoad={() => setLoaded(previous => previous[kind] ? previous : { ...previous, [kind]: true })}
  />;
  return <div className="f-cloud-system" data-layer="clouds" data-scene-depth="background" data-weather-stage={visuals.stage} data-lightning-interval-ms={visuals.lightningIntervalMs === undefined ? undefined : Math.round(visuals.lightningIntervalMs)} aria-hidden="true">
    <div className="f-clear-clouds" style={{ opacity: visuals.clear }}>
      {CLOUDS.map((cloud, i) => <div key={i} className="f-cloud-cycle" style={{ left: `${cloud.x}%`, top: `${cloud.y}%`, width: `${cloud.width}%`, '--cloud-opacity': cloud.alpha, '--cloud-life': `${cloud.life}s`, '--cloud-delay': `${cloud.delay}s` } as CSSProperties}>
        {artwork(cloud.kind, i % 2 ? 'f-cloud-mirrored' : '')}
      </div>)}
    </div>
    <div className="f-thunderheads" style={{ opacity: visuals.tower, scale: visuals.towerGrowth }}>{artwork('cumulonimbus')}</div>
    <div className="f-cloud-deck f-cloud-deck-grey" style={{ opacity: visuals.greyDeck }}>{artwork('overcast')}</div>
    <div className="f-cloud-deck f-cloud-deck-dark" style={{ opacity: visuals.darkDeck }}>{artwork('rain')}</div>
    {visuals.stage !== 'easing' && !reducedMotion && flash !== null && <div key={flash} className="f-cloud-lightning" data-testid="cloud-lightning-flash" onAnimationEnd={() => setFlash(null)} />}
  </div>;
}
