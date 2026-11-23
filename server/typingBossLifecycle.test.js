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

test("closed rooms shorten retention once; reads and repeated closes never extend it", () => {
  for (const status of ["closed"]) {
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
    "\nmodule.exports={createTypingBossSession,typingBossSessions,broadcastTypingBossSession,typingBossResolveTarget,getTypingBossSnapshotForAuth,handleStartTypingBossSession,handleRematchTypingBossSession,handleCreateTypingBossParticipant,handlePromoteTypingBossPlayer,handleHostPlayerPromotion,handleChangeTypingBoss,requireTypingBossActive};",sandbox,{filename});
  return sandbox.module.exports;
}

function advanceTyping(t,session,milliseconds,excluded=[]) {
  while(milliseconds>0) {
    for(const player of session.players.values())if(!excluded.includes(player.code))require('./typingBossInactivity').recordTypingActivity(session,player);
    const step=Math.min(milliseconds,1000);t.mock.timers.tick(step);milliseconds-=step;
  }
}

test('timed results compare combined team HP percentages, handle ties, and preserve earlier results', () => {
  for (const [teamHp, expected] of [[76, 'victory'], [74, 'defeat'], [75, 'draw']]) {
    const session = {...room(), status:'active', battleEndsAt:5000,
      boss:{hp:150, maxHp:300}, players:new Map([['a',{hp:teamHp,maxHp:100}],['b',{hp:0,maxHp:50}]])};
    assert.equal(lifecycle.finishTimedBattle(session,4999),false);
    assert.equal(session.status,'active');
    assert.equal(lifecycle.finishTimedBattle(session,5100),true);
    assert.equal(session.status,expected);
    assert.equal(session.closedAt,5000);
    assert.equal(session.endReason,'time-limit');
    assert.equal(session.timedResult.bossHpPercent,50);
    assert.equal(session.timedResult.teamHpPercent,teamHp/150*100);
    session.boss.hp=0;
    assert.equal(lifecycle.finishTimedBattle(session,6000),false);
    assert.equal(session.status,expected);
  }
  const won = {...room(),status:'victory',battleEndsAt:5000};
  assert.equal(lifecycle.finishTimedBattle(won,6000),false);
  assert.equal(won.endReason,undefined);
});

test('time limits start after the countdown, publish results, and clear on rematch', async t => {
  t.mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:1000000});
  const server=loadServer();
  const req=body=>require('node:stream').Readable.from([JSON.stringify(body)]);
  const response=()=>({setHeader(){},writeHead(status){this.status=status;},end(body){this.body=JSON.parse(body);}});
  for (const duration of [undefined,180,300,420,270,null]) {
    const session=server.createTypingBossSession({mode:'proportional'});
    const join=response();await server.handleCreateTypingBossParticipant(req({name:'Hero',classId:'paladin'}),join,session);
    const start=response();await server.handleStartTypingBossSession(req({hostToken:session.hostToken,timeLimitSeconds:duration}),start,session,new URL('http://localhost'));
    assert.equal(start.status,200);
    const seconds=duration===undefined?300:duration;
    assert.equal(start.body.session.timeLimitSeconds,seconds);
    assert.equal(session.battleEndsAt,seconds===null?null:session.countdownEndsAt+seconds*1000);
    if (seconds===null) {
      advanceTyping(t,session,500000);
      assert.equal(session.status,'active');
      continue;
    }
    session.boss.hp=session.boss.maxHp*.6;
    [...session.players.values()][0].hp=80;
    const events=[];
    session.subscribers.add({auth:{role:'player',actorCode:join.body.code},res:{write(event){events.push(event);},destroy(){throw Error('Must publish timed results');}}});
    advanceTyping(t,session,5000+seconds*1000-1);
    assert.equal(session.status,'active');
    t.mock.timers.tick(1);
    assert.equal(session.status,'victory');
    assert.equal(session.endReason,'time-limit');
    t.mock.timers.tick(200);
    assert.ok(events.some(event=>event.includes('"endReason":"time-limit"') && event.includes('"leaderboard"')));
    const rematch=response();await server.handleRematchTypingBossSession(req({hostToken:session.hostToken}),rematch,session,new URL('http://localhost'));
    assert.equal(rematch.status,200);
    assert.equal(session.battleEndsAt,null);
    assert.equal(session.timedResult,null);
    assert.equal(session.endReason,null);
    assert.equal(session.timeLimitSeconds,seconds);
  }
});

