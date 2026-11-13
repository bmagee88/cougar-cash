const assert=require('node:assert/strict'),{setTimeout:delay}=require('node:timers/promises');
const r=require('../src/TypingBoss/proportionalRules');
const base=process.env.TYPING_BOSS_TEST_URL || 'http://127.0.0.1:4002/api/typing-boss/sessions';
async function call(path,body){const response=await fetch(base+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();assert.ok(response.ok,data.error);return data;}
(async()=>{let game;try{
  game=await call('',{creationPassword:process.env.TYPING_BOSS_CREATION_PASSWORD || 'sheep',mode:'proportional',name:'Color bank check'});
  const id=game.sessionId,player=await call(`/${id}/participants`,{name:'TestCleric',classId:'cleric'});
  const start=(await call(`/${id}/start`,{hostToken:game.hostToken,balanced:true,balancedRandomColors:false,hpMultiplier:10})).session;
  await delay(Math.max(0,start.countdownEndsAt-Date.now()+30));
  const path=`/${id}?code=${player.code}`;let snapshot=(await call(path)).session,blue=false,white=false;
  for(let run=0;run<50 && !white;run++) {
    const before=snapshot,state=before.typing,word=r.typingWord(state),text=word.text+(r.requiresWordSpace(state,word.text)?' ':''),n=text.length-(state.wordsInAttack===0?1:0),gaps=Array(n).fill(150);
    const total=state.totalCharacters+text.length;
    await delay(Math.max(0,(total-60)/.03+100-(Date.now()-start.countdownEndsAt)));
    await call(`/${id}/words`,{code:player.code,words:[[state.nextWord,text,n,n*150,n*22500,state.wordsInAttack?150:null,gaps]]});
    snapshot=(await call(path)).session;
    if(word.color==='orange') {
      assert.equal(snapshot.typing.characters,0);assert.equal(snapshot.typing.balancedPower,0);
      assert.ok(snapshot.clericHealingPool>before.clericHealingPool);
    }
    if(word.color==='blue') {
      assert.ok(snapshot.typing.balancedGuard>before.typing.balancedGuard);
      assert.equal(snapshot.typing.characters,0);assert.equal(snapshot.clericHealingPool,before.clericHealingPool);
      assert.equal(snapshot.typing.balancedCritCharge,0);
      assert.ok(!snapshot.projectiles.some(p=>p.source===player.code && p.kind==='damage'),'Block is available before any attack fires');
      blue=true;
    }
    if(word.color===null){
      assert.ok(snapshot.typing.characters>before.typing.characters || snapshot.typing.wordsInAttack===0);
      assert.equal(snapshot.clericHealingPool,before.clericHealingPool);
      assert.equal(snapshot.typing.balancedGuard,before.typing.balancedGuard);assert.equal(snapshot.typing.balancedCritCharge,0);white=true;
    }
  }
  assert.ok(blue && white);
  console.log(JSON.stringify({prayerOnlyYellow:true,blueBlockBeforeAttack:true,whiteBuildsAttackOnly:true,critDoesNotGrowOnOtherColors:true}));
}finally{if(game)await call(`/${game.sessionId}/close`,{hostToken:game.hostToken});}})().catch(error=>{console.error(error);process.exitCode=1;});
