import React from "react";
import { act, createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ContinuousTyping } from "./ContinuousBattle";
import { createTypingState, wordAt } from "./proportionalRules";
import { submitTypingBossWords } from "./api";
import { acceptSessionSnapshot, applySessionPatch } from "./sessionPatch";
import { TypingBossSessionSnapshot } from "./types";
import { AttackProgressBar } from "./AttackProgress";

declare const test: any, expect: any, jest: any, beforeEach: any;

jest.mock("./api");
const submit = submitTypingBossWords as any;

beforeEach(() => {
  submit.mockReset();
  submit.mockImplementation(async (_id, _credentials, words) => ({ nextWord: words[words.length - 1][0] + 1 }));
});

function seedWithoutBlue() {
  for (let seed = 0; seed < 10000; seed++) {
    if (Array.from({ length: 10 }, (_, index) => wordAt(seed, index)).every(word => word.color !== "blue")) return seed;
  }
  return 0;
}
function typeWord(input: HTMLElement, text: string, finish = true) {
  for (const key of text + (finish ? " " : "")) fireEvent.keyDown(input, { key });
}
function displayedWord(input: HTMLElement) {
  return document.getElementById(input.getAttribute("aria-describedby")!).textContent;
}

test("errors remain after backspace, the word advances, and ten words send one batch", async () => {
  const seed = seedWithoutBlue();
  render(<ContinuousTyping sessionId="bossABC" credentials={{ code: "hero1234" }} state={createTypingState(seed)} active />);
  const input = screen.getByRole("textbox", { name: "Type the displayed word" });
  const first = wordAt(seed, 0).text;
  fireEvent.keyDown(input, { key: "!" });
  fireEvent.keyDown(input, { key: "Backspace" });
  typeWord(input, first.slice(1));
  expect(displayedWord(input)).toBe(wordAt(seed, 1).text);
  expect(submit).not.toHaveBeenCalled();
  for (let index = 1; index < 10; index++) typeWord(input, wordAt(seed, index).text, index !== 9);
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  expect(submit.mock.calls[0][2]).toHaveLength(10);
  expect(submit.mock.calls[0][2][0][1]).toBe(`!${first.slice(1)} `);
  expect(displayedWord(input)).toBe(wordAt(seed, 10).text);
});

test("blue defense submits immediately, and input continues during the pending request", async () => {
  let seed = 0;
  while (wordAt(seed, 0).color !== "blue") seed++;
  let complete: (value: { nextWord: number }) => void = () => {};
  submit.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  render(<ContinuousTyping sessionId="bossABC" credentials={{ hostToken: "local-test" }} state={createTypingState(seed)} active />);
  const input = screen.getByRole("textbox", { name: "Type the displayed word" });
  typeWord(input, wordAt(seed, 0).text);
  expect(submit).toHaveBeenCalledTimes(1);
  expect(submit.mock.calls[0][2]).toHaveLength(1);
  typeWord(input, wordAt(seed, 1).text);
  expect(displayedWord(input)).toBe(wordAt(seed, 2).text);
  await act(async () => complete({ nextWord: 1 }));
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
  expect(submit.mock.calls[1][2][0][0]).toBe(1);
});

test("inactive typing sends nothing", () => {
  const state = createTypingState(1);
  render(<ContinuousTyping sessionId="bossABC" credentials={{ code: "hero1234" }} state={state} active={false} />);
  const input = screen.getByRole("textbox", { name: "Type the displayed word" });
  typeWord(input, wordAt(state.seed, 0).text);
  expect(submit).not.toHaveBeenCalled();
  expect(displayedWord(input)).toBe(wordAt(state.seed, 0).text);
});

test("network patches preserve unchanged players and do not replay old projectiles", () => {
  const player = { code: "hero1", hp: 100 };
  const previous = { revision: 1, boss: { hp: 1500 }, players: [player, { code: "hero2", hp: 100 }], projectiles: [{ id: "a", amount: null }], status: "active" } as TypingBossSessionSnapshot;
  const next = applySessionPatch(previous, { revision: 2, boss: { hp: 1400 }, players: [{ code: "hero2", hp: 90 }], projectiles: [{ id: "a", amount: 10 } as any] });
  expect(next.players[0]).toBe(player);
  expect(next.players[1].hp).toBe(90);
  expect(next.projectiles).toHaveLength(1);
  expect(next.projectiles[0].amount).toBe(10);
  expect(applySessionPatch(next, { revision: 1, boss: { hp: 1500 } })).toBe(next);
  expect(previous.boss.hp).toBe(1500);
});

