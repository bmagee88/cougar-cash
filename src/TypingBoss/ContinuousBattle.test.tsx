import React from "react";
import { act, createEvent, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ContinuousTyping } from "./ContinuousBattle";
import { createTypingState, initializeBalanced, typingWord, wordAt } from "./proportionalRules";
import { submitTypingBossWords } from "./api";
import { acceptSessionSnapshot, applySessionPatch } from "./sessionPatch";
import { TypingBossPlayer, TypingBossSessionSnapshot } from "./types";
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

function scheduledTrigger(state:any,color:string,position:number) {
  Object.assign(state,{balancedOrangeAt:1e9,balancedCritAt:1e9,balancedBlueAt:1e9,balancedSpecialAt:1e9,balancedGreenAt:1e9,balancedCharacters:position});
  state[color==='gold'?'balancedSpecialAt':color==='red'?'balancedCritAt':`balanced${color[0].toUpperCase()+color.slice(1)}At`]=position;
}
const profilePlayer = { code: "hero1234", name: "CalmFox", classId: "cleric", color: "#facc15", maxHp: 100, hp: 100, defeated: false } as TypingBossPlayer;
test('protected typing never advances on wrong keys, preserves ATK, and cannot claim a perfect trigger after correction',async()=>{
  submit.mockImplementation(()=>new Promise(()=>{}));
  const state=initializeBalanced(createTypingState(123,'cleric'));
  scheduledTrigger(state,'red',134);state.balancedCritCharge=10;
  const word=typingWord(state);state.wordProtocol=1;
  state.issuedWords=[{...word,index:0,ticket:'a'.repeat(32)},{text:'next',color:null,index:1,ticket:'b'.repeat(32)}];
  render(<ContinuousTyping sessionId="bossABC" credentials={{code:profilePlayer.code,playerToken:'c'.repeat(64)}} state={state} active profile={{player:profilePlayer,events:[]}}/>);
  const input=screen.getByRole('textbox');
  fireEvent.keyDown(input,{key:'!'});
  expect(screen.getByText('ATK 0')).toBeTruthy();expect(submit).not.toHaveBeenCalled();
  expect(screen.getByRole('status').textContent).toMatch(/highlighted letter/);
  fireEvent.keyDown(input,{key:word.text[0]});
  fireEvent.keyDown(input,{key:'!'});expect(screen.getByText('ATK 1')).toBeTruthy();
  typeWord(input,word.text.slice(1),false);
  expect(screen.getByText(`ATK ${word.text.length}`)).toBeTruthy();
  expect(screen.queryByTestId('portrait-crit-badge')).toBeNull();
  const record=submit.mock.calls[0][2][0];
  expect(record[1]).toBe(word.text);expect(record[7]).toEqual({ticket:'a'.repeat(32),mistakes:2});
  await act(async()=>{});
});

test('protected typing waits at the issued window and resumes from word acknowledgements',async()=>{
  let resolve:any;
  submit.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
  const state=initializeBalanced(createTypingState(123,'barbarian'));state.wordProtocol=1;
  state.issuedWords=[{index:0,text:'cat',color:'orange',ticket:'a'.repeat(32)},{index:1,text:'dog',color:'orange',ticket:'b'.repeat(32)}];
  render(<ContinuousTyping sessionId="bossABC" credentials={{code:'hero1234',playerToken:'c'.repeat(64)}} state={state} active/>);
  const input=screen.getByRole('textbox');typeWord(input,'cat');typeWord(input,'dog');
  expect(screen.getByRole('status').textContent).toMatch(/Loading/);
  fireEvent.keyDown(input,{key:'!'});expect(screen.getByText('ATK 6')).toBeTruthy();
  await act(async()=>resolve({nextWord:1,issuedWords:[state.issuedWords![1],{index:2,text:'bird',color:'orange',ticket:'d'.repeat(32)}]}));
  expect(screen.queryByText(/Loading the next words/)).toBeNull();
  expect(submit).toHaveBeenCalledTimes(2);
  expect(submit.mock.calls[1][2][0][0]).toBe(1);
});
test('ordinary blue words bank power without an active shield or defense numbers',async()=>{
  const state=initializeBalanced(createTypingState(123,'cleric'));state.balancedCharacters=20;
  render(<ContinuousTyping sessionId="bossABC" credentials={{code:profilePlayer.code}} state={state} active profile={{player:profilePlayer,events:[]}}/>);
  const input=screen.getByRole('textbox'),word=typingWord(state).text;
  fireEvent.keyDown(input,{key:word[0]});
  expect(screen.getByLabelText('Attack letters: 1')).toBeTruthy();
  expect(screen.getByTestId('portrait-shield').style.opacity).toBe('0');
  typeWord(input,word.slice(1),false);
  expect(screen.getByLabelText(`Attack letters: ${word.length}`)).toBeTruthy();
  expect(screen.queryByText(/^Block [0-9]/)).toBeNull();
  expect(screen.queryByText(/^Dodge [0-9]/)).toBeNull();
  expect(screen.getByTestId('portrait-shield').style.opacity).toBe('0');
  expect(submit).toHaveBeenCalledTimes(1);
  expect(submit.mock.calls[0][2][0][1]).toBe(word);
  await act(async()=>{});
});

