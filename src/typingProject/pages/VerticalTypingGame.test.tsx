import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import TypingDdrPage from "./TypingDdrPage";
import { FINISH_RESTART_MS } from "./DdrRoundTransition";
import { COACH_CARD_COUNT, COACH_CARD_MS } from "./DdrTypingCoach";
import { loadVerticalSelection, VERTICAL_KEY_STORAGE, VERTICAL_SELECTION_STORAGE } from "./verticalMode";

declare const test: any, expect: any, jest: any, beforeEach: any, afterEach: any;

let viewportWidth = 1024;
let targetCenter = 512;
let warmupOffset = 0;

beforeEach(() => {
  jest.useFakeTimers("modern");
  localStorage.clear();
  jest.spyOn(Math, "random").mockReturnValue(0);
  (globalThis as any).ResizeObserver = class { observe() {} disconnect() {} };
  viewportWidth = 1024;
  targetCenter = 512;
  warmupOffset = 0;
  jest.spyOn(document.documentElement, "clientWidth", "get").mockImplementation(() => viewportWidth);
  const getRect = HTMLElement.prototype.getBoundingClientRect;
  jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
    if (this.getAttribute("data-testid") === "vertical-hit-target") {
      return { left: targetCenter - 20, width: 40 } as DOMRect;
    }
    return getRect.call(this);
  });
});
afterEach(() => { cleanup(); jest.restoreAllMocks(); jest.useRealTimers(); });

function press(key: string) {
  fireEvent.keyDown(window, { key });
  // These regression cases exercise the lanes after the real warm-up finishes.
  if (key === "Tab" && screen.queryByRole("dialog", { name: "Typing warm-up" })) {
    for (let index = 0; index < COACH_CARD_COUNT; index += 1) {
      fireEvent.load(within(screen.getByRole("dialog", { name: "Typing warm-up" })).getAllByRole("img").find((element) => element.tagName === "IMG")!);
      act(() => { jest.advanceTimersByTime(COACH_CARD_MS); });
    }
    for (let index = 0; index < 3; index += 1) act(() => { jest.advanceTimersByTime(1000); });
    warmupOffset = performance.now();
  }
}
function advanceTo(time: number) { act(() => { jest.advanceTimersByTime(time + warmupOffset - performance.now()); }); }
function setMode(mode: string) {
  fireEvent.mouseDown(screen.getByRole("combobox"));
  fireEvent.click(screen.getByRole("option", { name: mode }));
}
function chooseColumn(key: string) {
  const menu = screen.getByRole("dialog", { name: "DDR start menu" });
  const button = within(menu).getByRole("button", { name: `${key.toUpperCase()} key` });
  if (button.getAttribute("aria-pressed") !== "true") fireEvent.click(button);
}
function openVertical(key = "f") {
  render(<TypingDdrPage />);
  setMode("Vertical");
  chooseColumn(key);
}
function expectTempo(tempo: number) { expect(screen.getByText(`${tempo} BPM`, { exact: true })).toBeInTheDocument(); }

test("Vertical keeps the home row and starts its three column letters selected", () => {
  render(<TypingDdrPage />);
  fireEvent.mouseDown(screen.getByRole("combobox"));
  const options = screen.getAllByRole("option");
  expect(options.slice(0, 4).map((option) => option.textContent)).toEqual(["Balanced+", "Balanced", "Vertical", "Progressive"]);
  fireEvent.click(screen.getByRole("option", { name: "Vertical" }));
  const menu = screen.getByRole("dialog", { name: "DDR start menu" });
  expect(within(menu).queryByRole("radio")).not.toBeInTheDocument();
  expect(within(menu).getAllByRole("button", { pressed: true })).toHaveLength(3);
  expect(within(menu).getByRole("button", { name: "F key" })).toHaveAttribute("aria-pressed", "true");
  chooseColumn("f");
  expect(within(menu).getByRole("button", { name: "F key" })).toHaveAttribute("aria-pressed", "true");
  chooseColumn("j");
  expect(within(menu).getAllByRole("button", { pressed: true })).toHaveLength(3);
  expect(within(menu).getByRole("button", { name: "J key" })).toHaveAttribute("aria-pressed", "true");
  expect(within(menu).getByRole("button", { name: "Space key" })).toBeDisabled();
  expect(within(menu).getByRole("checkbox", { name: "Random key set" })).toBeDisabled();
});

