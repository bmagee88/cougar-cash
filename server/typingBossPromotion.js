const crypto=require('node:crypto');
const {validPromotionLevel,promotionLevel,promotionDamageMultiplier}=require('../src/TypingBoss/promotionRules');
const configured=secret=>typeof secret==='string' && secret.trim().length>0;
const signature=(nonce,secret)=>crypto.createHmac('sha256',secret).update(`typing-boss-device-promotion:v1:${nonce}`).digest('hex');
function issuePromotionToken(secret=process.env.TYPING_BOSS_CREATION_PASSWORD,level=1) {
  if(!configured(secret))throw new Error('Room creation password is not configured.');
  if(!validPromotionLevel(level))throw new Error('Choose Normal, Promoted or Double Promoted.');
  const nonce=crypto.randomBytes(16).toString('hex');
  if(level===1)return `v1.${nonce}.${signature(nonce,secret)}`;
  const mac=crypto.createHmac('sha256',secret).update(`typing-boss-device-promotion:v2:${level}:${nonce}`).digest('hex');
  return `v2.${level}.${nonce}.${mac}`;
}
function promotionLevelFromToken(token,secret=process.env.TYPING_BOSS_CREATION_PASSWORD) {
  if(!configured(secret) || typeof token!=='string')return null;
  if(/^v1\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(token)) {
    const [,nonce,mac]=token.split('.');return crypto.timingSafeEqual(Buffer.from(mac,'hex'),Buffer.from(signature(nonce,secret),'hex'))?1:null;
  }
  if(!/^v2\.[012]\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(token))return null;
  const [,rawLevel,nonce,mac]=token.split('.'),level=Number(rawLevel);
  const expected=crypto.createHmac('sha256',secret).update(`typing-boss-device-promotion:v2:${level}:${nonce}`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(mac,'hex'),Buffer.from(expected,'hex'))?level:null;
}
const verifyPromotionToken=(token,secret=process.env.TYPING_BOSS_CREATION_PASSWORD)=>promotionLevelFromToken(token,secret)!==null;
const bossContributions=session=>[...session.players.values()].filter(p=>!p.timedOut).reduce((sum,p)=>sum+promotionDamageMultiplier(p),0);
function promotePlayer(session,player) {
  return setPlayerPromotion(session,player,true);
}
function setPlayerPromotion(session,player,promotion) {
  if(session.mode!=='proportional' || !['setup','active'].includes(session.status))throw new Error('Promotion is available in an open Host vs. Players battle.');
  const level=typeof promotion==='boolean'?(promotion?1:0):promotion;
  if(!validPromotionLevel(level))throw new Error('Choose Normal, Promoted or Double Promoted.');
  if(promotionLevel(player)===level)return false;
  const previousContribution=promotionDamageMultiplier(player);
  player.promotionLevel=level;player.typing.promotionLevel=level;
  player.promoted=level===1;player.typing.promoted=level===1;
  const delta=promotionDamageMultiplier(player)-previousContribution;
  const contribution=100*(session.hpMultiplier || 1);
  if(!session.teamMode && !player.timedOut) {
    if(session.status==='setup')session.boss.hp=session.boss.maxHp=contribution*bossContributions(session);
    else if(delta>0) {session.boss.hp+=contribution*delta;session.boss.maxHp+=contribution*delta;}
    else if(delta<0) {
      const maxHp=contribution*bossContributions(session);
      session.boss.hp*=maxHp/session.boss.maxHp;
      session.boss.maxHp=maxHp;
    }
  }
  if(session.balanced)session.typingHost.balancedGuardMax=session.boss.maxHp;
  return true;
}
function promotedAttack(player,attack) {
  if(promotionDamageMultiplier(player)!==2)return attack;
  const result={...attack,power:attack.power*2,promotionMultiplier:2,moveId:'strong'};
  // Healing and support were resolved before this offensive conversion.
  for(const key of ['base','earnedPower','orangePower','criticalPower'])if(typeof attack[key]==='number')result[key]=attack[key]*2;
  return result;
}
module.exports={issuePromotionToken,verifyPromotionToken,promotionLevelFromToken,bossContributions,promotePlayer,setPlayerPromotion,promotedAttack};