test('invalid durations cannot start a battle or change its setup', async t => {
  t.mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:1000000});
  const server=loadServer(),session=server.createTypingBossSession({mode:'proportional'});
  const req=body=>require('node:stream').Readable.from([JSON.stringify(body)]);
  const response=()=>({setHeader(){},writeHead(status){this.status=status;},end(body){this.body=JSON.parse(body);}});
  await server.handleCreateTypingBossParticipant(req({name:'Hero',classId:'paladin'}),response(),session);
  for (const duration of [0,-1,59,7201,180.5,'300',true]) {
    const res=response();await server.handleStartTypingBossSession(req({hostToken:session.hostToken,timeLimitSeconds:duration}),res,session,new URL('http://localhost'));
    assert.equal(res.status,400);assert.equal(session.status,'setup');assert.equal(session.battleEndsAt,null);
  }
});

test('Team mode defaults on, validates its toggle, and shares equal HP in host and player snapshots', async t=>{
  t.mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:1000000});
  const server=loadServer(),session=server.createTypingBossSession({mode:'proportional'});
  const req=body=>require('node:stream').Readable.from([JSON.stringify(body)]);
  const response=()=>({setHeader(){},writeHead(status){this.status=status;},end(body){this.body=JSON.parse(body);}});
  let join;
  for(let i=0;i<3;i++) {
    join=response();await server.handleCreateTypingBossParticipant(req({name:`Hero ${i}`,classId:'paladin'}),join,session);
    assert.equal(join.body.session.teamHealth.maxHp,100*(i+1));
    assert.equal(join.body.session.boss.maxHp,100*(i+1));
  }
  assert.equal(join.body.session.teamMode,true);
  const invalid=response();await server.handleStartTypingBossSession(req({hostToken:session.hostToken,teamMode:'true'}),invalid,session,new URL('http://localhost'));
  assert.equal(invalid.status,400);assert.equal(session.status,'setup');
  const start=response();await server.handleStartTypingBossSession(req({hostToken:session.hostToken}),start,session,new URL('http://localhost'));
  assert.equal(start.body.session.teamMode,true);
  const player=session.players.get(join.body.code);
  require('./typingBossHealth').changePlayerHealth(session,player,-25);
  const own=server.getTypingBossSnapshotForAuth(session,{role:'player',actorCode:player.code});
  assert.equal(own.teamHealth.hp,275);assert.equal(own.teamHealth.maxHp,300);assert.equal(own.teamHealth.maxHp,own.boss.maxHp);
  assert.equal(own.players[0].defeated,false);
});

test('protected word submissions remain authenticated and playable during Second Wind',async t=>{
  t.mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:1000000});
  const server=loadServer(),session=server.createTypingBossSession({mode:'proportional'});
  const req=body=>require('node:stream').Readable.from([JSON.stringify(body)]);
  const response=()=>({setHeader(){},writeHead(status){this.status=status;},end(body){this.body=JSON.parse(body);}});
  const join=response();await server.handleCreateTypingBossParticipant(req({name:'Hero',classId:'paladin'}),join,session);
  await server.handleStartTypingBossSession(req({hostToken:session.hostToken,teamMode:false}),response(),session,new URL('http://localhost'));
  t.mock.timers.tick(6000);
  const player=session.players.get(join.body.code);player.hp=0;
  require('./typingBossRecovery').knockOut(session,player);
  const view=server.getTypingBossSnapshotForAuth(session,{role:'player',actorCode:player.code});
  assert.equal(view.players[0].defeated,false);assert.equal(view.players[0].secondWindWordsRemaining,3);
  const engine=require('./proportionalBoss');
  for(let i=0;i<3;i++) {
    t.mock.timers.tick(3000);
    const state=player.typing,word=rules.typingWord(state),text=word.text+(rules.requiresWordSpace(state,word.text)?' ':'');
    const issued=require('./typingBossIntegrity').publicTypingState(session,state).issuedWords.find(item=>item.index===state.nextWord);
    const count=text.length-(state.wordsInAttack===0?1:0);
    engine.submitWords(session,{role:'player',actorCode:player.code},[[state.nextWord,text,count,count*200,count*40000,null,null,{ticket:issued.ticket,mistakes:0}]],{broadcast(){},schedule(){},random:()=>1});
  }
  assert.equal(player.hp,40);assert.equal(player.secondWindWordsRemaining,0);
});

