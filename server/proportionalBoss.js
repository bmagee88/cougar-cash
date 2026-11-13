const crypto = require("node:crypto");
const { isDeepStrictEqual } = require('node:util');
const integrity = require('./typingBossIntegrity');
const { requestDragonAttack, recordDragonHurt, clearDragonCombat } = require("./dragonCombat");
const { DRAGON_FLAME, dragonAttackDuration } = require("../src/TypingBoss/dragonHurtRules");
const { createTypingState, typingWord, attackWordLimit, requiresWordSpace, finishWord, releaseAttack, typingAttackProgress, wordsForGrades, effectiveDodgeChance, dodgeChance, proportionalPlayerPoint, initializeBalanced } = require("../src/TypingBoss/proportionalRules");

const round = value => Math.round(value * 100) / 100;
const newState = ability => ({...createTypingState(crypto.randomBytes(4).readUInt32LE(), ability),wordProtocol:1});

const BOSS_ATTACK_LABELS = { bite: "Bite", fireball: "Fireball", tailWhip: "Tail Whip", flamethrower: "Flamethrower" };

function chooseBossAttack(session, random) {
  const roster = [...session.players.values()];
  const living = roster.map((player, index) => ({ player, point: proportionalPlayerPoint(index, roster.length) }))
    .filter(({ player }) => player.hp > 0);
  const order = ["bite", "fireball", "tailWhip", "bite", "fireball", "tailWhip", "bite", "fireball", "tailWhip", "flamethrower"];
  const step = session.bossAttackIndex || 0;
  const roll = session.balanced ? 0 : random();
  const kind = session.balanced ? order[step % order.length] : roll < .3 ? "bite" : roll < .6 ? "fireball" : roll < .9 ? "tailWhip" : "flamethrower";
  if (session.balanced) session.bossAttackIndex = step + 1;
  if (kind === "flamethrower" || !living.length) return { kind, targets: living.map(({ player }) => player) };
  const anchor = living[session.balanced ? step % living.length : Math.floor(random() * living.length)];
  if (kind !== "tailWhip") return { kind, targets: [anchor.player] };
  const distance = ({ point }) => (point.x - anchor.point.x) ** 2 + (point.y - anchor.point.y) ** 2;
  const count = Math.max(1, Math.round(living.length * .3));
  const targets = living.sort((a, b) => distance(a) - distance(b)).slice(0, count).map(({ player }) => player);
  return { kind, targets };
}

function resolveGoldSupport(session, actor, power, now) {
  const roster = [...session.players.values()];
  const byHp = (a, b) => a.hp - b.hp;
  let target, kind, moveLabel, amount;
  switch (actor.typing.ability) {
    case "cleric":
      target = roster.filter(player => player.hp > 0 && player.hp < player.maxHp).sort(byHp)[0];
      if (!target) return false;
      kind = "heal"; moveLabel = "Golden Heal";
      amount = Math.min(target.maxHp - target.hp, power);
      target.hp += amount;
      actor.totalHealing = (actor.totalHealing || 0) + amount;
      break;
    case "necromancer":
      target = roster.find(player => player.hp <= 0);
      if (!target) return false;
      kind = "resurrect"; moveLabel = "Golden Revival";
      amount = Math.min(target.maxHp, power);
      target.hp = amount;
      actor.totalResurrections = (actor.totalResurrections || 0) + 1;
      break;
    case "paladin": {
      const allies = roster.filter(player => player !== actor && player.hp > 0).sort(byHp);
      target = allies.find(player => !player.typing.shield && !player.typing.paladinShield) || allies[0];
      if (!target) return false;
      kind = "buff"; moveLabel = "Golden Shield"; amount = power;
      target.typing.paladinShield = (target.typing.paladinShield || 0) + power;
      actor.totalBuffs = (actor.totalBuffs || 0) + 1;
      break;
    }
    default: return false;
  }
  session.projectiles.push({
    id: crypto.randomBytes(8).toString("hex"), source: actor.code, sourceName: actor.name,
    target: target.code, targetName: target.name, kind, moveId: kind === "buff" ? "goldShield" : "special", moveLabel,
    startedAt: now, impactAt: now, resolvedAt: now, willHit: true, amount: round(amount),
  });
  return amount;
}

