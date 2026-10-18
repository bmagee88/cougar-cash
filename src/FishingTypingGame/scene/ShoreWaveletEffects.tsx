import React,{CSSProperties,memo} from 'react';
import { artwork } from '../engine/artwork';
import { SHORE_WAVE_POINTS,ShoreWaveArea,WAVELET_ART } from './shoreWaveletLayout';

/** Native transforms/opacity animate tiny shared cutouts; no JS timer, canvas,
 * turbulence filter, whole-shore stroke or moving lakebed is needed. */
export default memo(function ShoreWavelets({area,height=500,width=1000,className='',style}:{area:ShoreWaveArea;height?:number;width?:number;className?:string;style?:CSSProperties}) {
  return <div className={`f-shore-wavelets ${className}`} style={style} data-layer={`${area}-shore-ripples`} data-scene-depth="foreground" aria-hidden="true">
    {SHORE_WAVE_POINTS[area].map((point,index)=>{
      const art=WAVELET_ART[point.art];
      return <div key={index} className="f-shore-wavelet" data-wavelet={index} style={{left:`${point.x/width*100}%`,top:`${point.y/height*100}%`,width:`${point.width/width*100}%`,aspectRatio:art.width/art.height,'--wave-angle':`${point.angle}deg`,'--wave-crest':`${art.crestY*100}%`,'--wave-period':`${point.period}s`,'--wave-phase':`${point.phase}s`,'--wave-reach':`${-point.reach}%`} as CSSProperties}>
        <img className="f-shore-wavelet-motion" src={artwork(art.image)} alt="" draggable={false} decoding="async" loading="lazy"/>
      </div>;
    })}
  </div>;
});

const CAUSTIC=artwork('effects/shore-wavelets/caustic-light.webp');
/** Refracted light has irregular cells rather than repeated surface sine lines.
 * Its faint texture is separate from the stationary bottom bitmap. */
export function CausticGlints({x,y,width,height}:{x:number;y:number;width:number;height:number}) {
  return <g className="f-caustic-glints">
    <image href={CAUSTIC} x={x} y={y} width={width} height={height} preserveAspectRatio="none" className="f-caustic-light"/>
    <image href={CAUSTIC} x={x+width*.17} y={y+height*.12} width={width*.78} height={height*.83} preserveAspectRatio="none" className="f-caustic-light f-caustic-light-second"/>
  </g>;
}
