import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import QuizApp3Page from "./QuizApp3Page";
import { PROGRESS_KEY } from "./storage";
import QuizSources from "./QuizSources";

declare const test: any, expect: any, jest: any, beforeEach: any, afterEach: any;

jest.mock("./catalog", () => ({
  catalogErrors: [],
  quizzes: [
    require("./quizzes/hardware-basics.json"),
    require("./quizzes/cloud-computing-1.json"),
    require("./quizzes/cables-and-ports.json"),
    require("./quizzes/chromebook-care.json"),
  ],
  ...require("./catalogUtils"),
}));

beforeEach(() => {
  localStorage.clear();
  jest.spyOn(window, "scrollTo").mockImplementation(() => {});
  jest.spyOn(Math, "random").mockReturnValue(0.999999);
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test("multiple textbooks render as aligned lines inside one quiz entry with blank sections preserved", () => {
  render(<table><tbody><tr><td colSpan={3}><QuizSources sources={[
    { textbook: "Book A", chapters: "Chapter 1", sections: "" },
    { textbook: "Book B", chapters: "Chapters 2â€“3", sections: "2.1â€“2.4" },
  ]} /></td></tr></tbody></table>);
  const rows = screen.getAllByRole("row");
  expect(rows).toHaveLength(1);
  expect(within(rows[0]).getByText("Book A")).toBeInTheDocument();
  expect(within(rows[0]).getByText("Book B")).toBeInTheDocument();
  expect(screen.getByText("Book A").parentElement).toHaveStyle({ display: "grid" });
});

test("taking four questions updates the table, recent quiz, and next lifetime attempt number", () => {
  const view = render(<QuizApp3Page />);
  expect(screen.queryByText("Sign in")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Quiz search" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Hardware Basics" }));
  expect(screen.getAllByTestId("matching-row")).toHaveLength(4);
  expect(screen.getByText("Attempt 1")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  expect(screen.getByText("Score 40%")).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(PROGRESS_KEY)!).attempts).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Keep Going" }));
  expect(screen.getByText("Attempt 2")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "All quizzes" }));
  const table = screen.getByRole("table", { name: "Quiz search results" });
  const row = within(table).getByRole("button", { name: "Hardware Basics" }).closest("tr")!;
  expect(within(row).getByText("—")).toBeInTheDocument();
  expect(within(row).getByText("1 / 3")).toBeInTheDocument();
  expect(screen.queryByRole("columnheader", { name: "100% attempts" })).not.toBeInTheDocument();
  expect(screen.queryByRole("columnheader", { name: "Below 100%" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Take quiz" })).toBeInTheDocument();
  view.unmount();
  render(<QuizApp3Page />);
  fireEvent.click(screen.getByRole("button", { name: "Take quiz" }));
  expect(screen.getByText("Attempt 2")).toBeInTheDocument();
});

test("search and filters show a recoverable empty state; prompt begins with editable variables", () => {
  render(<QuizApp3Page />);
  fireEvent.change(screen.getByRole("textbox", { name: "Search quizzes" }), { target: { value: "no matching subject" } });
  expect(screen.getByText("No quizzes match your search.")).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: "Clear filters" })[0]);
  expect(screen.getByRole("button", { name: "Hardware Basics" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Quiz prompt" }));
  const modal = screen.getByRole("dialog", { name: /Create a quiz with AI/ });
  expect((within(modal).getByRole("textbox", { name: "AI quiz creation prompt" }) as HTMLTextAreaElement).value).toMatch(/^VARIABLES/);
  expect(within(modal).getByRole("button", { name: "Copy prompt" })).toBeInTheDocument();
  fireEvent.click(within(modal).getByRole("button", { name: "Close prompt" }));
});

test("recent section contains only three distinct quizzes in most-recent order", () => {
  const ids = ["hardware-basics", "cloud-computing-1", "cables-and-ports", "chromebook-care", "hardware-basics"];
  localStorage.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, conceptStates: {}, attempts: ids.map((quizId, index) => ({
    id: String(index), quizId, score: 100, correctCount: 10, totalCount: 10, completedQuiz: true,
    createdAt: `2026-10-${10 + index}T12:00:00.000Z`,
  })) }));
  render(<QuizApp3Page />);
  const recent = screen.getByRole("region", { name: "3 most recent quizzes" });
  expect(within(recent).getAllByRole("heading", { level: 3 }).map((item) => item.textContent))
    .toEqual(["Hardware Basics", "Chromebook Care", "Cables and Ports"]);
});

