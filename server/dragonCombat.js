const { DRAGON_HURT, DRAGON_FLAME, dragonHurtTier } = require('../src/TypingBoss/dragonHurtRules');

function combatState(session) {
  if (session.boss.hurt === undefined) session.boss.hurt = null;
  if (!session.dragonCombat) session.dragonCombat = { queue: [], strongQueue: [], wakeAt: null, token: 0, nextQueuedAt: 0, attackUntil: 0 };
  return session.dragonCombat;
}

function clearDragonCombat(session) {
  if (session.dragonCombat) { session.dragonCombat.queue.length = 0; session.dragonCombat.strongQueue.length = 0; session.dragonCombat.token++; }
  session.dragonCombat = null;
  if (session.boss) { session.boss.queuedAttacks = 0; session.boss.queuedStrongReactions = 0; session.boss.flameBreath = null; }
}

const flameUntil = (session, now) => session.boss.flameBreath?.until > now ? session.boss.flameBreath.until : now;

function wakeDragonCombat(session, callbacks, readyAt) {
  const state = session.dragonCombat;
  if (!state || (state.wakeAt !== null && state.wakeAt <= readyAt)) return;
  state.wakeAt = readyAt;
  const token = ++state.token;
  callbacks.schedule(session, () => {
    if (session.dragonCombat !== state || token !== state.token) return;
    state.wakeAt = null;
    drainDragonAttacks(session, callbacks);
  }, Math.max(0, readyAt - Date.now()));
}

function blockingUntil(session, now) {
  const hurt = session.boss.hurt;
  return hurt && hurt.until > now && DRAGON_HURT[hurt.tier].rank > 1 ? hurt.until : now;
}

function playAttack(session, run, now, callbacks) {
  if (session.boss.hurt?.tier === 'basic') session.boss.hurt = null;
  const result = run();
  const duration = typeof result === 'number' ? result : result?.duration || 0;
  if (session.dragonCombat) session.dragonCombat.attackUntil = now + duration;
  if (result?.kind === 'flamethrower') {
    session.boss.flameBreath = { id: result.id, at: now, until: now + DRAGON_FLAME.duration };
    wakeDragonCombat(session, callbacks, session.boss.flameBreath.until);
    callbacks.broadcast(session);
  }
  return duration;
}

function drainDragonAttacks(session, callbacks) {
  const state = session.dragonCombat;
  if (!state) return;
  if (session.status !== 'active' || session.boss.hp <= 0) { clearDragonCombat(session); return; }
  const now = Date.now();
  if (flameUntil(session, now) > now) {
    wakeDragonCombat(session, callbacks, flameUntil(session, now));
    return;
  }
  if (session.boss.flameBreath) { session.boss.flameBreath = null; callbacks.broadcast(session); }
  if (!state.queue.length && !state.strongQueue.length) return;
  const readyAt = Math.max(blockingUntil(session, now), state.nextQueuedAt);
  if (readyAt > now) {
    wakeDragonCombat(session, callbacks, readyAt);
    return;
  }
  if (state.strongQueue.length) {
    state.strongQueue.sort((a,b) => DRAGON_HURT[b.tier].rank - DRAGON_HURT[a.tier].rank || a.receivedAt-b.receivedAt);
    const reaction = state.strongQueue.shift();
    session.boss.queuedStrongReactions = state.strongQueue.length;
    session.boss.hurt = { id: reaction.id, tier: reaction.tier, at: now, until: now + DRAGON_HURT[reaction.tier].duration };
    callbacks.broadcast(session);
    if (state.strongQueue.length || state.queue.length) wakeDragonCombat(session, callbacks, session.boss.hurt.until);
    return;
  }
  const run = state.queue.shift();
  session.boss.queuedAttacks = state.queue.length;
  state.nextQueuedAt = now + playAttack(session, run, now, callbacks);
  callbacks.broadcast(session);
  if (state.queue.length) drainDragonAttacks(session, callbacks);
}

function requestDragonAttack(session, run, callbacks) {
  if (session.status !== 'active' || session.boss.hp <= 0) return false;
  const state = combatState(session), now = Date.now();
  if (blockingUntil(session, now) === now && flameUntil(session, now) === now && !state.queue.length && !state.strongQueue.length) {
    playAttack(session, run, now, callbacks);
    return true;
  }
  state.queue.push(run);
  session.boss.queuedAttacks = state.queue.length;
  drainDragonAttacks(session, callbacks);
  if (state.queue.length) callbacks.broadcast(session);
  return false;
}

function recordDragonHurt(session, hit) {
  const tier = dragonHurtTier(hit);
  if (!tier || session.boss.hp <= 0 || session.status !== 'active') return false;
  const now = hit.resolvedAt, previous = session.boss.hurt;
  if (flameUntil(session, now) > now) {
    if (tier === 'basic') return false;
    const state = combatState(session);
    // One pending reaction per severity keeps a class volley from building an
    // unbounded stun backlog. Criticals drain before power reactions.
    if (state.strongQueue.some(reaction => reaction.tier === tier)) return false;
    state.strongQueue.push({ id: hit.id, tier, receivedAt: now });
    session.boss.queuedStrongReactions = state.strongQueue.length;
    return true;
  }
  // Equal hits don't restart a reaction or keep a large classroom in a stun loop.
  if (previous && previous.until > now && DRAGON_HURT[previous.tier].rank >= DRAGON_HURT[tier].rank) return false;
  if (tier === 'basic' && (session.dragonCombat?.attackUntil || 0) > now) return false;
  session.boss.hurt = { id: hit.id, tier, at: now, until: now + DRAGON_HURT[tier].duration };
  return true;
}

module.exports = { requestDragonAttack, recordDragonHurt, clearDragonCombat };
