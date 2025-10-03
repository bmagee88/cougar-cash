export type MotionConfig = {
  /** how far a single step can move, in vw */
  stepMinVw: number;
  stepMaxVw: number;

  /** horizontal bounds in vw */
  minXvw?: number; // default 5
  maxXvw?: number; // default 95

  /** random wait between steps (ms) */
  jitterMs?: [number, number]; // default [800, 1800]

  /** how long a “moving” pulse lasts for CSS (ms) */
  movePulseMs?: number; // default 600
};

export type UseEntityMotionOptions = {
  /** when false, motion pauses (keeps last position/state) */
  active: boolean;

  /** dead entities don’t move (but keep position/flip) */
  dead?: boolean;

  /** optional seed for initial position; otherwise random */
  initialXvw?: number;

  /** call after each step resolves */
  onStep?: (xvw: number) => void;
};

export type UseEntityMotionReturn = {
  xvw: number;
  facingRight: boolean;
  moving: boolean;      // for data-state="1"
  kickNow: () => void;  // force an immediate step
  setXvw: (x: number) => void; // manual override (rare)
};
