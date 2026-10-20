import type { Answer, Draft, GeneratorContext } from "./engine";
import { ALPHABET, LETTER_NAMES } from "./resources";
import { algorithmQuestion, robotQuestion } from "./discovery";
import { DIRECTIONS, SEQUENCE_PICTURES } from "./discoveryResources";
import { CURRICULUM_OBJECTIVES, ComputerTopic, DEVICE_TOKENS, ICON_TOKENS, KEY_TOKENS, NAMES, PRIVATE_ITEMS, SEARCH_TOPICS, Token } from "./curriculumResources";

const pick = <T,>(items: readonly T[], rng: () => number): T => items[Math.floor(rng() * items.length)];
const mix = <T,>(items: readonly T[], rng: () => number): T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
};
const digits: Answer[] = Array.from({ length: 10 }, (_, n) => ({ value: String(n), spoken: String(n) }));
const letters: Answer[] = ALPHABET.map(value => ({ value: value.toUpperCase(), spoken: LETTER_NAMES[value] }));
const icon = (id: string) => ICON_TOKENS.find(item => item.id === id)!;
const key = (id: string) => KEY_TOKENS.find(item => item.id === id)!;

// A scenario's longer context and all numbered choices are visible AND narrated.
// Leaves still contain a single digit; their spoken names include the choice text.
export function optionQuestion(context: GeneratorContext, prompt: string, clue: string, correct: string, wrong: string[]): Draft {
  const options = mix([correct, ...mix(Array.from(new Set(wrong)).filter(text => text !== correct), context.rng).slice(0, (context.platforms || 3) - 1)], context.rng);
  if (options.length !== (context.platforms || 3)) throw Error("A scenario needs four distinct distractors");
  const pool = options.map((text, i) => ({ value: String(i + 1), spoken: `${i + 1}: ${text}` }));
  return { prompt, speech: `${clue} ${prompt} ${options.map((text, i) => `Option ${i + 1}, ${text}.`).join(" ")} Choose its number.`,
    context: clue, options: options.map((text, i) => ({ value: String(i + 1), text })), answer: String(options.indexOf(correct) + 1), pool };
}
function tokenQuestion(prompt: string, answer: Token, pool: Token[], clue?: string): Draft {
  // Avoid visually interchangeable icons for different functions in the same quiz.
  const confusing = answer.id === "align" ? ["menu"] : answer.id === "menu" ? ["align"] : answer.id === "shift" ? ["caps"] : [];
  return { prompt, speech: `${clue ? `${clue}. ` : ""}${prompt}`, context: clue, answer: answer.value, pool: pool.filter(item => !confusing.includes(item.id)) };
}
type Make = (context: GeneratorContext) => Draft;
export type CurriculumFamily = { id: string; objective: string; topic: ComputerTopic; introduced: 0 | 1 | 2; make: Make };
export const CURRICULUM_FAMILIES: CurriculumFamily[] = [];
function family(objective: string, make: Make, suffix = "") {
  const entry = CURRICULUM_OBJECTIVES.find(item => item.id === objective)!;
  CURRICULUM_FAMILIES.push({ id: `${objective}${suffix}`, objective, topic: entry.topic, introduced: entry.grade, make });
}
function scenarios(objective: string, rows: [string, string, string, string[]][]) {
  family(objective, context => optionQuestion(context, ...pick(rows, context.rng)));
}
function buttons(objective: string, ids: string[], jobs: string[]) {
  const bank = ids.map(icon);
  family(objective, ({ rng }) => {
    const index = Math.floor(rng() * bank.length), item = bank[index];
    return tokenQuestion(rng() < .5 ? `Find ${item.spoken}.` : jobs[index], item, ICON_TOKENS);
  });
}

