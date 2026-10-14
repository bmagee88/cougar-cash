import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import WindSystem from '../scene/WindSystem';
import { WeatherSystem } from '../scene/FishingScene';
import { weatherVisuals } from '../engine/weather';

declare const test: any, expect: any, jest: any, beforeEach: any, afterEach: any;

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(Math, 'random').mockReturnValue(.5);
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('wind-blown leaves arrive, catch briefly on objects and resume without rerenders restarting their hold', () => {
  const view = render(<WindSystem strength={.5} location="dock" />);
  const leaf = () => view.container.querySelector('.f-ground-leaf')!;
  act(() => jest.advanceTimersByTime(2500));
  expect(leaf()).toHaveAttribute('data-leaf-phase', 'arriving');
  fireEvent.animationEnd(leaf().querySelector('i')!);
  expect(leaf()).toHaveAttribute('data-leaf-phase', 'caught');
  act(() => jest.advanceTimersByTime(1900));
  view.rerender(<WindSystem strength={.6} location="dock" />);
  expect(leaf()).toHaveAttribute('data-leaf-phase', 'caught');
  act(() => jest.advanceTimersByTime(200));
  expect(leaf()).toHaveAttribute('data-leaf-phase', 'leaving');
  fireEvent.animationEnd(leaf().querySelector('i')!);
  expect(leaf()).toHaveAttribute('data-leaf-phase', 'queued');
  view.unmount(); expect(jest.getTimerCount()).toBe(0);
});

test('hidden pages pause gusts and leaf timers, while reduced motion removes moving litter', () => {
  const view = render(<WindSystem strength={1} location="cove" />);
  expect(jest.getTimerCount()).toBe(12);
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  fireEvent(document, new Event('visibilitychange'));
  expect(view.getByTestId('weather-wind')).toHaveClass('f-wind-paused');
  expect(jest.getTimerCount()).toBe(0);
  act(() => jest.advanceTimersByTime(30000));
  expect(view.container.querySelector('[data-leaf-phase="arriving"]')).toBeNull();
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  fireEvent(document, new Event('visibilitychange'));
  expect(jest.getTimerCount()).toBe(12);
  view.rerender(<WindSystem strength={1} location="cove" reducedMotion />);
  expect(view.container.querySelectorAll('.f-ground-leaf')).toHaveLength(0);
  expect(jest.getTimerCount()).toBe(0);
  view.unmount();
});

test('severe rain adds depth and many more lake impacts, but waits for thunderstorm rain onset', () => {
  const view = render(<WeatherSystem weather="rain" reducedMotion />);
  expect(view.container.querySelectorAll('.f-raindrop')).toHaveLength(42);
  expect(view.container.querySelectorAll('.f-rain-ring')).toHaveLength(12);
  view.rerender(<WeatherSystem weather="thunderstorm" visuals={weatherVisuals('thunderstorm', 0)} reducedMotion />);
  expect(view.container.querySelector('.f-rainfall')).toHaveStyle({ opacity: '0' });
  expect(view.container.querySelector('[data-layer="rain-mist"]')).toHaveStyle({ opacity: '0' });
  view.rerender(<WeatherSystem weather="thunderstorm" visuals={weatherVisuals('thunderstorm', 90000)} reducedMotion />);
  expect(view.container.querySelector('.f-rainfall')).toHaveStyle({ opacity: '1' });
  expect(view.container.querySelectorAll('.f-raindrop')).toHaveLength(480);
  expect(view.container.querySelectorAll('.f-raindrop-distant')).toHaveLength(160);
  expect(view.container.querySelectorAll('.f-rain-ring')).toHaveLength(64);
  view.rerender(<WeatherSystem weather="hurricane" reducedMotion />);
  expect(view.container.querySelectorAll('.f-raindrop')).toHaveLength(760);
  expect(view.container.querySelectorAll('.f-rain-ring')).toHaveLength(96);
});
