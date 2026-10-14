import React, { useRef } from 'react';
import { act, render } from '@testing-library/react';
import { FishingLine } from '../scene/FishingScene';
import { coverPatches, pointOnReelPath, reelPath } from '../scene/reelPath';
import { generateEncounter, seededRandom } from '../engine/encounters';
import { createTyping } from '../engine/game';
import { DEFAULT_TACKLE } from '../engine/tackle';
import { GameState } from '../engine/types';

declare const test:any,expect:any,jest:any;

const cover=[false,true,true,true,false,false,true,false,false,false];
const state:Extract<GameState,{phase:'retrieving'}>={phase:'retrieving',castDistance:1.65,tackle:DEFAULT_TACKLE,
  retrieve:{typing:createTyping('quiet lake',0),cover,keys:[],rhythm:'steady',lastKeyAt:0,lastRollAt:0,maxReeled:2}};

test('contiguous cover letters form one patch at their shared reel-path position',()=>{
  expect(coverPatches(cover,10)).toEqual([{start:1,end:3,at:.2},{start:6,end:6,at:.6}]);
  expect(coverPatches([],0)).toEqual([]);
  const calm=reelPath(1,{x:.35,y:.85}),storm=reelPath(1.65,{x:.35,y:.85});
  expect(pointOnReelPath(calm,0)).toEqual({x:.6,y:.6775});
  expect(pointOnReelPath(calm,1)).toEqual(calm.near);
  expect(pointOnReelPath(storm,0).x).toBeCloseTo(.717);
  expect(pointOnReelPath(calm,.2).x).toBeCloseTo(.55);
  expect(pointOnReelPath(calm,.2).y).toBeCloseTo(.712);
  expect(pointOnReelPath(storm,.2).x).toBeGreaterThan(pointOnReelPath(calm,.2).x);
});

test('cover uses the measured angler path and highlights only the actual current letters',()=>{
  let frame:FrameRequestCallback|undefined;
  const raf=jest.spyOn(window,'requestAnimationFrame').mockImplementation((callback:FrameRequestCallback)=>{frame=callback;return 1;});
  const cancel=jest.spyOn(window,'cancelAnimationFrame').mockImplementation(()=>{});
  const rectangles=jest.spyOn(Element.prototype,'getBoundingClientRect').mockImplementation(function(this:Element){
    const values=this.classList.contains('f-fishing-line') ? {left:100,top:50,width:1000,height:700}
      : this.classList.contains('test-hand') ? {left:400,top:540,width:2,height:2} : {left:450,top:300,width:2,height:2};
    return {...values,x:values.left,y:values.top,right:values.left+values.width,bottom:values.top+values.height,toJSON:()=>({})} as DOMRect;
  });
  function Line({game}:{game:GameState}){
    const tip=useRef<HTMLElement>(null),hand=useRef<HTMLElement>(null);
    return <><i ref={tip} className="test-tip"/><i ref={hand} className="test-hand"/><FishingLine game={game} tipRef={tip} handRef={hand} progress={.2} struggling={false} splashBurst={0} reducedMotion /></>;
  }
  const view=render(<Line game={state}/>);
  try{
    act(()=>frame?.(100));
    const root=view.container.querySelector('.f-water-cover') as HTMLElement;
    expect(root.style.getPropertyValue('--cover-far-x')).toBe('71.7%');
    expect(parseFloat(root.style.getPropertyValue('--cover-near-x'))).toBeCloseTo(36.5);
    expect(root.style.getPropertyValue('--cover-near-y')).toBe('82%');
    const float=view.container.querySelector('.f-float-group') as HTMLElement;
    expect(parseFloat(float.style.left)).toBeCloseTo(64.66);
    expect(view.container.querySelectorAll('[data-cover-start]')).toHaveLength(2);
    expect(view.container.querySelector('[data-cover-start="1"]')).toHaveAttribute('data-cover-active','true');
    expect(view.container.querySelector('[data-cover-start="6"]')).toHaveAttribute('data-cover-active','false');
    view.rerender(<Line game={{...state,retrieve:{...state.retrieve,maxReeled:6}}}/>);
    expect(view.container.querySelector('[data-cover-start="1"]')).toHaveAttribute('data-cover-active','false');
    expect(view.container.querySelector('[data-cover-start="6"]')).toHaveAttribute('data-cover-active','true');
  }finally{view.unmount();raf.mockRestore();cancel.mockRestore();rectangles.mockRestore();}
});

test('a hooked interactive fish retains its grass patches, while Standard and ended casts hide them',()=>{
  const fish=generateEncounter(seededRandom(5));
  const view=render(<FishingLine game={state} progress={.2} struggling={false} splashBurst={0} reducedMotion />);
  const patch=view.container.querySelector('[data-cover-start="1"]');
  const hooked={...fish,retrieve:{phrase:state.retrieve.typing.phrase,reeled:.2,rhythm:'steady' as const,grass:true}};
  view.rerender(<FishingLine game={{phase:'typing',encounter:hooked,typing:createTyping(fish.phrase,1)}} progress={.3} struggling={false} splashBurst={0} reducedMotion />);
  expect(view.container.querySelector('[data-cover-start="1"]')).toBe(patch);
  expect(view.container.querySelectorAll('[data-cover-active="true"]')).toHaveLength(0);
  view.rerender(<FishingLine game={{phase:'typing',encounter:fish,typing:createTyping(fish.phrase,1)}} progress={.3} struggling={false} splashBurst={0} reducedMotion />);
  expect(view.container.querySelector('.f-water-cover')).toBeNull();
  view.rerender(<FishingLine game={{phase:'retrieved'}} progress={0} struggling={false} splashBurst={0} reducedMotion />);
  expect(view.container.querySelector('.f-water-cover')).toBeNull();
});
