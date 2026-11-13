// Orange banks additive power; red banks percentage points of crit damage.
// A perfect red trigger applies its saved percentage to the current attack.
const PALETTE = ["orange", "blue", "green", null, "red"];
const TRIGGER_INTERVALS = { orange: 120, red: 134, blue: 140, gold: 150, green: 160 };
const triggerField = color => color === 'gold' ? 'balancedSpecialAt' : color === 'red' ? 'balancedCritAt' : `balanced${color[0].toUpperCase()+color.slice(1)}At`;
function balancedTrigger(state) {
  if (state.balancedRandomColors) return null;
  return Object.keys(TRIGGER_INTERVALS).filter(color => state.balancedCharacters >= (state[triggerField(color)] ?? TRIGGER_INTERVALS[color]))
    .sort((a,b) => (state[triggerField(a)] ?? TRIGGER_INTERVALS[a]) - (state[triggerField(b)] ?? TRIGGER_INTERVALS[b]))[0] || null;
}

// Each word starts its own running mean. Ignore the first/transition gap and
// separators: only character-to-character timing earns cadence.
function wordCadence(text, expected, gaps) {
  const letters = Math.min(text.length, expected.trimEnd().length);
  const offset = gaps.length === text.length ? 0 : -1;
  let count=0, mean=0, squares=0, bonus=0;
  for(let i=0;i<letters;i++) {
    if(i>0 && Number.isFinite(gaps[i+offset])) {
      const gap=gaps[i+offset], delta=gap-mean;
      count++; mean+=delta/count; squares+=delta*(gap-mean);
    }
    const deviation=count>1?Math.sqrt(Math.max(0,squares/count)):0;
    const smoothness=count<2?1:Math.max(0,1-deviation/Math.max(1,mean));
    if(text[i]===expected[i])bonus+=.0025*smoothness;
  }
  return bonus;
}
const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
};

function initializeBalanced(state) {
  return Object.assign(state, {
    balanced: true, balancedPower: 0, balancedCharacters: 0, balancedSpecialAt: 150,
    balancedPace: [], balancedFlow: [], balancedGuard: 0, balancedQuality: 1.25,
    balancedDefenseWord: false, balancedSkillWord: false,
    balancedOrangeBank: 0, balancedOrangePower: 0,
    balancedHealingBank: 0, balancedHealingDeposit: 0,
    balancedBlockBank: 0,
    balancedCritCharge: 0, balancedCritBonus: 0, balancedCritAt: 134,
    balancedOrangeAt:120, balancedBlueAt:140, balancedGreenAt:160,
    balancedDodgeBank:0, balancedCadenceBonus:0,
  });
}

function balancedWordColor(state) {
  const trigger=balancedTrigger(state);
  if(trigger)return trigger;
  return PALETTE[Math.floor(state.balancedCharacters / 20) % PALETTE.length];
}

function recordBalancedWord(state, text, expected, gaps, correct, color, commit=true) {
  if(!state.balancedRandomColors)return recordScheduledWord(state,text,expected,gaps,correct,color,commit);
  const prayerWord=state.ability==='cleric' && color==='orange';
  const bank=color==='orange'?(prayerWord?'balancedHealingBank':'balancedOrangeBank'):color==='blue'?'balancedBlockBank':color==='red'?'balancedCritCharge':null;
  const bankScale=color==='red'?.1:1;
  let balance=bank?(state[bank] || 0):0;
  const opening = state.wordsInAttack === 0;
  const missingFirst = gaps.length === text.length - 1;
  const letterGaps = gaps.filter((_, i) => !(i === 0 && !missingFirst && !opening));
  const pace = [...state.balancedPace, ...letterGaps].slice(-21);
  const threshold = Math.max(200, 2 * median(pace));
  let earned = 0, characters = 0;
  for (let i = 0; i < text.length; i++) {
    const gap = missingFirst ? (i === 0 ? undefined : gaps[i - 1]) : gaps[i];
    if (text[i] === expected[i]) {
      characters++;
      const power=1 + .25 * (gap === undefined || gap <= threshold ? 1 : 0);
      earned += power;
      if(bank)balance+=power*bankScale;
    }
  }
  if (!opening && !missingFirst && gaps.length) {
    state.balancedFlow = [...state.balancedFlow.slice(-4), gaps[0] <= threshold ? 1 : 0];
  }
  state.balancedPace = pace;
  if(color===null)state.balancedPower += earned;
  state.balancedCharacters += characters;
  const healing=state.ability==='cleric';
  if(bank)state[bank]=balance;
  // A trigger gets one attempt. Advance even on a miss; skip crossed slots.
  if (commit && color === "gold") state.balancedSpecialAt = (Math.floor(state.balancedCharacters / 150) + 1) * 150;
  if (commit && color === "red") state.balancedCritAt = (Math.floor(state.balancedCharacters / 134) + 1) * 134;
  if (correct) {
    if (color === "blue") {
      const capacity=Math.max(0,(state.balancedGuardMax || 100)-(state.balancedGuard || 0));
      const grant=Math.min(capacity,state.balancedBlockBank || 0);
      state.balancedGuard=(state.balancedGuard || 0)+grant;
      state.balancedBlockBank-=grant;
    }
    if (color === "orange") {
      const destination=healing?'balancedHealingDeposit':'balancedOrangePower';
      state[destination] = (state[destination] || 0) + state[bank];
      state[bank] = 0;
    }
    if (color === "red") {
      state.balancedCritBonus = (state.balancedCritBonus || 0) + state.balancedCritCharge / 100;
      state.balancedCritCharge = 0;
      state.balancedSkillWord = true;
    }
  }
  return earned;
}