test('the live room timer preserves timeout KOs, their HP, and their private connection for return',async t=>{
  t.mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:1000000});
  const server=loadServer(),session=server.createTypingBossSession({mode:'proportional'});
  const req=body=>require('node:stream').Readable.from([JSON.stringify(body)]);
  const response=()=>({setHeader(){},writeHead(status){this.status=status;},end(body){this.body=JSON.parse(body);}});
  let inactive;
  for(let i=0;i<3;i++) {
    const join=response();await server.handleCreateTypingBossParticipant(req({name:`Hero ${i}`,classId:'paladin'}),join,session);
    if(!i)inactive=join.body.code;
  }
  const events=[];
  session.subscribers.add({auth:{role:'player',actorCode:inactive},res:{write(event){events.push(event);},destroy(){}}});
  await server.handleStartTypingBossSession(req({hostToken:session.hostToken}),response(),session,new URL('http://localhost'));
  session.boss.hp=180;require('./typingBossHealth').changePlayerHealth(session,session.players.get(inactive),-150);
  advanceTyping(t,session,36000,[inactive]);
  assert.equal(session.players.size,3);assert.equal(session.players.get(inactive).timedOut,true);
  assert.equal(session.players.get(inactive).hp,150);
  assert.equal(session.boss.hp,120);assert.equal(session.teamHealth.hp,100);
  t.mock.timers.tick(200);
  assert.ok(events.some(event=>event.includes('"timedOut":true') && event.includes(inactive)));
  const downView=server.getTypingBossSnapshotForAuth(session,{role:'player',actorCode:inactive});
  assert.equal(downView.players.find(player=>player.code===inactive).defeated,true);
  require('./typingBossInactivity').recordTypingActivity(session,session.players.get(inactive));
  assert.equal(session.teamHealth.hp,100);assert.equal(session.teamHealth.maxHp,200);
  assert.equal(session.players.get(inactive).timedOut,true);
  session.status='closed';require('./typingBossLifecycle').maintainSession(session);
  assert.equal(session.inactivityTimer,null);
});

test('timed draws allow rematches and in-flight hits cannot change the final HP result', async t => {
  t.mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:1000000});
  const server=loadServer(),engine=require('./proportionalBoss');
  const session=server.createTypingBossSession({mode:'proportional'});
  const req=body=>require('node:stream').Readable.from([JSON.stringify(body)]);
  const response=()=>({setHeader(){},writeHead(status){this.status=status;},end(body){this.body=JSON.parse(body);}});
  await server.handleCreateTypingBossParticipant(req({name:'Hero',classId:'paladin'}),response(),session);
  await server.handleStartTypingBossSession(req({hostToken:session.hostToken,timeLimitSeconds:60}),response(),session,new URL('http://localhost'));
  advanceTyping(t,session,64500);
  const player=[...session.players.values()][0];
  require('./typingBossHealth').changePlayerHealth(session,player,-50);session.boss.hp=50;
  const pending=[];
  engine.launchAttack(session,player,{power:100,multiplier:1},{schedule:(_s,callback)=>pending.push(callback),broadcast:()=>{}});
  t.mock.timers.tick(500);
  assert.equal(session.status,'draw');
  assert.deepEqual(session.timedResult,{bossHpPercent:50,teamHpPercent:50});
  for (const impact of pending) impact();
  assert.equal(session.boss.hp,50);assert.equal(session.status,'draw');
  assert.throws(()=>engine.submitWords(session,{role:'player',actorCode:player.code},[],{broadcast(){}}),/not active/);
  const rematch=response();await server.handleRematchTypingBossSession(req({hostToken:session.hostToken}),rematch,session,new URL('http://localhost'));
  assert.equal(rematch.status,200);assert.equal(session.status,'setup');
});

