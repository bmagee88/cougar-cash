import React from "react";
import { act, fireEvent, render as renderUI, screen, within } from "@testing-library/react";
import QuizApp3Page from "./QuizApp3Page";
import { PROGRESS_KEY, readProgress, readRound, saveRound } from "./storage";
import QuizSources from "./QuizSources";

declare const test: any, expect: any, jest: any, beforeEach: any, afterEach: any;

jest.mock("./catalog", () => ({
  catalogErrors: [],
  quizzes: [
    require("./quizzes/computers-ch1-s3-s4.json"),
    require("./quizzes/computers-ch1-s5.json"),
    require("./quizzes/computers-ch1-s5-grade3.json"),
    require("./quizzes/hardware-basics.json"),
    require("./quizzes/cloud-computing-1.json"),
    require("./quizzes/cables-and-ports.json"),
    require("./quizzes/chromebook-care.json"),
  ],
  ...require("./catalogUtils"),
}));

// Existing runner tests exercise the supplemental hardware quiz.
const render = (ui: React.ReactElement, expandAdditional = true) => {
  const view = renderUI(ui);
  const additional = screen.queryByRole("button", { name: "Additional quizzes" });
  if (expandAdditional && additional) fireEvent.click(additional);
  return view;
};

const beginTodaysQuiz = () => {
  const begin = screen.queryByRole("button", { name: "Begin today's quiz" }) as HTMLButtonElement | null;
  if (begin && !begin.disabled) fireEvent.click(begin);
};

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
  expect(screen.getByRole("heading", { name: "Course work" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Hardware Basics" }));
  beginTodaysQuiz();
  expect(screen.getAllByTestId("matching-row")).toHaveLength(4);
  expect(screen.getByText("Attempt 1")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  expect(screen.getByText("Score 40%")).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(PROGRESS_KEY)!).attempts).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Keep Going" }));
  expect(screen.getByText("Attempt 2")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "All quizzes" }));
  const table = screen.getByRole("table", { name: "Additional quiz search results" });
  const row = within(table).getByRole("button", { name: "Hardware Basics" }).closest("tr")!;
  expect(within(row).getByText("—")).toBeInTheDocument();
  expect(within(row).getByText("1 / 3")).toBeInTheDocument();
  expect(screen.queryByRole("columnheader", { name: "100% attempts" })).not.toBeInTheDocument();
  expect(screen.queryByRole("columnheader", { name: "Below 100%" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Take quiz" })).toBeInTheDocument();
  view.unmount();
  render(<QuizApp3Page />);
  fireEvent.click(screen.getByRole("button", { name: "Take quiz" }));
  beginTodaysQuiz();
  expect(screen.getByText("Attempt 2")).toBeInTheDocument();
});

test("search and filters show a recoverable empty state; prompt begins with editable variables", () => {
  render(<QuizApp3Page />);
  fireEvent.change(screen.getByRole("textbox", { name: "Search additional quizzes" }), { target: { value: "no matching subject" } });
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

test("cards and table hide rolling proficiency at midnight until the quiz is taken again", () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 9, 18, 23, 59, 59));
  const attempts = Array.from({ length: 10 }, (_, index) => ({
    id: String(index), quizId: "hardware-basics", score: index === 9 ? 80 : 100,
    correctCount: index === 9 ? 8 : 10, totalCount: 10, completedQuiz: true,
    createdAt: new Date(2026, 9, index < 8 ? 17 : 18, 12, index).toISOString(),
    bonusRoundsEarned: index === 9 ? 1 : 0,
  }));
  localStorage.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, conceptStates: {}, attempts }));
  const view = render(<QuizApp3Page />);
  const table = screen.getByRole("table", { name: "Additional quiz search results" });
  const row = within(table).getByRole("button", { name: "Hardware Basics" }).closest("tr")!;
  const recent = screen.getByRole("region", { name: "3 most recent quizzes" });
  expect(within(row).getByText("93.3%")).toHaveStyle({ color: "#58c98c", fontSize: "28px" });
  expect(within(recent).getByText("93.3%")).toBeInTheDocument();
  expect(within(row).getByText("2 / 4")).toBeInTheDocument();
  expect(within(row).getByText("+1")).toBeInTheDocument();
  expect(within(recent).getByText("Attempt 2 / 4")).toBeInTheDocument();
  expect(within(recent).queryByText(/at 100%/)).not.toBeInTheDocument();
  expect(within(recent).queryByText(/Quiz 2/)).not.toBeInTheDocument();
  // The open page resets automatically at midnight, with no refocus or reload.
  act(() => { jest.advanceTimersByTime(2000); });
  expect(within(row).getByText("0 / 3")).toBeInTheDocument();
  expect(within(row).queryByText("93.3%")).not.toBeInTheDocument();
  expect(within(recent).queryByText("93.3%")).not.toBeInTheDocument();
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
  beginTodaysQuiz();
  expect(screen.getByText("Daily bonus round")).toBeInTheDocument();
  expect(screen.getAllByTestId("matching-row")).toHaveLength(4);
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  expect(JSON.parse(localStorage.getItem(PROGRESS_KEY)!).attempts).toHaveLength(4);
  expect(screen.queryByRole("button", { name: "Keep Going" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Take bonus round" })).not.toBeInTheDocument();
  view.unmount();
  render(<QuizApp3Page />);
  fireEvent.click(screen.getByRole("button", { name: "Hardware Basics" }));
  beginTodaysQuiz();
  expect(screen.getByText(/completed today's allowed attempts/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
  jest.useRealTimers();
});

test("an unfinished answer arrangement and reminders survive reload and midnight without recording an attempt", () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 9, 18, 23, 59, 59));
  const quiz = require("./quizzes/hardware-basics.json");
  const view = render(<QuizApp3Page />);
  fireEvent.click(screen.getByRole("button", { name: "Hardware Basics" }));
  beginTodaysQuiz();
  expect(screen.getByRole("button", { name: "Directions" })).toHaveAttribute("aria-expanded", "false");
  const draft = readRound(quiz)!;
  view.unmount();
  const swapped = [...draft.answers];
  [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
  saveRound(quiz.id, { ...draft, answers: swapped, checkedAnswers: { [swapped[0].id]: true } });
  render(<QuizApp3Page />);
  fireEvent.click(screen.getByRole("button", { name: "Hardware Basics" }));
  beginTodaysQuiz();
  const rowText = screen.getAllByTestId("matching-row").map((row) => row.textContent);
  expect(screen.getAllByRole("checkbox", { name: "Mark answer" })[0]).toBeChecked();
  expect(within(screen.getAllByTestId("matching-row")[0]).getByText(swapped[0].text)).toBeInTheDocument();
  expect(readProgress().attempts).toHaveLength(0);
  act(() => { jest.advanceTimersByTime(2000); });
  expect(screen.getAllByTestId("matching-row").map((row) => row.textContent)).toEqual(rowText);
  expect(screen.getAllByRole("checkbox", { name: "Mark answer" })[0]).toBeChecked();
  expect(screen.getByText(/Your unsubmitted round has been restored from 2026-10-18/)).toBeInTheDocument();
  expect(screen.getByText("Today 0 / 3")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  expect(readProgress().attempts).toHaveLength(1);
  expect(new Date(readProgress().attempts[0].createdAt).getDate()).toBe(19);
  expect(screen.getByRole("button", { name: "Saved attempts 1/4" })).toBeInTheDocument();
});

test("saved results remain in history while reopening a quiz returns to the introduction", () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 9, 18, 12));
  let view = render(<QuizApp3Page />);
  fireEvent.click(screen.getByRole("button", { name: "Hardware Basics" }));
  beginTodaysQuiz();
  for (let index = 0; index < 3; index += 1) {
    if (index) {
      act(() => { jest.advanceTimersByTime(1); });
      fireEvent.click(screen.getByRole("button", { name: "Keep Going" }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  }
  expect(readProgress().attempts.map((attempt) => attempt.completedQuiz)).toEqual([false, false, true]);
  expect(screen.getByText("Score 100%")).toBeInTheDocument();
  view.unmount();
  view = render(<QuizApp3Page />);
  fireEvent.click(screen.getByRole("button", { name: "Hardware Basics" }));
  beginTodaysQuiz();
  expect(screen.queryByText("Score 100%")).not.toBeInTheDocument();
  expect(screen.queryByTestId("matching-row")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Begin today's quiz" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
  expect(screen.getByText("Today 3 / 3")).toBeInTheDocument();
  view.unmount();
  jest.setSystemTime(new Date(2026, 9, 19, 12));
  render(<QuizApp3Page />);
  const table = screen.getByRole("table", { name: "Additional quiz search results" });
  const row = within(table).getByRole("button", { name: "Hardware Basics" }).closest("tr")!;
  expect(within(row).queryByText("100%")).not.toBeInTheDocument();
  expect(within(row).getByText("0 / 3")).toBeInTheDocument();
  fireEvent.click(within(row).getByRole("button", { name: "Hardware Basics" }));
  expect(screen.queryByText("Score 100%")).not.toBeInTheDocument();
  expect(screen.queryByTestId("matching-row")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Saved attempts 0/3" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
  expect(readProgress().attempts).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: "Begin today's quiz" }));
  expect(screen.getByText("Attempt 4")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  expect(readProgress().attempts).toHaveLength(4);
  expect(screen.getByText("Today 1 / 3")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "All quizzes" }));
  const updatedTable = screen.getByRole("table", { name: "Additional quiz search results" });
  const updatedRow = within(updatedTable).getByRole("button", { name: "Hardware Basics" }).closest("tr")!;
  expect(within(updatedRow).getByText("100%")).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "3 most recent quizzes" })).getByText("100%")).toBeInTheDocument();
});

