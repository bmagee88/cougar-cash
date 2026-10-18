export type ShoreWaveArea='dock'|'dock-right'|'dock-posts'|'birch'|'cove';
interface WaveletArt {image:string;width:number;height:number;crestY:number}
export const WAVELET_ART:WaveletArt[]=require('../data/shore-wavelets.json');
export interface ShoreWavePoint {x:number;y:number;width:number;angle:number;art:number;period:number;phase:number;reach:number}
type Placement=[number,number,number,number,number];
const placements:Record<ShoreWaveArea,Placement[]>={
  dock:[[-15,337,96,14,0],[77,377,92,27,2],[397,497,83,19,3]],
  'dock-right':[[175,282,105,-25,1],[290,245,118,-18,0],[405,201,103,-28,4],[506,157,85,-32,2]],
  'dock-posts':[[350,478,80,8,5],[418,484,102,12,2]],
  birch:[[379,364,71,35,0],[413,392,78,29,1],[474,424,65,38,3],[385,445,74,167,2],[369,460,62,-3,5],[445,484,78,38,4]],
  cove:[[587,438,95,20,0],[715,475,103,22,2],[884,515,96,24,1],[947,551,94,35,4]],
};
/** Each short front approaches along its own bank normal. Unequal durations,
 * spacing, shapes and phases avoid a single traveling outline/metronome. */
export const SHORE_WAVE_POINTS=Object.fromEntries(Object.entries(placements).map(([area,points])=>[area,points.map(([x,y,width,angle,art],i)=>{
  // Grass cutouts include overhanging blades. Begin just outside their opaque
  // fringe; the existing bank naturally hides the end of each arrival.
  const fringe=area==='dock'||area==='dock-right'?18:0,radians=angle*Math.PI/180;
  return {x:x+Math.sin(radians)*fringe,y:y-Math.cos(radians)*fringe,width,angle,art,
    period:5.8+(i*7%9)*.33,phase:-(i*1.43+(area.length%4)*.71),reach:area==='dock-posts'?45:65+(i%3)*12};
})])) as Record<ShoreWaveArea,ShoreWavePoint[]>;
