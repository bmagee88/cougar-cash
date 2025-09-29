import React, { useEffect, useRef, useState } from "react";

type BunnyProps = {
  active: boolean;   // render & run only when active
  kick?: number;     // increment this to force an immediate hop (e.g., on each success)
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const rand = (min: number, max: number) => min + Math.random() * (max - min);

export default function Bunny({ active, kick = 0 }: BunnyProps) {
  const [xvw, setXvw] = useState(() => rand(15, 85)); // start somewhere comfy
  const [facingRight, setFacingRight] = useState(true);
  const [hopping, setHopping] = useState(false);

  const hopTimer = useRef<number | null>(null);
  const lastKick = useRef(kick);

  // schedule a hop with random delay 5–10s
  const scheduleNext = () => {
    if (hopTimer.current) window.clearTimeout(hopTimer.current);
    hopTimer.current = window.setTimeout(() => {
      hop();
      scheduleNext(); // chain
    }, Math.round(rand(5000, 10000)));
  };

  const hop = () => {
    // pick a direction biased to stay on-screen
    const goRight = (() => {
      if (xvw < 12) return true;
      if (xvw > 88) return false;
      return Math.random() < 0.5; // otherwise random
    })();

    const step = rand(8, 16); // move by ~8–16vw
    const target = clamp(xvw + (goRight ? step : -step), 4, 96);

    setFacingRight(target > xvw);
    setHopping(true);
    setXvw(target);

    // end the hop animation a bit after the CSS finishes
    window.setTimeout(() => setHopping(false), 650);
  };

  useEffect(() => {
    if (!active) return;
    // start / restart the schedule when becoming active
    scheduleNext();
    return () => {
      if (hopTimer.current) window.clearTimeout(hopTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // react to "kick" changes: hop immediately and reschedule timer
  useEffect(() => {
    if (!active) return;
    if (kick !== lastKick.current) {
      lastKick.current = kick;
      hop();
      scheduleNext(); // reset cadence after a success
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kick, active]);

  if (!active) return null;

  return (
    <>
      <BunnyStyles />
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

function BunnyStyles() {
  return (
    <style>{`
      .bunny-layer{
        position: fixed;
        inset: 0 0 8px 0;
        pointer-events: none;
        z-index: 20; /* below your modal (z 9999), above the serene bg */
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
      /* face the direction of travel */
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

      /* hop animation (arc) */
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
  );
}
