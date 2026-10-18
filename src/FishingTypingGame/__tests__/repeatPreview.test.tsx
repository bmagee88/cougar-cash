import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import RepeatPreviewButton from '../components/RepeatPreviewButton';
import DebugPanel from '../components/DebugPanel';

declare const test:any,expect:any,jest:any,beforeEach:any,afterEach:any;
beforeEach(()=>jest.useFakeTimers());
afterEach(()=>{jest.restoreAllMocks();jest.useRealTimers();});

test('enabling spawns immediately and every ten seconds; disabling cancels repeats',()=>{
  const trigger=jest.fn(),view=render(<RepeatPreviewButton onTrigger={trigger}>Spawn bird</RepeatPreviewButton>);
  const button=view.getByRole('button',{name:'Spawn bird'});
  expect(button).toHaveAttribute('aria-pressed','false');fireEvent.click(button);
  expect(trigger).toHaveBeenCalledTimes(1);expect(button).toHaveAttribute('aria-pressed','true');
  act(()=>jest.advanceTimersByTime(9999));expect(trigger).toHaveBeenCalledTimes(1);
  act(()=>jest.advanceTimersByTime(1));expect(trigger).toHaveBeenCalledTimes(2);
  act(()=>jest.advanceTimersByTime(20000));expect(trigger).toHaveBeenCalledTimes(4);
  fireEvent.click(button);expect(button).toHaveAttribute('aria-pressed','false');
  act(()=>jest.advanceTimersByTime(30000));expect(trigger).toHaveBeenCalledTimes(4);
  expect(jest.getTimerCount()).toBe(0);
});

test('parent renders use the latest callback without restarting the ten-second clock',()=>{
  const first=jest.fn(),latest=jest.fn(),view=render(<RepeatPreviewButton onTrigger={first}>Preview</RepeatPreviewButton>);
  fireEvent.click(view.getByRole('button'));
  act(()=>jest.advanceTimersByTime(9000));view.rerender(<RepeatPreviewButton onTrigger={latest}>Preview</RepeatPreviewButton>);
  act(()=>jest.advanceTimersByTime(1000));expect(first).toHaveBeenCalledTimes(1);expect(latest).toHaveBeenCalledTimes(1);
  view.unmount();expect(jest.getTimerCount()).toBe(0);
});

test('eligibility changes stop and reset an active toggle, with no automatic restart',()=>{
  const trigger=jest.fn(),view=render(<RepeatPreviewButton onTrigger={trigger}>Preview</RepeatPreviewButton>);
  fireEvent.click(view.getByRole('button'));
  view.rerender(<RepeatPreviewButton onTrigger={trigger} disabled>Preview</RepeatPreviewButton>);
  expect(view.getByRole('button')).toBeDisabled();expect(view.getByRole('button')).toHaveAttribute('aria-pressed','false');
  act(()=>jest.advanceTimersByTime(20000));expect(trigger).toHaveBeenCalledTimes(1);
  view.rerender(<RepeatPreviewButton onTrigger={trigger}>Preview</RepeatPreviewButton>);
  act(()=>jest.advanceTimersByTime(20000));expect(trigger).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

test('every entity spawn control and lightning preview repeats independently',()=>{
  const wildlife=jest.fn(),lightning=jest.fn(),butterfly=jest.fn();
  const view=render(<DebugPanel season="spring" period="late-night" weather="thunderstorm" overrides={{}} worldOverrides={{}}
    onChange={jest.fn()} biteNow={jest.fn()} canBite={false} onAnimation={jest.fn()} onWeather={jest.fn()}
    onWildlifePreview={wildlife} onLightningPreview={lightning} onButterflyPreview={butterfly}/>);
  const buttons=view.getAllByRole('button').filter(button=>button.hasAttribute('aria-pressed'));
  expect(buttons).toHaveLength(10);buttons.forEach(button=>fireEvent.click(button));
  expect(wildlife).toHaveBeenCalledTimes(8);expect(lightning).toHaveBeenCalledTimes(1);expect(butterfly).toHaveBeenCalledTimes(1);
  act(()=>jest.advanceTimersByTime(10000));
  for(const kind of ['santa','odonates','geese','splashes','treeBirds','treeFlock','controlledDragonfly','treeFlyby']){
    expect(wildlife.mock.calls.filter(([value]:string[])=>value===kind)).toHaveLength(2);
  }
  expect(lightning).toHaveBeenCalledTimes(2);expect(butterfly).toHaveBeenCalledTimes(2);
  view.unmount();expect(jest.getTimerCount()).toBe(0);
});
