import React,{useRef} from 'react';
import { render,screen } from '@testing-library/react';
import SeasonalFoliage from '../scene/SeasonalFoliage';
import { foliageArt } from '../scene/foliage';
import { plantsForLocation } from '../scene/plantMap';
import { Season } from '../engine/types';

declare const test:any,expect:any,jest:any,afterEach:any;
afterEach(()=>jest.restoreAllMocks());

test('all three locations have seasonal flower stations; winter has no foliage textures',()=>{
  for(const location of ['dock','cove','birch']){
    for(const season of ['spring','summer','autumn'] as Season[]){
      const art=foliageArt(location,season);expect(art).toHaveLength(6);
      expect(art.reduce((count,patch)=>count+patch.flowers.length,0)).toBeGreaterThanOrEqual(12);
      const plants=plantsForLocation(location,season).filter(plant=>plant.layer.includes('-flowers-'));
      expect(plants.filter(plant=>plant.kind==='flower').length).toBeGreaterThanOrEqual(12);
      plants.forEach(plant=>{expect(plant.x).toBeGreaterThan(0);expect(plant.x).toBeLessThan(1);expect(plant.y).toBeLessThan(1);});
    }
    expect(foliageArt(location,'winter')).toEqual([]);
  }
});

function Fixture({season}:{season:Season}){
  const scene=useRef<HTMLDivElement>(null);
  return <div ref={scene} data-season={season}><img data-layer="cove-seat" alt=""/>
    <SeasonalFoliage sceneRef={scene} location="cove" season={season}/></div>;
}

test('a seasonal change replaces visible flower images, winter unloads them, and observers disconnect',()=>{
  const original=window.ResizeObserver,disconnect=jest.fn();
  window.ResizeObserver=jest.fn(()=>({observe:jest.fn(),disconnect})) as any;
  jest.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(800);
  jest.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(600);
  jest.spyOn(HTMLElement.prototype,'offsetWidth','get').mockReturnValue(1000);
  jest.spyOn(HTMLElement.prototype,'offsetHeight','get').mockReturnValue(560);
  jest.spyOn(HTMLElement.prototype,'offsetLeft','get').mockReturnValue(50);
  jest.spyOn(HTMLElement.prototype,'offsetTop','get').mockReturnValue(40);
  const images=()=>screen.getAllByAltText('').filter(image=>image.hasAttribute('data-foliage-station'));
  try{
    const view=render(<Fixture season="spring"/>);
    expect(images()).toHaveLength(6);images().forEach(image=>expect(image).toHaveAttribute('src',expect.stringContaining('/cove/spring/')));
    view.rerender(<Fixture season="summer"/>);
    expect(images()).toHaveLength(6);images().forEach(image=>expect(image).toHaveAttribute('src',expect.stringContaining('/cove/summer/')));
    view.rerender(<Fixture season="winter"/>);expect(images()).toHaveLength(0);
    view.unmount();expect(disconnect).toHaveBeenCalledTimes(2);
  }finally{window.ResizeObserver=original;}
});
