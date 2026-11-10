const { test } = require("node:test");
const assert = require("node:assert/strict");
const rules = require("../src/TypingBoss/proportionalRules");
const engine = require("./proportionalBoss");

function sessionWithPlayers(count = 15) {
  const players = new Map(Array.from({ length: count }, (_, i) => [String(i), {
    code: String(i), name: `Player ${i}`, hp: 100, maxHp: 100, totalDamage: 0,
    totalKeystrokes: 0, correctKeystrokes: 0, correctStreak: 0, bossHitsTaken: 0,
    turnsTaken: 0, typing: rules.createTypingState(i + 1),
  }]));
  return { mode: "proportional", status: "active", startedAt: Date.now() - 60000, startingPlayers: count,
    boss: { id: "infernalDragon", name: "Ancient Red Dragon", hp: 100 * count },
    players, typingHost: rules.createTypingState(123), projectiles: [] };
}
function callbacks() {
  const timers = [];
  return { timers, schedule: (_session, callback) => timers.push(callback), broadcast: () => {} };
}
function recordsFor(state, count = 10, correct = true) {
  return Array.from({ length: count }, (_, n) => {
    const index = state.nextWord + n;
    const text = rules.wordAt(state.seed, index, state.gradeMask, state.sentimentMask).text + (index % 10 === 9 ? "" : " ");
    const intervals = text.length - (index % 10 === 0 ? 1 : 0);
    return [index, correct ? text : "!".repeat(text.length - (index % 10 === 9 ? 0 : 1)) + (index % 10 === 9 ? "" : " "), intervals, intervals * 200, intervals * 40000];
  });
}
function seekColor(color) {
  for (let seed = 0; seed < 10000; seed++) if (rules.wordAt(seed, 0).color === color) return seed;
  throw new Error("Missing color");
}

test("the tenth word applies its color before release, including immediate defense", () => {
  for (const color of ["orange", "red", "blue", "green"]) {
    let seed = 0;
    while (rules.wordAt(seed, 9).color !== color) seed++;
    const state = rules.createTypingState(seed);
    for (let index = 0; index < 10; index++) {
      const word = rules.wordAt(seed, index);
      rules.finishWord(state, index === 9 ? word.text : "!".repeat(word.text.length) + " ", 2, 400, 80000);
    }
    const attack = rules.releaseAttack(state, () => 0);
    assert.equal(attack.base, rules.wordAt(seed, 9).text.length + 9);
    assert.equal(attack.orangeBonus, color === "orange" ? .1 : 0);
    assert.equal(attack.criticalChance, color === "red" ? .1 : 0);
    assert.equal(attack.critical, color === "red");
    assert.equal(attack.blueShield, color === "blue" ? .1 : 0);
    assert.equal(state.shield, color === "blue" ? .1 : 0);
    assert.equal(attack.greenStacks, color === "green" ? 1 : 0);
    // A green word rewards later correct words; none remain after word ten.
    assert.equal(attack.greenBonus, 0);

    const session = sessionWithPlayers(1);
    session.players.get("0").typing = rules.createTypingState(seed);
    const records = recordsFor(session.players.get("0").typing);
    for (let index = 0; index < 9; index++) records[index][1] = "!".repeat(records[index][1].length - 1) + " ";
    engine.submitWords(session, { role: "player", actorCode: "0" }, records, callbacks());
    assert.equal(session.projectiles.length, 1);
    assert.equal(session.players.get("0").typing.shield, color === "blue" ? .1 : 0);
    if (color === "orange") assert.equal(session.projectiles[0].multiplier, 1.65);
  }
});

test("word generation uses the exact Home Row Run pool, deterministically, with 30% colors", () => {
  const byLength = require("../src/typingProject/resources/homeRowWords.json");
  const original = Object.keys(byLength).filter(key => !isNaN(Number(key))).flatMap(key => byLength[key].map(entry => entry.word));
  assert.deepEqual(rules.WORDS, original);
  const colors = { blue: 0, orange: 0, red: 0, green: 0, none: 0 };
  for (let i = 0; i < 20000; i++) {
    const word = rules.wordAt(414, i);
    assert.deepEqual(word, rules.wordAt(414, i));
    assert.ok(original.includes(word.text));
    colors[word.color || "none"]++;
  }
  assert.ok(colors.none / 20000 > .68 && colors.none / 20000 < .72);
  for (const color of ["blue", "orange", "red", "green"]) assert.ok(colors[color] > 1300 && colors[color] < 1700);
});

