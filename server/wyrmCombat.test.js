const {test}=require('node:test'),assert=require('node:assert/strict');
const engine=require('./proportionalBoss'),wyrm=require('./wyrmCombat'),rules=require('../src/TypingBoss/proportionalRules');
const recovery=require('./typingBossRecovery');
function room(t){
  let now=1000000;const clock=t.mock.method(Date,'now',()=>now),jobs=[];
  const players=new Map(Array.from({length:3},(_,i)=>[String(i),{code:String(i),name:`Hero ${i}`,classId:'paladin',hp:1000,maxHp:1000,totalDamage:0,bossHitsTaken:0,turnsTaken:0,typing:rules.createTypingState(i+1,'paladin')}]));
  const s={id:'wyrm',mode:'proportional',status:'active',teamMode:true,teamHealth:{hp:3000,maxHp:3000},startedAt:now-60000,players,
    boss:{id:'giantSandWyrm',name:'Giant Sand Wyrm',hp:10000,maxHp:10000},typingHost:rules.createTypingState(123,'wyrm'),projectiles:[]};
  const cb={random:()=>0,broadcast(){},schedule:(_,fn,delay)=>jobs.push({at:now+delay,fn})};
  const advance=ms=>{const until=now+ms;while(true){jobs.sort((a,b)=>a.at-b.at);if(!jobs.length || jobs[0].at>until)break;const job=jobs.shift();now=job.at;job.fn();}now=until;};
  return {s,cb,advance,player:players.get('0'),jobs};
}
const hit=(power=30,gold=0)=>({base:power,power,multiplier:1,moveId:'weak',gold});
test('Wyrm cycles Bite, group Slam and all-player Overrun',t=>{
  const {s,cb,advance}=room(t);
  for(const [kind,count,duration] of [['wyrmBite',1,1000],['slam',2,1500],['overrun',3,8000]]) {
    engine.launchAttack(s,s.typingHost,hit(),cb);assert.equal(s.boss.wyrmAction.kind,kind);
    assert.equal(s.projectiles.filter(p=>p.bossAttack===kind).length,count);advance(duration);
  }
});
test('Overrun discards in-flight and new attacks immediately and never queues player damage',t=>{
  const {s,cb,advance,player}=room(t);
  engine.launchAttack(s,player,hit(20),cb);const inFlight=s.projectiles[0];
  s.bossAttackIndex=2;engine.launchAttack(s,s.typingHost,hit(),cb);
  assert.equal(inFlight.amount,0);assert.equal(inFlight.willHit,false);assert.equal(inFlight.resolvedAt,Date.now());
  engine.launchAttack(s,player,hit(20),cb);const missed=s.projectiles.at(-1);
  assert.equal(missed.resolvedAt,Date.now());assert.equal(missed.amount,0);assert.equal(missed.willHit,false);
  assert.equal(s.dragonCombat.queue.length,0);advance(8000);assert.equal(s.boss.hp,10000);
  engine.launchAttack(s,player,hit(20),cb);advance(700);assert.equal(s.boss.hp,9980);
});
test('Burrow stays underground through the next full ten-word sequence before Consume',t=>{
  const {s,cb,advance}=room(t);
  engine.launchAttack(s,s.typingHost,hit(100,1),cb);assert.equal(s.boss.wyrmBurrowed,true);advance(1600);
  for(let i=0;i<10;i++) {
    const state=s.typingHost,word=rules.typingWord(state),text=word.text+(rules.requiresWordSpace(state,word.text)?' ':''),count=text.length-(state.wordsInAttack===0?1:0);
    advance(3000);engine.submitWords(s,{role:'host'},[[state.nextWord,text,count,count*100,count*10000]],cb);
    if(i<9){assert.equal(s.boss.wyrmBurrowed,true);assert.ok(!s.projectiles.some(p=>p.bossAttack==='consume'));}
  }
  assert.equal(s.boss.wyrmBurrowed,false);assert.equal(s.boss.wyrmAction.kind,'consume');
});
test('Consume lands without upfront damage, ticks precisely ten times, then spits out and stops',t=>{
  const {s,cb,advance,player}=room(t);s.boss.wyrmBurrowed=true;
  engine.launchAttack(s,s.typingHost,hit(100),cb);advance(1500);
  assert.equal(player.hp,1000);assert.equal(player.consumedUntil,Date.now()+30000);
  for(let i=1;i<=10;i++){advance(3000);assert.equal(player.hp,1000-i*10);}
  assert.equal(s.teamHealth.hp,2900);assert.equal(s.boss.totalDamage,100);
  assert.equal(player.consumedUntil,null);assert.equal(player.spitOutAt,Date.now());
  assert.equal(s.projectiles.filter(p=>p.consumeTick).length,10);advance(9000);assert.equal(player.hp,900);
});
test('consumed players remain able to type and recover; other boss attacks exclude their slot',t=>{
  const {s,cb,advance,player}=room(t);wyrm.consume(s,player,100,cb);
  const state=player.typing,word=rules.typingWord(state),text=word.text+' ',count=text.length-1;
  engine.submitWords(s,{role:'player',actorCode:'0'},[[0,text,count,count*100,count*10000]],cb);assert.equal(state.nextWord,1);
  engine.launchAttack(s,s.typingHost,hit(),cb);assert.ok(s.projectiles.filter(p=>p.bossAttack).every(p=>p.target!=='0'));
  player.hp=5;advance(3000);assert.equal(player.secondWindWordsRemaining,3);
  for(let i=0;i<3;i++)recovery.advanceSecondWind(s,player);assert.equal(player.hp,400);
});
test('closing or ending a battle cancels Consume damage and no tick can resurrect it',t=>{
  for(const status of ['closed','victory','defeat','draw']) {
    const {s,cb,advance,player}=room(t);wyrm.consume(s,player,100,cb);s.status=status;require('./dragonCombat').clearDragonCombat(s);advance(40000);assert.equal(player.hp,1000);assert.equal(s.projectiles.length,0);assert.equal(player.consumedUntil,null);assert.equal(player.consumeId,null);
  }
});
test('Consume can end the shared-HP battle and cannot damage a replaced or retreated actor',t=>{
  const {s,cb,advance,player}=room(t);s.teamHealth.hp=5;wyrm.consume(s,player,100,cb);advance(3000);assert.equal(s.status,'defeat');assert.equal(s.teamHealth.hp,0);
  const h=room(t);wyrm.consume(h.s,h.player,100,h.cb);h.player.timedOut=true;h.advance(40000);assert.equal(h.player.hp,1000);
});
