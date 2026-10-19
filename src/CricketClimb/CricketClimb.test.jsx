import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import CricketClimb from "./CricketClimb";
import * as engine from "./engine";
import * as audio from "./audio";
import { SKILLS } from "./resources";
import { PROGRESS_KEY, snapshotProgress } from "./progress";
import { TokenArt } from "./QuestionClues";
import { COMPUTER_TOOLS } from "./discoveryResources";

jest.mock("react-router-dom", () => ({ Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });
jest.mock("./audio", () => ({
  ...jest.requireActual("./audio"), cancelSpeech: jest.fn(), speak: jest.fn(() => Promise.resolve(true)),
  GardenAudio: jest.fn().mockImplementation(() => Object.fromEntries(
    ["unlock", "jump", "superJump", "suspense", "fall", "land", "correct", "fanfare", "cricket", "close"].map(name => [name, jest.fn()])
  )),
}));

const actualCreateRun = engine.createRun;
let settings;
beforeEach(() => {
  jest.useFakeTimers(); jest.setSystemTime(new Date("2026-10-19T00:00:00Z"));
  localStorage.clear();
  // Keep the original game-rule/timing fixtures stable as new topics are added.
  settings = { ...engine.DEFAULT_SETTINGS, skills: SKILLS.filter(skill => !["devices", "keyboard", "navigation", "web", "files", "safety", "thinking", "troubleshooting", "accessibility"].includes(skill.id)).map(skill => skill.id), voice: false };
  localStorage.setItem(engine.SETTINGS_KEY, JSON.stringify(settings));
  window.matchMedia = jest.fn(() => ({ matches: false }));
  global.ResizeObserver = class { observe() {} disconnect() {} };
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  jest.spyOn(engine, "createRun").mockImplementation((seed, rules) => actualCreateRun("ui-test", rules));
  audio.speak.mockImplementation(() => Promise.resolve(true));
  audio.GardenAudio.mockImplementation(() => Object.fromEntries(
    ["unlock", "jump", "superJump", "suspense", "fall", "land", "correct", "fanfare", "cricket", "close"].map(name => [name, jest.fn()])
  ));
});
afterEach(() => { cleanup(); jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); jest.clearAllMocks(); });
async function advance(ms) { await act(async () => { jest.advanceTimersByTime(ms); }); }
async function start() {
  fireEvent.click(screen.getByRole("button", { name: /A fresh little climb! Start over/ }));
  await advance(3000); await advance(1000);
}
const answers = () => screen.getAllByRole("button", { name: /^Answer / });
async function finishReturnJump() {
  await advance(750); await advance(2300); await advance(300); await advance(700);
}

test("answer taps stay locked during reading and thinking, then lock immediately after one choice", async () => {
  render(<CricketClimb />);
  fireEvent.click(screen.getByRole("button", { name: /A fresh little climb! Start over/ }));
  answers().forEach(button => expect(button).toBeDisabled());
  fireEvent.click(answers()[0]);
  expect(screen.getByText("Look closely at the question…")).toBeInTheDocument();
  await advance(3000);
  expect(screen.getByText("Take a little thinking time…")).toBeInTheDocument();
  answers().forEach(button => expect(button).toBeDisabled());
  await advance(1000);
  answers().forEach(button => expect(button).toBeEnabled());
  fireEvent.click(answers()[0]); fireEvent.click(answers()[1]);
  answers().forEach(button => expect(button).toBeDisabled());
  expect(document.querySelectorAll(".cc-leaf--selected")).toHaveLength(1);
});

test("leaves hold for three full seconds of suspense and a correct answer saves the completed level", async () => {
  render(<CricketClimb />); await start();
  const run = actualCreateRun("ui-test", settings);
  fireEvent.click(answers()[run.rows[1].correctLane]);
  await advance(700);
  expect(screen.getByLabelText("3 seconds of suspense")).toBeInTheDocument();
  await advance(1000); expect(screen.getByLabelText("2 seconds of suspense")).toBeInTheDocument();
  await advance(1000); expect(screen.getByLabelText("1 seconds of suspense")).toBeInTheDocument();
  expect(document.querySelectorAll(".cc-leaf--open")).toHaveLength(0);
  expect(localStorage.getItem(engine.SCORES_KEY)).toBeNull();
  await advance(1000);
  expect(document.querySelectorAll(".cc-leaf--open")).toHaveLength(settings.platforms - 1);
  expect(JSON.parse(localStorage.getItem(engine.SCORES_KEY))[engine.scoreKey(settings)]).toBe(1);
  await advance(1000);
  await advance(600);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(engine.questionFor("ui-test", 2, settings).prompt);
});