test('a perfect glowing blue trigger activates saved Block on its last letter',async()=>{
  const state=initializeBalanced(createTypingState(123,'cleric'));
  scheduledTrigger(state,'blue',140);state.balancedBlockBank=20;
  render(<ContinuousTyping sessionId="bossABC" credentials={{code:profilePlayer.code}} state={state} active profile={{player:profilePlayer,events:[]}}/>);
  expect(screen.getAllByTestId('typing-word')[0].getAttribute('data-trigger')).toBe('true');
  const input=screen.getByRole('textbox'),word=typingWord(state).text;
  typeWord(input,word.slice(0,-1),false);
  expect(screen.getByTestId('portrait-shield').style.opacity).toBe('0');
  fireEvent.keyDown(input,{key:word.slice(-1)});
  expect(Number(screen.getByTestId('portrait-shield').style.opacity)).toBeGreaterThan(0);
  expect(screen.getByText('Block ready')).toBeTruthy();
  expect(submit).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(input,{key:' '});
  expect(submit).toHaveBeenCalledTimes(1);
  await act(async()=>{});
});

test('cadence responds on the first letter, commits before Space, and resets after firing',async()=>{
  const state=initializeBalanced(createTypingState(123,'monk'));state.attackWords=1;
  render(<ContinuousTyping sessionId="bossABC" credentials={{code:profilePlayer.code}} state={state} active/>);
  const input=screen.getByRole('textbox'),word=typingWord(state).text;
  fireEvent.keyDown(input,{key:word[0]});
  expect(screen.getByText('Cadence ×1.0025')).toBeTruthy();
  typeWord(input,word.slice(1),false);
  expect(screen.getByText('Cadence ×1.0000')).toBeTruthy();
  expect(screen.getByText('ATK 0')).toBeTruthy();
  expect(submit).toHaveBeenCalledTimes(1);
  expect(submit.mock.calls[0][2][0][1]).toBe(word);
  fireEvent.keyDown(input,{key:' '});
  expect(screen.getByText('ATK 0')).toBeTruthy();
  await act(async()=>{});
});

test('pending Dodge stays invisible until a perfect green trigger activates it',async()=>{
  const state=initializeBalanced(createTypingState(123,'rogue'));
  scheduledTrigger(state,'green',160);state.balancedDodgeBank=20;
  render(<ContinuousTyping sessionId="bossABC" credentials={{code:profilePlayer.code}} state={state} active profile={{player:profilePlayer,events:[]}}/>);
  const input=screen.getByRole('textbox'),word=typingWord(state).text;
  typeWord(input,word.slice(0,-1),false);
  expect(screen.getByTestId('portrait-dodge').style.opacity).toBe('0');
  fireEvent.keyDown(input,{key:word.slice(-1)});
  expect(Number(screen.getByTestId('portrait-dodge').style.opacity)).toBeCloseTo(Math.sqrt(.2));
  expect(screen.getByText('Dodge ready')).toBeTruthy();
  expect(screen.queryByText(/^Dodge [0-9]/)).toBeNull();
  await act(async()=>{});
});

