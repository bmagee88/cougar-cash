import { FishSpecies, MeasurementSystem, Quality, QUALITIES } from './types';
import { SPECIES } from './config';

// Fractions of each species' own weight range. Boundaries are rounded to grams
// before sampling so adjacent qualities cannot overlap through display rounding.
const WEIGHT_BANDS = [0, .08, .22, .45, .72, 1];
export function qualityWeightRange(species: FishSpecies, quality: Quality): [number, number] {
  const tier=QUALITIES.indexOf(quality), [low,high]=species.weightKg;
  const start=Math.ceil((low+(high-low)*WEIGHT_BANDS[tier])*1000-1e-8);
  const end=tier===4?Math.round(high*1000):Math.ceil((low+(high-low)*WEIGHT_BANDS[tier+1])*1000-1e-8)-1;
  return [start/1000,end/1000];
}
export function qualityForWeight(species: FishSpecies, weightKg: number): Quality {
  return QUALITIES.find(quality=>weightKg<=qualityWeightRange(species,quality)[1]) ?? 'SS';
}
export const KG_PER_LB=.45359237;
export const CM_PER_IN=2.54;
export const weightValue=(kg:number,units:MeasurementSystem)=>units==='imperial'?kg/KG_PER_LB:kg;
export const lengthValue=(cm:number,units:MeasurementSystem)=>units==='imperial'?cm/CM_PER_IN:cm;
export const weightUnit=(units:MeasurementSystem)=>units==='imperial'?'lb':'kg';
export const lengthUnit=(units:MeasurementSystem)=>units==='imperial'?'in':'cm';
export const formatWeight=(kg:number,units:MeasurementSystem)=>`${weightValue(kg,units).toFixed(units==='imperial'?2:3)} ${weightUnit(units)}`;
export const formatLength=(cm:number,units:MeasurementSystem)=>`${lengthValue(cm,units).toFixed(units==='imperial'?2:1)} ${lengthUnit(units)}`;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const referenceLength=Math.max(...SPECIES.map(s=>s.lengthCm[1])),referenceWeight=Math.max(...SPECIES.map(s=>s.weightKg[1]));
export function fishDisplaySize(species:FishSpecies,lengthCm:number,weightKg:number) {
  // A compressed common scale keeps small fish readable while preserving the
  // difference between a panfish and a large predator. Weight adds body size;
  // length stretches only the horizontal axis.
  const length=clamp(Math.max(species.lengthCm[0],lengthCm)/referenceLength);
  const weight=clamp(Math.log1p(Math.max(0,weightKg))/Math.log1p(referenceWeight));
  const mass=.82+.22*Math.sqrt(weight);
  return { width:(.42+.52*Math.sqrt(length))*mass, thickness:mass };
}