test("a failed attempt write stays retryable and never claims the attempt was saved", () => {
  render(<QuizApp3Page />);
  fireEvent.click(screen.getByRole("button", { name: "Hardware Basics" }));
  beginTodaysQuiz();
  const original = Storage.prototype.setItem;
  const spy = jest.spyOn(Storage.prototype, "setItem").mockImplementation(function (key: string, value: string) {
    if (key === PROGRESS_KEY) throw new Error("Quota exceeded");
    original.call(this, key, value);
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  expect(screen.getByText(/Your result could not be saved/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Saved attempts 0/3" })).toBeInTheDocument();
  expect(readProgress().attempts).toHaveLength(0);
  spy.mockRestore();
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  expect(readProgress().attempts).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Saved attempts 1/3" })).toHaveAttribute("aria-expanded", "false");
});

test("an unfinished bonus round survives midnight without carrying yesterday's bonus into today", () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 9, 18, 23, 59, 59));
  const quiz = require("./quizzes/hardware-basics.json");
  const { createSession } = require("./quizEngine");
  const state = createSession(quiz, Object.fromEntries(quiz.concepts.map((concept: any, index: number) => [concept.conceptKey, index >= 4])));
  state.seenConceptIds = quiz.concepts.map((concept: any) => concept.conceptKey);
  state.firstPassWrongConceptIds = state.seenConceptIds.slice(0, 4);
  state.bonusRoundsEarned = 1;
  localStorage.setItem(PROGRESS_KEY, JSON.stringify({
    version: 1, conceptStates: { [quiz.id]: state.conceptState },
    quizSessions: { [quiz.id]: { date: "2026-10-18", state } },
    attempts: Array.from({ length: 3 }, (_, index) => ({
      id: String(index), quizId: quiz.id, score: 60, correctCount: 6, totalCount: 10,
      createdAt: new Date().toISOString(), bonusRoundsEarned: 1, completedQuiz: false,
    })),
  }));
  render(<QuizApp3Page />);
  fireEvent.click(screen.getByRole("button", { name: "Hardware Basics" }));
  beginTodaysQuiz();
  expect(screen.getByText("Daily bonus round")).toBeInTheDocument();
  const questions = screen.getAllByTestId("matching-question").map((question) => question.textContent);
  act(() => { jest.advanceTimersByTime(2000); });
  expect(screen.queryByText("Daily bonus round")).not.toBeInTheDocument();
  expect(screen.getByText("Today 0 / 3")).toBeInTheDocument();
  expect(screen.getAllByTestId("matching-question").map((question) => question.textContent)).toEqual(questions);
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  const saved = readProgress();
  expect(saved.attempts).toHaveLength(4);
  expect(saved.attempts[3].bonusRoundsEarned).toBe(0);
  expect(saved.quizSessions![quiz.id].date).toBe("2026-10-19");
  expect(saved.quizSessions![quiz.id].state.seenConceptIds).toHaveLength(4);
  expect(screen.getByText("Today 1 / 3")).toBeInTheDocument();
});


test("course work includes the Grade 3 section 1.5 quiz while additional quizzes have an independent search", () => {
  render(<QuizApp3Page />, false);
  const course = screen.getByRole("table", { name: "Quiz search results" });
  expect(within(course).getByRole("button", { name: "Computing Systems, Hardware, Software, and Data" })).toBeInTheDocument();
  expect(within(course).getByRole("button", { name: "Input, Processing, Memory, Storage, and Output" })).toBeInTheDocument();
  expect(within(course).getByRole("button", { name: "How Computers Work" })).toBeInTheDocument();
  expect(within(course).queryByRole("button", { name: "Hardware Basics" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Additional quizzes" })).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("table", { name: "Additional quiz search results" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Additional quizzes" }));
  const additional = screen.getByRole("table", { name: "Additional quiz search results" });
  expect(within(additional).getByRole("button", { name: "Hardware Basics" })).toBeInTheDocument();
  expect(within(additional).queryByRole("button", { name: "Computing Systems, Hardware, Software, and Data" })).not.toBeInTheDocument();
  expect(within(additional).queryByRole("button", { name: "How Computers Work" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: "Search additional quizzes" }), { target: { value: "Hardware Basics" } });
  expect(within(additional).queryByRole("button", { name: "Cloud Computing 1" })).not.toBeInTheDocument();
  expect(within(course).getByRole("button", { name: "Computing Systems, Hardware, Software, and Data" })).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: "Search quizzes" }), { target: { value: "Input" } });
  expect(within(course).queryByRole("button", { name: "Computing Systems, Hardware, Software, and Data" })).not.toBeInTheDocument();
  expect(within(additional).getByRole("button", { name: "Hardware Basics" })).toBeInTheDocument();
});

