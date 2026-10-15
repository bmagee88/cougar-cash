import React, { CSSProperties, memo, useId } from 'react';
import { MOON_PHASES, WorldConditions } from '../engine/types';
import { celestialPosition, lightingAt, moonlightAt, MOON_LABELS } from '../engine/world';
import { MOON_ART } from './manifest';
import { useSkyColor } from './useSkyColor';
import { useLayerPresence } from './useLayerPresence';

export const MOON_SHAPES = [
  'M50 0A50 50 0 1 0 50 100A50 50 0 1 0 50 0',
  'M50 0A50 50 0 0 0 50 100A25 50 0 0 0 50 0Z',
  'M50 0A50 50 0 0 0 50 100Z',
  'M50 0A50 50 0 0 0 50 100A25 50 0 0 1 50 0Z',
  '',
  'M50 0A50 50 0 0 1 50 100A25 50 0 0 0 50 0Z',
  'M50 0A50 50 0 0 1 50 100Z',
  'M50 0A50 50 0 0 1 50 100A25 50 0 0 1 50 0Z',
];
export default memo(function CelestialSky({ world, background }: { world: WorldConditions; background: string }) {
  const id = `moon-${useId().replace(/:/g, '')}`;
  const sun = celestialPosition(world.hour); const moon = celestialPosition(world.hour, true);
  const skyColor = useSkyColor(background, moon.x, moon.y);
  const light = lightingAt(world.hour, world.moonPhase);
  const starVisibility = light.stars * (1 - moonlightAt(world.hour, world.moonPhase) * .6);
  const stars = useLayerPresence(light.stars > 0, 1100);
  const position = (point: typeof sun): CSSProperties => ({ left: `${point.x}%`, top: `${point.y}%`, opacity: Number(point.visible) });
  return <div className="f-celestial-sky" aria-hidden="true">
    <div className="f-stars" data-testid="fishing-stars" style={{ opacity: starVisibility }}>{stars && Array.from({ length: 65 }, (_, i) => <i key={i} style={{ left: `${3 + (i * .61803398875 % 1) * 94}%`, top: `${2 + (i * .41421356237 % 1) * 25}%`, width: i % 5 === 0 ? 3 : 2, height: i % 5 === 0 ? 3 : 2, animationDelay: `${-i * .7}s` }} />)}</div>
    <div className="f-sun f-moving-sun" data-testid="fishing-sun" style={position(sun)} />
    <svg className="f-moon" data-testid="fishing-moon" data-moon-phase={world.moonPhase} style={position(moon)} viewBox="0 0 100 100" aria-label={MOON_LABELS[world.moonPhase]}>
      <defs><clipPath id={id}><path d={MOON_SHAPES[MOON_PHASES.indexOf(world.moonPhase)]} /></clipPath></defs>
      <circle className="f-moon-shade" cx="50" cy="50" r="50" fill={skyColor} opacity="1" />
      <image href={MOON_ART} x="-9" y="-9" width="118" height="118" clipPath={`url(#${id})`} />
    </svg>
  </div>;
});
