import type { Grade } from "./resources";
import { COMPUTER_TOOLS } from "./discoveryResources";
import type { Answer } from "./engine";

export const COMPUTER_TOPICS = [
  { id: "devices", label: "Devices & care", icon: "💻" },
  { id: "keyboard", label: "Pointer & keyboard", icon: "⌨" },
  { id: "navigation", label: "Icons & navigation", icon: "⌂" },
  { id: "web", label: "Browser & web", icon: "🌐" },
  { id: "files", label: "Creation & files", icon: "📁" },
  { id: "safety", label: "Information & safety", icon: "🛡" },
  { id: "thinking", label: "Computational thinking", icon: "1→" },
  { id: "troubleshooting", label: "Troubleshooting", icon: "🔧" },
  { id: "accessibility", label: "Accessibility & habits", icon: "🔊" },
] as const;
export type ComputerTopic = typeof COMPUTER_TOPICS[number]["id"];
type Objective = { id: string; topic: ComputerTopic; grade: Grade; label: string };
const objectives = (topic: ComputerTopic, rows: [string, Grade, string][]): Objective[] => rows.map(([id, grade, label]) => ({ id, topic, grade, label }));

// Stable IDs mirror the teacher's 52-item cumulative checklist. These are knowledge
// checks; independent typing, dragging, and classroom routines need observation too.
export const CURRICULUM_OBJECTIVES: Objective[] = [
  ...objectives("devices", [
    ["D1", 0, "Computer parts and power"], ["D2", 0, "Laptop, desktop, tablet, phone"],
    ["D3", 0, "Power on and readiness"], ["D4", 0, "Care, carrying, storage, charging routines"],
    ["D5", 1, "Headphones, microphone, camera, speakers, charging"],
    ["D6", 1, "Power on versus school sign-in"], ["D7", 1, "Low battery and charging"],
    ["D8", 2, "School sign-in and sign-out"], ["D9", 2, "Which account is signed in"],
  ]),
  ...objectives("keyboard", [
    ["P1", 0, "Move pointer and single-click or tap"], ["P2", 0, "Drag an object"],
    ["P3", 0, "Scroll up and down"], ["P4", 0, "Letters, numbers, Space, Enter, Backspace"],
    ["P5", 0, "Type and correct a word"], ["P6", 1, "Double-click and context menu"],
    ["P7", 1, "Shift, Caps Lock, Tab, arrows"], ["P8", 1, "Position the text cursor to edit"],
    ["P9", 2, "Paragraph capitals, spaces, punctuation"], ["P10", 2, "Select, Copy, Paste, Undo"],
    ["P11", 2, "Pointer versus insertion cursor"],
  ]),
  ...objectives("navigation", [
    ["N1", 0, "Browser opens websites"], ["N2", 0, "Home, Back, Forward, Close"],
    ["N3", 0, "Search, Volume, Play, Pause"], ["N4", 0, "Teacher-provided link or button"],
    ["N5", 1, "Refresh, Settings, Menu, More"], ["N6", 1, "Add, Edit, Delete, Confirm"],
    ["N7", 1, "Padlock and security context"], ["N8", 2, "Bookmark, Folder, Download, Upload"],
    ["N9", 2, "Attachment, Link, Share, Print"], ["N10", 2, "View, Hide, Cloud, Notifications, Fullscreen"],
    ["N11", 2, "Microphone and camera permission icons"],
  ]),
  ...objectives("web", [["W1", 1, "Address bar and hyperlink"], ["W2", 1, "Back, Forward, Refresh"], ["W3", 2, "Simple search phrases"], ["W4", 2, "Search query versus website address"]]),
  ...objectives("files", [["F1", 1, "Digital drawing or writing"], ["F2", 2, "Create, name, reopen a document"], ["F3", 2, "Text size, bold, alignment"], ["F4", 2, "File versus folder"]]),
  ...objectives("safety", [["S1", 0, "Screens are not always true or safe"], ["S2", 0, "Ask before sharing private information"], ["S3", 1, "Passwords protect accounts"], ["S4", 2, "Advertisements persuade"], ["S5", 2, "Passwords and home addresses stay private"]]),
  ...objectives("thinking", [["C1", 0, "Ordered instructions"], ["C2", 0, "Continue a pattern"], ["C3", 1, "Input and output"], ["C4", 1, "Find and fix an instruction"], ["C5", 2, "Repetition and loops"]]),
  ...objectives("troubleshooting", [["T1", 2, "Expected versus actual behavior"]]),
  ...objectives("accessibility", [["A1", 0, "Different people use different tools"], ["A2", 1, "Volume, captions, and audio"]]),
];

