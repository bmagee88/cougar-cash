import React, { CSSProperties, memo, useId } from 'react';
import { artwork } from '../engine/artwork';
import { DOCK_PARALLAX } from './manifest';
import ShoreWavelets,{ CausticGlints } from './ShoreWaveletEffects';

const BOTTOM = artwork('locations/cedar/shallow-lakebed.webp');
function DepthMask({id,right=false}:{id:string;right?:boolean}) {
  return <defs>
    <radialGradient id={`${id}-depth`} cx={right?550:210} cy={right?340:590} r={right?540:650} gradientUnits="userSpaceOnUse" gradientTransform={right?'translate(0 136) scale(1 .6)':'translate(0 247.8) scale(1 .58)'}>
      <stop offset="0" stopColor="white" stopOpacity={right?'.92':'.96'}/><stop offset={right?'.55':'.48'} stopColor="white" stopOpacity={right?'.72':'.9'}/>
      <stop offset={right?'.85':'.73'} stopColor="white" stopOpacity={right?'.18':'.52'}/>{!right&&<stop offset=".9" stopColor="white" stopOpacity=".13"/>}<stop offset="1" stopColor="white" stopOpacity="0"/>
    </radialGradient>
    <mask id={`${id}-bed`} maskUnits="userSpaceOnUse" x={right?0:-180} y={right?0:230} width="1100" height="430"><rect x={right?0:-180} y={right?0:230} width="1100" height="430" fill={`url(#${id}-depth)`}/></mask>
  </defs>;
}

/** A static bed beneath small, naturally animated surface layers. Everything
 * shares the dock/shore art coordinates, so resizing needs no geometry reads. */
export default memo(function DockShallows() {
  const id = `dock-shallows-${useId().replace(/:/g, '')}`;
  const frame = { '--shallows-parallax': DOCK_PARALLAX } as CSSProperties;
  return <div className="f-dock-shallows" data-layer="dock-shallows" data-scene-depth="foreground" aria-hidden="true">
    <svg className="f-dock-shallow-frame f-shallow-bottom" viewBox="0 0 1000 500" preserveAspectRatio="none" style={frame}>
      <DepthMask id={id}/>
      <g mask={`url(#${id}-bed)`} className="f-shallow-bed">
        <image href={BOTTOM} x="-140" y="230" width="1060" height="530" preserveAspectRatio="xMidYMid slice" />
        <rect x="-140" y="230" width="1060" height="530" fill="#34777c" opacity=".24" />
      </g>
    </svg>
    <svg className="f-dock-shallow-right f-shallow-bottom" viewBox="0 0 600 340" preserveAspectRatio="none">
      <DepthMask id={`${id}-right`} right/>
      <g mask={`url(#${id}-right-bed)`} className="f-shallow-bed">
        <image href={BOTTOM} x="0" y="0" width="760" height="380" preserveAspectRatio="xMidYMid slice" />
        <rect width="760" height="420" fill="#34777c" opacity=".28" />
      </g>
    </svg>
    <svg className="f-dock-shallow-frame f-shore-glints" data-layer="dock-caustic-light" viewBox="0 0 1000 500" preserveAspectRatio="none" style={frame}>
      <DepthMask id={`${id}-surface`}/><g mask={`url(#${id}-surface-bed)`}><CausticGlints x={40} y={325} width={480} height={210}/></g>
    </svg>
    <svg className="f-dock-shallow-right f-shore-glints" viewBox="0 0 600 340" preserveAspectRatio="none">
      <DepthMask id={`${id}-right-surface`} right/><g mask={`url(#${id}-right-surface-bed)`}><CausticGlints x={145} y={160} width={410} height={170}/></g>
    </svg>
    <ShoreWavelets area="dock" className="f-dock-shallow-frame f-wave-dock-bank" style={frame}/>
    <ShoreWavelets area="dock-right" width={600} height={340} className="f-dock-shallow-right f-wave-dock-right"/>
    <ShoreWavelets area="dock-posts" className="f-dock-shallow-frame f-wave-dock-posts" style={frame}/>
  </div>;
});
