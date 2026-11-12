// Orange banks additive power; red banks percentage points of crit damage.
// A perfect red trigger applies its saved percentage to the current attack.
const PALETTE = ["orange", "blue", "green", null];
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
    balancedCritCharge: 0, balancedCritBonus: 0, balancedCritAt: 134,
  });
}

function balancedWordColor(state) {
  if (state.balancedCharacters >= state.balancedSpecialAt) return "gold";
  if (state.balancedCharacters >= (state.balancedCritAt || 134)) return "red";
  return PALETTE[Math.floor(state.balancedCharacters / 20) % PALETTE.length];
}

function recordBalancedWord(state, text, expected, gaps, correct, color, commit=true) {
  const prayerWord=state.ability==='cleric' && color==='orange';
  let prayer=state.balancedHealingBank || 0;
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
      if(prayerWord)prayer+=power;
    } else if(prayerWord) {
      prayer=Math.max(0,prayer-2.5);
    }
  }
  const errors = text.length - characters;
  earned -= errors * 2.5;
  if (!opening && !missingFirst && gaps.length) {
    state.balancedFlow = [...state.balancedFlow.slice(-4), gaps[0] <= threshold ? 1 : 0];
  }
  state.balancedPace = pace;
  if(!prayerWord)state.balancedPower += earned;
  state.balancedCharacters += characters;
  const healing=state.ability==='cleric';
  const bank=healing?'balancedHealingBank':'balancedOrangeBank';
  state[bank] = prayerWord?prayer:(state[bank] || 0) + Math.max(0,earned) * .1;
  if(!prayerWord)state.balancedCritCharge = (state.balancedCritCharge || 0) + Math.max(0,earned) * .1;
  // A trigger gets one attempt. Advance even on a miss; skip crossed slots.
  if (commit && color === "gold") state.balancedSpecialAt = (Math.floor(state.balancedCharacters / 150) + 1) * 150;
  if (commit && color === "red") state.balancedCritAt = (Math.floor(state.balancedCharacters / 134) + 1) * 134;
  if (correct) {
    if (color === "blue") state.balancedDefenseWord = true;
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

function releaseBalancedAttack(state) {
  const earnedPower = Math.max(0,state.balancedPower);
  const quality = state.characters ? earnedPower / state.characters : 1;
  const reserve = earnedPower * .2;
  const support = state.gold > 0 && ["paladin", "necromancer"].includes(state.ability);
  const flow = state.balancedFlow.length ? state.balancedFlow.reduce((a, b) => a + b, 0) / state.balancedFlow.length : 0;
  let guard = support ? 0 : state.ability === "rogue" ? reserve * (state.gold ? 1 : flow) : state.balancedDefenseWord ? reserve : 0;
  // Cap stored defense at one health bar; excess power remains damage.
  guard = Math.min(guard, Math.max(0, (state.balancedGuardMax || 100) - state.balancedGuard));
  state.balancedGuard += guard;
  const supportPower = support ? reserve : 0;
  const orangePower = earnedPower > 0 ? state.balancedOrangePower || 0 : 0;
  const criticalBonus = state.balancedCritBonus || 0;
  const critical = criticalBonus > 0;
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
    orange:0, red:0, green:0, growth:0, shield:0, gold:0, dodgeExtraRolls:0,
    balancedPower:0, balancedQuality:quality, consistency:quality,
    balancedDefenseWord:false, balancedSkillWord:false,
    balancedOrangePower:0, balancedCritBonus:0,
    balancedHealingDeposit:0,
    attackWords:state.ability === "monk" ? Math.ceil(10 / 2 ** gold) : 10});
  delete state.nextPowerBonus;
  return attack;
}

// Display-only partial word: bank earnings use the same timing/penalty rules,
// while perfect-word triggers remain uncommitted until finishWord.
function previewBalancedWord(state,text,expected,gaps,color=null) {
  if(!text.length)return state;
  const next={...state};
  recordBalancedWord(next,text,expected,gaps,false,color,false);
  return next;
}
module.exports = { initializeBalanced, balancedWordColor, recordBalancedWord, releaseBalancedAttack, previewBalancedWord };
