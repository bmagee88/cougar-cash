const { test } = require('node:test');
const assert = require('node:assert/strict');
const { queueBattleBroadcast } = require('./typingBossBroadcast');

function harness() {
  const session = { timers: new Set() };
  let sends = 0;
  const schedule = (_session, callback, ms) => {
    const timer = { callback, ms };
    session.timers.add(timer);
    return timer;
  };
  return { session, queue: options => queueBattleBroadcast(session, () => sends++, schedule, options),
    get sends() { return sends; }, fire() {
      for (const timer of [...session.timers]) { session.timers.delete(timer); timer.callback(); }
    } };
}

test('thirty progress senders share one 400ms room flush', () => {
  const h = harness();
  for (let i=0;i<30;i++) h.queue({ progressOnly:true });
  assert.equal(h.session.timers.size,1);
  assert.equal(h.session.progressBroadcastTimer.ms,400);
  h.fire();assert.equal(h.sends,1);
  assert.equal(h.session.progressBroadcastTimer,null);
});

test('combat preempts progress and absorbs further cosmetic updates without postponing the hit', () => {
  const h = harness();h.queue({ progressOnly:true });h.queue();
  const combatTimer = h.session.broadcastTimer;
  assert.equal(h.session.progressBroadcastTimer,null);
  assert.equal(h.session.timers.size,1);
  assert.equal(combatTimer.ms,100);
  for(let i=0;i<30;i++) { h.queue({ progressOnly:true });h.queue(); }
  assert.equal(h.session.broadcastTimer,combatTimer);
  h.fire();assert.equal(h.sends,1);assert.equal(h.session.broadcastTimer,null);
  h.queue({progressOnly:true});assert.equal(h.session.progressBroadcastTimer.ms,400);
});
