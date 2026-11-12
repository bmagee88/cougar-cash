const {test} = require("node:test");
const assert = require("node:assert/strict");
const r = require("../src/TypingBoss/proportionalRules");
const engine = require("./proportionalBoss");
const balanced = ability => r.initializeBalanced(r.createTypingState(123, ability));
const noDice = () => { throw new Error("Balanced combat must not roll dice"); };
test("balanced random colors default on, can be disabled before Start and lock during combat",()=>{
  const s=session();engine.applyBalanced(s,true);
  assert.equal(s.balancedRandomColors,true);
  for(const p of s.players.values())assert.equal(p.typing.balancedRandomColors,true);
  assert.equal(s.typingHost.balancedRandomColors,true);
  engine.applyBalanced(s,true,false);assert.equal(s.balancedRandomColors,false);
  assert.throws(()=>engine.applyBalanced(s,true,'yes'),/Random colors/);
  s.status='active';assert.throws(()=>engine.applyBalanced(s,true,true),/lock/);
});
test("random color map totals 100%, is stable per generated word and matches its advertised weights",()=>{
  assert.equal(Object.values(r.BALANCED_COLOR_CHANCES).reduce((a,b)=>a+b,0),100);
  const s=balanced('dragon');s.balancedRandomColors=true;
  const counts={white:0,orange:0,blue:0,green:0,red:0,gold:0};
  for(let index=0;index<20000;index++) {
    const word=r.typingWord(s,index),reconnected={...s,nextWord:index,balancedCharacters:99999};
    assert.deepEqual(word,r.typingWord(reconnected,index));
    counts[word.color || 'white']++;
  }
  for(const [color,chance] of Object.entries(r.BALANCED_COLOR_CHANCES))assert.ok(Math.abs(counts[color]/200-chance)<1,`${color}: ${counts[color]/200}%`);
});
test("random orange words still cash in Charge and random red words cash in saved crit",()=>{
  for(const color of ['orange','red']) {
    const s=balanced('barbarian');s.balancedRandomColors=true;
    while(r.typingWord(s).color!==color)s.seed++;
    Object.assign(s,{balancedOrangeBank:8,balancedCritCharge:12});
    finish(s,record(s));
    if(color==='orange'){assert.equal(s.balancedOrangeBank,0);assert.ok(s.balancedOrangePower>8);}
    else {assert.equal(s.balancedCritCharge,0);assert.ok(s.balancedCritBonus>.12);}
  }
});
test("partial-word bank preview matches committed earnings without activating bonuses or mutating state",()=>{
  const {previewBalancedWord}=require('../src/TypingBoss/balancedRules');
  const state=balanced('cleric');Object.assign(state,{balancedCharacters:134,balancedCritCharge:10});
  const original=structuredClone(state),word=r.typingWord(state),text=word.text+' ',gaps=Array(text.length-1).fill(150);
  const preview=previewBalancedWord(state,text,word.text+' ',gaps);
  assert.deepEqual(state,original);
  assert.equal(preview.balancedCritBonus,0);
  r.finishWord(state,text,gaps.length,gaps.length*150,gaps.length*22500,undefined,gaps);
  assert.equal(preview.balancedPower,state.balancedPower);
  assert.equal(preview.balancedOrangeBank,state.balancedOrangeBank);
  assert.equal(preview.balancedCritCharge,state.balancedCritBonus*100);
  assert.equal(state.balancedCritCharge,0);
});
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
    assert.ok(Math.abs(attack.power+attack.supportPower+attack.guardPower-(attack.orangePower||0)-(attack.criticalPower||0)-attack.earnedPower)<1e-8);
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
  assert.equal(steady.balancedPower-error.balancedPower,3.75);
});
test("every class conserves its 80/20 power allocation and defensive overflow becomes damage",()=>{
  for(const ability of ["cleric","barbarian","paladin","rogue","necromancer","monk","dragon"]) {
    const state=balanced(ability);
    Object.assign(state,{characters:100,balancedPower:125,gold:1,balancedCritBonus:.1,balancedOrangePower:5,balancedFlow:[1],balancedGuard:90,balancedGuardMax:100});
    const attack=r.releaseAttack(state,noDice);
    assert.equal(attack.power+attack.supportPower+attack.guardPower,130+attack.criticalPower);
    assert.ok(attack.guardPower<=10);
    assert.equal(attack.critical,true);
    assert.equal(state.dodgeExtraRolls,0);
    assert.equal(attack.power+attack.supportPower+attack.guardPower-attack.orangePower-attack.criticalPower,attack.base*1.25,"color power is additive, separate from the class reserve");
  }
});

