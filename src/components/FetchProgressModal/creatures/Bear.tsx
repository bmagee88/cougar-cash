import React, { useEffect, useRef, useState } from "react";

type BearProps = {
  /** start/stop bear motion */
  active: boolean;
  /** external nudge; any change steps once immediately */
  kick?: number;
  /** show as dead (no movement) */
  dead?: boolean;
  /** stacking order */
  z?: number;
  /** vertical spawn offset in px (row) */
  liftPx?: number;

  /** slow, steady walking */
  stepMinVw?: number; // default 0.6
  stepMaxVw?: number; // default 1.2
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const rand = (min: number, max: number) => min + Math.random() * (max - min);

export default function Bear({
  active,
  kick = 0,
  dead = false,
  z = 1,
  liftPx = 0,
  stepMinVw = 0.6,
  stepMaxVw = 1.2,
}: BearProps) {
  // horizontal position & facing
  const [xvw, setXvw] = useState(() => rand(15, 85));
  const [facingRight, setFacingRight] = useState(Math.random() < 0.5);

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

  /** One slow step; reverses at bounds (5vw..95vw) */
  const stepOnce = () => {
    if (dead) return;

    // gently bias toward current facing; flip if nearing bounds
    let dir = facingRight ? 1 : -1;
    if ((facingRight && xvw > 93) || (!facingRight && xvw < 7)) {
      dir *= -1; // hard flip at edges
      setFacingRight(dir === 1);
    } else if (Math.random() < 0.08) {
      // tiny chance to lazily turn around in open space
      dir *= -1;
      setFacingRight(dir === 1);
    }

    const step = rand(stepMinVw, stepMaxVw);
    setXvw((prev) => clamp(prev + step * dir, 5, 95));
  };

  /** Schedule the next slow step (bear cadence) */
  const scheduleNext = () => {
    clearTimer();
    // slow walking: every 1.2–2.2s
    const waitMs = Math.round(rand(1200, 2200));
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
  }, [active, dead, stepMinVw, stepMaxVw, facingRight]);

  // Kick: immediate step without breaking cadence
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
  // No jumping: we never set data-state="1" (so no hop animation).
  return (
    <div
      className={`entity entity--bear ${dead ? "is-dead" : ""}`}
      style={
        {
          left: `${xvw}vw`,
          bottom: `${8 + liftPx}px`,
          zIndex: z,
          // slow, hefty glide
          ["--entity-move-ms" as any]: "680ms",
          ["--entity-emoji-size" as any]: "48px",
        } as React.CSSProperties
      }
      data-right={facingRight ? "1" : "0"}
      data-state="0"
      aria-label="bear"
    >
      <div className="entity-emoji">
        <div className="entity-emoji-inner">{dead ? "💀" : "🐻"}</div>
      </div>
      {!dead && <div className="entity-shadow" />}
    </div>
  );
}
