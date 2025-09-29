import { HHMM } from "../types/timer";

export const uid = (prefix = "id") =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

export const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h % 24) * 60 + (m % 60);
};

export const toHHMM = (mins: number): HHMM => {
  const mm = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(mm / 60);
  const m = mm % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` as HHMM;
};

// Minutes difference from a to b, wrapping across midnight if b < a.
export const diffMinutesWrap = (a: HHMM, b: HHMM) => {
  const am = toMinutes(a);
  let bm = toMinutes(b);
  if (bm < am) bm += 24 * 60;
  return bm - am; // 0..1439
};

// Map an absolute clock time t into "minutes since start", wrapping if needed.
export const relMinutes = (start: HHMM, t: HHMM) => {
  const sm = toMinutes(start);
  let tm = toMinutes(t);
  if (tm < sm) tm += 24 * 60;
  return tm - sm; // >= 0
};

// Convert "minutes since start" back to HH:MM on the same 24h clock.
export const relToHHMM = (start: HHMM, rel: number): HHMM => {
  const sm = toMinutes(start);
  return toHHMM(sm + Math.max(0, rel));
};

export const clampTime = (t: HHMM): HHMM =>
  toHHMM(Math.min(Math.max(toMinutes(t), 0), 23 * 60 + 59));

export const midpointTime = (a: HHMM, b: HHMM) => {
  const am = toMinutes(a);
  const dm = diffMinutesWrap(a, b); // distance a→b, wrap if needed
  return toHHMM(am + Math.floor(dm / 2));
};

export const durationLabel = (a: HHMM, b: HHMM) => {
  const m = Math.max(0, diffMinutesWrap(a, b));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
};
