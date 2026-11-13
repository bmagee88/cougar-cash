const {isDeepStrictEqual}=require('node:util');
const SUMMARY_MS=1000;
const isPersonal=(shot,code)=>shot.source===code || shot.target===code;

function overviewFor(snapshot) {
  const {hurt,flameBreath,queuedAttacks,queuedStrongReactions,...boss}=snapshot.boss;
  const players=snapshot.players.map(({attackProgress,...player})=>player);
  // Word cursors, last-seen stamps and typing streaks are not team activity.
  const signature=JSON.stringify({boss:{hp:boss.hp,maxHp:boss.maxHp,profile:boss.profile,
    attackProgress:boss.attackProgress,attackCharacters:boss.attackCharacters},
    players:players.map(p=>[p.code,p.name,p.classId,p.hp,p.maxHp,p.defeated,p.totalDamage,p.totalTaken,p.totalHealing,p.totalResurrections])});
  return {boss,players,signature,roster:players.map(p=>p.code).join(':')};
}

function studentView(snapshot,code,cache={},now=Date.now(),candidate=overviewFor(snapshot)) {
  const bucket=Math.floor(now/SUMMARY_MS);
  const terminal=['victory','defeat','closed','expired'].includes(snapshot.status);
  const force=!cache.overview || cache.status!==snapshot.status || cache.overview.roster!==candidate.roster || terminal;
  const changed=cache.overview?.signature!==candidate.signature;
  let pendingUntil;
  if(force || (changed && bucket>cache.bucket)) {
    cache.overview=candidate;cache.bucket=bucket;cache.personalBoss=null;
  } else if(changed)pendingUntil=(bucket+1)*SUMMARY_MS;
  cache.status=snapshot.status;
  const projectiles=snapshot.projectiles.filter(shot=>isPersonal(shot,code));
  if(!isDeepStrictEqual(projectiles,cache.projectiles)) {
    // Personal impacts update the opponent's HP/defense immediately. Remote
    // impacts continue to use the throttled summary, never another hit sprite.
    cache.personalBoss=candidate.boss;
    cache.projectiles=projectiles;
  }
  const own=snapshot.players.find(player=>player.code===code);
  const teammates=cache.overview.players.filter(player=>player.code!==code);
  const total=key=>teammates.reduce((sum,player)=>sum+(player[key] || 0),0);
  return {pendingUntil,snapshot:{...snapshot,battleView:'personal',
    boss:cache.personalBoss || cache.overview.boss,
    players:cache.overview.players.map(player=>player.code===code ? own : player),
    projectiles,teamActivity:{damage:total('totalDamage'),healing:total('totalHealing'),revives:total('totalResurrections')},
  }};
}

function queueStudentSummary(session,dueAt,send,schedule) {
  if(session.studentSummaryTimer || session.status!=='active')return;
  session.studentSummaryTimer=schedule(session,()=>{
    session.studentSummaryTimer=null;send();
  },Math.max(1,dueAt-Date.now()));
}
module.exports={studentView,overviewFor,queueStudentSummary,SUMMARY_MS};