test("cards and table share lifetime proficiency while daily counters reset at midnight", () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 9, 18, 23, 59, 59));
  const attempts = Array.from({ length: 10 }, (_, index) => ({
    id: String(index), quizId: "hardware-basics", score: index === 9 ? 0 : 100,
    correctCount: index === 9 ? 0 : 10, totalCount: 10, completedQuiz: true,
    createdAt: new Date(2026, 9, index < 8 ? 17 : 18, 12, index).toISOString(),
    bonusRoundsEarned: index === 9 ? 1 : 0,
  }));
  localStorage.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, conceptStates: {}, attempts }));
  const view = render(<QuizApp3Page />);
  const table = screen.getByRole("table", { name: "Quiz search results" });
  const row = within(table).getByRole("button", { name: "Hardware Basics" }).closest("tr")!;
  const recent = screen.getByRole("region", { name: "3 most recent quizzes" });
  expect(within(row).getByText("90%")).toHaveStyle({ color: "#58c98c", fontSize: "28px" });
  expect(within(recent).getByText("90%")).toBeInTheDocument();
  expect(within(row).getByText("2 / 4")).toBeInTheDocument();
  expect(within(row).getByText("+1")).toBeInTheDocument();
  expect(within(recent).getByText("Attempt 2 / 4")).toBeInTheDocument();
  expect(within(recent).queryByText(/at 100%/)).not.toBeInTheDocument();
  expect(within(recent).queryByText(/Quiz 2/)).not.toBeInTheDocument();
  // The open page resets automatically at midnight, with no refocus or reload.
  act(() => { jest.advanceTimersByTime(2000); });
  expect(within(row).getByText("0 / 3")).toBeInTheDocument();
  expect(within(row).getByText("90%")).toBeInTheDocument();
  expect(within(row).queryByText("+1")).not.toBeInTheDocument();
  expect(within(recent).getByText("Attempt 0 / 3")).toBeInTheDocument();
  view.unmount();
  jest.useRealTimers();
});

test("a daily allowance permits exactly one missed-question bonus and survives reopening the quiz", () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 9, 18, 12));
  const quiz = require("./quizzes/hardware-basics.json");
  // The regular three attempts are used, with four missed concepts saved.
  const { createSession } = require("./quizEngine");
  const state = createSession(quiz, Object.fromEntries(quiz.concepts.map((concept: any, index: number) => [concept.conceptKey, index >= 4])));
  state.firstPassWrongConceptIds = quiz.concepts.slice(0, 4).map((concept: any) => concept.conceptKey);
  state.bonusRoundsEarned = 1;
  state.complete = true;
  localStorage.setItem(PROGRESS_KEY, JSON.stringify({
    version: 1, conceptStates: { [quiz.id]: state.conceptState },
    quizSessions: { [quiz.id]: { date: "2026-10-18", state } },
    attempts: Array.from({ length: 3 }, (_, index) => ({
      id: String(index), quizId: quiz.id, score: 60, correctCount: 6, totalCount: 10,
      createdAt: new Date().toISOString(), bonusRoundsEarned: 1,
    })),
  }));
  const view = render(<QuizApp3Page />);
  fireEvent.click(screen.getByRole("button", { name: "Hardware Basics" }));
  expect(screen.getByText("Daily bonus round")).toBeInTheDocument();
  expect(screen.getAllByTestId("matching-row")).toHaveLength(4);
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  expect(JSON.parse(localStorage.getItem(PROGRESS_KEY)!).attempts).toHaveLength(4);
  expect(screen.queryByRole("button", { name: "Keep Going" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Take bonus round" })).not.toBeInTheDocument();
  view.unmount();
  render(<QuizApp3Page />);
  fireEvent.click(screen.getByRole("button", { name: "Hardware Basics" }));
  expect(screen.getByText(/completed today's allowed attempts/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
  jest.useRealTimers();
});