test.each([["j", "u", "m", "7/8"], ["d", "e", "c", "3/4"]])(
  "%s shows its selected upper and lower letters in the same column as the home row",
  (home: string, upper: string, lower: string, column: string) => {
    openVertical(home);
    const menu = within(screen.getByRole("dialog", { name: "DDR start menu" }));
    [upper, home, lower].forEach((key, index) => {
      const button = menu.getByRole("button", { name: `${key.toUpperCase()} key` });
      expect(button).toHaveAttribute("aria-pressed", "true");
      expect(window.getComputedStyle(button).getPropertyValue("grid-column").replace(/\s/g, "")).toBe(column);
      expect(button).toHaveStyle({ gridRow: String(index + 1) });
    });
    for (const key of ["A", "S", "D", "F", "G", "H", "J", "K", "L", ";"]) {
      expect(menu.getByRole("button", { name: `${key} key` })).toHaveStyle({ gridRow: "2" });
    }
  }
);

test("Vertical can toggle each letter but warns and keeps two selected", () => {
  openVertical("j");
  const menu = within(screen.getByRole("dialog", { name: "DDR start menu" }));
  const upper = menu.getByRole("button", { name: "U key" });
  const middle = menu.getByRole("button", { name: "J key" });
  const lower = menu.getByRole("button", { name: "M key" });
  fireEvent.click(lower);
  expect(lower).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(upper);
  expect(menu.getByRole("alert")).toHaveTextContent("Select at least 2 letters.");
  expect(upper).toHaveAttribute("aria-pressed", "true");
  expect(menu.getAllByRole("button", { pressed: true })).toHaveLength(2);
  fireEvent.click(lower);
  expect(menu.queryByRole("alert")).not.toBeInTheDocument();
  fireEvent.click(middle);
  expect(middle).toHaveAttribute("aria-pressed", "false");
  expect(upper).toHaveAttribute("aria-pressed", "true");
  expect(lower).toHaveAttribute("aria-pressed", "true");
  chooseColumn("d");
  expect(menu.queryByRole("button", { name: "U key" })).not.toBeInTheDocument();
  expect(menu.queryByRole("button", { name: "M key" })).not.toBeInTheDocument();
  expect(menu.getAllByRole("button", { pressed: true }).map((button) => button.textContent)).toEqual(["E", "D", "C"]);
});

test("Vertical keyboard editing toggles upper and lower letters and enforces the minimum", () => {
  openVertical("d");
  press("k");
  press("e");
  press("c");
  const menu = within(screen.getByRole("dialog", { name: "DDR start menu" }));
  expect(menu.getByRole("button", { name: "E key" })).toHaveAttribute("aria-pressed", "false");
  expect(menu.getByRole("button", { name: "C key" })).toHaveAttribute("aria-pressed", "true");
  expect(menu.getByRole("alert")).toHaveTextContent("Select at least 2 letters.");
  press("Enter");
});

test("only selected vertical letters are generated, accepted and recorded", () => {
  openVertical("j");
  const menu = within(screen.getByRole("dialog", { name: "DDR start menu" }));
  fireEvent.click(menu.getByRole("button", { name: "J key" }));
  press("Tab");
  advanceTo(140);
  expect(screen.getByRole("img", { name: "J hit target" })).toHaveAttribute("data-active", "false");
  expect(screen.getAllByTestId("vertical-note").map((note) => note.getAttribute("data-key"))).toEqual(["u", "u", "m", "m"]);
  advanceTo(3950);
  press("u");
  advanceTo(4700);
  press("u");
  advanceTo(5450);
  press("m");
  advanceTo(6200);
  press("m");
  expect(screen.getByText("Correct 4", { exact: true })).toBeInTheDocument();
  press("j");
  expect(screen.getByText("Wrong 1", { exact: true })).toBeInTheDocument();
  for (let index = 0; index < 12; index += 1) press("x");
  expect(JSON.parse(localStorage.getItem("typingDdrLeaderboard")!)[0].keys).toBe("U M");
});

test("Vertical restores its own letter selection without changing normal home-row keys", () => {
  openVertical("j");
  fireEvent.click(within(screen.getByRole("dialog", { name: "DDR start menu" })).getByRole("button", { name: "M key" }));
  expect(loadVerticalSelection()).toEqual({ homeKey: "j", keys: ["u", "j"] });
  setMode("Balanced");
  setMode("Vertical");
  expect(within(screen.getByRole("dialog", { name: "DDR start menu" })).getByRole("button", { name: "M key" })).toHaveAttribute("aria-pressed", "false");
  cleanup();
  render(<TypingDdrPage />);
  setMode("Vertical");
  expect(within(screen.getByRole("dialog", { name: "DDR start menu" })).getByRole("button", { name: "M key" })).toHaveAttribute("aria-pressed", "false");
});

