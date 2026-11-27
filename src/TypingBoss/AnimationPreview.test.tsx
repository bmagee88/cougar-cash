import React from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import AnimationPreview from './AnimationPreview';
declare const test:any,expect:any,jest:any,afterEach:any;
jest.mock('react-router-dom',()=>({Link:'a'}),{virtual:true});
jest.mock('./TypingBossApp',()=>({BattleScene:()=> <div data-testid="preview-battlefield"/>,PlayerTypingBattle:()=>null}));
afterEach(()=>jest.useRealTimers());

test('the Wyrm preview freezes the chosen frame after an attack ends at both display sizes',()=>{
  jest.useFakeTimers();jest.setSystemTime(1000);
  render(<AnimationPreview/>);
  fireEvent.click(screen.getByRole('button',{name:'Critical hurt'}));
  fireEvent.click(screen.getByRole('checkbox',{name:'Inspect Wyrm frames'}));
  fireEvent.change(screen.getByRole('slider',{name:'Wyrm animation frame'}),{target:{value:4}});
  act(()=>jest.advanceTimersByTime(10000));
  for(const sprite of screen.getAllByTestId('wyrm-animation')){
    expect(sprite.getAttribute('data-sprite-row')).toBe('10');
    const frames=sprite.querySelector('.wyrm-frames') as HTMLElement;
    expect(frames.style.animationName).toBe('none');expect(frames.style.backgroundPositionX).toBe('60%');
  }
  expect(screen.getAllByTestId('wyrm-contact-frame')).toHaveLength(6);
});

test('full Overrun replay retains its offscreen wait and ground eruption',()=>{
  jest.useFakeTimers();jest.setSystemTime(1000);render(<AnimationPreview/>);
  fireEvent.click(screen.getByRole('button',{name:'Overrun · full 8s sequence'}));
  act(()=>jest.advanceTimersByTime(2010));
  expect(screen.getAllByTestId('wyrm-animation')[0].getAttribute('data-animation')).toBe('offscreen');
  act(()=>jest.advanceTimersByTime(3500));
  expect(screen.getAllByTestId('wyrm-animation')[0].getAttribute('data-animation')).toBe('emerge');
  act(()=>jest.advanceTimersByTime(2500));
  expect(screen.getAllByTestId('wyrm-animation')[0].getAttribute('data-animation')).toBe('idle');
  fireEvent.click(screen.getByRole('checkbox',{name:'Show full battlefield'}));
  expect(screen.getByTestId('preview-battlefield')).toBeTruthy();
});

test('all animation groups are accessible without a live room',()=>{
  render(<AnimationPreview/>);
  fireEvent.click(screen.getByRole('button',{name:'Dragons'}));expect(screen.getByRole('checkbox',{name:'Inspect dragon frames'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Heroes'}));expect(screen.getByRole('checkbox',{name:'Kneeling heroes'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Zombie summons'}));expect(screen.getByRole('button',{name:'Resurrection'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Kraken'}));expect(screen.getByRole('button',{name:'Inspect impact frame'})).toBeTruthy();
});
