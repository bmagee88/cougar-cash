const crypto = require('node:crypto');

// Missing backend configuration must never unlock room creation or fall back
// to a password embedded in the repository.
function checkCreationPassword(value,expected=process.env.TYPING_BOSS_CREATION_PASSWORD) {
  if(typeof expected!=='string' || !expected.trim())return null;
  if(typeof value!=='string')return false;
  const digest=text=>crypto.createHash('sha256').update(text).digest();
  return crypto.timingSafeEqual(digest(value),digest(expected));
}

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
module.exports={issuePlayerToken,playerForToken,checkCreationPassword};
