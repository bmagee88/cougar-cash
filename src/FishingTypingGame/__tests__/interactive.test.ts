import { SPECIES } from '../engine/config';
import { castDistance, generateEncounter, seededRandom } from '../engine/encounters';
import { biteWaitRange, encounterOdds, springRetrieveBonus } from '../engine/feeding';
import { cast, tick, typeKey } from '../engine/game';
import { HAIKU, HAIKU_BY_TEXT } from '../engine/haiku';
import { beginRetrieve, classifyRetrieve, grassCover, hookRetrieve, observedPresentation, promoteCoverFish, retrieveContactChance, retrieveKey, tickRetrieve } from '../engine/interactive';
import { awardCatch, deserializeSave, emptySave } from '../engine/storage';
import { DEFAULT_TACKLE, tackleFactors } from '../engine/tackle';
import { FishingConditions, GameState, Random } from '../engine/types';

declare const test: (name:string,fn:()=>void)=>void;
declare const expect:any;
const c: FishingConditions={season:'summer',period:'morning',moonPhase:'full',weather:'sunny',tackle:DEFAULT_TACKLE};
const retrieve=(now=0)=>beginRetrieve(now,seededRandom(42)) as Extract<GameState,{phase:'retrieving'}>;
const sequence=(...values:number[]):Random=>()=>values.shift() ?? .99;

