const {test}=require('node:test'),assert=require('node:assert/strict');
const {timeoutInactivePlayers,recordTypingActivity}=require('./typingBossInactivity');
const {changePlayerHealth}=require('./typingBossHealth');
const {createTypingState}=require('../src/TypingBoss/proportionalRules');
const rules=require('../src/TypingBoss/proportionalRules');
const engine=require('./proportionalBoss');
function room(teamMode=true) {
  const players=new Map(Array.from({length:3},(_,i)=>[String(i),{code:String(i),name:`Hero ${i}`,hp:150,maxHp:300,lastTypingAt:i?40000:10000,typing:{...createTypingState(i+1),combatDivisor:3,balancedGuard:30,balancedGuardMax:300}}]));
  return {mode:'proportional',status:'active',teamMode,countdownEndsAt:10000,players,
    hpMultiplier:1,boss:{id:'infernalDragon',name:'Dragon',hp:180,maxHp:300},teamHealth:{hp:150,maxHp:300},typingHost:{...createTypingState(1),balancedGuard:60,balancedGuardMax:300},projectiles:[]};
}
test('timeout KO retains the player and HP, excludes their contribution, and adjusts active divisors',()=>{
  const s=room();assert.deepEqual(timeoutInactivePlayers(s,40000),[]);
  assert.deepEqual(timeoutInactivePlayers(s,40001),['0']);
  assert.equal(s.players.size,3);
  const down=s.players.get('0');assert.equal(down.timedOut,true);assert.equal(down.hp,150);assert.equal(down.maxHp,300);
  assert.equal(s.teamHealth.hp,100);assert.equal(s.teamHealth.maxHp,200);
  assert.equal(s.boss.hp,120);assert.equal(s.boss.maxHp,200);
  const results=engine.leaderboard(s);
  assert.equal(results.find(entry=>entry.code==='0').retreated,true);
  assert.equal(results.find(entry=>entry.code==='1').retreated,false);
  for(const player of [...s.players.values()].filter(p=>!p.timedOut)) {
    assert.equal(player.hp,150);assert.equal(player.maxHp,300);assert.equal(player.typing.combatDivisor,2);assert.equal(player.typing.balancedGuard,30);
  }
});
test('retreated players cannot return or restore either side HP by typing',()=>{
  const s=room(),down=s.players.get('0');timeoutInactivePlayers(s,40001);
  changePlayerHealth(s,s.players.get('1'),-40);s.boss.hp=80;
  for(const now of [45000,45001,60000])assert.equal(recordTypingActivity(s,down,now),false);
  assert.equal(down.timedOut,true);assert.equal(s.teamHealth.hp,60);assert.equal(s.teamHealth.maxHp,200);
  assert.equal(s.boss.hp,80);assert.equal(s.boss.maxHp,200);
  assert.equal(s.players.get('1').typing.combatDivisor,2);
});
test('actual attack power scales with non-timeout players in standard and balanced combat',()=>{
  function power(player,balanced) {
    const state={...createTypingState(17,'barbarian'),combatDivisor:player.typing.combatDivisor};
    if(balanced)rules.initializeBalanced(state);
    for(let index=0;index<10;index++) {
      const word=rules.typingWord(state);
      const text=word.text+(rules.requiresWordSpace(state,word.text)?' ':'');
      const gaps=Array(text.length-(state.wordsInAttack===0?1:0)).fill(150);
      rules.finishWord(state,text,gaps.length,gaps.length*150,gaps.length*150*150,state.wordsInAttack?150:undefined,gaps);
    }
    return rules.releaseAttack(state,()=>1).power;
  }
  for(const balanced of [false,true]) {
    const s=room(),player=s.players.get('2');
    s.typingHost.combatDivisor=1;
    const three=power(player,balanced);
    timeoutInactivePlayers(s,40001);
    assert.ok(Math.abs(power(player,balanced)-three*3/2)<1e-10);
    s.players.get('1').lastTypingAt=10000;
    timeoutInactivePlayers(s,40002);
    assert.ok(Math.abs(power(player,balanced)-three*3)<1e-10);
    recordTypingActivity(s,s.players.get('0'),45000);
    assert.ok(Math.abs(power(player,balanced)-three*3)<1e-10);
    recordTypingActivity(s,s.players.get('1'),45001);
    assert.ok(Math.abs(power(player,balanced)-three*3)<1e-10);
    assert.equal(s.typingHost.combatDivisor,1,'boss power is not divided by the player count');
  }
});
test('typing and stale input cannot bypass a permanent retreat',()=>{
  const s=room(),player=s.players.get('0');player.lastSeenAt=999999;
  timeoutInactivePlayers(s,40001);assert.equal(player.timedOut,true);
  assert.throws(()=>engine.submitWords(s,{role:'player',actorCode:'0'},[],{}),/retreated/);
  assert.equal(player.timedOut,true);
  assert.equal(recordTypingActivity(s,player,41000),false);assert.equal(player.timedOut,true);
  player.lastTypingAt=10000;
  assert.equal(recordTypingActivity(s,player,41001),false);assert.equal(s.teamHealth.hp,100);
});
test('countdown and forced prone downtime do not count as inactivity',()=>{
  const s=room();s.countdownEndsAt=50000;
  assert.deepEqual(timeoutInactivePlayers(s,49999),[]);
  s.countdownEndsAt=10000;s.players.get('0').proneUntil=40000;
  assert.deepEqual(timeoutInactivePlayers(s,40001),[]);
});
test('multiple timeouts retain independent shares and all players timing out awards the boss victory',()=>{
  const s=room();s.players.get('1').lastTypingAt=10000;
  assert.deepEqual(timeoutInactivePlayers(s,40001),['0','1']);
  assert.equal(s.teamHealth.hp,50);assert.equal(s.teamHealth.maxHp,100);
  assert.deepEqual(timeoutInactivePlayers(s,70001),['2']);assert.equal(s.status,'defeat');
  assert.equal(s.players.size,3);assert.equal(s.teamHealth.hp,0);
  assert.equal(recordTypingActivity(s,s.players.get('0'),70002),false,'the finished round cannot be revived');
});
test('individual mode cannot restore a retreated player',()=>{
  const s=room(false),player=s.players.get('0');s.players.get('1').hp=40;
  timeoutInactivePlayers(s,40001);
  assert.equal(player.hp,150);assert.equal(s.players.get('1').hp,40);assert.equal(s.boss.hp,120);
  recordTypingActivity(s,player,41000);
  assert.equal(player.hp,150);assert.equal(s.players.get('1').hp,40);assert.equal(s.boss.hp,120);
});
test('timeout produces a KO patch instead of roster deletion and cancels pending attacks',()=>{
  const s=room();s.projectiles=[{id:'shot',source:'0',target:'boss',amount:30,resolvedAt:null}];
  const previous=structuredClone({players:[...s.players.values()],boss:s.boss,projectiles:s.projectiles});
  timeoutInactivePlayers(s,40001);
  const patch=engine.diffSnapshot(previous,{players:[...s.players.values()],boss:s.boss,projectiles:s.projectiles});
  assert.equal(patch.removePlayers,undefined);assert.equal(patch.players.find(p=>p.code==='0').timedOut,true);
  assert.equal(s.projectiles[0].amount,0);
});
test('dragon and Kraken attacks never target timeout KOs, and healing cannot change their retained HP',()=>{
  for(const id of ['infernalDragon','kraken']) {
    const s=room();s.boss.id=id;s.balanced=true;s.bossAttackIndex=9;
    timeoutInactivePlayers(s,40001);
    engine.launchAttack(s,s.typingHost,{power:30,multiplier:1,moveId:'weak'},{schedule(){},broadcast(){},random:()=>0});
    assert.ok(s.projectiles.length>0);assert.ok(s.projectiles.every(shot=>shot.target!=='0'));
    const down=s.players.get('0');assert.equal(changePlayerHealth(s,down,20),0);assert.equal(down.hp,150);
  }
});
