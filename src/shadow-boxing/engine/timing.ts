export function nowMs(): number {
  if (typeof performance !== "undefined" && performance.now) {
    return performance.now();
  }

  return Date.now();
}

export function getDefenderTimeLimitMs(attackTimeMs: number): number {
  return attackTimeMs + 1000;
}

export function formatSeconds(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(2)} s`;
}

