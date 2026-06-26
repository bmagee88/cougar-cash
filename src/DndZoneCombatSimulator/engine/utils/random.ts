export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function roll3d6(): number {
  return randomInt(1, 6) + randomInt(1, 6) + randomInt(1, 6);
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
