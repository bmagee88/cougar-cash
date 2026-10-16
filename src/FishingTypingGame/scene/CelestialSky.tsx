import React, { CSSProperties, memo, useId } from 'react';
import { MOON_PHASES, WorldConditions } from '../engine/types';
import { celestialPosition, lightingAt, moonlightAt, MOON_LABELS } from '../engine/world';
import { MOON_ART } from './manifest';
import { useSkyColor } from './useSkyColor';
import { useLayerPresence } from './useLayerPresence';
import { siderealAngle, skyEventsAt, SkyPreview } from '../engine/astronomy';
import { lakeFrame, lakeShoreline } from './lakeFrame';
import StarField from './StarField';
import SkyEvents from './SkyEvents';

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
export default memo(function CelestialSky({ world, background, location = 'dock', skyPreview }: { world: WorldConditions; background: string; location?: string; skyPreview?: SkyPreview }) {
  const id = `moon-${useId().replace(/:/g, '')}`;
  const sun = celestialPosition(world.hour); const moon = celestialPosition(world.hour, true);
  const skyColor = useSkyColor(background, moon.x, moon.y);
  const light = lightingAt(world.hour, world.moonPhase);
  const starVisibility = light.stars * (1 - moonlightAt(world.hour, world.moonPhase) * .6);
  const stars = useLayerPresence(light.stars > 0, 1100);
  const angle = siderealAngle(world), shoreline = lakeShoreline(location), events = skyEventsAt(world, skyPreview);
  const position = (point: typeof sun): CSSProperties => ({ left: `${point.x}%`, top: `${point.y}%`, opacity: Number(point.visible) });
  return <div className="f-celestial-sky" aria-hidden="true">
    <div className="f-night-sky-frame" style={lakeFrame(location)} data-aurora-active={!!events.aurora} data-meteors-active={!!events.meteors}>
      <div className="f-stars" data-testid="fishing-stars" data-sidereal-angle={angle.toFixed(4)} style={{ opacity: starVisibility }}>{stars && <StarField angle={angle} shoreline={shoreline} moonlight={moonlightAt(world.hour, world.moonPhase)} />}</div>
      <div className="f-sky-events" style={{ opacity: light.nightAmount * (1 - moonlightAt(world.hour, world.moonPhase) * .25) }}>{light.nightAmount > 0 && <SkyEvents events={events} angle={angle} shoreline={shoreline} />}</div>
    </div>
    <div className="f-sun f-moving-sun" data-testid="fishing-sun" style={position(sun)} />
    <svg className="f-moon" data-testid="fishing-moon" data-moon-phase={world.moonPhase} style={{ ...position(moon), opacity: Number(moon.visible && world.moonPhase !== 'new') }} viewBox="0 0 100 100" aria-label={MOON_LABELS[world.moonPhase]}>
      <defs><clipPath id={id}><path d={MOON_SHAPES[MOON_PHASES.indexOf(world.moonPhase)]} /></clipPath></defs>
      <circle className="f-moon-shade" cx="50" cy="50" r="50" fill={skyColor} opacity="1" />
      <image href={MOON_ART} x="-9" y="-9" width="118" height="118" clipPath={`url(#${id})`} />
    </svg>
  </div>;
});
