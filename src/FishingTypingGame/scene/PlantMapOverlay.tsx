import React, { RefObject, useEffect, useState } from 'react';
import { PlantPerch, visiblePlantPerches } from './plantMap';

export default function PlantMapOverlay({ sceneRef, location }: { sceneRef: RefObject<HTMLDivElement>; location: string }) {
  const [plants, setPlants] = useState<PlantPerch[]>([]);
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const measure = () => setPlants(visiblePlantPerches(scene, location, scene.getBoundingClientRect()));
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(scene);
    scene.addEventListener('load', measure, true);
    window.addEventListener('resize', measure); measure();
    return () => { observer?.disconnect(); scene.removeEventListener('load', measure, true); window.removeEventListener('resize', measure); };
  }, [sceneRef, location]);
  return <svg className="f-plant-map" data-layer="plant-map" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
    {plants.map(plant => <g key={plant.id} data-mapped-plant={plant.id}>
      <circle cx={plant.x * 1000} cy={plant.y * 1000} r="5"/>
      <text x={plant.x * 1000 + 8} y={plant.y * 1000 - 6}>{plant.label} · z {plant.z}</text>
    </g>)}
  </svg>;
}
