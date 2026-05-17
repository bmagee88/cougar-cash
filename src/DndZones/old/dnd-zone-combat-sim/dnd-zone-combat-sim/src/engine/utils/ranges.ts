export interface NumericRange {
  start: number;
  end: number;
}

export function isInRange(value: number, range: NumericRange): boolean {
  return value >= range.start && value <= range.end;
}

export function rangesOverlap(a: NumericRange, b: NumericRange): boolean {
  return a.start <= b.end && b.start <= a.end;
}