function recordScheduledWord(state,text,expected,gaps,correct,color,commit) {
  const trigger=balancedTrigger(state);
  const prayer=color==='orange' && state.ability==='cleric';
  const bank=color==='orange'?(prayer?'balancedHealingBank':'balancedOrangeBank'):color==='blue'?'balancedBlockBank':color==='red'?'balancedCritCharge':null;
  const scale=color==='red'?.1:color==='blue'?.5:1;
  const letters=Math.min(text.length,expected.trimEnd().length);
  let earned=0, characters=0, balance=state[bank] || 0;
  for(let i=0;i<letters;i++) {
    if(text[i]===expected[i]) { characters++;earned++;if(bank)balance+=1.25*scale; }
  }
  state.balancedPower+=earned;
  state.balancedCadenceBonus=(state.balancedCadenceBonus || 0)+wordCadence(text,expected,gaps);
  state.balancedCharacters+=characters;
  if(bank)state[bank]=balance;
  if(commit && trigger)state[triggerField(trigger)]=(Math.floor(state.balancedCharacters/TRIGGER_INTERVALS[trigger])+1)*TRIGGER_INTERVALS[trigger];
  if(commit && correct && trigger===color) {
    if(color==='blue') {
      const grant=Math.min(Math.max(0,(state.balancedGuardMax || 100)-(state.balancedGuard || 0)),state.balancedBlockBank);
      state.balancedGuard=(state.balancedGuard || 0)+grant;state.balancedBlockBank-=grant;
    }
    if(color==='orange') {
      const destination=prayer?'balancedHealingDeposit':'balancedOrangePower';
      state[destination]=(state[destination] || 0)+state[bank];state[bank]=0;
    }
    if(color==='red') {state.balancedCritBonus=(state.balancedCritBonus || 0)+state.balancedCritCharge/100;state.balancedCritCharge=0;}
    if(color==='green') {state.dodgeBank=(state.dodgeBank || 0)+(state.balancedDodgeBank || 0);state.balancedDodgeBank=0;}
  }
  return earned;
}

function releaseBalancedAttack(state) {
  const cadence=state.balancedRandomColors ? 1 : 1+(state.balancedCadenceBonus || 0);
  const earnedPower = Math.max(0,state.balancedPower)*cadence;
  const quality = state.characters ? earnedPower / state.characters : 1;
  const reserve = earnedPower * .2;
  const support = state.gold > 0 && ["paladin", "necromancer"].includes(state.ability);
  const guard=0; // Blue words grant Block at word completion, never at attack release.
  const supportPower = support ? reserve : 0;
  const orangePower = state.balancedOrangePower || 0;
  const criticalBonus = state.balancedCritBonus || 0;
  const critical = criticalBonus > 0 && earnedPower+orangePower>0;
  const attackPower = earnedPower - supportPower - guard + orangePower;
  const criticalPower = attackPower * criticalBonus;
  const power = attackPower + criticalPower;
  const attack = {
    balanced: true, base: state.characters, power, earnedPower, supportPower, guardPower: guard, orangePower, criticalPower, criticalBonus,
    healingDeposit:state.balancedHealingDeposit || 0,
    multiplier: state.characters ? power / state.characters : 1, consistency: quality,
    critical, criticalChance: 0, orangeBonus: 0, greenBonus: 0, greenStacks: 0, blueShield: 0,
    meanIntervalMs: state.intervalCount ? state.intervalSum / state.intervalCount : 0,
    intervalStdDevMs: state.intervalCount ? Math.sqrt(Math.max(0, state.intervalSquares / state.intervalCount - (state.intervalSum / state.intervalCount) ** 2)) : 0,
    moveId: critical ? "strong" : "weak", ...(state.gold ? {gold:state.gold} : {}),
  };
  const gold = state.gold || 0;
  Object.assign(state, {wordsInAttack:0, characters:0, attackErrors:0, intervalCount:0, intervalSum:0, intervalSquares:0,
    orange:0, red:0, green:0, growth:0, shield:0, gold:0, dodgeExtraRolls:state.ability==='rogue'?(state.dodgeExtraRolls || 0)+gold:0,
    balancedPower:0, balancedCadenceBonus:0, balancedQuality:quality, consistency:quality,
    balancedDefenseWord:false, balancedSkillWord:false,
    balancedOrangePower:0, balancedCritBonus:0,
    balancedHealingDeposit:0,
    attackWords:state.ability === "monk" ? Math.ceil(10 / 2 ** gold) : 10});
  delete state.nextPowerBonus;
  return attack;
}

// Display-only partial word: bank earnings use the same timing/reward rules,
// while perfect-word triggers remain uncommitted until finishWord.
function previewBalancedWord(state,text,expected,gaps,color=null) {
  if(!text.length)return state;
  const next={...state};
  recordBalancedWord(next,text,expected,gaps,false,color,false);
  return next;
}
module.exports = { initializeBalanced, balancedWordColor, balancedTrigger, recordBalancedWord, releaseBalancedAttack, previewBalancedWord };
