import React, { CSSProperties, memo, useId } from 'react';
import { SceneAsset, Season } from '../engine/types';
import contours from './skyline-contours';

export function MountainHaze({ style, embedded = false }: { style: CSSProperties; embedded?: boolean }) {
  return <div data-layer="mountain-weather-haze" data-scene-depth={embedded ? undefined : 'background'} aria-hidden="true" className={`${embedded ? 'f-backdrop-content' : 'f-scene-layer'} f-mountain-haze`} style={{ ...style, opacity: 'var(--mountain-haze-opacity, 0)' }} />;
}

/** Two views of the same combined asset keep reflections intact while the ridge occludes the sky. */
export default memo(function LakeBackdrop({ layer, season }: { layer: SceneAsset; season: Season }) {
  const id = `ridge-${useId().replace(/:/g, '')}`;
  const mask = `mask-${id}`; const feather = `feather-${id}`;
  const style = { left: 'calc(50% - max(51cqw, 102cqh))', top: 'calc(50% - max(25.5cqw, 51cqh))', width: 'max(102cqw, 204cqh)', height: 'max(51cqw, 102cqh)',
    opacity: layer.opacity, '--layer-scale': layer.scale, '--parallax': layer.parallax } as CSSProperties;
  return <>
    <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
      <defs>
        <filter id={feather} filterUnits="objectBoundingBox" primitiveUnits="objectBoundingBox" x="-1%" y="-1%" width="102%" height="102%">
          <feMorphology in="SourceAlpha" operator="erode" radius="0 .005" />
          <feGaussianBlur stdDeviation=".0016" />
        </filter>
        <mask id={mask} maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox" x="0" y="0" width="1" height="1" style={{ maskType: 'alpha' }}>
          <polygon points={contours[season]} fill="white" filter={`url(#${feather})`} />
        </mask>
      </defs>
    </svg>
    <img data-layer="lake-background" data-scene-depth="background" src={layer.src} alt="" draggable={false} className="f-scene-layer" style={{ ...style, zIndex: 0 }} />
    <div data-layer="mountain-plane" data-scene-depth="background" className="f-scene-layer" style={{ ...style, zIndex: 3, maskImage: `url("#${mask}")`, WebkitMaskImage: `url("#${mask}")` }}>
      <img data-layer="mountain-landscape" src={layer.src} alt="" draggable={false} className="f-backdrop-content" />
      <MountainHaze embedded style={{}} />
    </div>
  </>;
});