test('classic quiz battles share the timer and HP-percentage result', async t => {
  t.mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:1000000});
  const server=loadServer(),session=server.createTypingBossSession({mode:'old'});
  const req=body=>require('node:stream').Readable.from([JSON.stringify(body)]);
  const response=()=>({setHeader(){},writeHead(status){this.status=status;},end(body){this.body=JSON.parse(body);}});
  await server.handleCreateTypingBossParticipant(req({name:'Hero',classId:'paladin'}),response(),session);
  await server.handleStartTypingBossSession(req({hostToken:session.hostToken,timeLimitSeconds:60}),response(),session,new URL('http://localhost'));
  clearTimeout(session.bossTimer);
  const player=[...session.players.values()][0];player.hp=player.maxHp*.2;
  session.boss.hp=session.boss.maxHp*.8;
  t.mock.timers.tick(65000);
  assert.equal(session.status,'defeat');
  assert.equal(session.endReason,'time-limit');
});

test('all three bosses can be selected in either mode; proportional keeps its default',t=>{
  t.mock.timers.enable({apis:['setTimeout','setInterval']});
  const server=loadServer();
  for(const mode of ['proportional','old'])for(const bossId of ['emberWhelp','cindermaw','infernalDragon']) {
    const session=server.createTypingBossSession({mode,bossId});
    assert.equal(session.boss.id,bossId);assert.equal(session.mode,mode);
  }
  assert.equal(server.createTypingBossSession({mode:'proportional'}).boss.id,'infernalDragon');
});

test('host alone can toggle any player promotion during gameplay',async t=>{
  t.mock.timers.enable({apis:['setTimeout','setInterval']});
  const server=loadServer(),s=server.createTypingBossSession({mode:'proportional'});
  const req=body=>({async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(body));}});
  const res=()=>({status:0,body:null,setHeader(){},writeHead(n){this.status=n;},end(text){this.body=JSON.parse(text);}});
  const joined=res();await server.handleCreateTypingBossParticipant(req({name:'Hero',classId:'paladin'}),joined,s);
  const {code,playerToken}=joined.body;s.status='active';
  for(const credentials of [{},{playerToken},{hostToken:'invalid'}]) {
    const denied=res();await server.handleHostPlayerPromotion(req({...credentials,playerCode:code,promoted:true}),denied,s,new URL('http://localhost'));
    assert.equal(denied.status,403);assert.equal(Boolean(s.players.get(code).promoted),false);
  }
  for(const promoted of [true,false]) {
    const changed=res();await server.handleHostPlayerPromotion(req({hostToken:s.hostToken,playerCode:code,promoted}),changed,s,new URL('http://localhost'));
    assert.equal(changed.status,200);assert.equal(s.players.get(code).promoted,promoted);
    assert.equal(changed.body.session.players[0].promoted,promoted);
  }
  const invalid=res();await server.handleHostPlayerPromotion(req({hostToken:s.hostToken,playerCode:code,promoted:'false'}),invalid,s,new URL('http://localhost'));assert.equal(invalid.status,400);
  s.status='defeat';const ended=res();await server.handleHostPlayerPromotion(req({hostToken:s.hostToken,playerCode:code,promoted:true}),ended,s,new URL('http://localhost'));assert.equal(ended.status,409);
});

