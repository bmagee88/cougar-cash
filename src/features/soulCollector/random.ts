export function safeRandomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function chooseOne<T>(items: readonly T[]): T {
  return items[randomInt(0, items.length - 1)];
}

export function chooseWeighted<T>(choices: Array<{ value: T; weight: number }>): T {
  const totalWeight = choices.reduce((sum, choice) => sum + choice.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const choice of choices) {
    roll -= choice.weight;
    if (roll <= 0) return choice.value;
  }

  return choices[choices.length - 1].value;
}
