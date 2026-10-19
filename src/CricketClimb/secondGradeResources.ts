import type { LearningToken } from "./discoveryResources";
import { COMPUTER_TOOLS } from "./discoveryResources";

// Separate banks keep all existing K / first-grade seeded questions unchanged.
export const SECOND_GRADE_WORDS = [
  { word: "train", picture: "🚂" }, { word: "chair", picture: "🪑" }, { word: "brush", picture: "🖌️" },
  { word: "beach", picture: "🏖️" }, { word: "clock", picture: "🕰️" }, { word: "plant", picture: "🪴" },
  { word: "whale", picture: "🐋" }, { word: "sheep", picture: "🐑" }, { word: "grape", picture: "🍇" },
  { word: "house", picture: "🏠" }, { word: "plane", picture: "✈️" }, { word: "heart", picture: "❤️" },
  { word: "cloud", picture: "☁️" }, { word: "bread", picture: "🍞" }, { word: "smile", picture: "🙂" },
  { word: "snake", picture: "🐍" }, { word: "orange", picture: "🍊" }, { word: "banana", picture: "🍌" },
  { word: "carrot", picture: "🥕" }, { word: "rabbit", picture: "🐇" }, { word: "turtle", picture: "🐢" },
  { word: "monkey", picture: "🐒" }, { word: "rocket", picture: "🚀" }, { word: "flower", picture: "🌼" },
  { word: "chicken", picture: "🐔" }, { word: "teacher", picture: "👩‍🏫" }, { word: "rainbow", picture: "🌈" },
  { word: "bicycle", picture: "🚲" }, { word: "dolphin", picture: "🐬" }, { word: "penguin", picture: "🐧" },
];
export const SECOND_GRADE_SIGHT_WORDS = [
  "always", "around", "because", "before", "better", "both", "bring", "buy", "call", "cold", "does", "every",
  "found", "gave", "goes", "green", "made", "many", "once", "pull", "read", "right", "sing", "sleep",
  "tell", "their", "these", "those", "upon", "wash", "which", "why", "wish", "work", "would", "write",
];
export const SOUND_CLUSTERS = [
  { word: "train", index: 1, end: false }, { word: "chair", index: 1, end: false },
  { word: "sheep", index: 1, end: false }, { word: "whale", index: 1, end: false },
  { word: "snake", index: 1, end: false }, { word: "brush", index: 1, end: false },
  { word: "clock", index: 1, end: false }, { word: "plane", index: 1, end: false },
  { word: "flower", index: 1, end: false }, { word: "beach", index: 4, end: true },
  { word: "brush", index: 4, end: true }, { word: "clock", index: 4, end: true },
];
export const VOWEL_TEAMS = [
  { word: "train", indexes: [2, 3] }, { word: "chair", indexes: [2, 3] }, { word: "sheep", indexes: [2, 3] },
  { word: "beach", indexes: [1, 2] }, { word: "house", indexes: [1, 2] }, { word: "heart", indexes: [1, 2] },
  { word: "cloud", indexes: [2, 3] }, { word: "bread", indexes: [2, 3] }, { word: "rainbow", indexes: [1, 2] },
];
export const SECOND_GRADE_VOCABULARY = [
  { value: "🌈", spoken: "rainbow", prompt: "Which arc has seven colors?" },
  { value: "🚲", spoken: "bicycle", prompt: "Which vehicle has two wheels?" },
  { value: "🐬", spoken: "dolphin", prompt: "Which mammal lives in the sea?" },
  { value: "🥕", spoken: "carrot", prompt: "Which orange root can you eat?" },
  { value: "🚀", spoken: "rocket", prompt: "Which vehicle travels into space?" },
  { value: "🐧", spoken: "penguin", prompt: "Which flightless bird swims?" },
  { value: "🐢", spoken: "turtle", prompt: "Which reptile has a shell?" },
  { value: "👩‍🏫", spoken: "teacher", prompt: "Who helps children learn at school?" },
  { value: "🖌️", spoken: "paintbrush", prompt: "Which tool paints a picture?" },
  { value: "🕰️", spoken: "clock", prompt: "Which object tells the time?" },
  { value: "🗺️", spoken: "map", prompt: "Which picture shows places?" },
  { value: "🔑", spoken: "key", prompt: "Which object unlocks a door?" },
  { value: "🌡️", spoken: "thermometer", prompt: "Which tool measures temperature?" },
  { value: "📏", spoken: "ruler", prompt: "Which tool measures length?" },
  { value: "🧲", spoken: "magnet", prompt: "Which object can attract iron?" },
];
export const SECOND_GRADE_BUTTONS = [
  { value: "⧉", spoken: "copy", prompt: "Which button copies selected text?" },
  { value: "📋", spoken: "paste", prompt: "Which button pastes copied text?" },
  { value: "✂", spoken: "cut", prompt: "Which button cuts selected text?" },
  { value: "↷", spoken: "redo", prompt: "Which button repeats undone work?" },
  { value: "↻", spoken: "refresh", prompt: "Which button reloads this page?" },
  { value: "↓", spoken: "download", prompt: "Which button downloads a file?" },
  { value: "↑", spoken: "upload", prompt: "Which button uploads a file?" },
  { value: "💾", spoken: "save", prompt: "Which button saves your changes?" },
  { ...COMPUTER_TOOLS.find(item => item.id === "printer"), prompt: "Which button prints this page?" },
  { value: "📁", spoken: "open folder", prompt: "Which button opens your folder?" },
  { value: "↶", spoken: "undo", prompt: "Which button undoes your change?" },
  { value: "🔍", spoken: "search", prompt: "Which button searches for words?" },
];
export const INPUT_OUTPUT_QUESTIONS = [
  { id: "microphone", prompt: "Which input records sound?" },
  { id: "screen", prompt: "Which output glows with pictures?" },
  { id: "camera", prompt: "Which input captures a photo?" },
  { id: "printer", prompt: "Which output makes a paper copy?" },
  { id: "keyboard", prompt: "Which input uses letter keys?" },
  { id: "mouse", prompt: "Which input moves the pointer?" },
  { id: "headphones", prompt: "Which output plays sound privately?" },
];
export const CONTROL_SHORTCUTS = [
  { key: "c", label: "Copy", action: "copy selected text" }, { key: "v", label: "Paste", action: "paste copied text" },
  { key: "x", label: "Cut", action: "cut selected text" }, { key: "s", label: "Save", action: "save your work" },
  { key: "z", label: "Undo", action: "undo the last change" }, { key: "a", label: "Select all", action: "select all" },
  { key: "p", label: "Print", action: "print" }, { key: "f", label: "Find", action: "find a word" },
];
export const PROGRAM_ACTIONS: LearningToken[] = [
  { value: "👏", spoken: "clap" }, { value: "🦘", spoken: "hop" }, { value: "👋", spoken: "wave" },
  { value: "🎤", spoken: "sing" }, { value: "🙇", spoken: "bow" }, { value: "💃", spoken: "dance" },
];
