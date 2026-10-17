import { Season } from '../engine/types';

export interface FoliageArt { image:string; flowers:{x:number;y:number}[]; leaf:{x:number;y:number} }
const art:Partial<Record<string,Partial<Record<Season,FoliageArt[]>>>>=require('../data/foliage.json');
export interface FoliageStation { id:string; label:string; layer:string; x:number;y:number;width:number;z:number }
export const FOLIAGE_STATIONS:Record<'dock'|'cove'|'birch',FoliageStation[]>={
  dock:[
    {id:'dock-flowers-1',label:'Upper bank flowers',layer:'near-shore',x:.24,y:.58,width:.15,z:.32},
    {id:'dock-flowers-2',label:'Middle bank flowers',layer:'near-shore',x:.44,y:.68,width:.16,z:.30},
    {id:'dock-flowers-3',label:'Low bank flowers',layer:'near-shore',x:.66,y:.78,width:.17,z:.28},
    {id:'dock-flowers-4',label:'Dockside flowers',layer:'near-shore',x:.84,y:.84,width:.16,z:.27},
    {id:'dock-flowers-5',label:'Right bank asters',layer:'right-grassy-bank',x:.40,y:.71,width:.25,z:.28},
    {id:'dock-flowers-6',label:'Right bank wildflowers',layer:'right-grassy-bank',x:.70,y:.84,width:.23,z:.25},
  ],
  cove:[
    {id:'cove-flowers-1',label:'Willow-root flowers',layer:'cove-seat',x:.10,y:.78,width:.060,z:.26},
    {id:'cove-flowers-2',label:'Left ledge flowers',layer:'cove-seat',x:.20,y:.90,width:.065,z:.25},
    {id:'cove-flowers-3',label:'Low ledge wildflowers',layer:'cove-seat',x:.27,y:.95,width:.070,z:.23},
    {id:'cove-flowers-4',label:'Waterside flowers',layer:'cove-seat',x:.47,y:.89,width:.065,z:.28},
    {id:'cove-flowers-5',label:'Outer bank flowers',layer:'cove-seat',x:.57,y:.98,width:.065,z:.24},
    {id:'cove-flowers-6',label:'Rootside wildflowers',layer:'cove-seat',x:.12,y:.64,width:.055,z:.30},
  ],
  birch:[
    {id:'birch-flowers-1',label:'Birch-root flowers',layer:'birch-seat',x:.07,y:.78,width:.047,z:.27},
    {id:'birch-flowers-2',label:'Low left wildflowers',layer:'birch-seat',x:.14,y:.94,width:.050,z:.24},
    {id:'birch-flowers-3',label:'Lower ledge flowers',layer:'birch-seat',x:.22,y:.98,width:.050,z:.22},
    {id:'birch-flowers-4',label:'Granite-edge flowers',layer:'birch-seat',x:.365,y:.77,width:.043,z:.29},
    {id:'birch-flowers-5',label:'Lower granite flowers',layer:'birch-seat',x:.385,y:.98,width:.050,z:.24},
    {id:'birch-flowers-6',label:'Right bank flowers',layer:'birch-right-plants',x:.91,y:.99,width:.045,z:.26},
  ],
};
export const foliageStations=(location:string)=>FOLIAGE_STATIONS[location==='birch'?'birch':location==='cove'?'cove':'dock'];
export const foliageArt=(location:string,season:Season)=>season==='winter'?[]:art[location]?.[season]??[];
