import { artwork } from './artwork';

export const TREE_BIRD_SPECIES=[
  {id:'cardinal',name:'Cardinal',canFlock:false},
  {id:'sparrow',name:'Sparrow',canFlock:true},
] as const;
export type TreeBirdSpeciesId=typeof TREE_BIRD_SPECIES[number]['id'];
export const TREE_BIRD_DIRECTIONS=['front','front-left','front-right','back','back-left','back-right'] as const;
export type TreeBirdDirection=typeof TREE_BIRD_DIRECTIONS[number];
export const TREE_BIRD_SPRITE={size:128,columns:12,rows:6,wingFrames:8,glideFrame:8,brakeFrames:[9,10,11]} as const;
export interface BirdPose { direction:TreeBirdDirection; frame:number }
export const birdById=(id:unknown)=>TREE_BIRD_SPECIES.find(species=>species.id===id);
export const birdSheet=(id:TreeBirdSpeciesId)=>artwork(`visitors/tree-birds/${id}/flight-sheet.webp`);
export function readBirdPose(raw:unknown):BirdPose|undefined {
  const pose=raw as Partial<BirdPose>|undefined;
  return pose&&TREE_BIRD_DIRECTIONS.includes(pose.direction!)&&Number.isInteger(pose.frame)&&pose.frame!>=0&&pose.frame!<TREE_BIRD_SPRITE.columns
    ?{direction:pose.direction!,frame:pose.frame!}:undefined;
}
