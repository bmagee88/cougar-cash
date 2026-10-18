import React, { useRef } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { SCENE_DRIFT, useSceneParallax } from '../scene/useSceneParallax';
import FishingScene from '../scene/FishingScene';
import { ANGLER_OUTFITS, COVE_AUTUMN_SCENE, FISHING_ART, sceneForLocation } from '../scene/manifest';
import { WORLD, worldAt } from '../engine/world';
import {plantGenerationStats} from '../engine/plantLifecycle';

declare const test: any, expect: any, jest: any, beforeEach: any, afterEach: any;

let nextFrame: FrameRequestCallback | undefined;
let now: number;
function Scene({ reduced = false }: { reduced?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useSceneParallax(ref, reduced);
  return <div ref={ref} data-testid="scene" />;
}
function step(milliseconds: number) {
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 100) {
    now += 100;
    const callback = nextFrame; nextFrame = undefined;
    callback?.(now);
  }
}
beforeEach(() => {
  now = 0; nextFrame = undefined;
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => { nextFrame = callback; return 1; });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => { nextFrame = undefined; });
});
afterEach(() => { jest.restoreAllMocks(); });

test('travel thumbnails skip plant generation and ordinary hour changes reuse the plant snapshot',()=>{
  const before=plantGenerationStats(),world=worldAt(WORLD.epoch+WORLD.dayMs*40);
  const view=render(<FishingScene game={{phase:'idle'}} location="cove" weather="sunny" world={world} reducedMotion plantsEnabled={false}/>);
  expect(plantGenerationStats().locationsGenerated).toBe(before.locationsGenerated);expect(view.container.querySelector('[data-life-base]')).toBeNull();
  view.rerender(<FishingScene game={{phase:'idle'}} location="cove" weather="sunny" world={world} reducedMotion/>);
  const generated=plantGenerationStats();
  view.rerender(<FishingScene game={{phase:'idle'}} location="cove" weather="sunny" world={{...world,hour:14}} reducedMotion/>);
  expect(plantGenerationStats().daysReplayed).toBe(generated.daysReplayed);expect(plantGenerationStats().dailyPlantSteps).toBe(generated.dailyPlantSteps);view.unmount();
});

test('ambient drift reverses slowly, stays horizontal and ignores mouse position', () => {
  const { getByTestId } = render(<Scene />); const scene = getByTestId('scene');
  step(100);
  fireEvent.pointerMove(scene, { clientX: 900, clientY: 600 });
  expect(scene.style.getPropertyValue('--scene-x')).toBe('0.000px');
  step(SCENE_DRIFT.periodMs / 4);
  expect(parseFloat(scene.style.getPropertyValue('--scene-x'))).toBeCloseTo(8, 2);
  expect(scene.style.getPropertyValue('--scene-y')).toBe('0px');
  fireEvent.pointerLeave(scene);
  expect(parseFloat(scene.style.getPropertyValue('--scene-x'))).toBeCloseTo(8, 2);
  step(SCENE_DRIFT.periodMs / 2);
  expect(parseFloat(scene.style.getPropertyValue('--scene-x'))).toBeCloseTo(-8, 2);
});

test('background tabs pause and unmount cleans up the ambient animation', () => {
  const { getByTestId, unmount } = render(<Scene />); const scene = getByTestId('scene');
  step(5000); const before = scene.style.getPropertyValue('--scene-x');
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  fireEvent(document, new Event('visibilitychange')); step(10000);
  expect(scene.style.getPropertyValue('--scene-x')).toBe(before);
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  fireEvent(document, new Event('visibilitychange')); step(100);
  expect(scene.style.getPropertyValue('--scene-x')).toBe(before);
  unmount(); expect(nextFrame).toBeUndefined();
});

test('reduced motion leaves the scene still without scheduling frames', () => {
  const { getByTestId } = render(<Scene reduced />);
  step(20000);
  expect(getByTestId('scene').style.getPropertyValue('--scene-x')).toBe('0px');
  expect(window.requestAnimationFrame).not.toHaveBeenCalled();
});

