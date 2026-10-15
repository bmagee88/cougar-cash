import React, { useRef } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { useLanternLighting } from '../scene/useLanternLighting';

declare const test:any,expect:any,jest:any;

test('local illumination follows the flame on resize, leaves distant surfaces unlit and cleans up',()=>{
  let frame:FrameRequestCallback | undefined;
  const raf=jest.spyOn(window,'requestAnimationFrame').mockImplementation((callback:FrameRequestCallback)=>{frame=callback;return 1;});
  const cancel=jest.spyOn(window,'cancelAnimationFrame').mockImplementation(()=>{});
  function Fixture({enabled}:{enabled:boolean}) {
    const ref=useRef<HTMLDivElement>(null);useLanternLighting(ref,enabled,'dock');
    return <div ref={ref}><div className="f-lantern-station"><img data-asset="lantern" alt=""/></div><img data-lantern-surface="dock" alt=""/><img data-lantern-surface="angler" alt=""/><img data-scene-depth="background" alt=""/></div>;
  }
  const view=render(<Fixture enabled/>);
  let x=100;
  const rects=jest.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){
    const rect=this.matches('[data-asset="lantern"]')?{left:x,top:200,width:20,height:30}:this.matches('.f-lantern-station')?{left:0,top:0,width:100,height:150}:{left:40,top:120,width:500,height:300};
    return {...rect,x:rect.left,y:rect.top,right:rect.left+rect.width,bottom:rect.top+rect.height,toJSON:()=>rect} as DOMRect;
  });
  try {
    act(()=>frame!(0));
    const surface=view.container.querySelector<HTMLElement>('[data-lantern-surface="dock"]')!;
    expect(surface.style.getPropertyValue('--local-light-x')).toBe('70px');
    expect(surface.style.getPropertyValue('--local-light-y')).toBe('98px');
    expect(view.container.querySelector<HTMLElement>('[data-scene-depth="background"]')!.style.length).toBe(0);
    x=180;fireEvent(window,new Event('resize'));act(()=>frame!(16));
    expect(surface.style.getPropertyValue('--local-light-x')).toBe('150px');
    view.rerender(<Fixture enabled={false}/>);raf.mockClear();
    fireEvent(window,new Event('resize'));expect(raf).not.toHaveBeenCalled();
  } finally {view.unmount();rects.mockRestore();raf.mockRestore();cancel.mockRestore();}
});
