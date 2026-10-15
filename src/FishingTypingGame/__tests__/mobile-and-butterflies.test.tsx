import React, { createRef, useState } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import PromptInput from '../components/PromptInput';
import ButterflyVisitors from '../scene/ButterflyVisitors';
import { butterflyActivity, butterflyCount } from '../scene/butterflies';
import { Season, Weather, WEATHERS } from '../engine/types';

declare const test:any,expect:any,jest:any;

test('phone input, correction and composition use the same validated key path as desktop',()=>{
 const keys=jest.fn();
 function Harness(){const [value,setValue]=useState('');return <PromptInput value={value} label="Type the haiku" onKey={key=>{keys(key);setValue(previous=>key==='Backspace'?previous.slice(0,-1):previous+key);}}/>;}
 const view=render(<Harness/>),input=view.getByRole('textbox');
 fireEvent.input(input,{target:{value:'lake'},inputType:'insertText',data:'lake'});expect(input).toHaveValue('lake');expect(keys.mock.calls.flat()).toEqual(['l','a','k','e']);
 fireEvent.change(input,{target:{value:'lak'}});expect(keys).toHaveBeenLastCalledWith('Backspace');
 fireEvent.keyDown(input,{key:'e'});expect(input).toHaveValue('lake');expect(keys).toHaveBeenCalledTimes(6);
 fireEvent.compositionStart(input);fireEvent.change(input,{target:{value:'lake mist'}});expect(keys).toHaveBeenCalledTimes(6);
 fireEvent.compositionEnd(input,{data:' mist',target:{value:'lake mist'}});expect(input).toHaveValue('lake mist');expect(keys).toHaveBeenCalledTimes(11);
 fireEvent.paste(input,{clipboardData:{getData:()=> 'a whole poem'}});expect(keys).toHaveBeenCalledTimes(11);
 fireEvent.keyDown(input,{key:'Unidentified',keyCode:229});fireEvent.change(input,{target:{value:'lake mists'}});expect(keys).toHaveBeenCalledTimes(12);
});

test('butterfly visits favor spring, are rare in fall, and never occur in winter, night or storms',()=>{
 expect(butterflyActivity('spring',12,'sunny')).toBeGreaterThan(butterflyActivity('summer',12,'sunny'));
 expect(butterflyActivity('summer',12,'sunny')).toBeGreaterThan(butterflyActivity('autumn',12,'sunny'));
 WEATHERS.forEach(weather=>expect(butterflyActivity('winter',12,weather)).toBe(0));
 (['spring','summer','autumn'] as Season[]).forEach(season=>[0,2,6,18,22].forEach(hour=>expect(butterflyActivity(season,hour,'sunny')).toBe(0)));
 (['rain','wind','thunderstorm','hurricane','snowfall','blizzard'] as Weather[]).forEach(weather=>expect(butterflyActivity('spring',12,weather)).toBe(0));
 expect(butterflyActivity('spring',12,'overcast')).toBeGreaterThan(0);
 expect(butterflyCount(()=>.3)).toBe(1);expect(butterflyCount(()=>.8)).toBe(2);expect(butterflyCount(()=>.99)).toBe(3);
});

test('visits use animated canvases, remove caught individuals, and respect winter and reduced motion',()=>{
 jest.useFakeTimers();
 try{
  const bounds=jest.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue({x:0,y:0,left:0,top:0,right:400,bottom:640,width:400,height:640,toJSON:()=>({})} as DOMRect);
  const sceneRef=createRef<HTMLDivElement>();
  const onObserve=jest.fn(),props={sceneRef,season:'spring' as Season,hour:12,weather:'sunny' as Weather,location:'dock',reducedMotion:false,onObserve};
  const view=render(<div ref={sceneRef}><ButterflyVisitors {...props}/></div>);
  view.rerender(<div ref={sceneRef}><ButterflyVisitors {...props} preview={1}/></div>);
  const visits=view.getAllByTestId('butterfly-visitor');expect(visits).toHaveLength(2);
  fireEvent.click(view.getAllByRole('button',{name:'Observe butterfly'})[0]);expect(onObserve).toHaveBeenCalledWith(visits[0],visits[0].getAttribute('data-visitor-species'),Number(visits[0].getAttribute('data-wingspan-mm')));
  expect(visits[0].querySelector('canvas.f-butterfly-flight')).toBeTruthy();
  expect(view.getAllByTestId('butterfly-visitor')).toHaveLength(1);
  view.rerender(<div ref={sceneRef}><ButterflyVisitors {...props} season="winter" preview={2}/></div>);expect(view.queryByTestId('butterfly-visitor')).toBeNull();
  view.rerender(<div ref={sceneRef}><ButterflyVisitors {...props} reducedMotion preview={3}/></div>);expect(view.queryByTestId('butterfly-visitor')).toBeNull();
  view.unmount();expect(jest.getTimerCount()).toBe(0);bounds.mockRestore();
 }finally{jest.useRealTimers();}
});
