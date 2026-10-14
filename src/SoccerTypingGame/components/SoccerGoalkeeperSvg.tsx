import React from "react";
import { SoccerPlayerSvgProps } from "./SoccerPlayerSvg";

export default function SoccerGoalkeeperSvg({
  colors = {},
  facing = "right",
  ...props
}: SoccerPlayerSvgProps) {
  const {
    shirt = "#fb7185",
    shorts = "#881337",
    socks = shirt,
    trim = "#ffe4e6",
    skin = "#d99c72",
    hair = "#35251c",
    boots = "#17202a",
    gloves = "#ffffff",
  } = colors;

  return (
    <svg viewBox="0 0 40 60" fill="none" aria-hidden="true" {...props}>
      <g
        transform={facing === "left" ? "translate(40 0) scale(-1 1)" : undefined}
        stroke="#17202a"
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d="M12 40 L18 42 L14 49 L12 55 L7 54 L9 46 Z" fill={skin} />
        <path d="M22 42 L28 40 L31 46 L33 54 L28 55 L26 49 Z" fill={skin} />
        <path d="M9 48 L15 49 L12 56 L7 55 Z M25 49 L31 48 L33 55 L28 56 Z" fill={socks} />
        <path d="M7 54 L12 55 L12 59 H3 Q1 57 4 55 Z M28 55 L33 54 L36 55 Q39 57 37 59 H28 Z" fill={boots} />
        <path d="M4 58 H10 M30 58 H36" stroke="#f8fafc" strokeWidth="0.8" />
        <path d="M13 33 H27 L29 43 L22 44 L20 39 L18 44 L11 43 Z" fill={shorts} />
        <path d="M13 39 L16 40 M24 40 L27 39" stroke={trim} strokeWidth="2.5" />
        <path d="M18 13 H23 L25 19 H16 Z" fill={skin} />
        <path
          d="M16 17 L10 18 L5 27 L10 31 L14 24 L13 35 H27 L26 24 L30 31 L35 27 L30 18 L24 17 Q20 21 16 17 Z"
          fill={shirt}
        />
        <path d="M16 17 Q20 21 24 17 M6 26 L10 29 M30 29 L34 26" stroke={trim} strokeWidth="1.8" />
        <path d="M16 23 H24 M16 26 H24" stroke={trim} strokeWidth="1.2" />
        <path d="M5 27 L2 30 L2 34 L6 36 L10 32 L10 29 Z M35 27 L38 30 L38 34 L34 36 L30 32 L30 29 Z" fill={gloves} />
        <path d="M4 31 L7 33 M33 33 L36 31" stroke={trim} strokeWidth="1.3" />
        <path d="M17 6 Q22 4 25 8 L25 10 L27 12 L24 13 Q24 17 20 16 Q16 15 16 11 Z" fill={skin} />
        <path d="M16 10 C14 4 20 1 24 4 Q27 5 26 9 L22 7 L19 8 L18 12 L16 11 Z" fill={hair} />
        <path d="M23 10 H23.4" strokeWidth="1.3" />
      </g>
    </svg>
  );
}
