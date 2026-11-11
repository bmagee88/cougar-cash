import { TypingBossProjectile } from "./types";

export const COMBAT_COLORS = {
  damage: "#f87171", healing: "#facc15", shield: "#60a5fa", dodge: "#4ade80", miss: "#cbd5e1",
};
type Point = { x: number; y: number };
export const isSupport = (projectile: TypingBossProjectile) => ["heal", "resurrect", "buff"].includes(projectile.kind);

export function combatFeedback(projectile: TypingBossProjectile) {
  const amount = Number((projectile.amount || 0).toFixed(2));
  const blocked = Number((projectile.blockedAmount || 0).toFixed(2));
  if (projectile.evadeType === "dodge" || projectile.result === "evade") return { color: COMBAT_COLORS.dodge, label: "DODGED!" };
  if (projectile.result === "miss") return { color: COMBAT_COLORS.miss, label: "MISS" };
  if (projectile.kind === "heal" || projectile.kind === "resurrect") return {
    color: COMBAT_COLORS.healing, label: `${projectile.kind === "heal" ? "HEAL" : "REVIVE"} +${amount}`,
  };
  if (projectile.kind === "buff") return { color: COMBAT_COLORS.shield,
    label: projectile.moveId === "goldShield" ? `SHIELD +${amount}` : "BUFF" };
  if (amount === 0 && blocked > 0) return { color: COMBAT_COLORS.shield, label: `SHIELD ${blocked}` };
  return { color: COMBAT_COLORS.damage, label: `−${amount}` };
}

export function projectileEndpoints(projectile: TypingBossProjectile, positions: Map<string, Point>, bossPoint: Point) {
  const support = isSupport(projectile);
  const targetOffscreen = support && !positions.has(projectile.target);
  // Personal streams omit allies. Route their support to a separate notice, never to the dragon or caster.
  return {
    from: projectile.source === "boss" ? bossPoint : positions.get(projectile.source) || (support ? { x: 8, y: 26 } : bossPoint),
    to: projectile.target === "boss" ? bossPoint : positions.get(projectile.target) || (support ? { x: 26, y: 22 } : bossPoint),
    targetOffscreen,
  };
}
