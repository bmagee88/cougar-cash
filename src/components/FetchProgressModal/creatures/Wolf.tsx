import React, { useEffect, useRef, useState } from "react";

type WolfProps = {
  active: boolean;
  kick?: number;
  dead?: boolean;
  z?: number;
  liftPx?: number;

  // Wolves move slower but with heavier steps
  stepMinVw?: number; // default 4
  stepMaxVw?: number; // default 8
};

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
const rand = (min: number, max: number) => min + Math.random() * (max - min);

export default function Wolf({
  active,
  kick = 0,
  dead = false,
  z = 1,
  liftPx = 0,
  stepMinVw = 4,
  stepMaxVw = 8,
}: WolfProps) {
  const [xvw, setXvw] = useState(() => rand(8, 92));
  const [facingRight, setFacingRight] = useState(true);
  const [stalking, setStalking] = useState(false);

  const moveTimer = useRef<number | null>(null);
  const lastKick = useRef(kick);

  const scheduleNext = () => {
    if (moveTimer.current) window.clearTimeout(moveTimer.current);
    moveTimer.current = window.setTimeout(() => {
      move();
      scheduleNext();
    }, Math.round(rand(4000, 9000))); // every 4–9s
  };

  const move = () => {
    if (dead) return;

    const goRight = xvw < 8 ? true : xvw > 92 ? false : Math.random() < 0.5;
    const step = rand(stepMinVw, stepMaxVw);
    const target = clamp(xvw + (goRight ? step : -step), 4, 96);

    setFacingRight(target > xvw);
    setStalking(true);
    setXvw(target);

    window.setTimeout(() => setStalking(false), 700);
  };

  useEffect(() => {
    if (!active || dead) return;
    scheduleNext();
    return () => {
      if (moveTimer.current) window.clearTimeout(moveTimer.current);
    };
  }, [active, dead, scheduleNext]);

  useEffect(() => {
    if (!active || dead) return;
    if (kick !== lastKick.current) {
      lastKick.current = kick;
      move();
      scheduleNext();
    }
  }, [kick, active, dead, move, scheduleNext]);

  if (!(active || dead)) return null;

  return (
    <>
      <style>{`
        .wolf-layer {
          position: fixed;
          inset: 0 0 8px 0;
          pointer-events: none;
          z-index: 2;
        }
        .wolf {
          position: absolute;
          transform: translateX(-50%);
          transition: left 520ms cubic-bezier(.2,.75,.26,1);
        }
        .wolf-emoji {
          display: grid; place-items: center;
          transform-origin: center;
          transition: transform 200ms;
        }
        .wolf[data-right="0"] .wolf-emoji { transform: scaleX(-1); }

        .wolf-emoji-inner {
          font-size: 48px;
          line-height: 1;
          filter: drop-shadow(0 3px 0 rgba(0,0,0,.25));
        }
        .wolf-shadow {
          width: 50px; height: 12px;
          background: rgba(0,0,0,.35);
          border-radius: 999px;
          margin: 5px auto 0;
          transform: scale(1);
          transition: transform 600ms, opacity 600ms;
          opacity: .9;
        }
        .wolf[data-stalk="1"] .wolf-emoji-inner {
          animation: wolfStep 700ms cubic-bezier(.2,.75,.26,1);
        }
        .wolf[data-stalk="1"] .wolf-shadow {
          transform: scale(.75);
          opacity: .7;
        }
        @keyframes wolfStep {
          0%   { transform: translateY(0) }
          30%  { transform: translateY(-16px) }
          60%  { transform: translateY(-5px) }
          100% { transform: translateY(0) }
        }
        .wolf.dead .wolf-emoji-inner { filter:none; opacity:.85 }
      `}</style>

      <div className="wolf-layer" aria-hidden>
        <div
          className={`wolf ${dead ? "dead" : ""}`}
          style={{ left: `${xvw}vw`, bottom: `${8 + liftPx}px`, zIndex: z }}
          data-right={facingRight ? "1" : "0"}
          data-stalk={stalking ? "1" : "0"}
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
