import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import DdrTypingCoach, { COACH_CARD_COUNT, COACH_CARD_MS, getFingerLesson } from "./DdrTypingCoach";
import TypingDdrPage from "./TypingDdrPage";
import { VerticalHomeKey } from "./verticalMode";

declare const test: any, expect: any, jest: any, beforeEach: any, afterEach: any;

beforeEach(() => {
  jest.useFakeTimers("modern");
  localStorage.clear();
  (globalThis as any).ResizeObserver = class { observe() {} disconnect() {} };
});
afterEach(() => { cleanup(); jest.restoreAllMocks(); jest.useRealTimers(); });

const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });
const coach = () => within(screen.getByRole("dialog", { name: "Typing warm-up" }));
const loadPicture = () => fireEvent.load(coach().getAllByRole("img").find((element) => element.tagName === "IMG")!);

test.each([
  ["a", "left", "pinky", "pink", "a"], [";", "right", "pinky", "pink", ";"],
  ["s", "left", "ring", "yellow", "s"], ["l", "right", "ring", "yellow", "l"],
  ["d", "left", "middle", "orange", "d"], ["k", "right", "middle", "orange", "k"],
  ["f", "left", "pointer", "green", "f"], ["j", "right", "pointer", "green", "j"],
  ["g", "left", "pointer", "light blue", "f"], ["h", "right", "pointer", "light blue", "j"],
])("%s teaches the correct hand, finger, color and return key", (key: VerticalHomeKey, hand: string, finger: string, colorName: string, home: string) => {
  const lesson = getFingerLesson(key);
  expect(lesson).toMatchObject({ hand, finger, colorName, home });
  render(<DdrTypingCoach homeKey={key} activeKeys={[key]} soundOn onToggleSound={jest.fn()} onCue={jest.fn()} onComplete={jest.fn()} onCancel={jest.fn()} />);
  expect(coach().getByRole("img")).toHaveAccessibleName(`${hand} hand with the ${finger} finger highlighted in ${colorName}`);
  expect(coach().getByText(new RegExp(`Use your ${hand} ${finger}`))).toBeInTheDocument();
});

test("each loaded picture stays for exactly five seconds, then all three countdown beats finish before play", () => {
  const onComplete = jest.fn(), onCue = jest.fn();
  render(<DdrTypingCoach homeKey="h" activeKeys={["y", "h", "n"]} soundOn onToggleSound={jest.fn()} onCue={onCue} onComplete={onComplete} onCancel={jest.fn()} />);
  const titles = ["Meet your pointer finger!", "Kitty pounce!", "Sit tall at your table!", "Eyes on the screen!", "Every finger has a home!"];
  advance(6000); // Slow image loads must not consume a child's viewing time.
  expect(coach().getByRole("heading", { name: titles[0] })).toBeInTheDocument();
  expect(onCue).not.toHaveBeenCalled();
  for (const title of titles) {
    loadPicture();
    advance(COACH_CARD_MS - 1);
    expect(coach().getByRole("heading", { name: title })).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
    advance(1);
  }
  for (const count of [3, 2, 1]) {
    expect(coach().getByRole("status", { name: `Starting in ${count}` })).toBeInTheDocument();
    advance(999);
    expect(onComplete).not.toHaveBeenCalled();
    advance(1);
  }
  expect(onComplete).toHaveBeenCalledTimes(1);
  expect(onCue.mock.calls.map(([cue]: [string]) => cue)).toEqual(["finger", "kitty", "tall", "eyes", "home", "count", "count", "count", "go"]);
});

test("failed images still show a readable lesson, and leaving cancels every pending timer", () => {
  const onComplete = jest.fn();
  const view = render(<DdrTypingCoach homeKey="f" activeKeys={["r", "f"]} soundOn={false} onToggleSound={jest.fn()} onCue={jest.fn()} onComplete={onComplete} onCancel={jest.fn()} />);
  fireEvent.error(coach().getByRole("img"));
  advance(COACH_CARD_MS);
  expect(coach().getByRole("heading", { name: "Kitty pounce!" })).toBeInTheDocument();
  loadPicture();
  view.unmount();
  advance(60000);
  expect(onComplete).not.toHaveBeenCalled();
});

