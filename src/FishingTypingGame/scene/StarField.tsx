import React, { CSSProperties, memo, useEffect, useState } from 'react';
import { artwork } from '../engine/artwork';
import { projectStar } from '../engine/astronomy';

export type CatalogStar = [number, number, number, number]; // RA degrees, declination, V magnitude, B-V
export default memo(function StarField({ angle, shoreline, moonlight }: { angle: number; shoreline: number; moonlight: number }) {
  const [catalog, setCatalog] = useState<CatalogStar[]>([]);
  useEffect(() => {
    if (typeof fetch === 'undefined') return;
    const controller = new AbortController();
    fetch(artwork('sky/stars.json'), { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error('Star catalog unavailable');
      return response.json();
    }).then(data => { if (!controller.signal.aborted) setCatalog(data); }).catch(() => { /* Decorative sky can retry on its next night mount. */ });
    return () => controller.abort();
  }, []);
  return <svg className="f-star-catalog" viewBox="0 0 1000 500" preserveAspectRatio="none" data-catalog-stars={catalog.length}>
    {catalog.map(([ra, dec, magnitude, bv], index) => {
      const point = projectStar(ra, dec, angle, shoreline);
      if (point.altitude < 0 || point.x < -.04 || point.x > 1.04 || point.y < -.04 || point.y > shoreline) return null;
      const opacity = Math.min(1, Math.max(.06, (6 - magnitude - moonlight * 1.6) / 4)) * Math.min(1, point.altitude / 12);
      const color = bv > 1.1 ? '#f2dcc0' : bv < .1 ? '#d8e5f4' : '#eff0e8';
      return <circle key={index} className="f-catalog-star" cx="0" cy="0" r={Math.max(.45, 1.65 - magnitude * .20)} fill={color} opacity={opacity}
        style={{ transform: `translate(${point.x * 1000}px, ${point.y * 500}px)`, '--star-glimmer': `${4 + index % 9}s`, '--star-delay': `${-index % 17}s` } as CSSProperties} />;
    })}
  </svg>;
});
