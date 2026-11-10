const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { entriesByLength, wordsByLength } = require("../src/typingProject/resources/homeRowWordBank");

test("all word-bank entries have consistent, bounded grade estimates or explicit review notes", () => {
  const seen = new Map();
  let count = 0;
  for (const [key, entries] of Object.entries(entriesByLength)) {
    assert.deepEqual(wordsByLength[key], entries.map(entry => entry.word));
    for (const entry of entries) {
      count++;
      assert.ok(["positive", "negative", "neutral"].includes(entry.sentiment));
      assert.equal(typeof entry.word, "string");
      assert.ok(entry.word.length > 0);
      if (entry.gradeLevel === null) assert.ok(entry.reviewNote);
      else assert.ok(Number.isInteger(entry.gradeLevel) && entry.gradeLevel >= 0 && entry.gradeLevel <= 12);
      if (seen.has(entry.word)) assert.equal(entry.gradeLevel, seen.get(entry.word));
      seen.set(entry.word, entry.gradeLevel);
    }
  }
  assert.equal(count, 1175);
  assert.equal(seen.size, 938);
  assert.deepEqual([...seen].filter(([, grade]) => grade === null).map(([word]) => word).sort(), []);
});

test("reviewed numeric pool keeps its audited content, order, and duplicate frequency", () => {
  const pool = Object.keys(wordsByLength).filter(key => !isNaN(Number(key))).flatMap(key => wordsByLength[key]);
  assert.equal(crypto.createHash("sha256").update(JSON.stringify(pool)).digest("hex"),
    "0e9453142d4e94f873bed9431aa64def528f33d9836c77715d3585ae1a0304a8");
  assert.deepEqual(wordsByLength.items, ["diamond", "ruby", "emerald", "sapphire", "gold"]);
  assert.deepEqual(wordsByLength.powerups, ["end", "time", "life"]);
});


test("grade and sentiment filters intersect, while multiple sentiments form a union", () => {
  const {filterWordsByLength} = require("../src/typingProject/resources/homeRowWordBank");
  const flat = bank => Object.keys(bank).filter(key => !isNaN(Number(key))).flatMap(key => bank[key]);
  assert.deepEqual(filterWordsByLength(), wordsByLength);
  for (const grades of [1, 3, 256, undefined]) {
    for (const sentiments of [1,2,3,4,5,6,7]) {
      const selected = flat(filterWordsByLength(grades, sentiments));
      const expected = Object.keys(entriesByLength).filter(key => !isNaN(Number(key))).flatMap(key => entriesByLength[key]).filter(entry =>
        (grades === undefined || entry.gradeLevel !== null && (grades & (1 << entry.gradeLevel))) &&
        (sentiments & (1 << ["positive","negative","neutral"].indexOf(entry.sentiment)))).map(entry => entry.word);
      assert.deepEqual(selected, expected);
    }
  }
  assert.ok(flat(filterWordsByLength(undefined, 1)).includes("joy"));
  assert.ok(flat(filterWordsByLength(undefined, 2)).includes("anxiety"));
  assert.ok(!flat(filterWordsByLength(undefined, 1)).includes("anxiety"));
  for (const word of Object.values(entriesByLength).flat()) {
    const duplicates = Object.values(entriesByLength).flat().filter(entry => entry.word === word.word);
    assert.ok(duplicates.every(entry => entry.sentiment === word.sentiment));
  }
});


test("the classroom review exclusions cannot reappear in any bucket", () => {
  const excluded = new Set(["ogle", "blazin", "slaps", "sus", "upn", "xen", "xylos", "jocky"]);
  for (const entry of Object.values(entriesByLength).flat()) assert.ok(!excluded.has(entry.word), entry.word);
});
