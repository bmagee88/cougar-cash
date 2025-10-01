import React, { useEffect, useRef, useState } from "react";

type BunnyProps = {
  active: boolean;   // start/stop bunny motion
  kick?: number;     // increment to trigger an immediate hop
  dead?: boolean;    // show a dead bunny (no hop/shadow)
  z?: number;        // per-entity stacking order
  liftPx?: number;   // spawn a few px above baseline (row-based)

  // NEW: small hop distance, configurable
  stepMinVw?: number; // default 3
  stepMaxVw?: number; // default 6
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const rand = (min: number, max: number) => min + Math.random() * (max - min);

export default function Bunny({
  active,
  kick = 0,
  dead = false,
  z = 1,
  liftPx = 0,
  stepMinVw = 3,   // small default hops
  stepMaxVw = 6,   // small default hops
}: BunnyProps) {
  const [xvw, setXvw] = useState(() => rand(15, 85));
  const [facingRight, setFacingRight] = useState(true);
  const [hopping, setHopping] = useState(false);

  const hopTimer = useRef<number | null>(null);
  const lastKick = useRef(kick);

  const scheduleNext = () => {
    if (hopTimer.current) window.clearTimeout(hopTimer.current);
    hopTimer.current = window.setTimeout(() => {
      hop();
      scheduleNext();
    }, Math.round(rand(5000, 10000))); // hop every 5–10s
  };

  const hop = () => {
    if (dead) return; // no hopping when dead

    // decide direction with edge bias so we stay in frame
    const goRight = xvw < 12 ? true : xvw > 88 ? false : Math.random() < 0.5;

    // SMALL step size (configurable)
    const step = rand(stepMinVw, stepMaxVw);
    const target = clamp(xvw + (goRight ? step : -step), 4, 96);

    setFacingRight(target > xvw);
    setHopping(true);
    setXvw(target);

    // end hop animation slightly after CSS finishes
    window.setTimeout(() => setHopping(false), 650);
  };

  useEffect(() => {
    if (!active || dead) return;
    scheduleNext();
    return () => {
      if (hopTimer.current) window.clearTimeout(hopTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, dead]);

  useEffect(() => {
    if (!active || dead) return;
    if (kick !== lastKick.current) {
      lastKick.current = kick;
      hop();          // instant hop on kick (e.g., success)
      scheduleNext(); // reset cadence
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kick, active, dead]);

  // Still render dead bunnies (as bodies), don’t animate them
  const shouldRender = active || dead;
  if (!shouldRender) return null;

  return (
    <>
      <style>{`
        .bunny-layer{
          position: fixed;
          inset: 0 0 8px 0;
          pointer-events: none;
          z-index: 2; /* modal and toast are higher, but we layer bunnies via per-entity z */
        }
        .bunny{
          position: absolute;
          transform: translateX(-50%);
          transition: left 480ms cubic-bezier(.2,.75,.26,1);
        }
        .bunny-emoji{
          display: grid; place-items: center;
          transform-origin: center;
          transition: transform 200ms;
        }
        .bunny[data-right="0"] .bunny-emoji{ transform: scaleX(-1); }

        .bunny-emoji-inner{
          font-size: 38px; line-height: 1;
          filter: drop-shadow(0 2px 0 rgba(0,0,0,.12));
        }
        .bunny-shadow{
          width: 34px; height: 8px;
          background: rgba(0,0,0,.25);
          border-radius: 999px;
          margin: 4px auto 0;
          transform: scale(1);
          transition: transform 600ms, opacity 600ms;
          opacity: .9;
        }
        /* smaller hop arc to match shorter distance */
        .bunny[data-hop="1"] .bunny-emoji-inner{
          animation: bunnyHop 600ms cubic-bezier(.2,.75,.26,1);
        }
        .bunny[data-hop="1"] .bunny-shadow{
          transform: scale(.78);
          opacity: .7;
        }
        @keyframes bunnyHop{
          0%   { transform: translateY(0) }
          30%  { transform: translateY(-12px) } /* was -18px */
          60%  { transform: translateY(-3px) }
          100% { transform: translateY(0) }
        }
        .bunny.dead .bunny-emoji-inner{ filter:none; opacity:.9 }
      `}</style>

      <div className="bunny-layer" aria-hidden>
        <div
          className={`bunny ${dead ? "dead" : ""}`}
          style={{ left: `${xvw}vw`, bottom: `${8 + liftPx}px`, zIndex: z }}
          data-right={facingRight ? "1" : "0"}
          data-hop={hopping ? "1" : "0"}
        >
          <div className="bunny-emoji" title={`z:${z} row:${liftPx}px`}>
            <div className="bunny-emoji-inner">{dead ? "💀" : "🐰"}</div>
          </div>
          {!dead && <div className="bunny-shadow" />}
        </div>
      </div>
    </>
  );
}
