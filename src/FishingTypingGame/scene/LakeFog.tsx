import React, { CSSProperties, memo } from 'react';
import { artwork } from '../engine/artwork';
import { WorldConditions } from '../engine/types';
import { celestialPosition } from '../engine/world';
import { lakeFogLight } from './fogLighting';
import { lakeFrame, lakeShoreline } from './lakeFrame';
import { useLayerPresence } from './useLayerPresence';

/** Atmospheric distance haze plus shallow, independent banks of surface mist. */
export default memo(function LakeFog({ active, density = 1, distanceHaze = 1, world, location, reducedMotion = false, intervalMs = 0 }: {
  active: boolean; density?: number; distanceHaze?: number; world: WorldConditions; location: string; reducedMotion?: boolean; intervalMs?: number;
}) {
  const thickness = Number.isFinite(density) ? Math.max(0, Math.min(1, density)) : 0;
  const visible = active && thickness > 0;
  const present = useLayerPresence(visible, reducedMotion || intervalMs > 0 ? 0 : 8000);
  const light = lakeFogLight(world.hour, world.moonPhase);
  const shore = lakeShoreline(location);
  const moon = celestialPosition(world.hour, true);
  const style = {
    opacity: visible ? thickness : 0,
    '--fog-distance': Math.pow(thickness, .6) * distanceHaze,
    '--fog-far-height': `${5 + thickness * 7}%`, '--fog-mid-height': `${6 + thickness * 10}%`, '--fog-near-height': `${5 + thickness * 7}%`,
    '--lake-fog-color': light.color,
    '--lake-fog-mask': `url("${artwork('weather/lake-fog-mask.svg')}")`,
    '--fog-ridge': `${(shore - .24) * 100}%`, '--fog-trees': `${(shore - .11) * 100}%`,
    '--fog-shore': `${shore * 100}%`, '--fog-water': `${(shore + .10) * 100}%`, '--fog-clear': `${(shore + .29) * 100}%`,
    '--fog-bank-y': `${(shore - .012 - thickness * .023) * 100}%`, '--fog-mid-y': `${(shore + .025) * 100}%`, '--fog-near-y': `${(shore + .105) * 100}%`,
    '--fog-moon-x': `${moon.x}%`, '--fog-moon-y': `${moon.y}%`, '--fog-halo': light.halo,
  } as CSSProperties;
  return <div className={`f-lake-fog f-lake-fog-${location}`} data-layer="lake-fog" data-fog-density={visible ? thickness.toFixed(4) : '0'} aria-hidden="true" style={style}>
    {present && <>
      <div className="f-lake-fog-frame" style={lakeFrame(location)}>
        <div className="f-lake-fog-distance" data-fog-depth="far" />
        <div className="f-lake-fog-surface f-lake-fog-far-bank" data-fog-depth="shoreline" />
        <div className="f-lake-fog-surface f-lake-fog-mid-bank" data-fog-depth="middle" />
        <div className="f-lake-fog-surface f-lake-fog-near-wisp" data-fog-depth="near" />
      </div>
      <div className="f-lake-fog-moon-halo" />
    </>}
  </div>;
});
