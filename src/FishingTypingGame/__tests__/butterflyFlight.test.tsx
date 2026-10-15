import React, { createRef } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { createFlight, FLIGHT_BOUNDS, FOREGROUND_DEPTH, MAX_FLIGHT_DEPTH, flightExpired, flightScale, isPerched, paintedPixelAt, planPerch, startleFlight, stepFlight, stepPerchedWings } from '../scene/butterflyFlight';
import ButterflyVisitors from '../scene/ButterflyVisitors';

declare const test:any,expect:any,jest:any;
const rect={x:0,y:0,left:0,top:0,right:800,bottom:600,width:800,height:600,toJSON:()=>({})} as DOMRect;
const pointer=(x:number,y:number,speed=0,previousX=x,previousY=y)=>({x,y,speed,previousX,previousY});

test('perched butterflies keep their footing while alternating wing poses, then depart or flee',()=>{
  const flight={...createFlight(()=>.5),x:.3,y:.7,z:.3};
  planPerch(flight,.3,.7,()=>.5);flight.perch!.startAt=0;
  stepFlight(flight,.02,800,600,()=>.5);expect(isPerched(flight)).toBe(true);
  const frames=new Set<number>();
  for(let i=0;i<250;i++){stepFlight(flight,.02,800,600,()=>.6);frames.add(flight.perch!.frame);}
  expect(frames.size).toBeGreaterThan(4);expect(flight.x).toBe(.3);expect(flight.y).toBe(.7);expect(flight.z).toBe(.3);
  expect(startleFlight(flight,pointer(240,420),800,600)).toBe(true);expect(isPerched(flight)).toBe(false);
  stepFlight(flight,.05,800,600,()=>.5);expect(flight.x).not.toBe(.3);
  const departed={...createFlight(()=>.5),x:.3,y:.7};planPerch(departed,.3,.7,()=>.5);departed.perch!.startAt=0;
  stepFlight(departed,.02,800,600,()=>.5);departed.perch!.remaining=.01;
  stepFlight(departed,.02,800,600,()=>.5);expect(isPerched(departed)).toBe(false);
  const distant={...createFlight(()=>.5),behindForeground:true,z:1.5};planPerch(distant,.3,.7,()=>.5);distant.perch!.startAt=0;
  stepFlight(distant,.02,800,600,()=>.5);expect(isPerched(distant)).toBe(false);expect(distant.z).toBeGreaterThan(1.05);
});

test('perch wing timing includes both quick flutters and slower opening and closing',()=>{
  const flight=createFlight(()=>.5);planPerch(flight,.3,.7,()=>.5);
  const fast={...flight.perch!,fast:true,nextFrameIn:0},slow={...flight.perch!,fast:false,nextFrameIn:0};
  stepPerchedWings(fast,.01,()=>.9);stepPerchedWings(slow,.01,()=>.9);
  expect(fast.nextFrameIn).toBeLessThan(slow.nextFrameIn);
  stepPerchedWings(fast,.1,()=>.9);stepPerchedWings(slow,.1,()=>.9);
  expect(fast.frame).toBe(2);expect(slow.frame).toBe(1);
});

test('flights enter from either side at speed, can return from outside the view, and retire beyond the doubled scene',()=>{
  [0,.99].forEach(roll=>{
    const flight=createFlight(()=>roll),start=flight.x;
    expect(start<0||start>1).toBe(true);
    for(let i=0;i<30;i++)stepFlight(flight,1/60,800,600,()=>.5);
    expect(flight.x).toBeGreaterThan(0);expect(flight.x).toBeLessThan(1);
    expect(Math.abs(flight.x-start)*800).toBeGreaterThan(65);
  });
  const returning={...createFlight(()=>.5),x:1.2,y:.4,turnIn:0};
  expect(flightExpired(returning)).toBe(false);
  for(let i=0;i<120;i++)stepFlight(returning,1/60,800,600,()=>.5);
  expect(returning.x).toBeLessThan(1);expect(flightExpired(returning)).toBe(false);
  expect(FLIGHT_BOUNDS.right-FLIGHT_BOUNDS.left).toBe(2);expect(FLIGHT_BOUNDS.bottom-FLIGHT_BOUNDS.top).toBe(2);
  expect(flightExpired({...returning,x:1.501})).toBe(true);
  expect(flightExpired({...returning,x:-.501})).toBe(true);
  const departing={...createFlight(()=>.5),x:.5,y:.4,age:60,turnIn:0,exitSide:1};
  while(!flightExpired(departing))stepFlight(departing,.02,800,600,()=>.5);
  expect(departing.x).toBeGreaterThan(1.5);expect(departing.y).toBeGreaterThan(0);expect(departing.y).toBeLessThan(1);
});