family("D1", ({ rng }) => {
  const item = pick(DEVICE_TOKENS.filter(item => ["screen", "keyboard", "mouse", "trackpad", "power"].includes(item.id)), rng);
  return tokenQuestion(`Find the ${item.spoken}.`, item, DEVICE_TOKENS);
});
family("D2", ({ rng }) => {
  const pool = DEVICE_TOKENS.filter(item => ["laptop", "screen", "tablet", "phone", "printer"].includes(item.id))
    .map(item => item.id === "screen" ? { ...item, spoken: "desktop computer" } : item);
  const item = pick(pool.slice(0, 4), rng);
  return tokenQuestion(`Find the ${item.spoken}.`, item, pool);
});
scenarios("D3", [
  ["What turns the device on?", "The classroom computer is off.", "Press its power button once.", ["Shake the screen.", "Pull the cord.", "Hit every key.", "Close your eyes."]],
  ["When can Pip begin?", "The device is starting up.", "When the teacher's ready screen appears.", ["While the screen is still loading.", "Before it turns on.", "After pulling the plug.", "When the lid is closed."]],
]);
scenarios("D4", [
  ["How should Pip carry it?", "Carry a classroom tablet.", "Use two hands, following classroom rules.", ["Hold it by the cord.", "Toss it to a friend.", "Balance it on your head.", "Run while carrying it."]],
  ["Where should the drink go?", "A laptop is on the desk.", "Away from the device.", ["On the keyboard.", "On the screen.", "Beside the charging port.", "Inside the laptop bag."]],
  ["Which choice follows classroom care?", "Pip finishes using the device.", "Store it in its assigned place.", ["Leave it on the floor.", "Hide it behind a shelf.", "Pull its charging cable hard.", "Stack books on its screen."]],
  ["Who checks the charging routine?", "Pip is unsure about charging.", "Ask the teacher for the routine.", ["Try any cable that fits.", "Force a plug into a port.", "Pull the cable by its wire.", "Leave a cable across the walkway."]],
]);
family("D5", ({ rng }) => {
  const item = pick(DEVICE_TOKENS.filter(item => ["headphones", "microphone", "camera", "speaker", "plug"].includes(item.id)), rng);
  return tokenQuestion(`Find the ${item.spoken}.`, item, DEVICE_TOKENS);
});
scenarios("D6", [
  ["Which action signs Pip in?", "The computer is already on.", "Follow the school account login steps.", ["Press the power button again.", "Turn up the sound.", "Move the mouse in circles.", "Close the laptop lid."]],
  ["What does power do?", "Pip presses the power button.", "Starts or wakes the device.", ["Always signs into Pip's account.", "Always opens Pip's homework.", "Shares Pip's password.", "Changes the account name."]],
]);
scenarios("D7", [
  ["What should Pip do next?", "Battery: 5 percent. Low battery.", "Follow the classroom charging routine.", ["Turn the volume louder.", "Shake the battery picture.", "Cover the screen.", "Delete the battery picture."]],
  ["Which sign means low battery?", "Pip checks the battery display.", "A nearly empty battery warning.", ["A full battery symbol.", "A play button.", "A search button.", "A page title."]],
]);
family("D8", context => {
  const leaving = context.rng() < .5;
  return optionQuestion(context, leaving ? "What should Pip do next?" : "How should Pip sign in?", leaving ? "Pip finishes on a shared computer." : "Pip needs the school account.",
    leaving ? "Follow the school's sign-out steps." : "Follow the school's sign-in steps.",
    leaving ? ["Leave the account open.", "Tell a classmate the password.", "Change a friend's account.", "Only turn the sound off."] : ["Guess a friend's password.", "Use any account already open.", "Ask classmates for their passwords.", "Only press the power button."]);
});
family("D9", context => {
  if (context.rng() < .4) return optionQuestion(context, "Why check the signed-in account?", "Pip is about to save schoolwork.", "Keep work with the correct person.",
    ["All accounts belong to everyone.", "It changes the battery level.", "It makes the speakers louder.", "It fixes a broken keyboard."]);
  const [owner, other] = mix(NAMES, context.rng);
  return optionQuestion(context, "Which account should be open?", `${owner} is saving schoolwork.`, `${owner}'s school account.`,
    [`${other}'s school account.`, "Any account is the same.", "A stranger's account.", "The teacher's private account."]);
});

