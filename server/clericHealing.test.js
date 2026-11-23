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
  const result=r.releaseAttack(p.typing);
  // These fixtures override power with a full healing amount at the call site.
  delete result.healingPower;
  return result;
}

test('cleric and necromancer healing uses the roster divisor and the class divisor',()=>{
  for(const ability of ['cleric','necromancer']) {
    const {s,cb,player}=room(5);
    for(const p of s.players.values()) {p.classId=ability;p.typing.ability=ability;}
    player.typing.balancedPower=50/5;player.typing.characters=50;player.typing.gold=1;
    player.typing.balancedCritBonus=.2;player.typing.balancedOrangePower=10/5;
    const hit=r.releaseAttack(player.typing);
    assert.equal(hit.power,14.4);assert.equal(hit.healingPower,14.4);
    if(ability==='cleric')player.hp=1;
    else {player.hp=0;cb.random=()=>0;}
    engine.launchAttack(s,player,hit,cb);
    assert.ok(Math.abs(player.hp-(ability==='cleric'?3.88:2.88))<1e-10);
    assert.ok(Math.abs(s.projectiles.at(-1).amount-2.88)<1e-10);
    assert.equal(s.boss.hp,10000);
  }
});

test('cleric orange Prayer gains follow roster scaling in both color modes',()=>{
  const {recordBalancedWord}=require('../src/TypingBoss/balancedRules');
  for(const randomColors of [false,true]) {
    const solo=r.initializeBalanced(r.createTypingState(1,'cleric'));solo.balancedRandomColors=randomColors;
    if(!randomColors)Object.assign(solo,{balancedCharacters:25,balancedOrangeAt:25});
    const five=structuredClone(solo);five.combatDivisor=5;
    for(const state of [solo,five])recordBalancedWord(state,'cat','cat ',[150,150],true,'orange');
    assert.ok(Math.abs(five.balancedHealingDeposit-solo.balancedHealingDeposit/5)<1e-10);
    assert.ok(five.balancedHealingDeposit>0);
  }
});

test('non-balanced healing and damage both follow roster scaling',()=>{
  for(const ability of ['cleric','necromancer']) {
    const solo=r.createTypingState(1,ability);
    Object.assign(solo,{characters:70,orange:.2,green:1,growth:.04,gold:1});
    const seven={...solo,combatDivisor:7};
    const a=r.releaseAttack(solo,()=>1),b=r.releaseAttack(seven,()=>1);
    assert.ok(Math.abs(a.power/7-b.power)<1e-10);
    assert.ok(Math.abs(a.healingPower/7-b.healingPower)<1e-10);
  }
});
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
  const block=text.length*.625/s.players.size;
  assert.equal(player.typing.balancedGuard,block);
  assert.equal(player.typing.wordsInAttack,1);assert.equal(player.typing.balancedPower,text.length/s.players.size);
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
