const {test}=require('node:test'),assert=require('node:assert/strict');
const r=require('../src/TypingBoss/proportionalRules'),engine=require('./proportionalBoss');
function room(count=3) {
  const players=new Map(Array.from({length:count},(_,i)=>[String(i),{code:String(i),name:`Cleric${i}`,classId:'cleric',hp:100,maxHp:100,
    totalDamage:0,totalHealing:0,totalKeystrokes:0,correctKeystrokes:0,correctStreak:0,turnsTaken:0,bossHitsTaken:0,typing:r.createTypingState(i+1,'cleric')}]));
  const s={status:'setup',mode:'proportional',startedAt:Date.now()-60000,players,boss:{id:'infernalDragon',hp:10000,maxHp:10000,name:'Dragon'},typingHost:r.createTypingState(1,'dragon'),projectiles:[]};
  engine.applyBalanced(s,true);s.status='active';
  const jobs=[],cb={schedule:(_,fn)=>jobs.push(fn),broadcast:()=>{},random:()=>0};
  return {s,cb,jobs,player:players.get('0')};
}
function attack(p,gold=1) {
  Object.assign(p.typing,{characters:80,balancedPower:100,gold,balancedDefenseWord:false});
  return r.releaseAttack(p.typing);
}
test('Prayer words route all typing power into Prayer, and never increase attack or crit',()=>{
  const s=r.initializeBalanced(r.createTypingState(123,'cleric'));s.balancedRandomColors=true;
  while(r.typingWord(s).color!=='orange')s.seed++;
  Object.assign(s,{balancedPower:10,characters:8,balancedHealingBank:5,balancedCritCharge:7});
  const word=r.typingWord(s),text=word.text+' ',n=text.length-1,gaps=Array(n).fill(150);
  r.finishWord(s,text,n,n*150,n*22500,undefined,gaps);
  assert.equal(s.balancedPower,10);assert.equal(s.characters,8);assert.equal(s.balancedCritCharge,7);
  assert.equal(s.balancedHealingBank,0);assert.equal(s.balancedHealingDeposit,5+text.length*1.25);
});
test('Prayer mistakes preserve the private bank and cannot make a shared-pool deposit',()=>{
  const {previewBalancedWord}=require('../src/TypingBoss/balancedRules');
  const s=r.initializeBalanced(r.createTypingState(123,'cleric'));s.balancedRandomColors=true;
  while(r.typingWord(s).color!=='orange')s.seed++;
  Object.assign(s,{balancedPower:10,characters:8,balancedHealingBank:4});
  const expected=r.typingWord(s).text+' ';
  const first=previewBalancedWord(s,'!',expected,[],'orange');
  assert.equal(first.balancedHealingBank,4);assert.equal(first.balancedPower,10);
  const second=previewBalancedWord(s,'!!',expected,[150],'orange');
  assert.equal(second.balancedHealingBank,4);assert.equal(s.balancedHealingBank,4,'preview cannot mutate confirmed bank');
  const text='!'.repeat(expected.length),n=text.length-1;
  r.finishWord(s,text,n,n*150,n*22500,undefined,Array(n).fill(150));
  assert.equal(s.balancedHealingBank,4);assert.equal(s.balancedHealingDeposit,0);
  assert.equal(s.balancedPower,10);assert.equal(s.characters,8);assert.equal(s.attackErrors,0);
});
test('orange deposits Healing immediately, once, without adding cleric damage power',()=>{
  const {s,cb,player}=room();
  while(r.typingWord(player.typing).color!=='orange')player.typing.seed++;
  player.typing.balancedHealingBank=20;
  const text=r.typingWord(player.typing).text+' ',n=text.length-1,gaps=Array(n).fill(150),record=[0,text,n,n*150,n*22500,null,gaps];
  engine.submitWords(s,{role:'player',actorCode:'0'},[record],cb);
  const pool=s.clericHealingPool;assert.ok(pool>20);
  assert.equal(player.typing.balancedHealingBank,0);assert.equal(player.typing.balancedHealingDeposit,0);
  assert.equal(player.typing.balancedOrangePower,0);
  engine.submitWords(s,{role:'player',actorCode:'0'},[record],cb);assert.equal(s.clericHealingPool,pool);
});
test('special converts full bonus-adjusted attack to healing and preserves surplus across specials',()=>{
  const {s,cb,jobs,player}=room(1);
  player.hp=80;
  engine.launchAttack(s,player,{...attack(player),power:50},cb);
  assert.equal(player.hp,100);assert.equal(player.totalHealing,20);
  assert.equal(s.clericHealingPool,30);assert.equal(jobs.length,0);assert.equal(s.boss.hp,10000);
  player.hp=40;
  engine.launchAttack(s,player,{...attack(player),power:50},cb);
  assert.equal(player.hp,100);assert.equal(player.totalHealing,80);
  assert.equal(s.clericHealingPool,20);assert.equal(jobs.length,0);
});

