import React, { useEffect, useRef, useState } from "react";

type BunnyProps = {
  active: boolean;   // start/stop bunny
  kick?: number;     // increment to trigger an immediate hop
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const rand = (min: number, max: number) => min + Math.random() * (max - min);

export default function Bunny({ active, kick = 0 }: BunnyProps) {
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
    }, Math.round(rand(5000, 10000)));
  };

  const hop = () => {
    const goRight = xvw < 12 ? true : xvw > 88 ? false : Math.random() < 0.5;
    const step = rand(8, 16);
    const target = clamp(xvw + (goRight ? step : -step), 4, 96);

    setFacingRight(target > xvw);
    setHopping(true);
    setXvw(target);
    window.setTimeout(() => setHopping(false), 650);
  };

  useEffect(() => {
    if (!active) return;
    scheduleNext();
    return () => {
      if (hopTimer.current) window.clearTimeout(hopTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (!active) return;
    if (kick !== lastKick.current) {
      lastKick.current = kick;
      hop();          // instant hop on kick (e.g., success)
      scheduleNext(); // reset cadence
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kick, active]);

  if (!active) return null;

  return (
    <>
      <style>{`
        .bunny-layer{
          position: fixed;
          inset: 0 0 8px 0;
          pointer-events: none;
          z-index: 2; /* below your toast and well below the modal */
        }
        .bunny{
          position: absolute;
          bottom: 8px;
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
        .bunny[data-hop="1"] .bunny-emoji-inner{
          animation: bunnyHop 600ms cubic-bezier(.2,.75,.26,1);
        }
        .bunny[data-hop="1"] .bunny-shadow{
          transform: scale(.7);
          opacity: .65;
        }
        @keyframes bunnyHop{
          0%   { transform: translateY(0) }
          30%  { transform: translateY(-18px) }
          60%  { transform: translateY(-4px) }
          100% { transform: translateY(0) }
        }
      `}</style>

      <div className="bunny-layer" aria-hidden>
        <div
          className="bunny"
          style={{ left: `${xvw}vw` }}
          data-right={facingRight ? "1" : "0"}
          data-hop={hopping ? "1" : "0"}
        >
          <div className="bunny-emoji">
            <div className="bunny-emoji-inner">🐰</div>
          </div>
          <div className="bunny-shadow" />
        </div>
      </div>
    </>
  );
}
