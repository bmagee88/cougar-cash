import React from 'react';
import {act,render} from '@testing-library/react';
import ShorePlants from '../scene/ShorePlants';
import {plantSnapshot,PlantWorld} from '../engine/plantLifecycle';
import {floatingPlantPosition,plantSprites,waterPerspective,waterBob} from '../scene/plantVisuals';
import {PLANT_ANCHORS_V1,plantSpecies} from '../engine/plantSpecies';
import {WORLD,worldAt} from '../engine/world';

declare const test:any,expect:any,jest:any;
const world:PlantWorld={seed:'aquatic-life-test',generationVersion:1};
test('every fixed shoreline patch has exactly five pads, with seeded modular shapes and perspective',()=>{
  expect(waterPerspective(.65)).toBeLessThan(waterPerspective(.95));
  for(const location of ['dock','cove','birch'] as const){
    const garden=plantSnapshot(location,worldAt(WORLD.epoch+40*WORLD.dayMs+1),world),view=render(<div className="f-scene"><ShorePlants snapshot={garden}/></div>);
    const patches=view.container.querySelectorAll('[data-plant-kind="lily"]');expect(patches).toHaveLength(8);
    patches.forEach(patch=>expect(patch.querySelectorAll('.f-life-pad')).toHaveLength(5));
    expect(view.container.querySelectorAll('[data-floating-depth]')).toHaveLength(3);
    expect(view.container.querySelectorAll('[data-plant-kind="reed"]')).toHaveLength(PLANT_ANCHORS_V1[location].filter(p=>p.kind==='reed').length);
    garden.plants.filter(p=>p.kind==='lily').forEach(plant=>{expect(new Set(plant.slots.map(slot=>slot.scale)).size).toBe(5);expect(new Set(plant.slots.map(slot=>slot.angle)).size).toBe(5);});
    view.container.querySelectorAll('img').forEach(image=>expect(image).toHaveAttribute('loading','lazy'));view.unmount();
  }
});

test('pads form small flat surface patches and flowering stems stay attached to their own pad',()=>{
  const root=(sprite:ReturnType<typeof plantSprites>[number])=>({x:sprite.left+sprite.width*sprite.art.root.x,y:sprite.top+sprite.height*sprite.art.root.y});
  for(const location of ['dock','cove','birch'] as const){
    const garden=plantSnapshot(location,worldAt(WORLD.epoch+40*WORLD.dayMs+1),world);
    garden.plants.filter(plant=>plant.kind==='lily').forEach(plant=>{
      const sprites=plantSprites(plant,garden),pads=sprites.filter(sprite=>sprite.role==='pad'),centers=pads.map(root);
      pads.forEach(pad=>{expect(pad.width).toBeLessThan(.30);expect(pad.height*pad.flat/(pad.width*pad.stretch)).toBeLessThan(.30);});
      expect(Math.max(...centers.map(p=>p.y))-Math.min(...centers.map(p=>p.y))).toBeLessThan(.10);
      sprites.filter(sprite=>sprite.role==='stem').forEach(stem=>{
        const pad=pads.find(candidate=>candidate.slot===stem.slot)!;
        expect(root(stem).x).toBeCloseTo(root(pad).x,12);expect(root(stem).y).toBeCloseTo(root(pad).y,12);
      });
    });
  }
});
test('winter uses dedicated foliage art while retaining fall maturity, species, slots and independent stems',()=>{
  const autumn=plantSnapshot('birch',worldAt(WORLD.epoch+80*WORLD.dayMs),world),winter=plantSnapshot('birch',worldAt(WORLD.epoch+100*WORLD.dayMs),world);
  const visible=winter.plants.filter(p=>p.visible);expect(visible.every(p=>plantSpecies(p.speciesId).perennial)).toBe(true);
  visible.forEach(plant=>{const fall=autumn.plants.find(p=>p.id===plant.id)!;
    expect(plant.maturity).toBe('autumn');expect(plant.speciesId).toBe(fall.speciesId);expect(plant.slots).toEqual(fall.slots);
    const sprites=plantSprites(plant,winter);
    expect(sprites.filter(s=>s.role!=='stem').every(s=>s.art.image.endsWith('/foliage-winter.webp'))).toBe(true);
    expect(plantSprites(fall,autumn).filter(s=>s.role!=='stem').every(s=>s.art.image.endsWith('/foliage-autumn.webp'))).toBe(true);
    expect(sprites.filter(s=>s.role==='stem').map(s=>s.art.image)).toEqual(plant.stems.map(stem=>`plants/v1/${plant.speciesId}/${stem.stage}.webp`));});
  const winterView=render(<ShorePlants snapshot={winter}/>);
  expect(winterView.container.querySelectorAll('.f-life-pad')).toHaveLength(40);
  winterView.container.querySelectorAll('.f-life-pad img,.f-life-foliage img').forEach(image=>expect(image.getAttribute('src')).toContain('/foliage-winter.webp'));
  winterView.unmount();
  const spring=plantSnapshot('dock',worldAt(WORLD.epoch),world),view=render(<ShorePlants snapshot={spring}/>);
  expect(view.container.querySelectorAll('.f-life-stem')).toHaveLength(0);expect(view.container.querySelectorAll('.f-life-pad')).toHaveLength(40);view.unmount();
});