test("starting Vertical blocks gameplay and menu shortcuts until the warm-up completes; resume skips it", () => {
  render(<TypingDdrPage />);
  fireEvent.mouseDown(screen.getByRole("combobox"));
  fireEvent.click(screen.getByRole("option", { name: "Vertical" }));
  fireEvent.click(screen.getByRole("button", { name: "Let’s get ready!" }));
  fireEvent.keyDown(window, { key: "Tab" });
  fireEvent.keyDown(window, { key: "k" });
  fireEvent.keyDown(window, { key: "x" });
  advance(1000);
  expect(screen.queryByTestId("vertical-note")).not.toBeInTheDocument();
  expect(coach().getByRole("heading", { name: "Meet your pointer finger!" })).toBeInTheDocument();
  for (let index = 0; index < COACH_CARD_COUNT; index += 1) { loadPicture(); advance(COACH_CARD_MS); }
  expect(screen.queryByTestId("vertical-note")).not.toBeInTheDocument();
  for (let index = 0; index < 3; index += 1) advance(1000);
  expect(screen.queryByRole("dialog", { name: "Typing warm-up" })).not.toBeInTheDocument();
  expect(screen.getByText("Wrong 0", { exact: true })).toBeInTheDocument();
  advance(140);
  expect(screen.getAllByTestId("vertical-note").length).toBeGreaterThan(0);
  fireEvent.keyDown(window, { key: "Tab" });
  fireEvent.keyDown(window, { key: "Tab" });
  expect(screen.queryByRole("dialog", { name: "Typing warm-up" })).not.toBeInTheDocument();
});

test("sound can be muted and returning to the menu cannot start a round later", () => {
  render(<TypingDdrPage />);
  fireEvent.mouseDown(screen.getByRole("combobox"));
  fireEvent.click(screen.getByRole("option", { name: "Vertical" }));
  fireEvent.keyDown(window, { key: "Tab" });
  fireEvent.click(coach().getByRole("button", { name: "Mute warm-up sounds" }));
  expect(coach().getByRole("button", { name: "Enable warm-up sounds" })).toBeInTheDocument();
  loadPicture();
  fireEvent.click(coach().getByRole("button", { name: "Back to menu" }));
  advance(60000);
  expect(screen.getByRole("dialog", { name: "DDR start menu" })).toBeInTheDocument();
  expect(screen.queryByTestId("vertical-note")).not.toBeInTheDocument();
  fireEvent.keyDown(window, { key: "Tab" });
  expect(coach().getByRole("heading", { name: "Meet your pointer finger!" })).toBeInTheDocument();
});

test("warm-up sound effects play through Web Audio and muting stops them", () => {
  const previousAudioContext = window.AudioContext;
  const voices: any[] = [];
  const context = {
    state: "running", currentTime: 0, destination: {},
    createGain: () => ({ connect: jest.fn(), disconnect: jest.fn(), gain: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() } }),
    createOscillator: () => {
      const voice = { frequency: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() }, connect: (gain: any) => gain, start: jest.fn(), stop: jest.fn(), disconnect: jest.fn() };
      voices.push(voice);
      return voice;
    },
  };
  (window as any).AudioContext = jest.fn(() => context);
  try {
    render(<TypingDdrPage />);
    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Vertical" }));
    fireEvent.keyDown(window, { key: "Tab" });
    loadPicture();
    expect(voices).toHaveLength(2);
    voices.forEach((voice) => expect(voice.start).toHaveBeenCalledTimes(1));
    voices.forEach((voice) => voice.stop.mockClear());
    fireEvent.click(coach().getByRole("button", { name: "Mute warm-up sounds" }));
    voices.forEach((voice) => expect(voice.stop).toHaveBeenCalled());
    advance(COACH_CARD_MS);
    loadPicture();
    expect(voices).toHaveLength(2);
  } finally {
    cleanup();
    (window as any).AudioContext = previousAudioContext;
  }
});