test('five Clerics divide each special deposit by five, counting defeated Clerics too',()=>{
  const {s,cb,player}=room(5);player.hp=10;s.players.get('4').hp=0;
  engine.launchAttack(s,player,{...attack(player),power:100},cb);
  assert.equal(player.hp,30);assert.equal(player.totalHealing,20);assert.equal(s.clericHealingPool,0);
});

test('random wounded living target includes self and excludes defeated/full-health players',()=>{
  const {s,cb,player}=room(4);s.clericHealingPool=100;
  player.hp=30;s.players.get('1').hp=50;s.players.get('2').hp=0;
  cb.random=()=>.99;engine.launchAttack(s,player,attack(player),cb);
  assert.equal(s.players.get('1').hp,100);assert.equal(player.hp,30);assert.equal(s.players.get('2').hp,0);
  assert.equal(s.clericHealingPool,75);
});

test('full-health allies preserve the entire special deposit without damaging the dragon',()=>{
  const {s,cb,jobs,player}=room(5);s.clericHealingPool=30;
  engine.launchAttack(s,player,attack(player),cb);
  assert.equal(s.clericHealingPool,50);assert.equal(player.totalHealing,0);
  assert.equal(jobs.length,0);assert.equal(s.boss.hp,10000);
});

test('ordinary attacks still deal damage and do not spend the healing bank',()=>{
  const {s,cb,jobs,player}=room();s.clericHealingPool=100;player.hp=10;
  engine.launchAttack(s,player,attack(player,0),cb);
  assert.equal(s.clericHealingPool,100);assert.equal(player.totalHealing,0);
  jobs.shift()();assert.equal(s.boss.hp,9900);
});

test('a confirmed blue trigger grants usable Block before any attack release',()=>{
  const {s,cb,jobs,player}=room();
  Object.assign(player.typing,{balancedRandomColors:false,balancedCharacters:140,balancedOrangeAt:240,balancedCritAt:268});
  const text=r.typingWord(player.typing).text,n=text.length-1,gaps=Array(n).fill(150);
  engine.submitWords(s,{role:'player',actorCode:'0'},[[0,text,n,n*150,n*22500,null,gaps]],cb);
  const block=text.length*.625;
  assert.equal(player.typing.balancedGuard,block);
  assert.equal(player.typing.wordsInAttack,1);assert.equal(player.typing.balancedPower,text.length);
  assert.equal(jobs.length,0,'no player attack has fired');
  engine.launchAttack(s,s.typingHost,{power:20,multiplier:1,moveId:'weak',balanced:true},cb);jobs.shift()();
  assert.equal(player.hp,100-Math.max(0,20-block));
});

test('necromancer random downed target uses all power, divides by necromancers, and banks unused healing',()=>{
  const {s,cb,jobs,player}=room(2);
  for(const p of s.players.values()){p.classId='necromancer';p.typing=r.initializeBalanced(r.createTypingState(1,'necromancer'));}
  const target=s.players.get('1');target.hp=0;target.recoverAt=12345;cb.random=()=>.99;
  engine.launchAttack(s,player,{...attack(player),power:250},cb);
  assert.equal(target.hp,100);assert.equal(target.recoverAt,null);
  assert.equal(player.totalResurrections,1);assert.equal(player.totalHealing,100);
  assert.equal(s.necroHealingPool,25);assert.equal(jobs.length,0);assert.equal(s.boss.hp,10000);
  target.hp=0;
  engine.launchAttack(s,player,{...attack(player),power:100},cb);
  assert.equal(target.hp,75);assert.equal(s.necroHealingPool,0);
});

