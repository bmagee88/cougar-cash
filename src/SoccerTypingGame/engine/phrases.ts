import { clamp } from "./geometry";
import { PhraseScalingConfig, Rng } from "./types";

export function scaleDistanceToCharacterCount(distance: number, scaling: PhraseScalingConfig) {
  const ratio = clamp(distance / Math.max(1, scaling.normalizationDistance), 0, 1);
  return Math.round(scaling.minChars + ratio * (scaling.maxChars - scaling.minChars));
}

export function choosePhraseForCharacterCount(
  phraseBank: string[],
  targetCharacters: number,
  rng: Rng = Math.random
) {
  const candidates = [...phraseBank].sort((a, b) => {
    const lengthDelta = Math.abs(a.length - targetCharacters) - Math.abs(b.length - targetCharacters);
    if (lengthDelta !== 0) return lengthDelta;
    return a.localeCompare(b);
  });
  const bestDelta = candidates.length ? Math.abs(candidates[0].length - targetCharacters) : 0;
  const bestMatches = candidates.filter((phrase) => Math.abs(phrase.length - targetCharacters) === bestDelta);
  const selectedIndex = Math.floor(clamp(rng(), 0, 0.999999) * Math.max(1, bestMatches.length));

  return bestMatches[selectedIndex] ?? "pass";
}

export function choosePhraseForDistance(
  distance: number,
  scaling: PhraseScalingConfig,
  phraseBank: string[],
  rng: Rng = Math.random
) {
  return choosePhraseForCharacterCount(
    phraseBank,
    scaleDistanceToCharacterCount(distance, scaling),
    rng
  );
}