export type Token = Answer & { id: string };
const token = (id: string, value: string, spoken: string, image?: string): Token => ({ id, value, spoken, ...(image ? { image } : {}) });
export const DEVICE_TOKENS: Token[] = [
  ...COMPUTER_TOOLS, token("power", "⏻", "power button"), token("tablet", "▣", "tablet", "/cricket-climb/tablet.svg"),
  token("phone", "📱", "phone"), token("speaker", "🔈", "speakers"), token("trackpad", "▱", "trackpad", "/cricket-climb/trackpad.svg"),
];
export const KEY_TOKENS = [
  token("space", "␣", "Space"), token("enter", "↵", "Enter"), token("backspace", "⌫", "Backspace"),
  token("shift", "⇧", "Shift"), token("caps", "⇪", "Caps Lock"), token("tab", "⇥", "Tab"),
  token("left", "←", "left arrow"), token("right", "→", "right arrow"),
];
export const ICON_TOKENS = [
  token("browser", "🌐", "web browser"), token("home", "⌂", "Home"), token("back", "←", "Back"),
  token("forward", "→", "Forward"), token("close", "✕", "Close"), token("search", "🔍", "Search"),
  token("volume", "🔊", "Volume"), token("play", "▶", "Play"), token("pause", "Ⅱ", "Pause"),
  token("refresh", "↻", "Refresh"), token("settings", "⚙", "Settings"), token("menu", "☰", "Menu"),
  token("more", "⋯", "More"), token("add", "+", "Add"), token("edit", "✎", "Edit"),
  token("delete", "🗑", "Delete"), token("confirm", "✓", "Confirm"), token("lock", "🔒", "padlock"),
  token("bookmark", "⭐", "Bookmark"), token("folder", "📁", "Folder"), token("download", "⬇", "Download"),
  token("upload", "⬆", "Upload"), token("attach", "📎", "Attachment"), token("link", "🔗", "Link"),
  token("share", "↗", "Share"), token("print", "🖨️", "Print"), token("view", "👁", "View"),
  token("hide", "◉̸", "Hide", "/cricket-climb/hide.svg"), token("cloud", "☁", "Cloud"), token("bell", "🔔", "Notifications"),
  token("fullscreen", "⛶", "Full screen"), token("mic", "🎤", "Microphone"), token("camera", "📷", "Camera"),
  token("save", "💾", "Save"), token("document", "📄", "document"), token("bold", "𝗕", "Bold"),
  token("align", "≡", "Center align", "/cricket-climb/center.svg"), token("size", "↕", "Text size"), token("draw", "🖌️", "drawing brush"),
  token("undo", "↶", "Undo"), token("captions", "🄭", "Captions", "/cricket-climb/captions.svg"), token("audio", "🗣️", "read aloud"),
];
export const NAMES = ["Pip", "Mia", "Sam", "Leo", "Ava", "Ben"];
export const SEARCH_TOPICS = [
  { subject: "frogs", phrase: "what frogs eat", address: "frogs.example.org" },
  { subject: "plants", phrase: "how plants grow", address: "plants.example.org" },
  { subject: "crickets", phrase: "where crickets live", address: "crickets.example.org" },
  { subject: "penguins", phrase: "where penguins live", address: "penguins.example.org" },
  { subject: "butterflies", phrase: "butterfly life cycle", address: "butterflies.example.org" },
  { subject: "rainbows", phrase: "how rainbows form", address: "rainbows.example.org" },
];
export const PRIVATE_ITEMS = ["your home address", "your password", "your full name", "your photo", "your location"];
