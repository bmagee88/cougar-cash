import { DragonHurtTier, TypingBossProjectile } from "./types";
export const DRAGON_HURT: Record<DragonHurtTier, { rank: number; frames: number; duration: number; start: number }>;
export const DRAGON_FLAME: { frames: number; duration: number; windup: number; flight: number; columns: number; rows: number };
export function dragonHurtTier(hit: Partial<TypingBossProjectile> & { willHit?: boolean }): DragonHurtTier | null;
export function dragonAttackDuration(attack: { bossAttack?: string; moveId?: string | null }): number;
