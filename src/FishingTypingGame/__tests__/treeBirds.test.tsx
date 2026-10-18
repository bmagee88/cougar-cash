import React, { createRef } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { GAME_MINUTE_MS, makeTreeBirdVisit, TREE_BIRD_STREAMS, treeBirdDeparture, treeBirdPose, treeBirdSchedule } from '../engine/treeBirds';
import { WORLD } from '../engine/world';
import { birdPlane, LOCATION_TREES, mappedTreesForLocation, treePerch } from '../scene/treeMap';
import TreeBirds, { TreeMapOverlay } from '../scene/TreeBirds';
import { stepAmbientAnimations } from '../scene/useSceneParallax';

declare const test: any, expect: any, jest: any, afterEach: any;
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('each landscape maps exactly ten trees in source-art x/y and distance z; perches stay in their top third', () => {
  Object.values(LOCATION_TREES).forEach(trees => {
    expect(trees).toHaveLength(10); expect(new Set(trees.map(tree => tree.id)).size).toBe(10);
    trees.forEach(tree => {
      expect(tree.top.y).toBeLessThan(tree.bottom.y); expect(tree.top.z).toBeGreaterThan(.14);expect(tree.top.z).toBeLessThanOrEqual(1);
      expect(tree.top.z).toBe(tree.bottom.z); expect(tree.bottom.y).toBeLessThan(.56);
      for (const random of [() => 0, () => .5, () => .999999]) {
        const point = treePerch(tree, random);
        expect(point.y).toBeGreaterThanOrEqual(tree.top.y);
        expect(point.y).toBeLessThan(tree.top.y + (tree.bottom.y - tree.top.y) / 3);
        expect(Math.abs(point.x - tree.top.x)).toBeLessThan(tree.crownWidth / 2);
        expect(point.z).toBe(tree.top.z);
      }
    });
  });
});

test('two independently jittered clocks keep 10–30 game-minute gaps, while the ten-bird clock keeps 24–48 real-minute gaps', () => {
  expect(GAME_MINUTE_MS).toBe(2000); expect(TREE_BIRD_STREAMS.map(stream => stream.count)).toEqual([1, 1, 10]);
  TREE_BIRD_STREAMS.forEach(stream => {
    const gaps: number[] = [];
    for (let index = 0; index < 1000; index++) {
      const at = treeBirdDeparture(stream, index, 'dock');
      expect(at).toBe(treeBirdDeparture(stream, index, 'dock'));
      const gap = treeBirdDeparture(stream, index + 1, 'dock') - at; gaps.push(gap);
      expect(gap).toBeGreaterThanOrEqual(stream.id === 'flock' ? 24 * 60000 : 10 * GAME_MINUTE_MS);
      expect(gap).toBeLessThanOrEqual(stream.id === 'flock' ? 48 * 60000 : 30 * GAME_MINUTE_MS);
    }
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(stream.jitterMs);
  });
  expect(treeBirdDeparture(TREE_BIRD_STREAMS[0], 1, 'dock')).not.toBe(treeBirdDeparture(TREE_BIRD_STREAMS[1], 1, 'dock'));
});

test('routes launch and land within different tree crowns, vary depth, and flocks either land or leave the frame', () => {
  const exits = new Set<boolean>(), depths = new Set<boolean>();
  for (const location of ['dock', 'cove', 'birch'] as const) for (let seed = 1; seed <= 100; seed++) {
    const visit = makeTreeBirdVisit('test', 'flock', WORLD.epoch, seed * 19397, location, 10);
    expect(visit.birds).toHaveLength(10); expect(new Set(visit.birds.map(bird => bird.fromTree)).size).toBe(1);
    visit.birds.forEach(route => {
      const start = treeBirdPose(route, 0), end = treeBirdPose(route, 1);
      const tree = mappedTreesForLocation(location).find(tree => tree.id === route.fromTree)!;
      expect(start.x).toBeCloseTo(route.from.x); expect(start.y).toBeCloseTo(route.from.y);
      expect(start.y).toBeLessThan(tree.top.y + (tree.bottom.y - tree.top.y) / 3);
      expect(end.x).toBeCloseTo(route.to.x); expect(end.y).toBeCloseTo(route.to.y);
      if (route.toTree) {
        const target = mappedTreesForLocation(location).find(tree => tree.id === route.toTree)!;
        expect(route.toTree).not.toBe(route.fromTree);
        expect(end.y).toBeLessThan(target.top.y + (target.bottom.y - target.top.y) / 3);
        expect(end.y).toBeGreaterThanOrEqual(target.top.y);
      } else expect(end.x < 0 || end.x > 1).toBe(true);
      if (route.to.z > route.from.z) expect(end.scale).toBeLessThanOrEqual(start.scale);
      else expect(end.scale).toBeGreaterThanOrEqual(start.scale);
      exits.add(!route.toTree); depths.add(route.to.z > route.from.z);
      for (let t = 0; t <= 1; t += .05) expect(treeBirdPose(route, t).y).toBeLessThanOrEqual(Math.max(start.y, end.y) + .001);
      expect(route.durationMs).toBeLessThan(20000); expect(route.delayMs + route.durationMs).toBeLessThan(20000);
    });
  }
  expect(exits.size).toBe(2); expect(depths.size).toBe(2);
});

