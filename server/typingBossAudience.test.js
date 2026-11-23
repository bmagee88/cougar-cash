const {test}=require('node:test'),assert=require('node:assert/strict');
const {studentView}=require('./typingBossAudience');
function scene() {
  return {status:'active',mode:'proportional',boss:{hp:1000,maxHp:1000,hurt:{id:'remote-hit'},flameBreath:{id:'remote-flame'},queuedAttacks:2,profile:{balancedGuard:10}},
    players:[{code:'me',hp:100,totalDamage:0,totalHealing:0,attackProgress:10},{code:'ally',hp:100,totalDamage:0,totalHealing:0,attackProgress:80}],
    projectiles:[{id:'mine',source:'me',target:'boss'},{id:'remote',source:'ally',target:'boss'},
      {id:'incoming',source:'boss',target:'me'},{id:'other-target',source:'boss',target:'ally'},
      {id:'outgoing-heal',source:'me',target:'ally'},{id:'incoming-heal',source:'ally',target:'me'}],typing:{seed:0}};
}
test('student views share every projectile and boss animation while retaining recipient typing',()=>{
  const full=scene(),copy=structuredClone(full),view=studentView(full,'me').snapshot;
  assert.deepEqual(view.projectiles,full.projectiles);
  assert.deepEqual(view.boss,full.boss);
  assert.equal(view.players[1].attackProgress,80);
  assert.equal(view.battleView,'full');assert.equal(view.typing,full.typing);
  assert.deepEqual(full,copy);
});
test('ally retreat, health and combat updates arrive immediately on every player view',()=>{
  const full=scene(),cache={};studentView(full,'me',cache,1100);
  full.players[1].timedOut=true;full.players[1].hp=50;full.boss.hp=960;
  const view=studentView(full,'me',cache,1200);
  assert.equal(view.pendingUntil,undefined);
  assert.equal(view.snapshot.players[1].timedOut,true);
  assert.equal(view.snapshot.players[1].hp,50);assert.equal(view.snapshot.boss.hp,960);
});
test('team cues exclude the viewer own contributions',()=>{
  const full=scene();full.players[0].totalDamage=300;full.players[1].totalDamage=40;full.players[1].totalResurrections=1;
  assert.deepEqual(studentView(full,'me').snapshot.teamActivity,{damage:40,healing:0,revives:1});
});
