import React from 'react';
import { act, render } from '@testing-library/react';
import LakeFog from '../scene/LakeFog';
import FishingScene from '../scene/FishingScene';
import { lakeFogLight } from '../scene/fogLighting';
import { stepAmbientAnimations } from '../scene/useSceneParallax';
import { MOON_PHASES, Season } from '../engine/types';
import { WORLD, worldAt } from '../engine/world';
import { lakeFogAt, weatherFogDensity } from '../engine/lakeFog';

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

test('timed fog fades for one second and reduced motion releases fog immediately', () => {
  const view = render(<LakeFog active world={world} location="dock" intervalMs={5000} />);
  expect(view.container.querySelector('[data-fog-depth]')).not.toBeNull(); expect(jest.getTimerCount()).toBe(0);
  view.rerender(<LakeFog active={false} world={world} location="dock" intervalMs={5000} />);
  act(()=>jest.advanceTimersByTime(999));expect(view.container.querySelector('[data-fog-depth]')).not.toBeNull();
  act(()=>jest.advanceTimersByTime(1));
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
  const target=document.createElement('div');target.className='f-lake-fog';
  const mist = { animationName: 'f-lake-fog-drift', currentTime: 500, playbackRate: 1, playState: 'paused',effect:{target} };
  const bite = { animationName: 'f-bite-bob', currentTime: 500, playbackRate: 1, playState: 'running' };
  const scene = document.createElement('div'); Object.defineProperty(scene, 'getAnimations', { value: () => [mist, bite] });
  stepAmbientAnimations(scene, 10000);
  expect(mist.currentTime).toBe(10500); expect(bite.currentTime).toBe(500);
});

test('most warm-season dawns get independently rolled mist, with varied density and occasional clear dawns', () => {
  for (const season of ['spring', 'summer', 'autumn', 'winter'] as Season[]) {
    const mornings = Array.from({ length: 512 }, (_, gameDay) => lakeFogAt({ gameDay, season, hour: 6 }));
    const misty = mornings.filter(fog => fog.density > 0), chance = misty.length / mornings.length;
    expect(chance).toBeGreaterThan(season === 'winter' ? .1 : .75);
    expect(chance).toBeLessThan(season === 'winter' ? .35 : .95);
    expect(Math.max(...misty.map(fog => fog.peak)) - Math.min(...misty.map(fog => fog.peak))).toBeGreaterThan(.4);
  }
});

test('a dawn keeps its roll after reloads, then thins smoothly through morning and unloads before noon', () => {
  for (let gameDay = 0; gameDay < 120; gameDay++) {
    const conditions = { gameDay, season: 'summer' as const, hour: 6 }, fog = lakeFogAt(conditions);
    expect(lakeFogAt({ ...conditions })).toEqual(fog);
    expect(lakeFogAt({ ...conditions, hour: 0 }).density).toBe(0);
    expect(lakeFogAt({ ...conditions, hour: 12 }).density).toBe(0);
    if (!fog.occurs) continue;
    expect(lakeFogAt({ ...conditions, hour: 8 }).density).toBeLessThan(fog.density);
    let previous = fog.peak;
    for (let hour = fog.liftHour; hour <= 12; hour += .05) {
      const density = lakeFogAt({ ...conditions, hour }).density;
      expect(density).toBeLessThanOrEqual(previous + .000001); previous = density;
    }
    for (const hour of [fog.startHour, fog.peakHour, fog.liftHour, fog.endHour]) {
      const before = lakeFogAt({ ...conditions, hour: hour - .001 }).density;
      const after = lakeFogAt({ ...conditions, hour: hour + .001 }).density;
      expect(Math.abs(before - after)).toBeLessThan(.006);
    }
  }
});

test('morning lake mist coexists with changing weather without replacing rain or rerolling its density', () => {
  const gameDay = Array.from({ length: 20 }, (_, i) => i).find(day => lakeFogAt({ gameDay: day, season: 'summer', hour: 6 }).occurs)!;
  const dawn = { ...world, gameDay, hour: 6 }, density = lakeFogAt(dawn).density;
  const props = { game: { phase: 'idle' as const }, location: 'dock', world: dawn, reducedMotion: true };
  const view = render(<FishingScene {...props} weather="sunny" />);
  const fog = view.container.querySelector<HTMLElement>('[data-layer="lake-fog"]')!;
  expect(fog).toHaveStyle({ opacity: String(density) });
  view.rerender(<FishingScene {...props} weather="rain" />);
  expect(view.container.querySelector('[data-layer="lake-fog"]')).toBe(fog);
  expect(fog).toHaveStyle({ opacity: String(density) });
  expect(view.container.querySelector('[data-weather-layer="rain"]')).not.toBeNull();
  view.rerender(<FishingScene {...props} weather="wind" />);
  expect(fog).toHaveStyle({ opacity: String(density) });
  view.rerender(<FishingScene {...props} weather="sunny" world={{ ...dawn, hour: 10 }} />);
  expect(Number(fog.style.opacity)).toBeLessThan(density);
  view.rerender(<FishingScene {...props} weather="sunny" world={{ ...dawn, hour: 12 }} />);
  expect(fog.querySelector('[data-fog-depth]')).toBeNull();
  view.unmount(); expect(jest.getTimerCount()).toBe(0);
});

test('thinner banks are more transparent and shallow, while fog weather retains its own changing thickness', () => {
  const view = render(<LakeFog active density={.9} distanceHaze={.66} world={world} location="cove" />);
  const fog = view.container.querySelector<HTMLElement>('[data-layer="lake-fog"]')!;
  const thickHeight = parseFloat(fog.style.getPropertyValue('--fog-far-height'));
  const thickHaze = Number(fog.style.getPropertyValue('--fog-distance'));
  view.rerender(<LakeFog active density={.25} distanceHaze={.66} world={world} location="cove" />);
  expect(fog).toHaveStyle({ opacity: '.25' });
  expect(parseFloat(fog.style.getPropertyValue('--fog-far-height'))).toBeLessThan(thickHeight);
  expect(Number(fog.style.getPropertyValue('--fog-distance'))).toBeLessThan(thickHaze);
  view.rerender(<LakeFog active density={0} world={world} location="cove" intervalMs={10000} />);
  act(()=>jest.advanceTimersByTime(1000));
  expect(fog.querySelector('[data-fog-depth]')).toBeNull(); view.unmount(); expect(jest.getTimerCount()).toBe(0);
  const weatherDensities = Array.from({ length: 50 }, (_, gameDay) => weatherFogDensity({ ...world, gameDay }));
  expect(Math.max(...weatherDensities) - Math.min(...weatherDensities)).toBeGreaterThan(.2);
  expect(weatherDensities.every(value => value >= .57 && value <= .97)).toBe(true);
});
