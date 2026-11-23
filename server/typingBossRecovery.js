const {SECOND_WIND_WORDS, SECOND_WIND_HP, SECOND_WIND_PROTECTION_MS} = require('../src/TypingBoss/battleRules');

function cancelRecovery(session) {
  // Dispose of legacy timer entries if an existing room still has any.
  for (const entry of session.recovery?.entries.values() || []) {
    clearTimeout(entry.timer);
    session.timers?.delete(entry.timer);
  }
  session.recovery = null;
}
function syncRecovery(session) {
  for (const player of session.players.values()) {
    if (player.hp > 0) player.secondWindWordsRemaining = 0;
    player.recoverAt = player.recoverDurationMs = null;
  }
}
function knockOutMany(session, players) {
  if (session.teamMode || session.status !== 'active') return;
  for (const player of new Set(players)) {
    if (player.hp > 0 || player.secondWindWordsRemaining > 0) continue;
    session.teamKnockouts = (session.teamKnockouts || 0) + 1;
    player.knockouts = (player.knockouts || 0) + 1;
    player.secondWindWordsRemaining = SECOND_WIND_WORDS;
    player.proneUntil = null;
    player.recoverAt = player.recoverDurationMs = null;
  }
}
function advanceSecondWind(session, player) {
  if (session.teamMode || session.status !== 'active' || !(player.secondWindWordsRemaining > 0)) return false;
  player.secondWindWordsRemaining--;
  if (player.secondWindWordsRemaining === 0) {
    player.hp = player.maxHp * SECOND_WIND_HP;
    player.protectedUntil = Date.now() + SECOND_WIND_PROTECTION_MS;
  }
  return true;
}
function knockOut(session, player) { knockOutMany(session, [player]); }
module.exports = {knockOut, knockOutMany, syncRecovery, cancelRecovery, advanceSecondWind};