test("a wrong answer falls straight down and retries the same question with reordered choices", async () => {
  render(<CricketClimb />); await start();
  const initial = actualCreateRun("ui-test", settings), row = initial.rows[1];
  const before = answers().map(button => button.getAttribute("aria-label"));
  fireEvent.click(answers()[(row.correctLane + 1) % settings.platforms]);
  await advance(700);
  for (let i = 0; i < 3; i++) await advance(1000);
  await advance(200);
  expect(screen.getByRole("img", { name: "Pip the cricket, falling" })).toBeInTheDocument();
  await advance(900);
  expect(screen.getByRole("img", { name: "Pip the cricket, landing" })).toBeInTheDocument();
  await advance(900);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(row.question.prompt);
  expect(answers().map(button => button.getAttribute("aria-label"))).not.toEqual(before);
  expect(localStorage.getItem(engine.SCORES_KEY)).toBeNull();
});

test("voice narration must finish before the thinking gate opens", async () => {
  localStorage.setItem(engine.SETTINGS_KEY, JSON.stringify({ ...settings, voice: true }));
  let finishSpeech;
  audio.speak.mockImplementationOnce(() => new Promise(resolve => { finishSpeech = resolve; }));
  render(<CricketClimb />);
  fireEvent.click(screen.getByRole("button", { name: /A fresh little climb! Start over/ }));
  await advance(30000);
  answers().forEach(button => expect(button).toBeDisabled());
  expect(audio.speak.mock.calls[0][0]).toContain("Choices, from left to right");
  await act(async () => { finishSpeech(true); });
  await advance(999); answers().forEach(button => expect(button).toBeDisabled());
  await advance(1); answers().forEach(button => expect(button).toBeEnabled());
});

test("the spider laughs only after choosing its wrong leaf and the suspense ends", async () => {
  engine.createRun.mockImplementation((seed, rules) => ({ ...actualCreateRun("ui-test", rules), history: [false, true, false, true, false] }));
  render(<CricketClimb />); await start();
  expect(screen.getByRole("img", { name: "A cheeky spider on a wrong leaf" })).toBeInTheDocument();
  const run = { ...actualCreateRun("ui-test", settings), history: [false, true, false, true, false] };
  const lane = engine.spiderLaneFor(run, settings, null);
  fireEvent.click(answers()[lane]); await advance(700);
  expect(screen.queryByRole("img", { name: "The cheeky spider is laughing" })).not.toBeInTheDocument();
  for (let i = 0; i < 3; i++) await advance(1000);
  expect(screen.getByRole("img", { name: "The cheeky spider is laughing" })).toBeInTheDocument();
});

test("cricket reminders sound after 15 idle seconds and every 60 seconds thereafter", async () => {
  render(<CricketClimb />); await start();
  const sound = audio.GardenAudio.mock.results[0].value;
  await advance(10000); expect(sound.cricket).not.toHaveBeenCalled();
  await advance(1000); expect(sound.cricket).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("img", { name: "Pip the cricket, chirping" })).toBeInTheDocument();
  await advance(audio.CRICKET_CHIRP_DURATION - 1);
  expect(screen.getByRole("img", { name: "Pip the cricket, chirping" })).toBeInTheDocument();
  await advance(1);
  expect(screen.queryByRole("img", { name: "Pip the cricket, chirping" })).not.toBeInTheDocument();
  await advance(59000 - audio.CRICKET_CHIRP_DURATION); expect(sound.cricket).toHaveBeenCalledTimes(1);
  await advance(1000); expect(sound.cricket).toHaveBeenCalledTimes(2);
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole("img", { name: "Pip the cricket, chirping" })).not.toBeInTheDocument();
  await advance(14000); expect(sound.cricket).toHaveBeenCalledTimes(2);
  await advance(1000); expect(sound.cricket).toHaveBeenCalledTimes(3);
});

