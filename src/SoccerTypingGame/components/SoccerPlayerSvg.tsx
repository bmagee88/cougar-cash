import React from "react";
import { SoccerPlayerColors } from "../engine/types";

export interface SoccerPlayerSvgProps extends React.SVGProps<SVGSVGElement> {
  colors?: SoccerPlayerColors;
  facing?: "left" | "right";
}

export default function SoccerPlayerSvg({
  colors = {},
  facing = "right",
  ...props
}: SoccerPlayerSvgProps) {
  const {
    shirt = "#facc15",
    shorts = "#f8fafc",
    socks = shirt,
    trim = "#17202a",
    skin = "#d99c72",
    hair = "#35251c",
    boots = "#17202a",
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
        <path d="M14 40 L19 42 L15 49 L12 54 L8 52 L11 47 Z" fill={skin} />
        <path d="M24 41 L29 40 L33 47 L28 54 L23 52 L28 47 Z" fill={skin} />
        <path d="M11 48 L15 50 L12 56 L8 55 L8 52 Z" fill={socks} />
        <path d="M28 48 L32 48 L28 55 L23 54 L24 51 Z" fill={socks} />
        <path d="M8 54 L12 55 L11 59 L4 59 Q2 58 4 56 Z" fill={boots} />
        <path d="M23 53 L28 54 L28 58 L22 58 L19 56 L20 54 Z" fill={boots} />
        <path d="M5 58 H10 M22 56 L26 57" stroke="#f8fafc" strokeWidth="0.8" />

        <path d="M9 27 L5 33 Q4 35 6 37 L11 40 Q13 40 14 38 Q14 36 12 36 L9 34 L13 29 Z" fill={skin} />
        <path d="M30 24 L34 21 L34 17 Q36 14 38 17 L38 22 Q38 24 36 26 L32 29 Z" fill={skin} />
        <path d="M14 33 H28 L29 41 L22 43 L20 38 L18 43 L11 41 Z" fill={shorts} />
        <path d="M15 34 H27" stroke={trim} strokeWidth="1.6" />
        <path d="M20 14 L25 14 L26 19 L19 19 Z" fill={skin} />
        <path
          d="M19 17 L16 17 L10 19 L6 27 L12 30 L15 25 L14 34 H29 L28 25 L32 29 L36 23 L31 19 L26 17 Q22 21 19 17 Z"
          fill={shirt}
        />
        <path d="M19 17 Q22 21 26 17 M7 26 L12 29 M32 27 L35 23" stroke={trim} strokeWidth="1.8" />
        <path d="M15 26 L16 32 M27 26 L27 32" stroke={trim} strokeWidth="1.2" />
        <path d="M18 21 L17 29" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="2" />

        <path d="M19 7 Q24 5 27 9 L27 11 L29 13 L26 14 Q26 18 22 17 Q18 16 18 12 Z" fill={skin} />
        <path d="M18 11 C16 5 21 2 26 5 Q29 6 28 10 L24 8 L21 9 L20 13 L18 12 Z" fill={hair} />
        <path d="M25 11 H25.4" strokeWidth="1.3" />
      </g>
    </svg>
  );
}
