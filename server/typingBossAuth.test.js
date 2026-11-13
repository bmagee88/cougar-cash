const {test}=require('node:test'),assert=require('node:assert/strict');
const {issuePlayerToken,playerForToken}=require('./typingBossAuth');
test('private tokens are independent from public IDs and scoped to their room',()=>{
  const a=issuePlayerToken(),b=issuePlayerToken();
  const alice={code:'heroAAAA',tokenHash:a.hash},bob={code:'heroBBBB',tokenHash:b.hash};
  const room={players:new Map([[alice.code,alice],[bob.code,bob]])};
  assert.equal(a.token.length,64);assert.notEqual(a.token,a.hash);
  assert.equal(playerForToken(room,alice.code),null);
  assert.equal(playerForToken(room,a.hash),null);
  assert.equal(playerForToken(room,a.token),alice);assert.equal(playerForToken(room,b.token),bob);
  assert.equal(playerForToken({players:new Map([[bob.code,bob]])},a.token),null);
  assert.equal(playerForToken(room,'0'.repeat(64)),null);
});
