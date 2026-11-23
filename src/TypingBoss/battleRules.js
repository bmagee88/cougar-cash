const SECOND_WIND_WORDS = 3;
const SECOND_WIND_DAMAGE = .75;
const SECOND_WIND_HP = .4;
const SECOND_WIND_PROTECTION_MS = 5000;
function damageMultiplier(countdownEndsAt, now = Date.now()) {
  if (!Number.isFinite(countdownEndsAt)) return 1;
  return 1 + Math.max(0, Math.floor((now - countdownEndsAt) / 2000)) / 100;
}
function teamStartingHp(playerCount, hpMultiplier = 1) {
  return Math.round(100 * Math.max(1, playerCount) * hpMultiplier * 100) / 100;
}
module.exports = {damageMultiplier, teamStartingHp, SECOND_WIND_WORDS, SECOND_WIND_DAMAGE, SECOND_WIND_HP, SECOND_WIND_PROTECTION_MS};
