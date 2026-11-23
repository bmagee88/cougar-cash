const crypto=require('node:crypto');
const configured=secret=>typeof secret==='string' && secret.trim().length>0;
const signature=(nonce,secret)=>crypto.createHmac('sha256',secret).update(`typing-boss-device-promotion:v1:${nonce}`).digest('hex');
function issuePromotionToken(secret=process.env.TYPING_BOSS_CREATION_PASSWORD) {
  if(!configured(secret))throw new Error('Room creation password is not configured.');
  const nonce=crypto.randomBytes(16).toString('hex');return `v1.${nonce}.${signature(nonce,secret)}`;
}
function verifyPromotionToken(token,secret=process.env.TYPING_BOSS_CREATION_PASSWORD) {
  if(!configured(secret) || typeof token!=='string' || !/^v1\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(token))return false;
  const [,nonce,mac]=token.split('.');return crypto.timingSafeEqual(Buffer.from(mac,'hex'),Buffer.from(signature(nonce,secret),'hex'));
}
const bossContributions=session=>[...session.players.values()].filter(p=>!p.timedOut).reduce((sum,p)=>sum+(p.promoted?2:1),0);
function promotePlayer(session,player) {
  return setPlayerPromotion(session,player,true);
}
function setPlayerPromotion(session,player,promoted) {
  if(session.mode!=='proportional' || !['setup','active'].includes(session.status))throw new Error('Promotion is available in an open Host vs. Players battle.');
  if(Boolean(player.promoted)===promoted)return false;
  player.promoted=promoted;player.typing.promoted=promoted;
  const contribution=100*(session.hpMultiplier || 1);
  if(!session.teamMode && !player.timedOut) {
    if(session.status==='setup')session.boss.hp=session.boss.maxHp=contribution*bossContributions(session);
    else if(promoted) {session.boss.hp+=contribution;session.boss.maxHp+=contribution;}
    else {
      const maxHp=contribution*bossContributions(session);
      session.boss.hp*=maxHp/session.boss.maxHp;
      session.boss.maxHp=maxHp;
    }
  }
  if(session.balanced)session.typingHost.balancedGuardMax=session.boss.maxHp;
  return true;
}
function promotedAttack(player,attack) {
  if(!player.promoted)return attack;
  const result={...attack,power:attack.power*2,promotionMultiplier:2,moveId:'strong'};
  // Healing and support were resolved before this offensive conversion.
  for(const key of ['base','earnedPower','orangePower','criticalPower'])if(typeof attack[key]==='number')result[key]=attack[key]*2;
  return result;
}
module.exports={issuePromotionToken,verifyPromotionToken,bossContributions,promotePlayer,setPlayerPromotion,promotedAttack};
