import React from 'react';
import {TypingBossId} from './types';
import './wyrm.css';
import registration from './bossVisualRegistration';
export default function BossIdleSprite({bossId,inspectFrame}:{bossId:TypingBossId;inspectFrame?:number}) {
  const geometry=registration.idles[bossId];
  return <span className="boss-idle-viewport" data-testid="boss-idle-animation" data-boss={bossId} aria-hidden="true"><span className="boss-idle-frames" style={{backgroundImage:`url("${process.env.PUBLIC_URL || ''}/assets/typing-boss/idles/${bossId}.webp")`,
    width:`${geometry.scaleX*100}%`,height:`${geometry.scaleY*100}%`,left:`${geometry.left}%`,top:`${geometry.top}%`,right:'auto',bottom:'auto',
    ...(inspectFrame===undefined?{}:{animation:'none',backgroundPositionX:`${Math.max(0,Math.min(5,inspectFrame))/5*100}%`})}}/></span>;
}
