import React from 'react';
import {fireEvent,render,screen} from '@testing-library/react';
import {BattleMenu} from './TypingBossApp';
declare const test:any,expect:any,jest:any;
jest.mock('react-router-dom',()=>({Link:'a'}),{virtual:true});
test('battle controls collapse when the countdown starts and reopen on rematch setup',()=>{
  const view=render(<BattleMenu status="setup"><button>Start</button></BattleMenu>);
  expect(screen.getByRole('button',{name:'Battle menu'}).getAttribute('aria-expanded')).toBe('true');
  view.rerender(<BattleMenu status="active"><button>Close room</button></BattleMenu>);
  expect(screen.getByRole('button',{name:'Battle menu'}).getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(screen.getByRole('button',{name:'Battle menu'}));
  expect(screen.getByRole('button',{name:'Battle menu'}).getAttribute('aria-expanded')).toBe('true');
  view.rerender(<BattleMenu status="setup"><button>Start</button></BattleMenu>);
  expect(screen.getByRole('button',{name:'Battle menu'}).getAttribute('aria-expanded')).toBe('true');
});
