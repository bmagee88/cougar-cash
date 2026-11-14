const {test}=require('node:test');
const assert=require('node:assert/strict');
const r=require('../src/TypingBoss/proportionalRules');
function finish(state,wrong=false) {
  if(state.balanced && !state.balancedRandomColors)state.balancedCharacters=60;
  const word=r.typingWord(state),text=(wrong?'!'.repeat(word.text.length):word.text)+(r.requiresWordSpace(state,word.text)?' ':'');
  const count=text.length-(state.wordsInAttack===0?1:0),gaps=Array(count).fill(100);
  r.finishWord(state,text,count,count*100,count*10000,state.wordsInAttack?100:undefined,gaps);
}
for(const balanced of [false,true]) {
  const state=()=>balanced?r.initializeBalanced(r.createTypingState(123,'barbarian')):r.createTypingState(123,'barbarian');
  test(`${balanced?'balanced':'proportional'} mistakes never subtract previously earned attack`,()=>{
    const s=state();finish(s);const earned=s.balancedPower ?? s.characters;
    finish(s,true);
    assert.ok(s.attackErrors>0);
    assert.ok((s.balancedPower ?? s.characters)>=earned);
    const correct=s.characters,attack=r.releaseAttack(s,()=>1);
    assert.equal(attack.base,correct);
    assert.ok(attack.power>=correct);
    assert.equal(s.attackErrors,0);
  });
  test(`${balanced?'balanced':'proportional'} errors cannot lower the next word's earned power`,()=>{
    const s=state();finish(s,true);finish(s);
    const correct=s.characters,attack=r.releaseAttack(s,()=>1);
    assert.equal(attack.base,correct);
    assert.ok(attack.power>=correct);
  });
}
test('wrong colored letters preserve earned banks while a missed trigger grants no activation',()=>{
  for(const random of [false,true]) {
    const s=r.initializeBalanced(r.createTypingState(123,'barbarian'));
    Object.assign(s,{balancedRandomColors:random,balancedOrangeBank:15,balancedCritCharge:12,balancedBlockBank:20});
    if(random)while(r.typingWord(s).color!=='orange')s.seed++;
    else Object.assign(s,{balancedCharacters:120,balancedOrangeAt:120});
    const word=r.typingWord(s),text='!'.repeat(word.text.length)+(r.requiresWordSpace(s,word.text)?' ':'');
    const count=text.length-1,gaps=Array(count).fill(100);
    r.finishWord(s,text,count,count*100,count*10000,undefined,gaps);
    assert.ok(s.balancedOrangeBank>=15);assert.equal(s.balancedCritCharge,12);assert.equal(s.balancedBlockBank,20);
    assert.equal(s.balancedOrangePower,0);
  }
});
test('timing can add a reward but never reduce base damage',()=>{
  assert.equal(r.consistencyMultiplier(2,10000,100000000),1);
  assert.ok(r.consistencyMultiplier(2,200,20000)>1);
});
