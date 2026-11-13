// Local 31-client protocol, authentication, delivery and ending-results verifier.
const assert=require('node:assert/strict');
const {setTimeout:delay}=require('node:timers/promises');
const rules=require('../src/TypingBoss/proportionalRules');
const base=process.env.TYPING_BOSS_TEST_URL || 'http://127.0.0.1:4000/api/typing-boss/sessions';
const balanced=process.env.TYPING_BOSS_BALANCED==='1';
const scheduled=process.env.TYPING_BOSS_SCHEDULED==='1';
const streams=[],games=[];
async function request(path,body,expected=200) {
  const response=await fetch(base+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(path===''?{...body,creationPassword:process.env.TYPING_BOSS_CREATION_PASSWORD || 'sheep'}:body)});
  const result=await response.json();assert.equal(response.status,expected,result.error || path);return result;
}
const auth=player=>({code:player.code,playerToken:player.playerToken});
const query=credentials=>new URLSearchParams(credentials).toString();
async function stream(id,credentials) {
  const controller=new AbortController();
  const response=await fetch(`${base}/${id}/events?${query(credentials)}`,{signal:controller.signal});
  assert.equal(response.status,200);
  const stats={patches:[],snapshot:null,bytes:0,abort:()=>controller.abort()};streams.push(stats);
  (async()=>{
    let buffer='';
    try {for await(const chunk of response.body) {
      buffer+=Buffer.from(chunk).toString('utf8');let end;
      while((end=buffer.indexOf('\n\n'))>=0) {
        const event=buffer.slice(0,end);buffer=buffer.slice(end+2);
        const data=event.split('\n').find(line=>line.startsWith('data: '));if(!data)continue;
        const payload=JSON.parse(data.slice(6));
        assert.equal(payload.playerToken,undefined);assert.equal(payload.hostToken,undefined);
        assert.ok((payload.players || []).every(player=>!player.tokenHash && !player.playerToken && !player.typing));
        if(event.startsWith('event: session'))stats.snapshot=payload;
        if(event.startsWith('event: patch')){stats.patches.push(payload);stats.bytes+=Buffer.byteLength(event);}
      }
    }}catch(error){if(error.name!=='AbortError')throw error;}
  })();return stats;
}
function record(state,mistakes=1) {
  const word=rules.typingWord(state);assert.ok(word.ticket && word.text,'word must be issued');
  const text=word.text+(rules.requiresWordSpace(state,word.text)?' ':'');
  const count=text.length-(state.wordsInAttack===0?1:0),gap=40;
  const gaps=Array(count).fill(gap);if(state.wordsInAttack)gaps[0]=200;
  return [state.nextWord,text,count,gaps.reduce((a,b)=>a+b,0),gaps.reduce((a,b)=>a+b*b,0),state.wordsInAttack?200:null,state.balanced?gaps:null,{ticket:word.ticket,mistakes}];
}
async function completeWords(id,credentials,initial,countWords) {
  const state=structuredClone(initial);let last;
  for(let i=0;i<countWords;i++) {
    const rec=record(state);await delay(Math.max(180,rec[1].length*45));
    last=await request(`/${id}/words`,{...credentials,words:[rec]});
    rules.finishWord(state,rec[1],rec[2],rec[3],rec[4],rec[5]??undefined,rec[6],rec[7].mistakes);
    if(state.wordsInAttack===rules.attackWordLimit(state))rules.releaseAttack(state,()=>1);
    state.issuedWords=last.issuedWords;
    if(i===0) {
      const repeat=await request(`/${id}/words`,{...credentials,words:[rec]});assert.equal(repeat.nextWord,last.nextWord);
    }
  }
  return {state,last};
}
(async()=>{
  try {
    const game=await request('',{name:'Typing integrity verification',mode:'proportional',goldWords:true},201);games.push(game);
    const id=game.sessionId,participants=[];
    for(let i=0;i<30;i++)participants.push(await request(`/${id}/participants`,{name:`Test ${i}`,classId:'barbarian',goldWords:true},201));
    assert.ok(participants.every(p=>/^[a-f0-9]{64}$/.test(p.playerToken)));
    const a=participants[0],b=participants[1];
    await request(`/${id}?code=${a.code}`,undefined,401);
    await request(`/${id}/events?code=${a.code}`,undefined,401);
    await request(`/${id}/verify`,{code:a.code},401);
    await request(`/${id}/verify`,{playerToken:'0'.repeat(64)},401);
    await request(`/${id}/words`,{code:a.code,words:[]},401);
    await request(`/${id}/progress`,{code:a.code,wordIndex:0,characters:1},401);
    await request(`/${id}?${query({code:b.code,playerToken:a.playerToken})}`,undefined,401);
    const verified=await request(`/${id}/verify`,{playerToken:a.playerToken});assert.equal(verified.code,a.code);
    const started=await request(`/${id}/start`,{hostToken:game.hostToken,hpMultiplier:1.5,balanced,balancedRandomColors:!scheduled});
    await delay(Math.max(0,started.session.countdownEndsAt-Date.now()+50));
    const snapshots=await Promise.all(participants.map(p=>request(`/${id}?${query(auth(p))}`)));
    snapshots.forEach((value,i)=>participants[i].session=value.session);
    for(const p of participants) {
      assert.equal(p.session.typing.seed,0);assert.equal(p.session.typing.issuedWords.length,2);
      assert.equal(rules.typingWord(p.session.typing,2).pending,true);
    }
    const host=await stream(id,{hostToken:game.hostToken});
    const clients=await Promise.all(participants.map(p=>stream(id,auth(p))));await delay(1000);
    const before=host.patches.length;
    await Promise.all(participants.map(p=>request(`/${id}/progress`,{...auth(p),wordIndex:0,characters:1})));
    await delay(500);assert.equal(host.patches.length-before,1);
    assert.ok(host.patches.slice(before).every(patch=>!patch.boss?.profile));
    const first=record(a.session.typing),bad=structuredClone(first);bad[1]='!'+bad[1].slice(1);
    await request(`/${id}/words`,{...auth(a),words:[bad]},400);
    const stolen=structuredClone(first);stolen[7].ticket=b.session.typing.issuedWords[0].ticket;
    await request(`/${id}/words`,{...auth(a),words:[stolen]},400);
    const future=structuredClone(first);future[0]=2;
    await request(`/${id}/words`,{...auth(a),words:[future]},400);
    const timing=structuredClone(first);timing[3]=0;timing[4]=0;if(timing[6])timing[6].fill(0);timing[5]=null;
    await request(`/${id}/words`,{...auth(a),words:[timing]},400);
    const check=await request(`/${id}?${query(auth(a))}`);assert.equal(check.session.typing.nextWord,0);
    const results=await Promise.all([
      completeWords(id,{hostToken:game.hostToken},started.session.typing,10),
      ...participants.map(p=>completeWords(id,auth(p),p.session.typing,10)),
    ]);
    await delay(2200);
    const final=(await request(`/${id}?hostToken=${game.hostToken}`)).session;
    assert.equal(final.battleView,'full');
    assert.equal(final.players.length,30);assert.ok(final.players.every(p=>p.turnsTaken===1));
    assert.ok(final.players.every(p=>p.totalDamage>0));
    assert.ok(final.projectiles.some(p=>p.source==='boss'));
    assert.equal(final.boss.strongestAttack,undefined);
    const playerResult=await request(`/${id}?${query(auth(a))}`);assert.equal(playerResult.session.typing.nextWord,10);
    assert.equal(playerResult.session.battleView,'personal');
    assert.ok(playerResult.session.projectiles.every(p=>p.source===a.code || p.target===a.code));
    assert.equal(playerResult.session.boss.hurt,undefined);assert.equal(playerResult.session.boss.flameBreath,undefined);
    assert.ok(playerResult.session.players.filter(p=>p.code!==a.code).every(p=>p.attackProgress===undefined));
    for(let i=0;i<clients.length;i++) {
      const code=participants[i].code;
      const personal=new Map();
      for(const patch of clients[i].patches)for(const shot of patch.projectiles || [])personal.set(shot.id,{...personal.get(shot.id),...shot});
      assert.ok([...personal.values()].every(p=>p.source===code || p.target===code),'student stream omits unrelated combat');
      assert.ok([...personal.values()].some(p=>p.source===code && p.target==='boss'),'own attack is delivered');
      assert.ok(clients[i].patches.some(patch=>patch.teamActivity?.damage>0),'compact team activity arrives');
    }
    const edited=record(a.session.typing);edited[7].mistakes=0;
    // Replays carrying an altered proof are rejected, not awarded again.
    await request(`/${id}/words`,{...auth(a),words:[edited]},400);
    const reconnected=await stream(id,auth(a));await delay(100);
    assert.equal(reconnected.snapshot.typing.nextWord,10);
    const closed=await request(`/${id}/close`,{hostToken:game.hostToken});await delay(400);
    assert.equal(closed.session.leaderboard.length,31);
    const boss=closed.session.leaderboard.find(e=>e.isBoss);assert.ok(boss.totalDamage>0 && boss.strongestAttack);
    assert.ok(clients.every(client=>client.patches.some(patch=>patch.leaderboard?.length===31)));
    const old=await request('',{name:'Old-mode token verification',mode:'old',bossId:'cindermaw'},201);games.push(old);
    const hero=await request(`/${old.sessionId}/participants`,{name:'Hero',classId:'cleric'},201);
    await request(`/${old.sessionId}/challenge`,{code:hero.code,moveId:'weak'},403);
    const oldStarted=await request(`/${old.sessionId}/start`,{hostToken:old.hostToken});
    await delay(Math.max(0,oldStarted.session.countdownEndsAt-Date.now()+20));
    const challenge=await request(`/${old.sessionId}/challenge`,{...auth(hero),moveId:'weak'},201);
    await request(`/${old.sessionId}/actions`,{...auth(hero),challengeId:challenge.challenge.id,answerText:challenge.challenge.answers[0],durationMs:5000,acceptedCharacters:20,mistakes:0},201);
    console.log(JSON.stringify({balanced,scheduled,clients:31,privateAuthentication:'passed',issuedWords:'passed',skipsAndStolenTickets:'rejected',forgedTiming:'rejected',duplicates:'idempotent',reconnect:'passed',endingLeaderboard:'passed',originalMode:'passed',personalEventsOnly:'passed',teamActivity:'passed',hostUpdates:host.patches.length,hostPatchBytes:host.bytes,averageStudentPatchBytes:Math.round(clients.reduce((sum,c)=>sum+c.bytes,0)/clients.length)},null,2));
  }finally {
    streams.forEach(s=>s.abort());
    for(const game of games)await request(`/${game.sessionId}/close`,{hostToken:game.hostToken});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
