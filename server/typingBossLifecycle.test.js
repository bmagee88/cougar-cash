const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const lifecycle = require("./typingBossLifecycle");
const rules = require("../src/TypingBoss/proportionalRules");

function room() {
  return { id:"bossABC", status:"setup", createdAt:1000, lastActivityAt:1000, expiresAt:7201000,
    players:new Map(), challenges:new Map(), subscribers:new Set(), timers:new Set(), projectiles:[], log:[] };
}

test("abandoned rooms get a full disconnect grace period; authenticated activity and reconnects keep them alive", () => {
  const session = room();
  assert.equal(lifecycle.maintainSession(session,1000+lifecycle.ABANDONED_MS-1),false);
  assert.equal(lifecycle.maintainSession(session,1000+lifecycle.ABANDONED_MS),true);
  const subscriber={previous:{large:"snapshot"}};
  session.subscribers.add(subscriber);
  assert.equal(lifecycle.maintainSession(session,1000+lifecycle.ABANDONED_MS),false);
  lifecycle.detachSubscriber(session,subscriber,1000000);
  assert.equal(subscriber.previous,null);
  assert.equal(lifecycle.maintainSession(session,1000000+lifecycle.ABANDONED_MS-1),false);
  lifecycle.touchSession(session,1500000);
  assert.equal(lifecycle.maintainSession(session,1500000+lifecycle.ABANDONED_MS-1),false);
  session.subscribers.add({});
  assert.equal(lifecycle.maintainSession(session,session.expiresAt),true,"connections cannot extend the hard limit");
});

test("all finished statuses shorten retention once; reads and repeated closes never extend it", () => {
  for (const status of ["victory","defeat","closed"]) {
    const session=room();Object.assign(session,{status,closedAt:100000});
    session.challenges.set("stale",{createdAt:100000});
    lifecycle.maintainSession(session,100000);
    assert.equal(session.expiresAt,100000+lifecycle.FINISHED_MS);
    assert.equal(session.challenges.size,0);
    lifecycle.touchSession(session,200000);
    session.closedAt=200000;
    lifecycle.maintainSession(session,200000);
    assert.equal(session.expiresAt,100000+lifecycle.FINISHED_MS);
    assert.equal(lifecycle.maintainSession(session,session.expiresAt),true);
  }
});

test("Old Mode retains only the latest challenge per player and expires it at ten minutes", () => {
  const session=room();
  lifecycle.storeChallenge(session,{id:"one",playerCode:"a",createdAt:1000},1000);
  lifecycle.storeChallenge(session,{id:"other",playerCode:"b",createdAt:1000},1000);
  lifecycle.storeChallenge(session,{id:"two",playerCode:"a",createdAt:2000},2000);
  assert.deepEqual([...session.challenges.keys()],["other","two"]);
  lifecycle.pruneChallenges(session,1000+lifecycle.CHALLENGE_MS);
  assert.deepEqual([...session.challenges.keys()],["two"]);
  lifecycle.pruneChallenges(session,2000+lifecycle.CHALLENGE_MS);
  assert.equal(session.challenges.size,0);
});

test("combat events drain without needing a subscriber or a snapshot request", () => {
  const session=room();session.projectiles=[{resolvedAt:1000},{impactAt:1000},{impactAt:10000}];
  lifecycle.maintainSession(session,5500);
  assert.deepEqual(session.projectiles,[{impactAt:10000}]);
});

test("removing a room releases connections, snapshots, state and every timer", t => {
  t.mock.timers.enable({apis:["setTimeout","setInterval"]});
  const session=room();const registry=new Map([[session.id,session]]);
  let callbacks=0,ended=0;
  session.expireTimer=setTimeout(()=>callbacks++,100);
  session.deleteTimer=setTimeout(()=>callbacks++,100);
  session.bossTimer=setTimeout(()=>callbacks++,100);
  session.timers.add(setTimeout(()=>callbacks++,100));
  const subscriber={res:{end:()=>ended++},previous:{players:[1]},pingTimer:setInterval(()=>callbacks++,100)};
  session.subscribers.add(subscriber);
  session.players.set("a",{});session.challenges.set("a",{});session.projectiles=[{}];session.log=[{}];session.typingHost={};
  lifecycle.removeSession(registry,session);
  t.mock.timers.tick(200);
  assert.equal(callbacks,0);assert.equal(ended,1);assert.equal(subscriber.previous,null);
  assert.equal(registry.size,0);assert.equal(session.players.size,0);assert.equal(session.challenges.size,0);
  assert.equal(session.subscribers.size,0);assert.equal(session.timers.size,0);assert.equal(session.projectiles.length,0);
  assert.equal(session.log.length,0);assert.equal(session.typingHost,null);
});

