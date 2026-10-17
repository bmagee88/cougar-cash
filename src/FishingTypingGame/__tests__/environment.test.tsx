import React, { createRef } from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useWorldClock } from '../useWorldClock';
import { useWeatherVisuals } from '../useWeatherVisuals';
import { useSceneParallax, stepAmbientAnimations } from '../scene/useSceneParallax';
import { environmentInterval, readEnvironmentRender } from '../engine/environment';
import { deserializeSave, emptySave, SAVE_KEY } from '../engine/storage';
import { WeatherSystem } from '../scene/FishingScene';
import { weatherVisuals } from '../engine/weather';
import FishingGame from '../FishingGame';
import RainCanvas from '../scene/RainCanvas';
declare const test:any,expect:any,jest:any,beforeEach:any,afterEach:any;
jest.mock('react-router-dom',()=>({Link:({children,to,...props}:any)=>require('react').createElement('a',{...props,href:to},children)}),{virtual:true});
beforeEach(()=>{
  jest.useFakeTimers('modern');localStorage.clear();
  Object.defineProperty(document,'hidden',{configurable:true,value:false});
  Object.defineProperty(window,'matchMedia',{writable:true,value:jest.fn().mockImplementation(query=>({matches:false,media:query,addListener:jest.fn(),removeListener:jest.fn(),addEventListener:jest.fn(),removeEventListener:jest.fn()}))});
});
afterEach(()=>{jest.restoreAllMocks();jest.useRealTimers();});
test('world and storm overlays sample at the selected cadence and stop their timers while hidden',()=>{
  const start=Date.now(),world=renderHook(()=>useWorldClock({},5000)),storm=renderHook(()=>useWeatherVisuals('thunderstorm',undefined,start,undefined,900000,5000));
  const first=world.result.current,firstStorm=storm.result.current;
  act(()=>jest.advanceTimersByTime(4900));expect(world.result.current).toBe(first);expect(storm.result.current).toBe(firstStorm);
  act(()=>jest.advanceTimersByTime(100));expect(world.result.current).not.toBe(first);expect(storm.result.current.elapsedMs).toBe(5000);
  Object.defineProperty(document,'hidden',{configurable:true,value:true});fireEvent(document,new Event('visibilitychange'));
  const hidden=world.result.current;expect(jest.getTimerCount()).toBe(0);
  act(()=>jest.advanceTimersByTime(30000));expect(world.result.current).toBe(hidden);
  Object.defineProperty(document,'hidden',{configurable:true,value:false});fireEvent(document,new Event('visibilitychange'));
  expect(world.result.current).not.toBe(hidden);expect(storm.result.current.elapsedMs).toBe(35000);
  world.unmount();storm.unmount();expect(jest.getTimerCount()).toBe(0);
});
test('timed backgrounds hold between samples while foreground drift stays live, and both stop when hidden',()=>{
  const raf=jest.spyOn(window,'requestAnimationFrame');
  function Scene(){const ref=createRef<HTMLDivElement>();useSceneParallax(ref,false,10000);return <div ref={ref}/>;}
  const view=render(<Scene/>),scene=view.container.firstChild as HTMLElement;
  expect(raf).toHaveBeenCalled();expect(jest.getTimerCount()).toBe(2);
  const initial=scene.style.getPropertyValue('--environment-x');
  act(()=>jest.advanceTimersByTime(9999));expect(scene.style.getPropertyValue('--environment-x')).toBe(initial);
  expect(scene.style.getPropertyValue('--scene-x')).not.toBe('0px');
  act(()=>jest.advanceTimersByTime(1));expect(scene.style.getPropertyValue('--environment-x')).not.toBe(initial);
  Object.defineProperty(document,'hidden',{configurable:true,value:true});fireEvent(document,new Event('visibilitychange'));
  expect(jest.getTimerCount()).toBe(0);expect(scene).toHaveClass('f-scene-paused');
  view.unmount();expect(jest.getTimerCount()).toBe(0);
});
test('samples affect only backgrounds, leaving foreground, birds, insects and temporary effects untouched',()=>{
  const background=document.createElement('div');background.dataset.sceneDepth='background';
  const foreground=document.createElement('div');foreground.dataset.sceneDepth='foreground';
  const ambient={animationName:'f-cloud-life',currentTime:200,playbackRate:1,playState:'paused',effect:{target:background}};
  const wind={animationName:'f-sway',currentTime:100,playbackRate:2,playState:'paused',effect:{target:foreground}};
  const temporary=['f-tree-bird-flight','f-tree-bird-flap','f-geese-pass','f-goose-flap','f-lantern-orbit','f-lantern-buzz','f-lake-splash','f-meteor-pass','f-angler-breathe','f-leaf-arrive'].map(animationName=>({animationName,currentTime:100,playbackRate:1,playState:'paused',effect:{target:background}}));
  const fight={animationName:'f-danger-bob',currentTime:100,playbackRate:1,playState:'running'};
  const scene=document.createElement('div');Object.defineProperty(scene,'getAnimations',{value:()=>[ambient,wind,fight,...temporary]});
  stepAmbientAnimations(scene,5000);
  expect(ambient.currentTime).toBe(5200);expect(wind.currentTime).toBe(100);expect(fight.currentTime).toBe(100);
  temporary.forEach(animation=>expect(animation.currentTime).toBe(100));
});
test('timed weather briefly fades outgoing particles and releases them after one second',()=>{
  const view=render(<WeatherSystem weather="rain" intervalMs={5000}/>);
  view.rerender(<WeatherSystem weather="sunny" visuals={weatherVisuals('sunny')} intervalMs={5000}/>);
  expect(view.container.querySelector('[data-weather-layer="rain"]')).toHaveAttribute('data-weather-active','false');
  act(()=>jest.advanceTimersByTime(1050));expect(view.container.querySelector('[data-weather-layer="rain"]')).toBeNull();
  expect(view.container.querySelectorAll('[data-weather-layer]')).toHaveLength(1);view.unmount();expect(jest.getTimerCount()).toBe(0);
});
test('background samples blend painted states with one short native animation per element',()=>{
  const scene=document.createElement('div'),target=document.createElement('div');target.dataset.sceneDepth='background';scene.append(target);
  const motion={animationName:'f-aurora-drift',currentTime:200,playbackRate:1,playState:'paused',effect:{target,getKeyframes:()=>[{transform:'none'}]}};
  const light={animationName:'f-aurora-breathe',currentTime:200,playbackRate:1,playState:'paused',effect:{target,getKeyframes:()=>[{opacity:1}]}};
  const bridge={cancel:jest.fn()},animate=jest.fn(()=>bridge);
  Object.defineProperty(target,'animate',{value:animate});Object.defineProperty(scene,'getAnimations',{value:()=>[motion,light]});
  jest.spyOn(window,'getComputedStyle').mockImplementation(()=>({transform:`translateX(${motion.currentTime}px)`,opacity:String(light.currentTime/10000)}) as CSSStyleDeclaration);
  const raf=jest.spyOn(window,'requestAnimationFrame');
  expect(stepAmbientAnimations(scene,10000,1000)).toEqual([bridge]);expect(animate).toHaveBeenCalledTimes(1);
  expect(animate).toHaveBeenCalledWith([{transform:'translateX(200px)',opacity:'0.02'},{transform:'translateX(10200px)',opacity:'1.02'}],{duration:1000,easing:'ease-in-out'});
  expect(raf).not.toHaveBeenCalled();
});

