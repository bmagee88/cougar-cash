const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const promotion=require('./typingBossPromotion'),engine=require('./proportionalBoss'),r=require('../src/TypingBoss/proportionalRules');
function room(){
  const players=new Map(Array.from({length:3},(_,i)=>[String(i),{code:String(i),name:`Hero ${i}`,classId:'barbarian',promoted:false,hp:100,maxHp:100,totalDamage:0,totalHealing:0,turnsTaken:0,typing:r.createTypingState(1,'barbarian')}]));
  const s={mode:'proportional',status:'setup',players,boss:{id:'infernalDragon',hp:300,maxHp:300},typingHost:r.createTypingState(1,'dragon'),projectiles:[]};
  const jobs=[],cb={schedule:(_,fn)=>jobs.push(fn),broadcast:()=>{},random:()=>.4};return {s,p:players.get('0'),jobs,cb};
}
test('device grants are signed, reject tampering and local booleans, and invalidate on password rotation',()=>{
  const secret=crypto.randomBytes(32).toString('hex'),token=promotion.issuePromotionToken(secret);
  assert.equal(promotion.verifyPromotionToken(token,secret),true);
  assert.equal(promotion.verifyPromotionToken(token,secret+'changed'),false);
  for(const fake of [true,'true','',token.slice(0,-1)+(token.endsWith('0')?'1':'0'),{},null])assert.equal(promotion.verifyPromotionToken(fake,secret),false);
  assert.equal(promotion.verifyPromotionToken(token,''),false);assert.throws(()=>promotion.issuePromotionToken(''));
});
test('one promoted hero among three contributes four HP shares; promotion is idempotent and preserves damage',()=>{
  const {s,p}=room();s.status='active';s.boss.hp=225;
  assert.equal(promotion.promotePlayer(s,p),true);assert.equal(promotion.bossContributions(s),4);
  assert.equal(s.boss.maxHp,400);assert.equal(s.boss.hp,325);assert.equal(p.typing.promoted,true);
  assert.equal(promotion.promotePlayer(s,p),false);assert.equal(s.boss.maxHp,400);
  s.status='setup';engine.applyHpMultiplier(s,1.5);assert.equal(s.boss.maxHp,600);assert.equal(p.maxHp,150);
  s.status='victory';assert.throws(()=>promotion.promotePlayer(s,p),/open/);
});
test('promoted countdown joins contribute twice while the combat divisor stays the roster count',()=>{
  const {s,p}=room();p.promoted=true;s.status='active';s.countdownEndsAt=Date.now()+5000;
  const join={code:'new',classId:'paladin',promoted:true,typing:r.createTypingState(1,'paladin')};s.players.set(join.code,join);
  engine.addCountdownPlayer(s,join);assert.equal(s.boss.hp,600);assert.equal(join.hp,100);assert.equal(join.typing.combatDivisor,4);assert.equal(join.typing.promoted,true);
});

test('host can demote during combat, preserving boss HP percentage and restoring normal attacks',()=>{
  const {s,p}=room();s.status='active';promotion.promotePlayer(s,p);
  s.boss.hp=200;
  assert.equal(promotion.setPlayerPromotion(s,p,false),true);
  assert.equal(p.promoted,false);assert.equal(p.typing.promoted,false);
  assert.equal(s.boss.hp,150);assert.equal(s.boss.maxHp,300);
  assert.equal(promotion.promotedAttack(p,{power:10}).power,10);
  assert.equal(promotion.setPlayerPromotion(s,p,false),false);
  s.status='defeat';assert.throws(()=>promotion.setPlayerPromotion(s,p,true),/open/);
});

test('promotion toggles do not change Team HP or an inactive player contribution',()=>{
  for(const options of [{teamMode:true},{timedOut:true}]) {
    const {s,p}=room();s.status='active';s.teamMode=Boolean(options.teamMode);p.timedOut=Boolean(options.timedOut);
    promotion.setPlayerPromotion(s,p,true);promotion.setPlayerPromotion(s,p,false);
    assert.equal(s.boss.hp,300);assert.equal(s.boss.maxHp,300);assert.equal(p.promoted,false);
  }
});
test('promotion doubles final offensive damage, including bonuses, and marks stronger impacts',()=>{
  const {s,p,jobs,cb}=room();s.status='active';
  engine.launchAttack(s,p,{power:20,base:10,multiplier:2,criticalPower:5,orangePower:5,moveId:'weak',balanced:true},cb);jobs.shift()();
  promotion.promotePlayer(s,p);
  engine.launchAttack(s,p,{power:20,base:10,multiplier:2,criticalPower:5,orangePower:5,moveId:'weak',balanced:true},cb);jobs.shift()();
  assert.deepEqual(s.projectiles.map(x=>x.amount),[20,40]);assert.equal(p.totalDamage,60);
  assert.equal(s.projectiles[1].promoted,true);assert.equal(s.projectiles[1].moveId,'strong');assert.equal(p.strongestAttack.criticalPower,10);
  assert.equal(p.strongestAttack.multiplier,2);assert.equal(p.strongestAttack.promotionMultiplier,2);
});
test('promotion does not double cleric healing or necromancer revival healing',()=>{
  for(const ability of ['cleric','necromancer']) {
    const {s,p,jobs,cb}=room();s.status='active';p.classId=ability;p.typing.ability=ability;promotion.promotePlayer(s,p);
    if(ability==='cleric')p.hp=20;else s.players.get('1').hp=0;
    engine.launchAttack(s,p,{power:50,healingPower:50,gold:1,multiplier:1,moveId:'special',balanced:true},cb);
    assert.equal(s.projectiles[0].amount,50);assert.equal(jobs.length,0);assert.equal(s.boss.hp,400);
    assert.equal(ability==='cleric'?p.hp:s.players.get('1').hp,ability==='cleric'?70:50);
  }
});