test("muted garden sounds never start the cricket's singing animation", async () => {
  localStorage.setItem(engine.SETTINGS_KEY, JSON.stringify({ ...settings, sounds: false }));
  render(<CricketClimb />); await start(); await advance(90000);
  expect(audio.GardenAudio.mock.results[0].value.cricket).not.toHaveBeenCalled();
  expect(screen.queryByRole("img", { name: "Pip the cricket, chirping" })).not.toBeInTheDocument();
});

test("both discovery skills are selectable and picture instructions keep the reading gate", async () => {
  localStorage.setItem(engine.SETTINGS_KEY, JSON.stringify({ ...settings, skills: ["algorithms"] }));
  render(<CricketClimb />);
  fireEvent.click(screen.getByRole("button", { name: "Open garden settings" }));
  expect(screen.getByRole("checkbox", { name: "Computer basics" })).not.toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Algorithms & order" })).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Cancel settings" }));
  fireEvent.click(screen.getByRole("button", { name: /A fresh little climb! Start over/ }));
  const question = engine.questionFor("ui-test", 1, { ...settings, skills: ["algorithms"] });
  expect(screen.getByRole("group", { name: `${question.sequence.caption}. Steps from left to right.` })).toBeInTheDocument();
  answers().forEach(button => expect(button).toBeDisabled());
  await advance(3000); await advance(1000);
  answers().forEach(button => expect(button).toBeEnabled());
});

test("computer illustrations retain emoji while loading and fall back if the reference fails", () => {
  const token = COMPUTER_TOOLS[0], { container } = render(<TokenArt token={token} />);
  const fallback = screen.getByText(token.value), image = container.querySelector("img");
  expect(fallback).toBeVisible();
  expect(image).toHaveAttribute("src", token.image);
  expect(image).toHaveAttribute("referrerpolicy", "no-referrer");
  fireEvent.load(image); expect(fallback).not.toBeVisible();
  fireEvent.error(image); expect(fallback).toBeVisible();
  expect(container.querySelector("img")).toBeNull();
});

test("settings prevent an empty skill selection and changing game rules starts a fresh climb", async () => {
  render(<CricketClimb />); await start();
  fireEvent.click(screen.getByRole("button", { name: "Open garden settings" }));
  SKILLS.forEach(skill => { const checkbox = screen.getByRole("checkbox", { name: skill.label }); if (checkbox.checked) fireEvent.click(checkbox); });
  expect(screen.getByRole("button", { name: /Save settings and restart/ })).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("Choose at least one skill");
  fireEvent.click(screen.getByRole("checkbox", { name: "Letter names" }));
  fireEvent.click(screen.getByRole("button", { name: "5 answer leaves" }));
  fireEvent.click(screen.getByRole("button", { name: /Save settings and restart/ }));
  expect(answers()).toHaveLength(5);
  expect(JSON.parse(localStorage.getItem(engine.SETTINGS_KEY)).skills).toEqual(["letters"]);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(engine.questionFor("ui-test", 1, { ...settings, platforms: 5, skills: ["letters"] }).prompt);
});

test("grade checkboxes prevent an empty selection and second grade alone starts immediately", async () => {
  render(<CricketClimb />); await start();
  fireEvent.click(screen.getByRole("button", { name: "Open garden settings" }));
  for (const grade of ["Kindergarten", "1st grade", "2nd grade"]) {
    expect(screen.getByRole("checkbox", { name: grade, exact: true })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: grade, exact: true }));
  }
  expect(screen.getByRole("alert")).toHaveTextContent("Choose at least one grade");
  expect(screen.getByRole("button", { name: /Save settings and restart/ })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: "2nd grade", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: /Save settings and restart/ }));
  expect(JSON.parse(localStorage.getItem(engine.SETTINGS_KEY)).grades).toEqual([2]);
  expect(JSON.parse(localStorage.getItem(PROGRESS_KEY)).settings.grades).toEqual([2]);
  expect(document.querySelector(".cc-question--second-grade")).toBeInTheDocument();
  expect(screen.getByText("2nd grade discoveries")).toBeInTheDocument();
  expect(screen.getByLabelText("Current level 0")).toBeInTheDocument();
  answers().forEach(button => expect(button).toBeDisabled());
  await advance(3000); await advance(1000); answers().forEach(button => expect(button).toBeEnabled());
});

