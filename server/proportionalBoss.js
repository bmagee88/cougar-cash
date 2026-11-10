const crypto = require("node:crypto");
const { createTypingState, wordAt, finishWord, releaseAttack, attackProgress, wordsForGrades, dodgeChance } = require("../src/TypingBoss/proportionalRules");

const round = value => Math.round(value * 100) / 100;
const newState = () => createTypingState(crypto.randomBytes(4).readUInt32LE());

function launchAttack(session, actor, attack, { schedule, broadcast, random = Math.random }) {
  const now = Date.now();
  const host = actor === session.typingHost;
  const attackNumber = actor.turnsTaken || 0;
  const targets = host ? [...session.players.values()].filter(player => player.hp > 0) : [session.boss];
  const volley = targets.map(target => ({
    id: crypto.randomBytes(8).toString("hex"),
    source: host ? "boss" : actor.code, sourceName: host ? session.boss.name : actor.name,
    target: host ? target.code : "boss", kind: host ? "boss" : "damage",
    bossId: session.boss.id, moveId: attack.moveId,
    moveLabel: attack.multiplier >= 2 ? "Power attack" : "Quick attack",
    multiplier: round(attack.multiplier), startedAt: now, impactAt: now + 700,
    resolvedAt: null, amount: host ? attack.power / session.startingPlayers : attack.power,
    willHit: true, ...(attack.critical ? { critical: true } : {}),
  }));
  session.projectiles.push(...volley);
  schedule(session, () => {
    // A finished fight cancels in-flight damage.
    if (session.status !== "active") return;
    for (const projectile of volley) {
      const target = host ? session.players.get(projectile.target) : session.boss;
      let damage = target.hp > 0 ? projectile.amount : 0;
      const defense = host ? target.typing : session.typingHost;
      const chance = dodgeChance(defense);
      if (damage > 0 && chance > 0 && random() < chance / 100) {
        Object.assign(projectile, { willHit: false, evadeType: "dodge", amount: 0, resolvedAt: Date.now() });
        continue;
      }
      if (target.hp > 0) {
        damage *= 1 - defense.shield;
        defense.shield = 0;
        if (host) target.bossHitsTaken += 1;
      }
      const actual = Math.min(target.hp, damage);
      target.hp = Math.max(0, target.hp - actual);
      projectile.amount = round(actual);
      projectile.resolvedAt = Date.now();
      defense.totalTaken += actual;
      if (!host) actor.totalDamage += actual;
      if (!host && (!actor.strongestAttack || attack.power > actor.strongestAttack.power ||
        (attack.power === actor.strongestAttack.power && actual > actor.strongestAttack.actualDamage))) {
        actor.strongestAttack = { ...attack, actualDamage: actual,
          blockedDamage: Math.max(0, attack.power - damage),
          attackNumber, landedAt: projectile.resolvedAt };
      }
    }
    if (session.boss.hp <= 0) session.status = "victory";
    else if (![...session.players.values()].some(player => player.hp > 0)) session.status = "defeat";
    if (session.status !== "active") session.closedAt = Date.now();
    broadcast(session);
  }, 700);
}

