import { BALANCE } from './config';
import { castDistance, generateEncounter } from './encounters';
import { biteWaitRange } from './feeding';
import { normalizeTackle } from './tackle';
import { EncounterOverrides, FishingConditions, FishingMode, GameState, Random } from './types';
import { beginRetrieve, defaultRetrieveConditions, hookRetrieve, retrieveConditions, retrieveKey, tickRetrieve } from './interactive';

import { createTyping, applyKey, typingPerformance } from './typing';
import { fishCheckRows, makeFishCheck } from './fishChecks';
export { createTyping, applyKey, typingPerformance } from './typing';
export function cast(state: GameState, now: number, random: Random = Math.random, conditions?: FishingConditions, mode: FishingMode = 'standard'): GameState {
  if (state.phase !== 'idle') return state;
  const waitAt = now + BALANCE.castMs;
  const waitRange = biteWaitRange(conditions);
  return { phase: 'casting', mode, castDistance: castDistance(conditions?.weather), waitAt, biteAt: waitAt + waitRange[0] + random() * (waitRange[1] - waitRange[0]), waitRange,
    ...(conditions?.tackle ? { tackle: normalizeTackle(conditions.tackle) } : {}) };
}
export function triggerBite(state: GameState, now: number, random: Random = Math.random, overrides: EncounterOverrides = {}, conditions?: FishingConditions, inspect = false, forced = false): GameState {
  if (state.phase === 'retrieving') {
    const c=retrieveConditions(state,now,conditions ?? defaultRetrieveConditions);const result=hookRetrieve(state,now,random,overrides,c);
    return inspect && result.phase==='typing' ? {...result,check:makeFishCheck({at:now,source:'forced',conditions:c,outcome:'bite',contactChance:1,noFish:0,rows:fishCheckRows(c,1,false,overrides,1),speciesId:result.encounter.species.id,cursor:state.retrieve.maxReeled,reeled:state.retrieve.maxReeled/state.retrieve.typing.phrase.length,grass:false,rhythm:state.retrieve.rhythm,forced:true})} : result;
  }
  if (state.phase !== 'waiting' && state.phase !== 'casting') return state;
  const c=conditions && state.tackle ? { ...conditions, tackle: state.tackle } : conditions;
  const draws:number[]=[];const rng=inspect ? ()=>{const value=random();draws.push(value);return value;} : random;
  const encounter = generateEncounter(rng, { ...overrides, castDistance: state.castDistance }, c);
  return { phase: 'typing', encounter: { ...encounter, castDistance: state.castDistance ?? encounter.castDistance }, typing: createTyping(encounter.phrase, now),
    ...(inspect ? {check:makeFishCheck({at:now,source:forced ? 'forced' : 'standard',conditions:c ?? defaultRetrieveConditions,outcome:'bite',contactChance:1,noFish:0,rows:fishCheckRows(c ?? defaultRetrieveConditions,1,false,overrides,1),speciesId:encounter.species.id,rolls:overrides.speciesId ? {} : {species:draws[0]},forced:forced || !!overrides.speciesId || !!overrides.rarity})} : {}) };
}
export function tick(state: GameState, now: number, random: Random = Math.random, overrides: EncounterOverrides = {}, conditions?: FishingConditions, inspect = false): GameState {
  if (state.phase === 'casting' && now >= state.waitAt) return state.mode === 'interactive' ? beginRetrieve(now,random,state.tackle,state.castDistance) : now >= state.biteAt ? triggerBite(state, now, random, overrides, conditions,inspect) : { phase: 'waiting', biteAt: state.biteAt, tackle: state.tackle, waitRange: state.waitRange, castDistance: state.castDistance };
  if (state.phase === 'retrieving') return tickRetrieve(state,now,random,overrides,conditions ?? defaultRetrieveConditions,inspect);
  if (state.phase === 'waiting' && now >= state.biteAt) return triggerBite(state, now, random, overrides, conditions,inspect);
  if (state.phase === 'typing' && now >= state.typing.deadline) return { phase: 'result', outcome: 'escaped', performance: typingPerformance(state.typing, now) };
  if (state.phase === 'landing' && now >= state.resultAt) return { phase: 'result', outcome: 'caught', encounter: state.encounter, performance: state.performance };
  return state;
}
export function typeKey(state: GameState, key: string, now: number, random: Random = Math.random, overrides: EncounterOverrides = {}, conditions?: FishingConditions, inspect = false): GameState {
  if (state.phase === 'retrieving') return retrieveKey(state,key,now,random,overrides,conditions ?? defaultRetrieveConditions,inspect);
  if (state.phase !== 'typing') return state;
  if (now >= state.typing.deadline) return tick(state, now);
  const typing = applyKey(state.typing, key, now);
  if (typing.finishedAt !== undefined) return { phase: 'landing', encounter: state.encounter, performance: typingPerformance(typing, now), resultAt: now + BALANCE.landingMs };
  return typing === state.typing ? state : { ...state, typing };
}
