import { TypingBossPlayer, TypingBossProjectile, TypingBossSessionSnapshot, TypingBossTypingState } from "./types";

export type SessionPatch = Partial<Omit<TypingBossSessionSnapshot, "players" | "boss" | "typing" | "projectiles">> & {
  players?: (Partial<TypingBossPlayer> & { code: string })[];
  boss?: Partial<TypingBossSessionSnapshot["boss"]>;
  typing?: Partial<TypingBossTypingState>;
  projectiles?: (Partial<TypingBossProjectile> & { id: string })[];
  removeProjectiles?: string[];
};

export function acceptSessionSnapshot(previous: TypingBossSessionSnapshot | null, incoming: TypingBossSessionSnapshot) {
  if (previous?.id === incoming.id && incoming.mode === "proportional") {
    if ((incoming.revision || 0) < (previous.revision || 0)) return previous;
    if (incoming.revision === previous.revision && (incoming.serverNow || 0) < (previous.serverNow || 0)) return previous;
  }
  return incoming;
}

export function applySessionPatch(session: TypingBossSessionSnapshot, patch: SessionPatch): TypingBossSessionSnapshot {
  if (patch.revision !== undefined && patch.revision < (session.revision || 0)) return session;
  const { players, projectiles, removeProjectiles, boss, typing, ...rest } = patch;
  let nextPlayers = session.players;
  if (players) {
    const changes = new Map(players.map(player => [player.code, player]));
    nextPlayers = session.players.map(player => changes.has(player.code) ? { ...player, ...changes.get(player.code) } : player);
    const known = new Set(session.players.map(player => player.code));
    nextPlayers.push(...players.filter(player => !known.has(player.code)) as TypingBossPlayer[]);
  }
  let nextProjectiles = session.projectiles;
  if (projectiles || removeProjectiles) {
    const changes = new Map((projectiles || []).map(item => [item.id, item]));
    const removed = new Set(removeProjectiles || []);
    nextProjectiles = session.projectiles.filter(item => !removed.has(item.id)).map(item => changes.has(item.id) ? { ...item, ...changes.get(item.id) } : item);
    const known = new Set(session.projectiles.map(item => item.id));
    nextProjectiles.push(...(projectiles || []).filter(item => !known.has(item.id)) as TypingBossProjectile[]);
  }
  return { ...session, ...rest, boss: boss ? { ...session.boss, ...boss } : session.boss,
    typing: typing ? { ...session.typing!, ...typing } : session.typing,
    players: nextPlayers, projectiles: nextProjectiles };
}
