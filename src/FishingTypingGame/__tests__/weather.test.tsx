import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { Weather, WEATHERS } from '../engine/types';
import { deserializeSave, emptySave } from '../engine/storage';
import { lightningIntervalAt, STORM_LIGHTNING_TIMES, STORM_TIMING, weatherLighting, weatherVisuals } from '../engine/weather';
import { useWeatherVisuals } from '../useWeatherVisuals';
import FishingScene from '../scene/FishingScene';
import CloudSystem from '../scene/CloudSystem';
import { lightingAt, WORLD, worldAt } from '../engine/world';

declare const test: any, expect: any, jest: any;

test('clear, cloudy and rainy weather have distinct cloud cover and precipitation', () => {
  expect(weatherVisuals('sunny')).toMatchObject({ clear: 1, greyDeck: 0, darkDeck: 0, rain: 0, celestial: 1 });
  expect(weatherVisuals('overcast')).toMatchObject({ clear: 0, greyDeck: 1, darkDeck: 0, rain: 0 });
  expect(weatherVisuals('rain')).toMatchObject({ clear: 0, greyDeck: 0, darkDeck: 1, rain: 1 });
});

test('overcast and storms retain diffuse daytime light and only the actual clock turns to night', () => {
  const world = worldAt(WORLD.epoch, { hour: 14 });
  for(const weather of WEATHERS){
    const look=weatherVisuals(weather,90000),light=weatherLighting(14,world.moonPhase,weather,look);
    expect(light.nightAmount).toBe(0);expect(light.brightness).toBeGreaterThan(.8);
    expect(look.saturation).toBe(1);expect(light.saturation).toBeGreaterThanOrEqual(lightingAt(14,world.moonPhase).saturation);
    const night=weatherLighting(2,world.moonPhase,weather,look);
    expect(night.nightAmount).toBe(1);expect(night.brightness).toBeLessThan(.15);
  }
  const cloudy=weatherVisuals('overcast'),rain=weatherVisuals('rain'),storm=weatherVisuals('thunderstorm',90000);
  expect(cloudy.brightness).toBeGreaterThan(rain.brightness);expect(rain.brightness).toBeGreaterThan(storm.brightness);
  expect(cloudy.brightness).toBeGreaterThan(.8);expect(storm.brightness).toBeGreaterThan(.5);
  expect(cloudy.contrast).toBeLessThan(1);expect(cloudy.veil).toBeGreaterThan(0);
  expect(weatherLighting(14,world.moonPhase,'thunderstorm')).toEqual(lightingAt(14,world.moonPhase));
  expect(world.period).toBe('afternoon');
});

test('thunderheads build in sunshine before the deck arrives and rain starts smoothly', () => {
  const opening = weatherVisuals('thunderstorm');
  expect(opening).toMatchObject({ stage: 'building', clear: 1, darkDeck: 0, rain: 0, brightness: 1, celestial: 1 });
  expect(opening.tower).toBeGreaterThan(0);
  expect(weatherVisuals('thunderstorm', 35000).tower).toBeGreaterThan(opening.tower);
  expect(weatherVisuals('thunderstorm', 60000)).toMatchObject({ stage: 'arriving', darkDeck: .5, rain: 0 });
  const rainy = weatherVisuals('thunderstorm', 75000);
  expect(rainy.rain).toBeGreaterThan(0); expect(rainy.rain).toBeLessThan(1);
  expect(weatherVisuals('thunderstorm', STORM_TIMING.rainFull)).toMatchObject({ stage: 'storm', clear: 0, tower: 0, darkDeck: 1, rain: 1, lightning: true });
  let previous = weatherVisuals('thunderstorm');
  for (let ms = 500; ms <= 100000; ms += 500) {
    const next = weatherVisuals('thunderstorm', ms);
    expect(next.darkDeck).toBeGreaterThanOrEqual(previous.darkDeck);
    expect(next.rain).toBeGreaterThanOrEqual(previous.rain);
    expect(next.celestial).toBeLessThanOrEqual(previous.celestial);
    previous = next;
  }
});

