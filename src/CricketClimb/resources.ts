import { COMPUTER_TOPICS } from "./curriculumResources";

export type PictureWord = { word: string; picture: string; kind: "noun" | "verb" };

// Curated rather than scraped: short, familiar words with a concrete picture cue.
export const THREE_LETTER_WORDS: PictureWord[] = [
  { word: "cat", picture: "🐈", kind: "noun" }, { word: "dog", picture: "🐕", kind: "noun" },
  { word: "sun", picture: "☀️", kind: "noun" }, { word: "hat", picture: "🎩", kind: "noun" },
  { word: "bus", picture: "🚌", kind: "noun" }, { word: "pig", picture: "🐖", kind: "noun" },
  { word: "fox", picture: "🦊", kind: "noun" }, { word: "hen", picture: "🐔", kind: "noun" },
  { word: "bug", picture: "🐛", kind: "noun" }, { word: "bed", picture: "🛏️", kind: "noun" },
  { word: "cup", picture: "🥤", kind: "noun" }, { word: "net", picture: "🥅", kind: "noun" },
  { word: "bat", picture: "🦇", kind: "noun" }, { word: "egg", picture: "🥚", kind: "noun" },
  { word: "ant", picture: "🐜", kind: "noun" }, { word: "cow", picture: "🐄", kind: "noun" },
  { word: "run", picture: "🏃", kind: "verb" }, { word: "sit", picture: "🧘", kind: "verb" },
  { word: "dig", picture: "⛏️", kind: "verb" }, { word: "eat", picture: "😋", kind: "verb" },
];

export const FOUR_LETTER_WORDS: PictureWord[] = [
  { word: "frog", picture: "🐸", kind: "noun" }, { word: "duck", picture: "🦆", kind: "noun" },
  { word: "fish", picture: "🐟", kind: "noun" }, { word: "bird", picture: "🐦", kind: "noun" },
  { word: "moon", picture: "🌙", kind: "noun" }, { word: "star", picture: "⭐", kind: "noun" },
  { word: "tree", picture: "🌳", kind: "noun" }, { word: "book", picture: "📕", kind: "noun" },
  { word: "boat", picture: "⛵", kind: "noun" }, { word: "cake", picture: "🎂", kind: "noun" },
  { word: "bell", picture: "🔔", kind: "noun" }, { word: "kite", picture: "🪁", kind: "noun" },
  { word: "bear", picture: "🐻", kind: "noun" }, { word: "hand", picture: "✋", kind: "noun" },
  { word: "jump", picture: "🦘", kind: "verb" }, { word: "swim", picture: "🏊", kind: "verb" },
  { word: "sing", picture: "🎤", kind: "verb" }, { word: "wave", picture: "👋", kind: "verb" },
];

export const FIVE_LETTER_WORDS: PictureWord[] = [
  { word: "apple", picture: "🍎", kind: "noun" }, { word: "house", picture: "🏠", kind: "noun" },
  { word: "plant", picture: "🪴", kind: "noun" }, { word: "snail", picture: "🐌", kind: "noun" },
  { word: "train", picture: "🚂", kind: "noun" }, { word: "sheep", picture: "🐑", kind: "noun" },
  { word: "horse", picture: "🐎", kind: "noun" }, { word: "mouse", picture: "🐁", kind: "noun" },
  { word: "whale", picture: "🐋", kind: "noun" }, { word: "tiger", picture: "🐅", kind: "noun" },
  { word: "bread", picture: "🍞", kind: "noun" }, { word: "spoon", picture: "🥄", kind: "noun" },
  { word: "sleep", picture: "😴", kind: "verb" }, { word: "dance", picture: "💃", kind: "verb" },
  { word: "laugh", picture: "😆", kind: "verb" }, { word: "write", picture: "✍️", kind: "verb" },
];