function launchAttack(session, actor, attack, callbacks) {
  if(session.countdownEndsAt>Date.now())return false;
  if (actor === session.typingHost) {
    return requestDragonAttack(session, () => launchAttackNow(session, actor, { ...attack }, callbacks), callbacks);
  }
  return launchAttackNow(session, actor, attack, callbacks);
}

function launchAttackNow(session, actor, attack, { schedule, broadcast, random = Math.random }) {
  const now = Date.now();
  const host = actor === session.typingHost;
  if(attack.balanced && !host && actor.typing.ability==='cleric') {
    session.clericHealingPool=(session.clericHealingPool || 0)+(attack.healingDeposit || 0);
    if(attack.gold && attack.power>0) {
      const available=Math.min(session.clericHealingPool,session.clericHealingAllowance || 0,attack.power);
      const wounded=[...session.players.values()].filter(p=>p.hp>0 && p.hp<p.maxHp);
      if(available>0 && wounded.length) {
        const target=wounded[Math.min(wounded.length-1,Math.floor(random()*wounded.length))];
        const amount=Math.min(available,target.maxHp-target.hp);
        target.hp+=amount;actor.totalHealing=(actor.totalHealing || 0)+amount;
        session.clericHealingPool-=amount;session.clericHealingAllowance-=amount;
        session.projectiles.push({id:crypto.randomBytes(8).toString('hex'),source:actor.code,sourceName:actor.name,
          target:target.code,targetName:target.name,kind:'heal',moveId:'special',moveLabel:'Prayer Heal',
          startedAt:now,impactAt:now,resolvedAt:now,willHit:true,amount:round(amount)});
      }
    }
  }
  if (attack.balanced && !host && actor.typing.ability!=='cleric' && attack.supportPower > 0) {
    const used = resolveGoldSupport(session, actor, attack.supportPower, now) || 0;
    const returned = attack.supportPower - used;
    attack = { ...attack, power: attack.power + returned * (1 + (attack.criticalBonus || 0)),
      criticalPower: (attack.criticalPower || 0) + returned * (attack.criticalBonus || 0), supportUsed: used };
    attack.multiplier = attack.base ? attack.power / attack.base : 1;
  } else if (!attack.balanced && !host && attack.gold && attack.power > 0 && resolveGoldSupport(session, actor, attack.power, now)) return;
  if (attack.balanced && attack.power <= 0) return;
  if(host)session.boss.turnsTaken=(session.boss.turnsTaken || 0)+1;
  const attackNumber = (host ? session.boss.turnsTaken : actor.turnsTaken) || 0;
  const bossAttack = host ? chooseBossAttack(session, random) : null;
  const targets = bossAttack ? bossAttack.targets : [session.boss];
  if (!targets.length) return;
  const breath = bossAttack?.kind === "flamethrower";
  const windup = breath ? DRAGON_FLAME.windup : 0;
  const travel = breath ? DRAGON_FLAME.flight : 700;
  const share = attack.power / targets.length;
  const volley = targets.map(target => ({
    id: crypto.randomBytes(8).toString("hex"),
    source: host ? "boss" : actor.code, sourceName: host ? session.boss.name : actor.name,
    target: host ? target.code : "boss", kind: host ? "boss" : "damage",
    bossId: session.boss.id, moveId: attack.moveId,
    moveLabel: bossAttack ? BOSS_ATTACK_LABELS[bossAttack.kind] : attack.multiplier >= 2 ? "Power attack" : "Quick attack",
    ...(bossAttack ? { bossAttack: bossAttack.kind } : {}),
    ...(attack.balanced ? { balanced: true } : {}),
    multiplier: round(attack.multiplier), startedAt: now + windup, impactAt: now + windup + travel,
    ...(breath ? { animationStartedAt: now } : {}),
    resolvedAt: null, amount: share,
    willHit: true, ...(attack.critical ? { critical: true } : {}),
  }));
  session.projectiles.push(...volley);
  schedule(session, () => {
    // A finished fight cancels in-flight damage.
    if (session.status !== "active") return;
    let volleyDamage = 0, volleyBlocked = 0, landed = false;
    for (const projectile of volley) {
      const target = host ? session.players.get(projectile.target) : session.boss;
      const wasAlive = target.hp > 0;
      let damage = target.hp > 0 ? projectile.amount : 0;
      const defense = host ? target.typing : session.typingHost;
      if (damage > 0) {
        const chance = effectiveDodgeChance(defense);
        if (defense.dodgeExtraRolls) defense.dodgeExtraRolls = 0;
        if (chance > 0 && random() < chance) {
          defense.dodgeBank = Math.max(0, dodgeChance(defense) - 100);
          defense.dodgeSamples = [];
          Object.assign(projectile, { willHit:false, evadeType:"dodge", amount:0, resolvedAt:Date.now() });
          continue;
        }
        if (session.balanced) {
          const divisor = host ? Math.max(1, targets.length) : 1;
          const blocked = Math.min(damage, (defense.balancedGuard || 0) / divisor);
          defense.balancedGuard = Math.max(0, (defense.balancedGuard || 0) - blocked * divisor);
          damage -= blocked;
          if (blocked) projectile.blockedAmount = round(blocked);
        }
      }
      if (target.hp > 0) {
        const incoming = damage;
        damage *= 1 - defense.shield;
        defense.shield = 0;
        if (host) {
          if (incoming > 0 && defense.paladinShield) {
            const divisor = session.balanced ? Math.max(1, targets.length) : 1;
            const absorbed = Math.min(damage, defense.paladinShield / divisor);
            damage -= absorbed;
            defense.paladinShield = session.balanced ? Math.max(0, defense.paladinShield - absorbed * divisor) : 0;
          }
          target.bossHitsTaken += 1;
        }
        const shieldBlocked = incoming - damage;
        if (shieldBlocked > 0) projectile.blockedAmount = round((projectile.blockedAmount || 0) + shieldBlocked);
      }
      const actual = Math.min(target.hp, damage);
      target.hp = Math.max(0, target.hp - actual);
      projectile.amount = round(actual);
      projectile.resolvedAt = Date.now();
      volleyDamage += actual;
      volleyBlocked += projectile.blockedAmount || 0;
      landed = landed || wasAlive;
      if(host && session.balanced) session.clericHealingAllowance=(session.clericHealingAllowance || 0)+actual*.5;
      if (!host) recordDragonHurt(session, projectile);
      defense.totalTaken += actual;
      if (!host) actor.totalDamage += actual;
      if (!host && (!actor.strongestAttack || attack.power > actor.strongestAttack.power ||
        (attack.power === actor.strongestAttack.power && actual > actor.strongestAttack.actualDamage))) {
        actor.strongestAttack = { ...attack, actualDamage: actual,
          blockedDamage: Math.max(0, attack.power - damage),
          attackNumber, landedAt: projectile.resolvedAt };
      }
    }
    if(host) {
      session.boss.totalDamage=(session.boss.totalDamage || 0)+volleyDamage;
      const previous=session.boss.strongestAttack;
      // A group attack is one volley, not one strongest-attack candidate per target.
      if(landed && (!previous || attack.power>previous.power || (attack.power===previous.power && volleyDamage>previous.actualDamage))) {
        session.boss.strongestAttack={...attack,actualDamage:volleyDamage,blockedDamage:volleyBlocked,
          attackNumber,landedAt:Date.now()};
      }
    }
    if (session.boss.hp <= 0) session.status = "victory";
    else if (![...session.players.values()].some(player => player.hp > 0)) session.status = "defeat";
    if (session.status !== "active") { session.closedAt = Date.now(); clearDragonCombat(session); }
    broadcast(session);
  }, windup + travel);
  return host ? { duration: dragonAttackDuration(volley[0]), kind: bossAttack.kind, id: volley[0].id } : 0;
}

