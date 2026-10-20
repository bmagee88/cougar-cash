import type { Question } from "./engine";
import { LETTER_NAMES } from "./resources";

// Target words may be named as listening cues. Visible blanks and hidden steps
// remain unsolved, and a request never expands into the full answer list.
export function questionPrompt(question: Question, voice: boolean) {
  if (!voice) return question.prompt;
  if (question.skill === "sounds" && question.picture) {
    const match = question.prompt.match(/^(First|Last) letter in .+\?$/);
    if (match) return `${match[1]} letter?`;
  }
  if (question.skill === "pictures" && question.grade < 2) return "Find the picture.";
  return question.prompt;
}

export function questionReading(question: Question, voice = false) {
  // Naming the target word is the listening cue, not a spelling of its answer.
  const wordExercise = ["sounds", "spelling", "sightWords"].includes(question.skill);
  const mathExercise = ["addition", "subtraction", "counting"].includes(question.skill);
  return question.listening || mathExercise || (voice && wordExercise) ? question.speech : question.prompt;
}
export function displayReading(value: string) {
  if (/^[a-z_]+$/i.test(value)) return value.split("").map(char => char === "_" ? "blank" : LETTER_NAMES[char.toLowerCase()]).join(", ");
  return value.replace(/_/g, " blank ").replace(/\+/g, " plus ").replace(/[−-]/g, " minus ").replace(/=/g, " equals ")
    .replace(/·/g, ", ").replace(/←/g, " before ").replace(/→/g, " after ").replace(/\?/g, " question mark ");
}
export function instructionReading(step: NonNullable<Question["sequence"]>["steps"][number]) {
  if (step.missing) return `${step.label === "?" ? "Missing step number" : step.label}. Missing instruction.`;
  return `${step.label === "?" ? "Missing step number" : step.incorrect ? "Fix this step" : step.label}. ${step.token.spoken}.`;
}
