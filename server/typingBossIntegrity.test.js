const {test,mock}=require('node:test'),assert=require('node:assert/strict');
const engine=require('./proportionalBoss'),rules=require('../src/TypingBoss/proportionalRules'),security=require('./typingBossIntegrity');
function room(t,balanced=false) {
  let now=1000000;const clock=mock.method(Date,'now',()=>now);t.after(()=>clock.mock.restore());
  const state=engine.newState('barbarian');if(balanced)rules.initializeBalanced(state);
  const player={code:'heroAAAA',name:'Alice',hp:100,maxHp:100,totalDamage:0,totalKeystrokes:0,correctKeystrokes:0,correctStreak:0,turnsTaken:0,typing:state};
  const session={status:'active',mode:'proportional',startedAt:now-60000,players:new Map([[player.code,player]]),boss:{hp:10000,maxHp:10000,id:'infernalDragon'},typingHost:engine.newState('dragon'),projectiles:[]};
  const records=()=>{
    const word=rules.typingWord(state),text=word.text+(rules.requiresWordSpace(state,word.text)?' ':''),count=text.length-(state.wordsInAttack===0?1:0);
    const issued=security.publicTypingState(session,state).issuedWords.find(word=>word.index===state.nextWord);
    return [state.nextWord,text,count,count*100,count*10000,state.wordsInAttack?100:null,balanced?Array(count).fill(100):null,{ticket:issued.ticket,mistakes:0}];
  };
  const submit=records=>engine.submitWords(session,{role:'player',actorCode:player.code},records,{schedule:()=>{},broadcast:()=>{},random:()=>1});
  security.publicTypingState(session,state);
  return {state,session,player,record:records,submit,advance(ms=3000){now+=ms;}};
}
test('public typing hides the seed and issues only two unseen words with actor-specific tickets',t=>{
  const h=room(t),view=security.publicTypingState(h.session,h.state);
  assert.equal(view.seed,0);assert.equal(view.issuedWords.length,2);
  assert.equal(rules.typingWord(view).text,rules.typingWord(h.state).text);
  assert.equal(rules.typingWord(view,2).pending,true);
  const other=engine.newState('barbarian');other.seed=h.state.seed;
  const otherView=security.publicTypingState(h.session,other);
  assert.notEqual(view.issuedWords[0].ticket,otherView.issuedWords[0].ticket);
});
for(const balanced of [false,true])test(`${balanced?'balanced':'standard'} requires correct text and a current ticket, with atomic rejection`,t=>{
  const h=room(t,balanced),valid=h.record();h.advance();
  const bad=structuredClone(valid);bad[1]='!'+bad[1].slice(1);
  assert.throws(()=>h.submit([bad]),/correctly/);assert.equal(h.state.nextWord,0);
  const unissued=structuredClone(valid);unissued[0]=2;
  assert.throws(()=>h.submit([unissued]),/not issued/);
  const stolen=structuredClone(valid);stolen[7].ticket='0'.repeat(32);
  assert.throws(()=>h.submit([stolen]),/not issued/);
  assert.throws(()=>h.submit([valid,stolen]),/not issued/);assert.equal(h.state.nextWord,0);
  const result=h.submit([valid]);assert.equal(result.nextWord,1);
  assert.equal(result.issuedWords.at(-1).index,2);
  const before=structuredClone(h.state);h.submit([valid]);assert.deepEqual(h.state,before);
  const edited=structuredClone(valid);edited[7].mistakes=1;
  assert.throws(()=>h.submit([edited]),/different result/);
});
test('server time rejects fabricated future timing and zero-time macro batches',t=>{
  const h=room(t),record=h.record();
  assert.throws(()=>h.submit([record]),/server-observed/);
  const zero=structuredClone(record);zero[3]=0;zero[4]=0;
  assert.throws(()=>h.submit([zero]),/server-observed/);
  h.advance();assert.equal(h.submit([record]).nextWord,1);
});
test('idle time has bounded arrival credit and cannot fund an unlimited instant burst',t=>{
  const h=room(t);h.advance(3600000);
  assert.equal(security.checkBudget(h.session,h.state,64).tokens,0);
  assert.throws(()=>security.checkBudget(h.session,h.state,65),/too quickly/);
});
test('correcting a mistake retains letter power, records accuracy and does not activate a perfect trigger',t=>{
  const h=room(t,true);Object.assign(h.state,{balancedCharacters:120,balancedOrangeAt:120,balancedOrangeBank:20});
  const rec=h.record();rec[7].mistakes=3;h.advance();h.submit([rec]);
  assert.equal(h.state.balancedPower,rec[1].length);assert.equal(h.state.balancedOrangePower,0);
  assert.ok(h.state.balancedOrangeBank>20);assert.equal(h.state.totalCorrectCharacters,rec[1].length);
  assert.equal(h.state.totalCharacters,rec[1].length+3);
});