test('necromancer selecting a standing player deals full damage and saves no revive charge',()=>{
  const {s,cb,jobs,player}=room(2);player.classId='necromancer';player.typing=r.initializeBalanced(r.createTypingState(1,'necromancer'));
  s.players.get('1').hp=0;s.necroHealingPool=25;cb.random=()=>0;
  const shot=attack(player);assert.equal(shot.supportPower,0);
  engine.launchAttack(s,player,shot,cb);jobs.shift()();
  assert.equal(s.boss.hp,9900);assert.equal(s.necroHealingPool,25);
  assert.equal(s.players.get('1').hp,0);assert.equal(player.typing.gold,0);
});

test('shared KO counter adds three seconds and early revival cancels only that recovery timer',t=>{
  t.mock.timers.enable({apis:['Date','setTimeout'],now:1000000});
  const {knockOut,syncRecovery}=require('./typingBossRecovery');
  const {s,player}=room(2);let updates=0;
  const callbacks={schedule:(_,fn,delay)=>setTimeout(fn,delay),broadcast:()=>updates++};
  player.hp=0;knockOut(s,player,callbacks);
  assert.equal(player.recoverAt,1016000);assert.equal(player.recoverDurationMs,16000);
  t.mock.timers.tick(15999);assert.equal(player.hp,0);
  t.mock.timers.tick(1);assert.equal(player.hp,1);assert.equal(updates,1);
  player.hp=0;knockOut(s,player,callbacks);assert.equal(player.recoverAt,1035000);assert.equal(player.recoverDurationMs,19000);
  t.mock.timers.tick(1000);player.hp=50;player.recoverAt=null;syncRecovery(s,callbacks);
  player.hp=0;knockOut(s,player,callbacks);assert.equal(player.recoverAt,1039000);assert.equal(player.recoverDurationMs,22000);
  t.mock.timers.tick(18000);assert.equal(player.hp,0,'old timer must not revive a later knockout');
  t.mock.timers.tick(4000);assert.equal(player.hp,1);assert.equal(s.teamKnockouts,3);
  player.hp=0;knockOut(s,player,callbacks);s.status='closed';syncRecovery(s,callbacks);
  t.mock.timers.tick(25000);assert.equal(player.hp,0);assert.equal(player.recoverAt,null);
});

test('dragon knockout schedules recovery while surviving allies keep the battle active',()=>{
  const {s,cb,jobs,player}=room(2);player.hp=10;
  engine.launchAttack(s,s.typingHost,{power:20,multiplier:1,moveId:'weak',balanced:true},cb);
  jobs.shift()();assert.equal(player.hp,0);assert.equal(player.knockouts,1);
  assert.ok(player.recoverAt>Date.now());assert.equal(s.status,'active');
  jobs.shift()();assert.equal(player.hp,1);assert.equal(player.recoverAt,null);
});

test('disabling auto revive schedules no recovery but leaves necromancer revival available',()=>{
  const {knockOut}=require('./typingBossRecovery');
  const {s,cb,jobs,player}=room(2);s.autoRevive=false;
  const target=s.players.get('1');target.hp=0;
  knockOut(s,target,cb);assert.equal(target.knockouts,1);assert.equal(target.recoverAt,null);assert.equal(jobs.length,0);
  player.classId='necromancer';player.typing=r.initializeBalanced(r.createTypingState(1,'necromancer'));
  cb.random=()=>.99;engine.launchAttack(s,player,attack(player),cb);
  assert.equal(target.hp,100);assert.equal(player.totalResurrections,1);
});

test('team recovery counts all roster members and shares earlier KOs between players',t=>{
  t.mock.timers.enable({apis:['Date'],now:1000000});
  const {knockOut,syncRecovery}=require('./typingBossRecovery');
  for(const count of [1,5,10,30]) {
    const {s,player}=room(count);player.hp=0;
    let scheduled;
    const callbacks={schedule:(_,fn,delay)=>{scheduled=delay;},broadcast:()=>{}};
    knockOut(s,player,callbacks);
    const base=10000+count*3000;
    assert.equal(scheduled,base);assert.equal(player.recoverAt,1000000+base);
    player.hp=1;syncRecovery(s,callbacks);
    const other=count>1?s.players.get('1'):player;other.hp=0;
    knockOut(s,other,callbacks);
    assert.equal(scheduled,base+3000,'a different hero inherits the team KO penalty');
    assert.equal(s.teamKnockouts,2);
  }
});

