import React,{CSSProperties} from 'react';
import {artwork} from '../engine/artwork';
import {PlantSprite as Sprite} from './plantVisuals';
import {GARDEN_READY_EVENT} from './gardenEvents';

export default function PlantSprite({sprite}:{sprite:Sprite}) {
  return <span className={`f-life-sprite f-life-${sprite.role}`} data-life-sprite={sprite.id} data-layer={sprite.id}
    data-garden-ready="false" data-life-label={sprite.label} data-life-kind={sprite.kind} data-life-uses={sprite.uses.join(',')}
    data-life-dedicated={sprite.dedicated||undefined} data-life-stage={sprite.stage} data-life-slot={sprite.slot}
    data-life-perch-x={sprite.point.x} data-life-perch-y={sprite.point.y} data-life-root-y={sprite.art.root.y}
    style={{left:`${sprite.left*100}%`,top:`${sprite.top*100}%`,width:`${sprite.width*100}%`,height:`${sprite.height*100}%`,
      '--life-root-x':`${sprite.art.root.x*100}%`,'--life-root-y':`${sprite.art.root.y*100}%`,'--life-angle':`${sprite.angle}deg`,
      '--life-flat':sprite.flat,'--life-stretch':sprite.stretch,'--flower-flip':sprite.flipped?-1:1} as CSSProperties}>
    <img className="f-life-art" data-life-art={sprite.id} data-scene-depth="foreground" src={artwork(sprite.art.image)}
      width={sprite.art.width} height={sprite.art.height} alt="" draggable={false} loading="lazy" decoding="async" onLoad={event=>{
        event.currentTarget.parentElement!.dataset.gardenReady='true';event.currentTarget.closest('.f-scene')?.dispatchEvent(new Event(GARDEN_READY_EVENT));
      }}/>
  </span>;
}