function submitWords(session, auth, records, callbacks) {
  if(session.countdownEndsAt>Date.now())throw new Error("The battle countdown is still running.");
  if (session.status !== "active") throw new Error("The fight is not active.");
  const actor = auth.role === "host" ? session.typingHost : session.players.get(auth.actorCode);
  if (!actor || (auth.role === "player" && actor.hp <= 0)) throw new Error("You have been knocked out.");
  const state = auth.role === "host" ? actor : actor.typing;
  const protectedTyping=state.wordProtocol===1;
  if (!Array.isArray(records) || !records.length || records.length > 20) throw new Error("Send 1–20 completed words.");
  // Validate the whole batch before mutating anything. Retries may overlap an acknowledged prefix.
  const preview = { ...state };
  let addedCharacters = 0;
  const fresh = [];
  for (const record of records) {
    if (!Array.isArray(record) || (protectedTyping ? record.length!==8 : state.balanced ? record.length !== 7 : record.length !== 5 && record.length !== 6)) throw new Error("Invalid word result.");
    const [index, text, count, sum, squares, rawTransition, gaps] = record;
    const transitionMs = rawTransition === null && (state.balanced || protectedTyping) ? undefined : rawTransition;
    if (!Number.isInteger(index) || index < 0) throw new Error("Invalid word index.");
    if(protectedTyping)integrity.checkRecord(session,state,record);
    if (index < state.nextWord) continue;
    const word = typingWord(preview);
    const finalWord = !requiresWordSpace(preview, typeof text === "string" ? text : "");
    const length = word.text.length + (finalWord ? 0 : 1);
    const expectedCount = length - (preview.wordsInAttack === 0 ? 1 : 0);
    if(protectedTyping && text!==word.text+(finalWord?'':' '))throw new Error('Complete the displayed word correctly before advancing.');
    if (index !== preview.nextWord || typeof text !== "string" || text.length !== length || (!finalWord && !text.endsWith(" ")) ||
      !Number.isInteger(count) || count < length - 1 || count > expectedCount ||
      !Number.isFinite(sum) || !Number.isFinite(squares) || sum < 0 || squares < 0 ||
      sum > 7200000 * count || squares > 7200000 ** 2 * count ||
      (count > 0 && (squares + 1 < sum * sum / count || squares > sum * sum + 1))) {
      throw new Error("Invalid word order or key timing.");
    }
    if (transitionMs !== undefined) {
      if (preview.wordsInAttack === 0 || count < 2 || count !== expectedCount ||
          !Number.isFinite(transitionMs) || transitionMs < 0 || transitionMs > Math.min(sum, 7200000)) {
        throw new Error("Invalid word transition timing.");
      }
      const remaining = sum - transitionMs;
      const remainingSquares = squares - transitionMs ** 2;
      if (remainingSquares + 1 < remaining ** 2 / (count - 1) || remainingSquares > remaining ** 2 + 1) {
        throw new Error("Invalid word transition timing.");
      }
    }
    if (state.balanced) {
      if (!Array.isArray(gaps) || gaps.length !== count || gaps.some(gap => !Number.isFinite(gap) || gap < 0 || gap > 7200000)) throw new Error("Balanced mode needs valid key gaps.");
      const rawSum = gaps.reduce((a,b) => a+b,0), rawSquares = gaps.reduce((a,b) => a+b*b,0);
      if (Math.abs(rawSum-sum) > .001 || Math.abs(rawSquares-squares) > Math.max(.01, squares*1e-9) ||
          (count === length && preview.wordsInAttack !== 0 && transitionMs !== gaps[0]) ||
          (count !== length && transitionMs !== undefined)) throw new Error("Balanced key timing does not match the word.");
    }
    finishWord(preview, text, count, sum, squares, transitionMs, gaps, record[7]?.mistakes || 0);
    if (preview.wordsInAttack === attackWordLimit(preview)) releaseAttack(preview, () => 1);
    addedCharacters += text.length;
    fresh.push(record);
  }
  const budget=protectedTyping ? integrity.checkBudget(session,state,addedCharacters) : null;
  if (!protectedTyping && state.totalCharacters + addedCharacters > (Date.now() - session.startedAt) * 0.03 + 60) {
    throw new Error("Typing arrived too quickly. Try again shortly.");
  }
  let combatChanged = false;
  const abilityKeys = ['gold','dodgeBank','dodgeExtraRolls','balancedGuard','balancedOrangePower','balancedCritBonus','balancedHealingDeposit','shield','red','orange','green'];
  for (const [, text, count, sum, squares, transitionMs, gaps,proof] of fresh) {
    const before = abilityKeys.map(key => state[key] ?? 0);
    const result = finishWord(state, text, count, sum, squares, transitionMs === null ? undefined : transitionMs, gaps,proof?.mistakes || 0);
    if (abilityKeys.some((key,index) => (state[key] ?? 0) !== before[index])) combatChanged = true;
    if(auth.role==='player' && state.balanced && state.ability==='cleric' && state.balancedHealingDeposit>0) {
      session.clericHealingPool=(session.clericHealingPool || 0)+state.balancedHealingDeposit;
      state.balancedHealingDeposit=0;
    }
    if (auth.role === "player") {
      actor.totalKeystrokes += text.length+(proof?.mistakes || 0);
      actor.correctKeystrokes += protectedTyping ? text.length : result.correct ? text.length : 0;
      actor.correctStreak = result.correct ? actor.correctStreak + 1 : 0;
      actor.lastSeenAt = Date.now();
    }
    if (state.wordsInAttack === attackWordLimit(state)) {
      combatChanged = true;
      const attack = releaseAttack(state, callbacks.random);
      if (auth.role === "player") actor.turnsTaken += 1;
      launchAttack(session, actor, attack, callbacks);
      (auth.role === "host" ? session.boss : actor).attackProgress = 0;
      if (auth.role === "host") session.boss.attackCharacters = 0;
    }
  }
  if (fresh.length) callbacks.broadcast(session, { progressOnly: !combatChanged });
  return { nextWord: state.nextWord,...(protectedTyping ? {issuedWords:integrity.commit(session,state,fresh,budget)} : {}) };
}