test('promotion requires private credentials and the host password, persists with signed joins, and boss switching preserves promotion shares',async t=>{
  t.mock.timers.enable({apis:['setTimeout','setInterval']});
  const secret=require('node:crypto').randomBytes(24).toString('hex'),prior=process.env.TYPING_BOSS_CREATION_PASSWORD;
  process.env.TYPING_BOSS_CREATION_PASSWORD=secret;
  try {
    const server=loadServer(),s=server.createTypingBossSession({mode:'proportional'});
    s.teamMode=false;
    const req=body=>({async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(body));}});
    const res=()=>({status:0,body:null,setHeader(){},writeHead(n){this.status=n;},end(text){this.body=JSON.parse(text);}});
    const join=res();await server.handleCreateTypingBossParticipant(req({name:'Hero',classId:'paladin'}),join,s);
    const {code,playerToken}=join.body;
    for(const body of [{code,password:secret},{playerToken,password:'invalid-'+secret}]) {
      const denied=res();await server.handlePromoteTypingBossPlayer(req(body),denied,s,new URL('http://localhost'));
      assert.ok([401,403].includes(denied.status));assert.equal(Boolean(s.players.get(code).promoted),false);
    }
    const approved=res();await server.handlePromoteTypingBossPlayer(req({playerToken,password:secret}),approved,s,new URL('http://localhost'));
    assert.equal(approved.status,200);assert.equal(s.players.get(code).promoted,true);assert.equal(s.boss.maxHp,200);
    const grant=approved.body.promotionToken;
    const duplicate=res();await server.handlePromoteTypingBossPlayer(req({playerToken,password:secret}),duplicate,s,new URL('http://localhost'));assert.equal(s.boss.maxHp,200);
    for(const bossId of ['kraken','infernalDragon']) {
      const changed=res();await server.handleChangeTypingBoss(req({hostToken:s.hostToken,bossId}),changed,s,new URL('http://localhost'));
      assert.equal(changed.status,200);assert.equal(s.boss.id,bossId);assert.equal(s.boss.maxHp,200);
      assert.equal(s.typingHost.attackWords,bossId==='kraken'?8:10);
    }
    s.status='active';const blocked=res();await server.handleChangeTypingBoss(req({hostToken:s.hostToken,bossId:'kraken'}),blocked,s,new URL('http://localhost'));assert.equal(blocked.status,409);
    const next=server.createTypingBossSession({mode:'proportional'}),remembered=res();
    await server.handleCreateTypingBossParticipant(req({name:'New hero',classId:'cleric',promotionToken:grant}),remembered,next);
    assert.equal([...next.players.values()][0].promoted,true);assert.equal([...next.players.values()][0].typing.promoted,true);
    const forged=res();await server.handleCreateTypingBossParticipant(req({name:'Normal hero',classId:'monk',promoted:true,promotionToken:'true'}),forged,next);
    assert.equal(next.players.get(forged.body.code).promoted,false);
  }finally{if(prior===undefined)delete process.env.TYPING_BOSS_CREATION_PASSWORD;else process.env.TYPING_BOSS_CREATION_PASSWORD=prior;}
});

test('Kraken creates an eight-word host, keeps its identity on rematch, and publishes personal controls',async t=>{
  t.mock.timers.enable({apis:['setTimeout','setInterval']});
  const server=loadServer(),session=server.createTypingBossSession({mode:'proportional',bossId:'kraken'});
  assert.equal(session.boss.id,'kraken');assert.equal(session.typingHost.ability,'kraken');assert.equal(rules.attackWordLimit(session.typingHost),8);
  assert.throws(()=>server.createTypingBossSession({mode:'old',bossId:'kraken'}),/Host vs/);
  const req=body=>({async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(body));}});
  const res={setHeader(){},writeHead(){},end(){}};
  await server.handleCreateTypingBossParticipant(req({name:'Hero',classId:'paladin'}),res,session);
  const p=[...session.players.values()][0];p.hp=99.125;p.proneUntil=Date.now()+5000;p.curseUntil=Date.now()+15000;p.curseKey={id:'tick',key:'z',at:Date.now(),index:0};
  const snap=server.getTypingBossSnapshotForAuth(session,{role:'player',actorCode:p.code});
  assert.equal(snap.players[0].hp,99.13);assert.equal(p.hp,99.125);assert.equal(snap.players[0].proneUntil,p.proneUntil);assert.equal(snap.players[0].curseKey.key,'z');
  session.status='victory';session.closedAt=Date.now();
  await server.handleRematchTypingBossSession(req({hostToken:session.hostToken}),res,session,new URL('http://localhost'));
  assert.equal(session.status,'setup');assert.equal(session.boss.id,'kraken');assert.equal(session.typingHost.ability,'kraken');assert.equal(session.typingHost.attackWords,8);
});