scenarios("P1", [
  ["How does Pip choose it?", "The pointer is over a button.", "Click once, or tap the button.", ["Press every key.", "Close the screen.", "Pull the charging cable.", "Scroll away from the button."]],
  ["What moves the pointer?", "Pip wants the arrow on a button.", "Move the mouse or trackpad.", ["Turn the volume knob.", "Press the power button.", "Use the charging cable.", "Cover the camera."]],
]);
scenarios("P2", [["How can Pip drag it?", "Move a picture into a box.", "Hold it, move, then let go.", ["Click once without moving.", "Only turn up the volume.", "Close the page.", "Press the power button."]]]);
family("P3", ({ rng }) => {
  const down = rng() < .5, item = { id: down ? "down" : "up", value: down ? "↓" : "↑", spoken: `scroll ${down ? "down" : "up"}` };
  const pool = [item, { id: "opposite", value: down ? "↑" : "↓", spoken: `scroll ${down ? "up" : "down"}` }, icon("close"), icon("volume"), icon("play")];
  return tokenQuestion("Which way should Pip scroll?", item, pool, down ? "See farther down the page" : "Return toward the page top");
});
family("P4", ({ rng, voice }) => {
  const kind = voice === false ? 2 : Math.floor(rng() * 3);
  if (kind === 0) { const value = pick(ALPHABET, rng).toUpperCase(); return { prompt: `Find the ${value} key.`, speech: `Find the ${LETTER_NAMES[value.toLowerCase()]} key.`, answer: value, pool: letters }; }
  if (kind === 1) { const item = pick(digits, rng); return { prompt: `Find the ${item.value} key.`, speech: `Find the number ${item.value} key.`, answer: item.value, pool: digits }; }
  const item = pick(KEY_TOKENS.slice(0, 3), rng);
  return tokenQuestion(({ space: "Which key adds a space?", enter: "Which key starts a new line?", backspace: "Which key removes the last letter?" })[item.id], item, KEY_TOKENS);
});
family("P5", ({ rng }) => {
  const word = pick(["cat", "dog", "sun", "Pip", "Mia", "Sam"], rng), extra = pick(["x", "z", "q"], rng);
  return tokenQuestion("Which key removes the last letter?", key("backspace"), KEY_TOKENS, `Wanted: ${word}. Typed: ${word}${extra}. Cursor at end`);
});
scenarios("P6", [
  ["Which action opens this item?", "The teacher says to double-click.", "Click twice quickly on the item.", ["Click once and wait.", "Scroll two pages.", "Hold the power button.", "Click on two different items."]],
  ["How can Pip open its menu?", "This item has a context menu.", "Right-click, or touch and hold.", ["Press the power button.", "Turn the screen away.", "Pull the charging cable.", "Click the room's light switch."]],
]);
family("P7", ({ rng }) => {
  const rows = [["shift", "Which key makes one capital?"], ["caps", "Which key locks capital letters?"], ["tab", "Which key moves between fields?"], ["left", "Move the cursor one place left?"], ["right", "Move the cursor one place right?"]];
  const [id, prompt] = pick(rows, rng);
  return tokenQuestion(prompt, key(id), KEY_TOKENS);
});
family("P8", context => {
  const { rng } = context;
  if (rng() < .4) return optionQuestion(context, "Where should Pip click to edit?", "Put a letter between two words.", "Where the new letter should appear.",
    ["On the power button.", "On the volume symbol.", "Outside the document window.", "On the battery display."]);
  const left = rng() < .5;
  return tokenQuestion("Which arrow moves the text cursor?", key(left ? "left" : "right"), KEY_TOKENS, left ? "Move one letter toward the beginning" : "Move one letter toward the end");
});
family("P9", context => {
  const name = pick(NAMES, context.rng), action = pick(["hop", "run", "sing", "read"], context.rng), kind = Math.floor(context.rng() * 3);
  if (kind === 0) return tokenQuestion("Which key makes the first capital?", key("shift"), KEY_TOKENS, `${name.toLowerCase()} can ${action}. We can play. Begin with a capital`);
  if (kind === 1) return tokenQuestion("Which key separates the words?", key("space"), KEY_TOKENS, `${name}can${action}. We can play. Add spaces`);
  return { prompt: "Which mark ends the sentence?", speech: `${name} can ${action}. We can play. Finish the second telling sentence. Which mark ends it?`, context: `${name} can ${action}. We can play_`,
    answer: ".", pool: [{ value: ".", spoken: "period" }, { value: "?", spoken: "question mark" }, { value: ",", spoken: "comma" }, { value: ":", spoken: "colon" }, { value: "_", spoken: "underscore" }] };
});
family("P10", context => {
  if (context.rng() < .25) return optionQuestion(context, "What comes before copying words?", "Pip wants to copy some words.", "Select the words first.", ["Turn off the computer.", "Delete the whole document.", "Close the page first.", "Share the password."]);
  const shortcut = pick([{ value: "C", action: "Copy" }, { value: "V", action: "Paste" }, { value: "Z", action: "Undo" }], context.rng);
  return { prompt: "Finish the Control shortcut.", speech: `${shortcut.action}. Hold Control and which letter?`, context: `${shortcut.action}: Ctrl + _`, answer: shortcut.value, pool: letters };
});
family("P11", context => {
  const insertion = context.rng() < .5;
  return optionQuestion(context, "Which one does Pip need?", insertion ? "Show where the next letter goes." : "Point to an item on screen.",
    insertion ? "The blinking text cursor." : "The moving pointer arrow.",
    [insertion ? "The moving pointer arrow." : "The blinking text cursor.", "The volume symbol.", "The battery symbol.", "The charging cable."]);
});

