const {test}=require('node:test'),assert=require('node:assert/strict');
const {studentView,overviewFor,queueStudentSummary}=require('./typingBossAudience');
function scene() {
  return {status:'active',mode:'proportional',boss:{hp:1000,maxHp:1000,hurt:{id:'remote-hit'},flameBreath:{id:'remote-flame'},queuedAttacks:2,profile:{balancedGuard:10}},
    players:[{code:'me',hp:100,totalDamage:0,totalHealing:0,attackProgress:10},{code:'ally',hp:100,totalDamage:0,totalHealing:0,attackProgress:80}],
    projectiles:[{id:'mine',source:'me',target:'boss'},{id:'remote',source:'ally',target:'boss'},
      {id:'incoming',source:'boss',target:'me'},{id:'other-target',source:'boss',target:'ally'},
      {id:'outgoing-heal',source:'me',target:'ally'},{id:'incoming-heal',source:'ally',target:'me'}],typing:{seed:0}};
}
test('student views include only personal combat and never global boss body reactions',()=>{
  const full=scene(),copy=structuredClone(full),view=studentView(full,'me').snapshot;
  assert.deepEqual(view.projectiles.map(p=>p.id),['mine','incoming','outgoing-heal','incoming-heal']);
  assert.equal(view.boss.hurt,undefined);assert.equal(view.boss.flameBreath,undefined);assert.equal(view.boss.queuedAttacks,undefined);
  assert.equal(view.players[0].attackProgress,10);assert.equal(view.players[1].attackProgress,undefined);
  assert.equal(view.battleView,'personal');assert.equal(view.typing,full.typing);
  assert.deepEqual(full,copy,'projection never mutates simulation/host data');
});
test('remote progress does not produce patches; team health waits for the next summary boundary',()=>{
  const cache={},full=scene();studentView(full,'me',cache,1100);
  const progress=structuredClone(full);progress.players[1].attackProgress=99;
  const unchanged=studentView(progress,'me',cache,1200);
  assert.equal(unchanged.pendingUntil,undefined);
  const damage=structuredClone(progress);damage.players[1].hp=50;damage.players[1].totalDamage=40;damage.boss.hp=960;
  const pending=studentView(damage,'me',cache,1300);
  assert.equal(pending.snapshot.boss.hp,1000);assert.equal(pending.snapshot.players[1].hp,100);
  assert.equal(pending.pendingUntil,2000);
  const next=studentView(damage,'me',cache,2000).snapshot;
  assert.equal(next.boss.hp,960);assert.equal(next.players[1].hp,50);assert.equal(next.teamActivity.damage,40);
});
test('own HP, defense and impacts are immediate; final results flush complete latest stats',()=>{
  const cache={},full=scene();studentView(full,'me',cache,1100);
  const update=structuredClone(full);update.players[0].hp=60;update.typing={balancedGuard:0};update.boss.hp=950;
  update.projectiles[0].resolvedAt=1200;update.projectiles[0].amount=50;
  const own=studentView(update,'me',cache,1200).snapshot;
  assert.equal(own.boss.hp,950);assert.equal(own.players[0].hp,60);assert.equal(own.typing.balancedGuard,0);
  update.status='victory';update.boss.hp=0;update.players[1].hp=25;update.leaderboard=[{code:'ally',totalDamage:950}];
  const final=studentView(update,'me',cache,1300).snapshot;
  assert.equal(final.boss.hp,0);assert.equal(final.players[1].hp,25);assert.equal(final.leaderboard,update.leaderboard);
});
test('revivals update the quiet overview and team cues exclude the viewer own contributions',()=>{
  const cache={},full=scene();full.players[1].hp=0;full.players[1].defeated=true;studentView(full,'me',cache,1100);
  const update=structuredClone(full);update.players[0].totalDamage=300;update.players[1].hp=40;update.players[1].defeated=false;update.players[1].totalResurrections=1;
  const view=studentView(update,'me',cache,2000).snapshot;
  assert.equal(view.players[1].defeated,false);assert.deepEqual(view.teamActivity,{damage:0,healing:0,revives:1});
});
test('pending team updates share one trailing timer and never schedule after completion',()=>{
  const session={status:'active'},scheduled=[];let sends=0;
  const schedule=(_s,fn,ms)=>{const timer={fn,ms};scheduled.push(timer);return timer;};
  for(let i=0;i<30;i++)queueStudentSummary(session,Date.now()+1000,()=>sends++,schedule);
  assert.equal(scheduled.length,1);scheduled[0].fn();assert.equal(sends,1);assert.equal(session.studentSummaryTimer,null);
  session.status='victory';queueStudentSummary(session,Date.now()+1000,()=>sends++,schedule);assert.equal(scheduled.length,1);
  assert.equal(overviewFor(scene()).players[1].attackProgress,undefined);
});
