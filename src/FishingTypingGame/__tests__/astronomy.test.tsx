import React from 'react';
import { act, render } from '@testing-library/react';
import { projectStar, showerRadiant, siderealAngle, skyEventsAt, SKY_RATES, wrapDegrees } from '../engine/astronomy';
import { celestialPosition, WORLD, worldAt } from '../engine/world';
import { WEATHERS } from '../engine/types';
import FishingScene from '../scene/FishingScene';
import CelestialSky from '../scene/CelestialSky';
import { MeteorShower } from '../scene/SkyEvents';
import StarField from '../scene/StarField';
import { stepAmbientAnimations } from '../scene/useSceneParallax';

declare const test: any, expect: any, jest: any, beforeEach: any, afterEach: any, require: any;
beforeEach(() => jest.useFakeTimers());
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('catalog contains real equatorial coordinates and recognizable bright stars', () => {
  const catalog = require('../../../public/assets/fishing/sky/stars.json');
  expect(catalog.length).toBe(2851);
  expect(catalog.every((star: number[]) => star.length === 4 && star.every(Number.isFinite) && Math.abs(star[0]) <= 180 && Math.abs(star[1]) <= 90 && star[2] <= 5.5)).toBe(true);
  // Sirius: 6h45m RA, -16.7 degrees declination, visual magnitude -1.46.
  expect(catalog.some(([ra, dec, mag]: number[]) => Math.abs(ra - 101.287) < .01 && Math.abs(dec + 16.716) < .01 && mag < -1.4)).toBe(true);
});

test('sidereal rotation is continuous through midnight and slightly faster than the westward moon sweep', () => {
  const before = siderealAngle({ gameDay: 12, hour: 23.999 });
  const after = siderealAngle({ gameDay: 13, hour: .001 });
  expect(wrapDegrees(after - before)).toBeCloseTo(SKY_RATES.stars / 24 * .002, 5);
  expect(SKY_RATES.stars).toBeGreaterThan(SKY_RATES.moon);
  expect(SKY_RATES.stars - SKY_RATES.moon).toBeCloseTo(13.176358, 5);
  const moonBefore = celestialPosition(23, true), moonAfter = celestialPosition(1, true);
  expect(moonAfter.x).toBeGreaterThan(moonBefore.x);
  const rising = projectStar(0, 0, -30), meridian = projectStar(0, 0, 0), setting = projectStar(0, 0, 30);
  expect(rising.x).toBeLessThan(meridian.x); expect(meridian.x).toBeLessThan(setting.x);
  expect(meridian.altitude).toBeCloseTo(45); expect(rising.y).toBeGreaterThan(meridian.y); expect(setting.y).toBeGreaterThan(meridian.y);
  expect(projectStar(0, 0, 180).altitude).toBeLessThan(0);
});

test('rare aurora and meteor schedules are independent, repeatable, can overlap, and survive midnight', () => {
  let auroras = 0, meteors = 0, both = 0, overlapNight = -1;
  for (let night = 0; night < 10000; night++) {
    const events = skyEventsAt({ gameDay: night + 1, hour: 0 });
    auroras += Number(!!events.aurora); meteors += Number(!!events.meteors);
    if (events.aurora && events.meteors) { both++; overlapNight = night; }
  }
  expect(auroras / 10000).toBeGreaterThan(.05); expect(auroras / 10000).toBeLessThan(.09);
  expect(meteors / 10000).toBeGreaterThan(.11); expect(meteors / 10000).toBeLessThan(.17);
  expect(both).toBeGreaterThan(20); expect(both).toBeLessThan(200);
  expect(skyEventsAt({ gameDay: overlapNight, hour: 23.999 })).toEqual(skyEventsAt({ gameDay: overlapNight + 1, hour: .001 }));
  const once = skyEventsAt({ gameDay: 33, hour: 0 }); expect(skyEventsAt({ gameDay: 33, hour: 0 })).toEqual(once);
});

