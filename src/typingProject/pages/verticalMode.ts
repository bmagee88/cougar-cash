export const VERTICAL_COLUMNS = {
  a: { keys: ["q", "a", "z"], hand: "left" },
  s: { keys: ["w", "s", "x"], hand: "left" },
  d: { keys: ["e", "d", "c"], hand: "left" },
  f: { keys: ["r", "f", "v"], hand: "left" },
  g: { keys: ["t", "g", "b"], hand: "left" },
  h: { keys: ["y", "h", "n"], hand: "right" },
  j: { keys: ["u", "j", "m"], hand: "right" },
  k: { keys: ["i", "k", ","], hand: "right" },
  l: { keys: ["o", "l", "."], hand: "right" },
  ";": { keys: ["p", ";", "/"], hand: "right" },
} as const;

export type VerticalHomeKey = keyof typeof VERTICAL_COLUMNS;
export const VERTICAL_KEY_STORAGE = "typingDdrVerticalHomeKey";
export const VERTICAL_ROW_POSITIONS = [59, 74, 89] as const;

export function isVerticalHomeKey(key: string): key is VerticalHomeKey {
  return Object.prototype.hasOwnProperty.call(VERTICAL_COLUMNS, key);
}

export function loadVerticalHomeKey(): VerticalHomeKey {
  try {
    const key = window.localStorage.getItem(VERTICAL_KEY_STORAGE);
    return key && isVerticalHomeKey(key) ? key : "f";
  } catch {
    return "f";
  }
}
