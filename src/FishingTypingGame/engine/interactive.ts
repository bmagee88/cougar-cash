import { SPECIES } from './config';
import { generateEncounter, weighted } from './encounters';
import { biteWaitRange, fishingMultiplier } from './feeding';
import { HAIKU } from './haiku';
import { allowedRetrieves, DEFAULT_TACKLE, lureFor, normalizeTackle, tackleFactors } from './tackle';
import { applyKey, createTyping } from './typing';
import { fishCheckRows, makeFishCheck } from './fishChecks';
import { EncounterOverrides, FishingConditions, FishSpecies, GameState, Random, RARITIES, Retrieve, RetrieveRhythm, RetrieveState, TackleSetup } from './types';

export const RETRIEVE_WINDOW_MS = 5000;
export const RHYTHM_LABELS: Record<RetrieveRhythm,string> = { steady: 'Steady', jerky: 'Stop and go', 'dead-stick': 'Dead stick' };
export function classifyRetrieve(keys: readonly number[], now: number, lastKeyAt: number): RetrieveRhythm {
  if (now - lastKeyAt >= RETRIEVE_WINDOW_MS) return 'dead-stick';
  const recent = keys.filter(time => time > now - RETRIEVE_WINDOW_MS && time <= now);
  if (now - lastKeyAt >= 1000) return 'jerky';
  if (recent.length < 3) return 'steady';
  const gaps = recent.slice(1).map((time,i) => time - recent[i]);
  const mean = gaps.reduce((sum,gap) => sum+gap,0) / gaps.length;
  const variation = Math.sqrt(gaps.reduce((sum,gap) => sum+(gap-mean)**2,0)/gaps.length) / Math.max(1,mean);
  return Math.max(...gaps) >= 900 || variation > .65 ? 'jerky' : 'steady';
}
// 5% seed chance; independent 25% left/right growth. A separator prevents
// neighboring seeds from merging into runs longer than three characters.
export function grassCover(phrase: string, random: Random): boolean[] {
  const cover = Array(phrase.length).fill(false) as boolean[];
  const available = (i: number) => i >= 0 && i < phrase.length && phrase[i] !== ' ';
  for (let i=0;i<phrase.length;i++) {
    if (!available(i) || cover[i] || cover[i-1] || cover[i+1] || random() >= .05) continue;
    const left = random() < .25 && available(i-1) && !cover[i-2] && !cover[i-3];
    const right = random() < .25 && available(i+1) && !cover[i+2] && !cover[i+3];
    cover[i]=true; if(left) cover[i-1]=true; if(right) cover[i+1]=true;
  }
  return cover;
}
export function beginRetrieve(now: number, random: Random, tackle = DEFAULT_TACKLE, distance = 1): GameState {
  const poem = HAIKU[Math.min(HAIKU.length-1,Math.floor(random()*HAIKU.length))];
  return { phase: 'retrieving', tackle: normalizeTackle(tackle), castDistance: distance,
    retrieve: { typing: { ...createTyping(poem.text,now), deadline: Infinity }, cover: grassCover(poem.text,random), keys: [], rhythm: 'steady', lastKeyAt: now, lastRollAt: now, maxReeled: 0 } };
}
export function observedPresentation(tackle: TackleSetup, r: RetrieveState, now: number): Retrieve {
  if (r.rhythm === 'dead-stick') return tackle.lure === 'jerkbait' ? 'long-pause' : 'still';
  const options=allowedRetrieves(tackle.lure,tackle.rig);
  if (r.rhythm === 'jerky') return options.find(value => ['twitch-pause','pop-pause','lift-pause','slow-drag'].includes(value)) ?? 'twitch-pause';
  const recent=r.keys.filter(time => time>now-RETRIEVE_WINDOW_MS);
  const speed=(recent.length-1)/Math.max(1,((recent[recent.length-1] ?? now)-(recent[0] ?? now))/1000);
  const fast=recent.length>=10 && speed>=5;
  if (fast && options.includes('burn')) return 'burn';
  if (tackle.retrieve==='figure-eight' && r.maxReeled/r.typing.phrase.length > .8) return 'figure-eight';
  if (options.includes('steady') && recent.length>=3 && speed>=2.5) return 'steady';
  return options.find(value => ['slow-roll','slow-drag','steady'].includes(value)) ?? 'steady';
}
export function retrieveConditions(state: Extract<GameState,{phase:'retrieving'}>, now: number, conditions: FishingConditions): FishingConditions {
  return { ...conditions, tackle: state.tackle, observedRetrieve: observedPresentation(state.tackle,state.retrieve,now) };
}
export function promoteCoverFish(species: FishSpecies, conditions: FishingConditions, random: Random) {
  const tier=RARITIES[Math.min(RARITIES.length-1,RARITIES.indexOf(species.rarity)+1)];
  return weighted(SPECIES.filter(fish => fish.rarity===tier), fish => fish.encounterWeight*fishingMultiplier(fish.id,conditions),random);
}
export function retrieveContactChance(conditions: FishingConditions, reeled: number, elapsedMs: number, grass: boolean, rhythm: RetrieveRhythm) {
  const range=biteWaitRange(conditions); const mean=(range[0]+range[1])/2;
  const distance=Math.max(.08,1-Math.min(1,reeled)*.92);
  const cover=grass && rhythm==='dead-stick' ? 1.35 : 1;
  return 1-Math.exp(-Math.max(0,elapsedMs)/mean*distance*cover);
}
export function hookRetrieve(state: Extract<GameState,{phase:'retrieving'}>, now: number, random: Random, overrides: EncounterOverrides, conditions: FishingConditions, speciesId?: string, grass = false): GameState {
  const r=state.retrieve; const reeled=Math.min(1,r.maxReeled/r.typing.phrase.length);
  const encounter=generateEncounter(random,{...overrides,...(speciesId ? {speciesId} : {}), lineRemaining:1-reeled,castDistance:state.castDistance},conditions);
  return {phase:'typing',encounter:{...encounter,castDistance:state.castDistance,
    retrieve:{phrase:r.typing.phrase,reeled,rhythm:r.rhythm,grass}},typing:createTyping(encounter.phrase,now)};
}
function rollContact(state: Extract<GameState,{phase:'retrieving'}>, now: number, random: Random, overrides: EncounterOverrides, conditions: FishingConditions, elapsedMs: number, inspect = false): GameState {
  const r=state.retrieve; const c=retrieveConditions(state,now,conditions);
  const grass=!!r.cover[Math.min(r.maxReeled,r.typing.phrase.length-1)];
  const next={...state,retrieve:{...r,lastRollAt:now}};
  const probability=retrieveContactChance(c,r.maxReeled/r.typing.phrase.length,elapsedMs,grass,r.rhythm);
  const contact=random(); const rolls: {contact:number;species?:number;promotion?:number;bite?:number}={contact};
  const record=(result:GameState,outcome:'none'|'nibble'|'bite',speciesId?:string):GameState=>inspect ? {...result,check:makeFishCheck({at:now,source:r.rhythm==='dead-stick' ? 'dead-stick' : 'letter',conditions:c,outcome,contactChance:probability,noFish:1-probability,
    rows:fishCheckRows(c,probability,grass),cursor:r.maxReeled,reeled:r.maxReeled/r.typing.phrase.length,grass,rhythm:r.rhythm,elapsedMs,speciesId,rolls})} : result;
  if(contact>=probability) return record(next,'none');
  rolls.species=random();
  const fish=weighted(SPECIES, f=>f.encounterWeight*fishingMultiplier(f.id,c),()=>rolls.species!);
  if(grass) rolls.promotion=random();
  const candidate=grass ? promoteCoverFish(fish,c,()=>rolls.promotion!) : fish;
  rolls.bite=random();
  if(rolls.bite<.4) return record(hookRetrieve(next,now,random,overrides,c,candidate.id,grass),'bite',candidate.id);
  return record({...next,retrieve:{...next.retrieve,notice:undefined,nibble:{speciesId:candidate.id,grass,resolvesAt:now+5000+random()*5000}}},'nibble',candidate.id);
}
export function retrieveKey(state: Extract<GameState,{phase:'retrieving'}>, key: string, now: number, random: Random, overrides: EncounterOverrides, conditions: FishingConditions, inspect = false): GameState {
  if(key!=='Backspace' && (key.length!==1 || !/^[\x20-\x7e]$/.test(key))) return state;
  const r=state.retrieve; const typing=applyKey(r.typing,key,now);
  const printable=key.length===1;
  const keys=printable ? [...r.keys.filter(time=>time>now-RETRIEVE_WINDOW_MS),now] : r.keys;
  let correct=0; while(correct<typing.typed.length && typing.typed[correct]===typing.phrase[correct]) correct++;
  const next: Extract<GameState,{phase:'retrieving'}>={...state,retrieve:{...r,typing,keys,
    rhythm:printable && now-r.lastKeyAt>=1000 ? 'jerky' : classifyRetrieve(keys,now,printable ? now : r.lastKeyAt),lastKeyAt:printable ? now : r.lastKeyAt,
    maxReeled:Math.max(r.maxReeled,correct),...(r.nibble ? {nibble:undefined,notice:'The nibble slipped away. Keep retrieving or pause in cover.'} : {})}};
  // Backspacing and retyping cannot repeatedly fish the same patch of cover.
  const outcome=correct>r.maxReeled && !r.nibble ? rollContact(next,now,random,overrides,conditions,Math.max(100,Math.min(1000,now-r.lastKeyAt)),inspect) : next;
  if(inspect && r.nibble) outcome.check=makeFishCheck({at:now,source:'nibble',conditions:retrieveConditions(next,now,conditions),outcome:'nibble-lost',contactChance:0,noFish:1,rows:fishCheckRows(conditions,0,false,{speciesId:r.nibble.speciesId},1),cursor:r.maxReeled,reeled:r.maxReeled/r.typing.phrase.length,grass:r.nibble.grass,rhythm:next.retrieve.rhythm,speciesId:r.nibble.speciesId});
  if(outcome.phase==='retrieving' && typing.finishedAt!==undefined && !outcome.retrieve.nibble) return {phase:'retrieved',check:outcome.check};
  return outcome;
}
export function tickRetrieve(state: Extract<GameState,{phase:'retrieving'}>, now: number, random: Random, overrides: EncounterOverrides, conditions: FishingConditions, inspect = false): GameState {
  const r=state.retrieve; const rhythm=classifyRetrieve(r.keys,now,r.lastKeyAt);
  const next={...state,retrieve:{...r,rhythm}};
  if(r.nibble && now>=r.nibble.resolvesAt) {
    const c=retrieveConditions(next,now,conditions);
    const factor=tackleFactors(r.nibble.speciesId,c).retrieve;
    const affinity=lureFor(state.tackle.lure).affinity[SPECIES.findIndex(f=>f.id===r.nibble!.speciesId)];
    const chance=Math.max(.2,Math.min(.85,.3+factor*.22+Math.min(1,affinity)*.15+(r.nibble.grass && rhythm==='dead-stick' ? .12 : 0)));
    const roll=random(); const bites=roll<chance;
    const result:GameState=bites ? hookRetrieve(next,now,random,overrides,c,r.nibble.speciesId,r.nibble.grass)
      : r.typing.finishedAt!==undefined ? {phase:'retrieved'} : {...next,retrieve:{...next.retrieve,nibble:undefined,lastRollAt:now,notice:'The nibble faded. Try another rhythm or let the lure rest.'}};
    return inspect ? {...result,check:makeFishCheck({at:now,source:'nibble',conditions:c,outcome:bites ? 'bite' : 'nibble-lost',contactChance:chance,noFish:1-chance,rows:fishCheckRows(c,chance,false,{speciesId:r.nibble.speciesId},1),cursor:r.maxReeled,reeled:r.maxReeled/r.typing.phrase.length,grass:r.nibble.grass,rhythm,speciesId:r.nibble.speciesId,rolls:{bite:roll}})} : result;
  }
  if(!r.nibble && rhythm==='dead-stick' && now-r.lastRollAt>=RETRIEVE_WINDOW_MS) return rollContact(next,now,random,overrides,conditions,RETRIEVE_WINDOW_MS,inspect);
  return rhythm===r.rhythm ? state : next;
}
export const defaultRetrieveConditions: FishingConditions={season:'summer',period:'morning',moonPhase:'full'};
