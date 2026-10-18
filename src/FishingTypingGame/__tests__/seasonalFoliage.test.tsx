import React,{useRef} from 'react';
import {act,fireEvent,render} from '@testing-library/react';
import SeasonalFoliage from '../scene/SeasonalFoliage';
import {GARDEN_READY_EVENT} from '../scene/gardenEvents';
import {plantSnapshot,PlantSnapshot,PlantWorld} from '../engine/plantLifecycle';
import {PLANT_ART_V1,plantSprites,spritePoint} from '../scene/plantVisuals';
import {visiblePlantPerches,refreshPlantTargets,PlantPerch} from '../scene/plantMap';
import {createFlight,isPerched,planPerch} from '../scene/butterflyFlight';
import {WORLD,worldAt} from '../engine/world';

declare const test:any,expect:any,jest:any,afterEach:any;
afterEach(()=>jest.restoreAllMocks());
const world:PlantWorld={seed:'visible-plant-test',generationVersion:1};
const snapshot=(day:number)=>plantSnapshot('cove',worldAt(WORLD.epoch+day*WORLD.dayMs+1),world);
function Fixture({garden}:{garden:PlantSnapshot}){const scene=useRef<HTMLDivElement>(null);return <div ref={scene} className="f-scene" data-season={garden.calendar.season}><img data-layer="cove-seat" alt=""/><SeasonalFoliage sceneRef={scene} snapshot={garden}/></div>;}
function dimensions(){
  jest.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(800);jest.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(600);
  jest.spyOn(HTMLElement.prototype,'offsetWidth','get').mockReturnValue(1000);jest.spyOn(HTMLElement.prototype,'offsetHeight','get').mockReturnValue(560);
  jest.spyOn(HTMLElement.prototype,'offsetLeft','get').mockReturnValue(0);jest.spyOn(HTMLElement.prototype,'offsetTop','get').mockReturnValue(0);
  jest.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){
    if(this.dataset.lifeSprite){const parent=this.parentElement!.getBoundingClientRect(),width=parseFloat(this.style.width)/100*parent.width,height=parseFloat(this.style.height)/100*parent.height;
      const left=parent.left+parseFloat(this.style.left)/100*parent.width,top=parent.top+parseFloat(this.style.top)/100*parent.height;return {left,top,width,height,right:left+width,bottom:top+height} as DOMRect;}
    const left=parseFloat(this.style.left)||0,top=parseFloat(this.style.top)||0,width=parseFloat(this.style.width)||800,height=parseFloat(this.style.height)||600;
    return {left,top,width,height,right:left+width,bottom:top+height} as DOMRect;
  });
}

test('each species has separate foliage maturity and all five stem-stage cutouts with traced contact pixels',()=>{
  expect(Object.keys(PLANT_ART_V1)).toHaveLength(9);
  Object.values(PLANT_ART_V1).forEach(library=>{
    expect(Object.keys(library)).toHaveLength(9);
    expect(library['foliage-winter'].image).toContain('/foliage-winter.webp');
    for(const art of Object.values(library)){expect(art.image).toContain('plants/v1/');expect(art.width).toBeGreaterThan(10);expect(art.height).toBeLessThanOrEqual(320);
      expect(art.root.x).toBeGreaterThanOrEqual(0);expect(art.root.y).toBeLessThanOrEqual(1);expect(art.perch.y).toBeLessThan(1);}
  });
});

test('roots and species stay fixed through seasonal maturity and resize; only visible images mount lazily',()=>{
  dimensions();const spring=snapshot(8),summer=snapshot(38),view=render(<Fixture garden={spring}/>);
  const positions=()=>Array.from(view.container.querySelectorAll<HTMLElement>('[data-life-base]')).map(el=>[el.dataset.lifeBase,parseFloat(el.style.left)+parseFloat(el.style.width)*.5,parseFloat(el.style.top)+parseFloat(el.style.height)*.96]);
  const original=positions();act(()=>window.dispatchEvent(new Event('resize')));expect(positions()).toEqual(original);
  view.container.querySelectorAll('img[data-life-art]').forEach(image=>expect(image).toHaveAttribute('loading','lazy'));
  const identity=(s:PlantSnapshot)=>s.plants.map(p=>[p.id,p.speciesId,p.x,p.y]);expect(identity(summer)).toEqual(identity(spring));
  view.rerender(<Fixture garden={summer}/>);expect(positions()).toEqual(original);
  expect(view.container.querySelectorAll('[data-life-base]').length).toBeGreaterThan(0);view.unmount();
});

