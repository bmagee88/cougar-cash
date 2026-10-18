import React, { createRef } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { createFlight } from '../scene/butterflyFlight';
import { DragonflyDirection, stepDragonflyView } from '../scene/dragonflyView';
import * as odonateFlight from '../scene/odonateFlight';
import ButterflyVisitors from '../scene/ButterflyVisitors';
import NotebookIllustration from '../components/NotebookIllustration';
import { blankEntry, saveNotebookEntry } from '../engine/notebook';
import { deserializeSave, emptySave } from '../engine/storage';
import { visitorAsset, visitorSheet } from '../engine/visitors';

declare const test:any,expect:any,jest:any,afterEach:any;
afterEach(()=>{jest.restoreAllMocks();jest.useRealTimers();});
const flight=(vx:number,vy=0,vz=0)=>({...createFlight(()=>.5),age:1,vx,vy,vz,perch:undefined});
function settle(state:DragonflyDirection,f:ReturnType<typeof flight>) {
  for(let n=0;n<12;n++)state=stepDragonflyView(state,f,1/60);
  return state;
}

test('dominant motion selects all four views, including depth and backward travel',()=>{
  expect(stepDragonflyView(undefined,flight(180,40,.1),.02).view).toBe('right');
  expect(stepDragonflyView(undefined,{...flight(-180),facing:1},.02).view).toBe('left');
  expect(stepDragonflyView(undefined,flight(10,0,.5),.02).view).toBe('back');
  expect(stepDragonflyView(undefined,flight(10,0,-.5),.02).view).toBe('front');
  expect(stepDragonflyView(undefined,flight(10,-80),.02).view).toBe('back');
  expect(stepDragonflyView(undefined,flight(10,80),.02).view).toBe('front');
  // Follow the actual turn, not a new target velocity the insect has not reached.
  expect(stepDragonflyView(undefined,{...flight(-200),motionVx:160},.02).view).toBe('right');
});

test('diagonal jitter, hovering and perching hold the view; sustained turns change it promptly',()=>{
  let state:DragonflyDirection={view:'right'};
  for(let n=0;n<90;n++)state=stepDragonflyView(state,flight(100,n%2?108:96),1/60);
  expect(state.view).toBe('right');
  state=stepDragonflyView(state,flight(0,100),.05);expect(state.view).toBe('right');
  state=stepDragonflyView(state,flight(0,100),.05);expect(state.view).toBe('right');
  state=stepDragonflyView(state,flight(0,100),.05);expect(state.view).toBe('front');
  state=settle(state,flight(-2,1,.01));expect(state.view).toBe('front');
  const perched={...flight(-200),perch:{landed:true,finished:false}} as any;
  expect(settle(state,perched).view).toBe('front');
  state=settle(state,flight(0,-100));expect(state.view).toBe('back');
  state=settle(state,flight(-200));expect(state.view).toBe('left');
});

test('front and rear journal poses survive saving and select matching artwork',()=>{
  for(const direction of ['front','back'] as const){
    const pose={view:direction,frame:6,rotation:0,flipped:false};
    const entry=blankEntry(direction,new Date().toISOString(),'dock',{kind:'visitor',speciesId:'green-darner',pose});
    const saved=saveNotebookEntry(emptySave(),entry.id,{},entry);
    const image=deserializeSave(JSON.stringify(saved)).notebook![0].image!;
    expect(image.kind==='visitor'&&image.pose).toEqual(pose);
    const view=render(<NotebookIllustration image={image} units="metric"/>);
    expect(view.getByAltText('The visitor you observed')).toHaveAttribute('src',visitorAsset('green-darner',6,direction));
    expect(view.getByAltText('The visitor you observed')).toHaveAttribute('data-wing-view',direction);view.unmount();
  }
  expect(visitorAsset('ebony-jewelwing',2,'front')).toBe(visitorAsset('ebony-jewelwing',2));
});

test('live canvas follows vectors, falls back while rear art loads, and catches the displayed pose',async()=>{
  jest.useFakeTimers();
  jest.spyOn(document,'hidden','get').mockReturnValue(false);
  jest.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:800,height:600} as DOMRect);
  const context={clearRect:jest.fn(),save:jest.fn(),restore:jest.fn(),translate:jest.fn(),rotate:jest.fn(),scale:jest.fn(),drawImage:jest.fn()};
  jest.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context as any);
  let rearImage:any;
  jest.spyOn(window,'Image').mockImplementation(function(){
    const image:any={};Object.defineProperty(image,'src',{get:()=>image.url,set:(url:string)=>{
      image.url=url;if(url.includes('back-flight'))rearImage=image;else image.onload?.();
    }});return image;
  } as any);
  let vector={vx:0,vy:0,vz:-.6};
  jest.spyOn(odonateFlight,'stepOdonate').mockImplementation((f,kind,dt)=>{
    Object.assign(f,vector,{age:Math.max(0,f.age)+dt,motionVx:vector.vx,motionVy:vector.vy,wingFrame:6,perch:undefined});
  });
  const sceneRef=createRef<HTMLDivElement>(),observe=jest.fn();
  const view=render(<div ref={sceneRef}><ButterflyVisitors sceneRef={sceneRef} family="odonates" season="summer" hour={12} weather="sunny" location="dock" reducedMotion={false} preview={1} onObserve={observe}/></div>);
  await act(async()=>{});act(()=>jest.advanceTimersByTime(250));
  const dragonfly=view.getByRole('button',{name:'Observe dragonfly'});
  expect(dragonfly).toHaveAttribute('data-wing-view','front');
  expect(context.drawImage).toHaveBeenCalledWith(expect.objectContaining({url:visitorSheet('green-darner','front')}),576,0,96,112,-48,-56,96,112);
  vector={vx:0,vy:0,vz:.6};act(()=>jest.advanceTimersByTime(250));
  expect(dragonfly).toHaveAttribute('data-wing-view','dorsal');
  await act(async()=>rearImage.onload());
  expect(dragonfly).toHaveAttribute('data-wing-view','back');
  vector={vx:-200,vy:0,vz:0};act(()=>jest.advanceTimersByTime(250));
  expect(dragonfly).toHaveAttribute('data-flight-direction','left');
  vector={vx:200,vy:0,vz:0};act(()=>jest.advanceTimersByTime(250));
  expect(dragonfly).toHaveAttribute('data-flight-direction','right');
  vector={vx:0,vy:0,vz:.6};act(()=>jest.advanceTimersByTime(250));
  fireEvent.click(dragonfly);
  expect(observe).toHaveBeenCalledWith(dragonfly,'green-darner',expect.any(Number),{view:'back',frame:6,rotation:0,flipped:false});
  view.unmount();expect(jest.getTimerCount()).toBe(0);
});
