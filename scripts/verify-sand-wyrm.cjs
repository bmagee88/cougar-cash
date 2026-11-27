// Run with node --env-file-if-exists=.env.local scripts/verify-sand-wyrm.cjs.
// Uses a disposable room; no credentials are printed or saved.
const assert=require('node:assert/strict');
const {setTimeout:delay}=require('node:timers/promises');
const base=process.env.TYPING_BOSS_TEST_URL || 'http://localhost:4000/api/typing-boss/sessions';
async function request(path,body,status=200){
  const response=await fetch(base+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
  const value=await response.json();assert.equal(response.status,status,value.error);return value;
}
(async()=>{
  let room;
  try {
    room=await request('',{name:'Disposable Sand Wyrm verification',mode:'proportional',bossId:'giantSandWyrm',goldWords:true,creationPassword:process.env.TYPING_BOSS_CREATION_PASSWORD},201);
    assert.equal(room.session.boss.id,'giantSandWyrm');assert.equal(room.session.typing.ability,'wyrm');
    const player=await request(`/${room.sessionId}/participants`,{name:'Test Hero',classId:'paladin',goldWords:true},201);
    const started=await request(`/${room.sessionId}/start`,{hostToken:room.hostToken,balanced:true,balancedRandomColors:false,networkMode:'wan',timeLimitSeconds:null});
    assert.equal(started.session.typing.ability,'wyrm');assert.equal(started.session.networkMode,'wan');
    await delay(Math.max(0,started.session.countdownEndsAt-Date.now()+40));
    const current=(await request(`/${room.sessionId}?hostToken=${room.hostToken}`)).session;
    const word=current.typing.issuedWords.find(word=>word.index===current.typing.nextWord),count=word.text.length-1;
    await delay(Math.max(1500,count*100+200));
    const submitted=await request(`/${room.sessionId}/words`,{hostToken:room.hostToken,words:[[0,word.text,count,count*100,count*10000,null,Array(count).fill(100),{ticket:word.ticket,mistakes:0}]]});
    assert.equal(submitted.nextWord,1);
    const own=(await request(`/${room.sessionId}?playerToken=${player.playerToken}`)).session;
    assert.equal(own.boss.id,'giantSandWyrm');assert.equal(own.players[0].maxHp,100);
    assert.equal(own.players[0].consumedUntil,null);
    console.log(JSON.stringify({bossRegistration:'passed',hostAbility:'wyrm',privateWordProtocol:'passed',countdown:'passed',playerSnapshot:'passed',networkMusicPolicy:'wan'}));
  }finally{if(room)await request(`/${room.sessionId}/close`,{hostToken:room.hostToken});}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
