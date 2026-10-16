import { BALANCE } from './config';
import { applyKey, typingPerformance } from './typing';
import { Encounter, FightOptions, FishFightState, GameState, LineGear, Random, TypingState } from './types';

export const LINE_TESTS=[6,10,15,20,30,50] as const;
export const SPOOL_LENGTH_M=300;
export function readLineGear(raw?:LineGear):LineGear {
  const equipped=LINE_TESTS.includes(raw?.equipped as any)?raw!.equipped:10;
  return {equipped,spools:Object.fromEntries(LINE_TESTS.map(lb=>{
    const value=raw?.spools?.[lb];
    return [lb,typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(SPOOL_LENGTH_M,value)):SPOOL_LENGTH_M];
  }))};
}
export const lineContactFactor=(testLb:number)=>Math.max(.45,Math.min(1.45,Math.sqrt(10/testLb)));
type Ability='tap'|'burst'|'run'|'surge';
// Fictional game balance: species personalities overlap through temperament.
export const FIGHT_PERSONAS:Record<string,{power:number;rest:[number,number];abilities:Record<Ability,number>}>= {
  bluegill:{power:.65,rest:[3,5],abilities:{tap:65,burst:25,run:8,surge:2}},
  perch:{power:.75,rest:[2.5,5],abilities:{tap:45,burst:40,run:10,surge:5}},
  crappie:{power:.8,rest:[3,6],abilities:{tap:40,burst:20,run:35,surge:5}},
  bass:{power:1.2,rest:[2.5,4.5],abilities:{tap:15,burst:45,run:15,surge:25}},
  walleye:{power:1.1,rest:[3,6],abilities:{tap:25,burst:15,run:50,surge:10}},
  pike:{power:1.45,rest:[2.5,5],abilities:{tap:10,burst:35,run:25,surge:30}},
  muskie:{power:1.6,rest:[3,5.5],abilities:{tap:5,burst:25,run:30,surge:40}},
  sturgeon:{power:1.5,rest:[4,7],abilities:{tap:10,burst:10,run:65,surge:15}},
};
const ABILITIES:Record<Ability,{distance:[number,number];interval:[number,number];cost:number}>={
  tap:{distance:[1,3],interval:[500,800],cost:.7},
  burst:{distance:[3,6],interval:[300,500],cost:1},
  run:{distance:[5,10],interval:[650,1000],cost:.9},
  surge:{distance:[4,8],interval:[400,650],cost:1.2},
};
const between=(r:Random,a:number,b:number)=>a+r()*(b-a);
export const fightGap=(typing:TypingState,fight:FishFightState)=>fight.jolt?Math.max(0,typing.typed.length-fight.fishCursor):0;
export const fightTension=(typing:TypingState,fight:FishFightState)=>fightGap(typing,fight)/fight.testLb;
export const wordStart=(typing:TypingState)=>typing.phrase.lastIndexOf(' ',Math.max(-1,typing.typed.length-1))+1;
export function beginFight(encounter:Encounter,typing:TypingState,options:FightOptions,now:number,random:Random):Extract<GameState,{phase:'typing'}> {
  const temperament=between(random,.65,1.4),maxStamina=8+Math.sqrt(encounter.weightKg)*9*temperament;
  return {phase:'typing',encounter:{...encounter,phrase:typing.phrase},typing:{...typing,deadline:Infinity,finishedAt:undefined},
    fight:{...options,fishCursor:typing.typed.length,stamina:maxStamina,maxStamina,temperament,lastAt:now,nextJoltAt:now+1800,
      castLengthM:Math.min(options.spoolM,30*(encounter.castDistance??1))}};
}
const performanceFor=(typing:TypingState,now:number)=>({...typingPerformance(typing,now),timeRemaining:0});
type Battle=Extract<GameState,{phase:'typing'}>;
export function tickFight(state:Battle,now:number,random:Random):GameState {
  if(!state.fight)return state;
  const old=state.fight,delta=Math.max(0,now-old.lastAt);
  // Pause fights while a tab is suspended; never replay a hidden burst at once.
  if(delta>1000)return {...state,fight:{...old,lastAt:now,nextJoltAt:old.nextJoltAt+delta,
    jolt:old.jolt?{...old.jolt,nextAt:old.jolt.nextAt+delta,endsAt:old.jolt.endsAt+delta}:undefined}};
  const f:FishFightState={...old,lastAt:now,stamina:Math.min(old.maxStamina,old.stamina+delta/3000),jolt:old.jolt?{...old.jolt}:undefined};
  const persona=FIGHT_PERSONAS[state.encounter.species.id]??FIGHT_PERSONAS.bass;
  if(!f.jolt&&now>=f.nextJoltAt&&f.stamina>=.7){
    let roll=random()*100;
    const ability=(Object.keys(persona.abilities) as Ability[]).find(key=>(roll-=persona.abilities[key])<0)??'tap';
    const a=ABILITIES[ability],strength=persona.power*f.temperament*(.7+Math.log2(1+state.encounter.weightKg)*.25);
    const distance=Math.max(1,Math.min(20,Math.round(between(random,...a.distance)*strength)));
    // At most 3.3 backward characters/sec, even on the strongest individual.
    const intervalMs=Math.max(300,between(random,...a.interval)/Math.sqrt(f.temperament));
    f.jolt={ability,remaining:distance,intervalMs,nextAt:now+intervalMs,endsAt:now+(distance+1)*intervalMs};
    f.fishCursor=state.typing.typed.length;
  }
  if(f.jolt){
    const j=f.jolt,cost=ABILITIES[j.ability as Ability].cost;
    const floor=f.wordCheckpoint?wordStart(state.typing):0;
    f.fishCursor=Math.max(floor,Math.min(f.fishCursor,state.typing.typed.length));
    if(now>=j.nextAt&&j.remaining>0&&f.stamina>=cost){
      f.fishCursor=Math.max(floor,Math.min(f.fishCursor,state.typing.typed.length)-1);
      j.remaining--;j.nextAt=now+j.intervalMs;f.stamina=Math.max(0,f.stamina-cost);
    }
    if(fightTension(state.typing,f)>=1)return {phase:'result',outcome:'escaped',reason:'line-snapped',lineLossM:f.castLengthM,lineTestLb:f.testLb,performance:performanceFor(state.typing,now)};
    if(now>=j.endsAt||f.stamina<cost||(j.remaining===0&&now>=j.nextAt)){
      f.jolt=undefined;f.fishCursor=state.typing.typed.length;
      f.nextJoltAt=now+between(random,...persona.rest)*1000/f.temperament;
    }
  }else f.fishCursor=state.typing.typed.length;
  if(state.typing.typed===state.typing.phrase&&!f.jolt)return {phase:'landing',encounter:state.encounter,performance:performanceFor({...state.typing,finishedAt:now},now),resultAt:now+BALANCE.landingMs};
  return {...state,fight:f};
}
export function fightKey(state:Battle,key:string,now:number,random:Random):GameState {
  if(key!=='Backspace'&&(key.length!==1||! /^[\x20-\x7e]$/.test(key)))return state;
  const advanced=tickFight(state,now,random);
  if(advanced.phase!=='typing'||!advanced.fight)return advanced;
  const typing={...applyKey({...advanced.typing,finishedAt:undefined},key,now),finishedAt:undefined};
  const fight={...advanced.fight,fishCursor:advanced.fight.jolt?Math.min(advanced.fight.fishCursor,typing.typed.length):typing.typed.length};
  return tickFight({...advanced,typing,fight},now,random);
}
