import React, { useEffect, useRef, useState } from "react";

type Props = {
  dead?: boolean;
  z?: number;
  liftPx?: number;
  /** optional fixed horizontal position in vw; if omitted, pick a random one */
  xvw?: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const rand = (min: number, max: number) => min + Math.random() * (max - min);

export default function Grass({ dead = false, z = 1, liftPx = 1, xvw: xvwProp }: Props) {
  // Use provided xvw or pick a stable-ish random once
  const [xvw] = useState(() =>
    typeof xvwProp === "number" ? clamp(xvwProp, 2, 98) : rand(6, 94)
  );

  // animate only the emoji container so the position doesn't shift
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // pivot from the base of the grass
    el.style.transformOrigin = "50% 100%";
    el.style.willChange = "transform";

    // gentle side-to-side sway (no translateY)
    const anim = el.animate(
      [
        { transform: "rotate(0deg)" },
        { transform: "rotate(-3deg)" },
        { transform: "rotate(2.5deg)" },
        { transform: "rotate(-2deg)" },
        { transform: "rotate(0deg)" },
      ],
      {
        duration: 5200 + Math.random() * 1800,
        iterations: Infinity,
        easing: "ease-in-out",
        direction: "alternate",
      }
    );

    return () => anim.cancel();
  }, []);

  return (
    <div
      className={`entity entity--grass ${dead ? "is-dead" : ""}`}
      style={
        {
          left: `${xvw}vw`,
          bottom: `${8 + (liftPx ?? 0)}px`,
          zIndex: z,
          ["--entity-emoji-size" as any]: "30px",
          ["--entity-move-ms" as any]: "520ms",
        } as React.CSSProperties
      }
      data-right="1"
      data-state="0"
      aria-label="grass"
    >
      <div className="entity-emoji" ref={ref}>
        <div className="entity-emoji-inner">{dead ? "🥀" : "🌾"}</div>
      </div>
      {!dead && <div className="entity-shadow" />}
    </div>
  );
}
