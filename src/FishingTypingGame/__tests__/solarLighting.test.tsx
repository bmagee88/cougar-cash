import React from 'react';
import { act, render } from '@testing-library/react';
import { skyEventsAt } from '../engine/astronomy';
import { WEATHERS } from '../engine/types';
import { WORLD, worldAt } from '../engine/world';
import { ridgeHeight, solarLightAt } from '../scene/solarLight';
import FishingScene from '../scene/FishingScene';
import { CloudLightFilter, useSolarFrame } from '../scene/SolarLighting';

declare const test: any, expect: any, jest: any, beforeEach: any, afterEach: any;
beforeEach(() => jest.useFakeTimers());
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('Sailor’s Delight rolls occasionally per game day, independently of night events', () => {
  let count = 0;
  for (let gameDay = 0; gameDay < 10000; gameDay++) {
    const world = { gameDay, hour: 17.5 };
    const natural = skyEventsAt(world);
    count += Number(!!natural.sailorsDelight);
    expect(skyEventsAt(world, { aurora: true, meteors: true }).sailorsDelight).toEqual(natural.sailorsDelight);
  }
  expect(count / 10000).toBeGreaterThan(.16); expect(count / 10000).toBeLessThan(.2);
  const world = { gameDay: 58, hour: 17.5 };
  expect(skyEventsAt(world)).toEqual(skyEventsAt(world));
  expect(skyEventsAt(world, { sailorsDelight: false }).sailorsDelight).toBeUndefined();
  for (const hour of [0, 7, 12, 15, 20, 23]) expect(skyEventsAt({ ...world, hour }, { sailorsDelight: true }).sailorsDelight).toBeUndefined();
});

test('sunset cloud light fades in and out rather than flashing on at event boundaries', () => {
  const event = skyEventsAt({ gameDay: 58, hour: 17.5 }, { sailorsDelight: true }).sailorsDelight!;
  const strength = (hour: number) => skyEventsAt({ gameDay: 58, hour }, { sailorsDelight: true }).sailorsDelight?.strength ?? 0;
  expect(strength(event.startHour)).toBe(0);
  expect(strength(event.startHour + .01)).toBeLessThan(.002);
  expect(strength(17.5)).toBeGreaterThan(.5);
  expect(strength(event.endHour - .01)).toBeLessThan(.002);
  expect(strength(event.endHour)).toBe(0);
});

test('glare follows the actual ridge crop, changes warmth, and vanishes in daytime and at night', () => {
  const at = (hour: number, width = 1200, height = 700) => solarLightAt(worldAt(WORLD.epoch, { hour }), 'dock', width, height);
  expect(at(7.5).glare).toBeGreaterThan(.7);
  expect(at(16.5).phase).toBe('sunset'); expect(at(7.5).phase).toBe('sunrise');
  expect(at(7.5).halo).not.toBe(at(16.5).halo);
  for (const hour of [0, 5, 11, 12, 13, 20]) expect(at(hour).glare).toBe(0);
  for (const [width, height] of [[1440, 820], [868, 643], [390, 844]]) {
    const light = at(7.5, width, height);
    const frameHeight = Math.max(width * 1.02 / 2, height * 1.02);
    expect(light.clearance).toBeCloseTo((ridgeHeight(light.x, worldAt(WORLD.epoch).season, 'dock') - light.y) * frameHeight / height, 6);
    expect(light.glare).toBeGreaterThanOrEqual(0); expect(light.glare).toBeLessThanOrEqual(1);
  }
});

test('sunset event keeps its own layer and cloud texture under every weather, and releases its filter afterward', () => {
  const world = worldAt(WORLD.epoch, { hour: 17.5 });
  const props = { game: { phase: 'idle' as const }, location: 'dock', world, reducedMotion: true, intervalMs: 5000, skyPreview: { sailorsDelight: true } };
  const view = render(<FishingScene {...props} weather="sunny" />);
  for (const weather of WEATHERS) {
    view.rerender(<FishingScene {...props} weather={weather} />);
    expect(view.container.querySelector('[data-sky-event="sailors-delight"]')).not.toBeNull();
    expect(view.container.querySelector('[data-sunlit-clouds="true"]')).not.toBeNull();
    expect(view.container.querySelector('feComposite[operator="atop"]')).not.toBeNull();
    expect(view.container.querySelector('[data-layer="sun-mountain-contrast"]')!.closest('[data-layer="mountain-plane"]')).not.toBeNull();
  }
  view.rerender(<FishingScene {...props} location="cove" weather="sunny" />);
  expect(view.container.querySelectorAll('[data-layer="sun-mountain-contrast"]')).toHaveLength(1);
  view.rerender(<FishingScene {...props} world={worldAt(WORLD.epoch, { hour: 12 })} weather="sunny" />);
  expect(view.container.querySelector('.f-solar-filter')).toBeNull();
  expect(view.container.querySelector('[data-sky-event="sailors-delight"]')).toBeNull();
  view.unmount(); expect(jest.getTimerCount()).toBe(0);
});

test('solar geometry observes resize and releases its observer when the scene unloads', () => {
  const original = global.ResizeObserver;
  let resize: () => void = () => {};
  const disconnect = jest.fn();
  global.ResizeObserver = jest.fn().mockImplementation(callback => { resize = callback; return { observe: jest.fn(), disconnect }; });
  const rect = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 1200, height: 700 } as DOMRect);
  function Geometry() {
    const ref = React.useRef<HTMLDivElement>(null), size = useSolarFrame(ref);
    return <div ref={ref} data-size={`${size.width}:${size.height}`} />;
  }
  try {
    const view = render(<Geometry />);
    rect.mockReturnValue({ width: 390, height: 844 } as DOMRect);
    act(() => resize()); expect(view.container.firstChild).toHaveAttribute('data-size', '390:844');
    view.unmount(); expect(disconnect).toHaveBeenCalledTimes(1);
  } finally { global.ResizeObserver = original; }
});

test('moving cloud sunlight reuses its mask image and dense cloud cover attenuates its color', () => {
  const at = (hour: number) => {
    const world = worldAt(WORLD.epoch, { hour });
    return solarLightAt(world, 'dock', 1200, 700, skyEventsAt(world, { sailorsDelight: true }));
  };
  const view = render(<CloudLightFilter id="test-light" light={at(17)} />);
  const image = view.container.querySelector('feImage')!, uri = image.getAttribute('href'), x = image.getAttribute('x');
  view.rerender(<CloudLightFilter id="test-light" light={at(17.5)} />);
  expect(image.getAttribute('href')).toBe(uri); expect(image.getAttribute('x')).not.toBe(x);
  const clearStrength = Number(view.container.querySelector('feFuncA')!.getAttribute('slope'));
  view.rerender(<CloudLightFilter id="test-light" light={at(17.5)} transmission={.03} />);
  expect(Number(view.container.querySelector('feFuncA')!.getAttribute('slope'))).toBeLessThan(clearStrength * .25);
});
