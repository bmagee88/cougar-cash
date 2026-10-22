/** Coalesce high-frequency input into one update per painted frame. */
export function createFrameQueue<T>(apply: (value: T) => void,
  request: (callback: FrameRequestCallback) => number = callback => requestAnimationFrame(callback),
  cancel: (id: number) => void = id => cancelAnimationFrame(id),
  merge: (previous: T, next: T) => T = (_previous, next) => next) {
  let frame: number | null = null;
  let pending: { value: T } | null = null;
  const run = () => {
    frame = null;
    const next = pending;
    pending = null;
    if (next) apply(next.value);
  };
  return {
    schedule(value: T) { pending = { value: pending ? merge(pending.value, value) : value }; if (frame === null) frame = request(run); },
    flush() { if (frame !== null) cancel(frame); run(); },
    cancel() { if (frame !== null) cancel(frame); frame = null; pending = null; },
  };
}
