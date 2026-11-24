// Slots survive death so a later special brings back the same zombie.
const livingSummons = player => (player.summons || []).filter(summon => summon.alive);
function summonZombie(player, now=Date.now()) {
  const summons=player.summons || [];
  const dead=summons.find(summon=>!summon.alive);
  if(!dead && summons.length>=3)return null;
  const slot=dead?.slot ?? summons.length;
  const summon={slot,alive:true,changedAt:now,event:dead?'resurrection':'spawn'};
  player.summons=dead?summons.map(item=>item.slot===slot?summon:item):[...summons,summon];
  return summon;
}
function loseSummon(player, now=Date.now()) {
  const summon=livingSummons(player).at(-1);
  if(!summon)return null;
  player.summons=player.summons.map(item=>item.slot===summon.slot?{...item,alive:false,changedAt:now,event:'death'}:item);
  return summon;
}
function prepareSummonWords(session,player) {
  if(!session.teamMode || player.classId!=='necromancer') {
    delete player.typing.summonPrefix;delete player.typing.summonWaiting;
    return;
  }
  player.typing.summonPrefix=livingSummons(player).map(summon=>summon.slot);
  player.typing.summonWaiting=false;
}
const targetWeight=player=>1+livingSummons(player).length;
function weightedTargetIndex(players, random=Math.random, step) {
  const total=players.reduce((sum,player)=>sum+targetWeight(player),0);
  let ticket=step===undefined?Math.min(total-1,Math.floor(random()*total)):step%total;
  for(let index=0;index<players.length;index++) {
    ticket-=targetWeight(players[index]);
    if(ticket<0)return index;
  }
  return -1;
}
module.exports={livingSummons,summonZombie,loseSummon,prepareSummonWords,targetWeight,weightedTargetIndex};
