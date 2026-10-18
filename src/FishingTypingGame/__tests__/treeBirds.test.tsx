import React, { createRef } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { GAME_MINUTE_MS, makeTreeBirdVisit, previewTreeBirdVisit, TREE_BIRD_DIRECTIONS, TREE_BIRD_SPECIES, TREE_BIRD_SPRITE, TREE_BIRD_STREAMS, treeBirdDeparture, treeBirdDirection, treeBirdPose, treeBirdSchedule, usesSpeciesBirdArt } from '../engine/treeBirds';
import { WORLD } from '../engine/world';
import { birdPlane, LOCATION_TREES, mappedTreesForLocation, treePerch } from '../scene/treeMap';
import TreeBirds, { TreeMapOverlay } from '../scene/TreeBirds';
import { stepAmbientAnimations } from '../scene/useSceneParallax';
import * as insectVisitors from '../scene/ButterflyVisitors';

declare const test: any, expect: any, jest: any, afterEach: any;
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('collecting one painted flock bird records its current pose once, keeps its neighbors and survives visibility changes',()=>{
  jest.useFakeTimers();jest.setSystemTime(WORLD.epoch);
  const hidden=jest.spyOn(document,'hidden','get').mockReturnValue(false),sceneRef=createRef<HTMLDivElement>(),observe=jest.fn();
  let sequence=1;
  while(!usesSpeciesBirdArt(previewTreeBirdVisit(WORLD.epoch,'cove',sequence,true).birds[0]))sequence++;
  const fixture=(enabled=true)=><div ref={sceneRef}><TreeBirds sceneRef={sceneRef} location="cove" reducedMotion={false} flockPreview={sequence} onObserve={enabled?observe:undefined}/></div>;
  const view=render(fixture());act(()=>jest.advanceTimersByTime(1000));
  const birds=view.getAllByRole('button',{name:'Observe sparrow'});
  expect(birds).toHaveLength(10);
  const wing=birds[0].querySelector<HTMLElement>('.f-tree-bird-wingbeat')!;
  wing.style.backgroundPositionX='27.272727%';
  fireEvent.click(birds[0]);
  expect(observe).toHaveBeenCalledWith(birds[0],'sparrow',{direction:birds[0].parentElement?.getAttribute('data-bird-direction')??treeBirdDirection(previewTreeBirdVisit(WORLD.epoch,'cove',sequence,true).birds[0]),frame:3});
  expect(view.getAllByRole('button',{name:'Observe sparrow'})).toHaveLength(9);
  fireEvent.click(birds[0]);expect(observe).toHaveBeenCalledTimes(1);
  hidden.mockReturnValue(true);fireEvent(document,new Event('visibilitychange'));
  expect(view.queryByRole('button',{name:'Observe sparrow'})).toBeNull();
  hidden.mockReturnValue(false);fireEvent(document,new Event('visibilitychange'));
  expect(view.getAllByRole('button',{name:'Observe sparrow'})).toHaveLength(9);
  view.rerender(fixture(false));
  view.getAllByRole('button',{name:'Observe sparrow',hidden:true}).forEach(bird=>expect(bird).toBeDisabled());
  view.unmount();expect(jest.getTimerCount()).toBe(0);
});

test('distant silhouette birds have no collection controls',()=>{
  jest.useFakeTimers();jest.setSystemTime(WORLD.epoch);jest.spyOn(document,'hidden','get').mockReturnValue(false);
  const sceneRef=createRef<HTMLDivElement>(),observe=jest.fn();
  const view=render(<div ref={sceneRef}><TreeBirds sceneRef={sceneRef} location="dock" reducedMotion={false} soloPreview={1} onObserve={observe}/></div>);
  expect(view.container.querySelector('.f-tree-bird-wing')).not.toBeNull();
  expect(view.queryByRole('button')).toBeNull();expect(observe).not.toHaveBeenCalled();
});

