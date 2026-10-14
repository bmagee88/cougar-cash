import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import SoccerTypingGame from "../SoccerTypingGame";
import { SHOT_DURATIONS, SHOT_TARGETS } from "../engine/shooting";

declare const test: (name: string, fn: () => void) => void;
declare const beforeEach: (fn: () => void) => void;
declare const afterEach: (fn: () => void) => void;
declare const expect: any;
declare const jest: any;

let time = 0;
beforeEach(() => {
  jest.useFakeTimers();
  time = 0;
  jest.spyOn(performance, "now").mockImplementation(() => time);
});
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

function press(key: string, delay = 100) {
  time += delay;
  fireEvent.keyDown(window, { key });
}

function typeRound(step: number) {
  for (const target of SHOT_TARGETS) {
    for (const key of target.phrase.split("")) press(key, step);
    press("Enter");
  }
}

function advance(ms: number) {
  time += ms + 20;
  act(() => { jest.advanceTimersByTime(ms + 20); });
}

test("rendered shot gates ignore stray typing and clicking Enter restores game focus", () => {
  render(<SoccerTypingGame />);
  press("s");
  expect(screen.getAllByLabelText("Typing challenge")).toHaveLength(5);
  press("a");
  expect(screen.getByLabelText("Offense goal probability")).toHaveTextContent("Goal 0%");
  fireEvent.click(screen.getByRole("button", { name: "Enter" }));
  expect(screen.getByRole("region", { name: "Soccer game" })).toHaveFocus();
  for (const key of SHOT_TARGETS[0].phrase.split("")) press(key);
  expect(screen.getByLabelText("Offense goal probability")).toHaveTextContent("Goal 59%");
  press("b");
  expect(screen.getByRole("button", { name: "Enter" })).toBeInTheDocument();
  expect(screen.getByLabelText("Offense goal probability")).toHaveTextContent("Goal 59%");
  press("Enter");
  expect(screen.queryByRole("button", { name: "Enter" })).not.toBeInTheDocument();
});

test("rendered scoring sequence shows countdown, celebration, score, and gated kickoff", () => {
  render(<SoccerTypingGame />);
  press("s");
  press("Enter");
  typeRound(50);
  expect(screen.getByText("Comets saving")).toBeInTheDocument();
  expect(screen.getByLabelText("Offense goal probability")).toHaveTextContent("Goal 100%");
  press("Enter");
  typeRound(100);
  advance(SHOT_DURATIONS.SHOT_CAMERA);
  expect(screen.getByLabelText("Shot countdown")).toHaveTextContent("3");
  advance(SHOT_DURATIONS.SHOT_COUNTDOWN);
  expect(screen.queryByLabelText("Shot countdown")).not.toBeInTheDocument();
  advance(SHOT_DURATIONS.SHOT_FLIGHT);
  expect(screen.getByLabelText("Goal scored")).toHaveTextContent("GOOOOOOOOOOOOAL!");
  expect(screen.getByText("Cougars 1")).toBeInTheDocument();
  advance(SHOT_DURATIONS.SHOT_RESULT);
  expect(screen.queryByLabelText("Shooting arena")).not.toBeInTheDocument();
  expect(screen.getByText("Ball: A")).toBeInTheDocument();
  press("a");
  expect(screen.getByRole("button", { name: "Enter" })).toBeInTheDocument();
  press("Enter");
  expect(screen.queryByRole("button", { name: "Enter" })).not.toBeInTheDocument();
});

test("Tab pauses shots and Shift+Tab clears the entire shooting state", () => {
  render(<SoccerTypingGame />);
  press("s");
  press("Enter");
  press("a");
  press("Tab");
  expect(screen.getByRole("dialog", { name: "Match paused" })).toBeInTheDocument();
  press("b");
  press("Tab");
  expect(screen.queryByRole("dialog", { name: "Match paused" })).not.toBeInTheDocument();
  fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
  expect(screen.queryByLabelText("Shooting arena")).not.toBeInTheDocument();
  expect(screen.getByText("Shots: 0")).toBeInTheDocument();
});
