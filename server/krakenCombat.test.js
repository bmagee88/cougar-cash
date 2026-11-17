const {test}=require('node:test'),assert=require('node:assert/strict');
const {KRAKEN_ANIMATIONS}=require('../src/TypingBoss/krakenAnimationRules');
const k=require('./krakenCombat'),r=require('../src/TypingBoss/proportionalRules'),engine=require('./proportionalBoss');
function room(count=3) {
  let now=10000;const original=Date.now;Date.now=()=>now;
  const players=new Map(Array.from({length:count},(_,i)=>[String(i),{code:String(i),classId:'barbarian',name:`P${i}`,hp:100,maxHp:100,totalDamage:0,totalKeystrokes:0,correctKeystrokes:0,typing:r.createTypingState(1,'barbarian')}]));
  const session={status:'setup',mode:'proportional',players,boss:{id:'kraken',hp:1000,maxHp:1000},typingHost:r.createTypingState(1,'kraken'),projectiles:[],startedAt:1};
  engine.applyBalanced(session,true,false);session.status='active';
  const jobs=[],cb={schedule:(_,fn,ms)=>{jobs.push({fn,at:now+ms});},broadcast:()=>{},random:()=>.5};
  return {session,cb,jobs,tick(ms){now+=ms;for(;;){jobs.sort((a,b)=>a.at-b.at);if(!jobs.length || jobs[0].at>now)break;jobs.shift().fn();}},restore(){Date.now=original;}};
}
test('Kraken repeats 8/10/10 words and gold never extends its word count',()=>{
  for(const balanced of [false,true]) {
    const s=r.createTypingState(1,'kraken');if(balanced)r.initializeBalanced(s);
    for(const [index,limit] of [8,10,10,8].entries()) {
      assert.equal(r.attackWordLimit(s),limit);s.gold=1;
      for(let i=0;i<limit;i++) {const w=r.typingWord(s),text=w.text+(r.requiresWordSpace(s,w.text)?' ':'');const n=text.length-1;r.finishWord(s,text,n,n*150,n*22500,undefined,Array(n).fill(150));}
      assert.equal(s.wordsInAttack,limit);const a=r.releaseAttack(s,()=>1);
      assert.equal(a.krakenAttackIndex,index);assert.ok(a.gold>0);
    }
  }
});
test('sweep selects unique 2-8 living targets, clamps to the party, and shares all damage',()=>{
  for(const count of [1,2,5,12]) {
    const x=room(count);try {
      const plan=k.plan(x.session,{krakenAttackIndex:1},()=>.99);
      assert.equal(plan.targets.length,Math.min(8,count));assert.equal(new Set(plan.targets).size,plan.targets.length);
      x.cb.random=()=>.99;
      engine.launchAttack(x.session,x.session.typingHost,{krakenAttackIndex:1,power:80,multiplier:1,moveId:'weak',balanced:true},x.cb);
      x.tick(KRAKEN_ANIMATIONS.tentacleSweep.impact);
      assert.equal(x.session.projectiles.length,Math.min(8,count));
      assert.ok(Math.abs(x.session.projectiles.reduce((sum,p)=>sum+p.amount,0)-80)<1e-10);
    }finally{x.restore();}
  }
});
test('single slam deals damage, forces 5-second prone, blocks submissions/progress, then releases',()=>{
  const x=room();try {
    engine.launchAttack(x.session,x.session.typingHost,{krakenAttackIndex:0,power:20,multiplier:1,moveId:'weak',balanced:true},x.cb);x.tick(KRAKEN_ANIMATIONS.tentacleStrike.impact);
    const target=x.session.players.get(x.session.projectiles[0].target);
    assert.equal(target.hp,80);assert.equal(target.proneUntil,Date.now()+5000);
    assert.throws(()=>engine.submitWords(x.session,{role:'player',actorCode:target.code},[],x.cb),/prone/);
    engine.updateProgress(x.session,{role:'player',actorCode:target.code},0,1,()=>assert.fail('Prone progress must not broadcast'));
    assert.equal(target.progressCursor,undefined);x.tick(5000);assert.equal(target.proneUntil,null);
  }finally{x.restore();}
});
test('wave independently grants 15% prone instead of damage without redistributing the saved damage',()=>{
  const x=room();try {
    const rolls=[.1499,.15,.99];x.cb.random=()=>rolls.shift();
    engine.launchAttack(x.session,x.session.typingHost,{krakenAttackIndex:2,power:90,multiplier:1,moveId:'weak',balanced:true},x.cb);x.tick(KRAKEN_ANIMATIONS.tidalWave.impact);
    const [a,b,c]=[...x.session.players.values()];
    assert.equal(a.hp,100);assert.equal(b.hp,70);assert.equal(c.hp,70);
    assert.equal(a.proneUntil,Date.now()+5000);assert.equal(x.session.projectiles[0].evadeType,'prone');
  }finally{x.restore();}
});
test('curse ticks every 2-4 seconds for 15 seconds, sends a correct-key pulse without penalizing accuracy, and stops at expiry',()=>{
  const x=room();try {
    x.cb.random=()=>0;const p=x.session.players.get('0');
    p.progressCursor={wordIndex:100,characters:0};
    k.curse(x.session,[p],x.cb);assert.equal(p.curseUntil,Date.now()+15000);
    assert.equal(x.jobs.filter(job=>job.at-Date.now()>=2000 && job.at-Date.now()<15000).length,7);
    x.tick(2000);assert.equal(p.curseKey.key,'');assert.equal(p.curseKey.index,0);assert.equal(p.typing.curseMistakes,undefined);
    const state=p.typing;Object.assign(state,{balancedSpecialAt:0,balancedOrangeAt:1e9,balancedCritAt:1e9,balancedBlueAt:1e9,balancedGreenAt:1e9});
    const w=r.typingWord(state),text=w.text;
    const result=r.finishWord(state,text,text.length-1,0,0,undefined,Array(text.length-1).fill(0),0);
    assert.equal(result.correct,true);assert.ok(state.gold>0);assert.equal(state.attackErrors,0);
    x.tick(13000);assert.equal(p.curseUntil,null);assert.equal(p.curseKey,null);
    const prior=state.curseMistakes;x.tick(20000);assert.deepEqual(state.curseMistakes,prior);
  }finally{x.restore();}
});
test('prone and ended battles suppress curse key presses; replacement curses invalidate old callbacks',()=>{
  const x=room();try {
    x.cb.random=()=>0;const p=x.session.players.get('0');k.curse(x.session,[p],x.cb);k.prone(x.session,p,x.cb);
    x.tick(2000);assert.equal(p.curseKey,null);x.tick(3000);x.tick(1000);assert.ok(p.curseKey);
    k.curse(x.session,[p],x.cb);const id=p.curseId;x.tick(2000);assert.equal(p.curseId,id);
    x.session.status='victory';const key=p.curseKey;x.tick(2000);assert.equal(p.curseKey,key);
  }finally{x.restore();}
});

