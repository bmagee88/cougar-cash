import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import AnglerShadow from '../scene/AnglerShadow';
import { anglerShadowLight } from '../scene/anglerShadowLight';
import FishingScene from '../scene/FishingScene';
import { ANGLER_OUTFITS, CEDAR_SCENE, sceneForLocation } from '../scene/manifest';
import { WORLD, worldAt } from '../engine/world';

declare const test: any, expect: any, jest: any, afterEach: any;
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('each location receives one ground-masked shadow using the matching seasonal outfit, and thumbnails omit it', () => {
  const view = render(<div />);
  for (const location of ['dock', 'cove', 'birch']) for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
    const props = { game: { phase: 'idle' as const }, location, weather: 'sunny' as const, world: worldAt(WORLD.epoch, { season, hour: 14 }), reducedMotion: true };
    view.rerender(<FishingScene {...props} />);
    const shadow = view.container.querySelector<HTMLElement>('[data-layer="angler-shadow"]')!;
    expect(view.container.querySelectorAll('[data-layer="angler-shadow"]')).toHaveLength(1);
    const support = location === 'birch' ? 'birch-seat' : location === 'cove' ? 'cove-seat' : 'dock';
    const surface = sceneForLocation(season, location).find(layer => layer.id === support)!;
    expect(shadow).toHaveAttribute('data-shadow-surface', support);
    expect(shadow.style.getPropertyValue('--shadow-ground-mask')).toBe(`url("${surface.src}")`);
    expect(shadow.style.getPropertyValue('--shadow-outfit')).toBe(`url("${ANGLER_OUTFITS[season]}")`);
    expect(shadow.querySelector('.f-angler-shadow-rig')).toHaveAttribute('style', view.container.querySelector('.f-character')!.getAttribute('style'));
    view.rerender(<FishingScene {...props} manifest={sceneForLocation(season, location).filter(layer => !['angler', 'water-interactions'].includes(layer.id))} />);
    expect(view.container.querySelector('[data-layer="angler-shadow"]')).toBeNull();
  }
});

test('the surface mask tracks responsive layout and actual parallax, then releases its observer and listeners', () => {
  const original = window.ResizeObserver, disconnect = jest.fn();
  let resize: () => void = () => {};
  window.ResizeObserver = jest.fn((callback: () => void) => { resize = callback; return { observe: jest.fn(), disconnect }; }) as any;
  const offset = { x: 20, y: 80, w: 600, h: 400 };
  const rects = [
    jest.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(() => offset.x),
    jest.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(() => offset.y),
    jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(() => offset.w),
    jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(() => offset.h),
  ];
  const frames = jest.spyOn(window, 'requestAnimationFrame');
  try {
    const surface = CEDAR_SCENE.find(layer => layer.id === 'dock')!;
    const view = render(<div><img data-layer="dock" style={{ '--parallax': 0 } as React.CSSProperties} alt="" /><AnglerShadow surface={surface} outfit={ANGLER_OUTFITS.autumn} characterStyle={{}} /></div>);
    const shadow = view.container.querySelector<HTMLElement>('.f-angler-shadow')!;
    expect(shadow).toHaveAttribute('data-ready', 'true');
    expect(shadow.style.getPropertyValue('--shadow-ground-x')).toBe('20px');
    expect(shadow.style.getPropertyValue('--shadow-ground-w')).toBe('600px');
    expect(shadow.style.getPropertyValue('--shadow-ground-parallax')).toBe('0');
    offset.x = -120; offset.w = 1200; resize();
    expect(shadow.style.getPropertyValue('--shadow-ground-x')).toBe('-120px');
    expect(shadow.style.getPropertyValue('--shadow-ground-w')).toBe('1200px');
    expect(frames).not.toHaveBeenCalled();
    view.unmount(); expect(disconnect).toHaveBeenCalledTimes(1);
    const set = jest.spyOn(shadow.style, 'setProperty'); fireEvent.resize(window);
    expect(set).not.toHaveBeenCalled();
  } finally { window.ResizeObserver = original; rects.forEach(spy => spy.mockRestore()); }
});

test('cloud cover softens the cast, low sun elongates it, and dark nights retain contact and a faint lantern cast', () => {
  const day = anglerShadowLight(12, 'full', 1), cloudy = anglerShadowLight(12, 'full', .18);
  expect(day.cast).toBeGreaterThan(cloudy.cast * 3);
  expect(cloudy.blur).toBeGreaterThan(day.blur);
  expect(Math.abs(anglerShadowLight(7.5, 'full', 1).flatten)).toBeGreaterThan(Math.abs(day.flatten));
  const night = anglerShadowLight(22, 'new', 1);
  expect(night.contact).toBeGreaterThan(.3); expect(night.cast).toBeGreaterThan(0);
  expect(night.cast).toBeLessThan(day.cast); expect(night.shear).toBeLessThan(0);
});