test('simultaneous KOs randomly receive successive delays and all timers start immediately',t=>{
  t.mock.timers.enable({apis:['Date','setTimeout'],now:1000000});
  const {knockOutMany}=require('./typingBossRecovery');
  const {s}=room(4);const down=[...s.players.values()].slice(0,3);down.forEach(p=>p.hp=0);
  let timers=0;
  const cb={random:()=>0,schedule:(_,fn,delay)=>{timers++;return setTimeout(fn,delay);},broadcast:()=>{}};
  knockOutMany(s,down,cb);
  assert.equal(timers,3);assert.equal(s.teamKnockouts,3);
  assert.deepEqual([...s.recovery.entries.keys()],['1','2','0']);
  assert.equal(s.players.get('1').recoverDurationMs,22000);assert.equal(s.players.get('1').recoverAt,1022000);
  assert.equal(s.players.get('2').recoverDurationMs,25000);assert.equal(s.players.get('2').recoverAt,1025000);
  assert.equal(s.players.get('0').recoverDurationMs,28000);assert.equal(s.players.get('0').recoverAt,1028000);
  t.mock.timers.tick(22000);
  assert.equal(s.players.get('1').hp,1);assert.equal(s.players.get('2').hp,0);assert.equal(s.players.get('0').hp,0);
  assert.equal(timers,3,"revivals must not start or restart anyone else's timer");
  t.mock.timers.tick(3000);assert.equal(s.players.get('2').hp,1);assert.equal(s.players.get('0').hp,0);
  t.mock.timers.tick(3000);assert.equal(s.players.get('0').hp,1);assert.equal(s.recovery,null);
});

test('three-player party gets immediate independent 19, 22 and 25 second recovery waits',t=>{
  t.mock.timers.enable({apis:['Date','setTimeout'],now:1000000});
  const {knockOut}=require('./typingBossRecovery');
  const {s,player:a}=room(3),b=s.players.get('1'),c=s.players.get('2');
  const cb={schedule:(_,fn,delay)=>setTimeout(fn,delay),broadcast:()=>{}};
  a.hp=0;knockOut(s,a,cb);assert.equal(a.recoverDurationMs,19000);assert.equal(a.recoverAt,1019000);
  t.mock.timers.tick(2000);
  b.hp=0;knockOut(s,b,cb);assert.equal(b.recoverDurationMs,22000);assert.equal(b.recoverAt,1024000);
  t.mock.timers.tick(17000);assert.equal(a.hp,1);assert.equal(b.hp,0);
  c.hp=0;knockOut(s,c,cb);assert.equal(c.recoverDurationMs,25000);assert.equal(c.recoverAt,1044000);
  t.mock.timers.tick(5000);assert.equal(b.hp,1);assert.equal(c.hp,0);
  t.mock.timers.tick(20000);assert.equal(c.hp,1);
});

test("Necromancer revival cancels only its target's timer and leaves other deadlines unchanged",t=>{
  t.mock.timers.enable({apis:['Date','setTimeout'],now:1000000});
  const {knockOut,syncRecovery}=require('./typingBossRecovery');
  const {s,player}=room(3),other=s.players.get('1');let timers=0;
  const cb={schedule:(_,fn,delay)=>{timers++;return setTimeout(fn,delay);},broadcast:()=>{}};
  player.hp=0;knockOut(s,player,cb);
  other.hp=0;knockOut(s,other,cb);const deadline=other.recoverAt;
  assert.equal(timers,2);assert.equal(deadline,1022000);
  t.mock.timers.tick(5000);player.hp=50;player.recoverAt=null;syncRecovery(s,cb);
  assert.equal(other.recoverAt,deadline);assert.equal(timers,2);assert.equal(s.recovery.entries.size,1);
  t.mock.timers.tick(14000);assert.equal(player.hp,50);assert.equal(other.hp,0);
  t.mock.timers.tick(3000);assert.equal(other.hp,1);
});

test('a full-party knockout still ends the battle with no queued automatic revival',()=>{
  const {s,cb,jobs}=room(3);s.bossAttackIndex=9;
  for(const player of s.players.values())player.hp=1;
  engine.launchAttack(s,s.typingHost,{power:30,multiplier:1,moveId:'weak',balanced:true},cb);
  jobs.shift()();assert.equal(s.status,'defeat');assert.equal(s.teamKnockouts,3);assert.equal(s.recovery,undefined);
  for(const job of jobs.splice(0))job();
  assert.ok([...s.players.values()].every(player=>player.hp===0));
});