// Exercise the actual server sweep and deletion wiring without opening a network port.
function loadServer() {
  const filename=path.join(__dirname,"appServer.js"), localRequire=createRequire(filename);
  const fakeServer={on(){},listen(){},close(){}};
  const sandbox={require:name=>name==="http"?{createServer:()=>fakeServer}:localRequire(name),
    module:{exports:{}},process:{env:{},once(){}},console:{log(){},error(){}},Buffer,URL,
    Date,setTimeout,clearTimeout,setInterval,clearInterval};
  vm.runInNewContext(fs.readFileSync(filename,"utf8")+
    "\nmodule.exports={createTypingBossSession,typingBossSessions,broadcastTypingBossSession,typingBossResolveTarget,getTypingBossSnapshotForAuth};",sandbox,{filename});
  return sandbox.module.exports;
}

test("server sweeps abandoned rooms and frees their registry entry after the expiry notice", t => {
  t.mock.timers.enable({apis:["Date","setTimeout","setInterval"],now:1000000});
  const server=loadServer();
  const session=server.createTypingBossSession({mode:"proportional"});
  t.mock.timers.tick(lifecycle.ABANDONED_MS);
  assert.equal(session.status,"expired");
  assert.equal(server.typingBossSessions.has(session.id),true);
  t.mock.timers.tick(60000);
  assert.equal(server.typingBossSessions.size,0);
});

test("server keeps connected games alive but expires finished games after fifteen minutes", t => {
  t.mock.timers.enable({apis:["Date","setTimeout","setInterval"],now:1000000});
  const server=loadServer();
  const session=server.createTypingBossSession({mode:"proportional"});
  let ended=0;
  session.subscribers.add({auth:{role:"host"},res:{write(){},end(){ended++;}},pingTimer:setInterval(()=>{},25000)});
  t.mock.timers.tick(lifecycle.ABANDONED_MS+15000);
  assert.equal(session.status,"setup");
  session.status="victory";session.closedAt=Date.now();
  server.broadcastTypingBossSession(session);
  t.mock.timers.tick(lifecycle.FINISHED_MS+15000);
  assert.equal(session.status,"expired");
  t.mock.timers.tick(60000);
  assert.equal(server.typingBossSessions.size,0);assert.equal(ended,1);
});

test("Old Mode redirects a full-health heal target to a wounded survivor", t => {
  t.mock.timers.enable({apis:["setTimeout","setInterval"]});
  const server=loadServer();
  const caster={code:"hero0001",hp:100,maxHp:100};
  const wounded={code:"hero0002",hp:20,maxHp:100};
  const ko={code:"hero0003",hp:0,maxHp:100};
  const session={players:new Map([caster,wounded,ko].map(player=>[player.code,player]))};
  assert.equal(server.typingBossResolveTarget(session,caster,{kind:"heal-other"},caster.code),wounded.code);
  assert.equal(caster.hp,100);
});

test("personal support snapshots carry the real recipient name without sharing the ally roster", t => {
  t.mock.timers.enable({apis:["setTimeout","setInterval"]});
  const server=loadServer();
  const session=server.createTypingBossSession({mode:"proportional"});
  const actor={code:"hero0001",name:"Cleric",classId:"cleric",hp:100,maxHp:100,averageDps:0,totalDamage:0,totalHealing:0,
    typing:rules.createTypingState(1,"cleric"),totalKeystrokes:0,correctKeystrokes:0,joinedAt:Date.now()};
  const ally={...actor,code:"hero0002",name:"Injured ally",hp:20,typing:rules.createTypingState(2,"barbarian")};
  session.players.set(actor.code,actor);session.players.set(ally.code,ally);
  session.projectiles.push({id:"heal",source:actor.code,target:ally.code,targetName:ally.name,kind:"heal",amount:30,
    moveId:"special",moveLabel:"Golden Heal",startedAt:Date.now(),impactAt:Date.now(),resolvedAt:Date.now(),willHit:true});
  const snapshot=server.getTypingBossSnapshotForAuth(session,{role:"player",actorCode:actor.code});
  assert.equal(snapshot.players.length,1);
  assert.equal(snapshot.projectiles[0].targetName,"Injured ally");
  assert.equal(snapshot.projectiles[0].target,ally.code);
});

test("word pool cache evicts the oldest of 32 combinations, keeps hot entries and preserves seeded content", () => {
  // Clear just this module's cache so the test starts with an empty word LRU.
  delete require.cache[require.resolve("../src/TypingBoss/proportionalRules")];
  const freshRules=require("../src/TypingBoss/proportionalRules");
  const hot=freshRules.wordsForGrades(1),cold=freshRules.wordsForGrades(3);
  const before=Array.from({length:10},(_,i)=>rules.wordAt(123,i,3));
  for(let i=2;i<=32;i++) {
    freshRules.wordsForGrades(2*i+1);
    assert.equal(freshRules.wordsForGrades(1),hot);
  }
  const regenerated=freshRules.wordsForGrades(3);
  assert.notEqual(regenerated,cold);assert.deepEqual(regenerated,cold);
  assert.deepEqual(Array.from({length:10},(_,i)=>freshRules.wordAt(123,i,3)),before);
});
