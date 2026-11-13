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

test("gold words leave existing colors intact and require an exact word", () => {
  const state = rules.createTypingState(123, "barbarian");
  let gold = 0;
  for (let i = 0; i < 10000; i++) {
    const legacy = rules.wordAt(state.seed, i);
    const word = rules.typingWord(state, i);
    assert.equal(word.text, legacy.text);
    if (legacy.color) assert.equal(word.color, legacy.color);
    if (word.color === "gold") gold++;
  }
  assert.ok(gold > 400 && gold < 600);
  while (rules.typingWord(state).color !== "gold") state.nextWord++;
  const { text } = rules.typingWord(state);
  const missed = { ...state };
  rules.finishWord(missed, "!" + text.slice(1) + " ", 2, 400, 80000);
  assert.equal(missed.gold, 0);
  rules.finishWord(state, text + " ", 2, 400, 80000);
  assert.equal(state.gold, 1);
});

test("barbarian and dragon gold have no damage multiplier or carryover", () => {
  for (const role of ["barbarian", "dragon"]) {
    const state = rules.createTypingState(1, role);
    Object.assign(state, { characters: 100, gold: 3, nextPowerBonus: 5 });
    assert.equal(rules.releaseAttack(state).power, 100);
    assert.equal(state.nextPowerBonus, undefined);
    assert.equal(state.attackWords, 10);
    assert.equal(state.gold, 0);
    state.characters = 32;
    assert.equal(rules.releaseAttack(state).power, 32);
  }
});

test("a perfect final gold extends the current run and requires its separator", () => {
  for (const ability of ["barbarian", "dragon"]) {
    const state = rules.createTypingState(0, ability);
    while (rules.typingWord(state, 9).color !== "gold" || Array.from({length:9}, (_,i)=>rules.typingWord(state,i)).some(w=>w.color === "gold") || rules.typingWord(state,10).color === "gold" || rules.typingWord(state,11).color === "gold") state.seed++;
    const session = sessionWithPlayers(2);
    const host = ability === "dragon";
    if (host) session.typingHost = {...state}; else session.players.get("0").typing = {...state};
    const records = [];
    let characters = 0;
    for (let i=0; i<12; i++) {
      const word = rules.typingWord(state);
      const text = word.text + (rules.requiresWordSpace(state,word.text) ? " " : "");
      const count=text.length-(state.wordsInAttack === 0 ? 1 : 0);
      records.push([i,text,count,count*200,count*40000]);
      characters += text.length;
      rules.finishWord(state,text,count,count*200,count*40000);
      if(i === 9) { assert.equal(state.attackWords,12); assert.equal(state.characters,characters); }
    }
    assert.ok(records[9][1].endsWith(" "));
    assert.ok(!records[11][1].endsWith(" "));
    const cb = {...callbacks(),random:()=>.4};
    engine.submitWords(session, host ? {role:"host"} : {role:"player",actorCode:"0"}, records, cb);
    const actual = host ? session.typingHost : session.players.get("0").typing;
    assert.equal(actual.nextWord,12);
    assert.equal(actual.attackWords,10);
    assert.equal(actual.characters,0);
    assert.equal(cb.timers.length,1, "no attack fires until the extra words are typed");
  }
});

test("monk attack size rounds upward and resets, or renews from a shortened attack", () => {
  const state = rules.createTypingState(1, "monk");
  for (const [gold, size] of [[0, 10], [1, 5], [2, 3], [3, 2], [4, 1], [5, 1], [1, 5], [0, 10]]) {
    Object.assign(state, { characters: 20, gold });
    assert.equal(rules.releaseAttack(state).power, 20, "gold does not change the monk's damage formula");
    assert.equal(rules.attackWordLimit(state), size);
  }
});

