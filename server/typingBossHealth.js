// Player HP mirrors the authoritative shared pool in Team mode.
function syncTeamHealth(session) {
  if (!session.teamMode || !session.teamHealth) return;
  for (const player of session.players.values()) {
    if(player.timedOut)continue;
    player.hp = session.teamHealth.hp;
    player.maxHp = session.teamHealth.maxHp;
    player.secondWindWordsRemaining = 0;
    player.sharedHealth = true;
  }
}
function changePlayerHealth(session, player, change) {
  if(player.timedOut)return 0;
  const health = session.teamMode ? session.teamHealth : player;
  const before = health.hp;
  health.hp = Math.max(0, Math.min(health.maxHp, before + change));
  if (session.teamMode) syncTeamHealth(session);
  return health.hp - before;
}
function resetTeamHealth(session, maxHp) {
  for(const player of session.players.values())player.sharedHealth=Boolean(session.teamMode);
  session.teamHealth = session.teamMode ? {hp: maxHp, maxHp} : null;
  syncTeamHealth(session);
}
const activePlayers=session=>[...session.players.values()].filter(player=>!player.timedOut);
module.exports = {syncTeamHealth, changePlayerHealth, resetTeamHealth, activePlayers};
