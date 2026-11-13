const ABANDONED_MS = 10 * 60 * 1000;
const { clearDragonCombat } = require('./dragonCombat');
const FINISHED_MS = 15 * 60 * 1000;
const CHALLENGE_MS = 10 * 60 * 1000;
const FINISHED = new Set(["victory", "defeat", "closed"]);

function touchSession(session, now = Date.now()) {
  if (session.status === "setup" || session.status === "active") session.lastActivityAt = now;
}

function pruneChallenges(session, now = Date.now()) {
  for (const [id, challenge] of session.challenges) {
    if (now - challenge.createdAt >= CHALLENGE_MS) session.challenges.delete(id);
  }
}

function storeChallenge(session, challenge, now = Date.now()) {
  pruneChallenges(session, now);
  // The UI presents one challenge at a time; replacing it releases abandoned attempts.
  for (const [id, previous] of session.challenges) {
    if (previous.playerCode === challenge.playerCode) session.challenges.delete(id);
  }
  session.challenges.set(challenge.id, challenge);
}

function maintainSession(session, now = Date.now()) {
  pruneChallenges(session, now);
  session.projectiles = session.projectiles.filter(projectile =>
    now - (projectile.resolvedAt || projectile.impactAt) < 4500);
  if (FINISHED.has(session.status)) {
    clearDragonCombat(session);
    session.closedAt = session.closedAt || now;
    session.expiresAt = Math.min(session.expiresAt, session.closedAt + FINISHED_MS);
    session.challenges.clear();
    clearTimeout(session.bossTimer);
    session.bossTimer = null;
  }
  return session.status !== "expired" && (now >= session.expiresAt ||
    (!FINISHED.has(session.status) && !session.subscribers.size &&
      now - (session.lastActivityAt ?? session.createdAt) >= ABANDONED_MS));
}

function detachSubscriber(session, subscriber, now = Date.now()) {
  clearInterval(subscriber.pingTimer);
  subscriber.previous = null;
  subscriber.audience = null;
  if (session.subscribers.delete(subscriber) && !session.subscribers.size) touchSession(session, now);
}

function clearSessionTimers(session) {
  clearDragonCombat(session);
  clearTimeout(session.expireTimer);
  clearTimeout(session.deleteTimer);
  clearTimeout(session.bossTimer);
  for (const timer of session.timers) clearTimeout(timer);
  session.timers.clear();
  session.broadcastTimer = null;
  session.progressBroadcastTimer = null;
  session.studentSummaryTimer = null;
}

function removeSession(registry, session) {
  clearSessionTimers(session);
  for (const subscriber of [...session.subscribers]) {
    detachSubscriber(session, subscriber);
    try { subscriber.res.end(); } catch { subscriber.res.destroy(); }
  }
  if (registry.get(session.id) === session) registry.delete(session.id);
  // Release large state even if a socket's close callback briefly retains the room.
  session.players.clear();
  session.challenges.clear();
  session.projectiles = [];
  session.log = [];
  session.typingHost = null;
}

module.exports = { ABANDONED_MS, FINISHED_MS, CHALLENGE_MS, touchSession, pruneChallenges,
  storeChallenge, maintainSession, detachSubscriber, clearSessionTimers, removeSession };