test.each([null, "bad json", JSON.stringify({ homeKey: "j", keys: ["u"] }), JSON.stringify({ homeKey: "d", keys: ["e", "d"] })])(
  "old or invalid vertical selections restore all three letters: %s", (saved: string | null) => {
    localStorage.setItem(VERTICAL_KEY_STORAGE, "j");
    if (saved !== null) localStorage.setItem(VERTICAL_SELECTION_STORAGE, saved);
    expect(loadVerticalSelection()).toEqual({ homeKey: "j", keys: ["u", "j", "m"] });
  }
);

test("Vertical preserves the normal multi-key selection and random preference", () => {
  render(<TypingDdrPage />);
  fireEvent.click(screen.getByRole("checkbox", { name: "Random key set" }));
  setMode("Vertical");
  press("k");
  press("j");
  press("Enter");
  const menu = screen.getByRole("dialog", { name: "DDR start menu" });
  expect(within(menu).getByRole("button", { name: "J key" })).toHaveAttribute("aria-pressed", "true");
  setMode("Balanced");
  expect(screen.getByRole("checkbox", { name: "Random key set" })).toBeChecked();
  fireEvent.click(screen.getByRole("checkbox", { name: "Random key set" }));
  expect(within(menu).getAllByRole("button", { pressed: true }).map((button) => button.getAttribute("aria-label"))).toEqual(["D key", "F key", "J key", "K key"]);
  setMode("Vertical");
  expect(within(menu).getByRole("button", { name: "J key" })).toHaveAttribute("aria-pressed", "true");
  expect(localStorage.getItem("typingDdrVerticalHomeKey")).toBe("j");
});

test.each([
  ["a", ["q", "a", "z"], "right", "1/2"],
  ["s", ["w", "s", "x"], "right", "2/3"],
  ["d", ["e", "d", "c"], "right", "3/4"],
  ["f", ["r", "f", "v"], "right", "4/5"],
  ["g", ["t", "g", "b"], "right", "5/6"],
  ["h", ["y", "h", "n"], "left", "6/7"],
  ["j", ["u", "j", "m"], "left", "7/8"],
  ["k", ["i", "k", ","], "left", "8/9"],
  ["l", ["o", "l", "."], "left", "9/10"],
  [";", ["p", ";", "/"], "left", "10/11"],
])("%s keeps its keyboard position and accepts all three keys", (homeKey: string, keys: string[], side: string, grid: string) => {
  openVertical(homeKey);
  const targets = screen.getAllByTestId("vertical-hit-target");
  expect(targets.map((target) => target.getAttribute("data-key"))).toEqual(keys);
  targets.forEach((target) => expect(window.getComputedStyle(target).getPropertyValue("grid-column").replace(/\s/g, "")).toBe(grid));
  expect(targets.map((target) => window.getComputedStyle(target).top)).toEqual(["59%", "74%", "89%"]);
  expect(screen.getByLabelText("Vertical game lanes")).toHaveAttribute("data-entry-side", side);
  (Math.random as any).mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValueOnce(0.999).mockReturnValue(0);
  press("Tab");
  advanceTo(140);
  screen.getAllByTestId("vertical-note").forEach((note) => expect(note).toHaveAttribute("data-entry-side", side));
  for (let index = 0; index < 6; index += 1) {
    advanceTo(3950 + index * 750);
    press(keys[Math.floor(index / 2)]);
    expect(screen.getByText(`Correct ${index + 1}`, { exact: true })).toBeInTheDocument();
  }
  expect(screen.getByText("Wrong 0", { exact: true })).toBeInTheDocument();
  expectTempo(83);
});

test("the matching row and timing window are required, and speed changes only after a repeat group", () => {
  openVertical();
  press("Tab");
  advanceTo(3950);
  press("v"); // Correct column, wrong row for the incoming note.
  press("u"); // Outside the selected column.
  expect(screen.getByText("Correct 0", { exact: true })).toBeInTheDocument();
  expect(screen.getByText("Wrong 2", { exact: true })).toBeInTheDocument();
  press("r");
  expectTempo(80);
  advanceTo(4700);
  press("r");
  expectTempo(81);
});

