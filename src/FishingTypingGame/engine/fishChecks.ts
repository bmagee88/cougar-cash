import { SPECIES } from './config';
import { fishingMultiplier } from './feeding';
import { EncounterOverrides, FishCheck, FishCheckRow, FishingConditions, RARITIES } from './types';

let sequence = 0;
export function fishCheckRows(c: FishingConditions, contact: number, grass = false, overrides: EncounterOverrides = {}, biteFraction = .4): FishCheckRow[] {
  const population=overrides.speciesId ? SPECIES.filter(f=>f.id===overrides.speciesId) : overrides.rarity ? SPECIES.filter(f=>f.rarity===overrides.rarity) : SPECIES;
  const weights=SPECIES.map(f=>population.includes(f) ? f.encounterWeight*fishingMultiplier(f.id,c) : 0);
  const total=weights.reduce((sum,w)=>sum+w,0);
  const chances=weights.map(w=>w/total);
  const candidates=grass ? SPECIES.map(()=>0) : [...chances];
  if(grass) SPECIES.forEach((fish,i)=>{
    const tier=RARITIES[Math.min(4,RARITIES.indexOf(fish.rarity)+1)];
    const targets=SPECIES.map((f,j)=>f.rarity===tier ? j : -1).filter(j=>j>=0);
    const tierTotal=targets.reduce((sum,j)=>sum+SPECIES[j].encounterWeight*fishingMultiplier(SPECIES[j].id,c),0);
    targets.forEach(j=>{candidates[j]+=chances[i]*SPECIES[j].encounterWeight*fishingMultiplier(SPECIES[j].id,c)/tierTotal;});
  });
  return SPECIES.map((fish,i)=>({speciesId:fish.id,weight:weights[i],chance:chances[i],candidateChance:candidates[i],bite:contact*candidates[i]*biteFraction,nibble:contact*candidates[i]*(1-biteFraction)}));
}
export function makeFishCheck(data: Omit<FishCheck,'id'>): FishCheck { return {...data,id:++sequence}; }
