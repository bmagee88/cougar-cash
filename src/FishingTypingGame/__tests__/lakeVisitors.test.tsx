import React, { createRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { discoverVisitor, gooseDirection, nextSantaCheck, ODONATES, ODONATE_SPRITE, santaVisit, santaVisitStart, SANTA_SPRITE, SANTA_VISIT_MS, splashScale } from '../engine/visitors';
import { deserializeSave, emptySave } from '../engine/storage';
import { worldAt } from '../engine/world';
import { blankEntry, saveNotebookEntry } from '../engine/notebook';
import { createFlight, flightBottom, FOREGROUND_DEPTH } from '../scene/butterflyFlight';
import { stepOdonate } from '../scene/odonateFlight';
import ButterflyVisitors, { paintedVisitorButton } from '../scene/ButterflyVisitors';
import { LakeWildlife, SantaVisitor } from '../scene/LakeVisitors';
import FieldGuide, { guideDiscoveries } from '../components/FieldGuide';
import { NotebookEditor } from '../components/CatchNotebook';

declare const test:any,expect:any,jest:any,afterEach:any;
afterEach(()=>{jest.restoreAllMocks();jest.useRealTimers();});
const rect={x:0,y:0,left:0,top:0,right:800,bottom:600,width:800,height:600,toJSON:()=>({})} as DOMRect;

test('Santa has one stable real-local Christmas window per year, including midnight boundaries and caught years',()=>{
  [2026,2027,2028].forEach(year=>{
    const start=santaVisitStart(year),date=new Date(start);
    expect(santaVisitStart(year)).toBe(start);expect(date.getMonth()).toBe(11);expect(date.getDate()).toBe(25);
    expect(new Date(start+SANTA_VISIT_MS).getDate()).toBe(25);
    expect(worldAt(start).period).toBe('late-night');expect(worldAt(start+SANTA_VISIT_MS-1).period).toBe('late-night');
    expect(santaVisit(start-1)).toBeUndefined();expect(santaVisit(start)?.progress).toBe(0);
    expect(santaVisit(start+45000)?.progress).toBe(.5);expect(santaVisit(start+SANTA_VISIT_MS)).toBeUndefined();
    expect(santaVisit(start,[year])).toBeUndefined();expect(santaVisit(new Date(year,11,24,23,59).getTime())).toBeUndefined();
    expect(santaVisit(new Date(year,11,26).getTime())).toBeUndefined();
    expect(nextSantaCheck(start-10000)).toBe(10000);
  });
  expect(santaVisitStart(2027)-new Date(2027,11,25).getTime()).not.toBe(santaVisitStart(2026)-new Date(2026,11,25).getTime());
});

test('new discoveries and the exact clicked pose survive a reload while editable journal fields stay blank',()=>{
  const pose={frame:6,rotation:.25,flipped:true};
  const entry=blankEntry('dragonfly-1',new Date().toISOString(),'dock',{kind:'visitor',speciesId:'green-darner',pose});
  let save=discoverVisitor(emptySave(),'green-darner');
  save=discoverVisitor(save,'green-darner');
  expect(save.visitorDiscoveries).toEqual(['green-darner']);expect(save.notebook).toEqual([]);
  save=saveNotebookEntry(save,entry.id,{title:'Hovering at the reeds'},entry);
  const loaded=deserializeSave(JSON.stringify(save));
  expect(loaded.notebook![0]).toEqual({...entry,title:'Hovering at the reeds'});
  expect(loaded.notebook![0].weightKg).toBeUndefined();expect(loaded.notebook![0].lengthCm).toBeUndefined();
  const view=render(<NotebookEditor entry={loaded.notebook![0]} units="metric" onSave={jest.fn()} discoveries={guideDiscoveries(loaded)}/>);
  expect(view.getByLabelText('Subject')).toHaveValue('');expect(view.getByAltText('The visitor you observed')).toHaveAttribute('data-wing-frame','6');
  fireEvent.click(view.getByRole('button',{name:'Open field guide'}));expect(view.getByRole('tab',{name:/Dragonflies & damselflies/})).toHaveAttribute('aria-selected','true');
  expect(view.getByText('Common green darner')).toBeInTheDocument();view.unmount();
  const santa=discoverVisitor(emptySave(),'santa',new Date(2026,11,25,12));expect(santa.santaYears).toEqual([2026]);
  expect(discoverVisitor(emptySave(),'santa',new Date(2026,9,16)).santaYears).toEqual([]);
  const malformed=deserializeSave(JSON.stringify({...save,visitorDiscoveries:['fake','santa','santa'],santaYears:[2026,'2026',-3,Infinity]}));
  expect(malformed.visitorDiscoveries).toEqual(['santa']);expect(malformed.santaYears).toEqual([2026]);
});

test('guide silhouettes reveal only collected visitors and special guests have their own tab',()=>{
  const view=render(<FieldGuide initialTab="odonates" discoveries={{discovered:[],albinoDiscovered:[],visitors:['ebony-jewelwing','santa']}}/>);
  expect(screen.getByText('Ebony jewelwing')).toBeInTheDocument();expect(screen.queryByText('Common green darner')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab',{name:'Special visitors'}));expect(screen.getByText('Santa Claus')).toBeInTheDocument();view.unmount();
});

test('odonates hover, patrol, reverse without turning their bodies, and flutter more slowly; depth keeps its water boundary',()=>{
  const base={...createFlight(()=>.5),x:.5,y:.6,turnIn:0,facing:1};
  const hover={...base};stepOdonate(hover,'dragonfly',.05,800,600,()=>.1);expect(Math.abs(hover.vx)).toBeLessThan(12);
  const dart={...base};stepOdonate(dart,'dragonfly',.05,800,600,()=>.9);expect(Math.abs(dart.vx)).toBeGreaterThan(170);
  const reverse={...base};const rolls=[.9,.5,.9,.1,.5,.5,.5];stepOdonate(reverse,'dragonfly',.05,800,600,()=>rolls.shift()??.5);
  expect(reverse.vx).toBeLessThan(0);expect(reverse.facing).toBe(1);
  const flutter={...base};stepOdonate(flutter,'damselfly',.05,800,600,()=>.9);expect(Math.abs(flutter.vx)).toBeLessThan(Math.abs(dart.vx));
  const near={...base,turnIn:10,z:.3,vx:160,vy:30,vz:0},far={...near,z:3,behindForeground:true};
  stepOdonate(near,'dragonfly',.05,800,600,()=>.5);stepOdonate(far,'dragonfly',.05,800,600,()=>.5);
  expect(far.x-.5).toBeLessThan(near.x-.5);
  far.y=.99;far.vz=-1;stepOdonate(far,'damselfly',.1,800,600,()=>.5,undefined,.55);
  expect(far.y).toBeLessThanOrEqual(flightBottom(far.z,.55));far.z=FOREGROUND_DEPTH;stepOdonate(far,'damselfly',.1,800,600,()=>.5);expect(far.z).toBeGreaterThan(FOREGROUND_DEPTH);
  const fleeing={...base};stepOdonate(fleeing,'dragonfly',.05,800,600,()=>.5,{x:400,y:360,previousX:400,previousY:360,speed:0});expect(fleeing.fleeing).toBe(true);
});

test('new insect visitors use painted-pixel catching and clean up arrival timers while hidden',async()=>{
  jest.useFakeTimers();jest.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue(rect);
  const hidden=jest.spyOn(document,'hidden','get').mockReturnValue(false);
  const alpha=jest.fn(()=>({data:[0,0,0,0]}));
  const context={clearRect:jest.fn(),save:jest.fn(),restore:jest.fn(),translate:jest.fn(),rotate:jest.fn(),scale:jest.fn(),drawImage:jest.fn(),getImageData:alpha};
  jest.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context as any);
  jest.spyOn(window,'Image').mockImplementation(function(){const image:any={};Object.defineProperty(image,'src',{set:()=>image.onload?.()});return image;} as any);
  const sceneRef=createRef<HTMLDivElement>(),observe=jest.fn(),props={sceneRef,family:'odonates' as const,season:'summer' as const,hour:12,weather:'sunny' as const,location:'dock',reducedMotion:false,onObserve:observe};
  const view=render(<div ref={sceneRef}><ButterflyVisitors {...props}/></div>);
  await act(async()=>view.rerender(<div ref={sceneRef}><ButterflyVisitors {...props} preview={1}/></div>));
  act(()=>jest.advanceTimersByTime(1000));
  const visitor=view.getByRole('button',{name:'Observe dragonfly'});
  expect(visitor.querySelector('canvas')).toHaveAttribute('width',String(ODONATE_SPRITE.canvasSize));
  expect(visitor.querySelector('canvas')).toHaveAttribute('height',String(ODONATE_SPRITE.canvasSize));
  expect(ODONATE_SPRITE.canvasSize**2).toBeLessThanOrEqual(320**2/4);
  expect(context.drawImage).toHaveBeenCalledWith(expect.anything(),expect.any(Number),0,96,112,-48,-56,96,112);
  fireEvent.click(visitor,{detail:1,clientX:400,clientY:300});expect(observe).not.toHaveBeenCalled();
  // A visibly translucent wing pixel is still catchable; empty padding is not.
  alpha.mockReturnValue({data:[0,0,0,38]});fireEvent.click(visitor,{detail:1,clientX:400,clientY:300});
  expect(observe).toHaveBeenCalledWith(expect.anything(),'ebony-jewelwing',expect.any(Number),expect.objectContaining({frame:expect.any(Number)}));
  hidden.mockReturnValue(true);fireEvent(document,new Event('visibilitychange'));expect(jest.getTimerCount()).toBe(0);
  view.unmount();expect(jest.getTimerCount()).toBe(0);
});

test('seasonal geese reverse direction and splashes shrink toward the horizon; ambient visitors stop and unload',()=>{
  expect(gooseDirection('spring')).toBe(1);expect(gooseDirection('autumn')).toBe(-1);expect(gooseDirection('summer')).toBe(0);expect(gooseDirection('winter')).toBe(0);
  expect(splashScale(.1)).toBeLessThan(splashScale(.8));
  jest.useFakeTimers();jest.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue(rect);
  const hidden=jest.spyOn(document,'hidden','get').mockReturnValue(false),sceneRef=createRef<HTMLDivElement>();
  const view=render(<div ref={sceneRef}><div data-layer="lake-background"/><LakeWildlife sceneRef={sceneRef} season="spring" weather="sunny" reducedMotion={false}/></div>);
  view.rerender(<div ref={sceneRef}><div data-layer="lake-background"/><LakeWildlife sceneRef={sceneRef} season="spring" weather="sunny" reducedMotion={false} preview={{geese:1,splashes:1}}/></div>);
  expect(view.container.querySelector('[data-layer="geese"]')).toHaveAttribute('data-direction','left-to-right');const count=Number(view.container.querySelector('[data-layer="geese"]')!.getAttribute('data-goose-count'));expect(count).toBeGreaterThanOrEqual(4);expect(count).toBeLessThanOrEqual(13);expect(view.container.querySelectorAll('.f-goose-flight img')).toHaveLength(count);
  const geeseImages=Array.from(view.container.querySelectorAll<HTMLImageElement>('.f-goose-flight img'));
  expect(geeseImages.every(image=>/canada-goose\/(far\/)?flight-(0|4|8)\.gif$/.test(image.getAttribute('src')!))).toBe(true);
  expect(new Set(geeseImages.map(image=>image.getAttribute('src'))).size).toBeLessThanOrEqual(3);
  expect(view.container.querySelector('[data-layer="geese"] svg')).toBeNull();
  view.rerender(<div ref={sceneRef}><div data-layer="lake-background"/><LakeWildlife sceneRef={sceneRef} season="spring" weather="sunny" reducedMotion={false} intervalMs={5000} preview={{geese:1,splashes:1}}/></div>);
  expect(view.container.querySelectorAll('.f-goose-flight img')).toHaveLength(0);expect(view.container.querySelectorAll('.f-goose-sampled')).toHaveLength(count);
  expect(view.container.querySelectorAll('.f-lake-splash')).toHaveLength(1);act(()=>jest.advanceTimersByTime(1750));expect(view.container.querySelectorAll('.f-lake-splash')).toHaveLength(0);
  hidden.mockReturnValue(true);fireEvent(document,new Event('visibilitychange'));expect(jest.getTimerCount()).toBe(0);expect(view.container.querySelector('[data-layer="geese"]')).toBeNull();
  view.rerender(<div ref={sceneRef}><div data-layer="lake-background"/><LakeWildlife sceneRef={sceneRef} season="autumn" weather="sunny" reducedMotion={false} preview={{geese:2}}/></div>);
  expect(view.container.querySelector('[data-layer="geese"]')).toBeNull();
  hidden.mockReturnValue(false);fireEvent(document,new Event('visibilitychange'));
  expect(view.container.querySelector('[data-layer="geese"]')).toHaveAttribute('data-direction','right-to-left');
  view.unmount();expect(jest.getTimerCount()).toBe(0);
});

test('Santa sleeps outside Christmas, rejects transparent clicks, and remains collectible with reduced motion',()=>{
  jest.useFakeTimers();jest.setSystemTime(new Date(2026,9,16));
  jest.spyOn(document,'hidden','get').mockReturnValue(false);jest.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue(rect);
  const frame=jest.spyOn(window,'requestAnimationFrame'),sceneRef=createRef<HTMLDivElement>(),observe=jest.fn();
  const alpha=jest.fn(()=>({data:[0,0,0,0]}));jest.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({clearRect:jest.fn(),drawImage:jest.fn(),fillRect:jest.fn(),getImageData:alpha} as any);
  jest.spyOn(window,'Image').mockImplementation(function(){const image:any={complete:true,naturalWidth:64,naturalHeight:28};Object.defineProperty(image,'src',{set:()=>image.onload?.()});return image;} as any);
  const view=render(<div ref={sceneRef}><SantaVisitor period="late-night" sceneRef={sceneRef} reducedMotion onObserve={observe}/></div>);
  expect(frame).not.toHaveBeenCalled();expect(view.queryByRole('button')).toBeNull();expect(jest.getTimerCount()).toBe(1);
  view.rerender(<div ref={sceneRef}><SantaVisitor period="late-night" sceneRef={sceneRef} reducedMotion preview={1} onObserve={observe}/></div>);
  act(()=>jest.advanceTimersByTime(1000));
  const santa=view.getByRole('button',{name:'Observe Santa Claus'});
  fireEvent.click(santa,{detail:1,clientX:300,clientY:200});expect(observe).not.toHaveBeenCalled();
  alpha.mockReturnValue({data:[0,0,0,255]});fireEvent.click(santa,{detail:1,clientX:300,clientY:200});expect(observe).toHaveBeenCalledWith(santa,'santa',0);
  expect(view.queryByRole('button')).toBeNull();view.unmount();expect(jest.getTimerCount()).toBe(0);
});

test('transparent padding allows painted visitors from another family to be picked underneath',()=>{
  const view=render(<div><button className="f-santa-visit" data-painted="true"><canvas data-alpha="255"/></button><button className="f-butterfly-visit" data-wing-frame="0" style={{zIndex:11}}><canvas data-alpha="0"/></button></div>);
  jest.spyOn(HTMLCanvasElement.prototype,'getBoundingClientRect').mockReturnValue(rect);
  jest.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation(function(this:HTMLCanvasElement){return {getImageData:()=>({data:[0,0,0,Number(this.dataset.alpha)]})} as any;});
  expect(paintedVisitorButton(view.container,400,300)).toBe(view.container.querySelector('.f-santa-visit'));
  view.container.querySelector<HTMLCanvasElement>('.f-butterfly-visit canvas')!.dataset.alpha='255';
  expect(paintedVisitorButton(view.container,400,300)).toBe(view.container.querySelector('.f-butterfly-visit'));
});

test('Santa and developer previews stay hidden outside late night and use a tiny picking canvas',()=>{
  jest.useFakeTimers();jest.setSystemTime(santaVisitStart(2026)+10000);
  jest.spyOn(document,'hidden','get').mockReturnValue(false);
  jest.spyOn(window,'Image').mockImplementation(function(){return {complete:false};} as any);
  const sceneRef=createRef<HTMLDivElement>(),observe=jest.fn();
  const view=render(<div ref={sceneRef}><SantaVisitor sceneRef={sceneRef} period="afternoon" preview={1} reducedMotion onObserve={observe}/></div>);
  expect(view.queryByRole('button')).toBeNull();expect(jest.getTimerCount()).toBe(0);
  view.rerender(<div ref={sceneRef}><SantaVisitor sceneRef={sceneRef} period="late-night" preview={1} reducedMotion onObserve={observe}/></div>);
  const sprite=view.getByRole('button',{name:'Observe Santa Claus'}).querySelector('canvas');
  expect(sprite).toHaveAttribute('width',String(SANTA_SPRITE.width));expect(sprite).toHaveAttribute('height',String(SANTA_SPRITE.height));
  expect(SANTA_SPRITE.width*SANTA_SPRITE.height).toBeLessThan(2000);
  view.rerender(<div ref={sceneRef}><SantaVisitor sceneRef={sceneRef} period="early-night" preview={2} reducedMotion onObserve={observe}/></div>);
  expect(view.queryByRole('button')).toBeNull();expect(jest.getTimerCount()).toBe(0);view.unmount();
});

test('catalog includes both groups with smaller jewelwings',()=>{expect(ODONATES.map(s=>s.kind)).toEqual(['dragonfly','damselfly']);expect(ODONATES[1].wingspanMm[1]).toBeLessThan(ODONATES[0].wingspanMm[0]);});