test("pause and resume preserve horizontal note timing and the unfinished repeat group", () => {
  openVertical();
  press("Tab");
  advanceTo(3950);
  press("r");
  press("Tab");
  screen.getAllByTestId("vertical-note").forEach((note) => expect(note).toHaveStyle({ "animation-play-state": "paused" }));
  advanceTo(8950);
  expect(screen.getByText("Missed 0", { exact: true })).toBeInTheDocument();
  press("Tab");
  advanceTo(9700);
  press("r");
  expect(screen.getByText("Correct 2", { exact: true })).toBeInTheDocument();
  expectTempo(81);
});

test("Vertical saves its own ending speed and record, then automatically replays the same column", () => {
  openVertical("j");
  press("Tab");
  advanceTo(3950);
  press("u");
  advanceTo(4700);
  press("u");
  for (let index = 0; index < 12; index += 1) press("x");
  expect(screen.getByText("Record Saved!", { exact: true })).toBeInTheDocument();
  const entries = JSON.parse(localStorage.getItem("typingDdrLeaderboard")!);
  expect(entries[0].mode).toBe("Vertical");
  expect(entries[0].keys).toBe("U J M");
  expect(JSON.parse(localStorage.getItem("typingDdrLastTempos")!)).toEqual({ vertical: 81 });
  advanceTo(4700 + FINISH_RESTART_MS);
  expectTempo(80);
  expect(screen.getAllByTestId("vertical-hit-target").map((target) => target.getAttribute("data-key"))).toEqual(["u", "j", "m"]);
  expect(screen.queryByRole("dialog", { name: "DDR start menu" })).not.toBeInTheDocument();
  expect(screen.getByText("Correct 0", { exact: true })).toBeInTheDocument();
});

test("Vertical ignores random multi-key selection when starting", () => {
  render(<TypingDdrPage />);
  fireEvent.click(screen.getByRole("checkbox", { name: "Random key set" }));
  setMode("Vertical");
  chooseColumn("h");
  press("Tab");
  advanceTo(3950);
  press("y");
  expect(screen.getByText("Correct 1", { exact: true })).toBeInTheDocument();
  expect(screen.getAllByTestId("vertical-hit-target")).toHaveLength(3);
  expect(screen.getByLabelText("Vertical game lanes")).toHaveAttribute("data-entry-side", "left");
});

test.each([
  ["f", 375, 130, 3200, 305],
  ["f", 1024, 512, 3200, 572],
  ["f", 1280, 400, 3917, 940],
  ["f", 1920, 400, 6583, 1580],
  ["j", 1280, 880, 3917, -940],
])("%s synchronizes animation and hit timing for a %i pixel viewport", (key: string, width: number, center: number, travelMs: number, startX: number) => {
  viewportWidth = width;
  targetCenter = center;
  openVertical(key);
  press("Tab");
  advanceTo(140);
  const note = screen.getAllByTestId("vertical-note")[0];
  const style = window.getComputedStyle(note);
  expect(style.getPropertyValue("--note-start-x")).toBe(`${startX}px`);
  expect(style.animation).toContain(`${travelMs + 700}ms linear 610ms`);
  const endX = parseFloat(style.getPropertyValue("--note-end-x"));
  // Linear animation crosses the target at travelMs, before its post-target tail.
  expect(startX + (endX - startX) * travelMs / (travelMs + 700)).toBeCloseTo(0);
  advanceTo(travelMs + 750);
  press(key === "f" ? "r" : "u");
  expect(screen.getByText("Correct 1", { exact: true })).toBeInTheDocument();
  advanceTo(travelMs + 1500);
  press(key === "f" ? "r" : "u");
  expectTempo(81);
});

test("resizing keeps scheduled notes timed and gives new notes their full travel time", () => {
  openVertical();
  press("Tab");
  advanceTo(140);
  const firstNote = screen.getAllByTestId("vertical-note")[0];
  const animation = window.getComputedStyle(firstNote).animation;
  advanceTo(280);
  viewportWidth = 1920;
  targetCenter = 400;
  fireEvent(window, new Event("resize"));
  advanceTo(420);
  expect(window.getComputedStyle(firstNote).animation).toBe(animation);
  const wideNote = screen.getAllByTestId("vertical-note").find((note) => window.getComputedStyle(note).getPropertyValue("--note-start-x") === "1580px")!;
  expect(wideNote).toBeDefined();
  expect(window.getComputedStyle(wideNote).animation).toContain("7283ms linear 0ms");
  advanceTo(3950);
  press("r");
  expect(screen.getByText("Correct 1", { exact: true })).toBeInTheDocument();
  advanceTo(7003);
  press("r");
  expect(screen.getByText("Correct 2", { exact: true })).toBeInTheDocument();
});
