import React from 'react';
import './bossHealth.css';

// CSS retargets from the currently displayed fill, even when another hit arrives
// before the previous transition finishes. No per-frame React or network work.
export default function BossHealthFill({hp,maxHp,color}:{hp:number;maxHp:number;color:string}) {
  const ratio=maxHp>0?Math.max(0,Math.min(1,hp/maxHp)):0;
  return <div className="boss-health-fill" aria-hidden="true" style={{transform:`scaleX(${ratio})`,backgroundColor:color}}/>;
}
