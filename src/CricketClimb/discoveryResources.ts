// Existing Twemoji illustrations, referenced directly rather than generated or downloaded.
// Graphics: Twitter and contributors, CC BY 4.0. https://github.com/jdecked/twemoji
export const COMPUTER_PICTURE_BASE = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@v16.0.1/assets/svg/";
export type LearningToken = { value: string; spoken: string; image?: string };
const tool = (id: string, value: string, spoken: string, code: string) => ({ id, value, spoken, image: `${COMPUTER_PICTURE_BASE}${code}.svg` });
export const COMPUTER_TOOLS = [
  tool("keyboard", "⌨️", "keyboard", "2328"), tool("mouse", "🖱️", "computer mouse", "1f5b1"),
  tool("screen", "🖥️", "computer screen", "1f5a5"), tool("printer", "🖨️", "printer", "1f5a8"),
  tool("headphones", "🎧", "headphones", "1f3a7"), tool("microphone", "🎤", "microphone", "1f3a4"),
  tool("camera", "📷", "camera", "1f4f7"), tool("laptop", "💻", "laptop", "1f4bb"),
  tool("battery", "🔋", "battery", "1f50b"), tool("plug", "🔌", "power plug", "1f50c"),
];
// Function questions use the seven separate peripherals, avoiding two plausible answers
// such as a laptop and a screen for "shows pictures".
export const COMPUTER_JOBS = [
  { prompt: "Which tool types letters?", id: "keyboard" },
  { prompt: "Which tool points and clicks?", id: "mouse" },
  { prompt: "Which part shows the picture?", id: "screen" },
  { prompt: "Which tool prints on paper?", id: "printer" },
  { prompt: "Which tool records your voice?", id: "microphone" },
  { prompt: "Which tool takes a photo?", id: "camera" },
  { prompt: "Which tool covers your ears?", id: "headphones" },
];
export const COMPUTER_KEYS = [
  { value: "␣", spoken: "space bar", prompt: "Which key makes a space?" },
  { value: "↵", spoken: "enter key", prompt: "Which key starts another line?" },
  { value: "⌫", spoken: "backspace key", prompt: "Which key erases a letter?" },
  { value: "⇧", spoken: "shift key", prompt: "Which key helps make capitals?" },
  { value: "⇥", spoken: "tab key", prompt: "Which key moves between boxes?" },
];
export const COMPUTER_ACTIONS = [
  { value: "💾", spoken: "save", prompt: "Which button saves your work?" },
  { value: "📁", spoken: "open folder", prompt: "Which button opens a folder?" },
  { ...COMPUTER_TOOLS.find(item => item.id === "printer"), prompt: "Which button prints your work?" },
  { value: "↶", spoken: "undo", prompt: "Which button undoes your last change?" },
  { value: "❔", spoken: "help", prompt: "Which button asks for help?" },
];
export const DIRECTIONS: LearningToken[] = [
  { value: "↑", spoken: "up" }, { value: "→", spoken: "right" },
  { value: "↓", spoken: "down" }, { value: "←", spoken: "left" }, { value: "■", spoken: "stop" },
];
export const SEQUENCE_PLANS: { title: string; steps: LearningToken[] }[] = [
  { title: "Say hello", steps: [{ value: "👋", spoken: "wave" }, { value: "🙂", spoken: "smile" }] },
  { title: "Open a book", steps: [{ value: "📕", spoken: "choose a book" }, { value: "📖", spoken: "open it" }] },
  { title: "Little dance", steps: [{ value: "👏", spoken: "clap" }, { value: "🦘", spoken: "hop" }, { value: "🙇", spoken: "bow" }] },
  { title: "Get dressed", steps: [{ value: "🧦", spoken: "put on socks" }, { value: "👟", spoken: "put on shoes" }, { value: "🎒", spoken: "get a backpack" }] },
  { title: "Wash hands", steps: [
    { value: "🧼", spoken: "soap" }, { value: "👏", spoken: "rub hands" },
    { value: "🚰", spoken: "rinse" }, { value: "🧻", spoken: "dry hands" },
  ] },
  { title: "Plant a seed", steps: [
    { value: "🕳️", spoken: "dig a hole" }, { value: "🫘", spoken: "put in a seed" },
    { value: "💧", spoken: "water" }, { value: "🌱", spoken: "watch it grow" },
  ] },
  { title: "Get ready", steps: [
    { value: "🧦", spoken: "put on socks" }, { value: "👟", spoken: "put on shoes" },
    { value: "🎒", spoken: "get a backpack" }, { value: "🏫", spoken: "go to school" },
  ] },
  { title: "Pip's dance", steps: [
    { value: "👋", spoken: "wave" }, { value: "👏", spoken: "clap" },
    { value: "🦘", spoken: "hop" }, { value: "🙇", spoken: "bow" },
  ] },
  { title: "Read a book", steps: [
    { value: "📕", spoken: "choose a book" }, { value: "📖", spoken: "open it" },
    { value: "👀", spoken: "read it" }, { value: "📚", spoken: "put it away" },
  ] },
  { title: "Tidy up", steps: [
    { value: "🧸", spoken: "find the toys" }, { value: "📦", spoken: "box the toys" },
    { value: "🧹", spoken: "sweep" }, { value: "✨", spoken: "all clean" },
  ] },
  { title: "Make a picture", steps: [
    { value: "📄", spoken: "get paper" }, { value: "✏️", spoken: "draw" },
    { value: "🖍️", spoken: "color" }, { value: "🖼️", spoken: "hang the picture" },
  ] },
  { title: "Make a program", steps: [
    { value: "💡", spoken: "think" }, { value: "🧩", spoken: "make a plan" },
    { value: "▶", spoken: "run the plan" }, { value: "🛠️", spoken: "fix and try again" },
  ] },
];
export const SEQUENCE_PICTURES = SEQUENCE_PLANS.flatMap(plan => plan.steps)
  .filter((token, index, tokens) => tokens.findIndex(other => other.value === token.value) === index);
export const ORDER_WORDS = ["First", "Then", "Next", "Finally"];