test('cove pads follow the bank instead of the old offshore gap, without mutating seeded roots or moving with growth',()=>{
  const garden=plantSnapshot('cove',worldAt(WORLD.epoch+40*WORLD.dayMs+1),world),next=plantSnapshot('cove',worldAt(WORLD.epoch+41*WORLD.dayMs+1),world);
  const saved=JSON.stringify(garden.plants);
  garden.plants.filter(plant=>plant.kind==='lily').forEach(plant=>{
    const position=floatingPlantPosition(plant,garden);
    expect(position.y).toBeGreaterThan(plant.y);expect(position.y-plant.y).toBeLessThan(.08);
    expect(position.x).toBeLessThanOrEqual(.94);expect(position.y).toBeLessThan(1);
    expect(floatingPlantPosition(next.plants.find(p=>p.id===plant.id)!,next)).toEqual(position);
    expect(floatingPlantPosition(plant,{...garden,location:'dock'})).toEqual({x:plant.x,y:plant.y});
    expect(floatingPlantPosition(plant,{...garden,location:'birch'})).toEqual({x:plant.x,y:plant.y});
  });
  expect(JSON.stringify(garden.plants)).toBe(saved);
});
test('water contact motion matches the native linear bob without growth or frame timers',()=>{
  const motion={start:1000,period:8000,phase:0};expect(waterBob(motion,1000)).toBeCloseTo(0);expect(waterBob(motion,3000)).toBeCloseTo(-.7);expect(waterBob(motion,7000)).toBeCloseTo(.7);expect(waterBob(motion,9000)).toBeCloseTo(0);
});

test('reed and lily groups share ground-distance scaling and keep it stable across repeated resize measurements',()=>{
  const garden=plantSnapshot('cove',worldAt(WORLD.epoch+40*WORLD.dayMs+1),world);
  const originals=['reed','lily'].map(kind=>garden.plants.find(p=>p.kind===kind)!);
  const fixture={...garden,plants:originals.flatMap(plant=>['near','far'].map((position,index)=>({...plant,id:`${plant.kind}-${position}`,y:index?.65:.95})))};
  const measured=jest.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){
    if(this.dataset.lifeBase){
      const scale=Number(this.style.getPropertyValue('--plant-distance-scale'))||1,width=100*scale,height=100*scale;
      const groundY=this.dataset.lifeBase!.endsWith('near')?570:390,contact=this.dataset.plantKind==='lily'?.5:.96;
      return {left:400-width*.5,top:groundY-height*contact,width,height} as DOMRect;
    }
    return {left:0,top:0,width:800,height:600} as DOMRect;
  });
  const view=render(<div className="f-scene"><ShorePlants snapshot={fixture}/></div>);
  try {
    for(const kind of ['reed','lily']){
      const near=view.container.querySelector<HTMLElement>(`[data-life-base="${kind}-near"]`)!,far=view.container.querySelector<HTMLElement>(`[data-life-base="${kind}-far"]`)!;
      const before=[near,far].map(node=>node.style.getPropertyValue('--plant-distance-scale'));
      expect(Number(before[1])).toBeLessThan(Number(before[0])*.5);
      act(()=>window.dispatchEvent(new Event('resize')));act(()=>window.dispatchEvent(new Event('resize')));
      expect([near,far].map(node=>node.style.getPropertyValue('--plant-distance-scale'))).toEqual(before);
    }
  } finally {view.unmount();measured.mockRestore();}
});
