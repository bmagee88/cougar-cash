import React from "react";
import { TypingBossId } from "./types";
import registration from "./dragonFlameRegistration";
import "./dragonFlame.css";

export default function DragonFlameSprite({ bossId, src, duration, delay, inspectFrame }: {
  bossId: TypingBossId; src: string; duration: number; delay: number; inspectFrame?: number;
}) {
  const geometry=registration[bossId],camera=geometry.camera,frames=geometry.frames;
  const transform=(index:number)=>{
    const frame=frames[index];
    return `translate(${frame.x/geometry.cell*100}%,${frame.y/geometry.cell*100}%) scale(${frame.scaleX},${frame.scaleY})`;
  };
  const variables=Object.fromEntries(frames.map((_,index)=>[`--flame-transform-${index}`,transform(index)]));
  const frozen=inspectFrame===undefined?undefined:Math.min(19,Math.max(0,Math.trunc(inspectFrame)));
  return <span className="dragon-sprite-viewport dragon-flame-viewport"><span
    data-testid="dragon-sprite-cell" data-frame-count={frames.length} aria-hidden="true" className="dragon-flame-cell"
    style={{ ...variables,"--flame-still-transform":transform(11),
      width:`${geometry.cell/camera.size*100}%`,height:`${geometry.cell/camera.size*100}%`,
      left:`${-camera.left/camera.size*100}%`,top:`${-camera.top/camera.size*100}%`,backgroundImage:`url("${src}")`,
      backgroundPosition:frozen===undefined?undefined:`${frozen%5/4*100}% ${Math.floor(frozen/5)/3*100}%`,
      animationName:frozen===undefined?undefined:"none",transform:frozen===undefined?undefined:transform(frozen),
      animationDuration:`${duration}ms`,animationDelay:`${delay}ms`,
    } as React.CSSProperties}/></span>;
}