test("monk batch validation follows gold into two consecutive five-word attacks", () => {
  const session = sessionWithPlayers(2);
  const actor = session.players.get("0");
  const preview = rules.createTypingState(0, "monk");
  const goldIn = (start, count) => Array.from({ length: count }, (_, i) => rules.typingWord(preview, start + i)).filter(word => word.color === "gold").length;
  while (goldIn(0, 10) !== 1 || goldIn(10, 5) !== 1 || goldIn(15, 5) !== 0) preview.seed++;
  actor.typing = { ...preview };
  const records = Array.from({ length: 20 }, (_, index) => {
    const text = rules.typingWord(preview).text + (rules.isLastAttackWord(preview) ? "" : " ");
    const count = text.length - (preview.wordsInAttack === 0 ? 1 : 0);
    const record = [index, text, count, count * 200, count * 40000];
    rules.finishWord(preview, ...record.slice(1));
    if (preview.wordsInAttack === rules.attackWordLimit(preview)) rules.releaseAttack(preview);
    return record;
  });
  assert.ok(!records[14][1].endsWith(" ") && !records[19][1].endsWith(" "));
  const auth = { role: "player", actorCode: actor.code };
  const invalid = records.map(record => [...record]);
  invalid[14][1] += " ";
  const cb = callbacks();
  assert.throws(() => engine.submitWords(session, auth, invalid, cb), /word order/);
  assert.equal(actor.typing.nextWord, 0, "bad mixed-length batch is atomic");
  engine.submitWords(session, auth, records, cb);
  engine.submitWords(session, auth, records, cb);
  assert.equal(actor.turnsTaken, 3);
  assert.equal(actor.typing.nextWord, 20);
  assert.equal(actor.typing.attackWords, 10);
});

test("gold support targets living wounded players, knocked-out players, and unshielded allies respectively", () => {
  const session = sessionWithPlayers(4);
  const [actor, down, lowest, ally] = [...session.players.values()];
  down.hp = 0; lowest.hp = 20; ally.hp = 40;
  const attack = { power: 30, multiplier: 1, moveId: "weak", gold: 1 };
  const cb = callbacks();
  actor.typing = rules.createTypingState(1, "cleric");
  engine.launchAttack(session, actor, attack, cb);
  assert.equal(lowest.hp, 50);
  assert.equal(down.hp, 0);
  assert.equal(session.projectiles.at(-1).kind, "heal");
  actor.typing = rules.createTypingState(1, "necromancer");
  engine.launchAttack(session, actor, attack, cb);
  assert.equal(down.hp, 30);
  assert.equal(session.projectiles.at(-1).kind, "resurrect");
  engine.launchAttack(session, actor, attack, cb);
  assert.equal(session.projectiles.at(-1).kind, "damage", "no knocked-out ally means normal attack");
  actor.typing = rules.createTypingState(1, "paladin");
  down.typing.paladinShield = 10;
  ally.typing.paladinShield = 15;
  engine.launchAttack(session, actor, attack, cb);
  assert.equal(lowest.typing.paladinShield, 30);
  assert.equal(session.projectiles.at(-1).moveId, "goldShield");
  engine.launchAttack(session, actor, attack, cb);
  assert.equal(down.typing.paladinShield, 40, "stack if everyone already has shields");
  assert.equal(actor.typing.paladinShield, 0);
  const hit = { ...callbacks(), random: () => .99 };
  engine.launchAttack(session, session.typingHost, { ...attack, power: 100 }, hit);
  hit.timers.shift()();
  assert.equal(down.hp, 30);
  assert.equal(down.typing.paladinShield, 0, "the shield expires after absorbing one hit");
});

