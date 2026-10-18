import React, { createRef } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { behindViewerTreesForLocation, bushesForLocation, foregroundTreesForLocation, mappedTreesForLocation, treePerch } from '../scene/treeMap';
import { makeTreeBirdVisit, previewTreeBirdFlyby, treeBirdPose, usesSpeciesBirdArt } from '../engine/treeBirds';
import { WORLD } from '../engine/world';
import TreeBirds from '../scene/TreeBirds';

declare const test:any,expect:any,jest:any,afterEach:any;
afterEach(()=>{jest.restoreAllMocks();jest.useRealTimers();});

test('bush perches sit behind foreground trunks and negative-depth trees stay beyond every viewport edge',()=>{
  for(const location of ['dock','cove','birch']){
    const mapped=mappedTreesForLocation(location);
    expect(new Set(mapped.map(tree=>tree.id)).size).toBe(mapped.length);
    const hidden=behindViewerTreesForLocation(location);
    expect(hidden).toHaveLength(2);
    hidden.forEach(tree=>{
      expect(tree.hidden).toBe(true);expect(tree.frame).toBe('viewer');expect(tree.top.z).toBeLessThan(0);
      for(const roll of [0,.5,1]){
        const perch=treePerch(tree,()=>roll);
        expect(perch.x<0||perch.x>1).toBe(true);expect(perch.z).toBe(tree.top.z);
      }
    });
    if(location!=='dock'){
      const [bush]=bushesForLocation(location);
      expect(bush.kind).toBe('bush');expect(bush.frame).toBe('foreground');expect(bush.hidden).not.toBe(true);
      foregroundTreesForLocation(location).forEach(tree=>expect(bush.top.z).toBeGreaterThan(tree.top.z));
    }
  }
});

test('natural routes use bushes and behind-viewer trees in both directions, with finite projection and no visible negative depth',()=>{
  const directions=new Set(),bushes=new Set();
  for(const location of ['dock','cove','birch'])for(let seed=1;seed<=120;seed++){
    const visit=makeTreeBirdVisit('depth','solo',WORLD.epoch,seed*19397,location);
    const route=visit.birds[0],map=mappedTreesForLocation(location);
    if(map.find(tree=>tree.id===route.fromTree)?.kind==='bush')bushes.add(location);
    if(map.find(tree=>tree.id===route.toTree)?.kind==='bush')bushes.add(location);
    if(route.from.z<0||route.to.z<0){
      expect(route.from.z>0||route.to.z>0).toBe(true);expect(usesSpeciesBirdArt(route)).toBe(true);
      directions.add(route.from.z<0?'return':'approach');
      for(let sample=0;sample<=100;sample++){
        const pose=treeBirdPose(route,sample/100);
        Object.values(pose).forEach(value=>expect(Number.isFinite(value)).toBe(true));
        expect(pose.scale).toBeGreaterThan(0);expect(pose.scale).toBeLessThanOrEqual(8);
        if(pose.z<=0)expect(pose.opacity).toBe(0);
      }
    }
  }
  expect(directions).toEqual(new Set(['approach','return']));expect(bushes).toEqual(new Set(['cove','birch']));
});

test('fly-pasts grow beyond the trunk scale, move in front of it, then disappear behind the camera without reflecting back',()=>{
  for(const location of ['dock','cove','birch'])for(let sequence=1;sequence<=4;sequence++){
    const route=previewTreeBirdFlyby(WORLD.epoch,location,sequence).birds[0],toward=sequence%2===1;
    expect(toward?route.to.z:route.from.z).toBeLessThan(0);
    const poses=Array.from({length:2001},(_,i)=>treeBirdPose(route,i/2000));
    const close=poses.filter(pose=>pose.z>0&&pose.z<.03&&pose.opacity>0);
    expect(close.some(pose=>pose.layer===11&&pose.scale>3.2)).toBe(true);
    expect(poses.filter(pose=>pose.z<=0).every(pose=>pose.opacity===0)).toBe(true);
    const visible=treeBirdPose(route,toward?0:1),endpoint=toward?route.from:route.to;
    expect(visible.x).toBeCloseTo(endpoint.x);expect(visible.y).toBeCloseTo(endpoint.y);
    const hidden=treeBirdPose(route,toward?1:0);
    expect(hidden.x<0||hidden.x>1).toBe(true);expect(hidden.opacity).toBe(0);
  }
});

test('the dedicated flyby preview retains CSS depth layers and cannot collect a bird behind the viewer',()=>{
  jest.useFakeTimers();jest.setSystemTime(WORLD.epoch);jest.spyOn(document,'hidden','get').mockReturnValue(false);
  const sceneRef=createRef<HTMLDivElement>(),observe=jest.fn();
  const visit=previewTreeBirdFlyby(WORLD.epoch,'cove',2);
  const view=render(<div ref={sceneRef}><TreeBirds sceneRef={sceneRef} location="cove" reducedMotion={false} flybyPreview={2} onObserve={observe}/></div>);
  const bird=view.container.querySelector<HTMLElement>('[data-bird-stream="preview-flyby"] .f-tree-bird')!;
  expect(bird).toHaveAttribute('data-from-frame','viewer');expect(bird).toHaveAttribute('data-bird-art','species');
  expect(bird.style.cssText).not.toMatch(/NaN|Infinity/);
  expect(Array.from({length:61},(_,i)=>bird.style.getPropertyValue(`--bz${i}`))).toContain('11');
  const button=bird.querySelector('button')!;
  fireEvent.click(button);expect(observe).not.toHaveBeenCalled();
  act(()=>jest.advanceTimersByTime(visit.birds[0].durationMs*.7));
  fireEvent.click(button);expect(observe).toHaveBeenCalledTimes(1);
  view.unmount();expect(jest.getTimerCount()).toBe(0);
});
