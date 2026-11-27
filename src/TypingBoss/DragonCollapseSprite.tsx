import visualRegistration from './bossVisualRegistration';
import React from 'react';
import { TypingBossId } from './types';
import registration from './dragonRegistration';
import './dragonCollapse.css';

export default function DragonCollapseSprite({bossId,src,duration,delay,held,inspectFrame}: {
  bossId:Exclude<TypingBossId,'kraken'|'giantSandWyrm'>;src:string;duration:number;delay:number;held:boolean;inspectFrame?:number;
}) {
  const {cell}=registration[bossId],camera=visualRegistration.cameras[bossId], row={infernalDragon:0,cindermaw:1,emberWhelp:2}[bossId];
  const frame=held?5:inspectFrame;
  return <span className="dragon-sprite-viewport"><span data-testid="dragon-collapse-cell" aria-hidden="true" className="dragon-collapse-cell"
    style={{width:`${cell/camera.size*100}%`,height:`${cell/camera.size*100}%`,left:`${-camera.left/camera.size*100}%`,top:`${-camera.top/camera.size*100}%`,
      backgroundImage:`url("${src}")`,backgroundPositionY:`${row/2*100}%`,backgroundPositionX:frame===undefined?undefined:`${frame/5*100}%`,
      animationName:frame===undefined?undefined:'none',animationDuration:`${duration}ms`,animationDelay:`${delay}ms`}}/></span>;
}
