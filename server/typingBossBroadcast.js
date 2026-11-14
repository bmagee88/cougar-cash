const PROGRESS_FLUSH_MS = 400;
const COMBAT_FLUSH_MS = 100;

// Cosmetic traffic shares one room timer. Combat preempts that timer so a hit,
// defense activation or release never waits behind a progress update.
function queueBattleBroadcast(session, send, schedule, { progressOnly = false } = {}) {
  if (session.broadcastTimer) return;
  if (progressOnly && session.progressBroadcastTimer) return;
  if (!progressOnly && session.progressBroadcastTimer) {
    clearTimeout(session.progressBroadcastTimer);
    session.timers.delete(session.progressBroadcastTimer);
    session.progressBroadcastTimer = null;
  }
  const field = progressOnly ? 'progressBroadcastTimer' : 'broadcastTimer';
  session[field] = schedule(session, () => {
    session[field] = null;
    send();
  }, progressOnly ? PROGRESS_FLUSH_MS : COMBAT_FLUSH_MS);
}

module.exports = { queueBattleBroadcast, PROGRESS_FLUSH_MS, COMBAT_FLUSH_MS };
