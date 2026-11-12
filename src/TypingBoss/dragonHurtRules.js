// Shared by server scheduling and client sprite playback.
const DRAGON_HURT = {
  basic: { rank: 1, frames: 3, duration: 300, start: 0 },
  power: { rank: 2, frames: 6, duration: 660, start: 3 },
  critical: { rank: 3, frames: 10, duration: 1200, start: 9 },
};
const DRAGON_FLAME = { frames: 20, duration: 2000, windup: 600, flight: 1100, columns: 5, rows: 4 };

function dragonHurtTier(hit) {
  if (hit.target !== "boss" || hit.kind !== "damage" || !(hit.amount > 0) || !hit.resolvedAt ||
      hit.willHit === false || hit.result === "miss" || hit.result === "evade" || hit.result === "pending") return null;
  return hit.critical ? "critical" : hit.moveId === "strong" ? "power" : "basic";
}

function dragonAttackDuration(attack) {
  return attack.bossAttack === "flamethrower" ? DRAGON_FLAME.duration : attack.bossAttack === "bite" || attack.bossAttack === "tailWhip" ? 820 : attack.moveId === "strong" ? 780 : 620;
}

module.exports = { DRAGON_HURT, DRAGON_FLAME, dragonHurtTier, dragonAttackDuration };