test('Start publishes one five-second deadline, rejects early actions and prevents a repeated start',async t=>{
  t.mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:1000000});
  const server=loadServer(),session=server.createTypingBossSession({mode:'proportional'});
  const actor={code:'hero0001',name:'Hero',classId:'cleric',hp:100,maxHp:100,averageDps:0,totalDamage:0,totalHealing:0,
    typing:rules.createTypingState(1,'cleric'),totalKeystrokes:0,correctKeystrokes:0,joinedAt:Date.now()};
  session.players.set(actor.code,actor);
  const req=()=>require('node:stream').Readable.from([JSON.stringify({hostToken:session.hostToken,balanced:true,teamMode:false})]);
  const response=()=>({setHeader(){},writeHead(status){this.status=status;},end(body){this.body=JSON.parse(body);}});
  const res=response();await server.handleStartTypingBossSession(req(),res,session,new URL('http://localhost/start'));
  assert.equal(res.status,200);assert.equal(res.body.session.countdownEndsAt,1005000);
  assert.equal(session.startedAt,1005000);
  assert.equal(session.teamMode,false);assert.equal(res.body.session.teamMode,false);
  const host=server.getTypingBossSnapshotForAuth(session,{role:'host'}),player=server.getTypingBossSnapshotForAuth(session,{role:'player',actorCode:actor.code});
  assert.equal(host.countdownEndsAt,player.countdownEndsAt);
  assert.equal(server.requireTypingBossActive(response(),session),false);
  const engine=require('./proportionalBoss');
  assert.throws(()=>engine.submitWords(session,{role:'player',actorCode:actor.code},[],{}),/countdown/);
  engine.updateProgress(session,{role:'player',actorCode:actor.code},0,1,()=>{throw Error('Early progress');});
  assert.equal(actor.typing.nextWord,0);
  const duplicate=response();await server.handleStartTypingBossSession(req(),duplicate,session,new URL('http://localhost/start'));
  assert.equal(duplicate.status,409);assert.equal(session.countdownEndsAt,1005000);
  t.mock.timers.tick(4999);assert.equal(server.requireTypingBossActive(response(),session),false);
  assert.equal(session.projectiles.length,0);
  t.mock.timers.tick(1);assert.equal(server.requireTypingBossActive(response(),session),true);
  assert.ok(session.log.some(entry=>entry.message==='The fight has begun.'));
});

test('closing during countdown cancels the pending start callback',async t=>{
  t.mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:1000000});
  const server=loadServer(),session=server.createTypingBossSession({mode:'old'});
  session.players.set('hero0001',{code:'hero0001',name:'Hero',classId:'cleric',hp:100,maxHp:100,joinedAt:Date.now(),averageDps:0,totalKeystrokes:0,correctKeystrokes:0});
  const req=require('node:stream').Readable.from([JSON.stringify({hostToken:session.hostToken})]);
  await server.handleStartTypingBossSession(req,{setHeader(){},writeHead(){},end(){}},session,new URL('http://localhost/start'));
  assert.ok(session.boss.nextAttackAt>=session.countdownEndsAt+session.boss.attackIntervalMs);
  session.status='closed';lifecycle.clearSessionTimers(session);t.mock.timers.tick(20000);
  assert.equal(session.projectiles.length,0);
  assert.ok(!session.log.some(entry=>entry.message==='The fight has begun.'));
});

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

