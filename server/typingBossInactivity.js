const {teamStartingHp}=require('../src/TypingBoss/battleRules');
const {bossContributions}=require('./typingBossPromotion');
const {syncTeamHealth,activePlayers}=require('./typingBossHealth');

function activitySince(session,player) {
  return Math.max(session.countdownEndsAt || session.startedAt || 0,player.lastTypingAt || 0,player.proneUntil || 0);
}
function scaleDefense(state,ratio,maxHp) {
  if(!state)return;
  if(state.balancedGuard!==undefined)state.balancedGuard*=ratio;
  if(state.paladinShield!==undefined)state.paladinShield*=ratio;
  if(state.balancedGuardMax!==undefined)state.balancedGuardMax=maxHp;
}
function adjustHealth(session,teamHp) {
  const active=activePlayers(session),count=active.length;
  if(!count)return;
  const maxHp=session.teamMode?teamStartingHp(count,session.hpMultiplier || 1):100*(session.hpMultiplier || 1)*bossContributions(session);
  const bossRatio=maxHp/session.boss.maxHp;
  session.boss.hp*=bossRatio;session.boss.maxHp=maxHp;
  scaleDefense(session.typingHost,bossRatio,maxHp);
  if(session.teamMode) {
    session.teamHealth={hp:Math.min(maxHp,teamHp),maxHp};
    syncTeamHealth(session);
  }
  for(const player of active)player.typing.combatDivisor=count;
}
function timeoutInactivePlayers(session,now=Date.now()) {
  if(session.mode!=='proportional' || session.status!=='active' || now<(session.countdownEndsAt || 0))return [];
  const active=activePlayers(session);
  const timedOut=active.filter(player=>now-activitySince(session,player)>30000);
  if(!timedOut.length)return [];
  const share=session.teamMode?session.teamHealth.hp/active.length:0;
  for(const player of timedOut) {
    // Keep the roster entry for results, but retreat is permanent for this battle.
    player.timedOut=true;player.proneUntil=null;
  }
  if(timedOut.length===active.length) {
    if(session.teamMode)session.teamHealth={hp:0,maxHp:0};
    session.status='defeat';session.closedAt=now;
  } else adjustHealth(session,session.teamMode?session.teamHealth.hp-share*timedOut.length:0);
  const codes=timedOut.map(player=>player.code);
  for(const shot of session.projectiles)if(!shot.resolvedAt && (codes.includes(shot.source)||codes.includes(shot.target))) {
    Object.assign(shot,{resolvedAt:now,amount:0,willHit:false});
  }
  return codes;
}
function recordTypingActivity(session,player,now=Date.now()) {
  if(session.status!=='active' || !player || session.players.get(player.code)!==player || now<(session.countdownEndsAt || 0))return false;
  if(!player.timedOut && now-activitySince(session,player)>30000)timeoutInactivePlayers(session,now);
  if(session.status!=='active' || player.timedOut)return false;
  player.lastTypingAt=now;
  return true;
}
module.exports={activitySince,recordTypingActivity,timeoutInactivePlayers};
