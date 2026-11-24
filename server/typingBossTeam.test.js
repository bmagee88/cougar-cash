const {test}=require('node:test');
const assert=require('node:assert/strict');
const rules=require('../src/TypingBoss/proportionalRules');
const {damageMultiplier}=require('../src/TypingBoss/battleRules');
const engine=require('./proportionalBoss');
const recovery=require('./typingBossRecovery');
const {changePlayerHealth}=require('./typingBossHealth');
const {summonZombie,loseSummon,prepareSummonWords,livingSummons,weightedTargetIndex}=require('./typingBossSummons');

function room(count=3,teamMode=true,balanced=false) {
  const players=new Map(Array.from({length:count},(_,index)=>[String(index),{
    code:String(index),name:`Hero ${index}`,classId:'barbarian',hp:100,maxHp:100,totalDamage:0,totalHealing:0,
    totalKeystrokes:0,correctKeystrokes:0,correctStreak:0,bossHitsTaken:0,turnsTaken:0,typing:rules.createTypingState(index+1),
  }]));
  const s={mode:'proportional',status:'setup',teamMode,players,startedAt:Date.now()-60000,
    boss:{id:'infernalDragon',name:'Dragon',hp:100,maxHp:100},typingHost:rules.createTypingState(123),projectiles:[]};
  engine.applyHpMultiplier(s,1);
  engine.applyBalanced(s,balanced,false);
  s.status='active';
  const jobs=[],cb={schedule:(_,fn)=>jobs.push(fn),broadcast(){},random:()=>0};
  return {s,jobs,cb,player:players.get('0')};
}
function hit(power=10) {return {power,multiplier:1,moveId:'weak'};}
function wordRecord(state,correct=true) {
  const word=rules.typingWord(state),text=word.text+(rules.requiresWordSpace(state,word.text)?' ':'');
  const count=text.length-(state.wordsInAttack===0?1:0);
  return [state.nextWord,correct?text:'!'.repeat(word.text.length)+(text.endsWith(' ')?' ':''),count,count*200,count*40000];
}

test('damage ramp starts after countdown and advances by .01 every two seconds',()=>{
  for(const [elapsed,expected] of [[-5000,1],[0,1],[1000,1],[1999,1],[2000,1.01],[3999,1.01],[4000,1.02],[60000,1.3],[300000,2.5]])
    assert.equal(damageMultiplier(10000,10000+elapsed),expected);
  assert.equal(damageMultiplier(undefined,999999),1);
});

test('team HP equals boss HP and twelve players collectively earn one full attack without double division',()=>{
  for(const count of [1,3,12,30]) {
    const {s,jobs,cb}=room(count);
    assert.equal(s.teamHealth.maxHp,s.boss.maxHp);
    assert.equal(s.teamHealth.maxHp,100*count);
    for(const player of s.players.values()) {
      Object.assign(player.typing,{characters:10,orange:0,growth:0,red:0,intervalCount:0});
      const attack=rules.releaseAttack(player.typing,()=>1);
      assert.equal(attack.power,10/count);
      engine.launchAttack(s,player,attack,cb);
    }
    for(const job of jobs.splice(0))job();
    assert.ok(Math.abs(s.boss.hp-(100*count-10))<1e-9);
  }
});

test('single, tail, and all-player volleys each remove their total damage once from the shared pool',()=>{
  for(const count of [1,12])for(const step of [0,2,9]) {
    const {s,jobs,cb}=room(count,true,true);s.bossAttackIndex=step;
    engine.launchAttack(s,s.typingHost,hit(30),cb);jobs.shift()();
    assert.ok(Math.abs(s.teamHealth.hp-(100*count-30))<1e-9);
    assert.ok(Math.abs([...s.players.values()].reduce((sum,player)=>sum+player.hp,0)-(100*count-30))<1e-9);
    assert.ok([...s.players.values()].every(player=>player.maxHp===100));
    assert.ok(Math.abs(s.boss.totalDamage-30)<1e-9);
    assert.ok([...s.players.values()].every(player=>!player.secondWindWordsRemaining && !player.knockouts));
  }
});

