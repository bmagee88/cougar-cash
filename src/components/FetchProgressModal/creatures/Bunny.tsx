import React, { useEffect, useRef, useState } from "react";

type BunnyProps = {
  /** start/stop bunny motion */
  active: boolean;
  /** increment to trigger an immediate hop (any change fires once) */
  kick?: number;
  /** show as dead (no hop, no movement) */
  dead?: boolean;
  /** stacking order */
  z?: number;
  /** vertical spawn offset in px (row) */
  liftPx?: number;

  /** smaller default steps so things feel calm */
  stepMinVw?: number; // default 1.2
  stepMaxVw?: number; // default 2.4
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const rand = (min: number, max: number) => min + Math.random() * (max - min);

export default function Bunny({
  active,
  kick = 0,
  dead = false,
  z = 1,
  liftPx = 0,
  stepMinVw = 1.2,
  stepMaxVw = 2.4,
}: BunnyProps) {
  // horizontal position in vw (viewport width units)
  const [xvw, setXvw] = useState(() => rand(10, 90));
  const [facingRight, setFacingRight] = useState(true);

  // when true, CSS plays the arc animation for ~--entity-hop-ms
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

    // 1) decide step
    const dir = Math.random() < 0.5 ? -1 : 1;
    const step = rand(stepMinVw, stepMaxVw);
    setFacingRight(dir === 1);

    // 2) start hop (visual bounce)
    hopOnce(420);

    // 3) start slide (CSS handles left transition)
    setXvw((prev) => clamp(prev + step * dir, 5, 95));
  };

  /** Schedule the next hop/move after a calm, random delay */
  const scheduleNext = () => {
    clearTimer();
    // gentler cadence for bunnies: 6–12s
    const waitMs = Math.round(rand(6000, 12000));
    timeoutRef.current = window.setTimeout(() => {
      stepOnce();
      scheduleNext();
    }, waitMs);
  };

  // --- effects ---------------------------------------------------------------

  // Start/stop scheduler based on "active" and "dead"
  useEffect(() => {
    clearTimer();
    if (active && !dead) {
      scheduleNext();
    }
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, dead, stepMinVw, stepMaxVw]);

  // Kick: any change to "kick" triggers an immediate hop+step (throttle-safe)
  useEffect(() => {
    if (kick !== lastKickRef.current) {
      lastKickRef.current = kick;
      if (active && !dead) {
        stepOnce();
        // reschedule so the cadence remains natural
        scheduleNext();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kick]);

  // --- render ----------------------------------------------------------------

  return (
    <div
      className={`entity entity--bunny ${dead ? "is-dead" : ""}`}
      style={
        {
          left: `${xvw}vw`,
          bottom: `${8 + liftPx}px`,
          zIndex: z,
          // tune speeds without touching CSS:
          ["--entity-move-ms" as any]: "560ms",
          ["--entity-hop-ms" as any]: "420ms",
          ["--entity-emoji-size" as any]: "38px",
        } as React.CSSProperties
      }
      data-right={facingRight ? "1" : "0"}
      data-state={hopping ? "1" : "0"}
      aria-label="bunny"
    >
      <div className="entity-emoji">
        <div className="entity-emoji-inner">{dead ? "💀" : "🐰"}</div>
      </div>
      {!dead && <div className="entity-shadow" />}
    </div>
  );
}
