import { CombatAnimation, CombatPose } from "./combatAnimation";

export const DRAGON_ATTACK_ROWS: Partial<Record<CombatPose, number>> = {
  bite: 0, weakAttack: 1, strongAttack: 1, tailWhip: 2, flamethrower: 3,
};

export function dragonSpriteAction(pose: CombatAnimation) {
  if (pose.action?.state === "flamethrower") return pose.action;
  if (pose.state === "flamethrower") return pose;
  if (pose.hurtTier === "power" || pose.hurtTier === "critical") return undefined;
  // Attacks outrank basic hurt only; stronger reactions own the sprite.
  if (pose.action && DRAGON_ATTACK_ROWS[pose.action.state] !== undefined) return pose.action;
  return DRAGON_ATTACK_ROWS[pose.state] !== undefined ? pose : undefined;
}

export function dragonSpriteDelay(at: number, duration: number, now: number) {
  return -Math.max(0, Math.min(duration, now - at));
}
