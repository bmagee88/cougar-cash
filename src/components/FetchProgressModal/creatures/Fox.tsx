import React, { useEffect, useRef, useState } from "react";

type FoxProps = {
  active: boolean;
  kick?: number;
  dead?: boolean;
  z?: number;
  liftPx?: number;

  // Fox covers more ground than Bunny
  stepMinVw?: number; // default 6
  stepMaxVw?: number; // default 12
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const rand = (min: number, max: number) => min + Math.random() * (max - min);

export default function Fox({
  active,
  kick = 0,
  dead = false,
  z = 1,
  liftPx = 0,
  stepMinVw = 6,
  stepMaxVw = 12,
}: FoxProps) {
  const [xvw, setXvw] = useState(() => rand(10, 90));
  const [facingRight, setFacingRight] = useState(true);
  const [running, setRunning] = useState(false);

  const runTimer = useRef<number | null>(null);
  const lastKick = useRef(kick);

  const scheduleNext = () => {
    if (runTimer.current) window.clearTimeout(runTimer.current);
    runTimer.current = window.setTimeout(() => {
      run();
      scheduleNext();
    }, Math.round(rand(3000, 7000))); // run every 3–7s
  };

  const run = () => {
    if (dead) return;

    // bias away from edges
    const goRight = xvw < 10 ? true : xvw > 90 ? false : Math.random() < 0.5;

    const step = rand(stepMinVw, stepMaxVw);
    const target = clamp(xvw + (goRight ? step : -step), 4, 96);

    setFacingRight(target > xvw);
    setRunning(true);
    setXvw(target);

    window.setTimeout(() => setRunning(false), 550);
  };

  useEffect(() => {
    if (!active || dead) return;
    scheduleNext();
    return () => {
      if (runTimer.current) window.clearTimeout(runTimer.current);
    };
  }, [active, dead, scheduleNext]);

  useEffect(() => {
    if (!active || dead) return;
    if (kick !== lastKick.current) {
      lastKick.current = kick;
      run();
      scheduleNext();
    }
  }, [kick, active, dead, scheduleNext, run]);

  const shouldRender = active || dead;
  if (!shouldRender) return null;

  return (
    <>
      <style>{`
        .fox-layer {
          position: fixed;
          inset: 0 0 8px 0;
          pointer-events: none;
          z-index: 2;
        }
        .fox {
          position: absolute;
          transform: translateX(-50%);
          transition: left 420ms cubic-bezier(.2,.75,.26,1);
        }
        .fox-emoji {
          display: grid; place-items: center;
          transform-origin: center;
          transition: transform 200ms;
        }
        .fox[data-right="0"] .fox-emoji{ transform: scaleX(-1); }

        .fox-emoji-inner {
          font-size: 42px;
          line-height: 1;
          filter: drop-shadow(0 2px 0 rgba(0,0,0,.15));
        }
        .fox-shadow {
          width: 40px; height: 10px;
          background: rgba(0,0,0,.28);
          border-radius: 999px;
          margin: 4px auto 0;
          transform: scale(1);
          transition: transform 600ms, opacity 600ms;
          opacity: .9;
        }
        .fox[data-run="1"] .fox-emoji-inner{
          animation: foxRun 550ms cubic-bezier(.2,.75,.26,1);
        }
        .fox[data-run="1"] .fox-shadow{
          transform: scale(.7);
          opacity: .7;
        }
        @keyframes foxRun {
          0%   { transform: translateY(0) }
          30%  { transform: translateY(-14px) }
          60%  { transform: translateY(-4px) }
          100% { transform: translateY(0) }
        }
        .fox.dead .fox-emoji-inner{ filter:none; opacity:.9 }
      `}</style>

      <div className="fox-layer" aria-hidden>
        <div
          className={`fox ${dead ? "dead" : ""}`}
          style={{ left: `${xvw}vw`, bottom: `${8 + liftPx}px`, zIndex: z }}
          data-right={facingRight ? "1" : "0"}
          data-run={running ? "1" : "0"}
        >
          <div className="fox-emoji" title={`z:${z} row:${liftPx}px`}>
            <div className="fox-emoji-inner">{dead ? "💀" : "🦊"}</div>
          </div>
          {!dead && <div className="fox-shadow" />}
        </div>
      </div>
    </>
  );
}