test('erratic turns change direction and distance, with a permanent foreground depth boundary',()=>{
  const flight={...createFlight(()=>.5),x:.5,y:.5,turnIn:0};
  stepFlight(flight,.02,800,600,()=>.1);const velocity=[flight.vx,flight.vy,flight.vz];
  flight.turnIn=0;stepFlight(flight,.02,800,600,()=>.9);
  expect([flight.vx,flight.vy,flight.vz]).not.toEqual(velocity);
  expect(flightScale(.1)).toBeGreaterThan(flightScale(2));
  flight.z=FOREGROUND_DEPTH-.01;flight.vz=1;flight.turnIn=10;
  stepFlight(flight,.03,800,600,()=>.5);expect(flight.behindForeground).toBe(true);
  flight.vz=-1;stepFlight(flight,.5,800,600,()=>.5);
  expect(flight.z).toBeGreaterThanOrEqual(FOREGROUND_DEPTH);expect(flight.behindForeground).toBe(true);
  flight.z=MAX_FLIGHT_DEPTH;expect(flightExpired(flight)).toBe(true);
});

test('individual tolerances allow slow approaches but react to close cursors and nearby fast swipes',()=>{
  const calm={...createFlight(()=>0),x:.5,y:.5,z:.35},sensitive={...createFlight(()=>.99),x:.5,y:.5,z:.35};
  expect(calm.closeRadius).not.toBe(sensitive.closeRadius);expect(calm.speedTolerance).not.toBe(sensitive.speedTolerance);
  expect(startleFlight(calm,pointer(404,300),800,600)).toBe(false);
  expect(startleFlight(sensitive,pointer(404,300),800,600)).toBe(true);
  const slow={...createFlight(()=>.5),x:.5,y:.5};
  expect(startleFlight(slow,pointer(450,320,30),800,600)).toBe(false);
  // The swipe crosses the butterfly even though its final point is far away.
  expect(startleFlight(slow,pointer(650,310,950,150,310),800,600)).toBe(true);
  expect(Math.abs(slow.vx)).toBeGreaterThan(400);expect(slow.vz).toBeGreaterThan(0);
  const still={...createFlight(()=>.5),x:.5,y:.5};
  expect(startleFlight(still,pointer(400,300),800,600)).toBe(true);
  const remote={...createFlight(()=>.5),x:.5,y:.5};
  expect(startleFlight(remote,pointer(700,500,1200,600,500),800,600)).toBe(false);
});

test('pixel picking maps the scaled canvas and rejects transparent pixels and its surrounding rectangle',()=>{
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=320;
  jest.spyOn(canvas,'getBoundingClientRect').mockReturnValue({...rect,left:100,top:100,width:80,height:80} as DOMRect);
  const sample=jest.fn((x:number,y:number)=>({data:[0,0,0,x===160&&y===160?255:0]}));
  jest.spyOn(canvas,'getContext').mockReturnValue({getImageData:sample} as any);
  expect(paintedPixelAt(canvas,140,140)).toBe(true);expect(sample).toHaveBeenCalledWith(160,160,1,1);
  expect(paintedPixelAt(canvas,101,101)).toBe(false);
  expect(paintedPixelAt(canvas,90,140)).toBe(false);expect(paintedPixelAt(canvas,180,140)).toBe(false);
});

test('mouse clicks fail closed while artwork loads; catching an individual does not remove the other one',()=>{
  jest.useFakeTimers();const bounds=jest.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue(rect);
  try{
    const sceneRef=createRef<HTMLDivElement>(),observe=jest.fn();
    const props={sceneRef,season:'summer' as const,hour:12,weather:'sunny' as const,location:'dock',reducedMotion:false,onObserve:observe};
    const view=render(<div ref={sceneRef}><ButterflyVisitors {...props}/></div>);
    view.rerender(<div ref={sceneRef}><ButterflyVisitors {...props} preview={1}/></div>);
    const visitor=view.getAllByRole('button',{name:'Observe butterfly'})[0];
    expect(parseFloat(visitor.style.left)<0||parseFloat(visitor.style.left)>100).toBe(true);
    fireEvent.click(visitor,{detail:1,clientX:400,clientY:300});expect(observe).not.toHaveBeenCalled();
    fireEvent.click(visitor);expect(observe).toHaveBeenCalledTimes(1);
    expect(view.getAllByRole('button',{name:'Observe butterfly'})).toHaveLength(1);
    act(()=>jest.advanceTimersByTime(100));view.unmount();expect(jest.getTimerCount()).toBe(0);
  }finally{bounds.mockRestore();jest.useRealTimers();}
});