test('autumn cove seats the existing angler in the shoreline frame and keeps canopy layers separate', () => {
  const world = worldAt(WORLD.epoch, { season: 'autumn', hour: 18 });
  const { container, rerender } = render(<FishingScene game={{ phase: 'idle' }} location="cove" weather="sunny" world={world} reducedMotion />);
  const plane = container.querySelector('.f-cove-ground-plane')!;
  const angler = plane.querySelector('.f-character')!;
  expect(angler).toHaveClass('f-character-seated');
  expect(plane.querySelector('[data-layer="cove-seat"]')).toBeInTheDocument();
  expect(angler.querySelector('[data-asset="fisherman"]')).toHaveAttribute('src', ANGLER_OUTFITS.autumn);
  expect(container.querySelector('[data-layer="dock"]')).not.toBeInTheDocument();
  const branches = container.querySelectorAll('.f-willow');
  expect(branches).toHaveLength(2);
  expect(branches[0].getAttribute('src')).not.toBe(branches[1].getAttribute('src'));
  expect(sceneForLocation('autumn', 'dock').some(layer => layer.id === 'cove-seat')).toBe(false);
  expect(sceneForLocation('winter', 'cove').some(layer => layer.id === 'cove-seat')).toBe(true);
  rerender(<FishingScene game={{ phase: 'idle' }} location="cove" weather="sunny" world={world} reducedMotion manifest={COVE_AUTUMN_SCENE.filter(layer => !['angler', 'water-interactions'].includes(layer.id))} />);
  expect(container.querySelector('.f-cove-ground-plane')).toBeInTheDocument();
  expect(container.querySelector('.f-character')).not.toBeInTheDocument();
});

test('season changes swap the outfit while preserving the seated rig and separate rod', () => {
  const props = { game: { phase: 'idle' as const }, location: 'dock', weather: 'sunny' as const, reducedMotion: true };
  const view = render(<FishingScene {...props} world={worldAt(WORLD.epoch, { season: 'spring' })} />);
  const seatedStyle = view.container.querySelector('.f-character')!.getAttribute('style');
  const rodStyle = view.container.querySelector('.f-rod')!.getAttribute('style');
  expect(ANGLER_OUTFITS.spring).toBe(FISHING_ART.fisherman);
  for (const season of ['summer', 'autumn', 'winter', 'spring'] as const) {
    view.rerender(<FishingScene {...props} world={worldAt(WORLD.epoch, { season })} />);
    expect(view.container.querySelector('[data-asset="fisherman"]')).toHaveAttribute('src', ANGLER_OUTFITS[season]);
    expect(view.container.querySelector('.f-character')).toHaveAttribute('style', seatedStyle);
    expect(view.container.querySelector('.f-rod')).toHaveAttribute('style', rodStyle);
    expect(view.container.querySelector('[data-asset="rod"]')).toHaveAttribute('src', FISHING_ART.rod);
  }
});

test('every cove season swaps all painted layers while keeping the shoreline seat and equipment aligned',()=>{
  const props={game:{phase:'idle' as const},location:'cove',weather:'sunny' as const,reducedMotion:true};
  const view=render(<FishingScene {...props} world={worldAt(WORLD.epoch,{season:'autumn',hour:14})}/>);
  const seatStyle=view.container.querySelector('.f-cove-ground-plane .f-character')!.getAttribute('style');
  const rodStyle=view.container.querySelector('.f-rod')!.getAttribute('style');
  for(const season of ['spring','summer','winter','autumn'] as const){
    view.rerender(<FishingScene {...props} world={worldAt(WORLD.epoch,{season,hour:14})}/>);
    for(const id of ['sky','cove-landscape','cove-seat','willow-branches-left','willow-branches-right'])expect(view.container.querySelector(`[data-layer="${id}"]`)).toHaveAttribute('src',expect.stringContaining(`/willow-cove/${season}/`));
    expect(view.container.querySelector('.f-cove-ground-plane .f-character')).toHaveAttribute('style',seatStyle);
    expect(view.container.querySelector('.f-rod')).toHaveAttribute('style',rodStyle);
    expect(view.container.querySelector('[data-asset="fisherman"]')).toHaveAttribute('src',ANGLER_OUTFITS[season]);
    expect(view.container.querySelectorAll('.f-willow')).toHaveLength(2);
    expect(view.container.querySelector('[data-layer="lake-background"]')).not.toBeInTheDocument();
  }
});
