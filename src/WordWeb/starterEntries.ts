import type { DictionaryEntry } from "./graph";
import { STARTER_SOURCE, STUDENT_POLICY } from "./studentSafety";

// Original, reviewed starter text. These are not Merriam-Webster quotations.
// Only these bundled words work offline; all live lookups use the student API.
const starter = (word: string, definition: string, synonyms: string[] = [], antonyms: string[] = []): DictionaryEntry => ({
  word, phonetic: "", meanings: [{ partOfSpeech: "noun", definition }], synonyms, antonyms, forms: [],
  sourceName: STARTER_SOURCE, sourceUrl: "/word-web", studentPolicy: STUDENT_POLICY,
});

export const STARTER_ENTRIES: DictionaryEntry[] = [
  starter("curiosity", "An interest in learning and discovering new things.", ["interest", "inquisitiveness"], ["indifference"]),
  starter("interest", "A feeling of wanting to learn about something.", ["curiosity"], ["indifference"]),
  starter("learning", "The process of building knowledge through study, practice, and discovery."),
  starter("knowledge", "An understanding of things gained through learning and experience."),
  starter("discovery", "The act of finding something or learning about it for the first time."),
  starter("inquisitiveness", "A wish to ask questions and explore because of curiosity.", ["curiosity"]),
  starter("indifference", "A lack of interest in something.", [], ["interest", "curiosity"]),
];
