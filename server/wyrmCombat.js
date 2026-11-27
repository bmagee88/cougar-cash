const crypto=require('node:crypto');
const {WYRM_ACTIONS,CONSUME_MS,CONSUME_TICK_MS}=require('../src/TypingBoss/wyrmRules');
const {weightedTargetIndex,loseSummon}=require('./typingBossSummons');
const {changePlayerHealth}=require('./typingBossHealth');
const {knockOutMany}=require('./typingBossRecovery');
const {finishTimedBattle}=require('./typingBossLifecycle');
const {clearDragonCombat}=require('./dragonCombat');
const {proportionalPlayerPoint}=require('../src/TypingBoss/proportionalRules');
const invulnerable=(session,now=Date.now())=>session.boss.id==='giantSandWyrm' && (session.boss.wyrmBurrowed || (session.boss.wyrmAction?.kind==='overrun' && now<session.boss.wyrmAction.until));
function discardIncoming(session,now=Date.now()) {
  for(const shot of session.projectiles)if(shot.target==='boss' && shot.kind==='damage' && !shot.resolvedAt)Object.assign(shot,{resolvedAt:now,amount:0,willHit:false,evadeType:null});
}
function plan(session,attack,random) {
  const living=[...session.players.values()].filter(p=>p.hp>0 && !p.timedOut && !(p.consumedUntil>Date.now()));
  const step=session.bossAttackIndex || 0;
  let kind;
  if(session.boss.wyrmBurrowed){kind='consume';session.boss.wyrmBurrowed=false;}
  else if(attack.gold){kind='burrow';session.boss.wyrmBurrowed=true;}
  else {kind=['wyrmBite','slam','overrun'][step%3];session.bossAttackIndex=step+1;}
  const anchor=living[weightedTargetIndex(living,random,session.balanced?step:undefined)];
  const roster=[...session.players.values()];
  const point=p=>proportionalPlayerPoint(roster.indexOf(p),roster.length);
  const distance=p=>{const a=point(anchor),b=point(p);return (a.x-b.x)**2+(a.y-b.y)**2;};
  const targets=kind==='burrow'?[]:kind==='overrun'?living:kind==='slam' && anchor?
    [anchor,...living.filter(p=>p!==anchor).sort((a,b)=>distance(a)-distance(b)).slice(0,Math.max(1,Math.ceil(living.length*.3)-1))]:anchor?[anchor]:[];
  return {kind,targets};
}
function beginAction(session,kind,targets,{schedule,broadcast},now=Date.now()) {
  const config=WYRM_ACTIONS[kind];
  const action={id:crypto.randomBytes(8).toString('hex'),kind,at:now,until:now+config.duration,targetCode:targets[0]?.code};
  session.boss.wyrmAction=action;
  if(invulnerable(session,now))discardIncoming(session,now);
  schedule(session,()=>{if(session.boss.wyrmAction!==action)return;session.boss.wyrmAction=null;if(session.status==='active')broadcast(session);},config.duration);
  return action;
}
function consume(session,player,power,callbacks,now=Date.now()) {
  const {schedule,broadcast}=callbacks,id=crypto.randomBytes(8).toString('hex');
  player.consumeId=id;player.consumedAt=now;player.consumedUntil=now+CONSUME_MS;player.spitOutAt=null;
  const attackNumber=session.boss.turnsTaken || 0;
  for(let tick=1;tick<=10;tick++)schedule(session,()=>{
    if(finishTimedBattle(session)){broadcast(session);return;}
    if(session.status!=='active' || session.players.get(player.code)!==player || player.timedOut || player.consumeId!==id)return;
    const before=player.hp,amount=-changePlayerHealth(session,player,-power/10);
    player.typing.totalTaken+=amount;session.boss.totalDamage=(session.boss.totalDamage || 0)+amount;
    if(amount>0){player.bossHitsTaken++;if(session.teamMode && player.classId==='necromancer')loseSummon(player);}
    session.projectiles.push({id:`${id}:${tick}`,source:'boss',sourceName:session.boss.name,target:player.code,kind:'boss',bossId:'giantSandWyrm',moveLabel:'Consume',consumeTick:true,
      startedAt:Date.now(),impactAt:Date.now(),resolvedAt:Date.now(),amount,willHit:true});
    if(before>0 && player.hp<=0)knockOutMany(session,[player]);
    const previous=session.boss.strongestAttack;
    if(!previous || power>previous.power)session.boss.strongestAttack={base:power,power,multiplier:1,actualDamage:amount,attackNumber,landedAt:Date.now(),moveId:'special'};
    else if(previous.attackNumber===attackNumber)previous.actualDamage+=amount;
    if(tick===10){player.consumedUntil=null;player.consumedAt=null;player.consumeId=null;player.spitOutAt=Date.now();session.boss.wyrmSpitAt=Date.now();
      if(!session.boss.wyrmBurrowed && !invulnerable(session))beginAction(session,'spitOut',[player],callbacks);}
    if(session.teamMode && session.teamHealth.hp<=0){session.status='defeat';session.closedAt=Date.now();clearDragonCombat(session);}
    broadcast(session);
  },tick*CONSUME_TICK_MS);
}
module.exports={plan,beginAction,consume,invulnerable,discardIncoming};
