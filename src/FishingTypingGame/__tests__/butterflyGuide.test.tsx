import React, { createRef } from 'react';
import { act, fireEvent, render, within } from '@testing-library/react';
import { BUTTERFLIES, butterflyDisplayWidth, butterflyWingspan, chooseButterfly, discoverButterfly, eligibleButterflies } from '../engine/butterflies';
import { deserializeSave, emptySave } from '../engine/storage';
import { blankEntry, deleteNotebookEntry, saveNotebookEntry } from '../engine/notebook';
import FieldGuide, { guideDiscoveries } from '../components/FieldGuide';
import ButterflyVisitors from '../scene/ButterflyVisitors';
import { Season, Weather, WEATHERS } from '../engine/types';

declare const test:any,expect:any,jest:any;

test('all fourteen species have bounded wingspans and share one relative display scale',()=>{
  expect(BUTTERFLIES).toHaveLength(14);expect(new Set(BUTTERFLIES.map(species=>species.id)).size).toBe(14);
  BUTTERFLIES.forEach(species=>{
    expect(butterflyWingspan(species,()=>0)).toBe(species.wingspanMm[0]);
    expect(butterflyWingspan(species,()=>1)).toBe(species.wingspanMm[1]);
    expect(species.wingspanMm[0]).toBeGreaterThan(0);expect(species.wingspanMm[1]).toBeGreaterThan(species.wingspanMm[0]);
  });
  expect(butterflyDisplayWidth(90)/butterflyDisplayWidth(30)).toBeCloseTo(3);
  expect(BUTTERFLIES.find(species=>species.id==='american-copper')!.wingspanMm).toEqual([22,35]);
  expect(BUTTERFLIES.find(species=>species.id==='giant-swallowtail')!.wingspanMm).toEqual([85,140]);
});

test('luna and night moths never occur in daylight, clearwings fly by day, and winter and storms exclude visitors',()=>{
  [7,12,17.99].forEach(hour=>{
    const species=eligibleButterflies('summer',hour,'sunny');
    expect(species.every(item=>item.active==='day')).toBe(true);
    expect(species.some(item=>item.id==='hummingbird-clearwing')).toBe(true);
    expect(species.some(item=>item.id==='luna-moth')).toBe(false);
  });
  [0,5.99,18,23.99].forEach(hour=>{
    const species=eligibleButterflies('summer',hour,'sunny');
    expect(species.every(item=>item.active==='night')).toBe(true);
    expect(species.some(item=>item.id==='luna-moth')).toBe(true);
    expect(chooseButterfly(()=>0,'summer',hour,'sunny')!.id).toBe('luna-moth');
  });
  expect(eligibleButterflies('summer',6,'sunny')).toEqual([]);
  WEATHERS.forEach(weather=>expect(eligibleButterflies('winter',22,weather)).toEqual([]));
  (['rain','wind','thunderstorm','hurricane','snowfall','blizzard'] as Weather[]).forEach(weather=>expect(eligibleButterflies('summer',22,weather)).toEqual([]));
});

test('guide unlocks survive reload, duplicate encounters and notebook deletion without affecting fish or rewards',()=>{
  const original=emptySave(),discovered=discoverButterfly(original,'luna-moth');
  expect(discovered.butterflyDiscoveries).toEqual(['luna-moth']);expect(discoverButterfly(discovered,'luna-moth')).toBe(discovered);
  expect(discoverButterfly(discovered,'unknown')).toBe(discovered);
  expect(discovered.stats).toBe(original.stats);expect(discovered.balance).toBe(original.balance);expect(discovered.livewell).toBe(original.livewell);
  const entry=blankEntry('moth',new Date().toISOString(),'dock',{kind:'butterfly',speciesId:'luna-moth',wingspanMm:90});
  const recorded=saveNotebookEntry(discovered,entry.id,{title:'Moonlit visitor'},entry);
  expect(deserializeSave(JSON.stringify(recorded)).notebook![0].image).toEqual(entry.image);
  expect(deserializeSave(JSON.stringify(deleteNotebookEntry(recorded,entry.id))).butterflyDiscoveries).toEqual(['luna-moth']);
  expect(deserializeSave(JSON.stringify({...original,butterflyDiscoveries:['luna-moth','unknown','luna-moth',12]})).butterflyDiscoveries).toEqual(['luna-moth']);
});

test('fish and butterfly tabs reveal three life-stage images only for discovered species',()=>{
  const save=discoverButterfly(emptySave(),'monarch'),view=render(<FieldGuide discoveries={guideDiscoveries(save)}/>);
  expect(view.getByRole('tab',{name:'Fish · 0/8'})).toHaveAttribute('aria-selected','true');
  fireEvent.click(view.getByRole('tab',{name:'Butterflies · 1/14'}));
  const monarch=view.getByRole('article',{name:'Monarch'});
  expect(within(monarch).getAllByRole('img')).toHaveLength(3);
  expect(within(monarch).getByRole('img',{name:'Monarch: chrysalis'})).toBeInTheDocument();
  expect(view.getAllByRole('article',{name:'Undiscovered butterfly or moth'})).toHaveLength(13);
  expect(view.queryByRole('heading',{name:'Luna moth'})).not.toBeInTheDocument();
  expect(within(monarch).getByText(/Wingspan 86–124 mm/)).toBeInTheDocument();
});

test('night visitors carry species and measured size, and disappear at sunrise',()=>{
  jest.useFakeTimers();
  const random=jest.spyOn(Math,'random').mockReturnValue(0);
  const bounds=jest.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue({x:0,y:0,left:0,top:0,right:400,bottom:640,width:400,height:640,toJSON:()=>({})} as DOMRect);
  try{
    const sceneRef=createRef<HTMLDivElement>(),observe=jest.fn();
    const props={sceneRef,season:'spring' as Season,hour:22,weather:'sunny' as Weather,location:'dock',reducedMotion:false,onObserve:observe};
    const view=render(<div ref={sceneRef}><ButterflyVisitors {...props}/></div>);
    act(()=>jest.advanceTimersByTime(8100));
    const visitor=view.getByRole('button',{name:'Observe butterfly'});
    expect(visitor).toHaveAttribute('data-visitor-species','luna-moth');expect(visitor).toHaveAttribute('data-wingspan-mm','75');
    expect(visitor.querySelector('canvas.f-butterfly-flight')).toBeTruthy();
    fireEvent.click(visitor);expect(observe).toHaveBeenCalledWith(visitor,'luna-moth',75);
    view.rerender(<div ref={sceneRef}><ButterflyVisitors {...props} hour={6}/></div>);
    expect(view.queryByRole('button',{name:'Observe butterfly'})).toBeNull();view.unmount();
  }finally{random.mockRestore();bounds.mockRestore();jest.useRealTimers();}
});
