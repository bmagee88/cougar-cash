import React, { useEffect, useRef, useState } from "react";

type Props = {
  dead?: boolean;
  z?: number;
  liftPx?: number;
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);

export default function Grass({ dead = false, z = 1, liftPx = 1 }: Props) {
  const [xvw] = useState(() => rand(6, 94));
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Slight idle sway
    const el = ref.current;
    if (!el) return;
    el.animate(
      [
        { transform: "rotate(0deg)" },
        { transform: "rotate(1.5deg)" },
        { transform: "rotate(0deg)" },
        { transform: "rotate(-1.5deg)" },
        { transform: "rotate(0deg)" },
      ],
      { duration: 4500 + Math.random() * 2000, iterations: Infinity }
    );
  }, []);

  return (
    <>
      <style>{`
        .grass-layer{
          position: fixed;
          inset: 0 0 8px 0;
          pointer-events: none;
          z-index: 2;
        }
        .grass {
          position: absolute;
          transform: translateX(-50%);
        }
        .grass-emoji-inner {
          font-size: 26px; line-height: 1;
          filter: drop-shadow(0 1px 0 rgba(0,0,0,.10));
        }
        .grass.dead .grass-emoji-inner {
          opacity: .8;
          filter: none;
        }
      `}</style>

      <div className="grass-layer" aria-hidden>
        <div
          className={`grass ${dead ? "dead" : ""}`}
          style={{ left: `${xvw}vw`, bottom: `${8 + (liftPx ?? 0)}px`, zIndex: z }}
          ref={ref}
          title={`z:${z} row:${liftPx}px`}
        >
          <div className="grass-emoji-inner">{dead ? "🥀" : "🌾"}</div>
        </div>
      </div>
    </>
  );
}
