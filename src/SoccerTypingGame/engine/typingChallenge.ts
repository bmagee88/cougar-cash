import { TypingChallenge, TypingChallengeStats } from "./types";

export function createTypingChallenge(phrase: string, startedAtMs: number): TypingChallenge {
  return {
    phrase,
    typed: "",
    startedAtMs,
    printableKeystrokes: 0,
    incorrectKeystrokes: 0,
    backspaces: 0,
  };
}

export function isPrintableKey(key: string) {
  return key.length === 1 && key >= " " && key !== "\u007f";
}

export function isChallengeComplete(challenge: TypingChallenge) {
  return challenge.typed === challenge.phrase;
}

export function applyTypingKey(
  challenge: TypingChallenge,
  key: string,
  nowMs: number
): TypingChallenge {
  if (challenge.completedAtMs !== undefined) return challenge;

  if (key === "Backspace") {
    return {
      ...challenge,
      typed: challenge.typed.slice(0, -1),
      backspaces: challenge.backspaces + 1,
    };
  }

  if (!isPrintableKey(key) || challenge.typed.length >= challenge.phrase.length) {
    return challenge;
  }

  const nextIndex = challenge.typed.length;
  const nextTyped = `${challenge.typed}${key}`;
  const incorrectKeystrokes =
    key === challenge.phrase[nextIndex]
      ? challenge.incorrectKeystrokes
      : challenge.incorrectKeystrokes + 1;
  const completedAtMs = nextTyped === challenge.phrase ? nowMs : undefined;

  return {
    ...challenge,
    typed: nextTyped,
    completedAtMs,
    printableKeystrokes: challenge.printableKeystrokes + 1,
    incorrectKeystrokes,
  };
}

export function getTypingStats(challenge: TypingChallenge, nowMs?: number): TypingChallengeStats {
  const endTime = challenge.completedAtMs ?? nowMs ?? challenge.startedAtMs;
  const printableKeystrokes = Math.max(0, challenge.printableKeystrokes);
  const correctKeystrokes = Math.max(0, printableKeystrokes - challenge.incorrectKeystrokes);

  return {
    phrase: challenge.phrase,
    elapsedMs: Math.max(0, endTime - challenge.startedAtMs),
    printableKeystrokes,
    incorrectKeystrokes: challenge.incorrectKeystrokes,
    backspaces: challenge.backspaces,
    accuracy: printableKeystrokes === 0 ? 1 : correctKeystrokes / printableKeystrokes,
  };
}
