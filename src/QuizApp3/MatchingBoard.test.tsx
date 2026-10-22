import React, { useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import MatchingBoard from "../CQuiz2/MatchingBoard";

declare const test: any, expect: any, jest: any, beforeEach: any, afterEach: any;

const questions = [{ id: "q1", text: "First question?" }, { id: "q2", text: "Second question?" }];
const originalSpeech = Object.getOwnPropertyDescriptor(window, "speechSynthesis");
const originalUtterance = Object.getOwnPropertyDescriptor(window, "SpeechSynthesisUtterance");
let synthesis: { speak: any; cancel: any };

beforeEach(() => {
  synthesis = { speak: jest.fn(), cancel: jest.fn() };
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: synthesis });
  Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: class {
    text: string;
    constructor(text: string) { this.text = text; }
  } });
});
afterEach(() => {
  if (originalSpeech) Object.defineProperty(window, "speechSynthesis", originalSpeech);
  else delete (window as any).speechSynthesis;
  if (originalUtterance) Object.defineProperty(window, "SpeechSynthesisUtterance", originalUtterance);
  else delete (window as any).SpeechSynthesisUtterance;
});

const Board = ({ studyTools = true, disabled = false, nextRound = false }) => {
  const [answers, setAnswers] = useState([{ id: "a1", text: "First answer" }, { id: "a2", text: "Second answer" }]);
  const [checkedAnswers, setCheckedAnswers] = useState({});
  return <MatchingBoard questions={nextRound ? questions.map((q) => ({ ...q, id: `${q.id}-next` })) : questions}
    answers={answers} setAnswers={setAnswers} checkedAnswers={checkedAnswers} setCheckedAnswers={setCheckedAnswers}
    studyTools={studyTools} disabled={disabled} />;
};

test("numbered questions highlight and dim only questions, with a clear-highlight control", () => {
  render(<Board />);
  const cards = screen.getAllByTestId("matching-question");
  expect(within(cards[0]).getByText("1.")).toBeInTheDocument();
  expect(within(cards[1]).getByText("2.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Focus question 1" }));
  expect(screen.getByRole("button", { name: "Focus question 1" })).toHaveAttribute("aria-pressed", "true");
  expect(cards[0]).toHaveStyle({ opacity: 1 });
  expect(cards[1]).toHaveStyle({ opacity: 0.4 });
  expect(screen.getByRole("button", { name: "Move answer: Second answer" })).not.toHaveStyle({ opacity: 0.4 });
  fireEvent.click(screen.getByRole("button", { name: "Show all questions" }));
  expect(cards[1]).toHaveStyle({ opacity: 1 });
  fireEvent.click(screen.getByRole("button", { name: "Focus question 2" }));
  fireEvent.click(screen.getByRole("button", { name: "Focus question 2" }));
  expect(cards[0]).toHaveStyle({ opacity: 1 });
});

test("speakers read the displayed text, stop or replace speech, and remain usable after submission", () => {
  const view = render(<Board disabled />);
  fireEvent.click(screen.getByRole("button", { name: "Read question 1 aloud" }));
  expect(synthesis.speak.mock.calls[0][0].text).toBe("Question 1. First question?");
  expect(screen.getByRole("button", { name: "Focus question 1" })).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(screen.getByRole("button", { name: "Read answer in row 2 aloud" }));
  expect(synthesis.cancel).toHaveBeenCalledTimes(1);
  expect(synthesis.speak.mock.calls[1][0].text).toBe("Second answer");
  fireEvent.click(screen.getByRole("button", { name: "Stop reading answer in row 2" }));
  expect(synthesis.cancel).toHaveBeenCalledTimes(2);
  expect(synthesis.speak).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "Read question 2 aloud" }));
  view.rerender(<Board disabled nextRound />);
  expect(synthesis.cancel).toHaveBeenCalledTimes(3);
  fireEvent.click(screen.getByRole("button", { name: "Read question 2 aloud" }));
  view.unmount();
  expect(synthesis.cancel).toHaveBeenCalledTimes(4);
});

test("speech completion and failure reset the button, and unsupported browsers explain the disabled speakers", () => {
  const view = render(<Board />);
  fireEvent.click(screen.getByRole("button", { name: "Read question 1 aloud" }));
  act(() => synthesis.speak.mock.calls[0][0].onend());
  expect(screen.getByRole("button", { name: "Read question 1 aloud" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Read question 1 aloud" }));
  act(() => synthesis.speak.mock.calls[1][0].onerror());
  expect(screen.getByText(/Read aloud could not play/)).toBeInTheDocument();
  view.unmount();
  delete (window as any).speechSynthesis;
  render(<Board />);
  expect(screen.getByRole("button", { name: "Read question 1 aloud" })).toBeDisabled();
  expect(screen.getByText(/Read aloud is unavailable in this browser/)).toBeInTheDocument();
});

test("C-Quiz-2 keeps its existing matching controls unless study tools are enabled", () => {
  render(<Board studyTools={false} />);
  expect(screen.queryByRole("button", { name: "Focus question 1" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Read question 1 aloud" })).not.toBeInTheDocument();
  expect(screen.getAllByRole("checkbox", { name: "Mark answer" })).toHaveLength(2);
});
