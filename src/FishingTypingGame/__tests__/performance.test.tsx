import React from 'react';
import { act, fireEvent, render, renderHook } from '@testing-library/react';
import { nextWake } from '../engine/nextWake';
import { beginRetrieve } from '../engine/interactive';
import { seededRandom } from '../engine/encounters';
import { BALANCE } from '../engine/config';
import { emptySave, SAVE_KEY } from '../engine/storage';
import { useFishingGame } from '../useFishingGame';
import { useWorldClock } from '../useWorldClock';
import { useWeatherVisuals } from '../useWeatherVisuals';
import { GameState } from '../engine/types';
import { drawRain } from '../scene/RainCanvas';
import CloudSystem from '../scene/CloudSystem';
import { weatherVisuals } from '../engine/weather';
import TypingChallenge from '../components/TypingChallenge';
import { createTyping } from '../engine/game';

declare const test:any,expect:any,jest:any,afterEach:any;
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('idle play schedules no rule checks; casting and waiting wake only at deadlines', () => {
  jest.useFakeTimers('modern');
  Object.defineProperty(document,'hidden',{configurable:true,value:false});
  const save=emptySave(); save.settings.fishingMode='standard'; localStorage.setItem(SAVE_KEY,JSON.stringify(save));
  const conditions=jest.fn(()=>({season:'summer' as const,period:'morning' as const,moonPhase:'full' as const,weather:'sunny' as const}));
  const random=jest.spyOn(Math,'random').mockReturnValue(.99);
  const hook=renderHook(()=>useFishingGame(conditions));
  act(()=>jest.advanceTimersByTime(10000)); expect(conditions).not.toHaveBeenCalled(); expect(jest.getTimerCount()).toBe(0);
  act(()=>hook.result.current.castLine());
  const state=hook.result.current.game as Extract<GameState,{phase:'casting'}>;
  expect(jest.getTimerCount()).toBe(1);
  act(()=>jest.advanceTimersByTime(BALANCE.castMs)); expect(hook.result.current.game.phase).toBe('waiting');
  expect(conditions).toHaveBeenCalledTimes(1);
  act(()=>jest.advanceTimersByTime(state.biteAt-performance.now()+1)); expect(hook.result.current.game.phase).toBe('typing');
  expect(conditions).toHaveBeenCalledTimes(2);
  hook.unmount(); expect(jest.getTimerCount()).toBe(0); random.mockRestore();
});

test('retrieve wake times retain one-second pauses, five-second dead sticks and nibble deadlines', () => {
  const state=beginRetrieve(100,seededRandom(4)) as Extract<GameState,{phase:'retrieving'}>;
  expect(nextWake(state,100,false)).toBe(1100);
  expect(nextWake(state,1100,false)).toBe(5100);
  const nibble={...state,retrieve:{...state.retrieve,nibble:{speciesId:'bluegill',grass:true,resolvesAt:7400}}};
  expect(nextWake(nibble,5100,false)).toBe(7400);
  expect(nextWake({phase:'idle'},0,false)).toBeUndefined();
});

test('hidden challenges expire by their original deadline when the tab becomes visible', () => {
  jest.useFakeTimers('modern'); Object.defineProperty(document,'hidden',{configurable:true,value:false});
  const save=emptySave(); save.settings.fishingMode='standard'; localStorage.setItem(SAVE_KEY,JSON.stringify(save)); jest.spyOn(Math,'random').mockReturnValue(0);
  const hook=renderHook(()=>useFishingGame(()=>({season:'summer',period:'morning',moonPhase:'full'})));
  act(()=>hook.result.current.castLine()); act(()=>jest.advanceTimersByTime(30000));
  act(()=>hook.result.current.armChallenge()); expect(hook.result.current.game.phase).toBe('typing');
  Object.defineProperty(document,'hidden',{configurable:true,value:true}); fireEvent(document,new Event('visibilitychange'));
  act(()=>jest.advanceTimersByTime(11000)); expect(hook.result.current.game.phase).toBe('typing');
  Object.defineProperty(document,'hidden',{configurable:true,value:false}); fireEvent(document,new Event('visibilitychange'));
  expect(hook.result.current.game.phase).toBe('result'); hook.unmount(); expect(jest.getTimerCount()).toBe(0);
});

test('clock and weather props stay stable across typing-only rerenders', () => {
  jest.useFakeTimers('modern');
  const world=renderHook(()=>useWorldClock()), weather=renderHook(()=>useWeatherVisuals('sunny'));
  const beforeWorld=world.result.current,beforeWeather=weather.result.current;
  world.rerender(); weather.rerender(); expect(world.result.current).toBe(beforeWorld); expect(weather.result.current).toBe(beforeWeather);
  act(()=>jest.advanceTimersByTime(1000)); expect(world.result.current).not.toBe(beforeWorld);
  world.unmount(); weather.unmount(); expect(jest.getTimerCount()).toBe(0);
});

test('deferred cloud decks retain outgoing art until fading completes and reverse safely', () => {
  jest.useFakeTimers('modern');
  const view=render(<CloudSystem visuals={weatherVisuals('sunny')} />);
  expect(view.container.querySelector('[data-cloud-type="rain"]')).toBeNull();
  const clear=view.container.querySelector('[data-cloud-type="cirrus"]');
  view.rerender(<CloudSystem visuals={weatherVisuals('rain')} />);
  expect(view.container.querySelector('[data-cloud-type="cirrus"]')).toBe(clear);
  act(()=>jest.advanceTimersByTime(8000)); view.rerender(<CloudSystem visuals={weatherVisuals('sunny')} />);
  expect(view.container.querySelector('[data-cloud-type="cirrus"]')).toBe(clear);
  act(()=>jest.advanceTimersByTime(16001)); expect(view.container.querySelector('[data-cloud-type="rain"]')).toBeNull();
  view.unmount(); expect(jest.getTimerCount()).toBe(0);
});

test('canvas storms retain rain depth and lake impacts without per-drop DOM elements', () => {
  for(const [weather,drops,rings] of [['thunderstorm',480,64],['hurricane',760,96]] as const){
    const context={clearRect:jest.fn(),beginPath:jest.fn(),moveTo:jest.fn(),lineTo:jest.fn(),stroke:jest.fn(),ellipse:jest.fn()} as unknown as CanvasRenderingContext2D;
    drawRain(context,1920,1080,1400,weather);
    expect(context.lineTo).toHaveBeenCalledTimes(drops); expect(context.ellipse).toHaveBeenCalledTimes(rings);
    expect(context.clearRect).toHaveBeenCalledWith(0,0,1920,1080); expect(context.globalAlpha).toBe(1);
  }
});

test('countdown updates without replacing the phrase and cleans up its clock', () => {
  jest.useFakeTimers('modern'); const typing=createTyping('quiet water',performance.now());
  const view=render(<TypingChallenge typing={typing} onKey={()=>{}} onReady={()=>{}} />);
  const phrase=view.container.querySelector('.f-phrase');
  act(()=>jest.advanceTimersByTime(1300)); expect(view.getByRole('progressbar')).toHaveAttribute('aria-valuenow','8.7');
  expect(view.container.querySelector('.f-phrase')).toBe(phrase);
  view.unmount(); expect(jest.getTimerCount()).toBe(0);
});
