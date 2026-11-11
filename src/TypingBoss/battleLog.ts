import { TypingBossProjectile, TypingBossSessionSnapshot } from "./types";

export const MAX_BATTLE_LOG_ENTRIES = 200;
export type BattleLogCategory = "Damage" | "Healing" | "Shield" | "Dodge" | "Miss" | "Buff" | "Game";
export type BattleLogEntry = { id: string; at: number; category: BattleLogCategory; message: string; detail?: string };
export type BattleLogHistory = { roomId: string; status: string; seen: Set<string>; entries: BattleLogEntry[] };
export const emptyBattleLog = (roomId: string): BattleLogHistory => ({ roomId, status: "", seen: new Set(), entries: [] });
const number = (value: number | null | undefined) => Number((value || 0).toFixed(2)).toLocaleString();

function projectileEntries(projectile: TypingBossProjectile, session: TypingBossSessionSnapshot): BattleLogEntry[] {
  if (!projectile.resolvedAt || projectile.result === "pending") return [];
  const names = (code: string) => code === "boss" ? session.boss.name : session.players.find(player => player.code === code)?.name;
  const source = names(projectile.source) || projectile.sourceName || "Player";
  const target = names(projectile.target) || projectile.targetName || "Ally";
  const entry = { id: `combat:${projectile.id}`, at: projectile.resolvedAt,
    detail: [projectile.moveLabel, projectile.critical ? projectile.balanced ? "Skill strike" : "Critical hit" : "",
      projectile.multiplier && projectile.multiplier !== 1 ? `Attack multiplier ×${number(projectile.multiplier)}` : ""].filter(Boolean).join(" · ") };
  if (projectile.result === "evade") return [{ ...entry, category: "Dodge", message: `${target} dodged ${source}'s attack.` }];
  if (projectile.result === "miss") return [{ ...entry, category: "Miss", message: `${source}'s ${projectile.moveLabel || "attack"} missed ${target}.` }];
  const amount = number(projectile.amount);
  if (projectile.kind === "heal") return [{ ...entry, category: "Healing", message: `${source} healed ${target} for ${amount} HP.` }];
  if (projectile.kind === "resurrect") return [{ ...entry, category: "Healing", message: `${source} revived ${target} with ${amount} HP.` }];
  if (projectile.kind === "buff") return [{ ...entry, category: projectile.moveId === "goldShield" ? "Shield" : "Buff",
    message: projectile.moveId === "goldShield" ? `${source} gave ${target} a ${amount} HP shield.` : `${source} buffed ${target}.` }];
  const entries: BattleLogEntry[] = [];
  if ((projectile.amount || 0) > 0 || !projectile.blockedAmount) entries.push({ ...entry, category: "Damage",
    message: `${source} dealt ${amount} damage to ${target}.` });
  if (projectile.blockedAmount) entries.push({ ...entry, id: `${entry.id}:shield`, category: "Shield",
    message: `${target} blocked ${number(projectile.blockedAmount)} damage from ${source}.` });
  return entries;
}

export function captureBattleLog(previous: BattleLogHistory, session: TypingBossSessionSnapshot): BattleLogHistory {
  const history = previous.roomId === session.id ? previous : emptyBattleLog(session.id);
  const now = session.serverNow || Date.now();
  const events: BattleLogEntry[] = session.mode === "old" ? session.log.map(entry => ({
    id: `legacy:${entry.id}`, at: Date.parse(entry.createdAt) || now, message: entry.message,
    category: entry.tone === "heal" ? /buff|shield/i.test(entry.message) ? "Buff" : "Healing" :
      entry.tone === "evade" ? "Dodge" : entry.tone === "hit" || entry.tone === "danger" ? "Damage" : entry.tone === "miss" ? "Miss" : "Game",
  })) : session.projectiles.flatMap(projectile => projectileEntries(projectile, session));
  const seen = new Set(events.map(entry => entry.id));
  const fresh = events.filter(entry => !history.seen.has(entry.id));
  if (history.status !== session.status) {
    const messages = { setup: "Room ready. Waiting for the battle to start.", active: "Battle started.",
      victory: "Players won. The dragon was defeated.", defeat: "The dragon won. All players were knocked out.",
      closed: "The host closed the game.", expired: "The room expired." };
    fresh.push({ id: `status:${session.status}:${now}`, at: Date.parse(session.closedAt || "") || now, category: "Game",
      message: !history.status && session.status === "active" ? "Host connected to an active battle." : messages[session.status] });
  }
  // Only track IDs still in the live snapshot; this deduplication set drains along with the stream.
  if (!fresh.length && seen.size === history.seen.size && [...seen].every(id => history.seen.has(id))) return history;
  return { roomId: session.id, status: session.status, seen,
    entries: [...fresh, ...history.entries].sort((a, b) => b.at - a.at).slice(0, MAX_BATTLE_LOG_ENTRIES) };
}
