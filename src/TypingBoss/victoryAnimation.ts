import {CombatAnimation} from './combatAnimation';
import {TypingBossClassId,TypingBossPlayer,TypingBossSessionSnapshot} from './types';

export const VICTORY_CELEBRATION_MS=4800;
export const VICTORY_MOTION:Record<TypingBossClassId,{cycleMs:number;lift:number;lean:number;row:number}>={
  paladin:{cycleMs:1250,lift:34,lean:3,row:2},
  cleric:{cycleMs:1200,lift:48,lean:-4,row:2},
  barbarian:{cycleMs:1100,lift:57,lean:-7,row:2},
  rogue:{cycleMs:850,lift:64,lean:9,row:2},
  necromancer:{cycleMs:1400,lift:40,lean:-3,row:2},
  monk:{cycleMs:1000,lift:72,lean:0,row:2},
};

export function partyVictoryAt(session:TypingBossSessionSnapshot) {
  const at=session.status==='victory'?Date.parse(session.closedAt || ''):NaN;
  return Number.isFinite(at)?at:undefined;
}
export function playerVictoryPose(player:TypingBossPlayer,at:number|undefined):CombatAnimation|undefined {
  if(at===undefined || player.defeated || player.timedOut || player.hp<=0)return;
  return {id:`victory:${at}:${player.code}`,state:'victory',at,duration:VICTORY_CELEBRATION_MS};
}
