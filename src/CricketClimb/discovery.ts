import type { Draft, GeneratorContext, Question } from "./engine";
import { COMPUTER_ACTIONS, COMPUTER_JOBS, COMPUTER_KEYS, COMPUTER_TOOLS, DIRECTIONS, LearningToken, ORDER_WORDS, SEQUENCE_PICTURES, SEQUENCE_PLANS } from "./discoveryResources";

const pick = <T,>(items: T[], rng: () => number): T => items[Math.floor(rng() * items.length)];
const numbers = Array.from({ length: 9 }, (_, n) => ({ value: String(n + 1), spoken: String(n + 1) }));

export function computerQuestion({ rng, tier, firstGrade }: GeneratorContext): Draft {
  const kind = pick(tier < 1 ? ["name"] : firstGrade ? ["name", "job", "key", "action"] : tier < 3 ? ["name", "job"] : ["name", "job", "key"], rng);
  if (kind === "key") {
    const item = pick(firstGrade ? COMPUTER_KEYS : COMPUTER_KEYS.slice(0, 3), rng);
    return { prompt: item.prompt, speech: item.prompt, answer: item.value, pool: COMPUTER_KEYS };
  }
  if (kind === "action") {
    const item = pick(COMPUTER_ACTIONS, rng);
    return { prompt: item.prompt, speech: item.prompt, answer: item.value, pool: COMPUTER_ACTIONS };
  }
  if (kind === "job") {
    const item = pick(COMPUTER_JOBS, rng), tool = COMPUTER_TOOLS.find(token => token.id === item.id);
    return { prompt: item.prompt, speech: item.prompt, answer: tool.value, pool: COMPUTER_TOOLS.slice(0, 7) };
  }
  const item = pick(COMPUTER_TOOLS.slice(0, tier < 1 ? 7 : firstGrade ? 10 : 8), rng);
  return { prompt: `Find the ${item.spoken}.`, speech: `Find the ${item.spoken}.`, answer: item.value, pool: COMPUTER_TOOLS };
}

function labeledSteps(tokens: LearningToken[]) {
  return tokens.map((token, index) => ({ token, label: index === tokens.length - 1 ? "Finally" : ORDER_WORDS[index] }));
}
function readPlan(steps: NonNullable<Question["sequence"]>["steps"]) {
  return steps.map((step, i) => `Step ${i + 1}. ${step.label}, ${step.missing ? "missing instruction" : step.token.spoken}.`).join(" ");
}

export function robotQuestion(rng: () => number, missingMiddle = false): Draft {
  const start = Math.floor(rng() * 9), trail = [start], commands: LearningToken[] = [];
  const length = missingMiddle ? 3 : 2 + Math.floor(rng() * 2);
  for (let i = 0; i < length; i++) {
    const current = trail[trail.length - 1];
    const options = [
      { index: current - 3, valid: current >= 3, token: DIRECTIONS[0] },
      { index: current + 1, valid: current % 3 < 2, token: DIRECTIONS[1] },
      { index: current + 3, valid: current < 6, token: DIRECTIONS[2] },
      { index: current - 1, valid: current % 3 > 0, token: DIRECTIONS[3] },
    ].filter(option => option.valid && !trail.includes(option.index));
    const move = pick(options, rng);
    commands.push(move.token); trail.push(move.index);
  }
  const goal = trail[trail.length - 1], steps = labeledSteps(commands).map((step, i) => ({ ...step, missing: i === (missingMiddle ? 1 : commands.length - 1) }));
  const position = (cell: number) => `row ${Math.floor(cell / 3) + 1}, column ${cell % 3 + 1}`;
  return { prompt: missingMiddle ? "Fix the middle instruction." : "Which arrow reaches the star?", answer: commands[missingMiddle ? 1 : commands.length - 1].value, pool: DIRECTIONS,
    speech: `Follow the robot's plan. Start at the robot in ${position(start)}. The star is in ${position(goal)}. ${readPlan(steps)} ${missingMiddle ? "Which arrow fixes the plan?" : "Which arrow finishes the plan?"}`,
    sequence: { caption: "Robot's plan", steps }, robot: { start, goal } };
}

