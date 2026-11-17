const crypto=require('node:crypto');
const {KRAKEN_ANIMATIONS}=require('../src/TypingBoss/krakenAnimationRules');
const KINDS=['tentacleStrike','tentacleSweep','tidalWave'];
function plan(session,attack,random) {
  const living=[...session.players.values()].filter(p=>p.hp>0);
  const step=attack.krakenAttackIndex ?? session.bossAttackIndex ?? 0;
  const kind=KINDS[step%3];session.bossAttackIndex=step+1;
  if(kind==='tidalWave')return {kind,targets:living};
  const count=kind==='tentacleStrike'?1:Math.min(living.length,2+Math.min(6,Math.floor(random()*7)));
  // Rotating anchors in Balanced; shuffling the sweep avoids targeting roster prefixes.
  const pool=[...living],targets=[];
  if(pool.length)targets.push(pool.splice(session.balanced?step%pool.length:Math.min(pool.length-1,Math.floor(random()*pool.length)),1)[0]);
  while(targets.length<count && pool.length)targets.push(pool.splice(Math.min(pool.length-1,Math.floor(random()*pool.length)),1)[0]);
  return {kind,targets};
}
function prone(session,player,{schedule,broadcast},now=Date.now()) {
  player.proneUntil=now+5000;
  const deadline=player.proneUntil;
  schedule(session,()=>{if(player.proneUntil!==deadline)return;player.proneUntil=null;if(session.status==='active')broadcast(session);},5000);
}
function curse(session,players,{schedule,broadcast,random=Math.random},now=Date.now()) {
  const duration=KRAKEN_ANIMATIONS.special.duration;
  const cast={id:crypto.randomBytes(8).toString('hex'),at:now,until:now+duration};session.boss.krakenCast=cast;
  schedule(session,()=>{if(session.boss.krakenCast===cast){session.boss.krakenCast=null;if(session.status==='active')broadcast(session);}},duration);
  for(const player of players) {
    const id=cast.id+player.code,until=now+15000;
    player.curseId=id;player.curseUntil=until;player.curseKey=null;
    for(let offset=2000+Math.floor(random()*2001);offset<15000;offset+=2000+Math.floor(random()*2001)) {
      schedule(session,()=>{
        if(session.status!=='active' || session.players.get(player.code)!==player || player.hp<=0 || player.curseId!==id || Date.now()>=until)return;
        // A prone player cannot type, so skip forced input during the same lock.
        if(player.proneUntil>Date.now())return;
        // Cosmetic client progress cannot redirect the curse to a safer word.
        const index=player.typing.nextWord;
        // The client resolves the correct key at its live cursor when this pulse arrives.
        const key='';
        player.curseKey={id:crypto.randomBytes(8).toString('hex'),key,at:Date.now(),index};
        broadcast(session);
      },offset);
    }
    schedule(session,()=>{if(player.curseId===id){player.curseUntil=null;player.curseKey=null;player.curseId=null;if(session.status==='active')broadcast(session);}},15000);
  }
}
module.exports={plan,prone,curse};