test('a bounding path rises and dips repeatedly, with exact endpoint height and scale', () => {
  const original = makeTreeBirdVisit('arc', 'solo', WORLD.epoch, 1234, 'dock').birds[0];
  const route = { ...original, from: { x: .2, y: .4, z: .7 }, to: { x: .8, y: .4, z: .7 }, lift: .04, amplitude: .007, bounds: 7 };
  const samples = Array.from({ length: 401 }, (_, i) => treeBirdPose(route, i / 400));
  let turns = 0;
  for (let i = 1; i < samples.length - 1; i++) if ((samples[i].y - samples[i - 1].y) * (samples[i + 1].y - samples[i].y) < 0) turns++;
  expect(turns).toBeGreaterThan(5); expect(Math.min(...samples.map(pose => pose.y))).toBeLessThan(.37);
  expect(samples[0].y).toBeCloseTo(.4); expect(samples[400].y).toBeCloseTo(.4);
});

test('the schedule resumes current time without catch-up bursts and never exceeds twelve natural birds', () => {
  for (let index = 0; index < 2400; index++) {
    const now = WORLD.epoch + index * 17999, scheduled = treeBirdSchedule(now, 'dock');
    expect(scheduled).toEqual(treeBirdSchedule(now, 'dock'));
    expect(scheduled.nextAt).toBeGreaterThan(now);
    expect(scheduled.visits.reduce((sum, visit) => sum + visit.birds.length, 0)).toBeLessThanOrEqual(12);
    scheduled.visits.forEach(visit => { expect(visit.startAt).toBeLessThanOrEqual(now); expect(visit.endAt).toBeGreaterThan(now); });
  }
});

test('hidden/offscreen birds unload, returning uses elapsed progress, and every timer and observer is released', () => {
  jest.useFakeTimers(); const startAt = treeBirdDeparture(TREE_BIRD_STREAMS[2], 18, 'dock'); jest.setSystemTime(startAt + 2000);
  const hidden = jest.spyOn(document, 'hidden', 'get').mockReturnValue(false), sceneRef = createRef<HTMLDivElement>();
  const originalObserver = window.IntersectionObserver;
  let intersect: (entries: any[]) => void = () => {}; const disconnect = jest.fn();
  window.IntersectionObserver = jest.fn((callback: any) => { intersect = callback; return { observe: jest.fn(), disconnect }; }) as any;
  try {
    const view = render(<div ref={sceneRef}><TreeBirds sceneRef={sceneRef} location="dock" reducedMotion={false}/></div>);
    const flock = view.container.querySelector('[data-bird-stream="flock"]')!;
    expect(flock.querySelectorAll('.f-tree-bird')).toHaveLength(10); expect(jest.getTimerCount()).toBe(1);
    const id = flock.getAttribute('data-bird-visit'), delay = (flock.querySelector('.f-tree-bird') as HTMLElement).style.getPropertyValue('--bird-delay');
    act(() => jest.advanceTimersByTime(100));
    view.rerender(<div ref={sceneRef}><TreeBirds sceneRef={sceneRef} location="dock" reducedMotion={false} showMap/></div>);
    expect((view.container.querySelector('[data-bird-stream="flock"] .f-tree-bird') as HTMLElement).style.getPropertyValue('--bird-delay')).toBe(delay);
    act(() => intersect([{ isIntersecting: false }])); expect(view.container.querySelector('.f-tree-birds')).toBeNull(); expect(jest.getTimerCount()).toBe(0);
    act(() => jest.advanceTimersByTime(200)); act(() => intersect([{ isIntersecting: true }]));
    expect(view.container.querySelector('[data-bird-stream="flock"]')).toHaveAttribute('data-bird-visit', id);
    expect(Number.parseFloat((view.container.querySelector('[data-bird-stream="flock"] .f-tree-bird') as HTMLElement).style.getPropertyValue('--bird-delay'))).toBeCloseTo(-2300, 0);
    hidden.mockReturnValue(true); fireEvent(document, new Event('visibilitychange'));
    expect(view.container.querySelector('.f-tree-birds')).toBeNull(); expect(jest.getTimerCount()).toBe(0);
    act(() => jest.advanceTimersByTime(60000)); hidden.mockReturnValue(false); fireEvent(document, new Event('visibilitychange'));
    expect(view.container.querySelector(`[data-bird-visit="${id}"]`)).toBeNull();
    view.unmount(); expect(jest.getTimerCount()).toBe(0); expect(disconnect).toHaveBeenCalledTimes(1);
  } finally { window.IntersectionObserver = originalObserver; }
});