test("orange and red banks fund exactly 10% each across short, long, and extended attacks",()=>{
  for(const ability of ["barbarian","paladin","rogue","necromancer","monk","dragon"]) {
    for(const length of [1,10,30]) {
      const state=balanced(ability);
      let base=0,orange=0,crit=0;
      for(let index=0;index<300;index++) {
        if(!state.wordsInAttack)state.attackWords=length;
        finish(state,record(state,150,index%13===0));
        if(state.wordsInAttack===r.attackWordLimit(state) || index===299) {
          const attack=r.releaseAttack(state,noDice);
          base+=attack.earnedPower;orange+=ability==="cleric"?attack.healingDeposit:attack.orangePower;crit+=attack.criticalBonus*100;
          assert.equal(attack.critical,attack.criticalPower>0);
        }
      }
      assert.ok(Math.abs(orange+(ability==="cleric"?state.balancedHealingBank:state.balancedOrangeBank)-base*.1)<1e-7,`${ability}/${length}: orange budget`);
      assert.ok(Math.abs(crit+state.balancedCritCharge-base*.1)<1e-7,`${ability}/${length}: red budget`);
      assert.ok(orange>0 && crit>0);
    }
  }
});

test("crit appears every 134 correct characters and missed triggers wait for their next slot",()=>{
  const state=balanced("cleric");
  assert.equal(state.balancedCritAt,134);
  assert.equal(state.balancedSpecialAt,150);
  state.balancedCharacters=133;
  assert.notEqual(r.typingWord(state).color,"red");
  Object.assign(state,{balancedCharacters:134,balancedSpecialAt:450,balancedCritCharge:12.5});
  assert.equal(r.typingWord(state).color,"red");
  finish(state,record(state,150,true));
  assert.notEqual(r.typingWord(state).color,"red");
  assert.equal(state.balancedCritAt,268);
  assert.equal(state.balancedCritBonus,0);
  state.balancedCharacters=268;
  assert.equal(r.typingWord(state).color,"red");
  const bank=state.balancedCritCharge;
  finish(state,record(state));
  assert.ok(state.balancedCritBonus*100>bank);
  assert.equal(state.balancedCritCharge,0);
  assert.equal(state.balancedCritAt,402);
  assert.equal(r.releaseAttack(state,noDice).critical,true);
  assert.equal(r.releaseAttack(state,noDice).criticalPower,0);
});