test("consistency depends on timing variation, with 1.5x and 0.5x limits", () => {
  assert.equal(rules.consistencyMultiplier(10, 2000, 400000), 1.5);
  assert.equal(rules.consistencyMultiplier(10, 1000, 100000), 1.5);
  assert.equal(rules.consistencyMultiplier(10, 1000, 1000000), 1);
  assert.equal(rules.consistencyMultiplier(1, 200, 40000), 1);
  assert.ok(Math.abs(rules.consistencyMultiplier(2, 400, 100000) - 1.5) < .0001);
});

test("fast key rolls receive jitter tolerance without penalizing typing speed", () => {
  // Mean 20 ms, SD 10 ms: natural fast key rolls still earn the full bonus.
  assert.equal(rules.consistencyMultiplier(10, 200, 5000), 1.5);
  assert.equal(rules.consistencyMultiplier(10, 500, 25000), 1.5);
  assert.equal(rules.consistencyMultiplier(10, 2000, 400000), 1.5);
  assert.equal(rules.consistencyMultiplier(10, 1000, 1000000), 1);
});

test("character progress covers exactly ten words and wraps at release", () => {
  const seed = 14;
  assert.equal(rules.attackProgress(seed, 0, 0), 0);
  assert.ok(rules.attackProgress(seed, 0, 1) > 0);
  assert.equal(rules.attackProgress(seed, 9, rules.wordAt(seed, 9).text.length), 100);
  assert.equal(rules.attackProgress(seed, 10, 0), 0);
});

test("progress is bounded, throttled, and cosmetic; it cannot award damage", () => {
  const session = sessionWithPlayers(10); const player = session.players.get("0");
  const auth = { role: "player", actorCode: "0" }; let broadcasts = 0;
  const broadcast = () => broadcasts++;
  engine.updateProgress(session, auth, 0, 1, broadcast);
  const progress = player.attackProgress;
  assert.ok(progress > 0 && progress < 100);
  engine.updateProgress(session, auth, 0, 2, broadcast);
  assert.equal(player.attackProgress, progress); assert.equal(broadcasts, 1);
  player.progressUpdatedAt = Date.now() - 500;
  engine.updateProgress(session, auth, 0, 999, broadcast);
  engine.updateProgress(session, auth, 41, 0, broadcast);
  engine.updateProgress(session, auth, -1, 0, broadcast);
  assert.equal(broadcasts, 1);
  engine.updateProgress(session, auth, 1, 0, broadcast);
  assert.ok(player.attackProgress > progress);
  assert.equal(player.typing.nextWord, 0); assert.equal(player.typing.characters, 0);
  assert.equal(session.boss.hp, 1000); assert.equal(session.projectiles.length, 0);
  player.progressUpdatedAt = Date.now() - 500;
  player.typing.nextWord = 10;
  player.attackProgress = 0;
  engine.updateProgress(session, auth, 9, 1, broadcast);
  assert.equal(player.attackProgress, 0, "late pre-release cursors cannot refill a new attack");
});

test("required spaces are timed and a reconnect can omit one unknown interval", () => {
  const session = sessionWithPlayers(); const cb = callbacks(); const player = session.players.get("0");
  const records = recordsFor(player.typing, 3);
  records[2][2] -= 1; records[2][3] -= 200; records[2][4] -= 40000;
  engine.submitWords(session, { role: "player", actorCode: "0" }, records, cb);
  assert.equal(player.typing.nextWord, 3);
});

test("colored words require zero errors, and only matching characters build attack damage", () => {
  for (const color of ["blue", "orange", "red", "green"]) {
    const state = rules.createTypingState(seekColor(color));
    const word = rules.wordAt(state.seed, 0);
    rules.finishWord(state, "!".repeat(word.text.length) + " ", 2, 400, 80000);
    assert.equal(state.shield + state.orange + state.red + state.green, 0);
    assert.equal(state.characters, 1);
    const next = rules.wordAt(state.seed, 1);
    rules.finishWord(state, "!" + next.text.slice(1) + " ", 2, 400, 80000);
    assert.equal(state.characters, next.text.length + 1);
  }
});

test("green stacks per subsequent correct word, including other colored words", () => {
  const state = rules.createTypingState(seekColor("green"));
  const first = rules.wordAt(state.seed, 0);
  rules.finishWord(state, first.text + " ", 2, 400, 80000);
  assert.equal(state.green, 1); assert.equal(state.growth, 0);
  rules.finishWord(state, rules.wordAt(state.seed, 1).text + " ", 2, 400, 80000);
  assert.equal(state.growth, .04);
  const before = state.growth;
  rules.finishWord(state, "!", 1, 200, 40000);
  assert.equal(state.growth, before);
  state.green = 2;
  rules.finishWord(state, rules.wordAt(state.seed, 3).text + " ", 2, 400, 80000);
  assert.ok(Math.abs(state.growth - .12) < .000001);
});