buttons("N1", ["browser"], ["Which app opens websites?"]);
buttons("N2", ["home", "back", "forward", "close"], ["Return to the home page?", "Return to the previous page?", "Move to the next page?", "Close this window?"]);
buttons("N3", ["search", "volume", "play", "pause"], ["Look for something?", "Change the sound level?", "Start the video?", "Pause the video?"]);
scenarios("N4", [["Which link should Pip follow?", "The teacher shares today's class link.", "The link the teacher provided.", ["A surprise prize popup.", "A link from a stranger.", "A flashing advertisement.", "A random link from a message."]]]);
buttons("N5", ["refresh", "settings", "menu", "more"], ["Load this page again?", "Change the app's settings?", "Open the main menu?", "See more choices?"]);
buttons("N6", ["add", "edit", "delete", "confirm"], ["Add a new item?", "Change this item?", "Delete this item?", "Confirm this choice?"]);
scenarios("N7", [
  ["Does a padlock prove trust?", "A website shows a padlock.", "No. Check the site with an adult.", ["Yes. Every word must be true.", "Yes. Share every password.", "Yes. Every link is safe.", "Yes. It must be the school."]],
  ["What can this lock mean?", "A file shows a padlock.", "Access may be restricted; check permissions.", ["The file must be a game.", "The file is always correct.", "The computer needs charging.", "The sound is turned off."]],
]);
buttons("N8", ["bookmark", "folder", "download", "upload"], ["Keep this page for later?", "Open a group of files?", "Get a file onto this device?", "Send a file from this device?"]);
buttons("N9", ["attach", "link", "share", "print"], ["Add a file to a message?", "Connect to another page?", "Let someone access this work?", "Put this work on paper?"]);
buttons("N10", ["view", "hide", "cloud", "bell", "fullscreen"], ["Show this item?", "Hide this item?", "Find online cloud storage?", "Find the notifications?", "Make this fill the screen?"]);
family("N11", ({ rng }) => {
  const camera = rng() < .5;
  return tokenQuestion(camera ? "Which permission uses the camera?" : "Which permission uses the microphone?", icon(camera ? "camera" : "mic"), ICON_TOKENS, "Ask the teacher before allowing access");
});

