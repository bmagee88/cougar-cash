import type { Answer, Draft, GeneratorContext } from "./engine";
import { ALPHABET, LETTER_NAMES, SkillId } from "./resources";
import { COMPUTER_TOOLS, DIRECTIONS, ORDER_WORDS, SEQUENCE_PICTURES, SEQUENCE_PLANS } from "./discoveryResources";
import { robotQuestion } from "./discovery";
import { CONTROL_SHORTCUTS, INPUT_OUTPUT_QUESTIONS, PROGRAM_ACTIONS, SECOND_GRADE_BUTTONS, SECOND_GRADE_SIGHT_WORDS, SECOND_GRADE_VOCABULARY, SECOND_GRADE_WORDS, SOUND_CLUSTERS, VOWEL_TEAMS } from "./secondGradeResources";

const pick = <T,>(items: T[], rng: () => number): T => items[Math.floor(rng() * items.length)];
const integer = (rng: () => number, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
const letters = (upper = false): Answer[] => ALPHABET.map(value => ({ value: upper ? value.toUpperCase() : value, spoken: LETTER_NAMES[value] }));
const digits: Answer[] = Array.from({ length: 10 }, (_, n) => ({ value: String(n), spoken: String(n) }));
const blankLetter = (word: string, index: number) => word.slice(0, index) + "_" + word.slice(index + 1);
const wordPicture = (word: string) => SECOND_GRADE_WORDS.find(item => item.word === word)?.picture;
const maskNumber = (value: number, index: number) => blankLetter(String(value), index);
const speakDigits = (value: string) => value.split("").map(part => part === "_" ? "blank" : part).join(", ");

function secondGradeAlgorithm({ rng }: GeneratorContext): Draft {
  const kind = pick(["debug", "pattern", "loopOrder", "event", "twoSteps"], rng);
  if (kind === "debug") return robotQuestion(rng, true);
  if (kind === "pattern") {
    const remaining = [...DIRECTIONS.slice(0, 4)], unit: Answer[] = [];
    for (let i = 0; i < 3; i++) unit.push(remaining.splice(integer(rng, 0, remaining.length - 1), 1)[0]);
    return { prompt: "Which instruction starts the repeat?", speech: `Repeat these three instructions: ${unit.map(item => item.spoken).join(", ")}. After ${unit[2].spoken}, which instruction starts the repeat?`,
      answer: unit[0].value, pool: DIRECTIONS, sequence: { caption: "Repeat all three instructions", steps: [...unit, unit[0]].map((token, i) => ({ token, label: i === 3 ? "Again" : ORDER_WORDS[i], missing: i === 3 })) } };
  }
  if (kind === "loopOrder") {
    const first = pick(PROGRAM_ACTIONS, rng), last = pick(PROGRAM_ACTIONS.filter(item => item.value !== first.value), rng);
    const repeats = integer(rng, 2, 4), target = integer(rng, 1, repeats + 1), ordinal = ["first", "second", "third", "fourth", "fifth"][target - 1];
    const prompt = `Which action happens ${ordinal}?`;
    return { prompt, speech: `First, ${first.spoken} ${repeats} times. Finally, ${last.spoken} once. Count the actions, including repeats. ${prompt}`,
      answer: target <= repeats ? first.value : last.value, pool: PROGRAM_ACTIONS,
      sequence: { caption: "Repeat, then finish", steps: [{ token: first, label: `Repeat ${repeats}` }, { token: last, label: "Finally" }] } };
  }
  if (kind === "event") {
    const actions = [...PROGRAM_ACTIONS], plan: Answer[] = [];
    for (let i = 0; i < 3; i++) plan.push(actions.splice(integer(rng, 0, actions.length - 1), 1)[0]);
    const target = integer(rng, 0, 2), ordinal = ["first", "second", "last"][target];
    return { prompt: `After tapping, what happens ${ordinal}?`, speech: `An event starts a program. When the mouse is clicked, first ${plan[0].spoken}, then ${plan[1].spoken}, finally ${plan[2].spoken}. After tapping, what happens ${ordinal}?`,
      answer: plan[target].value, pool: PROGRAM_ACTIONS, sequence: { caption: "Tap starts this program",
        steps: [{ token: COMPUTER_TOOLS.find(item => item.id === "mouse"), label: "When" }, ...plan.map((token, i) => ({ token, label: ["First", "Then", "Finally"][i] }))] } };
  }
  const plan = pick(SEQUENCE_PLANS.filter(item => item.steps.length === 4), rng), before = rng() > .5;
  const reference = before ? integer(rng, 2, 3) : integer(rng, 0, 1), target = reference + (before ? -2 : 2);
  const prompt = `What comes two steps ${before ? "earlier" : "later"}?`;
  return { prompt, speech: `${plan.title}. ${plan.steps.map((token, i) => `${ORDER_WORDS[i]}, ${token.spoken}.`).join(" ")} Start at ${plan.steps[reference].spoken}. ${prompt}`,
    answer: plan.steps[target].value, pool: [...plan.steps, ...SEQUENCE_PICTURES.filter(item => !plan.steps.some(token => token.value === item.value))],
    sequence: { caption: plan.title, reference, steps: plan.steps.map((token, i) => ({ token, label: ORDER_WORDS[i] })) } };
}

export const SECOND_GRADE_GENERATORS: Partial<Record<SkillId, (context: GeneratorContext) => Draft>> = {
  letters: ({ rng }) => {
    const kind = pick(["between", "before", "after"], rng), index = integer(rng, kind === "before" ? 0 : 1, kind === "after" ? 25 : 24), upper = rng() > .5, pool = letters(upper);
    const cue = pool[index + (kind === "before" ? 1 : -1)];
    return { prompt: kind === "between" ? "Which letter comes between?" : `Which letter comes ${kind}?`,
      speech: kind === "between" ? `In the alphabet, which letter comes between ${pool[index - 1].spoken} and ${pool[index + 1].spoken}?` : `In the alphabet, which letter comes ${kind} ${cue.spoken}?`,
      display: kind === "between" ? `${pool[index - 1].value}  _  ${pool[index + 1].value}` : kind === "before" ? `_  ←  ${cue.value}` : `${cue.value}  →  _`, answer: pool[index].value, pool };
  },
  letterPairs: ({ rng }) => {
    const before = rng() > .5, index = integer(rng, before ? 0 : 1, before ? 24 : 25), upperAnswer = rng() > .5, pool = letters(upperAnswer);
    const cue = letters(!upperAnswer)[index + (before ? 1 : -1)];
    return { prompt: `Find the ${before ? "previous" : "next"} ${upperAnswer ? "big" : "little"} letter.`,
      speech: `Here is ${upperAnswer ? "little" : "big"} ${cue.spoken}. In the alphabet, find the ${upperAnswer ? "big" : "little"} letter just ${before ? "before" : "after"} it.`,
      display: before ? `_  ←  ${cue.value}` : `${cue.value}  →  _`, answer: pool[index].value, pool };
  },
  sounds: ({ rng }) => {
    const item = pick(SOUND_CLUSTERS, rng), prompt = `Finish the ${item.end ? "ending" : "starting"} sound.`;
    return { prompt, speech: `${prompt} Complete the letters for ${item.word}.`, display: blankLetter(item.word, item.index),
      picture: wordPicture(item.word), pictureLabel: item.word, answer: item.word[item.index], pool: letters() };
  },
  spelling: ({ rng }) => {
    const team = rng() > .5, item = team ? pick(VOWEL_TEAMS, rng) : pick(SECOND_GRADE_WORDS.filter(word => word.word.length >= 6), rng);
    const index = "indexes" in item ? pick(item.indexes, rng) : integer(rng, 1, item.word.length - 2);
    return { prompt: team ? "Finish the vowel team." : "Find the missing middle letter.", speech: `${team ? "Finish the vowel team" : "Find the missing middle letter"} in ${item.word}.`,
      display: blankLetter(item.word, index), picture: wordPicture(item.word), pictureLabel: item.word, answer: item.word[index], pool: letters() };
  },
  sightWords: ({ rng }) => {
    const word = pick(SECOND_GRADE_SIGHT_WORDS, rng), index = integer(rng, 0, word.length - 1);
    return { prompt: "Finish the sight word.", speech: `Finish the word ${word}.`, display: blankLetter(word, index), answer: word[index], pool: letters() };
  },
  counting: ({ rng }) => {
    if (rng() > .5) {
      const value = integer(rng, 100, 999), place = integer(rng, 0, 2), name = ["hundreds", "tens", "ones"][place];
      return { prompt: `Which digit shows the ${name}?`, speech: `In ${value}, which digit is in the ${name} place?`, display: String(value), answer: String(value)[place], pool: digits };
    }
    const step = pick([5, 10, 100], rng), start = integer(rng, 0, Math.floor((999 - step * 2) / step)) * step;
    const end = String(start + step * 2), previous = String(start + step).padStart(end.length, "0");
    const index = pick(end.split("").map((_, i) => i).filter(i => end[i] !== previous[i]), rng);
    return { prompt: "Fill the missing counting digit.", speech: `Count by ${step === 5 ? "fives" : step === 10 ? "tens" : "hundreds"}. ${start}, ${start + step}. The next number shows ${speakDigits(maskNumber(Number(end), index))}. Fill the missing digit.`,
      display: `${start} · ${start + step} · ${maskNumber(Number(end), index)}`, answer: end[index], pool: digits };
  },
  addition: ({ rng }) => {
    const a = integer(rng, 10, 79), b = integer(rng, 10, 99 - a), sum = String(a + b), index = integer(rng, 0, 1);
    return { prompt: "Find the missing sum digit.", speech: `${a} plus ${b}. The sum shows ${speakDigits(blankLetter(sum, index))}. Fill the missing ${index === 0 ? "tens" : "ones"} digit.`,
      display: `${a} + ${b} = ${blankLetter(sum, index)}`, answer: sum[index], pool: digits };
  },
  subtraction: ({ rng }) => {
    const a = integer(rng, 20, 99), b = integer(rng, 10, a - 1), difference = String(a - b), index = integer(rng, 0, difference.length - 1);
    return { prompt: "Find the missing difference digit.", speech: `${a} take away ${b}. The difference shows ${speakDigits(blankLetter(difference, index))}. Fill the missing digit.`,
      display: `${a} − ${b} = ${blankLetter(difference, index)}`, answer: difference[index], pool: digits };
  },
  pictures: ({ rng }) => {
    const item = pick(SECOND_GRADE_VOCABULARY, rng);
    return { prompt: item.prompt, speech: item.prompt, answer: item.value, pool: SECOND_GRADE_VOCABULARY };
  },
  symbols: ({ rng }) => {
    const item = pick(SECOND_GRADE_BUTTONS, rng);
    return { prompt: item.prompt, speech: item.prompt, answer: item.value, pool: SECOND_GRADE_BUTTONS };
  },
  computers: ({ rng }) => {
    if (rng() > .5) {
      const item = pick(CONTROL_SHORTCUTS, rng);
      return { prompt: "Finish the Control shortcut.", speech: `For the Control keyboard shortcut, hold Control and which letter to ${item.action}?`,
        display: `${item.label}: Ctrl + _`, answer: item.key.toUpperCase(), pool: letters(true) };
    }
    const item = pick(INPUT_OUTPUT_QUESTIONS, rng), tool = COMPUTER_TOOLS.find(token => token.id === item.id);
    return { prompt: item.prompt, speech: item.prompt, answer: tool.value, pool: COMPUTER_TOOLS.slice(0, 7) };
  },
  algorithms: secondGradeAlgorithm,
};