test("Cleric sees Prayer and the shared pool, and an orange word deposits instead of adding Power",async()=>{
  submit.mockImplementation(()=>new Promise(()=>{}));
  const state=initializeBalanced(createTypingState(123,'cleric'));scheduledTrigger(state,'orange',120);state.balancedHealingBank=10;
  render(<ContinuousTyping sessionId="bossABC" credentials={{code:profilePlayer.code}} state={state} active healingPool={50} profile={{player:profilePlayer,events:[]}}/>);
  expect(screen.getByText('Prayer +10')).toBeTruthy();expect(screen.getByText('Prayer pool 50')).toBeTruthy();
  expect(screen.queryByText(/^Charge /)).toBeNull();
  expect(screen.queryByLabelText(/^Power bonus:/)).toBeNull();
  const prayerLetter=screen.getAllByTestId('typing-word')[0].querySelector('span')!;
  expect(prayerLetter.style.color).toBe('rgb(250, 204, 21)');
  expect(prayerLetter.style.textShadow).toContain('0 0 8px');
  typeWord(screen.getByRole('textbox'),typingWord(state).text);
  expect(screen.getByText('Prayer +0')).toBeTruthy();
  expect(screen.getByText(/^Prayer pool \+/)).toBeTruthy();expect(submit).toHaveBeenCalledTimes(1);
  await act(async()=>{});
});

test('Prayer mistakes preserve saved charge and ATK',()=>{
  const state=initializeBalanced(createTypingState(123,'cleric'));
  state.balancedRandomColors=true;while(typingWord(state).color!=='orange')state.seed++;
  Object.assign(state,{characters:8,balancedPower:10,balancedHealingBank:4});
  render(<ContinuousTyping sessionId="bossABC" credentials={{code:profilePlayer.code}} state={state} active profile={{player:profilePlayer,events:[]}}/>);
  const input=screen.getByRole('textbox');
  fireEvent.keyDown(input,{key:'!'});
  expect(screen.getByText('Prayer +4')).toBeTruthy();expect(screen.getByLabelText('Attack letters: 8')).toBeTruthy();
  fireEvent.keyDown(input,{key:'!'});
  expect(screen.getByText('Prayer +4')).toBeTruthy();expect(screen.getByLabelText('Attack letters: 8')).toBeTruthy();
});

test("banks update with each character while red activation still waits for the completed word",async()=>{
  submit.mockImplementation(()=>new Promise(()=>{}));
  const state=initializeBalanced(createTypingState(123,"cleric"));scheduledTrigger(state,"red",134);state.balancedCritCharge=10;
  render(<ContinuousTyping sessionId="bossABC" credentials={{code:profilePlayer.code}} state={state} active profile={{player:profilePlayer,events:[]}}/>);
  const input=screen.getByRole("textbox"),word=typingWord(state).text;
  fireEvent.keyDown(input,{key:word[0]});
  expect(screen.getByText(/^Crit charge \+10\.1[23]%$/)).toBeTruthy();
  expect(screen.getByText("Prayer +0")).toBeTruthy();
  expect(screen.queryByTestId("portrait-crit-badge")).toBeNull();
  typeWord(input,word.slice(1),false);
  expect(screen.getByTestId("portrait-crit-badge")).toBeTruthy();
  fireEvent.keyDown(input,{key:" "});
  expect(screen.getByTestId("portrait-crit-badge")).toBeTruthy();
  expect(screen.getByText("Crit charge +0%")).toBeTruthy();
  expect(submit).toHaveBeenCalledTimes(1);
  await act(async()=>{});
});

test("host dragon profile sits beside typing and immediately displays its own letters and ready crit",async()=>{
  submit.mockImplementation(()=>new Promise(()=>{}));
  const state=initializeBalanced(createTypingState(123,"dragon"));scheduledTrigger(state,"red",134);state.balancedCritCharge=10;
  render(<ContinuousTyping sessionId="bossABC" credentials={{hostToken:"test-host"}} state={state} active hostProfile={{boss:{id:"infernalDragon",name:"Dragon",hp:100,maxHp:100,glow:"red"} as any,events:[]}}/>);
  const portrait=screen.getByTestId("host-dragon-portrait");
  expect(portrait.parentElement!.className).toContain("typing-input-deck");
  const input=screen.getByRole("textbox"),word=typingWord(state).text;
  fireEvent.keyDown(input,{key:word[0]});expect(within(portrait).getByLabelText("Dragon attack letters: 1")).toBeTruthy();
  typeWord(input,word.slice(1));
  expect(within(portrait).getByRole("status").textContent).toMatch(/CRIT\+/);
  expect(screen.getByText("Crit charge +0%")).toBeTruthy();
  await act(async()=>{});
});

