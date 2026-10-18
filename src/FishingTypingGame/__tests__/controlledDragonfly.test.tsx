import React,{createRef} from 'react';
import {act,fireEvent,render} from '@testing-library/react';
import ControlledDragonfly,{stepControlledDragonfly} from '../scene/ControlledDragonfly';
import {createFlight,flightBottom,flightMovementScale} from '../scene/butterflyFlight';
import {Visitor} from '../scene/ButterflyVisitors';
import {groundPerspective} from '../scene/sceneDepth';

declare const test:any,expect:any,jest:any,afterEach:any;
afterEach(()=>{jest.restoreAllMocks();jest.useRealTimers();});
const visitor=():Visitor=>({id:-1,speciesId:'green-darner',wingspanMm:90,size:40,
  flight:{...createFlight(()=>.5),age:0,x:.5,y:.75,z:.06,perch:undefined}});

test('arrows retain their speed while depth movement runs at 30% and Shift adds fine control',()=>{
  for(const [width,height] of [[800,600],[1920,1080],[2560,1440]]){
    for(const [key,axis,start,end] of [['arrowright','x',.07,.93],['arrowleft','x',.93,.07],['arrowdown','y',.08,1],['arrowup','y',1,.08]] as const){
      const fly=visitor();fly.flight.z=0;fly.flight[axis]=start;
      stepControlledDragonfly(fly,new Set([key]),.2,width,height);
      expect(fly.flight[axis]).toBeCloseTo(start+Math.sign(end-start)*.4,12);
      stepControlledDragonfly(fly,new Set([key]),.3,width,height);
      expect(fly.flight[axis]).toBe(end);expect(fly.flight.z).toBe(0);
    }
  }
  const fly=visitor();
  stepControlledDragonfly(fly,new Set(['r']),.25,1920,1080);
  expect(fly.flight.z).toBeCloseTo(.06+.22*.3*.25,12);
  stepControlledDragonfly(fly,new Set(['f']),.25,1920,1080);
  expect(fly.flight.z).toBeCloseTo(.06,12);
  stepControlledDragonfly(fly,new Set(['r','shift']),.25,1920,1080);
  expect(fly.flight.z).toBeCloseTo(.06+.22*.3*.01*.25,12);
});

test('at the angler depth, moving sideways over water stays at the boots instead of the distant water',()=>{
  for(const [horizon,feet] of [[.5,.96],[.555,.87],[.5,.86]]){
    const fly=visitor();fly.flight.perspective={horizon,...groundPerspective(horizon,feet)};
    fly.flight.z=fly.flight.perspective.foreground;fly.flight.y=feet;
    stepControlledDragonfly(fly,new Set(['arrowright']),.1,1440,900,horizon);
    expect(fly.flight.x).toBeGreaterThan(.5);expect(fly.flight.y).toBeCloseTo(feet,12);
    for(let n=0;n<20;n++)stepControlledDragonfly(fly,new Set(['arrowdown']),.05,1440,900,horizon);
    expect(fly.flight.y).toBeCloseTo(feet,12);expect(fly.flight.z).toBe(fly.flight.perspective.foreground);
  }
});

test('manual vectors move the dragonfly, select the existing front/rear art, and stay within bounds',()=>{
  const fly=visitor();
  stepControlledDragonfly(fly,new Set(['arrowright']),.2,800,600);
  expect(fly.flight.x).toBeGreaterThan(.5);expect(fly.direction?.view).toBe('right');
  for(let n=0;n<8;n++)stepControlledDragonfly(fly,new Set(['r']),.025,800,600);
  expect(fly.flight.z).toBeGreaterThan(.06);expect(fly.direction?.view).toBe('back');expect(fly.flight.y).toBeLessThan(.75);
  for(let n=0;n<8;n++)stepControlledDragonfly(fly,new Set(['f']),.025,800,600);
  expect(fly.direction?.view).toBe('front');
  for(let n=0;n<300;n++)stepControlledDragonfly(fly,new Set(['arrowleft','arrowup','f']),.05,800,600);
  expect(fly.flight.x).toBe(.07);expect(fly.flight.y).toBe(.08);expect(fly.flight.z).toBe(0);
  for(let n=0;n<1000;n++)stepControlledDragonfly(fly,new Set(['r']),.05,800,600);
  expect(fly.flight.z).toBe(.98);expect(fly.flight.behindForeground).toBe(true);expect(Math.abs(fly.flight.y-.5)).toBeLessThan(.02);
});

