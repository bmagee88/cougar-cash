import React from 'react';
import {act,render,screen} from '@testing-library/react';
import RetreatNotice from './RetreatNotice';
import {TypingBossPlayer} from './types';
declare const test:any,expect:any,jest:any;
test('names newly retreated teammates and does not repeat notices on combat updates',()=>{
  jest.useFakeTimers();
  try {
    const players=[{code:'a',name:'Alex',timedOut:false},{code:'b',name:'Blair',timedOut:false}] as TypingBossPlayer[];
    const view=render(<RetreatNotice players={players}/>);
    expect(screen.queryByRole('alert')).toBeNull();
    const updated=players.map(player=>({...player,timedOut:player.code==='b'}));
    view.rerender(<RetreatNotice players={updated}/>);
    expect(screen.getByRole('alert').textContent).toContain('Blair has retreated');
    act(()=>jest.advanceTimersByTime(6500));
    act(()=>jest.advanceTimersByTime(500));
    view.rerender(<RetreatNotice players={updated.map(player=>({...player,hp:50}))}/>);
    expect(screen.queryByRole('alert')).toBeNull();
    view.unmount();
  } finally {jest.useRealTimers();}
});
