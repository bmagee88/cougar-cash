import React,{useState} from 'react';
import {fireEvent,render,screen,within} from '@testing-library/react';
import CharacterSelect from './CharacterSelect';
import {TypingBossClassId} from './types';
declare const test:any,expect:any,jest:any;

test('choosing a class updates the preview and joins with the chosen hero and prefilled room',()=>{
  const join=jest.fn();
  function Harness(){
    const [classId,setClassId]=useState<TypingBossClassId>('cleric'),[code,setCode]=useState('4A8'),[name,setName]=useState('CalmFox');
    return <CharacterSelect classId={classId} onClassChange={setClassId} code={code} onCodeChange={setCode} name={name}
      onShuffle={()=>setName('KindOwl')} onJoin={()=>join({classId,code,name})} busy={false} error="" canJoin={code.length===3}/>;
  }
  render(<Harness/>);
  expect(screen.getAllByRole('button',{pressed:true})).toHaveLength(1);
  fireEvent.click(screen.getByRole('button',{name:'Necromancer'}));
  expect(screen.getByRole('button',{name:'Necromancer'}).getAttribute('aria-pressed')).toBe('true');
  expect(within(screen.getByRole('complementary',{name:'Your hero and room'})).getByRole('heading',{name:'Necromancer'})).toBeTruthy();
  expect((screen.getByLabelText('Session code') as HTMLInputElement).value).toBe('4A8');
  fireEvent.click(screen.getByRole('button',{name:'Shuffle name'}));
  fireEvent.click(screen.getByRole('button',{name:'Join the battle'}));
  expect(join).toHaveBeenCalledWith({classId:'necromancer',code:'4A8',name:'KindOwl'});
});

test('joining and character changes are disabled while the request is pending',()=>{
  const onClassChange=jest.fn();
  render(<CharacterSelect classId="cleric" onClassChange={onClassChange} code="4A8" onCodeChange={()=>{}} name="CalmFox"
    onShuffle={()=>{}} onJoin={()=>{}} busy error="" canJoin/>);
  expect((screen.getByRole('button',{name:'Joining your party...'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Rogue'}));
  expect(onClassChange).not.toHaveBeenCalled();
});