test('spawn is explicit, controls respect text input, blur releases held keys, and Escape cleans up',async()=>{
  jest.useFakeTimers();jest.spyOn(document,'hidden','get').mockReturnValue(false);
  jest.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(800);
  jest.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(600);
  const context={clearRect:jest.fn(),save:jest.fn(),restore:jest.fn(),translate:jest.fn(),rotate:jest.fn(),scale:jest.fn(),drawImage:jest.fn()};
  jest.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context as any);
  jest.spyOn(window,'Image').mockImplementation(function(){const image:any={};Object.defineProperty(image,'src',{set:()=>image.onload?.()});return image;} as any);
  const sceneRef=createRef<HTMLDivElement>();
  const fixture=(spawn:number)=><div ref={sceneRef}><input aria-label="Typing field"/><ControlledDragonfly sceneRef={sceneRef} spawn={spawn}/></div>;
  const view=render(fixture(0));expect(view.queryByRole('button',{name:'Controlled dragonfly'})).toBeNull();
  view.rerender(fixture(1));await act(async()=>{});act(()=>jest.advanceTimersByTime(200));
  const fly=view.getByRole('button',{name:'Controlled dragonfly'}),initial=fly.style.left;
  fireEvent.keyDown(document,{key:'ArrowRight'});act(()=>jest.advanceTimersByTime(250));
  expect(parseFloat(fly.style.left)).toBeGreaterThan(parseFloat(initial));
  fireEvent(window,new Event('blur'));const stopped=fly.style.left;act(()=>jest.advanceTimersByTime(200));expect(fly.style.left).toBe(stopped);
  const input=view.getByRole('textbox');fireEvent.keyDown(input,{key:'ArrowLeft'});act(()=>jest.advanceTimersByTime(200));expect(fly.style.left).toBe(stopped);
  const nearY=parseFloat(fly.style.top),nearSize=parseFloat(fly.style.width);
  fireEvent.keyDown(document,{key:'r'});act(()=>jest.advanceTimersByTime(2000));fireEvent.keyUp(document,{key:'r'});
  expect(fly).toHaveAttribute('data-wing-view','back');expect(Number(fly.dataset.depth)).toBeGreaterThan(.14);expect(fly.style.zIndex).toBe('4');
  expect(parseFloat(fly.style.top)).toBeLessThan(nearY);expect(parseFloat(fly.style.width)).toBeLessThan(nearSize);
  fireEvent.keyDown(document,{key:'f'});act(()=>jest.advanceTimersByTime(2000));fireEvent.keyUp(document,{key:'f'});
  expect(fly).toHaveAttribute('data-wing-view','front');expect(fly.style.zIndex).toBe('11');
  // Timer windows can differ by one RAF tick; the inverse projection itself
  // is checked to twelve decimal places in sceneDepth.test.ts.
  expect(Math.abs(Number(fly.dataset.depth)-.06)).toBeLessThan(.005);expect(Math.abs(parseFloat(fly.style.top)-nearY)).toBeLessThan(1.5);
  fireEvent.keyDown(document,{key:'Escape'});expect(view.queryByRole('button',{name:'Controlled dragonfly'})).toBeNull();expect(jest.getTimerCount()).toBe(0);
  view.rerender(fixture(2));await act(async()=>{});expect(view.getByRole('button',{name:'Controlled dragonfly'})).toBeInTheDocument();
  fireEvent.click(view.getByRole('button',{name:'Remove dragonfly'}));
  act(()=>jest.advanceTimersByTime(100));expect(jest.getTimerCount()).toBe(0);view.unmount();
});

test('distant arrow movement is much smaller on both axes and the bottom follows water depth',()=>{
  for(const key of ['arrowright','arrowdown']){
    const near=visitor(),far=visitor();near.flight.y=far.flight.y=.3;far.flight.z=.8;
    stepControlledDragonfly(near,new Set([key]),.2,800,600);
    stepControlledDragonfly(far,new Set([key]),.2,800,600);
    const axis=key==='arrowright'?'x':'y',origin=axis==='x'?.5:.3;
    expect(far.flight[axis]-origin).toBeGreaterThan(0);
    expect(far.flight[axis]-origin).toBeLessThan((near.flight[axis]-origin)*.05);
  }
  expect(flightMovementScale(.98)).toBeGreaterThan(.015);expect(flightMovementScale(.98)).toBeLessThan(.03);
  for(const horizon of [.42,.5,.555])for(const z of [0,.06,.14,.5,.98]){
    const fly=visitor();fly.flight.z=z;fly.flight.y=flightBottom(z,horizon)-.001;
    for(let n=0;n<100;n++)stepControlledDragonfly(fly,new Set(['arrowdown']),.05,800,600,horizon);
    expect(fly.flight.y).toBeCloseTo(flightBottom(z,horizon),12);
    if(z===0)expect(fly.flight.y).toBe(1);
    if(z===.98)expect(fly.flight.y-horizon).toBeLessThan(.025);
  }
});

test('depth controls stop one unit before scenery from either side and allow steering around it',()=>{
  const fly=visitor();fly.flight.x=.1;fly.flight.y=.3;fly.flight.z=.13;
  const solid=(x:number)=>x<.48;
  for(let n=0;n<100;n++)stepControlledDragonfly(fly,new Set(['r']),.05,800,600,.5,solid);
  expect(fly.flight.z).toBeCloseTo(.139,12);expect(fly.flight.behindForeground).toBe(false);expect(fly.flight.vz).toBe(0);
  stepControlledDragonfly(fly,new Set(['arrowright']),4,800,600,.5,solid);
  stepControlledDragonfly(fly,new Set(['r']),1,800,600,.5,solid);
  expect(fly.flight.z).toBeGreaterThan(.14);
  fly.flight.x=.1;fly.flight.y=.3;fly.flight.z=.3;
  for(let n=0;n<100;n++)stepControlledDragonfly(fly,new Set(['f']),.05,800,600,.5,solid);
  expect(fly.flight.z).toBeCloseTo(.141,12);expect(fly.flight.behindForeground).toBe(true);
});
