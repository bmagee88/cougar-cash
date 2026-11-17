import React,{useState} from 'react';
import {fireEvent,render,screen} from '@testing-library/react';
import HostSetup,{HostBossChoice} from './HostSetup';
import {TypingBossId,TypingBossMode} from './types';
declare const test:any,expect:any,jest:any;
const bosses:HostBossChoice[]=[{id:'emberWhelp',name:'Ember Whelp',difficulty:'easy',hp:900,attackIntervalMs:24000,color:'orange',description:'A small dragon.',image:'/ember.png'},
  {id:'infernalDragon',name:'Ancient Red Dragon',difficulty:'hard',hp:1550,attackIntervalMs:12000,color:'red',description:'A mighty dragon.',image:'/dragon.png'}];

test('host can choose a dragon, name and mode before creating the lobby',()=>{
  const create=jest.fn();
  function Harness(){
    const [bossId,setBossId]=useState<TypingBossId>('emberWhelp'),[mode,setMode]=useState<TypingBossMode>('proportional'),[name,setName]=useState('My battle');
    return <HostSetup bosses={bosses} bossId={bossId} onBossChange={setBossId} mode={mode} onModeChange={setMode} name={name} onNameChange={setName}
      onCreate={()=>create({bossId,mode,name})} busy={false} error=""/>;
  }
  render(<Harness/>);
  fireEvent.change(screen.getByLabelText('Boss type'),{target:{value:'infernalDragon'}});
  expect(screen.getByRole('button',{name:'Ancient Red Dragon'}).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button',{name:/Classic quiz battle/}));
  expect(screen.getByText(/155,000 HP · 12 second charge/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Game name'),{target:{value:'Friday raid'}});
  fireEvent.click(screen.getByRole('button',{name:'Create lobby'}));
  expect(create).toHaveBeenCalledWith({bossId:'infernalDragon',mode:'old',name:'Friday raid'});
  fireEvent.change(screen.getByLabelText('Game name'),{target:{value:'  '}});
  expect((screen.getByRole('button',{name:'Create lobby'}) as HTMLButtonElement).disabled).toBe(true);
});

test('pending room creation disables choices and shows failures',()=>{
  render(<HostSetup bosses={bosses} bossId="emberWhelp" onBossChange={()=>{}} mode="proportional" onModeChange={()=>{}}
    name="Raid" onNameChange={()=>{}} onCreate={()=>{}} busy error="Please try again."/>);
  expect((screen.getByRole('button',{name:'Creating your lobby...'}) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button',{name:'Ancient Red Dragon'}) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole('alert').textContent).toContain('Please try again.');
});