function updateProgress(session, auth, wordIndex, characters, broadcast) {
  if(session.countdownEndsAt>Date.now())return;
  if (session.mode !== "proportional" || session.status !== "active") return;
  const actor = auth.role === "host" ? session.typingHost : session.players.get(auth.actorCode);
  const state = auth.role === "host" ? actor : actor?.typing;
  if (!state || (auth.role === "player" && actor.hp <= 0)) return;
  if(state.wordProtocol===1 && wordIndex>=state.nextWord+2)return;
  if (!Number.isInteger(wordIndex) || wordIndex < state.nextWord || wordIndex >= state.nextWord - state.wordsInAttack + attackWordLimit(state) ||
      !Number.isInteger(characters) || characters < 0 || characters > typingWord(state, wordIndex).text.length) return;
  const previous = actor.progressCursor;
  if (previous && (wordIndex < previous.wordIndex || (wordIndex === previous.wordIndex && characters <= previous.characters))) return;
  // Progress is cosmetic only. It never awards damage or changes typing stats.
  const now = Date.now();
  if (actor.progressUpdatedAt && now - actor.progressUpdatedAt < 300) return;
  actor.progressUpdatedAt = now;
  actor.progressCursor = { wordIndex, characters };
  const target = auth.role === "host" ? session.boss : actor;
  target.attackProgress = Math.round(typingAttackProgress(state, characters, wordIndex));
  if (auth.role === "host") {
    // Cosmetic charge includes unsubmitted words, with exactly the same cursor
    // bounds as the existing progress bar. It cannot award combat power.
    let charge = state.characters + characters;
    for (let index = state.nextWord; index < wordIndex; index++) charge += typingWord(state, index).text.length + 1;
    target.attackCharacters = charge;
  }
  broadcast(session, { progressOnly: true });
}