test('timed storm rain paints once per interval, crossfades snapshots, caps its surface and stops while hidden',()=>{
  const context={clearRect:jest.fn(),beginPath:jest.fn(),moveTo:jest.fn(),lineTo:jest.fn(),stroke:jest.fn(),ellipse:jest.fn(),drawImage:jest.fn(),setTransform:jest.fn()};
  const canvasType=Object.getOwnPropertyDescriptor(window,'CanvasRenderingContext2D');
  Object.defineProperty(window,'CanvasRenderingContext2D',{configurable:true,value:function(){}});
  try {
    jest.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context as any);
    jest.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue({width:3840,height:2160} as DOMRect);
    const view=render(<RainCanvas weather="hurricane" intensity={1} reducedMotion={false} intervalMs={10000}/>);
    const surface=view.getByTestId('storm-rain-canvas') as HTMLCanvasElement,snapshot=view.getByTestId('storm-rain-snapshot');
    const blend={cancel:jest.fn()},reveal={cancel:jest.fn()},animate=jest.fn(()=>blend),show=jest.fn(()=>reveal);
    Object.defineProperty(snapshot,'animate',{value:animate});Object.defineProperty(surface,'animate',{value:show});
    expect(surface.width).toBe(1440);expect(surface.height).toBe(810);
    expect(context.setTransform).toHaveBeenCalledWith(.375,0,0,.375,0,0);
    context.clearRect.mockClear();context.drawImage.mockClear();
    act(()=>jest.advanceTimersByTime(9999));expect(context.clearRect).not.toHaveBeenCalled();
    act(()=>jest.advanceTimersByTime(1));expect(context.drawImage).toHaveBeenCalledWith(surface,0,0);
    expect(animate).toHaveBeenCalledWith([{opacity:1},{opacity:0}],{duration:1000,easing:'ease-in-out'});
    expect(show).toHaveBeenCalledWith([{opacity:0},{opacity:1}],{duration:1000,easing:'ease-in-out'});
    context.clearRect.mockClear();act(()=>jest.advanceTimersByTime(9000));expect(context.clearRect).not.toHaveBeenCalled();
    Object.defineProperty(document,'hidden',{configurable:true,value:true});fireEvent(document,new Event('visibilitychange'));
    expect(blend.cancel).toHaveBeenCalled();expect(reveal.cancel).toHaveBeenCalled();expect(jest.getTimerCount()).toBe(0);
    view.unmount();expect(surface.width).toBe(1);
  } finally {
    if(canvasType)Object.defineProperty(window,'CanvasRenderingContext2D',canvasType);else delete (window as any).CanvasRenderingContext2D;
  }
});

