const crypto = require('node:crypto');

function issuePlayerToken() {
  const token=crypto.randomBytes(32).toString('hex');
  return {token,hash:crypto.createHash('sha256').update(token).digest('hex')};
}
function playerForToken(session,token) {
  if(typeof token!=='string' || !/^[a-f0-9]{64}$/.test(token))return null;
  const hash=crypto.createHash('sha256').update(token).digest();
  for(const player of session.players.values()) {
    if(typeof player.tokenHash==='string' && crypto.timingSafeEqual(hash,Buffer.from(player.tokenHash,'hex')))return player;
  }
  return null;
}
module.exports={issuePlayerToken,playerForToken};
