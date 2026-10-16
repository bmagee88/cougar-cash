import React, { createRef } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { goosePose, gooseVisitAt, gooseVisits, makeGooseVisit, nextGooseChange } from '../engine/geese';
import { WORLD } from '../engine/world';
import GooseVisitors, { gooseGeometry } from '../scene/GooseVisitors';
import { LakeSoundControls } from '../audio/sounds';

declare const test: any, expect: any, jest: any, afterEach: any;
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
const visits = Array.from({ length: 150 }, (_, i) => makeGooseVisit(`test-${i}`, WORLD.epoch, i * 19397, 'spring'));

test('absolute daily schedules have one or two nonoverlapping visits and survive reloads', () => {
  const counts = new Set<number>();
  for (let day = 0; day < 365; day++) {
    const daily = gooseVisits(day, 'spring'); counts.add(daily.length);
    expect(daily).toEqual(gooseVisits(day, 'spring'));
    expect(daily.length).toBeGreaterThanOrEqual(1); expect(daily.length).toBeLessThanOrEqual(2);
    daily.forEach((visit, index) => {
      expect(visit.startAt).toBeGreaterThanOrEqual(WORLD.epoch + day * WORLD.dayMs);
      expect(visit.endAt).toBeLessThan(WORLD.epoch + (day + 1) * WORLD.dayMs);
      if (index) expect(visit.startAt).toBeGreaterThan(daily[index - 1].endAt);
      expect(gooseVisitAt(visit.startAt + 1, 'spring')?.id).toBe(visit.id);
      expect(gooseVisitAt(visit.endAt, 'spring')).toBeUndefined();
      expect(nextGooseChange(visit.startAt + 1, 'spring')).toBe(visit.endAt);
    });
  }
  expect(Array.from(counts).sort()).toEqual([1, 2]);
  expect(gooseVisits(0, 'summer')).toEqual([]); expect(gooseVisits(0, 'winter')).toEqual([]);
  expect(gooseVisits(0, 'autumn')[0].direction).toBe(-1);
});

test('formations vary in bird count and shape; perspective couples speed, size, height, and sound depth', () => {
  expect(new Set(visits.map(v => v.shape)).size).toBe(3);
  expect(Math.min(...visits.map(v => v.birds.length))).toBe(4);
  expect(Math.max(...visits.map(v => v.birds.length))).toBe(13);
  const approaching = visits.find(v => v.endScale - v.startScale > .3)!;
  const receding = visits.find(v => v.startScale - v.endScale > .3)!;
  const first = goosePose(approaching, .2), last = goosePose(approaching, .8);
  expect(last.scale).toBeGreaterThan(first.scale); expect(last.y).toBeGreaterThan(first.y); expect(last.depth).toBeLessThan(first.depth);
  const speed = (v: typeof approaching, t: number) => (goosePose(v, t + .001).x - goosePose(v, t).x) / v.durationMs / .001;
  expect(speed(approaching, .8)).toBeGreaterThan(speed(approaching, .2));
  expect(speed(receding, .2)).toBeGreaterThan(speed(receding, .8));
  const distant = visits.filter(v => Math.max(v.startScale, v.endScale) < .5);
  const nearby = visits.filter(v => Math.min(v.startScale, v.endScale) > .7);
  expect(Math.min(...distant.map(v => v.durationMs))).toBeGreaterThan(Math.max(...nearby.map(v => v.durationMs)));
});

test('the complete sprite bounds stay in the upper third on wide, narrow, and short screens', () => {
  for (const frame of [{ width: 1920, height: 700 }, { width: 390, height: 660 }, { width: 844, height: 300 }]) {
    const unit = Math.min(Math.max(18, Math.min(36, frame.width * .03)), frame.height * .04);
    for (const visit of visits) for (let step = 0; step <= 10; step++) {
      const pose = goosePose(visit, step / 10);
      const top = pose.y / 100 * frame.height - visit.height * unit * pose.scale / 2;
      const bottom = pose.y / 100 * frame.height + visit.height * unit * pose.scale / 2;
      expect(top).toBeGreaterThanOrEqual(0); expect(bottom).toBeLessThan(frame.height / 3);
    }
  }
  const geometry = gooseGeometry(visits[0], { width: 1200, height: 700 }, 'spring', 'dock');
  expect(geometry.birds).toHaveLength(visits[0].birds.length);
  const exposures = geometry.birds.flatMap(bird => Object.entries(bird).filter(([key]) => key.startsWith('--ge')).map(([, value]) => Number(value)));
  expect(exposures.every(n => n >= .329 && n <= .761)).toBe(true);
  expect(exposures.some(n => n < .4)).toBe(true);
});