test.each(["barbarian","dragon"])("%s gold reveals two extra words on the last letter and keeps them through the separator and pending server response", async (ability:any)=>{
  submit.mockImplementation(()=>new Promise(()=>{}));
  const state=initializeBalanced(createTypingState(123,ability));
  scheduledTrigger(state,"gold",150);
  const view=render(<ContinuousTyping sessionId="bossABC" credentials={{code:"hero1234"}} state={state} active/>);
  const input=screen.getByRole("textbox"),gold=typingWord(state).text;
  expect(screen.getAllByTestId("typing-word")).toHaveLength(10);
  typeWord(input,gold.slice(0,-1),false);
  expect(screen.getAllByTestId("typing-word")).toHaveLength(10);
  fireEvent.keyDown(input,{key:gold.slice(-1)});
  expect(screen.getAllByTestId("typing-word")).toHaveLength(12);
  fireEvent.keyDown(input,{key:" "});
  expect(screen.getAllByTestId("typing-word")).toHaveLength(12);
  expect(submit).toHaveBeenCalledTimes(1);
  view.rerender(<ContinuousTyping sessionId="bossABC" credentials={{code:"hero1234"}} state={{...state}} active/>);
  expect(screen.getAllByTestId("typing-word")).toHaveLength(12);
  await act(async()=>{});
});

test("a missed extension trigger never adds preview words",()=>{
  const state=initializeBalanced(createTypingState(123,"barbarian"));scheduledTrigger(state,"gold",150);
  render(<ContinuousTyping sessionId="bossABC" credentials={{code:"hero1234"}} state={state} active/>);
  typeWord(screen.getByRole("textbox"),`!${typingWord(state).text.slice(1)}`);
  expect(screen.getAllByTestId("typing-word")).toHaveLength(10);
});

test("red trigger immediately moves charge into the profile badge; new charge builds separately and firing clears ready effects", async () => {
  submit.mockImplementation(()=>new Promise(()=>{}));
  const state=initializeBalanced(createTypingState(123,"cleric"));
  scheduledTrigger(state,"red",134);state.balancedCritCharge=10;
  render(<ContinuousTyping sessionId="bossABC" credentials={{code:profilePlayer.code}} state={state} active profile={{player:profilePlayer,events:[]}}/>);
  const input=screen.getByRole("textbox",{name:"Type the displayed word"});
  expect(screen.getByText("Crit charge +10%")).toBeTruthy();
  expect(screen.queryByTestId("portrait-crit-badge")).toBeNull();
  typeWord(input,typingWord(state).text);
  const badge=screen.getByTestId("portrait-crit-badge"), ready=badge.textContent;
  expect(ready).toMatch(/CRIT\+1[0-9.]*%/);
  expect(screen.getByTestId("portrait-crit-aura")).toBeTruthy();
  expect(screen.getByText("Crit charge +0%")).toBeTruthy();
  expect(submit).toHaveBeenCalledTimes(1); // Ready before any HTTP response.
  typeWord(input,typingWord(state,1).text);
  expect(screen.getByTestId("portrait-crit-badge").textContent).toBe(ready);
  expect(screen.getByText("Crit charge +0%")).toBeTruthy();
  for(let i=2;i<10;i++) typeWord(input,typingWord(state,i).text,i!==9);
  expect(screen.queryByTestId("portrait-crit-badge")).toBeNull();
  expect(screen.queryByTestId("portrait-crit-aura")).toBeNull();
  await act(async()=>{});
});