test("a full-health cleric heals an eligible wounded living ally in both modes", () => {
  for (const balanced of [false, true]) {
    const session = sessionWithPlayers(4);
    const [cleric, down, lowest, injured] = [...session.players.values()];
    cleric.typing = rules.createTypingState(1, "cleric");
    down.hp = 0; lowest.hp = 20; injured.hp = 60;
    if(balanced){session.balanced=true;session.clericHealingPool=25;session.clericHealingAllowance=25;}
    const attack = balanced ? { balanced: true, base: 100, earnedPower: 125, power: 100, supportPower: 25, multiplier: 1, moveId: "weak", gold: 1 }
      : { power: 30, multiplier: 1, moveId: "weak", gold: 1 };
    engine.launchAttack(session, cleric, attack, {...callbacks(),random:()=>0});
    const heal = session.projectiles.find(projectile => projectile.kind === "heal");
    assert.equal(cleric.hp, 100, "the caster receives no healing at full HP");
    assert.equal(down.hp, 0, "healing cannot revive");
    assert.equal(injured.hp, 60);
    assert.equal(lowest.hp, balanced ? 45 : 50);
    assert.equal(heal.target, lowest.code);
    assert.equal(heal.targetName, lowest.name, "personal views can name off-screen recipients");
    assert.equal(cleric.totalHealing, heal.amount);
  }
});

test("shield feedback reports the absorbed amount separately from damage", () => {
  for (const shield of [0.5, 1]) {
    const session = sessionWithPlayers(1);
    const player = session.players.get("0");
    player.typing.shield = shield;
    player.typing.paladinShield = shield === .5 ? 3 : 0;
    const cb = { ...callbacks(), random: () => .99 };
    engine.launchAttack(session, session.typingHost, { power: 20, multiplier: 1, moveId: "weak" }, cb);
    cb.timers.shift()();
    const hit = session.projectiles[0];
    assert.equal(hit.amount, shield === .5 ? 7 : 0);
    assert.equal(hit.blockedAmount, 20 - hit.amount);
    assert.equal(player.hp, 100 - hit.amount);
  }
});

test("rogue stacks independent dodge rolls for one incoming attack", t => {
  let now=1000; t.mock.method(Date,'now',()=>now);
  const session = sessionWithPlayers(1);
  const player = session.players.get("0");
  player.typing = rules.createTypingState(1, "rogue");
  Object.assign(player.typing, { gold: 2, dodgeSamples: [25], paladinShield: 10 });
  rules.releaseAttack(player.typing);
  assert.equal(player.typing.dodgeExtraRolls, 2);
  assert.equal(rules.effectiveDodgeChance(player.typing), 1 - .75 ** 3);
  const rolls = [.99, .5, .99, .5];
  const cb = { ...callbacks(), random: () => rolls.shift() };
  const attack = { power: 20, multiplier: 1, moveId: "weak" };
  engine.launchAttack(session, session.typingHost, attack, cb);
  now=2700;
  cb.timers.shift()();
  assert.equal(session.projectiles.at(-1).evadeType, "dodge");
  assert.equal(player.typing.dodgeExtraRolls, 0);
  assert.equal(player.typing.paladinShield, 10);
  now=3000; cb.timers.shift()(); // The complete breath lock ends before the next attack.
  engine.launchAttack(session, session.typingHost, attack, cb);
  now=4700;
  cb.timers.shift()();
  assert.equal(player.hp, 90);
  assert.equal(player.typing.paladinShield, 0);
});

test("dodge banks proficiency gains at either speed without losing progress to slow transitions", () => {
  const fast = rules.createTypingState(42);
  const slow = rules.createTypingState(42);
  const finish = (state, gap, pace) => {
    const word = rules.wordAt(state.seed, state.nextWord).text;
    const text = "!" + word.slice(1) + (state.nextWord % 10 === 9 ? "" : " ");
    rules.finishWord(state, text, 3, gap + 2 * pace, gap ** 2 + 2 * pace ** 2, gap);
  };
  finish(fast, 40, 40); finish(slow, 300, 300);
  assert.equal(rules.dodgeChance(fast), 0, "attack-opening key gap does not count");
  finish(fast, 40, 40); finish(slow, 300, 300);
  assert.equal(rules.dodgeChance(fast), 1);
  assert.equal(rules.dodgeChance(slow), 1, "accuracy and absolute speed do not set dodge");
  for (let i = 0; i < 5; i++) finish(slow, 1500, 300);
  assert.equal(rules.dodgeChance(slow), 1);
  assert.equal(slow.dodgeSamples.length, 5);
  rules.releaseAttack(fast);
  assert.equal(rules.dodgeChance(fast), 1, "firing an attack does not reset dodge");
  for (let i=0;i<160;i++) finish(fast,40,40);
  assert.equal(rules.dodgeChance(fast),160,"accumulation keeps growing beyond 100 points");
  assert.equal(rules.effectiveDodgeChance(fast),1);
  fast.dodgeExtraRolls=2;
  assert.equal(rules.effectiveDodgeChance(fast),1,"extra rolls never produce a chance above 100%");
  rules.releaseAttack(slow);
  finish(slow,300,300); // Opening word does not add a transition.
  finish(slow,600,300); // Partial proficiency earns a smaller positive gain.
  assert.ok(rules.dodgeChance(slow)>1 && rules.dodgeChance(slow)<2);
});

