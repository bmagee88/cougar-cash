import React from 'react';
import { act, render } from '@testing-library/react';
import LakeFog from '../scene/LakeFog';
import FishingScene from '../scene/FishingScene';
import { lakeFogLight } from '../scene/fogLighting';
import { stepAmbientAnimations } from '../scene/useSceneParallax';
import { MOON_PHASES } from '../engine/types';
import { WORLD, worldAt } from '../engine/world';

declare const test: any, expect: any, jest: any, beforeEach: any, afterEach: any;
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
const world = worldAt(WORLD.epoch, { hour: 14, season: 'summer', moonPhase: 'full' });
const luminance = (color: string) => color.split(' ').map(Number).reduce((sum, channel, i) => sum + channel * [.2126, .7152, .0722][i], 0);

test('fog scatters daylight but stays dark at night, with moonlight following phase and elevation', () => {
  const day = lakeFogLight(14, 'full'), moonlit = lakeFogLight(0, 'full'), dark = lakeFogLight(0, 'new');
  expect(luminance(day.color)).toBeGreaterThan(luminance(moonlit.color) * 3);
  expect(luminance(moonlit.color)).toBeGreaterThan(luminance(dark.color));
  expect(day.halo).toBe(0); expect(dark.halo).toBe(0); expect(moonlit.halo).toBeGreaterThan(0);
  expect(lakeFogLight(19, 'full').halo).toBeLessThan(moonlit.halo);
  MOON_PHASES.forEach(phase => {
    expect(lakeFogLight(14, phase).color).toBe(day.color);
    [4, 6, 18, 20].forEach(hour => {
      const before = lakeFogLight(hour - .001, phase), after = lakeFogLight(hour + .001, phase);
      expect(Math.abs(luminance(before.color) - luminance(after.color))).toBeLessThan(2);
      expect(Math.abs(before.halo - after.halo)).toBeLessThan(.001);
    });
  });
});

test('fog texture mounts on demand, fades out in natural mode, and releases outgoing layers', () => {
  const view = render(<LakeFog active={false} world={world} location="dock" />);
  expect(view.container.querySelector('[data-fog-depth]')).toBeNull(); expect(jest.getTimerCount()).toBe(0);
  view.rerender(<LakeFog active world={world} location="dock" />);
  expect(view.container.querySelectorAll('[data-fog-depth]')).toHaveLength(4);
  expect(jest.getTimerCount()).toBe(0);
  view.rerender(<LakeFog active={false} world={world} location="dock" />);
  act(() => jest.advanceTimersByTime(7999)); expect(view.container.querySelector('[data-fog-depth]')).not.toBeNull();
  act(() => jest.advanceTimersByTime(1)); expect(view.container.querySelector('[data-fog-depth]')).toBeNull();
  view.unmount(); expect(jest.getTimerCount()).toBe(0);
});

test('timed rendering and reduced motion release outgoing fog immediately without a new timer loop', () => {
  const view = render(<LakeFog active world={world} location="dock" intervalMs={5000} />);
  expect(view.container.querySelector('[data-fog-depth]')).not.toBeNull(); expect(jest.getTimerCount()).toBe(0);
  view.rerender(<LakeFog active={false} world={world} location="dock" intervalMs={5000} />);
  expect(view.container.querySelector('[data-fog-depth]')).toBeNull();
  view.rerender(<LakeFog active world={world} location="dock" reducedMotion />);
  view.rerender(<LakeFog active={false} world={world} location="dock" reducedMotion />);
  expect(view.container.querySelector('[data-fog-depth]')).toBeNull(); expect(jest.getTimerCount()).toBe(0);
});

test('mist shares each painted background crop so the waterline does not drift when the viewport changes', () => {
  const props = { game: { phase: 'idle' as const }, weather: 'fog' as const, world, reducedMotion: true };
  const view = render(<FishingScene {...props} location="dock" />);
  for (const location of ['dock', 'cove']) {
    view.rerender(<FishingScene {...props} location={location} />);
    const landscape = view.container.querySelector(`[data-layer="${location === 'dock' ? 'lake-background' : 'cove-landscape'}"]`) as HTMLElement;
    const fog = view.container.querySelector('[data-layer="lake-fog"]') as HTMLElement;
    const frame = fog.querySelector('.f-lake-fog-frame') as HTMLElement;
    (['left', 'top', 'width', 'height'] as const).forEach(property => expect(frame.style[property]).toBe(landscape.style[property]));
    expect(parseFloat(fog.style.getPropertyValue('--fog-shore'))).toBeCloseTo(location === 'dock' ? 50 : 55.5);
    expect(fog).toHaveAttribute('aria-hidden', 'true');
    expect(fog.querySelector('.f-character')).toBeNull();
    expect(view.container.querySelector('.f-character')).not.toBeNull();
  }
  view.unmount(); expect(jest.getTimerCount()).toBe(0);
});

test('the existing environment timer advances paused fog without seeking game animations', () => {
  const mist = { animationName: 'f-lake-fog-drift', currentTime: 500, playbackRate: 1, playState: 'paused' };
  const bite = { animationName: 'f-bite-bob', currentTime: 500, playbackRate: 1, playState: 'running' };
  const scene = document.createElement('div'); Object.defineProperty(scene, 'getAnimations', { value: () => [mist, bite] });
  stepAmbientAnimations(scene, 10000);
  expect(mist.currentTime).toBe(10500); expect(bite.currentTime).toBe(500);
});