test("a missed red trigger keeps the charge and never shows ready crit effects",()=>{
  const state=initializeBalanced(createTypingState(123,"cleric"));
  scheduledTrigger(state,"red",134);state.balancedCritCharge=10;
  render(<ContinuousTyping sessionId="bossABC" credentials={{code:profilePlayer.code}} state={state} active profile={{player:profilePlayer,events:[]}}/>);
  typeWord(screen.getByRole("textbox"),`!${typingWord(state).text.slice(1)}`);
  expect(screen.queryByTestId("portrait-crit-badge")).toBeNull();
  expect(screen.queryByTestId("portrait-crit-aura")).toBeNull();
  expect(screen.queryByText("Crit charge +0%")).toBeNull();
});

test("portrait letters and shield react locally, and completed words show their earned bonus", async () => {
  const state = createTypingState(0, "cleric");
  while (typingWord(state).color !== "blue") state.seed++;
  render(<ContinuousTyping sessionId="bossABC" credentials={{ code: profilePlayer.code }} state={state} active profile={{ player: profilePlayer, events: [] }} />);
  const input = screen.getByRole("textbox", { name: "Type the displayed word" });
  const word = typingWord(state).text;
  fireEvent.keyDown(input, { key: word[0] });
  expect(screen.getByLabelText("Attack letters: 1").className).toContain("portrait-attack-pulse");
  typeWord(input, word.slice(1));
  expect(screen.getByTestId("portrait-shield").style.opacity).toBe(String(Math.sqrt(.1)));
  expect(screen.getByText("Block +10%")).toBeTruthy();
  fireEvent.animationEnd(screen.getByTestId("word-reward"));
  expect(screen.queryByTestId("word-reward")).toBeNull();
  await act(async () => {});
});

test("a perfect special charges the portrait immediately and the aura clears on attack release", async () => {
  const state = createTypingState(0, "cleric");
  while (typingWord(state).color !== "gold") state.seed++;
  render(<ContinuousTyping sessionId="bossABC" credentials={{ code: profilePlayer.code }} state={state} active profile={{ player: profilePlayer, events: [] }} />);
  const input = screen.getByRole("textbox", { name: "Type the displayed word" });
  typeWord(input, typingWord(state).text);
  expect(screen.getByTestId("portrait-special").getAttribute("data-charged")).toBe("true");
  expect(screen.getByText("Special charged!")).toBeTruthy();
  for (let index = 1; index < 10; index++) typeWord(input, typingWord(state, index).text, index !== 9);
  expect(screen.getByTestId("portrait-special").getAttribute("data-charged")).toBe("false");
  expect(screen.getByLabelText("Attack letters: 0")).toBeTruthy();
  await waitFor(() => expect(submit).toHaveBeenCalled());
  await act(async () => {});
});

test("an incorrect special word never charges the aura or announces a special bonus", () => {
  const state = createTypingState(0, "cleric");
  while (typingWord(state).color !== "gold") state.seed++;
  render(<ContinuousTyping sessionId="bossABC" credentials={{ code: profilePlayer.code }} state={state} active profile={{ player: profilePlayer, events: [] }} />);
  const input = screen.getByRole("textbox", { name: "Type the displayed word" });
  typeWord(input, `!${typingWord(state).text.slice(1)}`);
  expect(screen.getByTestId("portrait-special").getAttribute("data-charged")).toBe("false");
  expect(screen.queryByText("Special charged!")).toBeNull();
  expect(screen.getByText("Entered · no bonus")).toBeTruthy();
});

test("balanced client sends verifiable key gaps and shows readiness instead of a dodge roll", async () => {
  const state = initializeBalanced(createTypingState(123, "cleric"));
  render(<ContinuousTyping sessionId="bossABC" credentials={{code:"hero1234"}} state={state} active />);
  expect(screen.queryByText(/^Dodge [0-9]/)).toBeNull();
  expect(screen.getByText("Cadence ×1.0000")).toBeTruthy();
  expect(screen.queryByText(/^Block [0-9]/)).toBeNull();
  expect(screen.queryByText(/^Special \d/)).toBeNull();
  const input = screen.getByRole("textbox", {name:"Type the displayed word"});
  let timestamp=0;
  for(let index=0;index<10;index++) {
    for(const key of typingWord(state,index).text+(index===9?"":" ")) {
      const event=createEvent.keyDown(input,{key});
      Object.defineProperty(event,"timeStamp",{value:timestamp});
      fireEvent(input,event);timestamp+=150;
    }
  }
  await waitFor(()=>expect(submit.mock.calls.flatMap((call:any)=>call[2])).toHaveLength(10));
  const records=submit.mock.calls.flatMap((call:any)=>call[2]);
  expect(records[0][5]).toBeNull();
  expect(records[0][6]).toHaveLength(records[0][2]);
  expect(records[1][5]).toBe(150);
  expect(records.every((record:any)=>record[6].every((gap:number)=>gap===150))).toBe(true);
});