export const PICTURE_WORDS = [...THREE_LETTER_WORDS, ...FOUR_LETTER_WORDS, ...FIVE_LETTER_WORDS];
export const COMMON_NOUNS = PICTURE_WORDS.filter(({ kind }) => kind === "noun");
export const COMMON_VERBS = PICTURE_WORDS.filter(({ kind }) => kind === "verb");
export const EMOJIS = PICTURE_WORDS.map(({ picture, word }) => ({ value: picture, spoken: word }));
export const SIGHT_WORDS = {
  early: ["a", "I", "am", "an", "at", "in", "is", "it", "me", "my", "no", "on", "up", "we"],
  growing: ["and", "are", "can", "for", "get", "has", "her", "him", "not", "see", "the", "was", "you"],
  firstGrade: ["away", "come", "down", "from", "have", "here", "like", "look", "play", "said", "some", "that", "they", "this", "want", "with", "your"],
};

export const NAVIGATION_SYMBOLS = [
  { value: "⌂", spoken: "home", prompt: "Find the home button." },
  { value: "←", spoken: "back", prompt: "Find the back button." },
  { value: "→", spoken: "next", prompt: "Find the next button." },
  { value: "▶", spoken: "play", prompt: "Find the play button." },
  { value: "Ⅱ", spoken: "pause", prompt: "Find the pause button." },
  { value: "✕", spoken: "close", prompt: "Find the close button." },
  { value: "🔍", spoken: "search", prompt: "Find the search button." },
  { value: "🔊", spoken: "sound", prompt: "Find the sound button." },
  { value: "⚙", spoken: "settings", prompt: "Find the settings button." },
  { value: "☰", spoken: "menu", prompt: "Find the menu button." },
  { value: "↶", spoken: "undo", prompt: "Find the undo button." },
  { value: "⌫", spoken: "delete", prompt: "Find the delete button." },
];

export const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");
// Give isolated letters to the voice engine as letter names, including ambiguous A and I.
export const LETTER_NAMES: Record<string, string> = {
  a: "ay", b: "bee", c: "see", d: "dee", e: "ee", f: "eff", g: "jee", h: "aitch", i: "eye",
  j: "jay", k: "kay", l: "ell", m: "em", n: "en", o: "oh", p: "pee", q: "cue", r: "ar",
  s: "ess", t: "tee", u: "you", v: "vee", w: "double you", x: "ex", y: "why", z: "zee",
};

export const SKILL_GROUPS = [
  { label: "Letters & reading", skills: [
    { id: "letters", label: "Letter names", icon: "Aa" },
    { id: "letterPairs", label: "Big & little letters", icon: "Bb" },
    { id: "sounds", label: "First & last letters", icon: "🐝" },
    { id: "spelling", label: "Missing letters", icon: "c_t" },
    { id: "sightWords", label: "Sight words", icon: "♡" },
  ] },
  { label: "Numbers & discovery", skills: [
    { id: "counting", label: "Counting & patterns", icon: "123" },
    { id: "addition", label: "Adding", icon: "+" },
    { id: "subtraction", label: "Taking away", icon: "−" },
    { id: "pictures", label: "Picture vocabulary", icon: "🍎" },
  ] },
  { label: "Your computer literacy checklist", skills: [...COMPUTER_TOPICS] },
  { label: "Classic computer practice · optional", skills: [
    { id: "symbols", label: "Computer buttons", icon: "⌂" },
    { id: "computers", label: "Computer basics", icon: "⌨" },
    { id: "algorithms", label: "Algorithms & order", icon: "1→" },
  ] },
];

export const SKILLS = SKILL_GROUPS.flatMap(({ skills }) => skills);
export type Grade = 0 | 1 | 2;
export const GRADE_LEVELS: { id: Grade; label: string; spoken: string; icon: string }[] = [
  { id: 0, label: "Kindergarten", spoken: "Kindergarten", icon: "K" },
  { id: 1, label: "1st grade", spoken: "First grade", icon: "1" },
  { id: 2, label: "2nd grade", spoken: "Second grade", icon: "2" },
];
export type SkillId = "letters" | "letterPairs" | "sounds" | "spelling" | "sightWords" | "counting" | "addition" | "subtraction" | "pictures" | "symbols" | "computers" | "algorithms" | typeof COMPUTER_TOPICS[number]["id"];