function savedClimb(level = 12, rules = settings) {
  let run = actualCreateRun("saved-adventure", rules);
  while (run.level < level) run = engine.prepareRow(engine.resolveAttempt(run, run.rows[run.level].correctLane, rules).run, rules);
  const save = snapshotProgress(run, rules);
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(save));
  return { run, save };
}

test("entering second grade celebrates the actual grade transition and saves level 127", async () => {
  const { run } = savedClimb(126);
  render(<CricketClimb />);
  fireEvent.click(screen.getByRole("button", { name: "Keep hopping! Continue at level 126" }));
  await finishReturnJump(); await advance(3000); await advance(1000);
  fireEvent.click(answers()[run.rows[126].correctLane]); await advance(700);
  for (let i = 0; i < 3; i++) await advance(1000);
  expect(screen.getByText("Second grade discoveries await.")).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(PROGRESS_KEY))).toMatchObject({ level: 127, settings: { grades: [0, 1, 2] } });
  await advance(2300); await advance(600);
  expect(document.querySelector(".cc-question--second-grade")).toBeInTheDocument();
  expect(screen.getByText("2nd grade discoveries")).toBeInTheDocument();
});

test("the opening has two friendly choices and continue is disabled without a saved climb", () => {
  render(<CricketClimb />);
  expect(screen.getByRole("button", { name: "Keep hopping! No saved climb yet" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "A fresh little climb! Start over at level 1" })).toBeEnabled();
});

test("continue resumes the exact question, answer order, and level after a reload", async () => {
  const { run, save } = savedClimb();
  render(<CricketClimb />);
  expect(screen.getByLabelText("Current level 0")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Keep hopping! Continue at level 12" }));
  expect(screen.getByRole("img", { name: "Pip the cricket, charging" })).toBeInTheDocument();
  expect(screen.getByLabelText("Current level 0")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Answer / })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open garden settings" })).toBeDisabled();
  expect(JSON.parse(localStorage.getItem(PROGRESS_KEY))).toEqual(save);
  await advance(750);
  expect(screen.getByRole("img", { name: "Pip the cricket, superjump" })).toBeInTheDocument();
  await advance(650);
  const currentLevel = Number(document.querySelector(".cc-ruler").getAttribute("aria-label").replace("Current level ", ""));
  expect(currentLevel).toBeGreaterThan(0); expect(currentLevel).toBeLessThan(11);
  expect(localStorage.getItem(engine.SCORES_KEY)).toBeNull();
  expect(JSON.parse(localStorage.getItem(PROGRESS_KEY))).toEqual(save);
  await advance(1700); await advance(300);
  expect(screen.getByRole("img", { name: "Pip the cricket, landing" })).toBeInTheDocument();
  await advance(700);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(run.rows[12].question.prompt);
  expect(answers().map(button => button.getAttribute("aria-label"))).toEqual(run.rows[12].choices.map((choice, i) => `Answer ${i + 1}: ${choice.spoken}`));
  expect(screen.getByLabelText("Current level 11")).toBeInTheDocument();
  answers().forEach(button => expect(button).toBeDisabled());
  await advance(3000); await advance(1000);
  answers().forEach(button => expect(button).toBeEnabled());
  expect(JSON.parse(localStorage.getItem(PROGRESS_KEY)).rows.map(row => row.level)).toEqual([8, 9, 10, 11, 12]);
});

test("starting fresh replaces the old climb but preserves personal best records", () => {
  savedClimb();
  localStorage.setItem(engine.SCORES_KEY, JSON.stringify({ [engine.scoreKey(settings)]: 27 }));
  render(<CricketClimb />);
  fireEvent.click(screen.getByRole("button", { name: "A fresh little climb! Start over at level 1" }));
  const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY));
  expect(saved.level).toBe(1); expect(saved.rows).toHaveLength(1); expect(saved.seed).toBe("ui-test");
  expect(screen.getByRole("button", { name: "Best level 27. Read score aloud" })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(engine.SCORES_KEY))[engine.scoreKey(settings)]).toBe(27);
});

