import React, { useCallback, useEffect, useRef, useState } from "react";

type WolfProps = {
  active: boolean;
  kick?: number;
  dead?: boolean;
  z?: number;
  liftPx?: number;

  // Wolf steps are a bit longer than a fox by default
  stepMinVw?: number; // default 7
  stepMaxVw?: number; // default 13
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const rand = (min: number, max: number) => min + Math.random() * (max - min);

export default function Wolf({
  active,
  kick = 0,
  dead = false,
  z = 1,
  liftPx = 0,
  stepMinVw = 7,
  stepMaxVw = 13,
}: WolfProps) {
  const [xvw, setXvw] = useState(() => rand(8, 92));
  const [facingRight, setFacingRight] = useState(true);
  const [stalking, setStalking] = useState(false);

  const timerRef = useRef<number | null>(null);
  const lastKick = useRef(kick);

  const clearTimer = () => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Movement logic — use functional setter to avoid stale captures
  const move = useCallback(() => {
    if (!active || dead) return;

    setXvw((prev) => {
      // bias away from edges using *previous* x
      const goRight = prev < 10 ? true : prev > 90 ? false : Math.random() < 0.5;
      const step = rand(stepMinVw, stepMaxVw);
      const target = clamp(prev + (goRight ? step : -step), 3, 97);
      setFacingRight(target > prev);
      return target;
    });

    setStalking(true);
    window.setTimeout(() => setStalking(false), 600);
  }, [active, dead, stepMinVw, stepMaxVw]);

  // Self-rescheduling timer, stable via useCallback
  const scheduleNext = useCallback(() => {
    clearTimer();
    if (!active || dead) return;

    const ms = Math.round(rand(2500, 6000)); // every 2.5–6s
    timerRef.current = window.setTimeout(() => {
      move();
      scheduleNext();
    }, ms);
  }, [active, dead, move]);

  // Start/stop loop when active/dead changes
  useEffect(() => {
    if (active && !dead) scheduleNext();
    return () => clearTimer();
  }, [active, dead, scheduleNext]);

  // External "kick" trigger (e.g., event in parent)
  useEffect(() => {
    if (!active || dead) return;
    if (kick !== lastKick.current) {
      lastKick.current = kick;
      move();
      scheduleNext();
    }
  }, [kick, active, dead, move, scheduleNext]);

  const shouldRender = active || dead;
  if (!shouldRender) return null;

  return (
    <>
      <style>{`
        .wolf-layer {
          position: fixed;
          inset: 0 0 8px 0;
          pointer-events: none;
          z-index: 3;
        }
        .wolf {
          position: absolute;
          transform: translateX(-50%);
          transition: left 420ms cubic-bezier(.2,.75,.26,1);
        }
        .wolf-emoji {
          display: grid; place-items: center;
          transform-origin: center;
          transition: transform 200ms;
        }
        .wolf[data-right="0"] .wolf-emoji { transform: scaleX(-1); }

        .wolf-emoji-inner {
          font-size: 46px;
          line-height: 1;
          filter: drop-shadow(0 2px 0 rgba(0,0,0,.18));
        }
        .wolf-shadow {
          width: 46px; height: 12px;
          background: rgba(0,0,0,.28);
          border-radius: 999px;
          margin: 4px auto 0;
          transform: scale(1);
          transition: transform 600ms, opacity 600ms;
          opacity: .9;
        }
        .wolf[data-stalking="1"] .wolf-emoji-inner {
          animation: wolfPounce 600ms cubic-bezier(.2,.75,.26,1);
        }
        .wolf[data-stalking="1"] .wolf-shadow {
          transform: scale(.72);
          opacity: .72;
        }
        @keyframes wolfPounce {
          0%   { transform: translateY(0) }
          28%  { transform: translateY(-16px) }
          60%  { transform: translateY(-5px) }
          100% { transform: translateY(0) }
        }
        .wolf.dead .wolf-emoji-inner { filter: none; opacity: .9; }
      `}</style>

      <div className="wolf-layer" aria-hidden>
        <div
          className={`wolf ${dead ? "dead" : ""}`}
          style={{ left: `${xvw}vw`, bottom: `${8 + liftPx}px`, zIndex: z }}
          data-right={facingRight ? "1" : "0"}
          data-stalking={stalking ? "1" : "0"}
        >
          <div className="wolf-emoji" title={`z:${z} row:${liftPx}px`}>
            <div className="wolf-emoji-inner">{dead ? "💀" : "🐺"}</div>
          </div>
          {!dead && <div className="wolf-shadow" />}
        </div>
      </div>
    </>
  );
}