test('both sky events retain separate layers under every weather, with clouds above the sky', () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => [] } as Response);
  const world = worldAt(WORLD.epoch, { hour: 0, moonPhase: 'new' });
  const props = { game: { phase: 'idle' as const }, location: 'dock', world, reducedMotion: true, skyPreview: { aurora: true, meteors: true } };
  const view = render(<FishingScene {...props} weather="sunny" />);
  for (const weather of WEATHERS) {
    view.rerender(<FishingScene {...props} weather={weather} />);
    const aurora = view.container.querySelector('[data-sky-event="aurora"]')!;
    const meteors = view.container.querySelector('[data-sky-event="meteors"]')!;
    expect(aurora).not.toBeNull(); expect(meteors).not.toBeNull(); expect(aurora.parentElement).toBe(meteors.parentElement);
    expect(aurora.closest('.f-cloud-system')).toBeNull();
  }
  view.unmount(); expect(jest.getTimerCount()).toBe(0);
});

test('every meteor travels away from the same rotating radiant', () => {
  const event = skyEventsAt({ gameDay: 10, hour: 0 }, { meteors: true }).meteors!;
  const radiant = showerRadiant(event, 60, .5), view = render(<MeteorShower event={event} angle={60} shoreline={.5} />);
  view.container.querySelectorAll('line').forEach(line => {
    const x = Number(line.getAttribute('x1')), y = Number(line.getAttribute('y1'));
    const dx = Number(line.getAttribute('x2')) - x, dy = Number(line.getAttribute('y2')) - y;
    const rx = x - radiant.x * 1000, ry = y - radiant.y * 500;
    expect(dx * ry - dy * rx).toBeCloseTo(0, 5); expect(dx * rx + dy * ry).toBeGreaterThan(0);
  });
});

test('star data loads only at night, releases on daylight, and aborts its request on unmount', async () => {
  const originalFetch = global.fetch;
  const fetcher = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([[20, 0, 1, .1]]) });
  global.fetch = fetcher;
  try {
    const day = worldAt(WORLD.epoch, { hour: 14 }), night = worldAt(WORLD.epoch, { hour: 0 });
    const view = render(<CelestialSky world={day} background="" />); expect(fetcher).not.toHaveBeenCalled();
    await act(async () => view.rerender(<CelestialSky world={night} background="" />));
    expect(fetcher).toHaveBeenCalledTimes(1); expect(view.container.querySelector('.f-star-catalog')).toHaveAttribute('data-catalog-stars', '1');
    view.rerender(<CelestialSky world={day} background="" />); act(() => jest.advanceTimersByTime(1100));
    expect(view.container.querySelector('.f-star-catalog')).toBeNull(); expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    view.unmount(); expect(jest.getTimerCount()).toBe(0);
  } finally { global.fetch = originalFetch; }
});

test('sampled environment rendering advances all sky events without advancing fish cues', () => {
  const animations = ['f-star-scintillation', 'f-aurora-drift', 'f-aurora-breathe', 'f-meteor-pass', 'f-bite-bob'].map(animationName => ({ animationName, currentTime: 500, playbackRate: 1, playState: 'paused' }));
  const scene = document.createElement('div'); Object.defineProperty(scene, 'getAnimations', { value: () => animations });
  stepAmbientAnimations(scene, 5000);
  animations.slice(0, 4).forEach(animation => expect(animation.currentTime).toBe(5500)); expect(animations[4].currentTime).toBe(500);
});

test('a pending star request handles cancellation without retrying', async () => {
  let aborted = false;
  jest.spyOn(global, 'fetch').mockImplementation((_url: any, options: any) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('Aborted', 'AbortError')); });
  }));
  const view = render(<StarField angle={20} shoreline={.5} moonlight={0} />);
  await act(async () => view.unmount());
  act(() => jest.advanceTimersByTime(30000));
  expect(aborted).toBe(true); expect(global.fetch).toHaveBeenCalledTimes(1);
});
