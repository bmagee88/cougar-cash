import { FlightState, planPerch } from './butterflyFlight';
import { Random, Season } from '../engine/types';
import { foliageArt, foliageStations } from './foliage';

export type PlantUse = 'butterfly' | 'moth' | 'dragonfly' | 'damselfly';
export interface MappedPlant {
  id: string; label: string; layer: string; x: number; y: number; z: number;
  kind: 'flower' | 'leaf' | 'stem'; uses: PlantUse[];
}
export interface PlantPerch extends MappedPlant { }
const flowers: PlantUse[] = ['butterfly'], leaves: PlantUse[] = ['butterfly', 'moth', 'dragonfly', 'damselfly'], stems: PlantUse[] = ['dragonfly', 'damselfly'];
// Anchors are in each cutout's original 0–1 artwork frame, never viewport pixels.
// These are visual habitat labels, not claims about the painted plant's species.
export const LOCATION_PLANTS: Record<'dock' | 'cove' | 'birch', MappedPlant[]> = {
  dock: [
    { id:'dock-left-reed-tip', label:'Left reed tip', layer:'foreground-reeds', x:.12,y:.45,z:.24,kind:'stem',uses:stems },
    { id:'dock-left-reed-leaf', label:'Left reed leaf', layer:'foreground-reeds', x:.20,y:.70,z:.30,kind:'leaf',uses:leaves },
    { id:'dock-right-reed-tip', label:'Right reed tip', layer:'foreground-reeds-right', x:.88,y:.78,z:.28,kind:'stem',uses:stems },
    { id:'dock-right-reed-leaf', label:'Right reed leaf', layer:'foreground-reeds-right', x:.81,y:.68,z:.32,kind:'leaf',uses:leaves },
    { id:'dock-bank-flower', label:'Bank flower patch', layer:'near-shore', x:.69,y:.46,z:.35,kind:'flower',uses:flowers },
    { id:'dock-bank-leaf', label:'Bank grasses', layer:'near-shore', x:.55,y:.53,z:.36,kind:'leaf',uses:leaves },
  ],
  cove: [
    { id:'cove-left-flowers', label:'Flowers by the roots', layer:'cove-seat', x:.11,y:.72,z:.25,kind:'flower',uses:flowers },
    { id:'cove-ledge-flowers', label:'Flowers along the ledge', layer:'cove-seat', x:.31,y:.84,z:.30,kind:'flower',uses:flowers },
    { id:'cove-bank-flowers', label:'Lower bank flowers', layer:'cove-seat', x:.43,y:.92,z:.26,kind:'flower',uses:flowers },
    { id:'cove-bank-stalk', label:'Waterside stalk', layer:'cove-seat', x:.56,y:.85,z:.28,kind:'stem',uses:stems },
    { id:'cove-root-leaves', label:'Leaves beside the trunk', layer:'cove-seat', x:.16,y:.61,z:.25,kind:'leaf',uses:leaves },
    { id:'cove-willow-leaf', label:'Hanging willow leaf', layer:'willow-branches-left', x:.50,y:.70,z:.40,kind:'leaf',uses:leaves },
  ],
  birch: [
    { id:'birch-ledge-flowers', label:'Left ledge flowers', layer:'birch-seat', x:.11,y:.72,z:.25,kind:'flower',uses:flowers },
    { id:'birch-seat-flowers', label:'Low bank flowers', layer:'birch-seat', x:.075,y:.93,z:.28,kind:'flower',uses:flowers },
    { id:'birch-bank-leaves', label:'Leaves beside the ledge', layer:'birch-seat', x:.365,y:.75,z:.25,kind:'leaf',uses:leaves },
    { id:'birch-right-stalk', label:'Tall right-bank stalk', layer:'birch-right-plants', x:.96,y:.86,z:.28,kind:'stem',uses:stems },
    { id:'birch-right-leaves', label:'Right-bank leaves', layer:'birch-right-plants', x:.89,y:.95,z:.26,kind:'leaf',uses:leaves },
    { id:'birch-left-stalk', label:'Stalk beside the roots', layer:'birch-seat', x:.08,y:.67,z:.26,kind:'stem',uses:stems },
  ],
};
export function plantsForLocation(location:string,season:Season='summer'):MappedPlant[] {
  const art=foliageArt(location,season);
  const stations=foliageStations(location).flatMap((station,index)=>{
    const patch=art[index];if(!patch)return [];
    return [...patch.flowers.map((point,n)=>({id:`${station.id}-bloom-${n+1}`,label:`${station.label} ${n+1}`,layer:station.id,...point,z:station.z,kind:'flower' as const,uses:flowers})),
      {id:`${station.id}-leaf`,label:`${station.label} leaf`,layer:station.id,...patch.leaf,z:station.z,kind:'leaf' as const,uses:leaves}];
  });
  return [...LOCATION_PLANTS[location==='birch'?'birch':location==='cove'?'cove':'dock'],...stations];
}

export function visiblePlantPerches(scene: HTMLElement, location: string, bounds: DOMRect): PlantPerch[] {
  if (!bounds.width || !bounds.height) return [];
  const season=(scene.dataset.season??'summer') as Season;
  return plantsForLocation(location,season).flatMap(plant => {
    const layer = scene.querySelector<HTMLElement>(`[data-layer="${plant.layer}"]`);
    if (!layer) return [];
    const style = getComputedStyle(layer);
    if (style.display === 'none' || style.visibility === 'hidden') return [];
    if (style.clipPath && style.clipPath !== 'none' && ((plant.layer === 'foreground-reeds' && plant.x >= .5) || (plant.layer === 'foreground-reeds-right' && plant.x < .5))) return [];
    const rect = layer.getBoundingClientRect();
    const x = (rect.left - bounds.left + rect.width * plant.x) / bounds.width;
    const y = (rect.top - bounds.top + rect.height * plant.y) / bounds.height;
    return x > .025 && x < .975 && y > .035 && y < .965 ? [{ ...plant, x, y }] : [];
  });
}

export function planPlantVisit(flight: FlightState, plants: PlantPerch[], use: PlantUse, random: Random) {
  const suitable = plants.filter(plant => plant.uses.includes(use));
  if (!suitable.length) return;
  flight.plants = suitable;
  const plant = suitable[Math.min(suitable.length - 1, Math.floor(random() * suitable.length))];
  const odonate = use === 'dragonfly' || use === 'damselfly';
  planPerch(flight, plant.x, plant.y-(flight.pattern==='hover'?.018:0), random, { plantId: plant.id, z: plant.z, repeats: odonate ? 2 : 0, hoverFeed: flight.pattern==='hover',
    restFrame: use === 'dragonfly' ? 0 : use === 'damselfly' ? 3 : undefined });
}