test("missed gold expires and returns at the next 150-character slot",()=>{
  const state=balanced("barbarian");
  state.balancedCharacters=149;
  assert.notEqual(r.typingWord(state).color,"gold");
  Object.assign(state,{balancedCharacters:150,balancedCritAt:268});
  assert.equal(r.typingWord(state).color,"gold");
  finish(state,record(state,150,true));
  assert.equal(state.gold,0);
  assert.equal(state.balancedSpecialAt,300);
  assert.notEqual(r.typingWord(state).color,"gold");
  state.balancedCharacters=300;
  const size=state.attackWords;
  finish(state,record(state));
  assert.equal(state.gold,1);
  assert.equal(state.attackWords,size+2);
  assert.equal(state.balancedSpecialAt,450);
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
test("both Block banks scale by the attack target count, including single and group attacks",()=>{
  for(const step of [0,1,2,9]) {
    const s=session();engine.applyBalanced(s,true);s.status="active";s.bossAttackIndex=step;
    for(const player of s.players.values())Object.assign(player.typing,{balancedGuard:30,paladinShield:30});
    const timers=[];
    engine.launchAttack(s,s.typingHost,{power:90,multiplier:1,moveId:"weak",balanced:true},{schedule:(_,fn)=>timers.push(fn),broadcast:()=>{},random:noDice});
    const count=s.projectiles.length;
    assert.equal(count,step===9?6:step===2?2:1);
    timers.shift()();
    for(const shot of s.projectiles) {
      assert.equal(shot.blockedAmount,60/count);
      assert.equal(s.players.get(shot.target).hp,100-30/count);
      assert.equal(s.players.get(shot.target).typing.balancedGuard,0);
      assert.equal(s.players.get(shot.target).typing.paladinShield,0);
      assert.notEqual(shot.evadeType,"dodge");
    }
  }
});

test("successful dodge clears chance, prevents the whole hit, and preserves Block; failed rolls retain chance",()=>{
  for(const roll of [.1,.9]) {
    const s=session();engine.applyBalanced(s,true);s.status="active";
    const player=s.players.get("0");Object.assign(player.typing,{dodgeSamples:[25],balancedGuard:30});
    const timers=[];let rolls=0;
    engine.launchAttack(s,s.typingHost,{power:20,multiplier:1,moveId:"weak",balanced:true},{schedule:(_,fn)=>timers.push(fn),broadcast:()=>{},random:()=>{rolls++;return roll;}});timers.shift()();
    assert.equal(rolls,1);
    assert.equal(player.hp,100);
    assert.deepEqual(player.typing.dodgeSamples,roll<.25?[]:[25]);
    assert.equal(player.typing.balancedGuard,roll<.25?30:10);
    assert.equal(s.projectiles[0].evadeType,roll<.25?"dodge":undefined);
  }
});

test("successful dodges spend 100 banked points, preserve overflow and Block, and never make chance exceed 100%",()=>{
  for(const [bank,roll,remaining,dodged] of [[150,.99,50,true],[75,.1,0,true],[75,.99,75,false],[250,.99,150,true]]) {
    for(const hostTarget of [false,true]) {
      const s=session();engine.applyBalanced(s,true);s.status='active';
      const player=s.players.get('0'),defense=hostTarget?s.typingHost:player.typing;
      Object.assign(defense,{dodgeBank:bank,balancedGuard:30});
      assert.equal(r.dodgeChance(defense),bank);
      assert.ok(r.effectiveDodgeChance(defense)<=1);
      const timers=[];
      engine.launchAttack(s,hostTarget?player:s.typingHost,{power:20,multiplier:1,moveId:'weak',balanced:true},
        {schedule:(_,fn)=>timers.push(fn),broadcast:()=>{},random:()=>roll});
      timers.shift()();
      assert.equal(defense.dodgeBank,remaining);
      assert.equal(s.projectiles[0].evadeType,dodged?'dodge':undefined);
      assert.equal(defense.balancedGuard,dodged?30:10);
    }
  }
});

test("Cleric retains full base power instead of reserving 20 percent on gold",()=>{
  const s=session();engine.applyBalanced(s,true);s.status="active";s.boss.hp=1000;
  const player=s.players.get("0");player.hp=95;
  const timers=[];const cb={schedule:(_,fn)=>timers.push(fn),broadcast:()=>{},random:noDice};
  Object.assign(player.typing,{characters:100,balancedPower:125,gold:1});
  const attack=r.releaseAttack(player.typing);
  assert.equal(attack.power,125);assert.equal(attack.supportPower,0);
  engine.launchAttack(s,player,attack,cb);
  assert.equal(player.hp,95);
  assert.equal(s.projectiles[0].kind,"damage");
  timers.shift()();
  assert.equal(s.boss.hp,875);
  assert.equal(player.totalDamage+(player.totalHealing || 0),125);
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

 test("balanced crit boosts current attack by its charged percentage",()=>{
  for(const base of [40,100]) {
    const state=balanced("barbarian");
    Object.assign(state,{characters:base,balancedPower:base,balancedCritBonus:.25,balancedOrangePower:10});
    const attack=r.releaseAttack(state,noDice);
    assert.equal(attack.criticalBonus,.25);
    assert.equal(attack.criticalPower,(base+10)*.25);
    assert.equal(attack.power,(base+10)*1.25);
    assert.equal(state.balancedCritBonus,0);
  }
});
