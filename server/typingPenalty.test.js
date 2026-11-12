const {test}=require('node:test');
const assert=require('node:assert/strict');
const r=require('../src/TypingBoss/proportionalRules');
function finish(state,wrong=false) {
  const word=r.typingWord(state),text=(wrong?'!'.repeat(word.text.length):word.text)+(r.requiresWordSpace(state,word.text)?' ':'');
  const count=text.length-(state.wordsInAttack===0?1:0),gaps=Array(count).fill(100);
  r.finishWord(state,text,count,count*100,count*10000,state.wordsInAttack?100:undefined,gaps);
}
for(const balanced of [false,true]) {
  const state=()=>balanced?r.initializeBalanced(r.createTypingState(123,'barbarian')):r.createTypingState(123,'barbarian');
  test(`${balanced?'balanced':'proportional'} mashed letters plus correct spaces cannot deal damage`,()=>{
    const s=state();for(let i=0;i<10;i++)finish(s,true);
    if(balanced)Object.assign(s,{balancedOrangePower:50,balancedCritBonus:1});
    assert.ok(s.attackErrors>0);assert.equal(r.releaseAttack(s,()=>1).power,0);assert.equal(s.attackErrors,0);
    finish(s);assert.ok(r.releaseAttack(s,()=>1).power>0,'next attack starts clean');
  });
  test(`${balanced?'balanced':'proportional'} early errors remain a debt against later correct words`,()=>{
    const s=state();finish(s,true);finish(s);
    const errors=s.attackErrors,correct=s.characters;
    const attack=r.releaseAttack(s,()=>1);
    if(!balanced)assert.equal(attack.base,Math.max(0,correct-2*errors));
    else assert.equal(attack.earnedPower,Math.max(0,correct*1.25-errors*2.5));
  });
}
test('one typo reduces balanced damage without wiping out a good attack',()=>{
  const s=r.initializeBalanced(r.createTypingState(123,'barbarian'));
  for(let i=0;i<8;i++)finish(s);
  const word=r.typingWord(s),text='!'+word.text.slice(1)+' ',count=text.length,gaps=Array(count).fill(100);
  r.finishWord(s,text,count,count*100,count*10000,100,gaps);
  const correct=s.characters,attack=r.releaseAttack(s,()=>1);
  assert.equal(attack.earnedPower,correct*1.25-2.5);
  assert.ok(attack.power>0);assert.equal(s.attackErrors,0);
});