test('environment render setting offers all intervals, persists, and leaves typing ready between slow environmental updates',()=>{
  // Keep local sky assets offline while checking gameplay timer cleanup.
  jest.spyOn(global,'fetch').mockResolvedValue({ok:true,json:async()=>[]} as Response);
  const save=emptySave();save.settings.fishingMode='fish-fight';localStorage.setItem(SAVE_KEY,JSON.stringify(save));
  const random=jest.spyOn(Math,'random').mockReturnValue(.99);
  const view=render(<FishingGame/>);
  fireEvent.click(screen.getByRole('button',{name:'Settings'}));fireEvent.mouseDown(screen.getByRole('combobox',{name:/Environment render/}));
  ['Natural (smooth)','Every 1 second','Every 2 seconds','Every 5 seconds','Every 10 seconds'].forEach(name=>expect(screen.getByRole('option',{name})).toBeInTheDocument());
  fireEvent.click(screen.getByRole('option',{name:'Every 10 seconds'}));
  expect(deserializeSave(localStorage.getItem(SAVE_KEY)).settings.environmentRender).toBe(10000);
  fireEvent.click(screen.getByRole('button',{name:'Close Make yourself at home'}));act(()=>jest.advanceTimersByTime(300));
  expect(view.container.querySelector('.f-scene')).toHaveClass('f-scene-stepped');
  fireEvent.click(screen.getByRole('button',{name:/Cast your line/}));act(()=>jest.advanceTimersByTime(900));
  const input=screen.getByRole('textbox',{name:/^Retrieve this haiku:/});const phrase=input.getAttribute('aria-label')!.replace('Retrieve this haiku: ','');
  fireEvent.keyDown(input,{key:phrase[0]});expect(input).toHaveValue(phrase[0]);
  random.mockReturnValue(0);fireEvent.keyDown(input,{key:phrase[1]});
  const fight=screen.getByRole('textbox',{name:/^Fight this fish with the same haiku:/});expect(fight).toHaveValue(phrase.slice(0,2));
  act(()=>jest.advanceTimersByTime(2000));expect(screen.getByText('Fish jolting · ease the line')).toBeInTheDocument();
  fireEvent.keyDown(fight,{key:'Backspace'});expect(fight).toHaveValue(phrase[0]);
  view.unmount();expect(jest.getTimerCount()).toBe(0);
});
test('old saves default to natural rendering and invalid intervals cannot create runaway timers',()=>{
  const save=emptySave();delete save.settings.environmentRender;
  expect(deserializeSave(JSON.stringify(save)).settings.environmentRender).toBe('natural');
  expect(readEnvironmentRender(0)).toBe('natural');expect(readEnvironmentRender(1)).toBe('natural');expect(readEnvironmentRender(5000)).toBe(5000);
  expect(environmentInterval('natural')).toBe(0);
});