test("server keeps completed games available for rematches until the original two-hour deadline", t => {
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
  assert.equal(session.status,"victory");
  t.mock.timers.tick(session.expiresAt-Date.now());
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

test("shared battle snapshots include allies and recipient names but keep typing state private", t => {
  t.mock.timers.enable({apis:["setTimeout","setInterval"]});
  const server=loadServer();
  const session=server.createTypingBossSession({mode:"proportional"});
  const actor={code:"hero0001",name:"Cleric",classId:"cleric",hp:100,maxHp:100,averageDps:0,totalDamage:0,totalHealing:0,
    typing:rules.createTypingState(1,"cleric"),totalKeystrokes:0,correctKeystrokes:0,joinedAt:Date.now()};
  const ally={...actor,code:"hero0002",name:"Injured ally",hp:20,typing:rules.createTypingState(2,"barbarian")};
  session.players.set(actor.code,actor);session.players.set(ally.code,ally);
  Object.assign(session.typingHost,{balanced:true,balancedOrangePower:8,balancedCritBonus:.12,gold:1,dodgeBank:150,balancedGuard:30});
  session.projectiles.push({id:"heal",source:actor.code,target:ally.code,targetName:ally.name,kind:"heal",amount:30,
    moveId:"special",moveLabel:"Golden Heal",startedAt:Date.now(),impactAt:Date.now(),resolvedAt:Date.now(),willHit:true});
  const snapshot=server.getTypingBossSnapshotForAuth(session,{role:"player",actorCode:actor.code});
  assert.equal(snapshot.players.length,2);
  assert.ok(snapshot.players.every(player=>!player.typing));
  assert.equal(snapshot.hostToken,undefined);
  assert.equal(snapshot.typing.seed,actor.typing.seed);
  assert.equal(snapshot.boss.profile.balancedOrangePower,8);
  assert.equal(snapshot.boss.profile.balancedCritBonus,.12);
  assert.equal(snapshot.boss.profile.gold,1);
  assert.equal(snapshot.boss.profile.dodgeBank,150);
  assert.equal(snapshot.boss.profile.balancedGuard,30);
  for(const privateField of ['seed','nextWord','intervalSum','intervalSquares','balancedPace','hostToken'])assert.equal(snapshot.boss.profile[privateField],undefined);
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

test('rematches reset combat and roster, preserve room credentials and hard deadline, and reject closed rooms', async t => {
  t.mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:1000000});
  const server=loadServer(),session=server.createTypingBossSession({mode:'proportional'});
  const original={id:session.id,token:session.hostToken,expiresAt:session.expiresAt};
  session.status='victory';session.boss.hp=0;session.boss.totalDamage=999;session.teamKnockouts=5;
  session.typingHost.nextWord=999;
  lifecycle.maintainSession(session);
  assert.equal(session.expiresAt,original.expiresAt);
  session.players.set('old',{code:'old'});
  const req=token=>require('node:stream').Readable.from([JSON.stringify({hostToken:token})]);
  const response=()=>({setHeader(){},writeHead(status){this.status=status;},end(body){this.body=JSON.parse(body);}});
  const unauthorized=response();await server.handleRematchTypingBossSession(req('wrong'),unauthorized,session,new URL('http://localhost'));
  assert.equal(unauthorized.status,403);assert.equal(session.status,'victory');
  const events=[];
  session.subscribers.add({auth:{role:'player',actorCode:'old'},res:{write(event){events.push(event);},destroy(){throw Error('Rematch must notify connected players');}}});
  const res=response();await server.handleRematchTypingBossSession(req(session.hostToken),res,session,new URL('http://localhost'));
  assert.equal(res.status,200);assert.equal(session.status,'setup');assert.equal(session.players.size,0);
  assert.equal(session.id,original.id);assert.equal(session.hostToken,original.token);assert.equal(session.expiresAt,original.expiresAt);
  assert.equal(session.boss.hp,session.boss.maxHp);assert.equal(session.boss.totalDamage,undefined);
  assert.equal(session.typingHost.nextWord,0);assert.equal(session.teamKnockouts,0);assert.equal(session.recovery,null);
  t.mock.timers.tick(200);
  assert.ok(events.some(event=>event.includes('\"status\":\"setup\"')));
  session.status='closed';const closed=response();await server.handleRematchTypingBossSession(req(session.hostToken),closed,session,new URL('http://localhost'));
  assert.equal(closed.status,409);assert.equal(session.status,'closed');
});

test('players can join until the countdown deadline with matching rules and HP, without restarting the countdown',async t=>{
  t.mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:1000000});
  const server=loadServer();
  const req=body=>require('node:stream').Readable.from([JSON.stringify(body)]);
  const response=()=>({setHeader(){},writeHead(status){this.status=status;},end(body){this.body=JSON.parse(body);}});
  for(const [balanced,random] of [[true,false],[true,true],[false,true]]) {
    const session=server.createTypingBossSession({mode:'proportional'});
    const first=response();await server.handleCreateTypingBossParticipant(req({name:'First',classId:'paladin'}),first,session);
    assert.equal(first.status,201);
    const start=response();await server.handleStartTypingBossSession(req({hostToken:session.hostToken,balanced,balancedRandomColors:random,hpMultiplier:1.25,gradeLevels:[1]}),start,session,new URL('http://localhost'));
    assert.equal(start.status,200);
    const deadline=session.countdownEndsAt;
    const originalPlayer=[...session.players.values()][0],originalTyping=originalPlayer.typing;
    t.mock.timers.tick(4999);
    const late=response();await server.handleCreateTypingBossParticipant(req({name:'Late',classId:'necromancer'}),late,session);
    assert.equal(late.status,201);assert.ok(late.body.playerToken);
    const joined=session.players.get(late.body.code);
    assert.equal(joined.hp,250);assert.equal(joined.maxHp,250);
    assert.equal(Boolean(joined.typing.balanced),balanced);
    if(balanced){assert.equal(joined.typing.balancedRandomColors,random);assert.equal(joined.typing.ability,'necromancer');assert.equal(joined.typing.seed,session.typingHost.seed);assert.equal(joined.typing.balancedGuardMax,250);assert.equal(originalTyping.balancedGuardMax,250);}
    assert.equal(joined.typing.wordProtocol,1);assert.equal(joined.typing.gradeMask,session.typingHost.gradeMask);
    assert.equal(session.startingPlayers,2);assert.equal(session.boss.hp,250);assert.equal(session.boss.maxHp,250);
    assert.equal(session.teamHealth.hp,250);assert.equal(originalPlayer.hp,250);
    assert.equal(session.countdownEndsAt,deadline);assert.equal(session.startedAt,deadline);
    assert.equal(originalPlayer.typing,originalTyping);assert.equal(originalTyping.nextWord,0);
    t.mock.timers.tick(1);
    const tooLate=response();await server.handleCreateTypingBossParticipant(req({name:'Too late',classId:'cleric'}),tooLate,session);
    assert.equal(tooLate.status,409);assert.equal(session.players.size,2);assert.equal(session.boss.hp,250);
  }
});

test('countdown joining still respects the 30-player limit and closed rooms',async t=>{
  t.mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:1000000});
  const server=loadServer(),session=server.createTypingBossSession({mode:'proportional'});
  session.status='active';session.countdownEndsAt=Date.now()+5000;
  for(let i=0;i<30;i++)session.players.set(String(i),{});
  const join=async()=>{const res={setHeader(){},writeHead(status){this.status=status;},end(body){this.body=JSON.parse(body);}};
    await server.handleCreateTypingBossParticipant(require('node:stream').Readable.from([JSON.stringify({name:'Late',classId:'cleric'})]),res,session);return res;};
  const full=await join();assert.equal(full.status,409);assert.match(full.body.error,/30 players/);
  session.players.clear();session.status='closed';
  const closed=await join();assert.equal(closed.status,409);assert.equal(session.players.size,0);
});