test('loaded wing frames reject transparent clicks, accept painted clicks, and pause when hidden',async()=>{
  jest.useFakeTimers();
  const bounds=jest.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue(rect);
  const random=jest.spyOn(Math,'random').mockReturnValue(0);
  const context={clearRect:jest.fn(),save:jest.fn(),restore:jest.fn(),translate:jest.fn(),rotate:jest.fn(),scale:jest.fn(),drawImage:jest.fn(),getImageData:jest.fn((x:number,y:number)=>({data:[0,0,0,x===160&&y===160?255:0]}))};
  const canvas=jest.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context as any);
  const images=jest.spyOn(window,'Image').mockImplementation(function(){
    const image:any={onload:undefined,onerror:undefined};Object.defineProperty(image,'src',{set:()=>image.onload?.()});return image;
  } as any);
  const hidden=jest.spyOn(document,'hidden','get').mockReturnValue(false);
  try{
    const sceneRef=createRef<HTMLDivElement>(),observe=jest.fn();
    const props={sceneRef,season:'summer' as const,hour:22,weather:'sunny' as const,location:'dock',reducedMotion:false,onObserve:observe};
    const view=render(<div ref={sceneRef}><ButterflyVisitors {...props}/></div>);
    await act(async()=>view.rerender(<div ref={sceneRef}><ButterflyVisitors {...props} preview={1}/></div>));
    act(()=>jest.advanceTimersByTime(1800));
    const visitor=view.getAllByRole('button',{name:'Observe butterfly'})[0];
    expect(context.drawImage).toHaveBeenCalled();
    const before=visitor.style.left;
    hidden.mockReturnValue(true);fireEvent(document,new Event('visibilitychange'));
    act(()=>jest.advanceTimersByTime(1000));expect(visitor.style.left).toBe(before);
    hidden.mockReturnValue(false);fireEvent(document,new Event('visibilitychange'));
    act(()=>jest.advanceTimersByTime(100));expect(visitor.style.left).not.toBe(before);
    fireEvent.click(visitor,{detail:1,clientX:1,clientY:1});expect(observe).not.toHaveBeenCalled();
    const visibleFrame=Number(view.getAllByRole('button',{name:'Observe butterfly'})[1].dataset.wingFrame);
    await act(async()=>{fireEvent.click(visitor,{detail:1,clientX:400,clientY:300});});expect(observe).toHaveBeenCalledTimes(1);
    expect(observe.mock.calls[0][3]).toMatchObject({frame:visibleFrame,rotation:expect.any(Number),flipped:expect.any(Boolean)});
    expect(view.getAllByRole('button',{name:'Observe butterfly'})).toHaveLength(1);
    const remaining=view.getByRole('button',{name:'Observe butterfly'});
    random.mockReturnValue(.99);act(()=>jest.advanceTimersByTime(2600));
    expect(remaining).toHaveAttribute('data-flight-state','distant');
    const cover=document.createElement('img');cover.dataset.sceneDepth='foreground';cover.style.opacity='1';
    Object.defineProperties(cover,{complete:{value:true},naturalWidth:{value:320},naturalHeight:{value:320}});
    sceneRef.current!.appendChild(cover);
    fireEvent.click(remaining,{detail:1,clientX:400,clientY:300});expect(observe).toHaveBeenCalledTimes(1);
    cover.dataset.layer='foreground-reeds';cover.style.clipPath='inset(0 50% 0 0)';
    fireEvent.click(remaining,{detail:1,clientX:400,clientY:300});expect(observe).toHaveBeenCalledTimes(2);
    cover.remove();
    view.unmount();expect(jest.getTimerCount()).toBe(0);
  }finally{hidden.mockRestore();images.mockRestore();canvas.mockRestore();random.mockRestore();bounds.mockRestore();jest.useRealTimers();}
});