// Nested diffs preserve unchanged player objects on the client and avoid replaying logs/FX.
function diffSnapshot(previous, current) {
  const delta = {};
  for (const key of ["status", "battleView", "teamActivity", "countdownEndsAt", "closedAt", "expiresAt", "startingPlayers", "hpMultiplier", "balanced", "balancedRandomColors", "clericHealingPool", "clericHealingAllowance", "leaderboard"]) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) delta[key] = current[key];
  }
  if (current.typing) {
    const typing = {};
    for (const key of Object.keys(current.typing)) {
      if (!isDeepStrictEqual(current.typing[key], previous.typing?.[key])) typing[key] = current.typing[key];
    }
    if (Object.keys(typing).length) delta.typing = typing;
  }
  const boss = {};
  for (const key of Object.keys(current.boss)) {
    if (!isDeepStrictEqual(current.boss[key], previous.boss[key])) boss[key] = current.boss[key];
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
  if (!Number.isFinite(multiplier) || multiplier < 1 || multiplier > 1.5) throw new Error("Choose an HP multiplier from 1 to 1.5.");
  session.hpMultiplier = multiplier;
  for (const player of session.players.values()) player.hp = player.maxHp = round(100 * multiplier);
  session.boss.hp = session.boss.maxHp = round(100 * multiplier * session.players.size);
}

