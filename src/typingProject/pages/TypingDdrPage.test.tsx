import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import TypingDdrPage from "./TypingDdrPage";

declare const test: any, expect: any, jest: any, beforeEach: any, afterEach: any;

beforeEach(() => {
  jest.useFakeTimers("modern");
  localStorage.clear();
  jest.spyOn(Math, "random").mockReturnValue(0);
  (globalThis as any).ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

function advanceTo(time: number) {
  act(() => { jest.advanceTimersByTime(time - performance.now()); });
}

function press(key: string) {
  fireEvent.keyDown(window, { key });
}

function setMode(label: string) {
  fireEvent.mouseDown(screen.getByRole("combobox"));
  fireEvent.click(screen.getByRole("option", { name: label }));
}

function start(repeats = 4, mode = "Balanced+") {
  render(<TypingDdrPage />);
  if (mode !== "Balanced+") setMode(mode);
  fireEvent.change(screen.getByRole("slider", { name: "Key repeats" }), { target: { value: repeats } });
  press("Tab");
}

function expectTempo(tempo: number) {
  expect(screen.getByText(`${tempo} BPM`, { exact: true })).toBeInTheDocument();
}

function expectGridColumn(element: HTMLElement, column: string) {
  expect(window.getComputedStyle(element).getPropertyValue("grid-column").replace(/\s+/g, "")).toBe(column);
}

test("main menu defaults to two repeats and limits the option to one through four", () => {
  render(<TypingDdrPage />);
  const menu = screen.getByRole("dialog", { name: "DDR start menu" });
  const slider = within(menu).getByRole("slider", { name: "Key repeats" });
  expect(slider).toHaveValue("2");
  expect(slider).toHaveAttribute("min", "1");
  expect(slider).toHaveAttribute("max", "4");
  expect(slider).toHaveAttribute("step", "1");
});

test.each([1, 2, 3, 4])("repeats a key exactly %i times before changing lanes", (repeats: number) => {
  start(repeats);
  for (let index = 0; index < repeats; index += 1) {
    advanceTo(3350 + index * 750);
    expectTempo(80);
    press("d");
    expect(screen.getByText(`Correct ${index + 1}`, { exact: true })).toBeInTheDocument();
    expectTempo(index === repeats - 1 ? 81 : 80);
  }
  // The next group must use a different key, including when a group spans bars.
  advanceTo(3350 + repeats * 750);
  press("f");
  expect(screen.getByText(`Correct ${repeats + 1}`, { exact: true })).toBeInTheDocument();
  expect(screen.getByText("Wrong 0", { exact: true })).toBeInTheDocument();
});

test.each([
  ["Balanced", 3, 81], ["Balanced", 2, 79], ["Balanced", 0, 79],
  ["Balanced+", 3, 81], ["Balanced+", 2, 79], ["Balanced+", 0, 79],
])("%s adjusts once after four notes with %i hits", (mode: string, hits: number, finalTempo: number) => {
  start(4, mode);
  for (let index = 0; index < 4; index += 1) {
    advanceTo(3350 + index * 750);
    expectTempo(80);
    if (index < hits) press("d");
  }
  // The last note is missed: wait for its hit window to close.
  expectTempo(80);
  advanceTo(6250);
  expectTempo(finalTempo);
  expect(screen.getByText(`Missed ${4 - hits}`, { exact: true })).toBeInTheDocument();
  advanceTo(6300);
  expectTempo(finalTempo);
});

test("a final correct hit completes a group containing earlier missed notes", () => {
  start();
  advanceTo(4100); // First note missed; hit the remaining three.
  press("d");
  advanceTo(4850);
  press("d");
  expectTempo(80);
  advanceTo(5600);
  press("d");
  expectTempo(81);
  expect(screen.getByText("Missed 1", { exact: true })).toBeInTheDocument();
});

test("extra wrong presses do not count as notes or change speed before a group completes", () => {
  start();
  advanceTo(3350);
  press("d");
  press("x");
  press("x");
  press("x");
  expectTempo(80);
  expect(screen.getByText("Wrong 3", { exact: true })).toBeInTheDocument();
  for (const time of [4100, 4850, 5600]) {
    advanceTo(time);
    press("d");
  }
  expectTempo(81);
});

test("pause and resume preserve the unfinished group", () => {
  start();
  advanceTo(3350);
  press("d");
  press("Tab");
  advanceTo(8350);
  expectTempo(80);
  press("Tab");
  for (const time of [9100, 9850, 10600]) {
    advanceTo(time);
    press("d");
  }
  expect(screen.getByText("Correct 4", { exact: true })).toBeInTheDocument();
  expectTempo(81);
});

test("restart discards unfinished groups and keeps the selected repeat count", () => {
  start();
  advanceTo(3350);
  press("d");
  fireEvent.click(screen.getByRole("button", { name: "Restart" }));
  expect(screen.getByRole("slider", { name: "Key repeats" })).toHaveValue("4");
  press("Tab");
  for (let index = 0; index < 4; index += 1) {
    advanceTo(6700 + index * 750);
    expectTempo(80);
    press("d");
  }
  expect(screen.getByText("Correct 4", { exact: true })).toBeInTheDocument();
  expectTempo(81);
});

test.each(["Bronze", "Custom", "Progressive"])("%s repeats keys without adapting speed to accuracy", (mode: string) => {
  start(4, mode);
  const tempo = mode === "Progressive" ? 65 : 80;
  const beatMs = 60000 / tempo;
  for (let index = 0; index < 4; index += 1) {
    advanceTo(2600 + beatMs * (index + 1));
    press("d");
  }
  expect(screen.getByText("Correct 4", { exact: true })).toBeInTheDocument();
  expectTempo(tempo);
});

test("three-note groups continue across bars in a sparse custom rhythm", () => {
  render(<TypingDdrPage />);
  setMode("Custom");
  fireEvent.change(screen.getByRole("slider", { name: "Key repeats" }), { target: { value: 3 } });
  const selects = screen.getAllByRole("combobox");
  fireEvent.mouseDown(selects[1]);
  fireEvent.click(screen.getByRole("option", { name: "Half" }));
  press("Tab");
  for (const time of [3350, 4850, 6350]) {
    advanceTo(time);
    press("d");
  }
  advanceTo(7850);
  press("f");
  expect(screen.getByText("Correct 4", { exact: true })).toBeInTheDocument();
  expect(screen.getByText("Wrong 0", { exact: true })).toBeInTheDocument();
  expectTempo(80);
});

const LAST_TEMPOS_KEY = "typingDdrLastTempos";

test.each([
  ["Balanced", "balanced", 60, 60],
  ["Balanced", "balanced", 40, 40],
  ["Balanced+", "balancedPlus", 45.5, 45.5],
  ["Balanced", "balanced", 73.5, 73.5],
  ["Balanced", "balanced", 80, 80],
  ["Balanced", "balanced", 140, 110],
  ["Balanced+", "balancedPlus", 70, 70],
  ["Balanced+", "balancedPlus", 80, 80],
  ["Balanced+", "balancedPlus", 81, 80],
  ["Balanced+", "balancedPlus", 83, 81],
  ["Balanced+", "balancedPlus", 81.9, 80],
  ["Balanced+", "balancedPlus", 180, 130],
])("%s (%s): last tempo %s starts at %s BPM", (label: string, mode: string, lastTempo: number, expectedTempo: number) => {
  localStorage.setItem(LAST_TEMPOS_KEY, JSON.stringify({ [mode]: lastTempo }));
  render(<TypingDdrPage />);
  if (label !== "Balanced+") setMode(label);
  expectTempo(expectedTempo);
  expect(screen.getByText(`Max BPM ${expectedTempo}`, { exact: true })).toBeInTheDocument();
  // Browsing modes and resetting must not repeatedly halve the remembered value.
  setMode("Bronze");
  setMode(label);
  fireEvent.click(screen.getByRole("button", { name: "Restart" }));
  expectTempo(expectedTempo);
  press("Tab");
  expectTempo(expectedTempo);
  expect(JSON.parse(localStorage.getItem(LAST_TEMPOS_KEY)!)[mode]).toBe(lastTempo);
});

test.each(["Balanced", "Balanced+"])("%s remembers the finishing speed after running out of hearts", (label: string) => {
  start(4, label);
  for (const time of [3350, 4100, 4850, 5600]) {
    advanceTo(time);
    press("d");
  }
  expectTempo(81);
  for (let count = 0; count < 12; count += 1) press("x");
  expect(screen.getByRole("dialog", { name: "Round finished" })).toBeInTheDocument();
  const mode = label === "Balanced" ? "balanced" : "balancedPlus";
  expect(JSON.parse(localStorage.getItem(LAST_TEMPOS_KEY)!)[mode]).toBe(81);
  press("r");
  expectTempo(80);
  // The saved ending tempo also survives leaving and reopening the game.
  cleanup();
  render(<TypingDdrPage />);
  if (label === "Balanced") setMode(label);
  expectTempo(80);
});

test.each(["Balanced", "Balanced+"])("%s saves the final missed note's speed adjustment when it exhausts hearts", (label: string) => {
  start(4, label);
  // Four hearts remain. Twenty missed notes use them up, completing five groups.
  for (let count = 0; count < 8; count += 1) press("x");
  advanceTo(30000);
  expect(screen.getByRole("dialog", { name: "Round finished" })).toBeInTheDocument();
  expect(screen.getByText("Missed 20", { exact: true })).toBeInTheDocument();
  expectTempo(75);
  const mode = label === "Balanced" ? "balanced" : "balancedPlus";
  expect(JSON.parse(localStorage.getItem(LAST_TEMPOS_KEY)!)[mode]).toBe(75);
  press("r");
  expectTempo(75);
});

test.each([
  ["Balanced", "balanced", 70, 70, 70],
  ["Balanced", "balanced", 180, 130, 105],
  ["Balanced+", "balancedPlus", 70, 70, 70],
  ["Balanced+", "balancedPlus", 180, 130, 105],
])("%s (%s) saves its timed ending tempo after a previous run at %s BPM", (label: string, mode: string, lastTempo: number, endingTempo: number, nextStart: number) => {
  const otherMode = mode === "balanced" ? "balancedPlus" : "balanced";
  localStorage.setItem(LAST_TEMPOS_KEY, JSON.stringify({ [mode]: lastTempo, [otherMode]: 90 }));
  start(4, label);
  expectTempo(endingTempo);
  advanceTo(420);
  // Let the round clock reach its limit at the next clock tick, before any notes.
  const clock = jest.spyOn(performance, "now").mockReturnValue(88000);
  act(() => { jest.advanceTimersByTime(80); });
  expect(screen.getByRole("dialog", { name: "Round finished" })).toBeInTheDocument();
  expect(screen.getByText("time complete", { exact: true })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(LAST_TEMPOS_KEY)!)).toEqual({ [mode]: endingTempo, [otherMode]: 90 });
  clock.mockRestore();
  press("m");
  expectTempo(nextStart);
  press("Tab");
  expectTempo(nextStart);
});

test("remembers each mode separately and leaves preset tempos unchanged", () => {
  localStorage.setItem(LAST_TEMPOS_KEY, JSON.stringify({ balanced: 70, balancedPlus: 160 }));
  render(<TypingDdrPage />);
  expectTempo(120);
  setMode("Balanced");
  expectTempo(70);
  setMode("Bronze");
  expectTempo(80);
  setMode("Progressive");
  expectTempo(65);
  setMode("Balanced+");
  expectTempo(120);
});

test("an unfinished run does not replace the remembered ending speed", () => {
  localStorage.setItem(LAST_TEMPOS_KEY, JSON.stringify({ balancedPlus: 80 }));
  start();
  for (const time of [3350, 4100, 4850, 5600]) {
    advanceTo(time);
    press("d");
  }
  expectTempo(81);
  press("Tab");
  expect(JSON.parse(localStorage.getItem(LAST_TEMPOS_KEY)!)).toEqual({ balancedPlus: 80 });
  fireEvent.click(screen.getByRole("button", { name: "Restart" }));
  expectTempo(80);
  expect(JSON.parse(localStorage.getItem(LAST_TEMPOS_KEY)!)).toEqual({ balancedPlus: 80 });
});

test.each(["bad json", "null", "[]", '{"balancedPlus":"120"}', '{"balancedPlus":-10}', '{"balancedPlus":999}'])(
  "invalid saved tempo data falls back to the default: %s", (stored: string) => {
    localStorage.setItem(LAST_TEMPOS_KEY, stored);
    render(<TypingDdrPage />);
    expectTempo(80);
  }
);

test("celebrates the saved record, fades in order, and counts into a single new round", () => {
  start();
  for (let count = 0; count < 12; count += 1) press("x");
  expect(screen.getByText("Finished!", { exact: true })).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Record Saved!");
  expect(JSON.parse(localStorage.getItem("typingDdrLeaderboard")!)).toHaveLength(1);
  advanceTo(1399);
  expect(screen.getByLabelText("Game lanes")).toHaveStyle({ opacity: 1 });
  advanceTo(1400);
  expect(screen.getByLabelText("Game lanes")).toHaveStyle({ opacity: 0 });
  expect(screen.getByRole("dialog", { name: "Round finished" })).toHaveStyle({ opacity: 1 });
  advanceTo(1900);
  expect(screen.getByRole("dialog", { name: "Round finished" })).toHaveStyle({ opacity: 0 });
  advanceTo(2250);
  expect(screen.queryByRole("dialog", { name: "Round finished" })).not.toBeInTheDocument();
  expect(screen.getByText("But don’t stop now…")).toBeInTheDocument();
  advanceTo(5249);
  expect(screen.getByText("But don’t stop now…").parentElement).toHaveStyle({ opacity: 1 });
  advanceTo(5250);
  expect(screen.getByText("But don’t stop now…").parentElement).toHaveStyle({ opacity: 0 });
  for (const [time, count] of [[5500, 3], [6150, 2], [6800, 1]]) {
    advanceTo(time);
    expect(screen.getByRole("status", { name: `Starting in ${count}` })).toHaveTextContent(String(count));
  }
  advanceTo(7449);
  expect(screen.getByRole("status", { name: "Starting in 1" })).toBeInTheDocument();
  advanceTo(7450);
  expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog", { name: "DDR start menu" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Game lanes")).toHaveStyle({ opacity: 1 });
  expect(screen.getByText("Wrong 0", { exact: true })).toBeInTheDocument();
  press("x");
  expect(screen.getByText("Wrong 1", { exact: true })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem("typingDdrLeaderboard")!)).toHaveLength(1);
});

