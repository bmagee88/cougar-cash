import React, { CSSProperties, RefObject, useEffect, useState } from 'react';
import { SolarLight } from './solarLight';

// One reusable mask image. Moving its filter primitive avoids creating a new
// decoded data-URL image every time the world clock advances.
const CLOUD_LIGHT_MASK = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="600" viewBox="0 0 1000 600"><defs><radialGradient id="g"><stop stop-color="white"/><stop offset=".55" stop-color="white" stop-opacity=".95"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient></defs><ellipse cx="500" cy="300" rx="500" ry="300" fill="url(#g)"/></svg>')}`;

/** Geometry changes only on resize; no extra ambient animation loop. */
export function useSolarFrame(scene: RefObject<HTMLDivElement>) {
  const [size, setSize] = useState({ width: 1200, height: 700 });
  useEffect(() => {
    const element = scene.current;
    if (!element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width && height) setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [scene]);
  return size;
}

export function solarStyle(light: SolarLight, visibility: number): CSSProperties {
  return { '--sun-x': `${light.sun.x}%`, '--sun-y': `${light.sun.y}%`,
    '--sun-landscape-x': `${light.x * 100}%`, '--sun-landscape-y': `${light.y * 100}%`,
    '--sun-core': light.core, '--sun-halo': light.halo, '--sun-outer': light.outer,
    '--sun-glare': light.glare, '--sun-ridge-darkening': light.ridgeDarkening * visibility,
  } as CSSProperties;
}

export function SunGlare({ light }: { light: SolarLight }) {
  return <>
    <div className="f-solar-glare" data-solar-phase={light.phase} data-ridge-clearance={light.clearance.toFixed(4)} style={{ opacity: light.glare }} />
    {light.delight > 0 && <div className="f-sailors-afterglow" data-sky-event="sailors-delight" style={{ opacity: light.delight * .32 }} />}
  </>;
}

/** Lives inside the existing land alpha mask; fades out before reaching the water. */
export function MountainBacklight() {
  return <div className="f-backdrop-content f-ridge-backlight" data-layer="sun-mountain-contrast" aria-hidden="true" />;
}

/** Recolor the existing moving cloud texture, preserving its alpha and detail.
 * The small embedded SVG is only a spatial light mask, never another cloud bitmap.
 * No duplicate cloud animations or image requests are required. */
export function CloudLightFilter({ id, light, transmission = 1 }: { id: string; light: SolarLight; transmission?: number }) {
  const strength = Math.min(1, light.delight * 1.2) * (.2 + .8 * transmission);
  const red = Math.max(0, Math.min(1, (light.sun.y - 23) / 13));
  return <svg width="0" height="0" aria-hidden="true" className="f-solar-filter"><defs>
    <filter id={id} x="0" y="0" width="100%" height="100%" primitiveUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
      <feColorMatrix in="SourceGraphic" type="matrix" values={`.181 .608 .061 0 .15  .072 .243 .025 0 ${(.12 - red * .08).toFixed(3)}  .026 .086 .008 0 .035  0 0 0 0 1`} result="warmCloud" />
      <feImage href={CLOUD_LIGHT_MASK} x={light.sun.x / 100 - .6} y={light.sun.y / 100 - .45} width="1.2" height=".9" preserveAspectRatio="none" result="sunlightPosition" />
      <feComponentTransfer in="sunlightPosition" result="sunlightArea"><feFuncA type="linear" slope={strength} /></feComponentTransfer>
      <feComposite in="warmCloud" in2="sunlightArea" operator="in" result="litCloud" />
      <feComposite in="litCloud" in2="SourceGraphic" operator="atop" />
    </filter>
  </defs></svg>;
}
