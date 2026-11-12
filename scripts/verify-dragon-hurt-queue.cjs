// Live HTTP verification against a local classroom backend. Closes its own room.
const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
const rules = require('../src/TypingBoss/proportionalRules');
const base = process.env.TYPING_BOSS_TEST_URL || 'http://127.0.0.1:4000/api/typing-boss/sessions';

async function request(path, body) {
  const response = await fetch(`${base}${path}`, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const result = await response.json();
  assert.ok(response.ok, result.error || `HTTP ${response.status}`);
  return result;
}

function attackRecords(snapshot) {
  const state = { ...snapshot }, records = [];
  do {
    const word = rules.typingWord(state), text = word.text + (rules.requiresWordSpace(state, word.text) ? ' ' : '');
    const count = text.length - (state.wordsInAttack === 0 ? 1 : 0), gaps = Array(count).fill(150);
    const record = [state.nextWord, text, count, count * 150, count * 22500, state.wordsInAttack ? 150 : null, gaps];
    records.push(record);
    rules.finishWord(state, text, count, record[3], record[4], record[5] ?? undefined, gaps);
  } while (state.wordsInAttack < rules.attackWordLimit(state));
  return records;
}

(async () => {
  let created;
  try {
    created = await request('', { creationPassword: process.env.TYPING_BOSS_CREATION_PASSWORD || 'sheep', name: 'Dragon hurt queue verification', mode: 'proportional', bossId: 'infernalDragon', goldWords: true });
    const id = created.sessionId;
    const player = await request(`/${id}/participants`, { name: 'TestFox', classId: 'cleric', goldWords: true });
    const start = await request(`/${id}/start`, { hostToken: created.hostToken, balanced: true, hpMultiplier: 100 });
    const startedAt = start.session.countdownEndsAt || start.session.serverNow || Date.now();
    await delay(Math.max(0,startedAt-Date.now()+20));
    const hostPath = `/${id}?hostToken=${created.hostToken}`, playerPath = `/${id}?code=${player.code}`;
    if (process.argv.includes('--flame')) {
      // Balanced boss pattern ends every tenth cycle with breath. Earn every
      // release through the normal typing route and respect its rate guard.
      for (let run=0;run<10;run++) {
        const snapshot=(await request(hostPath)).session, records=attackRecords(snapshot.typing);
        const total=snapshot.typing.totalCharacters+records.reduce((sum,record)=>sum+record[1].length,0);
        // Reserve typing credit for the following attack, so it can be queued
        // during breath without violating the production character-rate guard.
        const reserve=run===9?100:0;
        await delay(Math.max(0,(total+reserve-60)/.03+100-(Date.now()-startedAt)));
        await request(`/${id}/words`,{hostToken:created.hostToken,words:records});
      }
      const active=(await request(hostPath)).session, flame=active.boss.flameBreath;
      assert.ok(flame,'Tenth balanced release must start flame breath');
      const shot=active.projectiles.find(item=>item.id===flame.id);
      assert.equal(shot.bossAttack,'flamethrower');
      assert.equal(flame.until-flame.at,2000);
      assert.equal(shot.animationStartedAt,flame.at);
      assert.equal(shot.startedAt,flame.at+600);
      assert.equal(shot.impactAt,flame.at+1700);
      const count=active.projectiles.filter(item=>item.source==='boss').length;
      await request(`/${id}/words`,{hostToken:created.hostToken,words:attackRecords(active.typing)});
      const queued=(await request(hostPath)).session;
      assert.equal(queued.boss.queuedAttacks,1);
      assert.equal(queued.projectiles.filter(item=>item.source==='boss').length,count);
      const hp=queued.players[0].hp;
      await delay(Math.max(0,flame.at+600-Date.now()+20));
      assert.equal((await request(hostPath)).session.players[0].hp,hp);
      await delay(Math.max(0,shot.impactAt-Date.now()+30));
      const impacted=(await request(hostPath)).session;
      assert.ok(impacted.projectiles.find(item=>item.id===shot.id).resolvedAt>=shot.impactAt);
      assert.equal(impacted.boss.flameBreath.id,flame.id,'Recovery remains protected after impact');
      await delay(Math.max(0,flame.until-Date.now()+30));
      const finished=(await request(hostPath)).session;
      assert.equal(finished.boss.flameBreath,null);
      const following=finished.projectiles.find(item=>item.source==='boss' && item.startedAt>=flame.until);
      assert.ok(following,'Queued dragon attack launches after breath recovery');
      console.log(JSON.stringify({flameFrames:20,protectedDurationMs:2000,inhaleMs:600,impactMs:1700,queuedWithoutProjectile:true,
        delayedNextAttackMs:following.startedAt-flame.until},null,2));
      return;
    }
    let critical;
    for (let run=0;run<12 && !critical;run++) {
      const snapshot = (await request(playerPath)).session, records = attackRecords(snapshot.typing);
      const total = snapshot.typing.totalCharacters + records.reduce((sum, record) => sum + record[1].length, 0);
      // Respect the production character-rate guard, rather than bypassing it.
      await delay(Math.max(0, (total - 60) / .03 + 100 - (Date.now() - startedAt)));
      const first = Date.now();
      await request(`/${id}/words`, { code: player.code, words: records });
      const host = (await request(hostPath)).session;
      critical = host.projectiles.find(shot => shot.source === player.code && shot.target === 'boss' && shot.critical && shot.startedAt >= first - 5);
    }
    assert.ok(critical, 'Balanced earned red words must release a critical');
    await delay(Math.max(0, critical.impactAt - Date.now() + 15));
    const hurt = (await request(hostPath)).session.boss.hurt;
    assert.equal(hurt.tier, 'critical');
    assert.deepEqual((await request(playerPath)).session.boss.hurt, hurt, 'Host and player must receive the same authoritative reaction');
    const hostBefore = (await request(hostPath)).session;
    await request(`/${id}/words`, { hostToken: created.hostToken, words: attackRecords(hostBefore.typing) });
    const queued = (await request(hostPath)).session;
    assert.equal(queued.boss.queuedAttacks, 1);
    assert.equal(queued.projectiles.filter(shot => shot.source === 'boss').length, 0, 'Queued attacks cannot create early projectiles');
    const hpBefore = queued.players[0].hp;
    await delay(Math.max(0, hurt.until - Date.now() + 30));
    const launched = (await request(hostPath)).session;
    const shot = launched.projectiles.find(item => item.source === 'boss');
    assert.ok(shot && shot.startedAt >= hurt.until);
    assert.equal(shot.impactAt, shot.startedAt + 700);
    assert.equal(shot.resolvedAt, null);
    assert.equal(launched.players[0].hp, hpBefore, 'No queued damage before the delayed impact');
    await delay(Math.max(0, shot.impactAt - Date.now() + 30));
    const resolved = (await request(hostPath)).session.projectiles.find(item => item.id === shot.id);
    assert.ok(resolved.resolvedAt >= shot.impactAt);
    console.log(JSON.stringify({ sharedCritical: true, queuedWithoutProjectile: true, hurtFrames: 10,
      hurtDurationMs: hurt.until - hurt.at, launchAfterHurtMs: shot.startedAt - hurt.until,
      delayedFlightMs: shot.impactAt - shot.startedAt, resolvedAfterScheduledImpact: true }, null, 2));
  } finally {
    if (created) await request(`/${created.sessionId}/close`, { hostToken: created.hostToken });
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
