import {Season} from './types';

// Generation v1 catalog. Keep this table and its ordering stable for v1 worlds;
// future generation rules/catalogs must get a new version and dispatcher.
export type PlantKind='flower'|'reed'|'lily';
export interface PlantSpecies {id:string;name:string;kind:PlantKind;bloomSeasons:readonly Season[];perennial:boolean;winterBlooming:boolean;height:number}
export const PLANT_SPECIES_V1:readonly PlantSpecies[]=[
  {id:'violet',name:'Common blue violet',kind:'flower',bloomSeasons:['spring'],perennial:true,winterBlooming:false,height:.65},
  {id:'cornflower',name:'Cornflower',kind:'flower',bloomSeasons:['spring','summer'],perennial:false,winterBlooming:false,height:1.1},
  {id:'aster',name:'New England aster',kind:'flower',bloomSeasons:['autumn'],perennial:true,winterBlooming:false,height:1.05},
  {id:'hellebore',name:'Hellebore',kind:'flower',bloomSeasons:['winter','spring'],perennial:true,winterBlooming:true,height:.8},
  {id:'cattail',name:'Broadleaf cattail',kind:'reed',bloomSeasons:['summer'],perennial:true,winterBlooming:false,height:1.2},
  {id:'rush',name:'Soft rush',kind:'reed',bloomSeasons:['summer'],perennial:true,winterBlooming:false,height:1},
  {id:'sedge',name:'Shore sedge',kind:'reed',bloomSeasons:['spring','summer'],perennial:true,winterBlooming:false,height:.85},
  {id:'water-lily',name:'White water lily',kind:'lily',bloomSeasons:['summer'],perennial:true,winterBlooming:false,height:.75},
  {id:'lotus',name:'Pink lotus',kind:'lily',bloomSeasons:['summer'],perennial:true,winterBlooming:false,height:1},
];
export const plantSpecies=(id:string)=>PLANT_SPECIES_V1.find(species=>species.id===id)!;
export type PlantLocation='dock'|'cove'|'birch';
export interface PlantRoot {x:number;y:number;layer:string}
export interface PlantAnchor {id:string;kind:PlantKind;choices:PlantRoot[];width?:number;floatingLayer?:number;angle?:number}
export const PLANT_ANCHORS_V1:Record<PlantLocation,PlantAnchor[]>=require('../data/plant-anchors-v1.json');
export const plantLocation=(location:string):PlantLocation=>location==='birch'?'birch':location==='cove'?'cove':'dock';
