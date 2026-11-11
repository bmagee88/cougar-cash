import { TypingBossClassId } from "./types";
import registration from "./characterRegistration";

export function combatAtlasCellWidth(classId:TypingBossClassId) { return registration[classId].cellWidth; }
export function combatAtlasCellHeight(classId:TypingBossClassId) { return registration[classId].cellHeight; }
export function combatAtlasFilename(classId:TypingBossClassId) { return registration[classId].filename; }

export function spriteFrameOffsets(classId: TypingBossClassId, row: number, combatAtlas=false) {
  const config=registration[classId];
  // Keep the three approved legacy idle strips. They have their own cell geometry.
  if(!combatAtlas&&["paladin","cleric","barbarian"].includes(classId))return [0,0,0,0,0,0];
  const width=combatAtlas?config.cellWidth:96;
  const padding=combatAtlas?0:(config.cellWidth-96)/2;
  const stable=row===0||row===2||row===3||(row===1&&config.repairedWeapon);
  return Array.from({length:6},(_,frame)=>{
    // Stable casts/heals use their own footing. Moving reactions retain their
    // drawn motion, with only the atlas's underlying idle drift removed.
    const standingEnd=((row===4||row===5)&&(frame===0||frame===5))||(row===6&&frame===5);
    const anchor=config.anchors[stable||standingEnd?row:0][frame]-padding;
    return (width/2-anchor)/width*100;
  });
}