test('the weather clock survives rerenders, runs for fifteen minutes and resets for a new storm', () => {
  jest.useFakeTimers('modern');
  function Probe({ weather }: { weather: Weather }) { const look = useWeatherVisuals(weather); return <span data-testid="phase">{look.stage}</span>; }
  try {
    const { getByTestId, rerender, unmount } = render(<Probe weather="thunderstorm" />);
    act(() => jest.advanceTimersByTime(50000));
    expect(getByTestId('phase')).toHaveTextContent('arriving');
    rerender(<Probe weather="thunderstorm" />);
    act(() => jest.advanceTimersByTime(35000));
    expect(getByTestId('phase')).toHaveTextContent('storm');
    expect(jest.getTimerCount()).toBe(1);
    act(() => jest.advanceTimersByTime(STORM_TIMING.durationMs - STORM_TIMING.rainFull));
    expect(getByTestId('phase')).toHaveTextContent('easing');
    expect(jest.getTimerCount()).toBe(0);
    rerender(<Probe weather="sunny" />); rerender(<Probe weather="thunderstorm" />);
    expect(getByTestId('phase')).toHaveTextContent('building');
    unmount(); expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});

test('lightning starts ninety seconds apart, peaks at thirty seconds, slows and stops in the final quarter', () => {
  expect(STORM_TIMING.durationMs).toBeGreaterThanOrEqual(15 * 60 * 1000);
  expect(lightningIntervalAt(0)).toBe(90000);
  expect(lightningIntervalAt(STORM_TIMING.durationMs / 2)).toBe(30000);
  expect(lightningIntervalAt(STORM_TIMING.durationMs * .75 - 1)).toBeCloseTo(90000, -1);
  expect(lightningIntervalAt(STORM_TIMING.lightningEnds)).toBeUndefined();
  expect(STORM_LIGHTNING_TIMES[0]).toBe(90000);
  expect(STORM_LIGHTNING_TIMES.length).toBeGreaterThan(10);
  STORM_LIGHTNING_TIMES.slice(1).forEach((at, i) => expect(at - STORM_LIGHTNING_TIMES[i]).toBeCloseTo(lightningIntervalAt(STORM_LIGHTNING_TIMES[i])!, -1));
  expect(STORM_LIGHTNING_TIMES.every(at => at < STORM_TIMING.lightningEnds)).toBe(true);
  expect(weatherVisuals('thunderstorm', STORM_TIMING.lightningEnds)).toMatchObject({ lightning: false, rain: 1, fog: 1, stage: 'easing', complete: false });
  expect(weatherVisuals('thunderstorm', STORM_TIMING.durationMs)).toMatchObject({ lightning: false, complete: true });
});

test('a resumed storm uses its saved start time and finishes once at its original deadline', () => {
  jest.useFakeTimers('modern'); const end = jest.fn();
  const startedAt = Date.now() - STORM_TIMING.durationMs + 1000;
  function Probe() { const look = useWeatherVisuals('thunderstorm', undefined, startedAt, end); return <span>{look.complete ? 'ended' : look.stage}</span>; }
  try {
    const save = emptySave(); save.settings = { ...save.settings, weather: 'thunderstorm', stormStartedAt: startedAt };
    expect(deserializeSave(JSON.stringify(save)).settings.stormStartedAt).toBe(startedAt);
    const first = render(<Probe />); act(() => jest.advanceTimersByTime(500)); first.unmount();
    const resumed = render(<Probe />); expect(resumed.getByText('easing')).toBeInTheDocument();
    act(() => jest.advanceTimersByTime(500)); expect(end).toHaveBeenCalledTimes(1);
    expect(resumed.getByText('ended')).toBeInTheDocument();
    act(() => jest.advanceTimersByTime(10000)); expect(end).toHaveBeenCalledTimes(1);
    resumed.unmount(); expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});

test('cloud flashes occur on schedule, clear after animation, stop during the quiet tail and respect reduced motion', () => {
  jest.useFakeTimers('modern');
  function Probe({ reduced = false }: { reduced?: boolean }) { const look = useWeatherVisuals('thunderstorm'); return <CloudSystem visuals={look} reducedMotion={reduced} />; }
  try {
    const view = render(<Probe />);
    act(() => jest.advanceTimersByTime(89999)); expect(view.queryByTestId('cloud-lightning-flash')).toBeNull();
    act(() => jest.advanceTimersByTime(1));
    const first = view.getByTestId('cloud-lightning-flash');
    expect(first.closest('[data-layer="clouds"]')).toHaveAttribute('data-scene-depth', 'background');
    fireEvent.animationEnd(first); expect(view.queryByTestId('cloud-lightning-flash')).toBeNull();
    act(() => jest.advanceTimersByTime(250));
    act(() => jest.advanceTimersByTime(STORM_LIGHTNING_TIMES[1] - 90250));
    expect(view.getByTestId('cloud-lightning-flash')).not.toBe(first);
    view.rerender(<Probe reduced />); expect(view.queryByTestId('cloud-lightning-flash')).toBeNull();
    view.rerender(<Probe />);
    act(() => jest.advanceTimersByTime(STORM_TIMING.lightningEnds - STORM_LIGHTNING_TIMES[1]));
    expect(view.queryByTestId('cloud-lightning-flash')).toBeNull();
    expect(view.container.querySelector('[data-weather-stage="easing"]')).toBeInTheDocument();
    view.unmount(); expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});

test('all weather choices including thunderstorm survive save reload and invalid weather falls back safely', () => {
  const save = emptySave(); save.balance = 123;
  WEATHERS.forEach(weather => expect(deserializeSave(JSON.stringify({ ...save, settings: { ...save.settings, weather } }))).toMatchObject({ balance: 123, settings: { weather } }));
  expect(deserializeSave(JSON.stringify({ ...save, settings: { weather: 'unknown' } })).settings.weather).toBe('sunny');
});

test('clouds share the correct depth and rain stays absent until the storm reaches the lake', () => {
  const props = { game: { phase: 'idle' as const }, location: 'cove', weather: 'thunderstorm' as const, world: worldAt(WORLD.epoch, { season: 'autumn', hour: 14 }), reducedMotion: true };
  const { container, rerender } = render(<FishingScene {...props} weatherState={weatherVisuals('thunderstorm')} />);
  expect(container.querySelector('[data-layer="clouds"]')).toHaveAttribute('data-scene-depth', 'background');
  expect(container.querySelector('.f-rainfall')).toHaveAttribute('data-rain-intensity', '0.000');
  const fog = container.querySelector('.f-storm-fog')!;
  expect(fog).toHaveStyle({ opacity: '0' });
  expect(fog.querySelector('.f-fog-wisp')).toBeInTheDocument();
  expect(fog.closest('.f-weather-thunderstorm')).toBeNull();
  expect(new Set(Array.from(container.querySelectorAll('[data-cloud-type]')).map(e => e.getAttribute('data-cloud-type')))).toEqual(new Set(['cirrus', 'cumulus', 'stratus', 'cumulonimbus']));
  const angler = container.querySelector('.f-character');
  rerender(<FishingScene {...props} weatherState={weatherVisuals('thunderstorm', 90000)} />);
  expect(container.querySelector('.f-rainfall')).toHaveAttribute('data-rain-intensity', '1.000');
  expect(container.querySelector('.f-storm-fog')).toHaveStyle({ opacity: '1' });
  expect(container.querySelector('.f-character')).toBe(angler);
});

test('moonlight lifts the background, fades with cloud cover and never illuminates a daytime weather override', () => {
  const props = { game: { phase: 'idle' as const }, location: 'dock', reducedMotion: true };
  const night = worldAt(WORLD.epoch, { hour: 2, season: 'autumn', moonPhase: 'full' });
  const view = render(<FishingScene {...props} weather="sunny" world={night} />);
  const overlay = view.getByTestId('fishing-moonlight');
  const intensity = () => Number(overlay.getAttribute('data-moonlight-intensity'));
  const angler = view.container.querySelector('.f-character');
  const clear = intensity();
  expect(clear).toBeGreaterThan(.8);
  expect(overlay.closest('.f-scene')).toBeInTheDocument();
  expect(Number((view.container.querySelector('.f-scene') as HTMLElement).style.getPropertyValue('--time-brightness'))).toBeLessThan(.12);
  view.rerender(<FishingScene {...props} weather="fog" world={night} />);
  expect(intensity()).toBeCloseTo(clear * .25, 3);
  view.rerender(<FishingScene {...props} weather="rain" world={night} />);
  expect(intensity()).toBeLessThan(clear * .04);
  view.rerender(<FishingScene {...props} weather="sunny" world={{ ...night, moonPhase: 'new' }} />);
  expect(intensity()).toBe(0);
  view.rerender(<FishingScene {...props} weather="thunderstorm" weatherState={weatherVisuals('thunderstorm', 90000)} world={worldAt(WORLD.epoch, { hour: 14, moonPhase: 'full' })} />);
  expect(intensity()).toBe(0);
  expect(view.container.querySelector('.f-character')).toBe(angler);
});