test("transition timing is validated against the word's other gaps, and retries don't add samples", () => {
  const session = sessionWithPlayers(1);
  const actor = session.players.get("0");
  const auth = { role: "player", actorCode: actor.code };
  const cb = callbacks();
  const records = recordsFor(actor.typing, 2);
  assert.throws(() => engine.submitWords(session, auth, [[...records[0], 200]], cb), /transition timing/);
  assert.throws(() => engine.submitWords(session, auth, [records[0], [...records[1], 400]], cb), /transition timing/);
  assert.equal(actor.typing.nextWord, 0);
  const valid = [records[0], [...records[1], 200]];
  engine.submitWords(session, auth, valid, cb);
  engine.submitWords(session, auth, valid, cb);
  assert.deepEqual(actor.typing.dodgeSamples, [25]);
});

test("player and dragon dodges avoid damage without consuming a shield", () => {
  const session = sessionWithPlayers(1);
  const player = session.players.get("0");
  const attack = { power: 20, multiplier: 2, moveId: "strong", critical: true };
  const cb = { ...callbacks(), random: () => 0.24 };
  for (const defender of [player.typing, session.typingHost]) {
    defender.dodgeSamples = [25];
    defender.shield = .1;
  }
  engine.launchAttack(session, session.typingHost, attack, cb);
  engine.launchAttack(session, player, attack, cb);
  cb.timers.splice(0).forEach(resolve => resolve());
  assert.ok(session.projectiles.every(shot => shot.evadeType === "dodge" && !shot.willHit && shot.amount === 0));
  assert.equal(player.hp, 100);
  assert.equal(session.boss.hp, 100);
  assert.equal(player.typing.shield, .1);
  assert.equal(session.typingHost.shield, .1);
  assert.equal(player.bossHitsTaken, 0);
  assert.equal(player.totalDamage, 0);
  assert.equal(player.strongestAttack, undefined);
  cb.random = () => 0.25;
  engine.launchAttack(session, player, attack, cb);
  cb.timers[0]();
  assert.equal(session.boss.hp, 82);
  assert.equal(session.typingHost.shield, 0);
});

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
    assert.equal(attack.base, 9 + rules.wordAt(seed,9).text.length, "only matching characters earn power; errors cannot remove it");
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

