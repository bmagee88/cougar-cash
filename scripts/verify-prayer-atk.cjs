const assert=require('node:assert/strict'),{setTimeout:delay}=require('node:timers/promises');
const r=require('../src/TypingBoss/proportionalRules');
const base=process.env.TYPING_BOSS_TEST_URL || 'http://127.0.0.1:4002/api/typing-boss/sessions';
async function call(path,body){const res=await fetch(base+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await res.json();assert.ok(res.ok,data.error);return data;}
(async()=>{let game;try{
  game=await call('',{creationPassword:process.env.TYPING_BOSS_CREATION_PASSWORD || 'sheep',mode:'proportional',name:'Prayer ATK verification'});
  const id=game.sessionId,player=await call(`/${id}/participants`,{name:'TestCleric',classId:'cleric'});
  const start=(await call(`/${id}/start`,{hostToken:game.hostToken,balanced:true,balancedRandomColors:false})).session;
  await delay(Math.max(0,(start.countdownEndsAt || 0)-Date.now()+30));
  const before=(await call(`/${id}?code=${player.code}`)).session;
  assert.equal(r.typingWord(before.typing).color,'orange');
  const text=r.typingWord(before.typing).text+' ',n=text.length-1,gaps=Array(n).fill(150);
  await call(`/${id}/words`,{code:player.code,words:[[0,text,n,n*150,n*22500,null,gaps]]});
  const after=(await call(`/${id}?code=${player.code}`)).session;
  console.log(JSON.stringify({attackBefore:before.typing.characters,attackAfter:after.typing.characters,
    attackPower:after.typing.balancedPower,prayerPool:after.clericHealingPool,wordAcknowledged:after.typing.nextWord},null,2));
  assert.equal(after.typing.characters,before.typing.characters,'Running backend added ATK for a Prayer word');
  assert.equal(after.typing.balancedPower,before.typing.balancedPower,'Running backend added attack power for a Prayer word');
  assert.ok(after.clericHealingPool>before.clericHealingPool);
}finally{if(game)await call(`/${game.sessionId}/close`,{hostToken:game.hostToken});}})().catch(error=>{console.error(error.message);process.exitCode=1;});