scenarios("W1", [
  ["Where does a website address go?", "Visit a teacher-approved website.", "In the browser address bar.", ["In the volume control.", "In the battery display.", "In the computer's power button.", "In a drawing's color palette."]],
  ["What can a hyperlink do?", "A page has a clickable link.", "Open another page or resource.", ["Charge the computer.", "Make every page safe.", "Repair a broken screen.", "Always print a picture."]],
]);
buttons("W2", ["back", "forward", "refresh"], ["Return to the previous page?", "Go forward after going back?", "Reload this page?"]);
family("W3", context => {
  const item = pick(SEARCH_TOPICS, context.rng);
  return optionQuestion(context, "Which search phrase helps most?", `Learn about ${item.subject}.`, item.phrase,
    ["hello hello hello", "my favorite game", "turn up volume", "open settings", ...SEARCH_TOPICS.filter(other => other !== item).map(other => other.phrase)]);
});
family("W4", context => {
  const item = pick(SEARCH_TOPICS, context.rng), address = context.rng() < .5;
  return optionQuestion(context, address ? "Which is a website address?" : "Which is a search phrase?", "These are pretend classroom examples.", address ? item.address : item.phrase,
    address ? [item.phrase, "how plants grow", "cricket pictures", "facts about birds", "rainbow colors"] : [item.address, "school.example.org", "animals.example.org", "garden.example.org", "class.example.org"]);
});

family("F1", ({ rng }) => {
  const drawing = rng() < .5;
  return tokenQuestion(drawing ? "Which tool paints a picture?" : "Which device types a story?", drawing ? icon("draw") : DEVICE_TOKENS.find(item => item.id === "keyboard")!, drawing ? ICON_TOKENS : DEVICE_TOKENS);
});
family("F2", context => {
  const subject = pick(["Frog", "Plant", "Cricket", "Rainbow", "Penguin"], context.rng), kind = Math.floor(context.rng() * 3);
  if (kind === 0) return optionQuestion(context, "Which name helps find it later?", `Save a document about a ${subject.toLowerCase()}.`, `${subject} Report`, ["Untitled", "New Document", "asdfgh", "12345", "Stuff"]);
  return tokenQuestion(kind === 1 ? "Which button saves the work?" : "Which picture is the saved document?", icon(kind === 1 ? "save" : "document"), ICON_TOKENS, kind === 1 ? `New document: ${subject} Report` : `Reopen ${subject} Report`);
});
family("F3", ({ rng }) => {
  const [id, prompt] = pick([["bold", "Make the title bold?"], ["size", "Make the letters bigger?"], ["align", "Center the title on the page?"]], rng);
  return tokenQuestion(prompt, icon(id), ICON_TOKENS);
});
family("F4", ({ rng }) => {
  const folder = rng() < .5;
  return tokenQuestion(folder ? "Which holds a group of files?" : "Which is one saved document?", icon(folder ? "folder" : "document"), ICON_TOKENS);
});

scenarios("S1", [
  ["Should Pip believe every screen?", "A screen claims crickets are robots.", "No. Check with a trusted adult.", ["Yes. Screens are always right.", "Yes. Pictures prove every claim.", "Yes. Big letters mean truth.", "Yes. Bright colors mean truth."]],
  ["What should Pip do next?", "A strange popup makes Pip worried.", "Stop and ask a trusted adult.", ["Tap all its buttons.", "Keep it secret.", "Share private information.", "Follow its surprise link."]],
]);
family("S2", context => optionQuestion(context, "What should Pip do first?", `A website asks for ${pick(PRIVATE_ITEMS, context.rng)}.`, "Ask a trusted adult before sharing.",
  ["Share it right away.", "Ask a stranger online.", "Keep the request a secret.", "Post it for everyone."]));