test('birds cannot be collected before departure or through opaque foreground artwork',()=>{
  jest.useFakeTimers();jest.setSystemTime(WORLD.epoch);jest.spyOn(document,'hidden','get').mockReturnValue(false);
  const occluded=jest.spyOn(insectVisitors,'foregroundOccludes').mockReturnValue(true),sceneRef=createRef<HTMLDivElement>(),observe=jest.fn();
  const visit=previewTreeBirdVisit(WORLD.epoch,'cove',9,false);
  const view=render(<div ref={sceneRef}><TreeBirds sceneRef={sceneRef} location="cove" reducedMotion={false} soloPreview={9} onObserve={observe}/></div>);
  const cardinal=view.getByRole('button',{name:'Observe cardinal'});
  jest.setSystemTime(visit.startAt-1);
  fireEvent.click(cardinal);expect(observe).not.toHaveBeenCalled();
  jest.setSystemTime(WORLD.epoch);
  act(()=>jest.advanceTimersByTime(1000));
  fireEvent.click(cardinal,{detail:1,clientX:300,clientY:200});expect(occluded).toHaveBeenCalled();expect(observe).not.toHaveBeenCalled();
  occluded.mockReturnValue(false);
  fireEvent(cardinal,new MouseEvent('pointerdown',{bubbles:true,button:0,detail:1,clientX:300,clientY:200}));
  fireEvent.click(cardinal,{detail:1,clientX:300,clientY:200});
  expect(observe).toHaveBeenCalledTimes(1);
  expect(observe).toHaveBeenCalledWith(cardinal,'cardinal',expect.objectContaining({direction:treeBirdDirection(visit.birds[0])}));
});

test('cardinals visit alone while sparrows can visit alone or in the unchanged ten-bird flock',()=>{
  expect(TREE_BIRD_SPECIES).toEqual([{id:'cardinal',name:'Cardinal',canFlock:false},{id:'sparrow',name:'Sparrow',canFlock:true}]);
  const solos=new Set<string>();
  for(let seed=1;seed<=100;seed++){
    const solo=makeTreeBirdVisit('solo','single-a',WORLD.epoch,seed,'cove');
    solos.add(solo.birds[0].species!);
    const flock=makeTreeBirdVisit('flock','flock',WORLD.epoch,seed,'cove',10);
    expect(flock.birds).toHaveLength(10);
    flock.birds.forEach(bird=>expect(TREE_BIRD_SPECIES.find(species=>species.id===bird.species)?.canFlock).toBe(true));
    expect(new Set(flock.birds.map(bird=>bird.species))).toEqual(new Set(['sparrow']));
  }
  expect(solos).toEqual(new Set(['cardinal','sparrow']));
});

test('all six directions have painted sheets and real GIF exports for wingbeat, glide and slowing to land',()=>{
  const route=makeTreeBirdVisit('direction','solo',WORLD.epoch,52,'cove').birds[0];
  const directions=new Set<string>();
  for(const toward of [true,false])for(const lateral of [-.3,0,.3]){
    const course={...route,from:{x:.5,y:.4,z:toward?.7:.04},to:{x:.5+lateral,y:.4,z:toward?.04:.7}};
    const expected=`${toward?'front':'back'}${lateral===0?'':lateral<0?'-left':'-right'}`;
    expect(treeBirdDirection(course)).toBe(expected);directions.add(treeBirdDirection(course));
  }
  expect(directions).toEqual(new Set(TREE_BIRD_DIRECTIONS));
  const fs=require('fs'),path=require('path');
  const folder=path.join(process.cwd(),'public/assets/fishing/visitors/tree-birds');
  const metadata=JSON.parse(fs.readFileSync(path.join(folder,'painted-assets.json'),'utf8'));
  expect(metadata.directions).toEqual(TREE_BIRD_DIRECTIONS);
  expect(metadata.runtimeFrameSize).toBe(TREE_BIRD_SPRITE.size);
  expect(metadata.columns*metadata.rows).toBe(72);
  TREE_BIRD_SPECIES.forEach(species=>{
    const record=metadata.species[species.id],source=fs.readFileSync(path.join(folder,record.sheet));
    expect(source.toString('ascii',0,4)).toBe('RIFF');expect(source.toString('ascii',8,12)).toBe('WEBP');
    expect(source.length).toBeLessThan(1000000);
    TREE_BIRD_DIRECTIONS.forEach(direction=>{
      const animations=record.animations[direction];
      for(const state of ['wingbeat','glide','slowdown','flight']){
        const info=animations[state],gif=fs.readFileSync(path.join(folder,species.id,info.file));
        expect(gif.toString('ascii',0,6)).toBe('GIF89a');
        expect(gif.readUInt16LE(6)).toBe(192);expect(gif.readUInt16LE(8)).toBe(192);
        expect(info.frames).toBeGreaterThanOrEqual(state==='wingbeat'?8:3);
      }
    });
  });
});

