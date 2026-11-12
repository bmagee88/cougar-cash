const assert=require('node:assert/strict'),{setTimeout:delay}=require('node:timers/promises');
const r=require('../src/TypingBoss/proportionalRules');
const base=process.env.TYPING_BOSS_TEST_URL || 'http://127.0.0.1:4002/api/typing-boss/sessions';
async function request(path,body){
  const response=await fetch(base+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json();assert.ok(response.ok,data.error);return data;
}
function records(snapshot,one=false){
  const state={...snapshot},batch=[];
  do {
    const text=r.typingWord(state).text+(r.requiresWordSpace(state,r.typingWord(state).text)?' ':''),n=text.length-(state.wordsInAttack===0?1:0),gaps=Array(n).fill(150);
    const rec=[state.nextWord,text,n,n*150,n*22500,state.wordsInAttack?150:null,gaps];batch.push(rec);
    r.finishWord(state,text,n,rec[3],rec[4],rec[5]??undefined,gaps);
    if(one)break;
  }while(state.wordsInAttack<r.attackWordLimit(state));
  return batch;
}
(async()=>{
  let game;
  try {
    game=await request('',{creationPassword:process.env.TYPING_BOSS_CREATION_PASSWORD || 'sheep',mode:'proportional',name:'Cleric healing check'});
    const id=game.sessionId,player=await request(`/${id}/participants`,{name:'TestCleric',classId:'cleric'});
    const started=await request(`/${id}/start`,{hostToken:game.hostToken,balanced:true,balancedRandomColors:false,hpMultiplier:10});
    const startedAt=started.session.countdownEndsAt || started.session.serverNow;
    await delay(Math.max(0,startedAt-Date.now()+20));
    const hostPath=`/${id}?hostToken=${game.hostToken}`,playerPath=`/${id}?code=${player.code}`;
    let state=(await request(playerPath)).session;
    await request(`/${id}/words`,{code:player.code,words:records(state.typing,true)});
    state=(await request(playerPath)).session;
    assert.ok(state.clericHealingPool>0,'Orange deposits immediately');
    assert.equal(state.typing.balancedHealingBank,0);assert.equal(state.typing.balancedOrangePower,0);
    const host=(await request(hostPath)).session;
    const hostRecords=records(host.typing),hostTotal=hostRecords.reduce((sum,rec)=>sum+rec[1].length,0);
    await delay(Math.max(0,(hostTotal-60)/.03+200-(Date.now()-startedAt)));
    await request(`/${id}/words`,{hostToken:game.hostToken,words:hostRecords});
    const launched=(await request(hostPath)).session.projectiles.find(p=>p.source==='boss');
    assert.ok(launched);
    await delay(Math.max(0,launched.impactAt-Date.now()+30));
    state=(await request(playerPath)).session;
    const damage=1000-state.players[0].hp;
    assert.ok(damage>0);assert.ok(Math.abs(state.clericHealingAllowance-damage/2)<.02);
    let heal;
    for(let run=0;run<12 && !heal;run++) {
      state=(await request(playerPath)).session;
      const batch=records(state.typing),total=state.typing.totalCharacters+batch.reduce((sum,rec)=>sum+rec[1].length,0);
      const elapsed=Date.now()-startedAt;
      await delay(Math.max(0,(total-60)/.03+200-elapsed));
      await request(`/${id}/words`,{code:player.code,words:batch});
      state=(await request(playerPath)).session;
      heal=state.projectiles.find(p=>p.kind==='heal' && p.source===player.code);
    }
    assert.ok(heal && heal.amount>0,'Gold heals through the live API');
    assert.ok(heal.amount<=damage/2+.02);
    assert.ok(state.clericHealingPool>=0);
    console.log(JSON.stringify({orangeDepositedImmediately:true,baseDamagePreserved:state.players[0].totalDamage>0,bossDamage:damage,
      healed:heal.amount,remainingPool:state.clericHealingPool,remainingAllowance:state.clericHealingAllowance},null,2));
  }finally{if(game)await request(`/${game.sessionId}/close`,{hostToken:game.hostToken});}
})().catch(error=>{console.error(error);process.exitCode=1;});
