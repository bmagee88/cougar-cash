import React, { useRef } from 'react';
import { act, render } from '@testing-library/react';
import { Weather, WEATHERS } from '../engine/types';
import { weatherVisuals } from '../engine/weather';
import { WeatherSystem } from '../scene/FishingScene';
import CloudSystem from '../scene/CloudSystem';
import { useWeatherLayers, WEATHER_FADE_MS } from '../scene/useWeatherLayers';
import { useWeatherMotion } from '../scene/useWeatherMotion';

declare const test: any, expect: any, jest: any, beforeEach: any, afterEach: any;

beforeEach(() => {
  jest.useFakeTimers('modern');
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

function Layers({ weather, reduced = false }: { weather: Weather; reduced?: boolean }) {
  const layers = useWeatherLayers(weather, weatherVisuals(weather, 90000), reduced);
  return <div>{layers.map(layer => <span key={layer.weather} data-weather={layer.weather} data-active={layer.active} />)}</div>;
}

test('all 110 directed weather changes retain the outgoing layer and finish with only the selected weather', () => {
  let pairs = 0;
  WEATHERS.forEach(from => WEATHERS.forEach(to => {
    if (from === to) return;
    const view = render(<Layers weather={from} />);
    const outgoing = view.container.querySelector(`[data-weather="${from}"]`);
    view.rerender(<Layers weather={to} />);
    const incoming = view.container.querySelector(`[data-weather="${to}"]`);
    expect(view.container.querySelector(`[data-weather="${from}"]`)).toBe(outgoing);
    expect(outgoing).toHaveAttribute('data-active', 'false');
    expect(incoming).toHaveAttribute('data-active', 'true');
    act(() => jest.advanceTimersByTime(WEATHER_FADE_MS - 1));
    expect(outgoing).toBeInTheDocument();
    act(() => jest.advanceTimersByTime(52));
    expect(view.container.querySelectorAll('[data-weather]')).toHaveLength(1);
    expect(view.container.querySelector(`[data-weather="${to}"]`)).toBe(incoming);
    view.unmount(); expect(jest.getTimerCount()).toBe(0); pairs++;
  }));
  expect(pairs).toBe(110);
}, 20000);

test('a rain-to-snow fade can reverse without replacing raindrops or losing the outgoing snow', () => {
  const view = render(<WeatherSystem weather="rain" />);
  const drop = view.container.querySelector('.f-raindrop');
  view.rerender(<WeatherSystem weather="snowfall" />);
  const snow = view.container.querySelector('[data-weather-layer="snowfall"]')!;
  expect(snow).toHaveStyle({ opacity: '0' });
  expect(view.container.querySelector('.f-raindrop')).toBe(drop);
  act(() => jest.advanceTimersByTime(64));
  expect(snow).toHaveStyle({ opacity: '1' });
  act(() => jest.advanceTimersByTime(3000));
  view.rerender(<WeatherSystem weather="rain" />);
  expect(view.container.querySelector('.f-raindrop')).toBe(drop);
  expect(snow).toHaveStyle({ opacity: '0' });
  act(() => jest.advanceTimersByTime(WEATHER_FADE_MS + 51));
  expect(view.container.querySelector('[data-weather-layer="snowfall"]')).toBeNull();
  expect(view.container.querySelectorAll('.f-raindrop')).toHaveLength(42);
  view.unmount(); expect(jest.getTimerCount()).toBe(0);
});

test('reduced motion immediately removes outgoing effects and does not restart the incoming fade when disabled', () => {
  const view = render(<WeatherSystem weather="rain" />);
  view.rerender(<WeatherSystem weather="snowfall" />);
  view.rerender(<WeatherSystem weather="snowfall" reducedMotion />);
  expect(view.container.querySelector('[data-weather-layer="rain"]')).toBeNull();
  expect(view.container.querySelector('[data-weather-layer="snowfall"]')).toHaveStyle({ opacity: '1' });
  view.rerender(<WeatherSystem weather="snowfall" />);
  expect(view.container.querySelector('[data-weather-layer="snowfall"]')).toHaveStyle({ opacity: '1' });
  view.unmount(); expect(jest.getTimerCount()).toBe(0);
});

test('wind accelerates and slows without resetting animation time, including an interrupted change', () => {
  let now = 0; let frame: FrameRequestCallback | undefined;
  jest.spyOn(performance, 'now').mockImplementation(() => now);
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => { frame = callback; return 1; });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => { frame = undefined; });
  const advance = (milliseconds: number) => act(() => { now += milliseconds; const callback = frame; frame = undefined; callback?.(now); });
  const original = Object.getOwnPropertyDescriptor(Element.prototype, 'getAnimations');
  const resetTime = jest.fn();
  const animation = { animationName: 'f-sway', playbackRate: 1, updatePlaybackRate: jest.fn((rate: number) => { animation.playbackRate = rate; }) };
  const lightingTransition = { transitionProperty: 'filter', playbackRate: 1, updatePlaybackRate: jest.fn() };
  Object.defineProperty(animation, 'currentTime', { get: () => 1234, set: resetTime });
  Object.defineProperty(Element.prototype, 'getAnimations', { configurable: true, value: () => [animation, lightingTransition] });
  function Motion({ wind }: { wind: number }) {
    const ref = useRef<HTMLDivElement>(null); useWeatherMotion(ref, wind, false);
    return <div ref={ref}><i className="f-sway" /></div>;
  }
  try {
    const view = render(<Motion wind={0} />);
    view.rerender(<Motion wind={1} />);
    expect(animation.playbackRate).toBe(1);
    advance(WEATHER_FADE_MS / 2);
    expect(animation.playbackRate).toBeGreaterThan(1);
    expect(animation.playbackRate).toBeLessThan(9 / 1.3);
    const midway = animation.playbackRate;
    view.rerender(<Motion wind={0} />);
    expect(animation.playbackRate).toBe(midway);
    advance(16);
    expect(Math.abs(animation.playbackRate - midway)).toBeLessThan(.001);
    advance(WEATHER_FADE_MS);
    expect(animation.playbackRate).toBe(1);
    expect(resetTime).not.toHaveBeenCalled();
    expect(lightingTransition.updatePlaybackRate).not.toHaveBeenCalled();
    view.unmount(); expect(jest.getTimerCount()).toBe(0);
  } finally {
    if (original) Object.defineProperty(Element.prototype, 'getAnimations', original); else delete (Element.prototype as any).getAnimations;
  }
});

test('an active lightning flash finishes when weather changes and no later flashes are scheduled', () => {
  const view = render(<CloudSystem visuals={weatherVisuals('thunderstorm', 90000)} />);
  act(() => jest.advanceTimersByTime(1));
  const flash = view.getByTestId('cloud-lightning-flash');
  view.rerender(<CloudSystem visuals={weatherVisuals('rain')} />);
  expect(view.getByTestId('cloud-lightning-flash')).toBe(flash);
  act(() => jest.advanceTimersByTime(1000));
  expect(view.queryByTestId('cloud-lightning-flash')).toBeNull();
  act(() => jest.advanceTimersByTime(90000));
  expect(view.queryByTestId('cloud-lightning-flash')).toBeNull();
  view.unmount(); expect(jest.getTimerCount()).toBe(0);
});
