import { describe, expect, test, beforeEach, afterEach, jest } from "@jest/globals";
import { speak } from "./audio";

let utterances: SpeechSynthesisUtterance[];
beforeEach(() => {
  jest.useFakeTimers();
  utterances = [];
  Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: class { text: string; constructor(text: string) { this.text = text; } } });
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
    cancel: jest.fn(), getVoices: () => [], speaking: false, pending: false,
    speak: (utterance: SpeechSynthesisUtterance) => utterances.push(utterance),
  } });
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); delete (window as any).speechSynthesis; delete (window as any).SpeechSynthesisUtterance; });

describe("numbered choice narration", () => {
  test("pauses 350ms after the number before reading the answer", async () => {
    const result = speak("2. Click the mouse.", new AbortController().signal);
    expect(utterances.map(item => item.text)).toEqual(["2"]);
    utterances[0].onend({} as SpeechSynthesisEvent);
    await Promise.resolve();
    jest.advanceTimersByTime(349); await Promise.resolve();
    expect(utterances).toHaveLength(1);
    jest.advanceTimersByTime(1); await Promise.resolve();
    expect(utterances.map(item => item.text)).toEqual(["2", "Click the mouse."]);
    utterances[1].onend({} as SpeechSynthesisEvent);
    expect(await result).toBe(true);
  });

  test("cancelling during the pause prevents the old answer from speaking", async () => {
    const controller = new AbortController(), result = speak("1. Old answer.", controller.signal);
    utterances[0].onend({} as SpeechSynthesisEvent); await Promise.resolve();
    controller.abort(); jest.advanceTimersByTime(350);
    expect(await result).toBe(false);
    expect(utterances).toHaveLength(1);
  });

  test("ordinary questions stay in one utterance", async () => {
    const result = speak("5 take away 3?");
    expect(utterances.map(item => item.text)).toEqual(["5 take away 3?"]);
    utterances[0].onend({} as SpeechSynthesisEvent);
    expect(await result).toBe(true);
  });
});