test("automatic restart uses the saved tempo and resets hearts and scores", () => {
  start();
  for (const time of [3350, 4100, 4850, 5600]) {
    advanceTo(time);
    press("d");
  }
  for (let count = 0; count < 12; count += 1) press("x");
  advanceTo(13050);
  expectTempo(80);
  expect(screen.getByText("Correct 0", { exact: true })).toBeInTheDocument();
  expect(screen.getByText("Wrong 0", { exact: true })).toBeInTheDocument();
  expect(screen.getByLabelText("Score")).toHaveTextContent("0");
  for (let count = 0; count < 11; count += 1) press("x");
  expect(screen.queryByRole("dialog", { name: "Round finished" })).not.toBeInTheDocument();
  press("x");
  expect(screen.getByText("Finished!", { exact: true })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem("typingDdrLeaderboard")!)).toHaveLength(2);
});

test.each(["button", "keyboard", "Escape"])("leaving the countdown with %s cancels automatic restart", (exit: string) => {
  start();
  for (let count = 0; count < 12; count += 1) press("x");
  advanceTo(2300);
  if (exit === "button") fireEvent.click(screen.getByRole("button", { name: "Menu (M)" }));
  else if (exit === "Escape") fireEvent.keyDown(screen.getByText("But don’t stop now…"), { key: "Escape" });
  else press("m");
  advanceTo(10000);
  expect(screen.getByRole("dialog", { name: "DDR start menu" })).toBeInTheDocument();
  expect(screen.queryByText("But don’t stop now…")).not.toBeInTheDocument();
  expect(screen.queryByRole("status", { name: /Starting in/ })).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem("typingDdrLeaderboard")!)).toHaveLength(1);
});

