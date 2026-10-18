import React from 'react';
import { render } from '@testing-library/react';
import FishingScene from '../scene/FishingScene';
import ShoreShallows from '../scene/ShoreShallows';
import DockShallows from '../scene/DockShallows';
import { WORLD, worldAt } from '../engine/world';
import { SEASONS } from '../engine/types';

declare const test:any,expect:any,jest:any,afterEach:any;
afterEach(()=>{jest.restoreAllMocks();jest.useRealTimers();});

test('each lake bottom and submerged seasonal bank stay in the shore and angler frame',()=>{
  jest.useFakeTimers();
  const props={game:{phase:'idle' as const},weather:'sunny' as const,reducedMotion:true,intervalMs:10000};
  const world=(season:typeof SEASONS[number])=>worldAt(WORLD.epoch,{season,hour:14});
  const view=render(<FishingScene {...props} location="birch" world={world('summer')}/>);
  for(const location of ['birch','cove'] as const)for(const season of SEASONS){
    view.rerender(<FishingScene {...props} location={location} world={world(season)}/>);
    const shore=view.container.querySelector(`[data-layer="${location}-seat"]`)!;
    const ground=shore.closest('.f-cove-ground-plane')!;
    const bed=ground.querySelector(`[data-layer="${location}-shallows"]`)!;
    const surface=ground.querySelector(`[data-layer="${location}-shore-ripples"]`)!;
    expect(ground.querySelector('.f-character')).not.toBeNull();
    expect(bed).toHaveAttribute('data-scene-depth','foreground');
    expect(surface).toHaveAttribute('data-scene-depth','foreground');
    expect(bed.querySelector('[data-shallow-bank] image')).toHaveAttribute('href',shore.getAttribute('src'));
    const folder=location==='birch'?'birch-point':'willow-cove';
    expect(bed.querySelector(`image[href$="/${folder}/shallow-lakebed.webp"]`)).not.toBeNull();
    // Small shared wavelet cutouts animate separately from the large fixed bed.
    expect(surface.querySelector('image')).toBeNull();
    expect(surface.querySelector('img')).toHaveAttribute('src',expect.stringContaining('/effects/shore-wavelets/wavelet-'));
    expect(surface.querySelector('path')).toBeNull();
    expect(bed.querySelector('.f-caustic-light')).toBeNull();
    expect(ground.querySelector(`[data-layer="${location}-caustic-light"] .f-caustic-light`)).not.toBeNull();
    expect(view.container.querySelector('[data-layer="dock-shallows"]')).toBeNull();
    expect(view.container.querySelector(`[data-layer="${location==='birch'?'cove':'birch'}-shallows"]`)).toBeNull();
  }
  view.rerender(<FishingScene {...props} location="dock" world={world('summer')}/>);
  expect(view.container.querySelector('[data-layer="dock-shallows"]')).not.toBeNull();
  // The surface plant frame shares the bank's drawing level; the bank must
  // come later so its opaque grass still covers the shoreward pad edges.
  const pads=view.container.querySelector('.f-dock-water-plants')!;
  const bank=view.container.querySelector('[data-layer="near-shore"]')!;
  expect(pads.compareDocumentPosition(bank)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(view.container.querySelectorAll('[data-layer="shore-plants"]')).toHaveLength(1);
  expect(view.container.querySelector('.f-shore-shallows')).toBeNull();view.unmount();
});

test('separate previews get independent masks and add no animation timers',()=>{
  jest.useFakeTimers();
  const view=render(<><ShoreShallows location="birch" shoreSrc="/birch-summer.webp"/><ShoreShallows location="birch" shoreSrc="/birch-winter.webp"/><ShoreShallows location="cove" shoreSrc="/cove.webp"/><DockShallows/><DockShallows/></>);
  const ids=Array.from(view.container.querySelectorAll('[id]')).map(node=>node.id);
  expect(new Set(ids).size).toBe(ids.length);
  for(const node of Array.from(view.container.querySelectorAll('[mask]'))){
    const id=node.getAttribute('mask')!.slice(5,-1);
    expect(ids).toContain(id);
  }
  expect(jest.getTimerCount()).toBe(0);view.unmount();expect(jest.getTimerCount()).toBe(0);
});