test('map overlays mark ten top-third zones; reduced motion has no bird timers or sprite layers', () => {
  jest.useFakeTimers(); const sceneRef = createRef<HTMLDivElement>();
  for (const location of ['dock', 'cove']) {
    const map = render(<TreeMapOverlay location={location}/>);
    expect(map.container.querySelectorAll('[data-mapped-tree]')).toHaveLength(location === 'cove' ? 11 : 10);
    expect(map.container.querySelector('svg')).toHaveAttribute('preserveAspectRatio', 'none');
    map.container.querySelectorAll('rect').forEach(zone => expect(Number(zone.getAttribute('height'))).toBeGreaterThan(0));
    expect(birdPlane(location)['--bird-plane-w']).toContain(location === 'cove' ? '181.3cqh' : '204cqh'); map.unmount();
  }
  const view = render(<div ref={sceneRef}><TreeBirds sceneRef={sceneRef} location="cove" reducedMotion flockPreview={1} soloPreview={1}/></div>);
  expect(view.container.querySelector('[data-layer="tree-birds"]')).toBeNull(); expect(jest.getTimerCount()).toBe(0); view.unmount();
});

test('Birch Point and Willow Cove connect close trunks in both directions and birds grow continuously on approach', () => {
  for (const location of ['birch', 'cove']) {
    const approaches = [], departures = [];
    for (let seed = 1; seed <= 100; seed++) {
      const route = makeTreeBirdVisit('near', 'solo', WORLD.epoch, seed * 19397, location).birds[0];
      if (route.toFrame === 'foreground') approaches.push(route);
      if (route.fromFrame === 'foreground') departures.push(route);
    }
    expect(approaches.length).toBeGreaterThan(5); expect(departures.length).toBeGreaterThan(5);
    approaches.forEach(route => {
      const poses = [0, .25, .5, .75, .9, 1].map(t => treeBirdPose(route, t));
      expect(route.fromFrame).toBe('landscape');
      expect(poses[5].scale).toBeGreaterThan(poses[0].scale * 2);
      for (let i = 1; i < poses.length; i++) expect(poses[i].scale).toBeGreaterThan(poses[i - 1].scale);
      expect(poses[0].blend).toBe(0); expect(poses[5].blend).toBeCloseTo(1);
    });
    departures.forEach(route => {
      expect(route.toFrame).toBe('landscape');
      expect(treeBirdPose(route, 1).scale).toBeLessThan(treeBirdPose(route, 0).scale);
    });
  }
});

test('environment samples leave bird travel, wing poses and fishing cues on their natural timelines', () => {
  const animations = ['f-tree-bird-flight', 'f-tree-bird-flap', 'f-danger-bob'].map(animationName => ({ animationName, currentTime: 500, playbackRate: 1, playState: 'paused' }));
  const scene = document.createElement('div'); Object.defineProperty(scene, 'getAnimations', { value: () => animations });
  stepAmbientAnimations(scene, 5000);
  expect(animations.map(animation => animation.currentTime)).toEqual([500, 500, 500]);
});
