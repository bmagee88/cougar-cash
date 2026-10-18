import { FlightState,isPerched, planPerch } from './butterflyFlight';
import { Random, Season } from '../engine/types';
import {plantSnapshot,PlantSnapshot} from '../engine/plantLifecycle';
import {plantLocation} from '../engine/plantSpecies';
import {worldAt} from '../engine/world';
import {newYorkMidnight} from '../engine/plantLifecycle';
import {plantSprites,WaterMotion,waterBob} from './plantVisuals';
import {depthAtWaterline,foregroundClearance,foregroundDepth,sceneDepthFrame} from './sceneDepth';

export type PlantUse = 'butterfly' | 'moth' | 'dragonfly' | 'damselfly';
export interface MappedPlant {
  id: string; label: string; layer: string; x: number; y: number; z: number;
  kind: 'flower' | 'leaf' | 'stem'; uses: PlantUse[]; dedicated?:boolean;
}
export interface PlantPerch extends MappedPlant { motion?:{baseX:number;baseY:number;px:number;py:number;water?:WaterMotion;sceneHeight?:number} }
const leaves: PlantUse[] = ['butterfly','moth'];
// Anchors are in each cutout's original 0–1 artwork frame, never viewport pixels.
// Stable painted leaves/stems. Nectar points come from the actual daily stalks.
export const LOCATION_PLANTS: Record<'dock' | 'cove' | 'birch', MappedPlant[]> = {
  dock: [
    { id:'dock-left-reed-leaf', label:'Left reed leaf', layer:'foreground-reeds', x:.20,y:.70,z:.079,kind:'leaf',uses:leaves },
    { id:'dock-right-reed-leaf', label:'Right reed leaf', layer:'foreground-reeds-right', x:.81,y:.68,z:.084,kind:'leaf',uses:leaves },
    { id:'dock-bank-leaf', label:'Bank grasses', layer:'near-shore', x:.55,y:.53,z:.095,kind:'leaf',uses:leaves },
  ],
  cove: [
    { id:'cove-root-leaves', label:'Leaves beside the trunk', layer:'cove-seat', x:.16,y:.61,z:.066,kind:'leaf',uses:leaves },
    { id:'cove-willow-leaf', label:'Hanging willow leaf', layer:'willow-branches-left', x:.50,y:.70,z:.105,kind:'leaf',uses:leaves },
  ],
  birch: [
    { id:'birch-bank-leaves', label:'Leaves beside the ledge', layer:'birch-seat', x:.365,y:.75,z:.066,kind:'leaf',uses:leaves },
    { id:'birch-right-leaves', label:'Right-bank leaves', layer:'birch-right-plants', x:.89,y:.95,z:.068,kind:'leaf',uses:leaves },
  ],
};
export function lifecyclePerches(snapshot:PlantSnapshot):MappedPlant[] {
  return snapshot.plants.filter(plant=>plant.visible).flatMap(plant=>plantSprites(plant,snapshot).map(sprite=>({
    id:sprite.id,label:sprite.label,layer:sprite.id,...sprite.point,z:.06,kind:sprite.kind,uses:sprite.uses as PlantUse[],dedicated:sprite.dedicated})));
}
export function plantsForLocation(location:string,season:Season='summer',day?:string,gameDay?:number,dayPreview?:number):MappedPlant[] {
  const current=worldAt(day?newYorkMidnight(day)+12*60*60*1000:Date.now());
  const snapshot=plantSnapshot(location,{...current,season,...(gameDay===undefined?{}:{gameDay})},undefined,dayPreview);
  return [...LOCATION_PLANTS[plantLocation(location)],...lifecyclePerches(snapshot)];
}

/** Inline custom-property reads do not force layout. Perches share the bank's
 * existing camera drift without a geometry read or a new animation loop. */
export function movePlantPerches(plants:PlantPerch[],sceneX:number,sceneY:number):void {
  const now=performance.now();
  plants.forEach(plant=>{if(plant.motion){plant.x=plant.motion.baseX+sceneX*plant.motion.px;plant.y=plant.motion.baseY+sceneY*plant.motion.py+
    (plant.motion.water?waterBob(plant.motion.water,now)/(plant.motion.sceneHeight||1):0);}});
}

