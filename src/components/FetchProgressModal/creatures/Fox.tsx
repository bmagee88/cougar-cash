import React, { useEffect, useRef, useState } from "react";

type FoxProps = {
  /** start/stop fox motion */
  active: boolean;
  /** increment to trigger an immediate step (any change fires once) */
  kick?: number;
  /** show as dead (no hop, no movement) */
  dead?: boolean;
  /** stacking order */
  z?: number;
  /** vertical spawn offset in px (row) */
  liftPx?: number;

  /** calm defaults (you can override per instance) */
  stepMinVw?: number; // default 2
  stepMaxVw?: number; // default 4
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const rand = (min: number, max: number) => min + Math.random() * (max - min);

export default function Fox({
  active,
  kick = 0,
  dead = false,
  z = 1,
  liftPx = 0,
  stepMinVw = 2,
  stepMaxVw = 4,
}: FoxProps) {
  // horizontal position in vw
  const [xvw, setXvw] = useState(() => rand(10, 90));
  const [facingRight, setFacingRight] = useState(true);

  // true while hop arc plays (CSS listens to data-state)
  const [hopping, setHopping] = useState(false);

  // timers/bookkeeping
  const timeoutRef = useRef<number | null>(null);
  const lastKickRef = useRef<number>(kick);

  // --- helpers ---------------------------------------------------------------

  const clearTimer = () => {
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  /** Briefly sets data-state="1" so CSS runs @keyframes entityArc */
  const hopOnce = (ms = 420) => {
    setHopping(true);
    window.setTimeout(() => setHopping(false), ms);
  };

  /** One step: pick a direction, arc, then slide horizontally */
  const stepOnce = () => {
    if (dead) return;

    const dir = Math.random() < 0.5 ? -1 : 1;
    const step = rand(stepMinVw, stepMaxVw);
    setFacingRight(dir === 1);

    hopOnce(420); // visual arc
    setXvw((prev) => clamp(prev + step * dir, 5, 95)); // horizontal slide
  };

  /** Schedule the next step after a fox-like cadence */
  const scheduleNext = () => {
    clearTimer();
    // fox cadence: 5–9s
    const waitMs = Math.round(rand(5000, 9000));
    timeoutRef.current = window.setTimeout(() => {
      stepOnce();
      scheduleNext();
    }, waitMs);
  };

  // --- effects ---------------------------------------------------------------

  useEffect(() => {
    clearTimer();
    if (active && !dead) {
      scheduleNext();
    }
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, dead, stepMinVw, stepMaxVw]);

  // Kick: any change to "kick" triggers an immediate hop+step
  useEffect(() => {
    if (kick !== lastKickRef.current) {
      lastKickRef.current = kick;
      if (active && !dead) {
        stepOnce();
        scheduleNext();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kick]);

  // --- render ----------------------------------------------------------------

  return (
    <div
      className={`entity entity--fox ${dead ? "is-dead" : ""}`}
      style={
        {
          left: `${xvw}vw`,
          bottom: `${8 + liftPx}px`,
          zIndex: z,
          // tune speeds without touching CSS:
          ["--entity-move-ms" as any]: "520ms", // slightly snappier than bunny
          ["--entity-hop-ms" as any]: "420ms",
          ["--entity-emoji-size" as any]: "42px",
        } as React.CSSProperties
      }
      data-right={facingRight ? "1" : "0"}
      data-state={hopping ? "1" : "0"}
      aria-label="fox"
    >
      <div className="entity-emoji">
        <div className="entity-emoji-inner">{dead ? "💀" : "🦊"}</div>
      </div>
      {!dead && <div className="entity-shadow" />}
    </div>
  );
}