export function algorithmQuestion({ rng, tier, firstGrade }: GeneratorContext): Draft {
  const kind = pick(firstGrade ? ["position", "after", "before", "word", "missingNumber", "pattern", "repeat", "robot"]
    : tier < 1 ? ["position"] : tier < 2 ? ["position", "word"] : ["position", "word", "after", "before", "missingNumber"], rng);
  if (kind === "robot") return robotQuestion(rng);
  if (kind === "pattern") {
    const first = pick(DIRECTIONS.slice(0, 4), rng), second = pick(DIRECTIONS.slice(0, 4).filter(item => item.value !== first.value), rng);
    const steps = labeledSteps([first, second, first, second]).map((step, i) => ({ ...step, missing: i === 3 }));
    return { prompt: "Which instruction comes next?", speech: `Repeat the same two instructions. ${first.spoken}, ${second.spoken}. ${first.spoken}, what comes next?`,
      answer: second.value, pool: DIRECTIONS, sequence: { caption: "Repeat the pattern", steps } };
  }
  if (kind === "repeat") {
    const hops = 1 + Math.floor(rng() * 3), repeats = 2 + Math.floor(rng() * 2);
    return { prompt: "How many hops altogether?", speech: `The plan is ${hops} ${hops === 1 ? "hop" : "hops"}. Repeat that whole plan ${repeats} times. Repeat means do it again. How many hops altogether?`,
      answer: String(hops * repeats), pool: numbers, sequence: { caption: "Repeat means do it again", repeat: repeats,
        steps: Array.from({ length: hops }, (_, i) => ({ label: String(i + 1), token: { value: "🦘", spoken: "hop" } })) } };
  }
  const maxSteps = tier < 1 ? 2 : tier < 3 ? 3 : 4;
  const plan = pick(SEQUENCE_PLANS.filter(item => item.steps.length <= maxSteps && (kind !== "missingNumber" || item.steps.length >= 3) && (firstGrade || item.title !== "Make a program")), rng);
  const tokens = plan.steps, count = tokens.length, steps = labeledSteps(tokens);
  const picturePool = [...tokens, ...SEQUENCE_PICTURES.filter(item => !tokens.some(token => token.value === item.value))];
  const intro = `Pip's plan. ${plan.title}. ${readPlan(steps)}`;
  const sequence = { caption: plan.title, steps };
  if (kind === "missingNumber") {
    const missing = 1 + Math.floor(rng() * (count - 2));
    return { prompt: "Find the missing step number.", speech: `${plan.title}. Follow the numbered steps. ${steps.map((step, i) => `${i === missing ? "Missing step number" : `Step ${i + 1}`}, ${step.token.spoken}.`).join(" ")} Which step number is missing?`,
      answer: String(missing + 1), pool: numbers,
      sequence: { ...sequence, steps: steps.map((step, i) => ({ ...step, label: i === missing ? "?" : String(i + 1) })) } };
  }
  if (kind === "word") {
    const target = Math.floor(rng() * count), word = steps[target].label;
    return { prompt: `Which step says ${word.toLowerCase()}?`, speech: `${intro} Which step number is labeled ${word}?`, answer: String(target + 1), pool: numbers, sequence };
  }
  if (kind === "after" || kind === "before") {
    const target = kind === "after" ? 1 + Math.floor(rng() * (count - 1)) : Math.floor(rng() * (count - 1));
    const reference = target + (kind === "after" ? -1 : 1), prompt = kind === "after" ? "What comes next after this?" : "What comes just before this?";
    return { prompt, speech: `${intro} ${kind === "after" ? "What comes next after" : "What comes just before"} ${tokens[reference].spoken}?`,
      answer: tokens[target].value, pool: picturePool, sequence: { ...sequence, reference } };
  }
  const last = rng() > .5, target = last ? count - 1 : 0;
  const prompt = `Which picture comes ${last ? "last" : "first"}?`;
  return { prompt, speech: `${intro} ${prompt}`, answer: tokens[target].value, pool: picturePool, sequence };
}