test("unmounting a finished game clears the continuation timers", () => {
  start();
  for (let count = 0; count < 12; count += 1) press("x");
  cleanup();
  expect(jest.getTimerCount()).toBe(0);
});

test.each(["Balanced", "Balanced+"])("%s can slow below 60 BPM and stops at 40", (label: string) => {
  const mode = label === "Balanced" ? "balanced" : "balancedPlus";
  localStorage.setItem(LAST_TEMPOS_KEY, JSON.stringify({ [mode]: 40.5 }));
  start(1, label);
  advanceTo(4900); // First miss closes its window and decreases tempo to the floor.
  expectTempo(40);
  advanceTo(6400);
  expect(screen.getByText("Missed 2", { exact: true })).toBeInTheDocument();
  expectTempo(40);
  for (let count = 0; count < 12; count += 1) press("x");
  expect(JSON.parse(localStorage.getItem(LAST_TEMPOS_KEY)!)[mode]).toBe(40);
  press("r");
  expectTempo(40);
});

test("a storage failure never announces that a record was saved", () => {
  start();
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage unavailable"); });
  for (let count = 0; count < 12; count += 1) press("x");
  expect(screen.queryByText("Record Saved!", { exact: true })).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Record could not be saved");
});

test.each([false, true])("fanfare and count-in respect the sound setting (%s)", (sound: boolean) => {
  const previousAudioContext = window.AudioContext;
  const oscillators: any[] = [];
  const context = {
    state: "running", currentTime: 0, destination: {},
    createOscillator: jest.fn(() => {
      const oscillator = {
        type: "triangle", frequency: { value: 0 }, start: jest.fn(), stop: jest.fn(), disconnect: jest.fn(),
        connect: jest.fn((gain: any) => gain), onended: null,
      };
      oscillators.push(oscillator);
      return oscillator;
    }),
    createGain: jest.fn(() => ({
      gain: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() },
      connect: jest.fn(), disconnect: jest.fn(),
    })),
  };
  const audioConstructor = jest.fn(() => context);
  (window as any).AudioContext = audioConstructor;
  try {
    start();
    if (sound) fireEvent.click(screen.getByRole("button", { name: "Toggle beat sound" }));
    for (let count = 0; count < 12; count += 1) press("x");
    expect(oscillators).toHaveLength(sound ? 4 : 0);
    advanceTo(5500);
    expect(oscillators).toHaveLength(sound ? 5 : 0);
    advanceTo(6150);
    expect(oscillators).toHaveLength(sound ? 6 : 0);
    advanceTo(6800);
    expect(oscillators).toHaveLength(sound ? 7 : 0);
    expect(audioConstructor).toHaveBeenCalledTimes(sound ? 1 : 0);
    cleanup();
    oscillators.forEach((oscillator) => expect(oscillator.stop).toHaveBeenCalledWith());
  } finally {
    (window as any).AudioContext = previousAudioContext;
  }
});