test("attack bonuses reset on release, while shields persist until the next hit", () => {
  const state = rules.createTypingState(1);
  Object.assign(state, { characters: 50, wordsInAttack: 10, orange: .2, red: .3, green: 2, growth: .08, shield: .2,
    intervalCount: 10, intervalSum: 2000, intervalSquares: 400000 });
  const attack = rules.releaseAttack(state, () => .1);
  assert.equal(attack.critical, true);
  assert.ok(Math.abs(attack.power - 192) < .00001);
  assert.equal(attack.moveId, "strong");
  for (const key of ["characters", "wordsInAttack", "orange", "red", "green", "growth", "intervalCount"]) assert.equal(state[key], 0);
  assert.equal(state.shield, .2);
});

test("power animation uses the actual multiplier, including critical hits below 2x", () => {
  const strong = rules.createTypingState(1);
  Object.assign(strong, { characters: 40, orange: 1 });
  assert.equal(rules.releaseAttack(strong, () => 1).moveId, "strong");
  const weak = rules.createTypingState(1);
  Object.assign(weak, { characters: 40, red: 1, intervalCount: 10, intervalSum: 1000, intervalSquares: 2000000 });
  const attack = rules.releaseAttack(weak, () => 0);
  assert.equal(attack.critical, true); assert.equal(attack.multiplier, 1); assert.equal(attack.moveId, "weak");
});

test("host attacks everyone proportionately; shields apply on impact and consume once", () => {
  const session = sessionWithPlayers(15);
  const cb = callbacks();
  engine.launchAttack(session, session.typingHost, { power: 150, multiplier: 1.5, moveId: "weak" }, cb);
  assert.equal(session.projectiles.length, 15);
  assert.equal(cb.timers.length, 1, "one timer for the whole volley");
  const player = session.players.get("0");
  player.typing.shield = .2; // Can earn blue during flight.
  cb.timers.shift()();
  assert.equal(player.hp, 92); assert.equal(player.typing.shield, 0);
  assert.equal(session.players.get("1").hp, 90);
  engine.launchAttack(session, session.typingHost, { power: 150, multiplier: 1, moveId: "weak" }, cb);
  cb.timers.shift()();
  assert.equal(player.hp, 82); assert.equal(player.typing.totalTaken, 18);
});

test("division keeps fractional damage and the starting count after knockouts", () => {
  const session = sessionWithPlayers(30); const cb = callbacks();
  session.players.get("0").hp = 0;
  engine.launchAttack(session, session.typingHost, { power: 10, multiplier: 1, moveId: "weak" }, cb);
  assert.equal(session.projectiles.length, 29);
  cb.timers.shift()();
  assert.ok(Math.abs(session.players.get("1").hp - (100 - 1 / 3)) < .000001);
});

test("host can earn blue defense, and damage credit is capped at remaining HP", () => {
  const session = sessionWithPlayers(1); const cb = callbacks();
  session.typingHost.shield = .1;
  const player = session.players.get("0");
  engine.launchAttack(session, player, { power: 50, multiplier: 1, moveId: "weak" }, cb);
  cb.timers.shift()();
  assert.equal(session.boss.hp, 55); assert.equal(player.totalDamage, 45);
  assert.equal(session.typingHost.shield, 0);
  engine.launchAttack(session, player, { power: 100, multiplier: 2, moveId: "strong" }, cb);
  cb.timers.shift()();
  assert.equal(session.status, "victory"); assert.equal(player.totalDamage, 100);
});

test("attacks release exactly every ten words, and retried batches do not duplicate attacks", () => {
  const session = sessionWithPlayers(); const cb = callbacks(); const player = session.players.get("0");
  const auth = { role: "player", actorCode: "0" };
  const records = recordsFor(player.typing);
  engine.submitWords(session, auth, records.slice(0, 9), cb);
  assert.equal(session.projectiles.length, 0);
  engine.submitWords(session, auth, records, cb);
  assert.equal(session.projectiles.length, 1);
  engine.submitWords(session, auth, records, cb);
  assert.equal(session.projectiles.length, 1); assert.equal(player.typing.nextWord, 10);
});