test('close routes use species art while far crossings retain the original silhouettes and timers clean up',()=>{
  jest.useFakeTimers();jest.setSystemTime(WORLD.epoch);jest.spyOn(document,'hidden','get').mockReturnValue(false);
  const sceneRef=createRef<HTMLDivElement>();
  const sequenceFor=(species:string,flock=false)=>{
    for(let sequence=1;sequence<200;sequence++){
      const route=previewTreeBirdVisit(WORLD.epoch,'cove',sequence,flock).birds[0];
      if(route.species===species&&usesSpeciesBirdArt(route))return sequence;
    }
    throw new Error(`No close ${species} preview`);
  };
  const fixture=(soloPreview=0,flockPreview=0,location='cove')=><div ref={sceneRef}><TreeBirds sceneRef={sceneRef} location={location} reducedMotion={false} soloPreview={soloPreview} flockPreview={flockPreview}/></div>;
  const view=render(fixture());
  for(const species of TREE_BIRD_SPECIES){
    view.rerender(fixture(sequenceFor(species.id)));
    const bird=view.container.querySelector<HTMLElement>('[data-bird-stream="preview-solo"] .f-tree-bird')!;
    expect(bird).toHaveAttribute('data-bird-species',species.id);expect(bird).toHaveAttribute('data-bird-art','species');
    expect(bird.style.getPropertyValue('--bird-species-sheet')).toContain(`${species.id}/flight-sheet.webp`);
    expect(bird.querySelector('.f-tree-bird-wingbeat')).not.toBeNull();expect(bird.querySelector('.f-tree-bird-glide')).not.toBeNull();expect(bird.querySelector('.f-tree-bird-brake')).not.toBeNull();
  }
  view.rerender(fixture(0,sequenceFor('sparrow',true)));
  expect(view.container.querySelectorAll('[data-bird-stream="preview-flock"] [data-bird-species="sparrow"]')).toHaveLength(10);
  view.rerender(fixture(1,0,'dock'));
  const far=view.container.querySelector('[data-bird-stream="preview-solo"] .f-tree-bird')!;
  expect(far).toHaveAttribute('data-bird-art','silhouette');expect(far.querySelector('.f-tree-bird-wing')).not.toBeNull();expect(far.querySelector('.f-tree-bird-species')).toBeNull();
  view.unmount();expect(jest.getTimerCount()).toBe(0);
});

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
      if(route.from.z>=0){expect(start.x).toBeCloseTo(route.from.x); expect(start.y).toBeCloseTo(route.from.y);
        expect(start.y).toBeLessThan(tree.top.y + (tree.bottom.y - tree.top.y) / 3);}
      else expect(start.opacity).toBe(0);
      if(route.to.z>=0){expect(end.x).toBeCloseTo(route.to.x); expect(end.y).toBeCloseTo(route.to.y);}
      else expect(end.opacity).toBe(0);
      if (route.toTree && route.to.z>=0) {
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
  expect(samples[0].scale).toBeCloseTo(1.9/(.7*4.2),12);
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
    expect(map.container.querySelectorAll('[data-mapped-tree]')).toHaveLength(location === 'cove' ? 12 : 10);
    expect(map.container.querySelectorAll('[data-tree-kind="bush"]')).toHaveLength(location==='cove'?1:0);
    expect(map.container.querySelector('[data-mapped-tree*="behind-viewer"]')).toBeNull();
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
      const target=mappedTreesForLocation(location).find(tree=>tree.id===route.toTree)!;
      expect(poses[5].scale).toBeGreaterThan(poses[0].scale * (target.kind==='bush'?1:2));
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
  const names=['f-tree-bird-flight','f-tree-bird-flap','f-tree-bird-wingbeat','f-tree-bird-flapping','f-tree-bird-gliding','f-tree-bird-cruise','f-tree-bird-brake','f-danger-bob'];
  const animations = names.map(animationName => ({ animationName, currentTime: 500, playbackRate: 1, playState: 'paused' }));
  const scene = document.createElement('div'); Object.defineProperty(scene, 'getAnimations', { value: () => animations });
  stepAmbientAnimations(scene, 5000);
  expect(animations.map(animation => animation.currentTime)).toEqual(names.map(()=>500));
});