function submitWords(session, auth, records, callbacks) {
  if (session.status !== "active") throw new Error("The fight is not active.");
  const actor = auth.role === "host" ? session.typingHost : session.players.get(auth.actorCode);
  if (!actor || (auth.role === "player" && actor.hp <= 0)) throw new Error("You have been knocked out.");
  const state = auth.role === "host" ? actor : actor.typing;
  if (!Array.isArray(records) || !records.length || records.length > 20) throw new Error("Send 1–20 completed words.");
  // Validate the whole batch before mutating anything. Retries may overlap an acknowledged prefix.
  let expected = state.nextWord;
  let addedCharacters = 0;
  const fresh = [];
  for (const record of records) {
    if (!Array.isArray(record) || (record.length !== 5 && record.length !== 6)) throw new Error("Invalid word result.");
    const [index, text, count, sum, squares, transitionMs] = record;
    if (!Number.isInteger(index) || index < 0) throw new Error("Invalid word index.");
    if (index < state.nextWord) continue;
    const word = wordAt(state.seed, index, state.gradeMask, state.sentimentMask);
    const length = word.text.length + (index % 10 === 9 ? 0 : 1);
    const expectedCount = length - (index % 10 === 0 ? 1 : 0);
    if (index !== expected || typeof text !== "string" || text.length !== length || (index % 10 !== 9 && !text.endsWith(" ")) ||
      !Number.isInteger(count) || count < length - 1 || count > expectedCount ||
      !Number.isFinite(sum) || !Number.isFinite(squares) || sum < 0 || squares < 0 ||
      sum > 7200000 * count || squares > 7200000 ** 2 * count ||
      (count > 0 && (squares + 1 < sum * sum / count || squares > sum * sum + 1))) {
      throw new Error("Invalid word order or key timing.");
    }
    if (record.length === 6) {
      if (index % 10 === 0 || count < 2 || count !== expectedCount ||
          !Number.isFinite(transitionMs) || transitionMs < 0 || transitionMs > Math.min(sum, 7200000)) {
        throw new Error("Invalid word transition timing.");
      }
      const remaining = sum - transitionMs;
      const remainingSquares = squares - transitionMs ** 2;
      if (remainingSquares + 1 < remaining ** 2 / (count - 1) || remainingSquares > remaining ** 2 + 1) {
        throw new Error("Invalid word transition timing.");
      }
    }
    expected += 1;
    addedCharacters += text.length;
    fresh.push(record);
  }
  if (state.totalCharacters + addedCharacters > (Date.now() - session.startedAt) * 0.03 + 60) {
    throw new Error("Typing arrived too quickly. Try again shortly.");
  }
  for (const [, text, count, sum, squares, transitionMs] of fresh) {
    const result = finishWord(state, text, count, sum, squares, transitionMs);
    if (auth.role === "player") {
      actor.totalKeystrokes += text.length;
      actor.correctKeystrokes += result.correct ? text.length : 0;
      actor.correctStreak = result.correct ? actor.correctStreak + 1 : 0;
      actor.lastSeenAt = Date.now();
    }
    if (state.wordsInAttack === 10) {
      const attack = releaseAttack(state);
      if (auth.role === "player") actor.turnsTaken += 1;
      launchAttack(session, actor, attack, callbacks);
      (auth.role === "host" ? session.boss : actor).attackProgress = 0;
    }
  }
  if (fresh.length) callbacks.broadcast(session);
  return { nextWord: state.nextWord };
}

function updateProgress(session, auth, wordIndex, characters, broadcast) {
  if (session.mode !== "proportional" || session.status !== "active") return;
  const actor = auth.role === "host" ? session.typingHost : session.players.get(auth.actorCode);
  const state = auth.role === "host" ? actor : actor?.typing;
  if (!state || (auth.role === "player" && actor.hp <= 0)) return;
  if (!Number.isInteger(wordIndex) || wordIndex < state.nextWord || wordIndex > state.nextWord + 40 ||
      !Number.isInteger(characters) || characters < 0 || characters > wordAt(state.seed, wordIndex, state.gradeMask, state.sentimentMask).text.length) return;
  const previous = actor.progressCursor;
  if (previous && (wordIndex < previous.wordIndex || (wordIndex === previous.wordIndex && characters <= previous.characters))) return;
  // Progress is cosmetic only. It never awards damage or changes typing stats.
  const now = Date.now();
  if (actor.progressUpdatedAt && now - actor.progressUpdatedAt < 300) return;
  actor.progressUpdatedAt = now;
  actor.progressCursor = { wordIndex, characters };
  const target = auth.role === "host" ? session.boss : actor;
  target.attackProgress = Math.round(attackProgress(state.seed, wordIndex, characters, state.gradeMask, state.sentimentMask));
  broadcast(session);
}