test('shared damage respects individual target shields and shared healing never duplicates its amount',()=>{
  const {s,jobs,cb,player}=room(4);
  player.typing.shield=.5;
  engine.launchAttack(s,s.typingHost,hit(20),cb);jobs.shift()();
  assert.equal(s.teamHealth.hp,390);
  assert.equal(changePlayerHealth(s,player,5),5);
  assert.equal(s.teamHealth.hp,395);
  assert.equal(player.hp,95);assert.ok([...s.players.values()].filter(p=>p!==player).every(p=>p.hp===100));
});

test('cleric specials heal both the wounded hero and shared team pool once',()=>{
  for(const ability of ['cleric'])for(const balanced of [false,true]) {
    const {s,cb,player}=room(3,true,balanced);
    for(const p of s.players.values())p.classId='barbarian';
    player.classId=ability;player.typing.ability=ability;
    changePlayerHealth(s,player,-50);
    engine.launchAttack(s,player,{...hit(20),balanced,gold:1},cb);
    assert.equal(s.teamHealth.hp,270);
    assert.equal(player.totalHealing,20);
    assert.equal(s.boss.hp,300);
  }
});

test('both sides use the same ramp at attack launch and healing does not gain the ramp',t=>{
  t.mock.timers.enable({apis:['Date'],now:1000000});
  for(const host of [false,true]) {
    const {s,cb,jobs,player}=room(1);s.countdownEndsAt=940000;
    engine.launchAttack(s,host?s.typingHost:player,hit(10),cb);
    assert.equal(s.projectiles[0].amount,13);
    jobs.shift()();
    assert.equal(host?s.teamHealth.hp:s.boss.hp,87);
  }
  const {s,cb,player}=room(1);s.countdownEndsAt=940000;
  changePlayerHealth(s,player,-50);player.typing.ability='cleric';
  engine.launchAttack(s,player,{...hit(10),gold:1},cb);
  assert.equal(s.teamHealth.hp,60);
});

test('shared depletion ends the round, caps overkill, and never starts Second Wind',()=>{
  const {s,cb,jobs}=room(12,true,true);s.bossAttackIndex=9;
  engine.launchAttack(s,s.typingHost,hit(2000),cb);jobs.shift()();
  assert.equal(s.teamHealth.hp,0);assert.equal(s.status,'defeat');
  assert.ok(Math.abs(s.boss.totalDamage-1200)<1e-9);
  assert.ok([...s.players.values()].every(p=>!p.knockouts && !p.secondWindWordsRemaining));
});

test('Second Wind keeps solo and full parties active with no recovery timers',()=>{
  for(const count of [1,3]) {
    const {s,cb,jobs}=room(count,false,true);s.bossAttackIndex=9;
    for(const p of s.players.values())p.hp=1;
    engine.launchAttack(s,s.typingHost,hit(30),cb);jobs.shift()();
    assert.equal(s.status,'active');
    assert.ok([...s.players.values()].every(p=>p.hp===0 && p.secondWindWordsRemaining===3 && p.recoverAt===null));
  }
});

test('Second Wind counts accepted words once, skips invalid words, and grants 40% HP and protection',t=>{
  t.mock.timers.enable({apis:['Date'],now:1000000});
  const {s,cb,player}=room(1,false);player.hp=0;recovery.knockOut(s,player);
  const auth={role:'player',actorCode:player.code};
  const first=wordRecord(player.typing);
  engine.submitWords(s,auth,[first],cb);assert.equal(player.secondWindWordsRemaining,2);
  engine.submitWords(s,auth,[first],cb);assert.equal(player.secondWindWordsRemaining,2);
  engine.submitWords(s,auth,[wordRecord(player.typing,false)],cb);assert.equal(player.secondWindWordsRemaining,2);
  for(let i=0;i<2;i++)engine.submitWords(s,auth,[wordRecord(player.typing)],cb);
  assert.equal(player.secondWindWordsRemaining,0);assert.equal(player.hp,40);
  assert.equal(player.protectedUntil,1005000);
});