test('visibility resumes the same visit at its elapsed position and weather cannot reroll more visits', () => {
  jest.useFakeTimers(); const visit = gooseVisits(17, 'spring')[0]; jest.setSystemTime(visit.startAt + 1000);
  const hidden = jest.spyOn(document, 'hidden', 'get').mockReturnValue(false), sceneRef = createRef<HTMLDivElement>();
  const view = render(<div ref={sceneRef}><GooseVisitors sceneRef={sceneRef} season="spring" weather="sunny" reducedMotion={false}/></div>);
  const flock = () => view.container.querySelector<HTMLElement>('[data-layer="geese"]');
  expect(flock()).toHaveAttribute('data-visit-id', visit.id);
  const delay = flock()!.style.getPropertyValue('--goose-delay');
  act(() => jest.advanceTimersByTime(500));
  view.rerender(<div ref={sceneRef}><GooseVisitors sceneRef={sceneRef} season="spring" weather="rain" reducedMotion={false}/></div>);
  expect(flock()!.style.getPropertyValue('--goose-delay')).toBe(delay);
  hidden.mockReturnValue(true); fireEvent(document, new Event('visibilitychange'));
  expect(flock()).toBeNull(); expect(jest.getTimerCount()).toBe(0);
  act(() => jest.advanceTimersByTime(2000)); hidden.mockReturnValue(false); fireEvent(document, new Event('visibilitychange'));
  expect(flock()).toHaveAttribute('data-visit-id', visit.id);
  expect(Number.parseFloat(flock()!.style.getPropertyValue('--goose-delay'))).toBeCloseTo(-3500, 0);
  act(() => jest.advanceTimersByTime(visit.endAt - Date.now() + 50)); expect(flock()).toBeNull();
  view.rerender(<div ref={sceneRef}><GooseVisitors sceneRef={sceneRef} season="spring" weather="sunny" reducedMotion={false}/></div>);
  expect(flock()).toBeNull(); expect(jest.getTimerCount()).toBe(1);
  view.unmount(); expect(jest.getTimerCount()).toBe(0);
});

test('storms suppress an arrival without rescheduling it; a whole day has only its scheduled flybys', () => {
  jest.useFakeTimers(); const daily = gooseVisits(17, 'spring'), sceneRef = createRef<HTMLDivElement>();
  jest.setSystemTime(daily[0].startAt + 1000); jest.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  const view = render(<div ref={sceneRef}><GooseVisitors sceneRef={sceneRef} season="spring" weather="thunderstorm" reducedMotion={false}/></div>);
  expect(view.container.querySelector('.f-geese-pass')).toBeNull();
  view.rerender(<div ref={sceneRef}><GooseVisitors sceneRef={sceneRef} season="spring" weather="sunny" reducedMotion={false}/></div>);
  expect(view.container.querySelector('.f-geese-pass')).toBeNull();
  view.unmount();
  jest.setSystemTime(WORLD.epoch + 17 * WORLD.dayMs);
  const dayView = render(<div ref={sceneRef}><GooseVisitors sceneRef={sceneRef} season="spring" weather="sunny" reducedMotion={false}/></div>);
  const seen = new Set<string>();
  for (let second = 0; second < WORLD.dayMs / 1000; second++) {
    act(() => jest.advanceTimersByTime(1000));
    const flock = dayView.container.querySelector<HTMLElement>('.f-geese-pass'); if (flock) seen.add(flock.dataset.visitId!);
  }
  expect(Array.from(seen)).toEqual(daily.map(v => v.id)); dayView.unmount(); expect(jest.getTimerCount()).toBe(0);
});

test('flock calls follow the visible perspective and all audio timers unload with the flock', () => {
  jest.useFakeTimers(); const visit = visits.find(v => v.endScale > v.startScale + .3)!;
  const natural = gooseVisits(17, 'spring')[0]; jest.setSystemTime(natural.startAt + natural.durationMs * .5);
  jest.spyOn(document, 'hidden', 'get').mockReturnValue(false); jest.spyOn(Math, 'random').mockReturnValue(.5);
  const sceneRef = createRef<HTMLDivElement>();
  const audio: LakeSoundControls = { play: jest.fn(), unlock: jest.fn(), preview: jest.fn(), rain: jest.fn(), visible: jest.fn() };
  const view = render(<div ref={sceneRef}><GooseVisitors sceneRef={sceneRef} season="spring" weather="sunny" reducedMotion={false} audio={audio}/></div>);
  act(() => jest.advanceTimersByTime(1100));
  const pose = goosePose(natural, (Date.now() - natural.startAt) / natural.durationMs);
  expect(audio.play).toHaveBeenCalledWith('geese', expect.objectContaining({ depth: pose.depth, pan: pose.x / 50 - 1 }));
  expect(goosePose(visit, .2).depth).toBeGreaterThan(goosePose(visit, .8).depth);
  view.unmount(); expect(jest.getTimerCount()).toBe(0);
});
