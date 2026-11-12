import { useEffect, useState } from "react";
import { CombatAnimation, CombatAnimationEvent, selectCombatAnimation } from "./combatAnimation";
import { DRAGON_HURT } from "./dragonHurtRules";
import { DragonFlameBreath, DragonHurt } from "./types";

// A legacy room may not have the authoritative hurt field yet. Reconstruct its
// reactions in timestamp order so later weak hits can't hide an earlier critical.
function legacyHurt(events: readonly CombatAnimationEvent[], now: number): DragonHurt | null {
  let hurt: DragonHurt | null = null;
  const ordered = events.filter(event => event.at <= now).slice().sort((a, b) => a.at - b.at);
  for (const event of ordered) {
    if (event.channel === "action") {
      if (hurt?.tier === "basic") hurt = null;
      continue;
    }
    if (event.state !== "hit") continue;
    const tier = event.hurtTier || (event.critical ? "critical" : "basic");
    if (hurt && hurt.until > event.at && DRAGON_HURT[hurt.tier].rank >= DRAGON_HURT[tier].rank) continue;
    if (tier === "basic" && ordered.some(action => action.channel === "action" && action.at <= event.at && action.at + action.duration > event.at)) continue;
    hurt = { id: event.id, tier, at: event.at, until: event.at + DRAGON_HURT[tier].duration };
  }
  return hurt;
}

export function selectDragonCombatAnimation(events: readonly CombatAnimationEvent[], authoritativeHurt: DragonHurt | null | undefined, now: number, defeated = false, flameBreath?: DragonFlameBreath | null): CombatAnimation {
  if (defeated) return selectCombatAnimation(events, now, true);
  const flame = flameBreath && flameBreath.at <= now && now < flameBreath.until ? {
    id: `${flameBreath.id}:action`, state: "flamethrower" as const, at: flameBreath.at,
    duration: flameBreath.until - flameBreath.at, channel: "action" as const,
  } : events.filter(event => event.state === "flamethrower" && event.channel === "action" && event.at <= now && now < event.at + event.duration)
    .sort((a,b) => b.at - a.at)[0];
  // Once flame breath starts it owns the full body until its twentieth frame.
  if (flame) return { ...flame, action: flame, nextAt: flame.at + flame.duration };
  // Ignored hits still award damage and impact text, but cannot replace the
  // authoritative reaction or restart its sprite frames.
  const base = selectCombatAnimation(events.filter(event => event.state !== "hit"), now);
  const hurt = authoritativeHurt === undefined ? legacyHurt(events, now) : authoritativeHurt;
  if (!hurt || now < hurt.at || now >= hurt.until || (hurt.tier === "basic" && base.action)) return base;
  const reaction: CombatAnimationEvent = { id: `dragon-hurt:${hurt.id}`, state: "hit", at: hurt.at,
    duration: hurt.until - hurt.at, channel: "reaction", hurtTier: hurt.tier, critical: hurt.tier === "critical" };
  return { ...reaction, reaction, block: base.block, nextAt: hurt.until };
}

export function useDragonCombatAnimation(events: readonly CombatAnimationEvent[], hurt: DragonHurt | null | undefined, defeated: boolean, clock: React.MutableRefObject<number>, flameBreath?: DragonFlameBreath | null) {
  const [, redraw] = useState(0);
  const pose = selectDragonCombatAnimation(events, hurt, Date.now() + clock.current, defeated, flameBreath);
  const deadline = pose.nextAt;
  useEffect(() => {
    if (deadline === undefined) return;
    const timer = window.setTimeout(() => redraw(value => value + 1), Math.max(1, deadline - Date.now() - clock.current) + 8);
    return () => window.clearTimeout(timer);
  }, [deadline, clock]);
  return pose;
}