test('five-second window recognizes constant input, bursts, pauses and dead stick',()=>{
  expect(classifyRetrieve([100,300,500,700,900],1000,900)).toBe('steady');
  expect(classifyRetrieve([100,200,300,2000,2100],2200,2100)).toBe('jerky');
  expect(classifyRetrieve([100,300,500],1500,500)).toBe('jerky');
  expect(classifyRetrieve([0,100],5099,100)).toBe('jerky');
  expect(classifyRetrieve([0,100],5100,100)).toBe('dead-stick');
  expect(classifyRetrieve([100,200,1900,2100,6000,6200,6400],6500,6400)).toBe('jerky');
  expect(classifyRetrieve([100,1900,6000,6200,6400],7100,6400)).toBe('steady');
});
test('grass seeds have 5% probability, 25% independent growth, and never merge beyond three',()=>{
  const one=sequence(.01,.1,.1);
  expect(grassCover('abc',one)).toEqual([true,true,false]);
  let seeds=0,left=0,right=0; const rng=seededRandom(97);
  // Disable neighboring seeds to measure the center's seed and growth trials.
  for(let i=0;i<50000;i++){
    const seed=rng();const values=[.99,seed,...(seed<.05 ? [rng(),rng()] : []),.99];
    const cover=grassCover('abc',sequence(...values));
    if(cover[1]) {seeds++;left+=Number(cover[0]);right+=Number(cover[2]);}
  }
  expect(Math.abs(seeds/50000-.05)).toBeLessThan(.003);
  expect(Math.abs(left/seeds-.25)).toBeLessThan(.03);expect(Math.abs(right/seeds-.25)).toBeLessThan(.03);
  const longRng=seededRandom(2);
  for(let i=0;i<1000;i++) expect(grassCover('a'.repeat(200),longRng).map(v=>v?'g':'_').join('')).not.toContain('gggg');
});
test('Standard remains timed while Interactive begins a complete untimed haiku',()=>{
  const standard=cast({phase:'idle'},0,()=>0,c); const interactive=cast({phase:'idle'},0,()=>0,c,'interactive');
  expect(tick(standard,850).phase).toBe('waiting');
  const state=tick(interactive,850,seededRandom(2),{},c);
  expect(state.phase).toBe('retrieving'); if(state.phase!=='retrieving')return;
  expect(HAIKU_BY_TEXT.has(state.retrieve.typing.phrase)).toBe(true);
  expect(state.retrieve.typing.deadline).toBe(Infinity);
  expect(tick(state,20000,()=>.99,{},c).phase).toBe('retrieving');
});
test('every new correct character rolls no fish, nibble or bite, while corrections cannot farm rolls',()=>{
  const state=retrieve(); const letter=state.retrieve.typing.phrase[0];
  const none=retrieveKey(state,letter,200,()=>.99,{},c);
  expect(none.phase).toBe('retrieving');
  const nibble=retrieveKey(state,letter,200,sequence(0,0,.9,.5),{},c);
  expect(nibble.phase).toBe('retrieving'); if(nibble.phase!=='retrieving')return;
  expect(nibble.retrieve.nibble!.resolvesAt).toBe(7700);
  const bite=retrieveKey(state,letter,200,sequence(0,0,0),{quality:'C',isAlbino:false,wpmAdjustment:0},c);
  expect(bite.phase).toBe('typing');
  let calls=0; const rng=()=>{calls++;return 0;};
  const wrong=retrieveKey(state,'z',100,rng,{},c) as typeof state;
  expect(calls).toBe(0);expect(wrong.retrieve.maxReeled).toBe(0);
  const corrected=retrieveKey(wrong,'Backspace',200,rng,{},c) as typeof state;
  expect(corrected.retrieve.typing.typed).toBe('');
  const backed=retrieveKey(none as typeof state,'Backspace',300,rng,{},c) as typeof state;
  retrieveKey(backed,letter,400,rng,{},c);expect(calls).toBe(0);
});
test('nibbles resolve after 5–10 seconds, can fail, and typing loses a nibble',()=>{
  const state=retrieve();state.retrieve.nibble={speciesId:'bluegill',resolvesAt:7500,grass:false};
  expect(tickRetrieve(state,7499,()=>0,{},c).phase).toBe('retrieving');
  expect(tickRetrieve(state,7500,()=>0,{},c).phase).toBe('typing');
  const failed=tickRetrieve(state,7500,()=>.99,{},c) as typeof state;
  expect(failed.retrieve.nibble).toBeUndefined();expect(failed.retrieve.notice).toMatch(/faded/);
  const moved=retrieveKey(state,state.retrieve.typing.phrase[0],1000,()=>0,{},c) as typeof state;
  expect(moved.retrieve.nibble).toBeUndefined();expect(moved.retrieve.notice).toMatch(/slipped/);
});
test('five seconds still rerolls once, including grass, and hidden tabs do not backfill rolls',()=>{
  const state=retrieve();state.retrieve.cover[0]=true;
  expect(tickRetrieve(state,4999,()=>0,{},c).phase).toBe('retrieving');
  const bite=tickRetrieve(state,5000,sequence(0,0,0,0),{wpmAdjustment:0},c);
  expect(bite.phase).toBe('typing');if(bite.phase!=='typing')return;
  expect(bite.encounter.retrieve).toMatchObject({grass:true,rhythm:'dead-stick'});
  expect(bite.encounter.species.rarity).toBe('Uncommon');
  const none=tickRetrieve(state,5000,()=>.99,{},c) as typeof state;
  expect(tickRetrieve(none,9999,()=>0,{},c)).toBe(none);
  expect(tickRetrieve(none,10000,sequence(0,0,0,0),{},c).phase).toBe('typing');
  const hidden=tickRetrieve(none,3600000,()=>.99,{},c) as typeof state;
  expect(hidden.retrieve.lastRollAt).toBe(3600000);
});
test('cover promotion is exactly one species tier, capped at Ultra-Rare',()=>{
  const rng=seededRandom(55);
  SPECIES.forEach(fish=>{
    const promoted=promoteCoverFish(fish,c,rng);
    const tiers=['Common','Uncommon','Rare','Mythic-Rare','Ultra-Rare'];
    expect(tiers.indexOf(promoted.rarity)).toBe(Math.min(4,tiers.indexOf(fish.rarity)+1));
  });
});
test('moving toward shore lowers contact chance and shortens fish battle without resetting line',()=>{
  expect(retrieveContactChance(c,.9,500,false,'steady')).toBeLessThan(retrieveContactChance(c,0,500,false,'steady'));
  expect(retrieveContactChance(c,0,500,true,'dead-stick')).toBeGreaterThan(retrieveContactChance(c,0,500,true,'steady'));
  const a=retrieve(),b=retrieve();b.retrieve.maxReeled=Math.round(b.retrieve.typing.phrase.length*.7);
  const first=hookRetrieve(a,5000,seededRandom(4),{speciesId:'muskie',quality:'A',isAlbino:false,wpmAdjustment:0},c);
  const near=hookRetrieve(b,5000,seededRandom(4),{speciesId:'muskie',quality:'A',isAlbino:false,wpmAdjustment:0},c);
  if(first.phase!=='typing' || near.phase!=='typing')throw Error('Expected bites');
  expect(near.encounter.phrase.length).toBeLessThan(first.encounter.phrase.length);
  expect(near.encounter.retrieve!.reeled).toBeCloseTo(.7,1);
  expect(near.encounter.targetWpm).toBeLessThan(first.encounter.targetWpm);
});
test('wind length scales after the bell curve, with stronger storm casting distances',()=>{
  const rng=()=>.4; const overrides={speciesId:'bass',quality:'C' as const,isAlbino:false,wpmAdjustment:0};
  const calm=generateEncounter(rng,overrides,c);
  ['wind','thunderstorm','blizzard','hurricane'].forEach(weather=>{
    const conditions={...c,weather} as FishingConditions;
    const fish=generateEncounter(rng,overrides,conditions);
    expect(fish.targetWpm).toBeCloseTo(calm.targetWpm*castDistance(conditions.weather));
    expect(fish.phrase.length).toBeGreaterThan(calm.phrase.length);
  });
});
test('wait is doubled universally, winter stacks another doubling, spring fast retrieves shorten it',()=>{
  expect(biteWaitRange()).toEqual([10000,20000]);
  const winter={...c,season:'winter' as const};
  const total=encounterOdds(winter).reduce((sum,row)=>sum+row.weight,0);
  const rate=Math.max(.4,Math.min(1.65,Math.sqrt(total/100)));
  expect(biteWaitRange(winter)).toEqual([Math.round(5/rate)*4000,Math.round(10/rate)*4000]);
  const spring={...c,season:'spring' as const,tackle:{lure:'spinnerbait' as const,color:'silver' as const,rig:'direct' as const,retrieve:'steady' as const}};
  expect(springRetrieveBonus(spring)).toBe(.75);
  expect(springRetrieveBonus({...spring,observedRetrieve:'still'})).toBe(1);
});
test('observed actions respect jig, popper, suspending lure and blade preferences',()=>{
  const state=retrieve();state.retrieve.rhythm='jerky';
  expect(observedPresentation({...DEFAULT_TACKLE,lure:'popper',rig:'direct'},state.retrieve,1000)).toBe('pop-pause');
  state.retrieve.rhythm='dead-stick';
  expect(observedPresentation({...DEFAULT_TACKLE,lure:'jerkbait'},state.retrieve,5000)).toBe('long-pause');
  const spinner={...c,tackle:{lure:'spinnerbait' as const,color:'silver' as const,rig:'direct' as const,retrieve:'steady' as const}};
  expect(tackleFactors('bass',{...spinner,observedRetrieve:'still'}).retrieve).toBeLessThan(tackleFactors('bass',{...spinner,observedRetrieve:'steady'}).retrieve);
});
test('empty retrieves do not award escapes and catch saves retain both texts and default old mode',()=>{
  let state:GameState=retrieve();
  if(state.phase!=='retrieving')return; const text=state.retrieve.typing.phrase;
  Array.from(text).forEach((key,i)=>{state=typeKey(state,key,i*200,()=>.99,{},c);});
  expect(state.phase).toBe('retrieved');
  const save=emptySave();expect(save.stats.escaped).toBe(0);
  const fish=generateEncounter(seededRandom(3));fish.retrieve={phrase:HAIKU[0].text,reeled:.4,rhythm:'jerky',grass:true};
  const saved=awardCatch({...save,settings:{...save.settings,fishingMode:'interactive'}},fish,{wpm:40,accuracy:100,timeRemaining:1,correctCharacters:30});
  const reload=deserializeSave(JSON.stringify(saved));expect(reload.livewell[0].retrieve).toEqual(fish.retrieve);expect(reload.settings.fishingMode).toBe('interactive');
  saved.settings.fishingMode='standard';expect(deserializeSave(JSON.stringify(saved)).settings.fishingMode).toBe('standard');
  delete saved.settings.fishingMode;expect(deserializeSave(JSON.stringify(saved)).settings.fishingMode).toBe('interactive');
  expect(emptySave().settings.fishingMode).toBe('interactive');
});
