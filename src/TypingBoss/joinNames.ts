// Curated short words keep generated classroom aliases friendly and readable.
const ADJECTIVES = ["Bold", "Kind", "Calm", "Cozy", "Glad", "Wise", "Blue", "Mint", "Gold", "Pink", "Jade", "True", "Neat", "Star", "Soft", "Cool"];
const ANIMALS = ["Fox", "Owl", "Panda", "Otter", "Koala", "Bunny", "Robin", "Finch", "Cub", "Fawn", "Gecko", "Lynx", "Tiger", "Seal", "Wren", "Hare"];

export function generateJoinName(previous = ""): string {
  const count = ADJECTIVES.length * ANIMALS.length;
  const names = ADJECTIVES.flatMap(adjective => ANIMALS.map(animal => `${adjective}${animal}`));
  const previousIndex = names.indexOf(previous);
  // Sampling the remaining names guarantees that Shuffle visibly changes it.
  let index = Math.floor(Math.random() * (previousIndex < 0 ? count : count - 1));
  if (previousIndex >= 0 && index >= previousIndex) index += 1;
  return names[index];
}

export function shortJoinCode(sessionId: string): string {
  return sessionId.replace(/^boss/i, "").slice(-3).toUpperCase();
}