test("dragon and player profile attack text grow at a two-to-one rate", () => {
  const state=createTypingState(123,"cleric");
  render(<ContinuousTyping sessionId="bossABC" credentials={{code:profilePlayer.code}} state={state} active profile={{player:profilePlayer,events:[]}}
    dragonProfile={{boss:{id:"infernalDragon",name:"Dragon",hp:100,maxHp:100,glow:"red",attackCharacters:1} as any,events:[]}} />);
  fireEvent.keyDown(screen.getByRole("textbox"),{key:typingWord(state).text[0]});
  const own=screen.getByLabelText("Attack letters: 1").querySelector("strong")!;
  const boss=screen.getByLabelText("Dragon attack letters: 1").querySelector("strong")!;
  expect(parseFloat(boss.style.fontSize)-21).toBeCloseTo(2*(parseFloat(own.style.fontSize)-21));
});

test("a monk's shortened row fires on its final letter and returns to ten without gold", async () => {
  const state = createTypingState(0, "monk");
  state.attackWords = 5;
  while (Array.from({ length: 5 }, (_, index) => typingWord(state, index)).some(word => word.color === "gold")) state.seed++;
  render(<ContinuousTyping sessionId="bossABC" credentials={{ code: "hero1234" }} state={state} active />);
  const input = screen.getByRole("textbox", { name: "Type the displayed word" });
  expect(screen.queryByText(/words this attack/)).toBeNull();
  expect(within(screen.getByTestId("ten-word-row")).getAllByTestId("typing-word")).toHaveLength(5);
  for (let index = 0; index < 5; index++) typeWord(input, typingWord(state, index).text, index !== 4);
  await waitFor(() => expect(submit.mock.calls.flatMap((call: any) => call[2])).toHaveLength(5));
  const records = submit.mock.calls.flatMap((call: any) => call[2]);
  expect(records[4][1]).toBe(typingWord(state, 4).text);
  expect(screen.queryByText(/words this attack/)).toBeNull();
  expect(within(screen.getByTestId("ten-word-row")).getAllByTestId("typing-word")).toHaveLength(10);
});

test("errors remain after backspace and an older backend still receives one ten-word batch", async () => {
  const seed = seedWithoutBlue();
  render(<ContinuousTyping sessionId="bossABC" credentials={{ code: "hero1234" }} state={{ ...createTypingState(seed), dodgeSamples: undefined }} active />);
  const input = screen.getByRole("textbox", { name: "Type the displayed word" });
  expect(screen.getByText("Dodge 0")).toBeTruthy();
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
  expect(within(row).getAllByTestId("typing-word")).toHaveLength(10);
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
  await waitFor(() => expect(submit.mock.calls.flatMap((call: any) => call[2])).toHaveLength(10));
  const records = submit.mock.calls.flatMap((call: any) => call[2]);
  const count = records.reduce((total, record) => total + record[2], 0);
  const sum = records.reduce((total, record) => total + record[3], 0);
  expect(sum / count).toBe(20);
  expect(records[0][2]).toBe(wordAt(seed, 0).text.length);
  expect(records[0]).toHaveLength(5);
  expect(records[1][5]).toBe(20);
  expect(screen.getByText("Dodge 9")).toBeTruthy();
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
  expect(second[0]).toHaveLength(5);
  expect(second[1][5]).toBe(20);
  expect(second.reduce((sum: number, record: any) => sum + record[3], 0) /
    second.reduce((sum: number, record: any) => sum + record[2], 0)).toBe(20);
});
