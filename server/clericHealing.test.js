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
  const s=r.initializeBalanced(r.createTypingState(123,'cleric'));
  Object.assign(s,{balancedPower:10,characters:8,balancedHealingBank:5,balancedCritCharge:7});
  const word=r.typingWord(s),text=word.text+' ',n=text.length-1,gaps=Array(n).fill(150);
  r.finishWord(s,text,n,n*150,n*22500,undefined,gaps);
  assert.equal(s.balancedPower,10);assert.equal(s.characters,8);assert.equal(s.balancedCritCharge,7);
  assert.equal(s.balancedHealingBank,0);assert.equal(s.balancedHealingDeposit,5+text.length*1.25);
});
test('Prayer mistakes reduce the private bank to zero, without attack penalties or a shared-pool deposit',()=>{
  const {previewBalancedWord}=require('../src/TypingBoss/balancedRules');
  const s=r.initializeBalanced(r.createTypingState(123,'cleric'));
  Object.assign(s,{balancedPower:10,characters:8,balancedHealingBank:4});
  const expected=r.typingWord(s).text+' ';
  const first=previewBalancedWord(s,'!',expected,[],'orange');
  assert.equal(first.balancedHealingBank,1.5);assert.equal(first.balancedPower,10);
  const second=previewBalancedWord(s,'!!',expected,[150],'orange');
  assert.equal(second.balancedHealingBank,0);assert.equal(s.balancedHealingBank,4,'preview cannot mutate confirmed bank');
  const text='!'.repeat(expected.length),n=text.length-1;
  r.finishWord(s,text,n,n*150,n*22500,undefined,Array(n).fill(150));
  assert.equal(s.balancedHealingBank,0);assert.equal(s.balancedHealingDeposit,0);
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
test('special spends only actual missing HP, preserves surplus, and keeps full base attack',()=>{
  const {s,cb,jobs,player}=room();s.clericHealingPool=200;s.clericHealingAllowance=200;player.hp=99;
  const shot=attack(player);assert.equal(shot.power,100);assert.equal(shot.supportPower,0);
  engine.launchAttack(s,player,shot,cb);
  assert.equal(player.hp,100);assert.equal(player.totalHealing,1);
  assert.equal(s.clericHealingPool,199);assert.equal(s.clericHealingAllowance,199);
  jobs.shift()();assert.equal(s.boss.hp,9900);
});
test('random wounded living target includes self and excludes defeated/full-health players',()=>{
  const {s,cb,player}=room(4);s.clericHealingPool=100;s.clericHealingAllowance=100;
  player.hp=30;s.players.get('1').hp=50;s.players.get('2').hp=0;
  cb.random=()=>.99;engine.launchAttack(s,player,attack(player),cb);
  assert.equal(s.players.get('1').hp,100);assert.equal(player.hp,30);assert.equal(s.players.get('2').hp,0);
  assert.equal(s.clericHealingPool,50);
});
test('no wounded target, no gold, or no allowance preserves the shared pool',()=>{
  for(const scenario of ['full','no-gold','no-allowance']) {
    const {s,cb,player}=room();s.clericHealingPool=100;s.clericHealingAllowance=scenario==='no-allowance'?0:100;
    if(scenario!=='full')player.hp=10;
    engine.launchAttack(s,player,attack(player,scenario==='no-gold'?0:1),cb);
    assert.equal(s.clericHealingPool,100);assert.equal(player.totalHealing,0);
  }
});
test('an all-cleric team cannot heal back more than half the boss HP damage, regardless of pool size',()=>{
  const {s,cb,jobs}=room(10);s.clericHealingPool=10000;
  for(let turn=0;turn<3;turn++) {
    engine.launchAttack(s,s.typingHost,{power:20,multiplier:1,moveId:'weak',balanced:true},cb);jobs.shift()();
    for(const p of s.players.values()) {engine.launchAttack(s,p,attack(p),cb);jobs.shift()();}
  }
  assert.equal([...s.players.values()].reduce((sum,p)=>sum+p.totalHealing,0),30);
  assert.equal(s.clericHealingAllowance,0);assert.equal(s.clericHealingPool,9970);
});
test('blocked boss damage does not create healing allowance',()=>{
  const {s,cb,jobs,player}=room();player.hp=50;player.typing.balancedGuard=30;s.clericHealingPool=100;
  engine.launchAttack(s,s.typingHost,{power:20,multiplier:1,moveId:'weak',balanced:true},cb);jobs.shift()();
  assert.equal(s.clericHealingAllowance,0);
  engine.launchAttack(s,player,attack(player),cb);
  assert.equal(player.hp,50);assert.equal(s.clericHealingPool,100);
});
