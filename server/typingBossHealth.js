// Shared HP decides the round; personal HP decides who needs Second Wind.
function syncTeamHealth(session) {
  if (!session.teamMode || !session.teamHealth) return;
  for (const player of session.players.values()) {
    if(player.timedOut)continue;
    player.sharedHealth = true;
  }
}
function changePlayerHealth(session, player, change) {
  if(player.timedOut)return 0;
  const before=player.hp;
  player.hp=Math.max(0,Math.min(player.maxHp,before+change));
  const actual=player.hp-before;
  if(session.teamMode && session.teamHealth) {
    session.teamHealth.hp=Math.max(0,Math.min(session.teamHealth.maxHp,session.teamHealth.hp+actual));
  }
  return actual;
}
function resetTeamHealth(session, maxHp) {
  for(const player of session.players.values())player.sharedHealth=Boolean(session.teamMode);
  session.teamHealth = session.teamMode ? {hp: maxHp, maxHp} : null;
  syncTeamHealth(session);
}
const activePlayers=session=>[...session.players.values()].filter(player=>!player.timedOut);
module.exports = {syncTeamHealth, changePlayerHealth, resetTeamHealth, activePlayers};