export function visiblePlantPerches(scene: HTMLElement, location: string, bounds: DOMRect): PlantPerch[] {
  if (!bounds.width || !bounds.height) return [];
  const sceneX=parseFloat(scene.style.getPropertyValue('--scene-x'))||0,sceneY=parseFloat(scene.style.getPropertyValue('--scene-y'))||0;
  const camera=sceneDepthFrame(scene,location,bounds),horizon=camera.horizon;
  const dynamic=Array.from(scene.querySelectorAll<HTMLElement>('[data-life-sprite]')).map(node=>({id:node.dataset.lifeSprite!,label:node.dataset.lifeLabel!,
    layer:node.dataset.layer!,x:Number(node.dataset.lifePerchX),y:Number(node.dataset.lifePerchY),z:.06,kind:node.dataset.lifeKind as MappedPlant['kind'],
    uses:node.dataset.lifeUses!.split(',') as PlantUse[],dedicated:node.dataset.lifeDedicated==='true',node}));
  const mapped:(MappedPlant&{node?:HTMLElement})[]=[...LOCATION_PLANTS[plantLocation(location)],...dynamic];
  return mapped.flatMap(plant => {
    const layer = plant.node??scene.querySelector<HTMLElement>(`[data-layer="${plant.layer}"]`);
    if (!layer) return [];
    if(layer.dataset.gardenReady==='false')return [];
    const style = getComputedStyle(layer);
    if (style.display === 'none' || style.visibility === 'hidden') return [];
    if (style.clipPath && style.clipPath !== 'none' && ((plant.layer === 'foreground-reeds' && plant.x >= .5) || (plant.layer === 'foreground-reeds-right' && plant.x < .5))) return [];
    const rect = layer.getBoundingClientRect();
    // Reed and flower wrappers contain an already mirrored local anchor.
    const flipped=!layer.dataset.lifeSprite&&style.getPropertyValue('--flip-x').trim()==='-1';
    const x = (rect.left - bounds.left + rect.width * (flipped?1-plant.x:plant.x)) / bounds.width;
    const y = (rect.top - bounds.top + rect.height * plant.y) / bounds.height;
    // Tall stalks have the depth of their root, not the height of a flower tip.
    // Recompute from the responsive shore frame instead of a fixed per-species z.
    const rootY=layer.dataset.lifeRootY!==undefined?Number(layer.dataset.lifeRootY):undefined;
    const groundY=(rect.top-bounds.top+rect.height*(rootY??Math.max(plant.y,.9)))/bounds.height;
    const z=plant.layer.includes('branches')?Math.min(plant.z,foregroundDepth(camera)-foregroundClearance(camera)):
      Math.min(foregroundDepth(camera)-foregroundClearance(camera),depthAtWaterline(groundY,horizon,camera));
    let px=0,py=0;
    for(let node:HTMLElement|null=layer;node&&node!==scene;node=node.parentElement){
      const p=Number(node.style.getPropertyValue('--parallax'))||0;
      px+=p+(Number(node.style.getPropertyValue('--ground-parallax'))||0)+(Number(node.style.getPropertyValue('--flower-parallax-x'))||0);
      py+=p+(Number(node.style.getPropertyValue('--flower-parallax-y'))||0);
    }
    const moving=layer.closest<HTMLElement>('[data-water-start]');
    const water=moving&&!scene.classList.contains('f-reduced-motion')&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?
      {start:Number(moving.dataset.waterStart),period:Number(moving.dataset.waterPeriod),phase:Number(moving.dataset.waterPhase)}:undefined;
    const motion={baseX:x-sceneX*px/bounds.width,baseY:y-sceneY*py/bounds.height-(water?waterBob(water,performance.now())/bounds.height:0),
      px:px/bounds.width,py:py/bounds.height,water,sceneHeight:bounds.height};
    const {node,...mappedPlant}=plant;
    return x > .025 && x < .975 && y > .035 && y < .965 ? [{ ...mappedPlant, x, y,z, motion }] : [];
  });
}

export function planPlantVisit(flight: FlightState, plants: PlantPerch[], use: PlantUse, random: Random) {
  const suitable = plants.filter(plant => plant.uses.includes(use));
  if (!suitable.length) return;
  flight.plants = suitable;
  const odonate = use === 'dragonfly' || use === 'damselfly';
  const reeds=suitable.filter(plant=>plant.dedicated),choices=odonate&&reeds.length&&random()<.85?reeds:suitable;
  const plant = choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
  planPerch(flight, plant.x, plant.y-(flight.pattern==='hover'?.018:0), random, { plantId: plant.id, z: plant.z, repeats: odonate ? 2 : 0, hoverFeed: flight.pattern==='hover',
    restFrame: use === 'dragonfly' ? 0 : use === 'damselfly' ? 3 : undefined });
}

/** Refresh after a lifecycle/layout change. Retire the old occupancy before
 * assigning a new destination, including when a bloom is no longer nectar. */
export function refreshPlantTargets(flight:FlightState,plants:PlantPerch[],use:PlantUse,random:Random) {
  const compatible=plants.filter(plant=>plant.uses.includes(use));flight.plants=compatible;
  const perch=flight.perch,plant=compatible.find(candidate=>candidate.id===perch?.plantId);
  if(!plant||!perch||perch.finished){
    if(perch){perch.finished=true;flight.turnIn=0;flight.flowerWait=undefined;}
    if(!flight.fleeing&&!flight.behindForeground&&flight.age<flight.departAt-8)planPlantVisit(flight,compatible,use,random);
    return;
  }
  perch.x=plant.x;perch.y=plant.y-(perch.hoverFeed?.018:0);perch.z=plant.z;
  if(isPerched(flight)){flight.x=perch.x;flight.y=perch.y;flight.z=plant.z;}
}