test('the same plant gets substantially smaller farther up the bank without moving either root',()=>{
  dimensions();const original=snapshot(40),plant=original.plants.find(p=>p.kind==='flower')!;
  const garden={...original,plants:[{...plant,id:'near-root',x:.4,y:.92,scale:1,stems:[]},{...plant,id:'far-root',x:.4,y:.62,scale:1,stems:[]}]};
  const view=render(<Fixture garden={garden}/>);
  const near=view.container.querySelector<HTMLElement>('[data-life-base="near-root"]')!,far=view.container.querySelector<HTMLElement>('[data-life-base="far-root"]')!;
  expect(parseFloat(far.style.height)).toBeLessThan(parseFloat(near.style.height)*.35);
  for(const [node,y] of [[near,.92],[far,.62]] as const){
    expect(parseFloat(node.style.top)+parseFloat(node.style.height)*.96).toBeCloseTo(560*y,10);
    expect(parseFloat(node.style.left)+parseFloat(node.style.width)*.5).toBeCloseTo(400,10);
  }
  view.unmount();
});

test('foliage and stalk silhouettes vary by seed while keeping their grounded contacts and stable daily shapes',()=>{
  const garden=snapshot(40),next=snapshot(41);
  const shapes=garden.plants.filter(p=>p.kind!=='lily').map(plant=>{
    const sprites=plantSprites(plant,garden),foliage=sprites.find(s=>s.role==='foliage')!;
    const later=plantSprites(next.plants.find(p=>p.id===plant.id)!,next).find(s=>s.role==='foliage')!;
    expect([foliage.angle,foliage.flat,foliage.stretch,foliage.flipped]).toEqual([later.angle,later.flat,later.stretch,later.flipped]);
    sprites.forEach(sprite=>{
      const contact=spritePoint(sprite.art,sprite.art.root,sprite.angle,sprite.flipped,sprite.flat,sprite.stretch);
      expect(contact.x).toBe(sprite.art.root.x);expect(contact.y).toBe(sprite.art.root.y);
    });
    return [foliage.angle,foliage.flat,foliage.stretch,foliage.flipped];
  });
  expect(new Set(shapes.map(shape=>shape[0])).size).toBeGreaterThan(4);
  expect(new Set(shapes.map(shape=>shape[1])).size).toBeGreaterThan(4);
  expect(new Set(shapes.map(shape=>shape[2])).size).toBeGreaterThan(4);
  expect(new Set(shapes.map(shape=>shape[3])).size).toBe(2);
});

test('maps use loaded stage artwork, match the rendered local transform and release removed targets',()=>{
  dimensions();const garden=snapshot(40),view=render(<Fixture garden={garden}/>),scene=view.container.firstChild as HTMLElement;
  const bounds={left:0,top:0,width:800,height:600} as DOMRect,notify=jest.fn();scene.addEventListener(GARDEN_READY_EVENT,notify);
  expect(visiblePlantPerches(scene,'cove',bounds).filter(p=>p.id.startsWith('v1-'))).toEqual([]);
  view.container.querySelectorAll('[data-life-art]').forEach(image=>fireEvent.load(image));
  const projected=visiblePlantPerches(scene,'cove',bounds).filter(p=>p.id.startsWith('v1-'));expect(projected.length).toBeGreaterThan(0);expect(notify).toHaveBeenCalled();
  const descriptors=garden.plants.flatMap(p=>plantSprites(p,garden));
  projected.forEach(point=>{const sprite=descriptors.find(s=>s.id===point.id)!,local=spritePoint(sprite.art,sprite.art.perch,sprite.angle,sprite.flipped,sprite.flat,sprite.stretch),rect=scene.querySelector(`[data-layer="${point.id}"]`)!.getBoundingClientRect();
    expect(point.x).toBeCloseTo((rect.left+rect.width*local.x)/800,10);expect(point.y).toBeCloseTo((rect.top+rect.height*local.y)/600,10);});
  const oldIds=new Set(projected.map(p=>p.id));view.rerender(<Fixture garden={snapshot(120)}/>);view.container.querySelectorAll('[data-life-art]').forEach(image=>fireEvent.load(image));
  expect(visiblePlantPerches(scene,'cove',bounds).some(p=>oldIds.has(p.id))).toBe(false);view.unmount();
});

test('an occupied stem removed by growth immediately releases its visitor and assigns a live destination',()=>{
  const flight=createFlight(()=>.5),old:PlantPerch={id:'old-stem',label:'Old flower',layer:'old-stem',x:.5,y:.7,z:.03,kind:'flower',uses:['butterfly']};
  planPerch(flight,old.x,old.y,()=>.5,{plantId:old.id,z:old.z,landed:true});const previous=flight.perch!;
  flight.flowerWait={plantId:old.id,x:.5,y:.7,until:10};
  const replacement={...old,id:'replacement-stem',layer:'replacement-stem'};
  refreshPlantTargets(flight,[replacement],'butterfly',()=>.5);
  expect(previous.finished).toBe(true);expect(isPerched(flight)).toBe(false);expect(flight.perch!.plantId).toBe(replacement.id);expect(flight.flowerWait).toBeUndefined();
  const next=flight.perch!;refreshPlantTargets(flight,[],'butterfly',()=>.5);expect(next.finished).toBe(true);expect(flight.plants).toEqual([]);
});
