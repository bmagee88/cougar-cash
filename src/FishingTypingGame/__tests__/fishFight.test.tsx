import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { generateEncounter, seededRandom } from '../engine/encounters';
import { cast, tick, typeKey } from '../engine/game';
import { beginFight, fightGap, fightTension, FIGHT_PERSONAS, lineContactFactor, readLineGear, tickFight, fightKey } from '../engine/fishFight';
import { beginRetrieve, hookRetrieve, retrieveKey } from '../engine/interactive';
import { createTyping } from '../engine/typing';
import { deserializeSave, emptySave } from '../engine/storage';
import { DEFAULT_TACKLE } from '../engine/tackle';
import { FishingConditions, GameState } from '../engine/types';
import { nextWake } from '../engine/nextWake';
import FishFightChallenge from '../components/FishFightChallenge';
declare const test:any,expect:any,jest:any;
const c:FishingConditions={season:'summer',period:'morning',moonPhase:'full',weather:'sunny',tackle:DEFAULT_TACKLE};
type Battle=Extract<GameState,{phase:'typing'}>;
const encounter=(speciesId='bass',weightKg=3)=>({...generateEncounter(seededRandom(9),{speciesId},c),weightKg});
function battle(typed='quiet water',testLb=10):Battle{
  const state=beginFight(encounter(),{...createTyping('quiet water beneath the willow',0),typed},{testLb,spoolM:300,wordCheckpoint:false},0,()=>.5);
  state.fight!.jolt={ability:'run',remaining:10,intervalMs:500,nextAt:500,endsAt:6000};
  return state;
}
test('Fish Fight casts an untimed haiku and keeps its text and player progress at the bite',()=>{
  const casted=cast({phase:'idle'},0,()=>.5,{...c,fightOptions:{testLb:6,spoolM:225,wordCheckpoint:true}},'fish-fight');
  let retrieving=tick(casted,900,()=>.99,{},c) as Extract<GameState,{phase:'retrieving'}>;
  expect(retrieving.retrieve.fight).toEqual({testLb:6,spoolM:225,wordCheckpoint:true});
  const phrase=retrieving.retrieve.typing.phrase;
  retrieving=typeKey(retrieving,phrase[0],1000,()=>.99,{},c) as typeof retrieving;
  const hooked=hookRetrieve(retrieving,1100,()=>.5,{},c,'pike') as Battle;
  expect(hooked.typing.phrase).toBe(phrase);expect(hooked.encounter.phrase).toBe(phrase);
  expect(hooked.typing.typed).toBe(phrase[0]);expect(hooked.typing.deadline).toBe(Infinity);
  expect(hooked.fight!.testLb).toBe(6);expect(nextWake(hooked,1100,true)).toBe(1200);
});
test('fish pulls one character at a time, changes actual reel progress and backspace releases tension',()=>{
  const state=battle(),pulled=tickFight(state,500,()=>.5) as Battle;
  expect(pulled.fight!.fishCursor).toBe(state.typing.typed.length-1);
  expect(fightTension(pulled.typing,pulled.fight!)).toBe(.1);
  const eased=fightKey(pulled,'Backspace',510,()=>.5) as Battle;
  expect(fightGap(eased.typing,eased.fight!)).toBe(0);
  const extra=fightKey(eased,'Backspace',520,()=>.5) as Battle;
  expect(extra.typing.typed.length).toBe(state.typing.typed.length-2);
  expect(extra.fight!.fishCursor).toBe(extra.typing.typed.length);
  expect(fightGap(extra.typing,extra.fight!)).toBe(0);
});
test('jolt ending reunites the cursors and restores slack; a full phrase waits for slack to land',()=>{
  const state=battle();state.fight!.jolt!.remaining=0;state.fight!.jolt!.nextAt=100;state.fight!.fishCursor=8;
  const rested=tickFight(state,100,()=>.5) as Battle;
  expect(rested.fight!.jolt).toBeUndefined();expect(rested.fight!.fishCursor).toBe(rested.typing.typed.length);
  expect(fightTension(rested.typing,rested.fight!)).toBe(0);
  const complete=battle();complete.typing.typed=complete.typing.phrase;complete.fight!.fishCursor=complete.typing.typed.length;
  expect(tickFight(complete,100,()=>.5).phase).toBe('typing');
  complete.fight!.jolt!.remaining=0;complete.fight!.jolt!.nextAt=200;
  const landed=tickFight(complete,200,()=>.5);
  expect(landed.phase).toBe('landing');if(landed.phase==='landing')expect(Number.isFinite(landed.performance.timeRemaining)).toBe(true);
});
test('snap threshold is exactly gap divided by lb test and losses are bounded by the remaining spool',()=>{
  const thin=battle('quiet water',6);thin.fight!.fishCursor=6;
  expect(fightTension(thin.typing,thin.fight!)).toBeCloseTo(5/6);
  const snapped=tickFight(thin,500,()=>.5);
  expect(snapped).toMatchObject({phase:'result',outcome:'escaped',reason:'line-snapped',lineTestLb:6,lineLossM:30});
  const strong=battle('quiet water',20);strong.fight!.fishCursor=6;
  expect(tickFight(strong,500,()=>.5).phase).toBe('typing');
  const short=beginFight(encounter(),createTyping('calm lake',0),{testLb:6,spoolM:7,wordCheckpoint:false},0,()=>.5);
  expect(short.fight!.castLengthM).toBe(7);
  expect(cast({phase:'idle'},0,()=>0,{...c,fightOptions:{testLb:6,spoolM:4,wordCheckpoint:false}},'fish-fight').phase).toBe('idle');
});
test('word checkpoints prevent crossing the player current word even as the player types into the next word',()=>{
  let state=battle('quiet wa');state.fight!.wordCheckpoint=true;state.fight!.fishCursor=6;
  state=tickFight(state,500,()=>.5) as Battle;expect(state.fight!.fishCursor).toBe(6);
  for(const [i,key] of Array.from('ter ').entries())state=fightKey(state,key,510+i,()=>.5) as Battle;
  expect(state.typing.typed).toBe('quiet water ');expect(state.fight!.fishCursor).toBe(12);
  const free=battle('quiet wa');free.fight!.fishCursor=6;
  expect((tickFight(free,500,()=>.5) as Battle).fight!.fishCursor).toBe(5);
});
test('weight and temperament vary stamina, jolts consume it, and recovery is one point per three seconds',()=>{
  const make=(weight:number,r:number)=>beginFight(encounter('pike',weight),createTyping('quiet water',0),{testLb:50,spoolM:300,wordCheckpoint:false},0,()=>r);
  expect(make(10,.5).fight!.maxStamina).toBeGreaterThan(make(1,.5).fight!.maxStamina);
  expect(make(3,.99).fight!.temperament).toBeGreaterThan(make(3,0).fight!.temperament);
  const state=battle();state.fight!.stamina=4;
  const pulled=tickFight(state,500,()=>.5) as Battle;
  expect(pulled.fight!.stamina).toBeCloseTo(4+.5/3-.9);
  let resting=make(3,.5);resting.fight!.stamina=1;resting.fight!.nextJoltAt=10000;
  for(let at=100;at<=3000;at+=100)resting=tickFight(resting,at,()=>.5) as Battle;
  expect(resting.fight!.stamina).toBeCloseTo(2);
});
test('every species has a probability table and every sampled ability keeps a manageable backward speed',()=>{
  const rng=seededRandom(6),abilities=new Set<string>();
  Object.entries(FIGHT_PERSONAS).forEach(([id,persona])=>{
    expect(Object.values(persona.abilities).reduce((a,b)=>a+b,0)).toBe(100);
    for(let n=0;n<100;n++){
      const state=beginFight(encounter(id,10),createTyping('quiet water',0),{testLb:50,spoolM:300,wordCheckpoint:false},0,rng);
      state.fight!.nextJoltAt=0;
      const started=tickFight(state,100,rng) as Battle,jolt=started.fight!.jolt!;
      expect(jolt.intervalMs).toBeGreaterThanOrEqual(300);expect(jolt.remaining).toBeLessThanOrEqual(20);abilities.add(jolt.ability);
    }
  });
  expect(abilities.size).toBe(4);
});
test('light line generates more contacts and saved line settings migrate safely',()=>{
  expect(lineContactFactor(6)).toBeGreaterThan(lineContactFactor(50));
  const start=beginRetrieve(0,()=>.99,DEFAULT_TACKLE,1,{testLb:6,spoolM:300,wordCheckpoint:false}) as Extract<GameState,{phase:'retrieving'}>;
  const light=retrieveKey(start,start.retrieve.typing.phrase[0],1000,()=>.99,{},c,true);
  const heavy=retrieveKey({...start,retrieve:{...start.retrieve,fight:{...start.retrieve.fight!,testLb:50}}},start.retrieve.typing.phrase[0],1000,()=>.99,{},c,true);
  expect(light.check!.contactChance).toBeGreaterThan(heavy.check!.contactChance);
  const save=emptySave();save.settings.fishingMode='fish-fight';save.settings.wordCheckpoint=true;
  save.lineGear={equipped:6,spools:{6:0,10:123}};
  const loaded=deserializeSave(JSON.stringify(save));expect(loaded.settings.wordCheckpoint).toBe(true);expect(loaded.settings.fishingMode).toBe('fish-fight');
  expect(loaded.lineGear!.spools[6]).toBe(0);expect(loaded.lineGear!.spools[10]).toBe(123);expect(loaded.lineGear!.spools[50]).toBe(300);
  expect(readLineGear({equipped:999,spools:{6:-10,10:Infinity}})).toMatchObject({equipped:10,spools:{6:0,10:300}});
});
test('suspended tabs do not replay an entire hidden jolt on returning',()=>{
  const state=battle(),resumed=tickFight(state,60000,()=>.5) as Battle;
  expect(resumed.fight!.fishCursor).toBe(state.fight!.fishCursor);
  expect(resumed.fight!.jolt!.nextAt).toBe(60500);
});
test('fight UI shows two cursors, highlights only the tension gap, accepts backspace, and clears highlights at rest',()=>{
  const state=battle();state.fight!.fishCursor=8;const key=jest.fn(),ready=jest.fn();
  const view=render(<FishFightChallenge typing={state.typing} fight={state.fight!} onKey={key} onReady={ready} onRelease={()=>{}}/>);
  expect(ready).toHaveBeenCalledTimes(1);expect(view.container.querySelectorAll('.f-fish-caret')).toHaveLength(1);
  expect(view.container.querySelectorAll('.f-char-tension')).toHaveLength(3);
  expect(screen.getByRole('progressbar',{name:'Line tension'})).toHaveAttribute('value','0.3');
  fireEvent.keyDown(screen.getByRole('textbox'),{key:'Backspace'});expect(key).toHaveBeenCalledWith('Backspace');
  view.rerender(<FishFightChallenge typing={state.typing} fight={{...state.fight!,jolt:undefined,fishCursor:state.typing.typed.length}} onKey={key} onReady={ready} onRelease={()=>{}}/>);
  expect(view.container.querySelectorAll('.f-char-tension')).toHaveLength(0);
});