function applyBalanced(session, value = false, randomColors = true) {
  if (session.status !== "setup") throw new Error("Balanced rules lock when the battle starts.");
  if (typeof value !== "boolean") throw new Error("Balanced must be true or false.");
  if (typeof randomColors !== "boolean") throw new Error("Random colors must be true or false.");
  session.balanced = value;
  session.clericHealingPool=0;session.clericHealingAllowance=0;
  session.balancedRandomColors = value && randomColors;
  const actors = [session.typingHost, ...[...session.players.values()].map(player => player.typing)];
  if (!value) {
    for (const state of actors) state.balanced = false;
    return;
  }
  const seed = session.typingHost.seed;
  actors.forEach((state, index) => {
    const player = index ? [...session.players.values()][index-1] : null;
    Object.assign(state, createTypingState(seed, player ? player.classId || state.ability : "dragon"));
    initializeBalanced(state);
    state.balancedRandomColors = randomColors;
    state.balancedGuardMax = player ? player.maxHp : session.boss.maxHp;
  });
  session.bossAttackIndex = 0;
}

function leaderboard(session) {
  const end = session.closedAt ?? Date.now();
  const seconds = Math.max(1, (end - (session.startedAt ?? end)) / 1000);
  const stats = (state, totalDamage, fallback = {}) => {
    const count=state.totalIntervalCount || 0, mean=count ? state.totalIntervalSum/count : 0;
    const total=state.totalCharacters || fallback.totalKeystrokes || 0;
    const correct=state.totalCorrectCharacters ?? fallback.correctKeystrokes ?? 0;
    return { dps:round(totalDamage/seconds),typingStats:{
      accuracy:total ? correct/total : 0,wpm:round(correct/5/(seconds/60)),
      meanIntervalMs:round(mean),intervalStdDevMs:count ? round(Math.sqrt(Math.max(0,state.totalIntervalSquares/count-mean*mean))) : 0,
    } };
  };
  const players = [...session.players.values()]
    .sort((a, b) => b.totalDamage - a.totalDamage || a.code.localeCompare(b.code))
    .map((player, index) => ({ rank: index + 1, code: player.code, name: player.name,
      totalDamage: round(player.totalDamage),...stats(player.typing,player.totalDamage,player),
      strongestAttack: player.strongestAttack ? { ...player.strongestAttack } : null }));
  const bossDamage=session.boss.totalDamage ?? [...session.players.values()].reduce((total,player)=>total+(player.typing.totalTaken || 0),0);
  return [...players,{rank:0,code:'boss',isBoss:true,name:session.boss.name,totalDamage:round(bossDamage),
    ...stats(session.typingHost,bossDamage),strongestAttack:session.boss.strongestAttack ? {...session.boss.strongestAttack} : null}];
}

module.exports = { newState, submitWords, diffSnapshot, launchAttack, applyHpMultiplier, applyBalanced, leaderboard, updateProgress };


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
