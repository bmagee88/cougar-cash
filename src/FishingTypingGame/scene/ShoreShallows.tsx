import React, { memo, useId } from 'react';
import { artwork } from '../engine/artwork';
import ShoreWavelets,{ CausticGlints } from './ShoreWaveletEffects';

type ShoreLocation='birch'|'cove';
const SHORES={
  birch:{
    height:500,bed:artwork('locations/birch-point/shallow-lakebed.webp'),
    contact:'M315 358 C365 357 394 373 409 388 C427 390 459 407 469 425 C472 433 424 434 401 441 L350 452 C347 463 393 470 426 480 Q452 491 467 508',
    extension:'translate(8 13) scale(1.035 1.035)',belt:84,
    center:[325,485],radius:380,compression:.64,top:308,
    image:{x:155,y:305,width:680,height:340},tint:'#346e73',
    glints:{x:350,y:350,width:340,height:180},
  },
  cove:{
    height:1000*941/1672,bed:artwork('locations/willow-cove/shallow-lakebed.webp'),
    contact:'M424 443 Q478 453 518 478 T618 510 Q686 528 756 550 T897 594',
    extension:'translate(10 17) scale(1.025 1.025)',belt:112,
    center:[450,600],radius:560,compression:.58,top:290,
    image:{x:140,y:285,width:1040,height:520},tint:'#3b6a60',
    glints:{x:350,y:390,width:460,height:200},
  },
} as const;

function DepthMask({id,location}:{id:string;location:ShoreLocation}) {
  const shore=SHORES[location],height=shore.height+160;
  return <defs>
    <radialGradient id={`${id}-depth`} cx={shore.center[0]} cy={shore.center[1]} r={shore.radius} gradientUnits="userSpaceOnUse" gradientTransform={`translate(0 ${shore.center[1]*(1-shore.compression)}) scale(1 ${shore.compression})`}>
      <stop offset="0" stopColor="white" stopOpacity=".94"/><stop offset=".35" stopColor="white" stopOpacity=".9"/>
      <stop offset=".58" stopColor="white" stopOpacity=".62"/><stop offset=".78" stopColor="white" stopOpacity=".24"/>
      <stop offset=".92" stopColor="white" stopOpacity=".05"/><stop offset="1" stopColor="white" stopOpacity="0"/>
    </radialGradient>
    <linearGradient id={`${id}-top`} x1="0" y1={shore.top} x2="0" y2={shore.top+75} gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="white" stopOpacity="0"/><stop offset="1" stopColor="white"/>
    </linearGradient>
    <mask id={`${id}-bed`} maskUnits="userSpaceOnUse" x="0" y="0" width="1100" height={height}><rect width="1100" height={height} fill={`url(#${id}-depth)`}/></mask>
    <mask id={`${id}-near`} maskUnits="userSpaceOnUse" x="0" y="0" width="1100" height={height}><rect width="1100" height={height} fill={`url(#${id}-top)`}/></mask>
  </defs>;
}

/** Shares the seasonal shore's ground plane. The submerged continuation reuses
 * its rock/root texture, keeping a continuous edge at every responsive crop.
 * Static bitmap/mask work stays separate from the small animated surface SVG. */
export default memo(function ShoreShallows({location,shoreSrc}:{location:ShoreLocation;shoreSrc:string}) {
  const id=`shore-shallows-${useId().replace(/:/g,'')}`,shore=SHORES[location];
  const viewBox=`0 0 1000 ${shore.height}`;
  const bottom=<image href={shore.bed} {...shore.image} preserveAspectRatio="xMidYMid slice"/>;
  return <>
    <svg className={`f-shore-shallows f-shore-shallows-${location} f-shallow-bottom`} data-layer={`${location}-shallows`} data-scene-depth="foreground" viewBox={viewBox} preserveAspectRatio="none" aria-hidden="true">
      <DepthMask id={id} location={location}/>
      <defs>
        <mask id={`${id}-bank-belt`} maskUnits="userSpaceOnUse" x="0" y="0" width="1100" height={shore.height+160}>
          <path d={shore.contact} fill="none" stroke="white" strokeWidth={shore.belt} strokeLinecap="round"/>
        </mask>
        <mask id={`${id}-bank-alpha`} maskUnits="userSpaceOnUse" x="0" y="0" width="1100" height={shore.height+160} style={{maskType:'alpha'}}>
          <image href={shoreSrc} width="1000" height={shore.height} transform={shore.extension}/>
        </mask>
      </defs>
      <g mask={`url(#${id}-near)`}>
        <g mask={`url(#${id}-bed)`} className="f-shallow-bed">
          {bottom}<rect {...shore.image} fill={shore.tint} opacity=".4"/>
        </g>
        <g mask={`url(#${id}-bank-belt)`} data-shallow-bank={location}>
          <g mask={`url(#${id}-bed)`}>
            <image href={shoreSrc} width="1000" height={shore.height} transform={shore.extension}/>
            <rect width="1100" height={shore.height+160} fill={shore.tint} opacity=".56" mask={`url(#${id}-bank-alpha)`}/>
          </g>
        </g>
      </g>
      <path d={shore.contact} className="f-shore-contact-shadow"/>
    </svg>
    <svg className="f-shore-shallows f-shore-glints" data-layer={`${location}-caustic-light`} data-scene-depth="foreground" viewBox={viewBox} preserveAspectRatio="none" aria-hidden="true">
      <DepthMask id={`${id}-surface`} location={location}/>
      <g mask={`url(#${id}-surface-near)`}><g mask={`url(#${id}-surface-bed)`}>
        <CausticGlints {...shore.glints}/>
      </g></g>
    </svg>
    <ShoreWavelets area={location} height={shore.height} className="f-shore-surface-frame"/>
  </>;
});