test("bad batches fail atomically; invalid timings, gaps, and old endpoints cannot award damage", () => {
  const session = sessionWithPlayers(); const cb = callbacks(); const player = session.players.get("0");
  const auth = { role: "player", actorCode: "0" };
  const records = recordsFor(player.typing);
  records[8][0] = 99;
  assert.throws(() => engine.submitWords(session, auth, records, cb));
  assert.equal(player.typing.nextWord, 0);
  const badTiming = recordsFor(player.typing, 1); badTiming[0][4] = -1;
  assert.throws(() => engine.submitWords(session, auth, badTiming, cb));
  player.hp = 0;
  assert.throws(() => engine.submitWords(session, auth, recordsFor(player.typing), cb));
});

test("patches contain changed players and events without resending static roster data", () => {
  const previous = { status: "active", boss: { hp: 3000 }, players: [{ code: "a", name: "A", hp: 100 }, { code: "b", name: "B", hp: 100 }], projectiles: [] };
  const current = JSON.parse(JSON.stringify(previous));
  current.players[1].hp = 90; current.projectiles = [{ id: "shot", amount: 10 }];
  const patch = engine.diffSnapshot(previous, current);
  assert.deepEqual(patch.players, [{ code: "b", hp: 90 }]);
  assert.equal(patch.boss, undefined);
  assert.deepEqual(patch.projectiles, current.projectiles);
  assert.equal(engine.diffSnapshot(current, current), null);
});

test("HP multiplier scales both sides equally and rejects invalid or late changes", () => {
  const session = sessionWithPlayers(10); session.status = "setup";
  engine.applyHpMultiplier(session, 30);
  assert.equal(session.boss.hp, 30000);
  assert.ok([...session.players.values()].every(player => player.hp === 3000 && player.maxHp === 3000));
  for (const value of [0, 101, 1.5, "30", null, NaN]) assert.throws(() => engine.applyHpMultiplier(session, value));
  assert.equal(session.boss.hp, 30000);
  session.status = "active";
  assert.throws(() => engine.applyHpMultiplier(session, 2));
});

test("strongest landed attack preserves the bonus breakdown, shield reduction, and overkill limits", () => {
  const session = sessionWithPlayers(2); const cb = callbacks(); const player = session.players.get("0");
  const state = rules.createTypingState(1);
  Object.assign(state, { characters: 50, orange: .2, growth: .08, green: 2, red: .3,
    intervalCount: 10, intervalSum: 2000, intervalSquares: 400000 });
  const attack = rules.releaseAttack(state, () => .1); // 192 power.
  player.turnsTaken = 1;
  session.typingHost.shield = .25;
  engine.launchAttack(session, player, attack, cb);
  player.turnsTaken = 2; // Another attack can launch before this one lands.
  cb.timers.shift()();
  assert.equal(player.strongestAttack.power, 192);
  assert.equal(player.strongestAttack.actualDamage, 144);
  assert.equal(player.strongestAttack.blockedDamage, 48);
  assert.equal(player.strongestAttack.attackNumber, 1);
  assert.equal(player.strongestAttack.orangeBonus, .2);
  assert.equal(player.strongestAttack.greenBonus, .08);
  assert.equal(player.strongestAttack.criticalChance, .3);
  assert.equal(player.strongestAttack.meanIntervalMs, 200);
  assert.equal(player.strongestAttack.intervalStdDevMs, 0);
  engine.launchAttack(session, player, { ...attack, power: 250 }, cb);
  cb.timers.shift()();
  assert.equal(player.strongestAttack.power, 250);
  assert.equal(player.strongestAttack.actualDamage, 56);
  assert.equal(player.strongestAttack.blockedDamage, 0);
  const entries = engine.leaderboard(session);
  assert.equal(entries[0].code, "0"); assert.equal(entries[0].totalDamage, 200);
  assert.equal(entries[1].strongestAttack, null);
});

test("a weaker attack cannot replace the strongest attack, and canceled shots do not count", () => {
  const session = sessionWithPlayers(15); const cb = callbacks(); const player = session.players.get("0");
  engine.launchAttack(session, player, { power: 80, multiplier: 1, moveId: "weak" }, cb);
  cb.timers.shift()();
  engine.launchAttack(session, player, { power: 40, multiplier: 1, moveId: "weak" }, cb);
  cb.timers.shift()();
  assert.equal(player.strongestAttack.power, 80);
  engine.launchAttack(session, player, { power: 200, multiplier: 2, moveId: "strong" }, cb);
  session.status = "closed"; cb.timers.shift()();
  assert.equal(player.strongestAttack.power, 80);
});

