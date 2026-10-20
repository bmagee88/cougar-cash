import type { Answer, Draft, GeneratorContext } from "./engine";
import type { SkillId } from "./resources";

const pick = <T,>(items: T[], rng: () => number) => items[Math.floor(rng() * items.length)];
const integer = (rng: () => number, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
const digits: Answer[] = Array.from({ length: 10 }, (_, n) => ({ value: String(n), spoken: String(n) }));

// Language templates share one calculation, so changing the wording cannot change
// what "more than" or "less than" means. Leaf answers remain single digits.
function arithmetic(context: GeneratorContext, subtract: boolean): Draft {
  const { rng, grade, tier } = context;
  const max = grade === 0 ? Math.min(9, 5 + tier) : grade === 1 ? 20 : 99;
  const a = integer(rng, grade === 2 ? 20 : 1, max);
  const b = subtract ? integer(rng, 0, a) : integer(rng, 0, max - a);
  const result = subtract ? a - b : a + b;
  const phrases = subtract
    ? [`${a} take away ${b}?`, `${a} minus ${b}?`, "How many are left?"]
    : ["How many all together?", "How many in total?", `${a} plus ${b}?`];
  if (grade >= 1) phrases.push(subtract ? `What's ${b} less than ${a}?` : `What's ${b} more than ${a}?`);
  const prompt = pick(phrases, rng), equation = `${a} ${subtract ? "−" : "+"} ${b}`;
  const question = /^(How many)/.test(prompt) ? `${a} ${subtract ? "take away" : "plus"} ${b}. ${prompt}` : prompt;
  if (grade === 0 || result < 10) return { prompt, speech: question, display: `${equation} = ?`, answer: String(result), pool: digits };
  const index = integer(rng, 0, String(result).length - 1);
  const mask = String(result).split("").map((value, i) => i === index ? "_" : value).join("");
  return { prompt, speech: `${question} Fill the blank digit. ${mask.split("").map(value => value === "_" ? "blank" : value).join(", ")}.`,
    display: `${equation} = ${mask}`, answer: String(result)[index], pool: digits };
}

function comparison({ rng, grade, platforms = 3 }: GeneratorContext): Draft {
  const kind = pick(["more", "less", "equal"], rng);
  const pictures = grade === 0, max = pictures ? 5 : grade === 1 ? 20 : 999;
  const available = Array.from({ length: pictures ? max : max + 1 }, (_, i) => i + (pictures ? 1 : 0));
  const values = Array.from({ length: platforms }, () => available.splice(integer(rng, 0, available.length - 1), 1)[0]);
  const target = kind === "equal" ? pick(values, rng) : kind === "more" ? Math.max(...values) : Math.min(...values);
  const prompt = kind === "equal" ? "Which has an equal amount?" : pictures ? `Which has ${kind}?` : `Which number is ${kind}?`;
  const options = values.map((value, i) => ({ value: String(i + 1), text: pictures ? "🍓".repeat(value) : String(value),
    spoken: pictures ? `${value} berries` : String(value) }));
  const context = kind === "equal" ? `Match: ${pictures ? "🍓".repeat(target) : target}` : undefined;
  return { prompt, speech: kind === "equal" ? `Find an amount equal to ${target}.` : prompt, context, options,
    answer: String(values.indexOf(target) + 1), pool: options.map(option => ({ value: option.value, spoken: `Choice ${option.value}` })) };
}

export const MATH_GENERATORS: Partial<Record<SkillId, (context: GeneratorContext) => Draft>> = {
  addition: context => arithmetic(context, false),
  subtraction: context => arithmetic(context, true),
  counting: comparison,
};
