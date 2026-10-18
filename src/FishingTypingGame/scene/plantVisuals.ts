import {GrowingPlant,PlantSnapshot,PlantStem,plantRandom,stemAppearance} from '../engine/plantLifecycle';
import {plantSpecies} from '../engine/plantSpecies';
import {DepthPerspective,perspectiveRatio} from './sceneDepth';

export interface PlantPoint {x:number;y:number}
export interface PlantArt {image:string;width:number;height:number;root:PlantPoint;perch:PlantPoint}
export const PLANT_ART_V1:Record<string,Record<string,PlantArt>>=require('../data/plant-art-v1.json');
export interface PlantSprite {id:string;role:'foliage'|'pad'|'stem';art:PlantArt;left:number;top:number;width:number;height:number;angle:number;flipped:boolean;flat:number;stretch:number;point:PlantPoint;label:string;kind:'flower'|'leaf'|'stem';uses:string[];dedicated:boolean;stage?:string;slot?:number}
export const waterPerspective=(y:number)=>Math.max(.10,Math.min(.23,.10+(y-.58)*.32));
export const plantBoxAspect=(plant:GrowingPlant)=>plant.kind==='flower'?1.1:plant.kind==='reed'?.9:1;
// Ease the shared camera curve slightly for painted plants. Every increase in
// distance still shrinks them, including within the nearest foreground band.
export const plantDepthScale=(z:number,perspective?:DepthPerspective)=>perspectiveRatio(z,perspective)**.8;

// Traced dense bank edges in the cove's original 1000-wide shore-art frame.
// Seasonal grass silhouettes vary, so follow the painted edge while preserving
// the seeded plant/slot identity and its position along the shore.
const COVE_BANK_X=[.42,.46,.50,.55,.60,.65,.70,.75,.80,.85,.90,.94];
const COVE_BANK_Y={
  spring:[370,398,385,435,461,474,490,490,502,514,526,548],
  summer:[370,400,402,435,465,467,493,491,502,528,526,547],
  autumn:[371,404,409,455,474,498,498,492,503,537,527,548],
  winter:[369,394,400,444,477,484,493,487,498,529,525,544],
};
export function floatingPlantPosition(plant:GrowingPlant,snapshot:PlantSnapshot):PlantPoint {
  if(snapshot.location!=='cove'||plant.kind!=='lily')return {x:plant.x,y:plant.y};
  const x=Math.max(COVE_BANK_X[0],Math.min(plant.x,.94)),edge=COVE_BANK_Y[snapshot.calendar.season];
  const next=Math.max(1,COVE_BANK_X.findIndex(value=>value>=x)),previous=next-1;
  const t=(x-COVE_BANK_X[previous])/(COVE_BANK_X[next]-COVE_BANK_X[previous]);
  const bankY=edge[previous]+(edge[next]-edge[previous])*t;
  const gap=12-(plant.anchor.floatingLayer??0)*3;
  return {x,y:(bankY-gap)/(1000*941/1672)};
}

/** Match root-centered CSS rotation/mirroring followed by water flattening. */
export function spritePoint(art:PlantArt,point:PlantPoint,angle:number,flipped:boolean,flat=1,stretch=1):PlantPoint {
  const a=angle*Math.PI/180,dx=(point.x-art.root.x)*art.width*(flipped?-1:1),dy=(point.y-art.root.y)*art.height;
  return {x:art.root.x+(dx*Math.cos(a)-dy*Math.sin(a))*stretch/art.width,y:art.root.y+(dx*Math.sin(a)+dy*Math.cos(a))*flat/art.height};
}
export function plantSprites(plant:GrowingPlant,snapshot:PlantSnapshot):PlantSprite[] {
  const library=PLANT_ART_V1[plant.speciesId],species=plantSpecies(plant.speciesId),aspect=plantBoxAspect(plant),sprites:PlantSprite[]=[];
  const add=(id:string,role:PlantSprite['role'],art:PlantArt,root:PlantPoint,height:number,angle:number,flipped:boolean,flat=1,stretch=1,stem?:PlantStem,slot?:number)=>{
    const width=height/aspect*art.width/art.height,flower=stem?.stage==='bloom'&&plant.kind!=='reed';
    sprites.push({id,role,art,left:root.x-width*art.root.x,top:root.y-height*art.root.y,width,height,angle,flipped,flat,stretch,
      point:spritePoint(art,art.perch,angle,flipped,flat,stretch),label:`${species.name}${stem?` · ${stem.stage} · stem ${stem.slot+1}`:' · foliage'}`,
      kind:flower?'flower':stem?'stem':'leaf',uses:flower?['butterfly','dragonfly','damselfly']:stem?['dragonfly','damselfly']:['moth','dragonfly','damselfly'],
      dedicated:plant.kind==='reed'&&!!stem,stage:stem?.stage,slot});
  };
  const foliage=library[`foliage-${snapshot.calendar.season==='winter'?'winter':plant.maturity}`];
  // Project both pad centers and stem contacts onto the same shallow water plane.
  // The seeded slots stay unchanged; this is only their visual projection.
  const waterFlat=waterPerspective(floatingPlantPosition(plant,snapshot).y);
  const rootFor=(slot:GrowingPlant['slots'][number])=>plant.kind==='lily'?{x:slot.x,y:.5+(slot.y-.5)*waterFlat}:slot;
  if(plant.kind==='lily')plant.slots.forEach((slot,n)=>{
    const width=(plant.maturity==='spring'?.20:.24)*slot.scale;
    add(`${plant.id}:pad-${n}`,'pad',foliage,rootFor(slot),width*foliage.height/foliage.width,slot.angle,slot.flipped,waterFlat,.88+plantRandom(snapshot.world,'pad-shape',plant.id,n)*.24,undefined,n);
  });
  else {
    const width=plant.kind==='reed'?.66:.86;
    const tilt=plant.lean+(plantRandom(snapshot.world,'foliage-tilt',plant.id)-.5)*(plant.kind==='reed'?12:22);
    const flat=.84+plantRandom(snapshot.world,'foliage-height',plant.id)*.23;
    const stretch=.76+plantRandom(snapshot.world,'foliage-width',plant.id)*.40;
    add(`${plant.id}:foliage`,'foliage',foliage,{x:.5,y:.96},width*aspect*foliage.height/foliage.width,tilt,plant.flipped,flat,stretch);
  }
  plant.stems.forEach(stem=>{
    const slot=plant.slots[stem.slot],look=stemAppearance(snapshot.world,stem),art=library[stem.stage];
    const growth=stem.stage==='stem'?.55:stem.stage==='bud'?.86:stem.stage==='withering'?.90:1;
    const height=(plant.kind==='lily'?.20*species.height:.90)*slot.scale*look.scale*growth;
    const flat=plant.kind==='lily'?.78+waterFlat*.18:.88+plantRandom(snapshot.world,'stalk-height',plant.id,stem.slot)*.20;
    const stretch=.78+plantRandom(snapshot.world,'stalk-width',plant.id,stem.slot)*.38;
    add(stem.id,'stem',art,rootFor(slot),height,plant.lean+look.lean*1.4,look.flipped,flat,stretch,stem,stem.slot);
  });
  return sprites;
}
export interface WaterMotion {start:number;period:number;phase:number}
export function waterBob(motion:WaterMotion,now:number):number {
  const p=(((now-motion.start)/motion.period+motion.phase)%1+1)%1;
  return p<.25?-2.8*p:p<.75?-.7+2.8*(p-.25):.7-2.8*(p-.75);
}
