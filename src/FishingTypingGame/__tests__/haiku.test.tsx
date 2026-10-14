import React from 'react';
import { render, screen } from '@testing-library/react';
import { BALANCE } from '../engine/config';
import { seededRandom } from '../engine/encounters';
import { applyKey, createTyping } from '../engine/game';
import { HAIKU, HAIKU_BY_TEXT, HAIKU_SOURCE, haikuTypingText } from '../engine/haiku';
import { HAIKU_CHANCE, selectPhrase, targetCharacters } from '../engine/phrases';
import TypingChallenge from '../components/TypingChallenge';

declare const test: any, expect: any;

test('the collection has at least 100 distinct, traceable, fully typeable poems', () => {
  expect(HAIKU.length).toBeGreaterThanOrEqual(100);
  expect(new Set(HAIKU.map(p => p.id)).size).toBe(HAIKU.length);
  expect(HAIKU_BY_TEXT.size).toBe(HAIKU.length);
  expect(HAIKU_SOURCE).toMatchObject({ year: 1902, rights: 'Public domain', translator: 'Basil Hall Chamberlain' });
  HAIKU.forEach(poem => {
    expect(poem.author).toBeTruthy(); expect(poem.number).toBeGreaterThan(0);
    expect(poem.page).toBeGreaterThanOrEqual(243); expect(poem.page).toBeLessThanOrEqual(360);
    expect(poem.text).toBe(haikuTypingText(poem.lines));
    expect(poem.text).toMatch(/^[a-z]+(?: [a-z]+)*$/);
    expect(poem.text.length).toBeLessThanOrEqual(targetCharacters(BALANCE.maxWpm));
    let typing = createTyping(poem.text, 0);
    Array.from(poem.text).forEach((key, i) => { typing = applyKey(typing, key, 10 + i * 30); });
    expect(typing.finishedAt).toBeDefined(); expect(typing.errors).toBe(0);
  });
});

test('normalization expands elisions and preserves words, numbers and line separators', () => {
  expect(haikuTypingText(["Fall'n flow'r, o'er th' stream!", 'The figure "2" in snow.']))
    .toBe('fallen flower over the stream the figure two in snow');
  expect(haikuTypingText(["'Tis a show'r; I'll watch the sunflow'r.", "I've seen the heav'ns."]))
    .toBe('it is a shower i will watch the sunflower i have seen the heavens');
});

test('every poem can be selected whole at its matching difficulty, with no truncation or padding', () => {
  HAIKU.forEach(poem => {
    const wpm = poem.text.length * 60000 / (5 * BALANCE.challengeMs);
    const target = targetCharacters(wpm);
    const eligible = HAIKU.filter(p => Math.abs(p.text.length - target) <= BALANCE.phraseTolerance);
    const rolls = [0, (eligible.indexOf(poem) + 0.5) / eligible.length];
    expect(selectPhrase(wpm, () => rolls.shift()!)).toBe(poem.text);
  });
});

test('poems appear about half the time where they fit and never exceed the character tolerance', () => {
  const rng = seededRandom(1048); let poemCount = 0;
  for (let i = 0; i < 4000; i++) {
    const text = selectPhrase(80, rng);
    poemCount += Number(HAIKU_BY_TEXT.has(text));
    expect(Math.abs(text.length - targetCharacters(80))).toBeLessThanOrEqual(BALANCE.phraseTolerance);
  }
  expect(Math.abs(poemCount / 4000 - HAIKU_CHANCE)).toBeLessThan(.03);
  for (let wpm = 1; wpm <= 55; wpm++) {
    const text = selectPhrase(wpm, () => 0);
    expect(HAIKU_BY_TEXT.has(text)).toBe(false);
    expect(Math.abs(text.length - targetCharacters(wpm))).toBeLessThanOrEqual(BALANCE.phraseTolerance);
  }
});

test('the challenge credits poems without adding author names to the required typing', () => {
  const poem = HAIKU.find(p => p.number === 75)!;
  const view = render(<TypingChallenge typing={createTyping(poem.text, performance.now())} onKey={() => {}} onReady={() => {}} />);
  expect(screen.getByLabelText(`Type this phrase: ${poem.text}`)).toBeTruthy();
  expect(screen.getByText(`Haiku · ${poem.author}`)).toBeTruthy();
  expect(screen.getByText(`translated by ${HAIKU_SOURCE.translator}`)).toBeTruthy();
  view.rerender(<TypingChallenge typing={createTyping('calm lake', performance.now())} onKey={() => {}} onReady={() => {}} />);
  expect(screen.queryByText(/translated by/)).toBeNull();
});