test("end-of-game leaderboard is included in a patch without resending the live roster", () => {
  const previous = { status: "active", boss: { hp: 100 }, players: [{ code: "p", hp: 100 }], projectiles: [] };
  const final = { ...previous, status: "victory", leaderboard: [{ code: "p", totalDamage: 100 }] };
  const patch = engine.diffSnapshot(previous, final);
  assert.equal(patch.status, "victory"); assert.deepEqual(patch.leaderboard, final.leaderboard);
  assert.equal(patch.players, undefined);
});


test("200ms tolerance gives the requested fast sequence full rhythm and penalizes long pauses", () => {
  const score = gaps => rules.consistencyMultiplier(gaps.length, gaps.reduce((a,b) => a+b, 0), gaps.reduce((a,b) => a+b*b, 0));
  assert.equal(score([30,20,45,2,4,190,150,4]), 1.5);
  assert.equal(score([2,4,500,6,450,300,10000,3,4,2]), .5);
  assert.equal(score([1000,1002,998,1000]), 1.5);
  assert.equal(score([10,12,8,10]), 1.5);
  assert.equal(score([100,500]), 1.5); // SD exactly 200ms.
  assert.ok(score([100,700]) < 1.5);
});

test("word submissions without the required trailing space are rejected", () => {
  const session = sessionWithPlayers(1);
  const records = recordsFor(session.players.get("0").typing, 1);
  records[0][1] = records[0][1].trimEnd();
  assert.throws(() => engine.submitWords(session, {role:"player", actorCode:"0"}, records, callbacks()), /Invalid word/);
  assert.equal(session.players.get("0").typing.nextWord, 0);
});


test("selected grades filter every generated word and server validation uses the same pool", () => {
  const session = sessionWithPlayers(2);
  session.status = "setup";
  engine.applyGradeLevels(session, [0, 2]);
  const mask = (1 << 0) | (1 << 2);
  assert.equal(session.typingHost.gradeMask, mask);
  assert.ok([...session.players.values()].every(player => player.typing.gradeMask === mask));
  const entries = Object.values(require("../src/typingProject/resources/homeRowWordBank").entriesByLength).flat();
  const eligible = new Set(entries.filter(entry => [0,2].includes(entry.gradeLevel)).map(entry => entry.word));
  for (let index = 0; index < 1000; index++) assert.ok(eligible.has(rules.wordAt(123, index, mask).text));
  assert.ok(!rules.wordsForGrades(mask).includes("upn"));
  session.status = "active";
  engine.submitWords(session, {role:"player", actorCode:"0"}, recordsFor(session.players.get("0").typing), callbacks());
  assert.equal(session.projectiles.length, 1);
  assert.throws(() => engine.applyGradeLevels(session, [1]), /before/);
});

test("invalid or empty grade selections are rejected without changing the pool", () => {
  const session = sessionWithPlayers(1); session.status = "setup";
  for (const grades of [[], [-1], [13], [1.5], ["1"], [12], null]) {
    assert.throws(() => engine.applyGradeLevels(session, grades));
    assert.equal(session.typingHost.gradeMask, undefined);
  }
  assert.deepEqual(rules.wordsForGrades(), rules.WORDS);
  assert.deepEqual(rules.wordsForGrades(1), rules.wordsForGrades(1));
});


test("sentiment selections are shared by all actors and invalid combinations are atomic", () => {
  const session = sessionWithPlayers(2); session.status = "setup";
  engine.applyWordFilters(session, [0,1,2], ["positive", "negative"]);
  assert.equal(session.typingHost.gradeMask, 7);
  assert.equal(session.typingHost.sentimentMask, 3);
  assert.ok([...session.players.values()].every(player => player.typing.sentimentMask === 3));
  assert.ok(!rules.wordsForGrades(7, 3).includes("cat"));
  const old = {...session.typingHost};
  for (const args of [[[8], ["negative"]], [[0], []], [[0], ["angry"]], [[], ["positive"]]]) {
    assert.throws(() => engine.applyWordFilters(session, ...args));
    assert.deepEqual(session.typingHost, old);
  }
  session.status = "active";
  engine.submitWords(session, {role:"player", actorCode:"0"}, recordsFor(session.players.get("0").typing), callbacks());
  assert.equal(session.projectiles.length, 1);
  assert.throws(() => engine.applyWordFilters(session, undefined, undefined), /before/);
  session.status = "setup";
  engine.applyWordFilters(session, undefined, undefined);
  assert.equal(session.typingHost.sentimentMask, undefined);
  assert.equal(session.typingHost.gradeMask, undefined);
});