test('Kraken attacks wait for the previous drawn recovery without overlapping clips or awarding twice',()=>{
  const x=room();try {
    const start=Date.now(),attack=index=>({krakenAttackIndex:index,power:20,multiplier:1,moveId:'weak',balanced:true});
    engine.launchAttack(x.session,x.session.typingHost,attack(0),x.cb);
    engine.launchAttack(x.session,x.session.typingHost,attack(1),x.cb);
    assert.equal(x.session.projectiles.length,1);assert.equal(x.session.boss.queuedAttacks,1);
    x.tick(KRAKEN_ANIMATIONS.tentacleStrike.duration-1);assert.equal(x.session.projectiles.length,1);
    x.tick(1);assert.equal(x.session.boss.queuedAttacks,0);
    const sweep=x.session.projectiles.filter(p=>p.bossAttack==='tentacleSweep');
    assert.ok(sweep.length>=2);assert.ok(sweep.every(p=>p.startedAt===start+KRAKEN_ANIMATIONS.tentacleStrike.duration));
    assert.ok(sweep.every(p=>p.impactAt===p.startedAt+KRAKEN_ANIMATIONS.tentacleSweep.impact));
  }finally{x.restore();}
});

test('a full 20-frame wave completes before critical recoil and the next queued attack',()=>{
  const {recordDragonHurt}=require('./dragonCombat');
  const x=room();try {
    const start=Date.now();
    engine.launchAttack(x.session,x.session.typingHost,{krakenAttackIndex:2,power:20,multiplier:1,moveId:'weak',balanced:true},x.cb);
    assert.equal(x.session.boss.krakenWave.at,start);assert.equal(x.session.boss.krakenWave.until,start+KRAKEN_ANIMATIONS.tidalWave.duration);
    recordDragonHurt(x.session,{id:'critical',kind:'damage',target:'boss',amount:10,willHit:true,critical:true,resolvedAt:start});
    assert.equal(x.session.boss.hurt,null);assert.equal(x.session.boss.queuedStrongReactions,1);
    engine.launchAttack(x.session,x.session.typingHost,{krakenAttackIndex:0,power:20,multiplier:1,moveId:'weak',balanced:true},x.cb);
    x.tick(KRAKEN_ANIMATIONS.tidalWave.duration-1);assert.ok(x.session.boss.krakenWave);assert.equal(x.session.boss.hurt,null);
    x.tick(1);assert.equal(x.session.boss.krakenWave,null);assert.equal(x.session.boss.hurt.tier,'critical');
    assert.equal(x.session.boss.queuedAttacks,1);
    const until=x.session.boss.hurt.until;x.tick(until-Date.now());
    assert.equal(x.session.boss.queuedAttacks,0);assert.equal(x.session.projectiles.at(-1).startedAt,until);
  }finally{x.restore();}
});

test('Ink Hex gets its own 20-frame cast before the regular attack and its damage',()=>{
  const x=room();try {
    const start=Date.now(),config=KRAKEN_ANIMATIONS.tentacleStrike;
    engine.launchAttack(x.session,x.session.typingHost,{krakenAttackIndex:0,power:20,multiplier:1,moveId:'weak',balanced:true,gold:1},x.cb);
    const shot=x.session.projectiles[0],target=x.session.players.get(shot.target);
    assert.equal(x.session.boss.krakenCast.until,start+KRAKEN_ANIMATIONS.special.duration);
    assert.equal(shot.startedAt,x.session.boss.krakenCast.until);assert.equal(shot.impactAt,shot.startedAt+config.impact);
    x.tick(KRAKEN_ANIMATIONS.special.duration);assert.equal(x.session.boss.krakenCast,null);assert.equal(target.hp,100);
    x.tick(config.impact-1);assert.equal(target.hp,100);x.tick(1);assert.equal(target.hp,80);
  }finally{x.restore();}
});