test("continue restores the saved game rules while keeping current voice and theme preferences", async () => {
  const rules = { ...settings, platforms: 5, skills: ["letters"], voice: true, theme: "sunny" };
  savedClimb(8, rules);
  localStorage.setItem(engine.SETTINGS_KEY, JSON.stringify({ ...settings, theme: "moonlit", voice: false }));
  render(<CricketClimb />);
  fireEvent.click(screen.getByRole("button", { name: "Keep hopping! Continue at level 8" }));
  await finishReturnJump();
  expect(answers()).toHaveLength(5);
  expect(document.querySelector(".cc-theme--moonlit")).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(engine.SETTINGS_KEY))).toMatchObject({ platforms: 5, skills: ["letters"], theme: "moonlit", voice: false });
});

test("even a high saved climb has one bounded super-jump without changing its five saved levels", async () => {
  const { save } = savedClimb(120);
  localStorage.setItem(engine.SCORES_KEY, JSON.stringify({ [engine.scoreKey(settings)]: 141 }));
  render(<CricketClimb />);
  const button = screen.getByRole("button", { name: "Keep hopping! Continue at level 120" });
  fireEvent.click(button); fireEvent.click(button);
  await advance(750); await advance(1100);
  expect(document.querySelectorAll(".cc-row").length).toBeLessThan(18);
  expect(screen.getByRole("button", { name: "Restart with new questions" })).toBeDisabled();
  await advance(1200); await advance(300); await advance(700);
  expect(screen.getByLabelText("Current level 119")).toBeInTheDocument();
  expect(audio.GardenAudio.mock.results[0].value.superJump).toHaveBeenCalledTimes(1);
  expect(JSON.parse(localStorage.getItem(PROGRESS_KEY))).toEqual(save);
  expect(JSON.parse(localStorage.getItem(engine.SCORES_KEY))[engine.scoreKey(settings)]).toBe(141);
  expect(screen.getByText("Look closely at the question…")).toBeInTheDocument();
});

test("a ground-level saved question still gets a playful jump and lands back on the ground", async () => {
  savedClimb(1);
  render(<CricketClimb />);
  fireEvent.click(screen.getByRole("button", { name: "Keep hopping! Continue at level 1" }));
  await finishReturnJump();
  expect(screen.getByLabelText("Current level 0")).toBeInTheDocument();
  expect(audio.GardenAudio.mock.results[0].value.superJump).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(engine.questionFor("saved-adventure", 1, settings).prompt);
});

test("reduced motion skips the speedy camera scroll and still waits for reading before answers", async () => {
  savedClimb(40);
  window.matchMedia.mockReturnValue({ matches: true });
  render(<CricketClimb />);
  fireEvent.click(screen.getByRole("button", { name: "Keep hopping! Continue at level 40" }));
  await advance(200);
  expect(screen.getByLabelText("Current level 39")).toBeInTheDocument();
  await advance(180); await advance(250);
  answers().forEach(button => expect(button).toBeDisabled());
  await advance(3000); await advance(999);
  answers().forEach(button => expect(button).toBeDisabled());
  await advance(1);
  answers().forEach(button => expect(button).toBeEnabled());
});

test("leaving during the return jump cancels it and preserves the original saved climb", async () => {
  const { save } = savedClimb();
  const { unmount } = render(<CricketClimb />);
  fireEvent.click(screen.getByRole("button", { name: "Keep hopping! Continue at level 12" }));
  await advance(750); await advance(500);
  const sound = audio.GardenAudio.mock.results[0].value;
  unmount(); await advance(10000);
  expect(sound.land).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem(PROGRESS_KEY))).toEqual(save);
});