test("G and H occupy the center columns, with an inactive Space reference below", () => {
  render(<TypingDdrPage />);
  const menu = screen.getByRole("dialog", { name: "DDR start menu" });
  const g = within(menu).getByRole("button", { name: "G key" });
  const h = within(menu).getByRole("button", { name: "H key" });
  const space = within(menu).getByRole("button", { name: "Space key" });
  expectGridColumn(g, "5/6");
  expectGridColumn(h, "6/7");
  expectGridColumn(space, "4/span4");
  expect(g).toHaveStyle({ "grid-row": "1" });
  expect(h).toHaveStyle({ "grid-row": "1" });
  expect(space).toHaveStyle({ "grid-row": "2" });
  expectGridColumn(screen.getByRole("button", { name: "Toggle G key" }), "5/6");
  expectGridColumn(screen.getByRole("button", { name: "Toggle H key" }), "6/7");
  expect(screen.getByRole("button", { name: "Toggle Space key" })).toHaveTextContent("Space · off");
  expectGridColumn(screen.getByRole("button", { name: "Toggle J key" }), "7/8");
});

test("enabling Space replaces G/H with a wide center lane on the same hit line", () => {
  render(<TypingDdrPage />);
  const menu = screen.getByRole("dialog", { name: "DDR start menu" });
  fireEvent.click(within(menu).getByRole("button", { name: "G key" }));
  fireEvent.click(within(menu).getByRole("button", { name: "H key" }));
  fireEvent.click(within(menu).getByRole("button", { name: "Space key" }));
  expect(within(menu).getByRole("button", { name: "G key" })).toHaveAttribute("aria-pressed", "false");
  expect(within(menu).getByRole("button", { name: "H key" })).toHaveAttribute("aria-pressed", "false");
  expect(within(menu).getByRole("button", { name: "Space key" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByRole("button", { name: "Toggle G key" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Toggle H key" })).not.toBeInTheDocument();
  const spaceLane = screen.getByRole("button", { name: "Toggle Space key" });
  expectGridColumn(spaceLane, "5/7");
  expect(spaceLane).not.toHaveTextContent("off");
  const hitTarget = within(spaceLane).getByTestId("ddr-hit-target");
  expect(hitTarget).toHaveStyle({ top: "74%" });
  expect(within(screen.getByRole("button", { name: "Toggle F key" })).getByTestId("ddr-hit-target")).toHaveStyle({ top: "74%" });
  expect(JSON.parse(localStorage.getItem("typingDdrActiveKeys")!)).toEqual(["d", "f", " ", "j", "k"]);
});

test.each(["G", "H"])("enabling %s turns Space off without moving the outer lanes", (key: string) => {
  render(<TypingDdrPage />);
  const menu = screen.getByRole("dialog", { name: "DDR start menu" });
  fireEvent.click(within(menu).getByRole("button", { name: "Space key" }));
  fireEvent.click(within(menu).getByRole("button", { name: `${key} key` }));
  expect(within(menu).getByRole("button", { name: "Space key" })).toHaveAttribute("aria-pressed", "false");
  expect(within(menu).getByRole("button", { name: `${key} key` })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Toggle Space key" })).toHaveTextContent("Space · off");
  expectGridColumn(screen.getByRole("button", { name: "Toggle F key" }), "4/5");
  expectGridColumn(screen.getByRole("button", { name: "Toggle J key" }), "7/8");
});

test("the Space reference and keyboard editing follow the same center selection rule", () => {
  render(<TypingDdrPage />);
  fireEvent.click(screen.getByRole("button", { name: "Toggle Space key" }));
  const menu = screen.getByRole("dialog", { name: "DDR start menu" });
  expect(within(menu).getByRole("button", { name: "Space key" })).toHaveAttribute("aria-pressed", "true");
  press("k");
  press("g");
  press("h");
  press("Enter");
  expect(within(menu).getByRole("button", { name: "G key" })).toHaveAttribute("aria-pressed", "true");
  expect(within(menu).getByRole("button", { name: "H key" })).toHaveAttribute("aria-pressed", "true");
  expect(within(menu).getByRole("button", { name: "Space key" })).toHaveAttribute("aria-pressed", "false");
});

test.each([
  [["g", "h"], ["g", "g", "h", "h"]],
  [[" ", "j"], [" ", " ", "j", "j"]],
])("center keys %s generate hittable repeated notes", (keys: string[], presses: string[]) => {
  localStorage.setItem("typingDdrActiveKeys", JSON.stringify(keys));
  start(2);
  presses.forEach((key, index) => {
    advanceTo(3350 + index * 750);
    press(key);
  });
  expect(screen.getByText("Correct 4", { exact: true })).toBeInTheDocument();
  expect(screen.getByText("Wrong 0", { exact: true })).toBeInTheDocument();
  expectTempo(82);
});

test.each([2, 4, 9, 10])("random sets of %i keys never combine Space with G/H", (count: number) => {
  // Exercise several shuffle orders, including Space being picked early.
  for (const random of [0, 0.35, 0.65, 0.999]) {
    (Math.random as any).mockReturnValue(random);
    render(<TypingDdrPage />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Random key set" }));
    fireEvent.change(screen.getByRole("slider", { name: "Number of random keys" }), { target: { value: count } });
    press("Tab");
    press("Tab");
    press("m"); // Inspect the chosen set in the menu after disabling random preview.
    const menu = screen.getByRole("dialog", { name: "DDR start menu" });
    fireEvent.click(within(menu).getByRole("checkbox", { name: "Random key set" }));
    const selected = within(menu).getAllByRole("button", { pressed: true });
    const selectedKeys = selected.map((button) => button.getAttribute("aria-label"));
    expect(selectedKeys).toHaveLength(count);
    expect(selectedKeys.includes("Space key") && (selectedKeys.includes("G key") || selectedKeys.includes("H key"))).toBe(false);
    cleanup();
  }
});

test("conflicting saved center keys are normalized before a run", () => {
  localStorage.setItem("typingDdrActiveKeys", JSON.stringify(["f", "g", "h", " ", "j"]));
  render(<TypingDdrPage />);
  const menu = screen.getByRole("dialog", { name: "DDR start menu" });
  expect(within(menu).getByRole("button", { name: "Space key" })).toHaveAttribute("aria-pressed", "false");
  expect(within(menu).getByRole("button", { name: "G key" })).toHaveAttribute("aria-pressed", "true");
  expect(within(menu).getByRole("button", { name: "H key" })).toHaveAttribute("aria-pressed", "true");
});
