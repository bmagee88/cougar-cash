import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { SPECIES } from '../engine/config';
import { seededRandom } from '../engine/encounters';
import { fishCheckRows, makeFishCheck } from '../engine/fishChecks';
import { beginRetrieve, retrieveKey, tickRetrieve } from '../engine/interactive';
import { cast, tick, triggerBite } from '../engine/game';
import { DEFAULT_TACKLE } from '../engine/tackle';
import { FishingConditions, GameState } from '../engine/types';
import FishCheckInspector from '../components/FishCheckInspector';

declare const test:any,expect:any,jest:any;
const c:FishingConditions={season:'summer',period:'morning',moonPhase:'full',weather:'sunny',tackle:DEFAULT_TACKLE};
const retrieve=()=>beginRetrieve(0,seededRandom(7)) as Extract<GameState,{phase:'retrieving'}>;

test('diagnostic rows sum to the actual no-fish, nibble and bite probabilities with grass promotion',()=>{
  [false,true].forEach(grass=>{
    const rows=fishCheckRows(c,.12,grass);
    expect(rows.reduce((sum,row)=>sum+row.chance,0)).toBeCloseTo(1,12);
    expect(rows.reduce((sum,row)=>sum+row.candidateChance,0)).toBeCloseTo(1,12);
    expect(rows.reduce((sum,row)=>sum+row.bite,0)).toBeCloseTo(.12*.4,12);
    expect(rows.reduce((sum,row)=>sum+row.nibble,0)).toBeCloseTo(.12*.6,12);
    if(grass){expect(rows.filter(row=>SPECIES.find(f=>f.id===row.speciesId)!.rarity==='Common').every(row=>row.candidateChance===0)).toBe(true);}
  });
});
test('recording checks consumes no extra random numbers and preserves gameplay outcomes',()=>{
  const a=retrieve(),b=retrieve();const first=a.retrieve.typing.phrase[0];
  const plain=retrieveKey(a,first,200,seededRandom(3),{},c);
  const inspected=retrieveKey(b,first,200,seededRandom(3),{},c,true);
  const {check,...same}=inspected;
  expect(same).toEqual(plain);expect(check!.source).toBe('letter');expect(check!.rolls!.contact).toBeDefined();
  expect(plain.check).toBeUndefined();
  const idle=tickRetrieve(retrieve(),5000,()=>.99,{},c,true);
  expect(idle.check).toMatchObject({source:'dead-stick',outcome:'none',elapsedMs:5000});
});
test('nibble decisions expose the retained candidate and exact conversion draw',()=>{
  const state=retrieve();state.retrieve.nibble={speciesId:'bluegill',resolvesAt:7500,grass:true};
  const result=tickRetrieve(state,7500,()=>.99,{},c,true);
  expect(result.check).toMatchObject({source:'nibble',outcome:'nibble-lost',speciesId:'bluegill',rolls:{bite:.99}});
  expect(result.check!.rows.filter(row=>row.candidateChance>0).map(row=>row.speciesId)).toEqual(['bluegill']);
  const moved=retrieveKey(state,state.retrieve.typing.phrase[0],1000,()=>0,{},c,true);
  expect(moved.check).toMatchObject({source:'nibble',outcome:'nibble-lost',contactChance:0});
});
test('Standard and forced developer bites record the real filtered species table',()=>{
  const standard=cast({phase:'idle'},0,()=>0,c);
  const waiting=tick(standard,850);
  const bite=triggerBite(waiting,20000,seededRandom(11),{rarity:'Rare'},c,true);
  expect(bite.check!.source).toBe('standard');
  expect(bite.check!.rows.filter(row=>row.chance>0).map(row=>row.speciesId)).toEqual(['walleye','pike']);
  const forced=triggerBite(retrieve(),500,seededRandom(2),{speciesId:'bass'},c,true,true);
  expect(forced.check).toMatchObject({source:'forced',forced:true,contactChance:1,noFish:0,speciesId:'bass'});
});
test('inspector renders the check table, lets the player enable lure pulses and clear history',()=>{
  const check=makeFishCheck({at:2500,source:'letter',conditions:c,outcome:'none',contactChance:.1,noFish:.9,rows:fishCheckRows(c,.1),cursor:4,reeled:.2,grass:false,rhythm:'steady',rolls:{contact:.5}});
  const clear=jest.fn(),show=jest.fn();
  render(<FishCheckInspector checks={[check]} clear={clear} show={false} onShow={show} />);
  expect(screen.getByText(/No fish \/ lost nibble 90\.000%/)).toBeInTheDocument();
  expect(screen.getByText(/contact draw = 0.500000/)).toBeInTheDocument();
  expect(screen.getByRole('table')).toHaveTextContent('Bluegill');
  fireEvent.click(screen.getByRole('checkbox',{name:'Show checks at the lure'}));expect(show).toHaveBeenCalledWith(true);
  fireEvent.click(screen.getByRole('button',{name:'Clear check history'}));expect(clear).toHaveBeenCalled();
});
