// Run with the local classroom backend: node scripts/verify-typing-boss.cjs
const assert = require("node:assert/strict");
const { setTimeout: delay } = require("node:timers/promises");
const { wordAt } = require("../src/TypingBoss/proportionalRules");
const base = process.env.TYPING_BOSS_TEST_URL || "http://127.0.0.1:4000/api/typing-boss/sessions";
const openStreams = [];
const games = [];

async function request(path, body, expected = 200) {
  const response = await fetch(`${base}${path}`, body === undefined ? {} : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const result = await response.json();
  assert.equal(response.status, expected, result.error || path);
  return result;
}
async function stream(id, credentials) {
  const controller = new AbortController();
  const response = await fetch(`${base}/${id}/events?${new URLSearchParams(credentials)}`, { signal: controller.signal });
  assert.equal(response.status, 200);
  const stats = { initialBytes: 0, patchBytes: 0, patches: [], snapshot: null, abort: () => controller.abort() };
  openStreams.push(stats);
  (async () => {
    let buffer = "";
    try {
      for await (const chunk of response.body) {
        buffer += Buffer.from(chunk).toString("utf8");
        let end;
        while ((end = buffer.indexOf("\n\n")) >= 0) {
          const event = buffer.slice(0, end); buffer = buffer.slice(end + 2);
          const data = event.split("\n").find(line => line.startsWith("data: "));
          if (!data) continue;
          const payload = JSON.parse(data.slice(6));
          if (event.startsWith("event: session")) { stats.initialBytes += Buffer.byteLength(event); stats.snapshot = payload; }
          if (event.startsWith("event: patch")) { stats.patchBytes += Buffer.byteLength(event); stats.patches.push(payload); }
        }
      }
    } catch (error) { if (error.name !== "AbortError") throw error; }
  })();
  return stats;
}
function words(state, start = 0, countWords = 10) {
  return Array.from({ length: countWords }, (_, offset) => {
    const index = start + offset;
    const text = wordAt(state.seed, index).text + (index % 10 === 9 ? "" : " ");
    const count = text.length - (index % 10 === 0 ? 1 : 0);
    // One wrong letter per word prevents random color bonuses; spaces still score.
    return [index, "!" + text.slice(1), count, 2000, 4000000];
  });
}

(async () => {
  try {
    const created = await request("", { name: "31-client verification", mode: "proportional", bossId: "emberWhelp" }, 201);
    games.push(created);
    const id = created.sessionId;
    assert.equal(created.session.boss.id, "infernalDragon");
    const participants = [];
    for (let i = 0; i < 30; i++) {
      const player = await request(`/${id}/participants`, { name: `Test ${i + 1}`, classId: ["cleric", "rogue", "barbarian"][i % 3] }, 201);
      assert.equal(player.session.players.length, 1);
      assert.equal(player.session.players[0].hp, 100);
      participants.push(player);
    }
    await request(`/${id}/participants`, { name: "Overflow", classId: "monk" }, 409);
    await request(`/${id}/start`, { hostToken: created.hostToken, hpMultiplier: 1.5 }, 400);
    const started = await request(`/${id}/start`, { hostToken: created.hostToken });
    assert.equal(started.session.boss.hp, 3000);
    await request(`/${id}/start`, { hostToken: created.hostToken }, 409);
    const host = await stream(id, { hostToken: created.hostToken });
    const clients = await Promise.all(participants.map(player => stream(id, { code: player.code })));
    await delay(1000);
    for (const client of clients) assert.equal(client.snapshot.players.length, 1);
    await request(`/${id}/progress`, { hostToken: created.hostToken, wordIndex: 0, characters: 1 });
    await Promise.all(participants.map(player => request(`/${id}/progress`, { code: player.code, wordIndex: 0, characters: 1 })));
    await delay(200);
    const charging = (await request(`/${id}?hostToken=${created.hostToken}`)).session;
    assert.ok(charging.players.every(player => player.attackProgress > 0));
    assert.ok(charging.boss.attackProgress > 0);
    assert.equal(charging.boss.hp, 3000, "progress alone cannot damage the boss");
    assert.ok(clients.every(client => client.patches.some(patch => patch.players?.some(player => player.attackProgress > 0))));
    await request(`/${id}/challenge`, { code: participants[0].code, moveId: "special" }, 409);
    await request(`/${id}/actions`, { code: participants[0].code }, 409);
    await request(`/${id}/words`, { hostToken: created.hostToken, words: words(started.session.typing) });
    await Promise.all(participants.map(player => request(`/${id}/words`, { code: player.code, words: words(player.session.typing) })));
    // Retry the same ten words; it must be idempotent even with an attack in flight.
    await request(`/${id}/words`, { code: participants[0].code, words: words(participants[0].session.typing) });
    await delay(1100);
    const final = (await request(`/${id}?hostToken=${created.hostToken}`)).session;
    assert.equal(final.players.length, 30);
    assert.ok(final.boss.hp > 0 && final.boss.hp < 3000);
    assert.equal(final.projectiles.length, 60, "30 player attacks plus 30 host targets");
    assert.ok(final.players.every(player => player.totalDamage > 0 && player.totalTaken > 0 && player.hp < 100));
    assert.ok(final.players.every(player => player.turnsTaken === 1));
    for (let i = 0; i < clients.length; i++) {
      const client = clients[i];
      const received = new Map();
      for (const patch of client.patches) {
        assert.ok((patch.players || []).every(player => player.code === participants[i].code));
        for (const shot of patch.projectiles || []) {
          const merged = { ...received.get(shot.id), ...shot };
          received.set(shot.id, merged);
          assert.ok(merged.source === participants[i].code || merged.target === participants[i].code);
        }
      }
      assert.ok(client.patchBytes < 10000, "personal updates stay small");
    }
    const hostShots = new Map(host.patches.flatMap(patch => patch.projectiles || []).map(shot => [shot.id, shot]));
    assert.equal(hostShots.size, 60);
    const reconnected = await stream(id, { code: participants[0].code });
    await delay(100);
    assert.equal(reconnected.snapshot.typing.nextWord, 10);
    assert.equal(reconnected.snapshot.players[0].turnsTaken, 1);
    const burst = { hostCombatBytes: host.patchBytes,
      averagePlayerCombatBytes: Math.round(clients.reduce((sum, client) => sum + client.patchBytes, 0) / 30),
      totalCombatBytes: host.patchBytes + clients.reduce((sum, client) => sum + client.patchBytes, 0), hostUpdateCount: host.patches.length };
    assert.equal(reconnected.snapshot.leaderboard, undefined, "shared results stay off the live player stream");

    let ended = final;
    for (let start = 10; start <= 100 && ended.status === "active"; start += 10) {
      await delay(1500);
      await Promise.all(participants.map(player => request(`/${id}/words`, { code: player.code, words: words(player.session.typing, start) })));
      await delay(900);
      ended = (await request(`/${id}?code=${participants[0].code}`)).session;
    }
    assert.equal(ended.status, "victory");
    assert.equal(ended.players.length, 1, "live roster remains personal even in the final snapshot");
    assert.equal(ended.leaderboard.length, 30);
    assert.ok(ended.leaderboard.every((entry, index, list) => !index || entry.totalDamage <= list[index - 1].totalDamage));
    assert.ok(ended.leaderboard.some(entry => entry.strongestAttack && entry.strongestAttack.base > 0 && entry.strongestAttack.consistency >= .5 && entry.strongestAttack.orangeBonus === 0));
    assert.ok(clients.every(client => client.patches.some(patch => patch.leaderboard?.length === 30)));

    const scaled = await request("", { name: "HP multiplier verification", mode: "proportional" }, 201);
    games.push(scaled);
    const scaledHero = await request(`/${scaled.sessionId}/participants`, { name: "Scaled hero", classId: "monk" }, 201);
    await request(`/${scaled.sessionId}/start`, { code: scaledHero.code, hpMultiplier: 30 }, 403);
    const scaledStart = await request(`/${scaled.sessionId}/start`, { hostToken: scaled.hostToken, hpMultiplier: 30 });
    assert.equal(scaledStart.session.hpMultiplier, 30);
    assert.equal(scaledStart.session.players[0].maxHp, 3000);
    assert.equal(scaledStart.session.boss.maxHp, 3000);

    // Exercise original creation, quiz, and special-move paths as a compatibility check.
    const old = await request("", { name: "Old mode verification", mode: "old", bossId: "cindermaw" }, 201);
    games.push(old);
    assert.equal(old.session.mode, "old"); assert.equal(old.session.boss.hp, 1200);
    const hero = await request(`/${old.sessionId}/participants`, { name: "Original cleric", classId: "cleric" }, 201);
    assert.equal(hero.session.players[0].hp, 135);
    await request(`/${old.sessionId}/start`, { hostToken: old.hostToken });
    const challenge = await request(`/${old.sessionId}/challenge`, { code: hero.code, moveId: "weak" }, 201);
    assert.ok(challenge.challenge.question);
    const action = await request(`/${old.sessionId}/actions`, { code: hero.code, challengeId: challenge.challenge.id,
      answerText: challenge.challenge.answers[0], durationMs: 5000, acceptedCharacters: 20, mistakes: 0 }, 201);
    assert.ok(action.projectile); assert.ok(action.stats);

    const report = { clients: 31, attacks: 31, projectiles: final.projectiles.length, endLeaderboard: "passed", hpMultiplier: "passed", progressUpdates: "passed",
      ...burst, originalMode: "passed", reconnectAndRetry: "passed",
      note: "Local SSE payload bytes for a progress update per actor, one host volley and 30 simultaneous player attacks; excludes initial snapshots and HTTP/TLS overhead." };
    console.log(JSON.stringify(report, null, 2));
  } finally {
    openStreams.forEach(client => client.abort());
    for (const game of games) await request(`/${game.sessionId}/close`, { hostToken: game.hostToken });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