test("the return greeting and landing finish before the saved question is narrated", async () => {
  savedClimb(12);
  localStorage.setItem(engine.SETTINGS_KEY, JSON.stringify({ ...settings, voice: true }));
  let finishGreeting, finishQuestion;
  audio.speak.mockImplementation(text => {
    if (text.startsWith("Welcome back!")) return new Promise(resolve => { finishGreeting = resolve; });
    if (text.includes("Choices, from left to right")) return new Promise(resolve => { finishQuestion = resolve; });
    return Promise.resolve(true);
  });
  render(<CricketClimb />);
  fireEvent.click(screen.getByRole("button", { name: "Keep hopping! Continue at level 12" }));
  await advance(10000);
  expect(screen.getByRole("img", { name: "Pip the cricket, charging" })).toBeInTheDocument();
  expect(audio.speak).toHaveBeenCalledTimes(1);
  await act(async () => { finishGreeting(true); });
  await advance(2300); await advance(300); await advance(700);
  expect(audio.speak.mock.calls.map(([text]) => text).slice(0, 3)).toEqual([
    "Welcome back! Ready, steady!", "Wheee!", "Ta-da! Right where you left off!",
  ]);
  expect(audio.speak.mock.calls[3][0]).toContain("Level 12.");
  await advance(10000); answers().forEach(button => expect(button).toBeDisabled());
  await act(async () => { finishQuestion(true); });
  await advance(999); answers().forEach(button => expect(button).toBeDisabled());
  await advance(1); answers().forEach(button => expect(button).toBeEnabled());
});

test("resolved answers are saved before celebration finishes", async () => {
  render(<CricketClimb />); await start();
  const run = actualCreateRun("ui-test", settings);
  fireEvent.click(answers()[run.rows[1].correctLane]); await advance(700);
  for (let i = 0; i < 3; i++) await advance(1000);
  expect(screen.getByRole("img", { name: "Pip the cricket, celebrating" })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(PROGRESS_KEY))).toMatchObject({ level: 2, best: 1 });
  cleanup(); render(<CricketClimb />);
  expect(screen.getByRole("button", { name: "Keep hopping! Continue at level 2" })).toBeEnabled();
});

test("an invalid saved climb falls back to a safe fresh start", () => {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, level: 12, rows: [] }));
  render(<CricketClimb />);
  expect(screen.getByRole("button", { name: "Keep hopping! No saved climb yet" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "A fresh little climb! Start over at level 1" }));
  expect(JSON.parse(localStorage.getItem(PROGRESS_KEY)).level).toBe(1);
});

test("the checklist shortcut selects all nine teacher topics without losing grade selections", () => {
  render(<CricketClimb />);
  fireEvent.click(screen.getByRole("button", { name: "Open garden settings" }));
  fireEvent.click(screen.getByRole("button", { name: "Select all nine computer checklist topics" }));
  const topics = ["Devices & care", "Pointer & keyboard", "Icons & navigation", "Browser & web", "Creation & files", "Information & safety", "Computational thinking", "Troubleshooting", "Accessibility & habits"];
  topics.forEach(name => expect(screen.getByRole("checkbox", { name })).toBeChecked());
  expect(screen.getByRole("checkbox", { name: "Letter names" })).not.toBeChecked();
  for (const grade of ["Kindergarten", "1st grade", "2nd grade"]) expect(screen.getByRole("checkbox", { name: grade, exact: true })).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Save settings", exact: true }));
  expect(JSON.parse(localStorage.getItem(engine.SETTINGS_KEY)).skills).toHaveLength(9);
});

test("word scenarios show every numbered choice and allow enough voice-off reading time", async () => {
  const rules = { ...settings, grades: [2], platforms: 5, skills: ["troubleshooting"] };
  localStorage.setItem(engine.SETTINGS_KEY, JSON.stringify(rules));
  render(<CricketClimb />);
  fireEvent.click(screen.getByRole("button", { name: /A fresh little climb! Start over/ }));
  const question = engine.questionFor("ui-test", 1, rules);
  const list = screen.getByRole("list", { name: "Choose a number on a leaf" });
  expect(list.children).toHaveLength(5);
  question.options.forEach(option => expect(list).toHaveTextContent(option.text));
  const duration = Math.max(3000, question.speech.split(/\s+/).length * 360);
  await advance(4000); answers().forEach(button => expect(button).toBeDisabled());
  await advance(duration - 4000); answers().forEach(button => expect(button).toBeDisabled());
  await advance(1000); answers().forEach(button => expect(button).toBeEnabled());
});