test("saved confirmation expires and score improvements appear only after submission", () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 9, 18, 12));
  render(<QuizApp3Page />);
  fireEvent.click(screen.getByRole("button", { name: "Hardware Basics" }));
  beginTodaysQuiz();
  expect(screen.queryByRole("progressbar", { name: "Quiz concept score" })).not.toBeInTheDocument();
  expect(screen.queryByText(/Each submission counts/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  expect(screen.getByText("Attempt 1 saved on this device.")).toBeInTheDocument();
  expect(screen.getByText("Score up! +40 percentage points")).toBeInTheDocument();
  expect(screen.getByText("Score 40%")).toBeInTheDocument();
  act(() => { jest.advanceTimersByTime(4500); });
  act(() => { jest.advanceTimersByTime(500); });
  expect(screen.queryByText("Attempt 1 saved on this device.")).not.toBeInTheDocument();
  expect(screen.getByText("Score 40%")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Keep Going" }));
  expect(screen.queryByRole("progressbar", { name: "Quiz concept score" })).not.toBeInTheDocument();
  expect(screen.queryByText("Score 40%")).not.toBeInTheDocument();
  expect(screen.queryByText(/Score up!/)).not.toBeInTheDocument();
});


test("opening a quiz shows directions and a description without previewing or saving questions", () => {
  render(<QuizApp3Page />, false);
  fireEvent.click(screen.getByRole("button", { name: "How Computers Work" }));
  expect(screen.getByRole("button", { name: "Directions" })).toHaveAttribute("aria-expanded", "false");
  const description = screen.getByRole("region", { name: "About this quiz" });
  expect(within(description).getByText(/Learn about the jobs a computer does/)).toBeVisible();
  expect(description.closest("#quiz-directions-content")).toBeNull();
  expect(screen.queryByTestId("matching-row")).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Answers" })).not.toBeInTheDocument();
  expect(screen.queryByRole("progressbar", { name: "Quiz concept score" })).not.toBeInTheDocument();
  const quiz = require("./quizzes/computers-ch1-s5-grade3.json");
  expect(readRound(quiz)).toBeUndefined();
  expect(readProgress().attempts).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Begin today's quiz" }));
  expect(screen.getAllByTestId("matching-row")).toHaveLength(4);
  expect(screen.queryByRole("progressbar", { name: "Quiz concept score" })).not.toBeInTheDocument();
  expect(readRound(quiz)).toBeDefined();
  expect(readProgress().attempts).toHaveLength(0);
});

test("a lower submitted score does not trigger the improvement fanfare", () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 9, 18, 12));
  const quiz = require("./quizzes/hardware-basics.json");
  const { createSession, createDailyRound } = require("./quizEngine");
  const state = createSession(quiz, Object.fromEntries(quiz.concepts.map((concept: any) => [concept.conceptKey, true])));
  const round = createDailyRound(quiz, state, { dailyAttempts: 0, dailyBase: 3, dailyBonus: 0 });
  const answers = round.pairs.map((pair: any) => round.answers.find((answer: any) => answer.id === pair.answerId));
  [answers[0], answers[1]] = [answers[1], answers[0]];
  localStorage.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, attempts: [], conceptStates: { [quiz.id]: state.conceptState } }));
  saveRound(quiz.id, { date: "2026-10-18", round, answers, checkedAnswers: {} });
  render(<QuizApp3Page />);
  fireEvent.click(screen.getByRole("button", { name: "Hardware Basics" }));
  beginTodaysQuiz();
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  expect(screen.getByText("Score 80%")).toBeInTheDocument();
  expect(screen.queryByText(/Score up!/)).not.toBeInTheDocument();
});
