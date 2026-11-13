import React from 'react';
import {act,render,screen} from '@testing-library/react';
import TeamActivityCue from './TeamActivityCue';
declare const test:any,expect:any,jest:any;
test('team cues show only new actual activity and expire without shifting layout',()=>{
  jest.useFakeTimers();
  try {
    const view=render(<TeamActivityCue activity={{damage:100,healing:20,revives:0}}/>);
    expect(screen.getByRole('status').textContent).toBe('');
    view.rerender(<TeamActivityCue activity={{damage:140,healing:30,revives:1}}/>);
    expect(screen.getByRole('status').textContent).toMatch(/Team dealt 40 damage.*Team healed 10 HP.*Team revived 1/);
    act(()=>jest.advanceTimersByTime(1500));expect(screen.getByRole('status').textContent).toBe('');
    view.unmount();
  } finally {jest.useRealTimers();}
});
