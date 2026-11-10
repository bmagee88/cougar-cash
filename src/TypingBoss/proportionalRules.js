// Shared, deterministic rules. Only the seed and word index travel over the wire.
const { wordsByLength, entriesByLength, filterWordsByLength } = require("../typingProject/resources/homeRowWordBank");
const WORDS = Object.keys(wordsByLength)
  .filter(key => !isNaN(Number(key)))
  .flatMap(key => wordsByLength[key]);
const COLORS = ["blue", "orange", "red", "green"];
const ENTRIES = Object.keys(entriesByLength).filter(key => !isNaN(Number(key))).flatMap(key => entriesByLength[key]);
const GRADE_OPTIONS = Array.from({ length: 13 }, (_, grade) => ({ grade,
  count: ENTRIES.filter(entry => entry.gradeLevel === grade).length }));
const pools = new Map();
function wordsForGrades(mask, sentimentMask) {
  if (mask === undefined && sentimentMask === undefined) return WORDS;
  if (mask !== undefined && (!Number.isInteger(mask) || mask < 1 || mask > 8191)) throw new Error("Choose at least one available grade.");
  if (sentimentMask !== undefined && (!Number.isInteger(sentimentMask) || sentimentMask < 1 || sentimentMask > 7)) throw new Error("Choose at least one sentiment.");
  const key = `${mask}:${sentimentMask}`;
  if (!pools.has(key)) {
    const bank = filterWordsByLength(mask, sentimentMask);
    pools.set(key, Object.keys(bank).filter(key => !isNaN(Number(key))).flatMap(key => bank[key]));
  }
  const pool = pools.get(key);
  if (!pool.length) throw new Error("No words match the selected grades and sentiments.");
  return pool;
}

function randomAt(seed, index, salt) {
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b1) ^ salt) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 4294967296;
}

function wordAt(seed, index, gradeMask, sentimentMask) {
  const pool = wordsForGrades(gradeMask, sentimentMask);
  return {
    text: pool[Math.floor(randomAt(seed, index, 1) * pool.length)],
    color: randomAt(seed, index, 2) < 0.3
      ? COLORS[Math.floor(randomAt(seed, index, 3) * COLORS.length)] : null,
  };
}

// Allow 200 ms of timing variation at any speed, then normalize excess jitter
// against the observed mean. Long pauses still affect even a fast attack.
function consistencyMultiplier(count, sum, sumSquares) {
  if (count < 2 || sum <= 0) return 1;
  const mean = sum / count;
  const deviation = Math.sqrt(Math.max(0, sumSquares / count - mean * mean));
  return Math.max(0.5, Math.min(1.5, 1.5 - Math.max(0, deviation - 200) / Math.max(200, mean)));
}

function attackProgress(seed, wordIndex, characters, gradeMask, sentimentMask) {
  const start = Math.floor(wordIndex / 10) * 10;
  let completed = characters;
  let total = 0;
  for (let index = start; index < start + 10; index++) {
    const length = wordAt(seed, index, gradeMask, sentimentMask).text.length + (index % 10 === 9 ? 0 : 1);
    total += length;
    if (index < wordIndex) completed += length;
  }
  return Math.min(100, Math.max(0, completed / total * 100));
}

function createTypingState(seed) {
  return { seed, nextWord: 0, wordsInAttack: 0, characters: 0,
    intervalCount: 0, intervalSum: 0, intervalSquares: 0,
    orange: 0, red: 0, green: 0, growth: 0, shield: 0,
    consistency: 1, totalTaken: 0, totalCharacters: 0, dodgeSamples: [] };
}

function dodgeChance(state) {
  const samples = state.dodgeSamples;
  return samples?.length ? Math.round(samples.reduce((total, score) => total + score, 0) / samples.length) : 0;
}

function finishWord(state, text, count, sum, squares, transitionMs) {
  const word = wordAt(state.seed, state.nextWord, state.gradeMask, state.sentimentMask);
  const correct = text === word.text + (state.nextWord % 10 === 9 ? "" : " ");
  if (state.dodgeSamples && state.nextWord % 10 !== 0 && count > 1 && Number.isFinite(transitionMs)) {
    // Compare Space → first character with the rest of that word's key gaps.
    const pace = Math.max(40, (sum - transitionMs) / (count - 1));
    const ratio = transitionMs / pace;
    const score = Math.round(25 * Math.max(0, Math.min(1, (2.5 - ratio) / 1.25)));
    state.dodgeSamples = [...state.dodgeSamples.slice(-4), score];
  }
  state.nextWord += 1;
  state.wordsInAttack += 1;
  state.characters += [...text].reduce((total, letter, index) => total + (letter === (word.text + " ")[index] ? 1 : 0), 0);
  state.totalCharacters += text.length;
  state.intervalCount += count;
  state.intervalSum += sum;
  state.intervalSquares += squares;
  if (correct) {
    state.growth += state.green * 0.04;
    if (word.color === "blue") state.shield = Math.min(1, state.shield + 0.1);
    if (word.color === "orange") state.orange += 0.1;
    if (word.color === "red") state.red = Math.min(1, state.red + 0.1);
    if (word.color === "green") state.green += 1;
  }
  return { correct, color: word.color };
}

function releaseAttack(state, random = Math.random) {
  const consistency = consistencyMultiplier(state.intervalCount, state.intervalSum, state.intervalSquares);
  const critical = random() < state.red;
  const multiplier = consistency * (1 + state.orange + state.growth) * (critical ? 2 : 1);
  const attack = { base: state.characters, power: state.characters * multiplier,
    orangeBonus: state.orange, greenBonus: state.growth, greenStacks: state.green, criticalChance: state.red,
    blueShield: state.shield,
    meanIntervalMs: state.intervalCount ? state.intervalSum / state.intervalCount : 0,
    intervalStdDevMs: state.intervalCount ? Math.sqrt(Math.max(0, state.intervalSquares / state.intervalCount - (state.intervalSum / state.intervalCount) ** 2)) : 0,
    multiplier, critical, consistency, moveId: multiplier >= 2 ? "strong" : "weak" };
  Object.assign(state, { wordsInAttack: 0, characters: 0, intervalCount: 0,
    intervalSum: 0, intervalSquares: 0, orange: 0, red: 0, green: 0, growth: 0, consistency });
  return attack;
}

module.exports = { WORDS, GRADE_OPTIONS, wordsForGrades, wordAt, consistencyMultiplier, createTypingState, finishWord, releaseAttack, attackProgress, dodgeChance };