test('Second Wind attacks retain 75% power and protection blocks already-launched hits',t=>{
  t.mock.timers.enable({apis:['Date'],now:1000000});
  const {s,cb,jobs,player}=room(2,false);
  engine.launchAttack(s,s.typingHost,hit(20),cb);
  player.hp=0;recovery.knockOut(s,player);
  jobs.shift()();assert.equal(player.hp,0);
  engine.launchAttack(s,player,hit(20),cb);
  assert.equal(s.projectiles.at(-1).amount,15);
  for(let i=0;i<3;i++)recovery.advanceSecondWind(s,player);
  engine.launchAttack(s,s.typingHost,hit(20),cb);
  // Run damage/animation jobs without advancing the wall clock.
  for(const job of jobs.splice(0))job();
  assert.equal(player.hp,40);
  t.mock.timers.tick(5000);
  assert.equal(player.protectedUntil,Date.now());
});

test('balanced dragon cycle prioritizes tail then single attacks then the all-player attack',()=>{
  const counts={tailWhip:0,bite:0,fireball:0,flamethrower:0};
  for(let step=0;step<10;step++) {
    const {s,cb}=room(12,true,true);s.bossAttackIndex=step;
    engine.launchAttack(s,s.typingHost,hit(),cb);counts[s.projectiles[0].bossAttack]++;
  }
  assert.deepEqual(counts,{tailWhip:5,bite:2,fireball:2,flamethrower:1});
});

test('Second Wind protection expires after five seconds and never prevents later damage',t=>{
  t.mock.timers.enable({apis:['Date'],now:1000000});
  const {s,cb,jobs,player}=room(2,false);
  player.hp=40;player.protectedUntil=1005000;
  engine.launchAttack(s,s.typingHost,hit(20),cb);jobs.shift()();
  assert.equal(player.hp,40);
  t.mock.timers.tick(5000);
  engine.launchAttack(s,s.typingHost,hit(20),cb);jobs.shift()();
  assert.equal(player.hp,20);
});

test('three-player Team mode applies the HP multiplier equally and counts promoted heroes once',()=>{
  const {s}=room(3);
  s.status='setup';s.players.get('0').promoted=true;
  engine.applyHpMultiplier(s,1.25);
  assert.equal(s.teamHealth.hp,375);assert.equal(s.teamHealth.maxHp,375);
  assert.equal(s.boss.hp,375);assert.equal(s.boss.maxHp,375);
  assert.ok([...s.players.values()].every(player=>player.hp===125 && player.maxHp===125));
});

test('team necromancer specials summon once per attack, cap at three and resurrect existing KO slots',()=>{
  for(const balanced of [false,true]) {
    const {s,cb,player}=room(3,true,balanced);player.classId=player.typing.ability='necromancer';
    for(let index=0;index<4;index++)engine.launchAttack(s,player,{...hit(),gold:3,balanced},cb);
    assert.equal(livingSummons(player).length,3);assert.equal(player.summons.length,3);
    assert.equal(s.projectiles.length,4);assert.ok(s.projectiles.every(shot=>shot.target==='boss'));
    assert.equal(player.totalHealing,0);assert.equal(s.teamHealth.hp,300);
    const down=loseSummon(player);assert.equal(down.slot,2);assert.equal(player.summons[2].alive,false);
    engine.launchAttack(s,player,{...hit(),gold:1,balanced},cb);
    assert.equal(player.summons.length,3);assert.equal(player.summons[2].alive,true);
    assert.equal(player.summons[2].event,'resurrection');
  }
});

test('a damaging boss hit hurts the owner and team and kills one summon; full blocks and dodges preserve summons',()=>{
  for(const protection of ['none','block','dodge']) {
    const {s,cb,jobs,player}=room(2);player.classId='necromancer';summonZombie(player);summonZombie(player);
    if(protection==='block')player.typing.shield=1;
    if(protection==='dodge')player.typing.dodgeBank=100;
    engine.launchAttack(s,s.typingHost,hit(20),cb);jobs.shift()();
    assert.equal(player.hp,protection==='none'?80:100);
    assert.equal(s.teamHealth.hp,protection==='none'?180:200);
    assert.equal(livingSummons(player).length,protection==='none'?1:2);
    assert.equal(s.players.get('1').hp,100);
  }
});