// Nested diffs preserve unchanged player objects on the client and avoid replaying logs/FX.
function diffSnapshot(previous, current) {
  const delta = {};
  for (const key of ["status", "closedAt", "startingPlayers", "hpMultiplier", "leaderboard"]) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) delta[key] = current[key];
  }
  if (current.typing) {
    const typing = {};
    for (const key of Object.keys(current.typing)) {
      if (current.typing[key] !== previous.typing?.[key]) typing[key] = current.typing[key];
    }
    if (Object.keys(typing).length) delta.typing = typing;
  }
  const boss = {};
  for (const key of Object.keys(current.boss)) {
    if (current.boss[key] !== previous.boss[key]) boss[key] = current.boss[key];
  }
  if (Object.keys(boss).length) delta.boss = boss;
  const oldPlayers = new Map(previous.players.map(player => [player.code, player]));
  const players = [];
  for (const player of current.players) {
    const old = oldPlayers.get(player.code);
    if (!old) { players.push(player); continue; }
    const patch = { code: player.code };
    for (const key of Object.keys(player)) {
      if (JSON.stringify(player[key]) !== JSON.stringify(old[key])) patch[key] = player[key];
    }
    if (Object.keys(patch).length > 1) players.push(patch);
  }
  if (players.length) delta.players = players;
  const oldProjectiles = new Map(previous.projectiles.map(item => [item.id, item]));
  const projectiles = [];
  for (const item of current.projectiles) {
    const old = oldProjectiles.get(item.id);
    if (!old) { projectiles.push(item); continue; }
    const patch = { id: item.id };
    for (const key of Object.keys(item)) if (item[key] !== old[key]) patch[key] = item[key];
    if (Object.keys(patch).length > 1) projectiles.push(patch);
  }
  if (projectiles.length) delta.projectiles = projectiles;
  const ids = new Set(current.projectiles.map(item => item.id));
  const remove = previous.projectiles.filter(item => !ids.has(item.id)).map(item => item.id);
  if (remove.length) delta.removeProjectiles = remove;
  return Object.keys(delta).length ? delta : null;
}

function applyHpMultiplier(session, multiplier = 1) {
  if (session.status !== "setup") throw new Error("HP can only be changed before the battle starts.");
  if (!Number.isInteger(multiplier) || multiplier < 1 || multiplier > 100) throw new Error("Choose an HP multiplier from 1 to 100.");
  session.hpMultiplier = multiplier;
  for (const player of session.players.values()) player.hp = player.maxHp = 100 * multiplier;
  session.boss.hp = session.boss.maxHp = 100 * multiplier * session.players.size;
}

function leaderboard(session) {
  return [...session.players.values()]
    .sort((a, b) => b.totalDamage - a.totalDamage || a.code.localeCompare(b.code))
    .map((player, index) => ({ rank: index + 1, code: player.code, name: player.name,
      totalDamage: round(player.totalDamage), strongestAttack: player.strongestAttack ? { ...player.strongestAttack } : null }));
}

module.exports = { newState, submitWords, diffSnapshot, launchAttack, applyHpMultiplier, leaderboard, updateProgress };


function applyGradeLevels(session, grades) {
  if (session.status !== "setup") throw new Error("Grades can only be changed before the battle starts.");
  if (grades === undefined) return;
  if (!Array.isArray(grades) || !grades.length || grades.length > 13 || grades.some(grade => !Number.isInteger(grade) || grade < 0 || grade > 12)) {
    throw new Error("Choose at least one grade from kindergarten through grade 12.");
  }
  const mask = grades.reduce((value, grade) => value | (1 << grade), 0);
  wordsForGrades(mask); // Validate availability before changing any actor.
  session.typingHost.gradeMask = mask;
  for (const player of session.players.values()) player.typing.gradeMask = mask;
}
module.exports.applyGradeLevels = applyGradeLevels;


function applyWordFilters(session, grades, sentiments) {
  if (session.status !== "setup") throw new Error("Word filters can only be changed before the battle starts.");
  let gradeMask, sentimentMask;
  if (grades !== undefined) {
    if (!Array.isArray(grades) || !grades.length || grades.length > 13 || grades.some(grade => !Number.isInteger(grade) || grade < 0 || grade > 12)) throw new Error("Choose valid grades.");
    gradeMask = grades.reduce((mask, grade) => mask | (1 << grade), 0);
  }
  if (sentiments !== undefined) {
    const options = ["positive", "negative", "neutral"];
    if (!Array.isArray(sentiments) || !sentiments.length || sentiments.length > 3 || sentiments.some(value => !options.includes(value))) throw new Error("Choose valid sentiments.");
    sentimentMask = sentiments.reduce((mask, value) => mask | (1 << options.indexOf(value)), 0);
  }
  wordsForGrades(gradeMask, sentimentMask);
  for (const actor of [session.typingHost, ...[...session.players.values()].map(player => player.typing)]) {
    actor.gradeMask = gradeMask;
    actor.sentimentMask = sentimentMask;
  }
}
module.exports.applyWordFilters = applyWordFilters;
