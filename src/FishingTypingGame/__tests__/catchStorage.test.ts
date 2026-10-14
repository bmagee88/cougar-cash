import { generateEncounter, seededRandom } from '../engine/encounters';
import { HAIKU, HAIKU_SOURCE } from '../engine/haiku';
import { awardCatch, deserializeSave, emptySave, releaseFishes } from '../engine/storage';

declare const test: any, expect: any;
const performance = { wpm: 75, accuracy: 100, timeRemaining: 1, correctCharacters: 60 };

test('a catch retains its exact typing text and a standalone haiku snapshot across serialization', () => {
  const poem = HAIKU.find(p => p.number === 75)!;
  const encounter = { ...generateEncounter(seededRandom(8)), phrase: poem.text };
  const save = awardCatch(emptySave(), encounter, performance);
  const memory = save.livewell[0].typing!;
  expect(memory).toEqual({ phrase: poem.text, haiku: { id: poem.id, author: poem.author, translator: HAIKU_SOURCE.translator, lines: poem.lines } });
  expect(memory.haiku!.lines).not.toBe(poem.lines);
  expect(deserializeSave(JSON.stringify(save))).toEqual(save);
  const ordinary = awardCatch(emptySave(), { ...encounter, phrase: 'calm lake' }, performance);
  expect(deserializeSave(JSON.stringify(ordinary)).livewell[0].typing).toEqual({ phrase: 'calm lake' });
});

test('older catches survive without invented poems and malformed memories do not erase a fish', () => {
  const save = awardCatch(emptySave(), generateEncounter(seededRandom(2)), performance);
  const { typing, ...legacy } = save.livewell[0];
  const loadMemory = (memory?: unknown) => deserializeSave(JSON.stringify({ ...save, livewell: [{ ...legacy, typing: memory }] }));
  expect(loadMemory().livewell).toEqual([legacy]);
  [null, false, 'wrong shape', { phrase: 4 }, { phrase: 'x'.repeat(513) }].forEach(memory => {
    expect(loadMemory(memory).livewell).toEqual([legacy]);
  });
  expect(loadMemory({ phrase: 'calm lake', haiku: { id: 'fake', author: {}, translator: 'translator', lines: ['lake'] } }).livewell[0].typing)
    .toEqual({ phrase: 'calm lake' });
  expect(loadMemory().stats).toEqual(save.stats);
});

test('batch release removes only selected IDs while awards, coins and every lifetime record remain intact', () => {
  let save = emptySave();
  const encounters = [1, 2, 3].map(seed => generateEncounter(seededRandom(seed), { isAlbino: seed === 1 }));
  encounters.forEach(encounter => { save = awardCatch(save, encounter, performance); });
  const released = releaseFishes(save, [encounters[0].id, encounters[2].id, encounters[0].id, 'unknown']);
  expect(released.livewell.map(fish => fish.id)).toEqual([encounters[1].id]);
  expect(released.stats).toBe(save.stats);
  expect(released.balance).toBe(save.balance);
  expect(released.awardedIds).toBe(save.awardedIds);
  expect(awardCatch(released, encounters[0], performance)).toBe(released);
  expect(releaseFishes(released, [])).toBe(released);
  expect(releaseFishes(released, ['unknown'])).toBe(released);
  expect(deserializeSave(JSON.stringify(released))).toEqual(released);
});
