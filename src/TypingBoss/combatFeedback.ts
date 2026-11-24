import {combatNumber} from './combatNumbers';
import { TypingBossProjectile } from "./types";

export const COMBAT_COLORS = {
  damage: "#f87171", healing: "#facc15", shield: "#60a5fa", dodge: "#4ade80", miss: "#cbd5e1",
};
type Point = { x: number; y: number };
export const isSupport = (projectile: TypingBossProjectile) => ["heal", "resurrect", "buff"].includes(projectile.kind);

export function combatFeedback(projectile: TypingBossProjectile) {
  const amount = combatNumber(projectile.amount || 0);
  const blocked = projectile.blockedAmount || 0;
  if(projectile.evadeType==='secondWind')return {color:COMBAT_COLORS.dodge,label:'SECOND WIND · PROTECTED'};
  if(projectile.evadeType==='prone')return {color:COMBAT_COLORS.dodge,label:"PRONE · NO DAMAGE"};
  if (projectile.evadeType === "dodge" || projectile.result === "evade") return { color: COMBAT_COLORS.dodge, label: "DODGED!" };
  if (projectile.result === "miss") return { color: COMBAT_COLORS.miss, label: "MISS" };
  if (projectile.kind === "heal" || projectile.kind === "resurrect") return {
    color: COMBAT_COLORS.healing, label: `${projectile.kind === "heal" ? "HEAL" : "REVIVE"} +${amount}`,
  };
  if (projectile.kind === "buff") return { color: COMBAT_COLORS.shield,
    label: projectile.moveId === "goldShield" ? "BLOCK" : "BUFF" };
  if (!projectile.amount && blocked > 0) return { color: COMBAT_COLORS.shield, label: "BLOCK" };
  return { color: COMBAT_COLORS.damage, label: `−${amount}` };
}

export function projectileEndpoints(projectile: TypingBossProjectile, positions: Map<string, Point>, bossPoint: Point) {
  const support = isSupport(projectile);
  const targetOffscreen = support && !positions.has(projectile.target);
  const owner=positions.get(projectile.source);
  // Personal streams omit allies. Route their support to a separate notice, never to the dragon or caster.
  return {
    from: projectile.summonSlot!==undefined && owner ? {x:owner.x-2+projectile.summonSlot*1.5,y:owner.y-2} : projectile.source === "boss" ? bossPoint : owner || (support ? { x: 8, y: 26 } : bossPoint),
    to: projectile.target === "boss" ? bossPoint : positions.get(projectile.target) || (support ? { x: 26, y: 22 } : bossPoint),
    targetOffscreen,
  };
}
