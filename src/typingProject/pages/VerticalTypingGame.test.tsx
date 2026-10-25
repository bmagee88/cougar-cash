import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import TypingDdrPage from "./TypingDdrPage";

declare const test: any, expect: any, jest: any, beforeEach: any, afterEach: any;

beforeEach(() => {
  jest.useFakeTimers("modern");
  localStorage.clear();
  jest.spyOn(Math, "random").mockReturnValue(0);
  (globalThis as any).ResizeObserver = class { observe() {} disconnect() {} };
});
afterEach(() => { cleanup(); jest.restoreAllMocks(); jest.useRealTimers(); });

function press(key: string) { fireEvent.keyDown(window, { key }); }
function advanceTo(time: number) { act(() => { jest.advanceTimersByTime(time - performance.now()); }); }
function setMode(mode: string) {
  fireEvent.mouseDown(screen.getByRole("combobox"));
  fireEvent.click(screen.getByRole("option", { name: mode }));
}
function chooseColumn(key: string) {
  const menu = screen.getByRole("dialog", { name: "DDR start menu" });
  fireEvent.click(within(menu).getByRole("button", { name: `${key.toUpperCase()} key` }));
}
function openVertical(key = "f") {
  render(<TypingDdrPage />);
  setMode("Vertical");
  chooseColumn(key);
}
function expectTempo(tempo: number) { expect(screen.getByText(`${tempo} BPM`, { exact: true })).toBeInTheDocument(); }

test("Vertical is listed directly after Balanced and uses the same buttons for a single selection", () => {
  render(<TypingDdrPage />);
  fireEvent.mouseDown(screen.getByRole("combobox"));
  const options = screen.getAllByRole("option");
  expect(options.slice(0, 4).map((option) => option.textContent)).toEqual(["Balanced+", "Balanced", "Vertical", "Progressive"]);
  fireEvent.click(screen.getByRole("option", { name: "Vertical" }));
  const menu = screen.getByRole("dialog", { name: "DDR start menu" });
  expect(within(menu).queryByRole("radio")).not.toBeInTheDocument();
  expect(within(menu).getAllByRole("button", { pressed: true })).toHaveLength(1);
  expect(within(menu).getByRole("button", { name: "F key" })).toHaveAttribute("aria-pressed", "true");
  chooseColumn("f");
  expect(within(menu).getByRole("button", { name: "F key" })).toHaveAttribute("aria-pressed", "true");
  chooseColumn("j");
  expect(within(menu).getAllByRole("button", { pressed: true })).toHaveLength(1);
  expect(within(menu).getByRole("button", { name: "J key" })).toHaveAttribute("aria-pressed", "true");
  expect(within(menu).getByRole("button", { name: "Space key" })).toBeDisabled();
  expect(within(menu).getByRole("checkbox", { name: "Random key set" })).toBeDisabled();
});

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
    advanceTo(3350 + index * 750);
    press(keys[Math.floor(index / 2)]);
    expect(screen.getByText(`Correct ${index + 1}`, { exact: true })).toBeInTheDocument();
  }
  expect(screen.getByText("Wrong 0", { exact: true })).toBeInTheDocument();
  expectTempo(83);
});

test("the matching row and timing window are required, and speed changes only after a repeat group", () => {
  openVertical();
  press("Tab");
  advanceTo(3350);
  press("v"); // Correct column, wrong row for the incoming note.
  press("u"); // Outside the selected column.
  expect(screen.getByText("Correct 0", { exact: true })).toBeInTheDocument();
  expect(screen.getByText("Wrong 2", { exact: true })).toBeInTheDocument();
  press("r");
  expectTempo(80);
  advanceTo(4100);
  press("r");
  expectTempo(81);
});

test("pause and resume preserve horizontal note timing and the unfinished repeat group", () => {
  openVertical();
  press("Tab");
  advanceTo(3350);
  press("r");
  press("Tab");
  screen.getAllByTestId("vertical-note").forEach((note) => expect(note).toHaveStyle({ "animation-play-state": "paused" }));
  advanceTo(8350);
  expect(screen.getByText("Missed 0", { exact: true })).toBeInTheDocument();
  press("Tab");
  advanceTo(9100);
  press("r");
  expect(screen.getByText("Correct 2", { exact: true })).toBeInTheDocument();
  expectTempo(81);
});

test("Vertical saves its own ending speed and record, then automatically replays the same column", () => {
  openVertical("j");
  press("Tab");
  advanceTo(3350);
  press("u");
  advanceTo(4100);
  press("u");
  for (let index = 0; index < 12; index += 1) press("x");
  expect(screen.getByText("Record Saved!", { exact: true })).toBeInTheDocument();
  const entries = JSON.parse(localStorage.getItem("typingDdrLeaderboard")!);
  expect(entries[0].mode).toBe("Vertical");
  expect(entries[0].keys).toBe("U J M");
  expect(JSON.parse(localStorage.getItem("typingDdrLastTempos")!)).toEqual({ vertical: 81 });
  advanceTo(9300);
  expectTempo(80.5);
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
  advanceTo(3350);
  press("y");
  expect(screen.getByText("Correct 1", { exact: true })).toBeInTheDocument();
  expect(screen.getAllByTestId("vertical-hit-target")).toHaveLength(3);
  expect(screen.getByLabelText("Vertical game lanes")).toHaveAttribute("data-entry-side", "left");
});
