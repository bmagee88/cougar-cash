import React,{CSSProperties,memo,useLayoutEffect,useRef} from 'react';
import {GrowingPlant,PlantSnapshot,plantRandom} from '../engine/plantLifecycle';
import {GARDEN_READY_EVENT} from './gardenEvents';
import {floatingPlantPosition,plantBoxAspect,plantDepthScale,plantSprites} from './plantVisuals';
import {depthAtWaterline,sceneDepthFrame} from './sceneDepth';
import PlantSprite from './PlantSprite';
import {DOCK_PARALLAX} from './manifest';

function WaterPlant({plant,snapshot}:{plant:GrowingPlant;snapshot:PlantSnapshot}) {
  const started=useRef(performance.now()),period=8000+plantRandom(snapshot.world,'water-period',plant.id)*4000,phase=plantRandom(snapshot.world,'water-phase',plant.id);
  const position=floatingPlantPosition(plant,snapshot);
  return <div className="f-floating-plant-patch f-life-base" data-life-base={plant.id} data-floating-patch={plant.id}
    data-plant-species={plant.speciesId} data-plant-kind="lily" data-plant-maturity={plant.maturity} data-active-stems={plant.stems.length}
    style={{left:`${position.x*100}%`,top:`${position.y*100}%`,width:`${plant.anchor.width!*plant.scale*100}%`}}>
    <div className="f-life-water-motion" data-water-start={started.current} data-water-period={period} data-water-phase={phase}
      style={{animationDuration:`${period}ms`,animationDelay:`${-period*phase}ms`}}>
      {plantSprites(plant,snapshot).map(sprite=><PlantSprite key={`${sprite.id}:${sprite.art.image}`} sprite={sprite}/>)}</div>
  </div>;
}
/** Five pads or five potential reed stems per persistent spring base. */
export default memo(function ShorePlants({snapshot}:{snapshot:PlantSnapshot}) {
  const root=useRef<HTMLDivElement>(null),spot=snapshot.location;
  useLayoutEffect(()=>{
    const node=root.current,scene=node?.closest<HTMLElement>('.f-scene');if(!node||!scene)return;
    const measure=()=>{
      const bounds=scene.getBoundingClientRect();if(!bounds.height)return;
      const camera=sceneDepthFrame(scene,spot,bounds),horizon=camera.horizon;
      // Scaling around each clump's ground contact keeps its seeded root fixed.
      // Read all contacts before writing transforms; no animation-frame work.
      const samples=Array.from(node.querySelectorAll<HTMLElement>('[data-life-base]')).map(base=>{
        const rect=base.getBoundingClientRect(),rootY=base.dataset.plantKind==='lily'?.5:.96;
        const depth=depthAtWaterline((rect.top+rect.height*rootY-bounds.top)/bounds.height,horizon,camera);
        return {base,depth,scale:plantDepthScale(depth,camera)};
      });
      samples.forEach(({base,depth,scale})=>{
        base.style.setProperty('--plant-distance-scale',String(scale));base.dataset.plantDepth=depth.toFixed(3);
      });
      scene.dispatchEvent(new Event(GARDEN_READY_EVENT));
    };
    const loaded=(event:Event)=>{if(!(event.target as HTMLElement)?.dataset.lifeArt)measure();};
    const resize=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(measure);
    resize?.observe(scene);if(node.parentElement!==scene&&node.parentElement)resize?.observe(node.parentElement);
    node.querySelectorAll('.f-dock-plant-frame').forEach(frame=>resize?.observe(frame));
    scene.addEventListener('load',loaded,true);window.addEventListener('resize',measure);measure();
    return ()=>{resize?.disconnect();scene.removeEventListener('load',loaded,true);window.removeEventListener('resize',measure);};
  },[snapshot,spot]);
  const plants=snapshot.plants.filter(plant=>plant.visible),lilies=plants.filter(plant=>plant.kind==='lily');
  const water=[0,1,2].map(depth=><div key={depth} className="f-floating-plant-layer" data-floating-depth={['outer','middle','near'][depth]}>
    {lilies.filter(plant=>plant.anchor.floatingLayer===depth).map(plant=><WaterPlant key={plant.id} plant={plant} snapshot={snapshot}/>)}</div>);
  const reeds=plants.filter(plant=>plant.kind==='reed').map(plant=><div key={plant.id} className="f-life-reeds f-life-base" data-life-base={plant.id}
    data-plant-species={plant.speciesId} data-plant-kind="reed" data-plant-maturity={plant.maturity} data-active-stems={plant.stems.length}
    style={{left:`${plant.x*100}%`,top:`${plant.y*100}%`,width:`${plant.anchor.width!*plant.scale*.85*100}%`,aspectRatio:plantBoxAspect(plant)}}>
    {plantSprites(plant,snapshot).map(sprite=><PlantSprite key={`${sprite.id}:${sprite.art.image}`} sprite={sprite}/>)}</div>);
  const frameStyle={'--ground-parallax':DOCK_PARALLAX} as CSSProperties;
  return <div ref={root} className={`f-shore-plants f-shore-plants-${spot}`} data-layer="shore-plants" data-garden-key={snapshot.key} aria-hidden="true">
    {spot==='dock'?<><div className="f-dock-plant-frame f-dock-water-plants" style={frameStyle}>{water}</div>
      <div className="f-dock-plant-frame f-dock-reed-plants" style={frameStyle}>{reeds}</div></>:<>{water}{reeds}</>}
  </div>;
});
