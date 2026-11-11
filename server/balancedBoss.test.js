const {test} = require("node:test");
const assert = require("node:assert/strict");
const r = require("../src/TypingBoss/proportionalRules");
const engine = require("./proportionalBoss");
const balanced = ability => r.initializeBalanced(r.createTypingState(123, ability));
const noDice = () => { throw new Error("Balanced combat must not roll dice"); };
function session() {
  const players = new Map(["cleric","barbarian","paladin","rogue","necromancer","monk"].map((classId,i)=>[String(i),{
    code:String(i),name:classId,classId,hp:100,maxHp:100,totalDamage:0,totalKeystrokes:0,correctKeystrokes:0,correctStreak:0,bossHitsTaken:0,turnsTaken:0,typing:r.createTypingState(i+5,classId),
  }]));
  return {status:"setup",mode:"proportional",startedAt:Date.now()-60000,startingPlayers:6,players,
    boss:{hp:600,maxHp:600,id:"infernalDragon",name:"Dragon"},typingHost:r.createTypingState(123,"dragon"),projectiles:[]};
}
function record(state, pace=150, wrong=false) {
  const word=r.typingWord(state);
  let text=word.text+(r.requiresWordSpace(state,word.text)?" ":"");
  if(wrong) text="!"+text.slice(1);
  const gaps=Array(text.length-(state.wordsInAttack===0?1:0)).fill(pace);
  return [state.nextWord,text,gaps.length,gaps.reduce((a,b)=>a+b,0),gaps.reduce((a,b)=>a+b*b,0),state.wordsInAttack?gaps[0]:null,gaps];
}
function finish(state, rec) {r.finishWord(state,rec[1],rec[2],rec[3],rec[4],rec[5]??undefined,rec[6]);}
test("balanced power per correct character is identical for short and long runs at fast or slow steady pace",()=>{
  for(const length of [1,5,10,20,40]) for(const pace of [20,150,1000]) {
    const state=balanced();
    state.attackWords=length;
    for(let i=0;i<length;i++) finish(state,record(state,pace));
    const attack=r.releaseAttack(state,noDice);
    assert.equal(attack.earnedPower,attack.base*1.25);
    assert.equal(attack.power+attack.supportPower+attack.guardPower,attack.earnedPower);
    assert.equal(attack.criticalChance,0);
    assert.ok(attack.consistency>=1 && attack.consistency<=1.25);
  }
});
test("hesitation lowers earned power while incorrect letters reduce power once",()=>{
  const steady=balanced(), hesitant=balanced(), error=balanced();
  const good=record(steady);
  const paused=record(hesitant);
  paused[6][1]=10000;paused[3]=paused[6].reduce((a,b)=>a+b,0);paused[4]=paused[6].reduce((a,b)=>a+b*b,0);
  finish(steady,good);finish(hesitant,paused);finish(error,record(error,150,true));
  assert.ok(hesitant.balancedPower<steady.balancedPower);
  assert.equal(steady.balancedPower-error.balancedPower,1.25);
});
test("every class conserves its 80/20 power allocation and defensive overflow becomes damage",()=>{
  for(const ability of ["cleric","barbarian","paladin","rogue","necromancer","monk","dragon"]) {
    const state=balanced(ability);
    Object.assign(state,{characters:100,balancedPower:125,gold:1,balancedSkillWord:true,balancedFlow:[1],balancedGuard:90,balancedGuardMax:100});
    const attack=r.releaseAttack(state,noDice);
    assert.equal(attack.power+attack.supportPower+attack.guardPower,125);
    assert.ok(attack.guardPower<=10);
    assert.equal(attack.critical,true);
    assert.equal(state.dodgeExtraRolls,0);
    assert.equal(attack.power+attack.supportPower+attack.guardPower,attack.base*1.25,"skill strike adds no free power");
  }
});
test("gold unlocks from correct-character work, never dice, and missed gold stays available",()=>{
  const state=balanced("barbarian");
  assert.notEqual(r.typingWord(state).color,"gold");
  while(state.balancedCharacters<100) {
    finish(state,record(state));
    if(state.wordsInAttack===r.attackWordLimit(state))r.releaseAttack(state,noDice);
  }
  assert.equal(r.typingWord(state).color,"gold");
  finish(state,record(state,150,true));
  assert.equal(state.gold,0);
  assert.equal(r.typingWord(state).color,"gold");
  const size=state.attackWords;
  finish(state,record(state));
  assert.equal(state.gold,1);
  assert.equal(state.attackWords,size+2);
  assert.equal(state.balancedSpecialAt,200);
});
test("host switch defaults off, validates and locks, and balanced actors share content",()=>{
  const s=session();
  engine.applyBalanced(s);
  assert.equal(s.balanced,false);
  assert.throws(()=>engine.applyBalanced(s,"true"));
  engine.applyHpMultiplier(s,2);
  engine.applyBalanced(s,true);
  for(const player of s.players.values()) {
    assert.equal(player.typing.seed,s.typingHost.seed);
    assert.equal(player.typing.balancedGuardMax,200);
    assert.deepEqual(r.typingWord(player.typing),r.typingWord(s.typingHost));
  }
  s.status="active";
  assert.throws(()=>engine.applyBalanced(s,false),/lock/);
});
test("balanced defense spends its capacity deterministically without immunity or dice",()=>{
  const s=session();engine.applyBalanced(s,true);s.status="active";
  const player=s.players.get("0");player.typing.balancedGuard=30;
  const timers=[];const cb={schedule:(_,fn)=>timers.push(fn),broadcast:()=>{},random:noDice};
  engine.launchAttack(s,s.typingHost,{power:20,multiplier:1,moveId:"weak",balanced:true},cb);timers.shift()();
  assert.equal(player.hp,100);assert.equal(player.typing.balancedGuard,10);
  assert.equal(s.projectiles[0].evadeType,"dodge");
  s.bossAttackIndex=0;
  engine.launchAttack(s,s.typingHost,{power:20,multiplier:1,moveId:"weak",balanced:true},cb);timers.shift()();
  assert.equal(player.hp,90);assert.equal(player.typing.balancedGuard,0);
});
test("support spends only the reserve and overheal returns to damage",()=>{
  const s=session();engine.applyBalanced(s,true);s.status="active";s.boss.hp=1000;
  const player=s.players.get("0");player.hp=95;
  const timers=[];const cb={schedule:(_,fn)=>timers.push(fn),broadcast:()=>{},random:noDice};
  engine.launchAttack(s,player,{power:100,earnedPower:125,supportPower:25,guardPower:0,base:100,consistency:1.25,balanced:true,gold:1,moveId:"weak"},cb);
  assert.equal(player.hp,100);
  assert.equal(s.projectiles[0].kind,"heal");assert.equal(s.projectiles[0].amount,5);
  timers.shift()();
  assert.equal(s.boss.hp,880);
  assert.equal(player.totalDamage+player.totalHealing,125);
});
test("balanced batches validate actual key gaps atomically and remain retry-safe",()=>{
  const s=session();engine.applyBalanced(s,true);s.status="active";
  const player=s.players.get("0");const copy={...player.typing};const rec=record(copy);
  const bad=structuredClone(rec);bad[6][0]+=100;
  const cb={schedule:()=>{},broadcast:()=>{}};
  assert.throws(()=>engine.submitWords(s,{role:"player",actorCode:"0"},[bad],cb),/timing/);
  assert.equal(player.typing.nextWord,0);
  engine.submitWords(s,{role:"player",actorCode:"0"},[rec],cb);
  engine.submitWords(s,{role:"player",actorCode:"0"},[rec],cb);
  assert.equal(player.typing.nextWord,1);
  assert.equal(player.typing.balancedPower,(rec[1].length)*1.25);
});
