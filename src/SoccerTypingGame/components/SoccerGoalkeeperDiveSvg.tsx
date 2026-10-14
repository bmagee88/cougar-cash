import React from "react";
import { ShotLocation } from "../engine/types";
import { SoccerPlayerSvgProps } from "./SoccerPlayerSvg";

export default function SoccerGoalkeeperDiveSvg({ location, colors = {}, ...props }: SoccerPlayerSvgProps & { location: Exclude<ShotLocation, "c"> }) {
  const { shirt = "#bef264", shorts = "#365314", socks = shirt, trim = "#f7fee7", skin = "#d99c72", hair = "#35251c", boots = "#17202a", gloves = "#ffffff" } = colors;
  const left = location.endsWith("l");
  const high = location.startsWith("t");
  return <svg viewBox="0 0 100 70" fill="none" aria-hidden="true" data-dive={location} {...props}>
    <g transform={left ? "translate(100 0) scale(-1 1)" : undefined} stroke="#17202a" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
      <g transform={high ? "rotate(-23 50 35)" : "rotate(12 50 35)"}>
        <path d="M37 37 L22 48 L8 46 L7 53 L24 56 L44 45 M39 42 L27 60 L13 63 L15 68 L33 66 L50 47" fill={socks} />
        <path d="M8 46 L8 54 H2 L1 47 Z M13 62 L16 68 L7 69 L5 64 Z" fill={boots} />
        <path d="M34 33 L46 30 L53 40 L44 49 L32 43 Z" fill={shorts} />
        <path d="M43 23 L60 20 L65 31 L80 24 L84 30 L65 40 L57 34 L47 43 L35 32 Z" fill={shirt} />
        <path d="M48 28 L61 32 M44 33 L55 37 M76 27 L80 30" stroke={trim} strokeWidth="2.5" />
        <path d="M56 21 L64 12 L80 10 L82 16 L68 20 L63 27 Z" fill={shirt} />
        <path d="M79 10 L89 6 L94 8 L93 14 L83 17 Z M81 24 L91 20 L97 23 L96 29 L85 32 Z" fill={gloves} />
        <path d="M86 10 L91 10 M89 25 L94 25" stroke={trim} />
        <path d="M48 22 L53 16 L59 21 L56 27 Z" fill={skin} />
        <ellipse cx="54" cy="14" rx="7" ry="8" fill={skin} />
        <path d="M47 15 Q43 4 55 4 Q62 5 61 12 L55 9 L51 12 L50 16 Z" fill={hair} />
        <path d="M58 14 H59" />
      </g>
    </g>
  </svg>;
}