test('target weighting adds one ticket per living summon, excludes KO slots, and applies to both bosses',()=>{
  const {s,player}=room(2);player.classId='necromancer';
  for(let index=0;index<3;index++)summonZombie(player);
  const players=[...s.players.values()];
  assert.deepEqual(Array.from({length:5},(_,step)=>weightedTargetIndex(players,()=>0,step)),[0,0,0,0,1]);
  assert.equal(weightedTargetIndex(players,()=>.79),0);assert.equal(weightedTargetIndex(players,()=>.81),1);
  loseSummon(player);assert.equal(weightedTargetIndex(players,()=>.76),1);
  for(const boss of ['infernalDragon','kraken']) {
    const {s,player,cb}=room(2);s.boss.id=boss;player.classId='necromancer';summonZombie(player);summonZombie(player);summonZombie(player);
    engine.launchAttack(s,s.typingHost,hit(),{...cb,random:()=>.7});
    // Dragon chooses Tail Whip, anchored on the weighted necromancer; Kraken chooses Slam.
    assert.equal(s.projectiles[0].target,player.code);
  }
});

test('summon prefixes precede ten normal words and never earn owner ATK, cadence, colors, triggers or banks',()=>{
  for(const balanced of [false,true])for(const randomColors of [false,true]) {
    const state=rules.createTypingState(1,'necromancer');if(balanced){rules.initializeBalanced(state);state.balancedRandomColors=randomColors;}
    Object.assign(state,{summonPrefix:[0,2],combatDivisor:3,green:5,growth:1,red:.5,orange:.4});
    const before=structuredClone(state);
    for(const slot of [0,2]) {
      const word=rules.typingWord(state),text=word.text+(rules.requiresWordSpace(state,word.text)?' ':'');
      assert.equal(word.summonSlot,slot);assert.equal(word.color,null);assert.equal(word.trigger,false);
      const result=rules.finishWord(state,text,2,200,20000,100,[100,100]);
      assert.equal(result.base,text.length/3);assert.equal(result.correct,true);
    }
    for(const key of ['characters','intervalCount','intervalSum','intervalSquares','orange','red','green','growth','gold','balancedPower','balancedCharacters','balancedOrangeBank','balancedCadenceBonus','dodgeBank'])assert.equal(state[key],before[key],key);
    assert.equal(state.wordsInAttack,2);assert.equal(rules.attackWordLimit(state),12);
    assert.equal(rules.typingWord(state).summonSlot,undefined);
    assert.ok(state.totalCharacters>0);
  }
});

test('summon damage ignores promotion and the kneeling penalty while owner attacks use team Second Wind power',()=>{
  const {s,player,cb}=room(2);player.classId=player.typing.ability='necromancer';player.promoted=true;player.promotionLevel=1;
  summonZombie(player);player.hp=0;recovery.knockOut(s,player);
  engine.launchAttack(s,player,hit(10),cb);assert.equal(s.projectiles.at(-1).amount,16);
  engine.launchAttack(s,player,{...hit(10),summonSlot:0},cb);assert.equal(s.projectiles.at(-1).amount,10);
  assert.equal(s.projectiles.at(-1).promoted,undefined);assert.equal(s.projectiles.at(-1).summonSlot,0);
  const shared=s.teamHealth.hp;
  for(let index=0;index<3;index++)recovery.advanceSecondWind(s,player);
  assert.equal(player.hp,40);assert.equal(player.secondWindWordsRemaining,0);assert.equal(s.teamHealth.hp,shared);
});

test('missing or lost summon slots cannot attack and a mid-run loss preserves the issued word order',()=>{
  const {s,player,cb}=room(2);player.classId='necromancer';summonZombie(player);summonZombie(player);prepareSummonWords(s,player);
  const words=Array.from({length:12},(_,index)=>rules.typingWord(player.typing,index));
  loseSummon(player);
  assert.deepEqual(Array.from({length:12},(_,index)=>rules.typingWord(player.typing,index)),words);
  engine.launchAttack(s,player,{...hit(10),summonSlot:1},cb);assert.equal(s.projectiles.length,0);
  prepareSummonWords(s,player);assert.deepEqual(player.typing.summonPrefix,[0]);
});