test("a delayed HTTP snapshot cannot roll back a newer combat update", () => {
  const current = { id: "bossABC", mode: "proportional", revision: 4, serverNow: 2000 } as TypingBossSessionSnapshot;
  expect(acceptSessionSnapshot(current, { ...current, revision: 3, serverNow: 1500 })).toBe(current);
  expect(acceptSessionSnapshot(current, { ...current, serverNow: 1900 })).toBe(current);
  const next = { ...current, revision: 5, serverNow: 2100 };
  expect(acceptSessionSnapshot(current, next)).toBe(next);
});

test("all ten words stay in one scrolling row, while each character builds damage and local charge", () => {
  const seed = seedWithoutBlue();
  render(<><AttackProgressBar sessionId="bossABC" actor="hero1234" label="Player attack progress" />
    <ContinuousTyping sessionId="bossABC" credentials={{ code: "hero1234" }} state={createTypingState(seed)} active /></>);
  const input = screen.getByRole("textbox", { name: "Type the displayed word" });
  const row = screen.getByTestId("ten-word-row");
  expect(row.querySelectorAll("[data-word-index]").length).toBe(10);
  typeWord(input, wordAt(seed, 0).text[0], false);
  expect(window.getComputedStyle(row).transform).toContain("-1ch");
  expect(Number(screen.getByRole("progressbar", { name: "Player attack progress" }).getAttribute("aria-valuenow"))).toBeGreaterThan(0);
});

test("native key timestamps drive the measured mean instead of handler execution time", async () => {
  const seed = seedWithoutBlue();
  render(<ContinuousTyping sessionId="bossABC" credentials={{ code: "hero1234" }} state={createTypingState(seed)} active />);
  const input = screen.getByRole("textbox", { name: "Type the displayed word" });
  let timestamp = 0;
  for (let index = 0; index < 10; index++) {
    for (const key of wordAt(seed, index).text + (index % 10 === 9 ? "" : " ")) {
      const event = createEvent.keyDown(input, { key });
      Object.defineProperty(event, "timeStamp", { value: timestamp });
      fireEvent(input, event);
      timestamp += 20;
    }
  }
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  const records = submit.mock.calls[0][2];
  const count = records.reduce((total, record) => total + record[2], 0);
  const sum = records.reduce((total, record) => total + record[3], 0);
  expect(sum / count).toBe(20);
  expect(records[0][2]).toBe(wordAt(seed, 0).text.length);
});


test("the last letter waits for a space, and that space adds damage and completes the word", () => {
  const state = createTypingState(seedWithoutBlue());
  render(<ContinuousTyping sessionId="bossABC" credentials={{code:"hero1234"}} state={state} active />);
  const input = screen.getByRole("textbox", {name:"Type the displayed word"});
  const first = wordAt(state.seed, 0).text;
  typeWord(input, first, false);
  expect(displayedWord(input)).toBe(first);
  fireEvent.keyDown(input, {key:" "});
  expect(displayedWord(input)).toBe(wordAt(state.seed, 1).text);
});


test("a long rest between attacks is excluded from the next attack's timing", async () => {
  const seed = seedWithoutBlue();
  render(<ContinuousTyping sessionId="bossABC" credentials={{code:"hero1234"}} state={createTypingState(seed)} active />);
  const input = screen.getByRole("textbox", {name:"Type the displayed word"});
  let timestamp = 0;
  for (let index = 0; index < 20; index++) {
    if (index === 10) timestamp += 60000;
    for (const key of wordAt(seed, index).text + (index % 10 === 9 ? "" : " ")) {
      const event = createEvent.keyDown(input, {key});
      Object.defineProperty(event, "timeStamp", {value:timestamp});
      fireEvent(input, event);
      timestamp += 20;
    }
  }
  await waitFor(() => expect(submit.mock.calls.flatMap((call: any) => call[2])).toHaveLength(20));
  const records = submit.mock.calls.flatMap((call: any) => call[2]);
  const second = records.filter((record: any) => record[0] >= 10);
  expect(second[0][2]).toBe(wordAt(seed, 10).text.length);
  expect(second.reduce((sum: number, record: any) => sum + record[3], 0) /
    second.reduce((sum: number, record: any) => sum + record[2], 0)).toBe(20);
});