scenarios("S3", [
  ["What helps protect the account?", "Pip uses a school account.", "Keep the password private from classmates.", ["Tell the whole class the password.", "Post the password in a game.", "Trade passwords with a friend.", "Put the password in a public chat."]],
  ["Why does Pip need a password?", "The school account asks for a password.", "To help protect access to the account.", ["To make the screen brighter.", "To recharge the battery.", "To turn pictures into paper.", "To change the speaker volume."]],
]);
family("S4", context => {
  const product = pick(["toy", "game", "backpack", "robot", "puzzle"], context.rng);
  return optionQuestion(context, "What does this advertisement want?", `Ad: Buy this ${product} today!`, "Persuade someone to buy the product.",
    ["Prove every claim is true.", "Check the computer's battery.", "Finish the teacher's instructions.", "Keep a password private."]);
});
family("S5", context => optionQuestion(context, "Which should stay private online?", "A public game asks about you.", pick(["Your home address.", "Your account password."], context.rng),
  ["A made-up cricket name.", "A favorite color.", "A favorite animal.", "A pretend story character.", "A favorite fruit."]));

family("C1", context => algorithmQuestion({ ...context, firstGrade: false, tier: Math.min(4, context.tier) }));
family("C2", ({ rng }) => {
  const unit = mix(SEQUENCE_PICTURES, rng).slice(0, 2), count = 3 + Math.floor(rng() * 2), expected = unit[(count - 1) % 2];
  const steps = Array.from({ length: count }, (_, i) => ({ token: unit[i % 2], label: i === count - 1 ? "Next" : "Then", missing: i === count - 1 }));
  return { prompt: "Which picture continues the pattern?", speech: `Repeat the pair: ${unit[0].spoken}, then ${unit[1].spoken}. ${steps.slice(0, -1).map(step => step.token.spoken).join(", ")}. What comes next?`,
    answer: expected.value, pool: [...unit, ...SEQUENCE_PICTURES.filter(item => !unit.some(token => token.value === item.value))], sequence: { caption: "Repeat the pair", steps } };
});
family("C3", context => {
  const input = context.rng() < .5;
  const rows = input ? [["keyboard", "Send typed letters into the computer?"], ["mouse", "Send pointing clicks into the computer?"], ["microphone", "Send your voice into the computer?"], ["camera", "Send your picture into the computer?"]]
    : [["screen", "Show moving pictures on a screen?"], ["printer", "Put computer work on paper?"], ["speaker", "Play sound aloud into the room?"], ["headphones", "Play computer sound over your ears?"]];
  const [id, prompt] = pick(rows, context.rng), tool = DEVICE_TOKENS.find(item => item.id === id)!;
  return tokenQuestion(prompt, tool, DEVICE_TOKENS.filter(item => !["laptop", "tablet", "phone"].includes(item.id)), input ? "Input sends information in" : "Output sends information out");
});
family("C4", ({ rng }) => {
  const draft = robotQuestion(rng, true), wrong = pick(DIRECTIONS.filter(token => token.value !== draft.answer), rng);
  const steps = draft.sequence!.steps.map((step, i) => i === 1 ? { ...step, token: wrong, missing: false, incorrect: true } : step);
  const position = (cell: number) => `row ${Math.floor(cell / 3) + 1}, column ${cell % 3 + 1}`;
  return { ...draft, prompt: "Fix the marked instruction.",
    speech: `Robot at ${position(draft.robot!.start)}. Star at ${position(draft.robot!.goal)}. ${steps.map((step, i) => `Step ${i + 1}. ${step.label}, ${step.token.spoken}.`).join(" ")} The marked second instruction is a mistake. Which arrow replaces it to reach the star?`,
    sequence: { ...draft.sequence!, caption: "Fix the marked step", steps } };
});
family("C5", context => {
  const actions = 1 + Math.floor(context.rng() * 3), repeats = 2 + Math.floor(context.rng() * 2);
  const item = pick(SEQUENCE_PICTURES.filter(item => ["🦘", "👏", "👋"].includes(item.value)), context.rng);
  return { prompt: "How many actions after repeating?", speech: `One loop has ${actions} ${item.spoken} actions. Repeat the whole loop ${repeats} times. How many actions altogether?`,
    answer: String(actions * repeats), pool: digits, sequence: { caption: "Repeat the whole loop", repeat: repeats, steps: Array.from({ length: actions }, (_, i) => ({ token: item, label: String(i + 1) })) } };
});