test("consistency depends on timing variation, with 1.5x and 1x limits", () => {
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

test("power animation uses the actual multiplier and never weakens critical hits for timing", () => {
  const strong = rules.createTypingState(1);
  Object.assign(strong, { characters: 40, orange: 1 });
  assert.equal(rules.releaseAttack(strong, () => 1).moveId, "strong");
  const weak = rules.createTypingState(1);
  Object.assign(weak, { characters: 40, red: 1, intervalCount: 10, intervalSum: 1000, intervalSquares: 2000000 });
  const attack = rules.releaseAttack(weak, () => 0);
  assert.equal(attack.critical, true); assert.equal(attack.multiplier, 2); assert.equal(attack.moveId, "strong");
});

test("boss attack roll selects the advertised pattern and splits all power among its targets", () => {
  for (const [roll, kind, count] of [[0, "bite", 1], [.299, "bite", 1], [.3, "fireball", 1], [.599, "fireball", 1], [.6, "tailWhip", 3], [.899, "tailWhip", 3], [.9, "flamethrower", 10], [.999, "flamethrower", 10]]) {
    const session = sessionWithPlayers(10);
    const rolls = [roll, .49]; // Select position 4, at the start of the second rank.
    const cb = { ...callbacks(), random: () => rolls.shift() ?? 1 };
    engine.launchAttack(session, session.typingHost, { power: 90, multiplier: 1, moveId: "weak" }, cb);
    assert.equal(session.projectiles.length, count);
    assert.ok(session.projectiles.every(shot => shot.bossAttack === kind && shot.amount === 90 / count));
    if (kind === "tailWhip") assert.deepEqual(session.projectiles.map(shot => shot.target).sort(), ["0", "4", "8"]);
  }
});

test("tail whip selects nearby formation slots and skips defeated players", () => {
  const session = sessionWithPlayers(12);
  session.players.get("8").hp = 0;
  const rolls = [.7, .8]; // Position 9, in the last rank.
  const cb = { ...callbacks(), random: () => rolls.shift() ?? 1 };
  engine.launchAttack(session, session.typingHost, { power: 60, multiplier: 1, moveId: "weak" }, cb);
  assert.deepEqual(session.projectiles.map(shot => shot.target).sort((a,b)=>Number(a)-Number(b)), ["5", "9", "10"]);
  assert.ok(session.projectiles.every(shot => shot.amount === 20));
});

test("battle formation keeps up to 30 players on the left platform clear of the dragon and foreground", () => {
  for (const size of [1,4,5,10,15,30]) {
    const points = Array.from({length:size}, (_, index) => rules.proportionalPlayerPoint(index,size));
    assert.equal(new Set(points.map(point => `${point.x}:${point.y}`)).size,size);
    assert.ok(points.every(point => point.x >= 10 && point.x <= 55 && point.y >= 54 && point.y <= 84));
    for (let index=0;index<size;index++) {
      if (index%4) {
        assert.ok(points[index].x<points[index-1].x);
        assert.ok(points[index].y>points[index-1].y);
      }
      if (index>=4) {
        assert.ok(points[index].x<points[index-4].x);
        assert.ok(points[index].y>points[index-4].y);
      }
      assert.deepEqual(points[index],rules.proportionalPlayerPoint(index,30),"adding players must not shift occupied slots");
    }
  }
});

test("flamethrower shields apply on impact and consume once", t => {
  let now=1000; t.mock.method(Date,'now',()=>now);
  const session = sessionWithPlayers(15);
  const cb = { ...callbacks(), random: () => .95 };
  engine.launchAttack(session, session.typingHost, { power: 150, multiplier: 1.5, moveId: "weak" }, cb);
  assert.equal(session.projectiles.length, 15);
  assert.equal(cb.timers.length, 2, "one damage timer for the whole volley and one breath-lock timer");
  const player = session.players.get("0");
  player.typing.shield = .2; // Can earn blue during flight.
  now=2700;
  cb.timers.shift()();
  assert.equal(player.hp, 92); assert.equal(player.typing.shield, 0);
  assert.equal(session.players.get("1").hp, 90);
  now=3000; cb.timers.shift()();
  engine.launchAttack(session, session.typingHost, { power: 150, multiplier: 1, moveId: "weak" }, cb);
  now=4700;
  cb.timers.shift()();
  assert.equal(player.hp, 82); assert.equal(player.typing.totalTaken, 18);
});

test("flamethrower divides fractional damage equally among survivors", () => {
  const session = sessionWithPlayers(30); const cb = { ...callbacks(), random: () => .95 };
  session.players.get("0").hp = 0;
  engine.launchAttack(session, session.typingHost, { power: 10, multiplier: 1, moveId: "weak" }, cb);
  assert.equal(session.projectiles.length, 29);
  cb.timers.shift()();
  assert.ok(Math.abs(session.players.get("1").hp - (100 - 10 / 29)) < .000001);
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

test('identical rebuilt dragon profiles and typing arrays never produce redundant patches', () => {
  const before = { status:'active', boss:{hp:100,profile:{balanced:true,balancedCritBonus:.1,dodgeSamples:[10]}},
    typing:{seed:1,balancedPace:[100,120]}, players:[],projectiles:[] };
  const after = structuredClone(before);
  assert.equal(engine.diffSnapshot(before,after),null);
  after.boss.profile.balancedCritBonus=.2;
  const patch=engine.diffSnapshot(before,after);
  assert.equal(patch.boss.profile.balancedCritBonus,.2);
  assert.equal(patch.typing,undefined);
});

test("HP multiplier scales both sides equally and rejects invalid or late changes", () => {
  const session = sessionWithPlayers(10); session.status = "setup";
  engine.applyHpMultiplier(session, 1.5);
  assert.equal(session.boss.hp, 1500);
  assert.ok([...session.players.values()].every(player => player.hp === 150 && player.maxHp === 150));
  for (const value of [0, .99, 1.51, 3, "1.5", null, NaN, Infinity]) assert.throws(() => engine.applyHpMultiplier(session, value));
  assert.equal(session.boss.hp, 1500);
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

test('boss results count group damage once, honor defenses and overkill, and preserve volley strength',()=>{
  const session=sessionWithPlayers(3),cb=callbacks();
  Object.assign(session,{balanced:true,bossAttackIndex:9});
  session.players.get('0').typing.shield=.5;
  session.players.get('1').typing.dodgeBank=100;
  session.players.get('2').hp=5;
  engine.launchAttack(session,session.typingHost,{base:60,power:90,multiplier:1.5,moveId:'weak'}, {...cb,random:()=>0});
  cb.timers.shift()();
  assert.equal(session.boss.totalDamage,20);
  assert.equal(session.boss.strongestAttack.power,90);
  assert.equal(session.boss.strongestAttack.actualDamage,20);
  assert.equal(session.boss.strongestAttack.blockedDamage,15);
  session.startedAt=1000;session.closedAt=61000;
  const entries=engine.leaderboard(session),boss=entries.find(entry=>entry.isBoss);
  assert.equal(entries.length,4);assert.equal(boss.name,'Ancient Red Dragon');
  assert.equal(boss.totalDamage,20);assert.equal(boss.dps,.33);
  assert.equal(boss.strongestAttack.attackNumber,1);
  assert.deepEqual(entries.filter(entry=>!entry.isBoss).map(entry=>entry.rank),[1,2,3]);
});

test('battle typing accuracy and timing survive attack releases, with frozen end-of-battle DPS and WPM',()=>{
  const session=sessionWithPlayers(1),player=session.players.get('0'),state=player.typing;
  const word=rules.typingWord(state),text='!'+word.text.slice(1)+' ',n=text.length-1;
  rules.finishWord(state,text,n,n*100,n*10000,undefined,Array(n).fill(100));
  rules.releaseAttack(state,()=>1);
  session.startedAt=1000;session.closedAt=61000;player.totalDamage=120;
  const entry=engine.leaderboard(session)[0];
  assert.equal(entry.dps,2);
  assert.equal(entry.typingStats.accuracy,(text.length-1)/text.length);
  assert.equal(entry.typingStats.wpm,Math.round((text.length-1)/5*100)/100);
  assert.equal(entry.typingStats.meanIntervalMs,100);
  assert.equal(entry.typingStats.intervalStdDevMs,0);
  assert.deepEqual(engine.leaderboard(session)[0],entry);
});


test("200ms tolerance gives the requested fast sequence full rhythm and leaves base damage intact during long pauses", () => {
  const score = gaps => rules.consistencyMultiplier(gaps.length, gaps.reduce((a,b) => a+b, 0), gaps.reduce((a,b) => a+b*b, 0));
  assert.equal(score([30,20,45,2,4,190,150,4]), 1.5);
  assert.equal(score([2,4,500,6,450,300,10000,3,4,2]), 1);
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
