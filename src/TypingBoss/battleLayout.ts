// All scenery assets share this native aspect ratio. One camera scales the
// entire battlefield; actors never apply a second viewport-dependent scale.
export const BATTLE_WIDTH=1000;
export const BATTLE_HEIGHT=BATTLE_WIDTH*941/1672;
export function battleScale(width:number,height:number) {
  return Math.max(0,Math.min(width/BATTLE_WIDTH,height/BATTLE_HEIGHT));
}
