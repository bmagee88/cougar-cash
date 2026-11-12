const { test } = require('node:test');
const assert = require('node:assert/strict');
const engine = require('./proportionalBoss');
const { requestDragonAttack, recordDragonHurt, clearDragonCombat } = require('./dragonCombat');
const { DRAGON_HURT, DRAGON_FLAME } = require('../src/TypingBoss/dragonHurtRules');
const { createTypingState } = require('../src/TypingBoss/proportionalRules');

function harness(t) {
  let now = 1000; const jobs = [];
  t.mock.method(Date, 'now', () => now);
  const player = { code: 'hero1', name: 'Hero', hp: 1000, maxHp: 1000, typing: createTypingState(1), totalDamage: 0, bossHitsTaken: 0, turnsTaken: 0 };
  const room = { mode: 'proportional', status: 'active', players: new Map([[player.code, player]]),
    boss: { id: 'infernalDragon', name: 'Dragon', hp: 10000, maxHp: 10000 }, typingHost: createTypingState(2, 'dragon'), projectiles: [] };
  const callbacks = { random: () => .4, broadcast: () => {}, schedule: (_session, run, delay) => jobs.push({ run, at: now + delay }) };
  function advance(ms) {
    const until = now + ms;
    while (jobs.some(job => job.at <= until)) {
      jobs.sort((a,b) => a.at-b.at);
      const job = jobs.shift(); now = job.at; job.run();
    }
    now = until;
  }
  const attack = (moveId = 'weak', critical = false) => ({ base: 20, power: 20, multiplier: 1, moveId, critical });
  return { room, player, callbacks, advance, attack, bossShots: () => room.projectiles.filter(shot => shot.source === 'boss') };
}

test('pain uses 3 basic, 6 power and 10 critical frames with increasing durations', () => {
  assert.deepEqual(Object.values(DRAGON_HURT).map(tier => tier.frames), [3,6,10]);
  assert.ok(DRAGON_HURT.basic.duration < DRAGON_HURT.power.duration && DRAGON_HURT.power.duration < DRAGON_HURT.critical.duration);
});

test('higher pain interrupts lower pain; lower and equal hits cannot restart it', t => {
  const { room, advance } = harness(t);
  const hit = (id, moveId, critical = false) => ({ id, source: 'hero1', target: 'boss', kind: 'damage', amount: 20, willHit: true, resolvedAt: Date.now(), moveId, critical });
  assert.equal(recordDragonHurt(room, hit('basic','weak')), true);
  advance(20); assert.equal(recordDragonHurt(room, hit('power','strong')), true);
  assert.equal(room.boss.hurt.tier, 'power');
  advance(20); assert.equal(recordDragonHurt(room, hit('critical','strong',true)), true);
  const critical = room.boss.hurt;
  advance(50);
  for (const [id,moveId,crit] of [['low','weak',false],['middle','strong',false],['equal','strong',true]]) {
    assert.equal(recordDragonHurt(room,hit(id,moveId,crit)),false);
    assert.equal(room.boss.hurt,critical);
  }
  advance(1200);
  assert.equal(recordDragonHurt(room,hit('fresh','weak')),true);
});

test('basic pain yields to a dragon attack and cannot interrupt its active frames', t => {
  const { room, player, callbacks, advance, attack, bossShots } = harness(t);
  engine.launchAttack(room,player,attack(),callbacks); advance(700);
  assert.equal(room.boss.hurt.tier,'basic');
  engine.launchAttack(room,room.typingHost,attack(),callbacks);
  assert.equal(room.boss.hurt,null);
  assert.equal(bossShots().length,1);
  assert.equal(bossShots()[0].startedAt,1700);
  assert.equal(recordDragonHurt(room,{id:'during-cast',target:'boss',kind:'damage',amount:2,willHit:true,resolvedAt:1701}),false);
});

test('a power reaction delays the projectile and its damage timer until all six frames finish', t => {
  const { room, player, callbacks, advance, attack, bossShots } = harness(t);
  engine.launchAttack(room,player,attack('strong'),callbacks); advance(700);
  const end = room.boss.hurt.until;
  engine.launchAttack(room,room.typingHost,attack(),callbacks);
  assert.equal(room.boss.queuedAttacks,1); assert.equal(bossShots().length,0);
  advance(DRAGON_HURT.power.duration-1);
  assert.equal(bossShots().length,0); assert.equal(player.hp,1000);
  advance(1);
  assert.equal(bossShots()[0].startedAt,end); assert.equal(bossShots()[0].impactAt,end+700);
  assert.equal(room.boss.queuedAttacks,0);
  advance(699); assert.equal(player.hp,1000);
  advance(1); assert.equal(player.hp,980);
});

