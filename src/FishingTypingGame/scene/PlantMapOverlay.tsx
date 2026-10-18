import React, { CSSProperties,RefObject, useEffect,useState } from 'react';
import { PlantPerch, visiblePlantPerches } from './plantMap';
import { GARDEN_READY_EVENT } from './gardenEvents';

export default function PlantMapOverlay({ sceneRef, location }: { sceneRef: RefObject<HTMLDivElement>; location: string }) {
  const [{plants,sampleTime}, setMap] = useState<{plants:PlantPerch[];sampleTime:number}>({plants:[],sampleTime:0});
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const measure = () => setMap({plants:visiblePlantPerches(scene, location, scene.getBoundingClientRect()),sampleTime:performance.now()});
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(scene);
    scene.addEventListener('load', measure, true);
    scene.addEventListener(GARDEN_READY_EVENT,measure);
    window.addEventListener('resize', measure); measure();
    return () => { observer?.disconnect(); scene.removeEventListener('load', measure, true); scene.removeEventListener(GARDEN_READY_EVENT,measure);window.removeEventListener('resize', measure); };
  }, [sceneRef, location]);
  return <svg className="f-plant-map" data-layer="plant-map" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
    {plants.map(plant => {
      const x=(plant.motion?.baseX??plant.x)*1000,y=(plant.motion?.baseY??plant.y)*1000;
      const water=plant.motion?.water;
      const marker=<><circle cx={x} cy={y} r="5"/><text x={x+8} y={y-6}>{plant.label} · z {plant.z.toFixed(2)}</text></>;
      return <g key={plant.id} data-mapped-plant={plant.id} style={plant.motion?{transform:`translate(calc(var(--scene-x,0px) * ${plant.motion.px*1000}),calc(var(--scene-y,0px) * ${plant.motion.py*1000}))`} as CSSProperties:undefined}>
        {water?<g key={sampleTime} className="f-life-map-water" style={{'--water-map-amplitude':`${700/(plant.motion?.sceneHeight||1)}px`,animationDuration:`${water.period}ms`,animationDelay:`${-(sampleTime-water.start+water.phase*water.period)}ms`} as CSSProperties}>{marker}</g>:marker}
      </g>;
    })}
  </svg>;
}