family("T1", context => {
  const [action, expected, actual] = pick([
    ["pressed Play", "the video to play", "the video stayed paused"],
    ["clicked Print", "a printed page", "no page came out"],
    ["typed a letter", "a letter on screen", "no letter appeared"],
    ["clicked a class link", "the class page", "an error appeared"],
    ["pressed Volume up", "louder sound", "the sound stayed quiet"],
    ["clicked Save", "the work to save", "an error appeared"],
  ], context.rng);
  return optionQuestion(context, "Which report helps the teacher?", `Pip ${action}; ${actual}.`, `I expected ${expected}; ${actual}.`,
    ["It is broken.", "Nothing ever works.", "I do not like this.", "The computer is silly.", "Someone should guess what happened."]);
});
scenarios("A1", [
  ["Which choice includes everyone?", "Classmates use different computer tools.", "Use the tools that help each person.", ["Everyone must use the same tool.", "Hide tools that look different.", "Only a mouse can work.", "Never ask what helps someone."]],
  ["What can help with pointing?", "A mouse is hard for Pip to use.", "Ask about a trackpad or touch tool.", ["Stop Pip from joining.", "Hide the classroom computer.", "Only allow the same mouse.", "Laugh at a different tool."]],
]);
family("A2", ({ rng }) => {
  const [id, clue, prompt] = pick([
    ["captions", "Read the words spoken in a video", "Which tool can help?"],
    ["audio", "Hear written words read aloud", "Which tool can help?"],
    ["volume", "The sound is too quiet", "Which control changes the sound?"],
  ], rng);
  return tokenQuestion(prompt, icon(id), ICON_TOKENS, clue);
});

// Topics introduced after K borrow explicitly tagged K foundations, rather than
// moving account/search/paragraph/diagnostic requirements into kindergarten.
const foundations: Partial<Record<ComputerTopic, string>> = { web: "N4", files: "P4", troubleshooting: "S1" };
export function curriculumQuestion(topic: ComputerTopic, context: GeneratorContext): Draft {
  let eligible = CURRICULUM_FAMILIES.filter(item => item.topic === topic && item.introduced <= context.grade);
  if (!eligible.length) eligible = CURRICULUM_FAMILIES.filter(item => item.objective === foundations[topic]);
  const additions = eligible.filter(item => item.introduced === context.grade), review = eligible.filter(item => item.introduced < context.grade);
  const bank = additions.length && review.length ? context.rng() < .6 ? additions : review : eligible;
  const selected = pick(bank, context.rng), draft = selected.make(context);
  return { ...draft, curriculum: { requirement: selected.objective, introduced: selected.introduced, family: selected.id } };
}
export const CURRICULUM_GENERATORS = Object.fromEntries(["devices", "keyboard", "navigation", "web", "files", "safety", "thinking", "troubleshooting", "accessibility"]
  .map(topic => [topic, (context: GeneratorContext) => curriculumQuestion(topic as ComputerTopic, context)])) as Record<ComputerTopic, Make>;
