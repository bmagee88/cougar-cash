import { Season, Weather } from '../engine/types';
import { butterflyTime, eligibleButterflies } from '../engine/butterflies';

export const BUTTERFLY_VISIT_CHANCE:Record<Season,number>={spring:.7,summer:.4,autumn:.12,winter:0};
export function butterflyActivity(season:Season,hour:number,weather:Weather):number {
  if(hour<7||hour>=18||!['sunny','overcast','heatwave'].includes(weather))return 0;
  return BUTTERFLY_VISIT_CHANCE[season]*(weather==='overcast'?.45:weather==='heatwave'?.7:1);
}
export function butterflyCount(random:()=>number):number {
  const roll=random();return roll<.70?1:roll<.94?2:3;
}
export function visitorActivity(season:Season,hour:number,weather:Weather):number {
  if(!eligibleButterflies(season,hour,weather).length)return 0;
  return BUTTERFLY_VISIT_CHANCE[season]*(butterflyTime(hour)==='night'?.65:1)*(weather==='overcast'?.45:weather==='heatwave'?.7:1);
}
