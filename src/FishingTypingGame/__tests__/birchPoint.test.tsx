import React from 'react';
import { act, render } from '@testing-library/react';
import { LOCATIONS } from '../engine/config';
import { deserializeSave, emptySave, travel } from '../engine/storage';
import { SEASONS } from '../engine/types';
import { WORLD, worldAt } from '../engine/world';
import FishingScene from '../scene/FishingScene';
import { BIRCH_SEAT, sceneForLocation } from '../scene/manifest';
import { foregroundTreesForLocation, mappedTreesForLocation, treesForLocation } from '../scene/treeMap';
import { ridgeHeight, solarLightAt } from '../scene/solarLight';
const birchRidges: Record<typeof SEASONS[number], number[]> = require('../scene/birch-ridges.json');

declare const test: any, expect: any, jest: any, beforeEach: any, afterEach: any;
beforeEach(() => jest.useFakeTimers());
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('Birch Point travel deducts its price once, survives reload and preserves gear and journal', () => {
  const save = emptySave(), cost = LOCATIONS.find(location => location.id === 'birch')!.cost;
  const arrived = travel(save, 'birch');
  expect(arrived.location).toBe('birch'); expect(arrived.balance).toBe(save.balance - cost);
  expect(travel(arrived, 'birch')).toBe(arrived);
  expect(travel({ ...save, balance: cost - 1 }, 'birch').location).toBe('dock');
  const restored = deserializeSave(JSON.stringify(arrived));
  expect(restored.location).toBe('birch'); expect(restored.lineGear).toEqual(save.lineGear);
  expect(restored.notebook).toEqual(save.notebook);
});

test('all four seasons keep seven aligned art layers, foreground trees, seated angler and shared effects', () => {
  const props = { game: { phase: 'idle' as const }, location: 'birch', weather: 'fog' as const, reducedMotion: true, showTreeMap: true };
  const world = (season: typeof SEASONS[number]) => worldAt(WORLD.epoch, { season, hour: 22, moonPhase: 'full' });
  const view = render(<FishingScene {...props} world={world('autumn')} />);
  const seatStyle = view.container.querySelector('.f-character')!.getAttribute('style');
  for (const season of SEASONS) {
    view.rerender(<FishingScene {...props} world={world(season)} />);
    const scene = view.container.querySelector('.f-spot-birch')!;
    expect(scene).toHaveAttribute('aria-label', expect.stringContaining('Birch Point'));
    expect(scene.querySelector('[data-layer="birch-sky"]')).toHaveAttribute('src', expect.stringContaining('/shared/sky-painted.webp'));
    for (const id of ['mountains', 'far-trees', 'treeline-water', 'seat', 'trunks', 'right-plants']) {
      expect(scene.querySelector(`[data-layer="birch-${id}"]`)).toHaveAttribute('src', expect.stringContaining(`/birch-point/${season}/`));
    }
    const ground = scene.querySelector('.f-cove-ground-plane')!;
    expect(ground.querySelector('[data-layer="birch-trunks"]')).not.toBeNull();
    expect(ground.querySelector('[data-layer="birch-right-plants"]')).not.toBeNull();
    expect(ground.querySelector('.f-character')).toHaveAttribute('style', seatStyle);
    expect(scene.querySelector('.f-tree-map-foreground')).toHaveAttribute('style', ground.getAttribute('style'));
    expect(scene.querySelectorAll('[data-mapped-tree]')).toHaveLength(12);
    expect(scene.querySelectorAll('[data-lantern-surface]')).toHaveLength(4);
    expect(scene.querySelector('[data-layer="lake-fog"]')).not.toBeNull();
    expect(scene.querySelector('[data-layer="dock"]')).toBeNull();
    expect(sceneForLocation(season, 'birch').find(layer => layer.id === 'birch-seat')!.seat).toEqual(BIRCH_SEAT);
  }
  view.unmount();
  // jsdom queues an AbortError notification when an image request is released.
  act(() => jest.advanceTimersByTime(0));
  expect(jest.getTimerCount()).toBe(0);
});

test('the travel thumbnail can omit the angler and keeps the complete seasonal shoreline', () => {
  const manifest = sceneForLocation('summer', 'birch').filter(layer => !['angler', 'water-interactions'].includes(layer.id));
  const view = render(<FishingScene game={{ phase: 'idle' }} location="birch" world={worldAt(WORLD.epoch, { season: 'summer', hour: 14 })} weather="sunny" reducedMotion manifest={manifest} />);
  expect(view.container.querySelector('.f-character')).toBeNull();
  expect(view.container.querySelector('[data-layer="birch-seat"]')).not.toBeNull();
  expect(view.container.querySelector('[data-layer="birch-trunks"]')).not.toBeNull();
});

test('ten distant bird trees and two close birches have separate frames and the sun follows the traced skyline', () => {
  expect(treesForLocation('birch')).toHaveLength(10);
  expect(foregroundTreesForLocation('birch')).toHaveLength(2);
  expect(mappedTreesForLocation('birch')).toHaveLength(12);
  expect(foregroundTreesForLocation('birch').every(tree => tree.top.z < 1)).toBe(true);
  for (const season of SEASONS) {
    expect(ridgeHeight(.5, season, 'birch')).toBe(birchRidges[season][64]);
    for (const [width, height] of [[1440, 700], [390, 640]]) {
      const light = solarLightAt(worldAt(WORLD.epoch, { season, hour: 7.5 }), 'birch', width, height);
      const frameHeight = Math.max(width * 1.02 / 2, height * 1.02);
      expect(light.clearance).toBeCloseTo((ridgeHeight(light.x, season, 'birch') - light.y) * frameHeight / height, 6);
    }
  }
});
