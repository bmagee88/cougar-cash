export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const rand = (min: number, max: number) => min + Math.random() * (max - min);
export const randInt = (minIncl: number, maxIncl: number) => Math.floor(rand(minIncl, maxIncl + 1));
export const randChoice = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// winSec: when the run succeeded (in seconds). If not yet known, pass null.
// timeoutSec: your run's timeout/max (in seconds).
export function computeRating(winSec: number | null, timeoutSec: number) {
 console.log("=>>",winSec, timeoutSec)
  // If we don't have a win time yet, use timeout to avoid NaN
  const effectiveWin = winSec ?? timeoutSec;

  // 1) base = floor(min(win, timeout))
  const base = Math.floor(Math.min(effectiveWin, timeoutSec));

  // 2) normalized distance between win and timeout in [0..1]
  const d = Math.abs(timeoutSec - effectiveWin) / Math.max(1, timeoutSec);

  // 3) multiplier grows as distance shrinks.
  // Curve: 1 + 4*(1 - d)^2  → 1× (far) up to ~5× (very close)
  const multiplier = 1 + 4 * Math.pow(1 - d, 2);

  // 4) final rating
  const rating = Math.round(base * multiplier);

  return { rating, multiplier, base, distance: d };
}