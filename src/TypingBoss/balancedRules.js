// Balanced combat conserves earned power; no dice or run-wide color multipliers.
const PALETTE = ["orange", "blue", "green", "red", null];
const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
};

function initializeBalanced(state) {
  return Object.assign(state, {
    balanced: true, balancedPower: 0, balancedCharacters: 0, balancedSpecialAt: 100,
    balancedPace: [], balancedFlow: [], balancedGuard: 0, balancedQuality: 1.25,
    balancedDefenseWord: false, balancedSkillWord: false,
  });
}

function balancedWordColor(state) {
  if (state.balancedCharacters >= state.balancedSpecialAt) return "gold";
  return PALETTE[Math.floor(state.balancedCharacters / 20) % PALETTE.length];
}

function recordBalancedWord(state, text, expected, gaps, correct, color) {
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
      earned += 1 + .25 * (gap === undefined || gap <= threshold ? 1 : 0);
    }
  }
  if (!opening && !missingFirst && gaps.length) {
    state.balancedFlow = [...state.balancedFlow.slice(-4), gaps[0] <= threshold ? 1 : 0];
  }
  state.balancedPace = pace;
  state.balancedPower += earned;
  state.balancedCharacters += characters;
  if (correct) {
    if (color === "gold") state.balancedSpecialAt += 100;
    if (color === "blue") state.balancedDefenseWord = true;
    if (color === "red") state.balancedSkillWord = true;
  }
  return earned;
}

function releaseBalancedAttack(state) {
  const earnedPower = state.balancedPower;
  const quality = state.characters ? earnedPower / state.characters : 1;
  const reserve = earnedPower * .2;
  const support = state.gold > 0 && ["cleric", "paladin", "necromancer"].includes(state.ability);
  const flow = state.balancedFlow.length ? state.balancedFlow.reduce((a, b) => a + b, 0) / state.balancedFlow.length : 0;
  let guard = support ? 0 : state.ability === "rogue" ? reserve * (state.gold ? 1 : flow) : state.balancedDefenseWord ? reserve : 0;
  // Cap stored defense at one health bar; excess power remains damage.
  guard = Math.min(guard, Math.max(0, (state.balancedGuardMax || 100) - state.balancedGuard));
  state.balancedGuard += guard;
  const supportPower = support ? reserve : 0;
  const critical = state.balancedSkillWord && quality >= 1.24;
  const power = earnedPower - supportPower - guard;
  const attack = {
    balanced: true, base: state.characters, power, earnedPower, supportPower, guardPower: guard,
    multiplier: state.characters ? power / state.characters : 1, consistency: quality,
    critical, criticalChance: 0, orangeBonus: 0, greenBonus: 0, greenStacks: 0, blueShield: 0,
    meanIntervalMs: state.intervalCount ? state.intervalSum / state.intervalCount : 0,
    intervalStdDevMs: state.intervalCount ? Math.sqrt(Math.max(0, state.intervalSquares / state.intervalCount - (state.intervalSum / state.intervalCount) ** 2)) : 0,
    moveId: critical ? "strong" : "weak", ...(state.gold ? {gold:state.gold} : {}),
  };
  const gold = state.gold || 0;
  Object.assign(state, {wordsInAttack:0, characters:0, intervalCount:0, intervalSum:0, intervalSquares:0,
    orange:0, red:0, green:0, growth:0, shield:0, gold:0, dodgeExtraRolls:0,
    balancedPower:0, balancedQuality:quality, consistency:quality,
    balancedDefenseWord:false, balancedSkillWord:false,
    attackWords:state.ability === "monk" ? Math.ceil(10 / 2 ** gold) : 10});
  delete state.nextPowerBonus;
  return attack;
}

module.exports = { initializeBalanced, balancedWordColor, recordBalancedWord, releaseBalancedAttack };
