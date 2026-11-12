const assert=require('node:assert/strict'),{setTimeout:delay}=require('node:timers/promises');
const rules=require('../src/TypingBoss/proportionalRules');
const base=process.env.TYPING_BOSS_TEST_URL || 'http://127.0.0.1:4003/api/typing-boss/sessions';
async function call(path,body,status=200){
  const response=await fetch(base+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result=await response.json();assert.equal(response.status,status,result.error);return result;
}
(async()=>{
  for(const mode of ['proportional','old']) {
    let game;
    try {
      game=await call('',{name:'Countdown test',mode,creationPassword:process.env.TYPING_BOSS_CREATION_PASSWORD || 'sheep'},201);
      const id=game.sessionId,player=await call(`/${id}/participants`,{name:'TestFox',classId:'cleric'},201);
      const started=(await call(`/${id}/start`,{hostToken:game.hostToken,balanced:true,balancedRandomColors:false})).session;
      const deadline=started.countdownEndsAt;
      assert.ok(deadline-started.serverNow>4900 && deadline-started.serverNow<=5000);
      const client=(await call(`/${id}?code=${player.code}`)).session;
      assert.equal(client.countdownEndsAt,deadline);
      await call(`/${id}/start`,{hostToken:game.hostToken},409);
      let words;
      if(mode==='proportional') {
        const text=rules.typingWord(client.typing).text+' ',n=text.length-1,gaps=Array(n).fill(150);
        words=[[0,text,n,n*150,n*22500,null,gaps]];
        await call(`/${id}/words`,{code:player.code,words},400);
        assert.equal((await call(`/${id}?code=${player.code}`)).session.typing.nextWord,0);
      } else {
        await call(`/${id}/challenge`,{code:player.code,moveId:'weak'},409);
        assert.ok(started.boss.nextAttackAt>=deadline+started.boss.attackIntervalMs);
      }
      await delay(Math.max(0,deadline-Date.now()+30));
      if(words) {await call(`/${id}/words`,{code:player.code,words});assert.equal((await call(`/${id}?code=${player.code}`)).session.typing.nextWord,1);}
      else await call(`/${id}/challenge`,{code:player.code,moveId:'weak'},201);
      console.log(JSON.stringify({mode,sharedCountdown:true,earlyActionsRejected:true,repeatedStartRejected:true,actionsUnlockedAfterFiveSeconds:true}));
    }finally{if(game)await call(`/${game.sessionId}/close`,{hostToken:game.hostToken});}
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