test('a critical extends a pending power wait, and queued attacks drain once in FIFO order', t => {
  const { room, player, callbacks, advance, attack, bossShots } = harness(t);
  engine.launchAttack(room,player,attack('strong'),callbacks);
  advance(50); engine.launchAttack(room,player,attack('strong',true),callbacks);
  advance(50); engine.launchAttack(room,player,attack(),callbacks);
  advance(50); engine.launchAttack(room,player,attack('strong'),callbacks);
  advance(50); engine.launchAttack(room,player,attack('strong',true),callbacks);
  advance(500); // First power impact at 1700.
  engine.launchAttack(room,room.typingHost,attack('weak'),callbacks);
  engine.launchAttack(room,room.typingHost,attack('strong'),callbacks);
  advance(50); // Critical at 1750 must extend the queued wake-up to 2950.
  assert.equal(room.boss.hurt.tier,'critical'); const id=room.boss.hurt.id;
  advance(610); assert.equal(room.boss.hurt.id,id); assert.equal(bossShots().length,0);
  advance(589); assert.equal(bossShots().length,0);
  advance(1);
  assert.equal(bossShots().length,1); assert.equal(bossShots()[0].startedAt,2950); assert.equal(bossShots()[0].moveId,'weak');
  advance(619); assert.equal(bossShots().length,1);
  advance(1); assert.equal(bossShots().length,2); assert.equal(bossShots()[1].moveId,'strong');
  assert.equal(bossShots()[1].startedAt,3570); assert.equal(room.boss.queuedAttacks,0);
});

test('misses, full shielding and support do not create a pain animation', t => {
  const { room } = harness(t);
  for (const values of [{amount:0},{willHit:false},{result:'evade'},{kind:'heal'},{target:'hero1'}]) {
    assert.equal(recordDragonHurt(room,{id:'no-pain',target:'boss',kind:'damage',amount:20,willHit:true,resolvedAt:1000,...values}),false);
  }
  assert.equal(room.boss.hurt,undefined);
});

test('20-frame flame breath locks the body, queues critical before power, and delays every outgoing attack', t => {
  const {room,player,callbacks,advance,attack,bossShots}=harness(t);
  callbacks.random=()=>.95;
  engine.launchAttack(room,room.typingHost,attack(),callbacks);
  const breath=room.boss.flameBreath;
  assert.deepEqual(breath,{id:bossShots()[0].id,at:1000,until:3000});
  assert.equal(DRAGON_FLAME.frames,20);
  assert.equal(bossShots()[0].animationStartedAt,1000);
  assert.equal(bossShots()[0].startedAt,1600);
  assert.equal(bossShots()[0].impactAt,2700);
  // Real hits still damage the dragon during its protected animation.
  for(const [moveId,crit] of [['weak',false],['strong',false],['strong',true],['strong',false],['strong',true]])
    engine.launchAttack(room,player,attack(moveId,crit),callbacks);
  advance(700);
  assert.equal(room.boss.hp,9900);
  assert.equal(room.boss.hurt,null);
  assert.equal(room.boss.queuedStrongReactions,2);
  assert.equal(room.boss.flameBreath,breath);
  callbacks.random=()=>.4;
  engine.launchAttack(room,room.typingHost,attack(),callbacks);
  assert.equal(room.boss.queuedAttacks,1);
  advance(999); assert.equal(player.hp,1000);
  advance(1); assert.equal(player.hp,980); // Flame impact after the inhale and flight.
  advance(299); assert.equal(room.boss.hurt,null); assert.equal(bossShots().length,1);
  advance(1);
  assert.equal(room.boss.flameBreath,null);
  assert.equal(room.boss.hurt.tier,'critical'); assert.equal(room.boss.hurt.at,3000);
  assert.equal(room.boss.queuedStrongReactions,1);
  advance(1199); assert.equal(room.boss.hurt.tier,'critical'); assert.equal(bossShots().length,1);
  advance(1); assert.equal(room.boss.hurt.tier,'power'); assert.equal(room.boss.hurt.at,4200);
  assert.equal(room.boss.queuedStrongReactions,0);
  advance(659); assert.equal(bossShots().length,1);
  advance(1); assert.equal(bossShots().length,2); assert.equal(bossShots()[1].startedAt,4860);
  advance(700); assert.equal(player.hp,960);
});

test('cleanup cancels flame lock, pending strong reactions, outgoing shots and stale wake-ups', t => {
  const {room,callbacks,advance,attack}=harness(t);
  callbacks.random=()=>.95;
  engine.launchAttack(room,room.typingHost,attack(),callbacks);
  recordDragonHurt(room,{id:'crit',target:'boss',kind:'damage',amount:1,resolvedAt:1000,critical:true});
  let launches=0;
  requestDragonAttack(room,()=>{launches++;return 620;},callbacks);
  room.status='closed'; clearDragonCombat(room); advance(10000);
  assert.equal(room.boss.flameBreath,null); assert.equal(room.boss.queuedStrongReactions,0);
  assert.equal(room.dragonCombat,null); assert.equal(launches,0);
});

test('queued attacks are discarded on lethal damage or room cleanup', t => {
  const { room, player, callbacks, advance, attack, bossShots } = harness(t);
  room.boss.hp = 10;
  recordDragonHurt(room,{id:'critical',target:'boss',kind:'damage',amount:1,willHit:true,resolvedAt:1000,critical:true});
  engine.launchAttack(room,room.typingHost,attack(),callbacks);
  engine.launchAttack(room,player,attack(),callbacks);
  advance(700); assert.equal(room.status,'victory'); assert.equal(room.dragonCombat,null);
  advance(5000); assert.equal(bossShots().length,0);
  room.status='active'; room.boss.hp=100;
  recordDragonHurt(room,{id:'new-critical',target:'boss',kind:'damage',amount:1,willHit:true,resolvedAt:Date.now(),critical:true});
  let launches=0;
  requestDragonAttack(room,()=>{launches++;},callbacks);
  clearDragonCombat(room); advance(5000);
  assert.equal(launches,0); assert.equal(room.boss.queuedAttacks,0);
});
