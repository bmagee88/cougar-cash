import React, { CSSProperties, useMemo } from 'react';
import { FISHING_ART } from './manifest';
import { coverPatches } from './reelPath';

export interface WaterCover { cover: readonly boolean[]; phraseLength: number }
export default function WaterGrassCover({ cover, cursor, layerRef }: { cover: WaterCover; cursor?: number; layerRef: React.RefObject<HTMLDivElement> }) {
  const patches = useMemo(() => coverPatches(cover.cover, cover.phraseLength), [cover.cover, cover.phraseLength]);
  return <div ref={layerRef} className="f-water-cover" data-layer="retrieve-grass-cover" aria-hidden="true">
    {patches.map(patch => {
      const active = cursor !== undefined && cursor >= patch.start && cursor <= patch.end;
      return <div key={patch.start} className={`f-cover-patch ${active ? 'f-cover-active' : ''}`} data-cover-start={patch.start} data-cover-end={patch.end} data-cover-progress={patch.at} data-cover-active={active}
        style={{ '--cover-at': patch.at, '--cover-scale': .85 + patch.at * .4 + (patch.end - patch.start) * .07, '--cover-delay': `${-patch.start * .37}s`, zIndex: Math.round(patch.at * 100) } as CSSProperties}>
        <div className="f-cover-reflection"><img src={FISHING_ART.grassCover} alt="" draggable={false} /></div>
        <div className="f-cover-waterline" />
        <img className="f-cover-fronds f-sway" src={FISHING_ART.grassCover} alt="" draggable={false} />
      </div>;
    })}
  </div>;
}
