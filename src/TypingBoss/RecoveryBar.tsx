import React,{useEffect,useRef} from 'react';
import {TypingBossPlayer} from './types';

export default function RecoveryBar({player,clock}:{player:TypingBossPlayer;clock:React.MutableRefObject<number>}) {
  const fill=useRef<HTMLDivElement>(null);
  const deadline=player.defeated ? player.recoverAt : null;
  useEffect(()=>{
    if(!deadline || !fill.current)return;
    const duration=player.recoverDurationMs || 15000;
    const remaining=Math.max(0,deadline-Date.now()-clock.current);
    const progress=Math.max(0,Math.min(1,1-remaining/duration));
    fill.current.style.transform=`scaleX(${progress})`;
    const animation=fill.current.animate?.([{transform:`scaleX(${progress})`},{transform:'scaleX(1)'}],{
      duration:Math.max(1,remaining),easing:'linear',fill:'forwards',
    });
    return ()=>animation?.cancel();
  },[deadline,player.recoverDurationMs,clock]);
  if(!deadline)return null;
  return <div role="progressbar" aria-label={`${player.name} recovery`} aria-valuetext="Recovering to 1 HP"
    style={{position:'absolute',bottom:'calc(100% + 5px)',left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:72,height:7,
      background:'#142033',border:'1px solid #86efac',borderRadius:4,overflow:'hidden',zIndex:6}}>
    <div ref={fill} style={{width:'100%',height:'100%',background:'#86efac',transform:'scaleX(0)',transformOrigin:'left'}}/>
  </div>;
}
