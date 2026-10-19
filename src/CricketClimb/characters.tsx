import { useId } from "react";

export type CricketMood = "waiting" | "chirping" | "charging" | "superjump" | "jumping" | "falling" | "suspense" | "celebrating" | "landing";

export function Cricket({ mood = "waiting", decorative = false }: { mood?: CricketMood; decorative?: boolean }) {
  const id = useId().replace(/:/g, "");
  return <svg className={`cc-cricket cc-cricket--${mood}`} viewBox="0 0 140 150" role={decorative ? undefined : "img"}
    aria-label={decorative ? undefined : `Pip the cricket, ${mood}`} aria-hidden={decorative || undefined}>
    <defs>
      <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#b8e56b" /><stop offset="1" stopColor="#6daf44" /></linearGradient>
      <linearGradient id={`${id}-head`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#c8ec84" /><stop offset="1" stopColor="#96d25b" /></linearGradient>
    </defs>
    <g className="cc-cricket-body" stroke="#315d32" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <g className="cc-back-leg cc-back-leg--left"><path d="M56 101 Q22 76 24 103 L40 131 24 134" fill="#8bc34d" /><path d="m29 133 15 1" /></g>
      <g className="cc-back-leg cc-back-leg--right"><path d="M85 103 Q119 77 117 103 L101 132 118 135" fill="#8bc34d" /><path d="m100 135 22 1" /></g>
      <path d="M52 73 Q32 86 48 115 Q60 132 88 116 L94 79Z" fill={`url(#${id}-body)`} />
      <path d="M49 82 Q61 97 75 116 Q45 115 45 94Z" fill="#6eaa48" strokeWidth="2" />
      {mood === "chirping" && <g className="cc-chirping-wings" fill="#c1dd82" strokeWidth="2">
        <path className="cc-chirp-wing cc-chirp-wing--left" d="M64 83Q30 78 40 101q10 15 31 12Z" />
        <path className="cc-chirp-wing cc-chirp-wing--right" d="M73 82q40-13 32 14-7 20-35 18Z" />
        <path d="m46 92 19 17m28-22-20 22" fill="none" stroke="#83a64f" />
      </g>}
      <path d="M67 100v27q-3 6-13 6m27-31v26q4 6 14 6" fill="none" />
      <g className="cc-arm cc-arm--left"><path d="M50 81 Q35 89 28 79" fill="none" /><path d="m28 79-7-3m7 3-3-8" fill="none" strokeWidth="3" /></g>
      <g className="cc-arm cc-arm--right"><path d="M93 81 Q108 83 113 71" fill="none" /><path d="m113 71 7-3m-7 3 1-8" fill="none" strokeWidth="3" /></g>
      <path className="cc-antenna cc-antenna--left" d="M54 36 Q42 4 27 12" fill="none" />
      <path className="cc-antenna cc-antenna--right" d="M84 32 Q89 2 106 8" fill="none" />
      <circle cx="26" cy="12" r="4" fill="#d2a849" stroke="none" /><circle cx="107" cy="8" r="4" fill="#d2a849" stroke="none" />
      <path d="M37 52 Q40 28 67 28 Q101 26 105 54 Q109 78 79 83 Q43 86 37 62Z" fill={`url(#${id}-head)`} />
      <ellipse cx="58" cy="49" rx="12" ry="15" fill="#fffef4" strokeWidth="2.5" />
      <ellipse cx="87" cy="47" rx="12" ry="16" fill="#fffef4" strokeWidth="2.5" />
      <g className="cc-pupils" fill="#253e2d" stroke="none"><ellipse cx="62" cy="50" rx="5.5" ry="8" /><ellipse cx="90" cy="48" rx="5.5" ry="8" />
        <circle cx="64" cy="47" r="2" fill="white" /><circle cx="92" cy="45" r="2" fill="white" /></g>
      <ellipse cx="44" cy="65" rx="6" ry="3.5" fill="#e9ac72" stroke="none" opacity=".8" />
      <ellipse cx="97" cy="63" rx="6" ry="3.5" fill="#e9ac72" stroke="none" opacity=".8" />
      {mood === "charging" ? <path d="M63 69q12-6 24-2l-3 8-17 1Z" fill="#fffef4" strokeWidth="2.5" />
        : mood === "falling" ? <ellipse cx="75" cy="70" rx="6" ry="7" fill="#355932" strokeWidth="2" />
        : mood === "suspense" ? <path d="M67 71q8-4 15 0" fill="none" strokeWidth="2.5" />
          : <path d="M63 67q12 16 24-2" fill={mood === "celebrating" || mood === "superjump" ? "#355932" : "none"} strokeWidth="2.5" />}
      <path d="M54 81q22 10 42-3l-2 10q-19 8-41-1Z" fill="#f2bb4c" stroke="#ae7b31" strokeWidth="2" />
      <path d="m86 88 12 15 4-15-12-5" fill="#e7a73e" stroke="#ae7b31" strokeWidth="2" />
    </g>
    {mood === "celebrating" && <g className="cc-cricket-sparkles" fill="#f8cb55"><path d="m15 39 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" /><path d="m121 27 3 6 6 3-6 3-3 6-3-6-6-3 6-3Z" /></g>}
    {mood === "chirping" && <g className="cc-cricket-song" fill="none" stroke="#af9141" strokeWidth="3" strokeLinecap="round">
      <path d="M111 60q9 9 0 18m8-25q16 17 0 32m-98-24q-8 8 0 16" />
      <g fill="#d6a741" stroke="none"><path d="M117 16v17h3V22l11-3v-7Z" /><ellipse cx="114" cy="34" rx="6" ry="4" transform="rotate(-18 114 34)" /><ellipse cx="127" cy="29" rx="5" ry="4" transform="rotate(-18 127 29)" /></g>
    </g>}
  </svg>;
}

export function Spider({ laughing = false }: { laughing?: boolean }) {
  return <svg viewBox="0 0 100 100" className={`cc-spider-art ${laughing ? "cc-spider-art--laughing" : ""}`} role="img"
    aria-label={laughing ? "The cheeky spider is laughing" : "A cheeky spider on a wrong leaf"}>
    <path d="M50 0v34" stroke="#d1c8d7" strokeWidth="1.8" />
    <g className="cc-spider-body" stroke="#57436a" strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round">
      <g fill="none"><path d="m38 54-18-13-6 9m22 12-22-4-5 12m28-1-20 8-2 12m27-12L29 89l1 8" />
        <path d="m62 54 18-13 6 9m-22 12 22-4 5 12m-28-1 20 8 2 12m-27-12 13 12-1 8" /></g>
      <ellipse cx="50" cy="57" rx="23" ry="24" fill="#b99ccd" />
      <path d="M35 41q15-11 30 0" fill="#d5bde5" stroke="none" />
      {laughing ? <g fill="none" strokeWidth="2.7"><path d="m35 55 9-4-8-3m29 7-9-4 8-3" /></g>
        : <g><ellipse cx="40" cy="54" rx="7" ry="9" fill="#fff9f1" strokeWidth="1.7" /><ellipse cx="60" cy="54" rx="7" ry="9" fill="#fff9f1" strokeWidth="1.7" />
          <circle cx="42" cy="56" r="3.2" fill="#42384c" stroke="none" /><circle cx="58" cy="56" r="3.2" fill="#42384c" stroke="none" />
          <path d="m32 43 13 4m23-4-13 4" fill="none" strokeWidth="3" /></g>}
      {laughing ? <path d="M37 64q13 25 26 0Z" fill="#57436a" strokeWidth="2" /> : <path d="M40 68q10 10 20-2" fill="none" strokeWidth="2.5" />}
      <path d="m44 67 2 7 4-6m4 0 3 6 2-7" fill="#fffaf2" stroke="none" />
      <circle cx="32" cy="65" r="3" fill="#e1aac1" stroke="none" /><circle cx="68" cy="65" r="3" fill="#e1aac1" stroke="none" />
    </g>
  </svg>;
}

export function LeafArt() {
  return <svg viewBox="0 0 140 72" preserveAspectRatio="none" aria-hidden="true" className="cc-leaf-art">
    <path d="M5 41Q21-5 74 6q36 4 62-1-3 49-61 60Q30 75 5 41Z" fill="currentColor" stroke="var(--leaf-edge)" strokeWidth="3" />
    <path d="M15 44q54 3 111-31M44 42 40 24m26 10 4-18M68 35l15 12m17-29 5 13" stroke="var(--leaf-vein)" strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>;
}

export function GardenBackdrop() {
  return <div className="cc-backdrop" aria-hidden="true">
    <div className="cc-sun-moon"><span /><i /><b /></div>
    <svg className="cc-cloud cc-cloud--one" viewBox="0 0 190 70"><path d="M15 63C-7 38 15 20 41 27 43-5 92-7 104 24 134 6 154 26 153 37 183 25 203 62 176 65Z" fill="currentColor" /></svg>
    <svg className="cc-cloud cc-cloud--two" viewBox="0 0 190 70"><path d="M15 63C-7 38 15 20 41 27 43-5 92-7 104 24 134 6 154 26 153 37 183 25 203 62 176 65Z" fill="currentColor" /></svg>
    <div className="cc-hill cc-hill--back" /><div className="cc-hill cc-hill--front" />
    {Array.from({ length: 12 }, (_, i) => <i key={i} className="cc-firefly" style={{ left: `${7 + (i * 31) % 90}%`, top: `${15 + (i * 19) % 76}%`, animationDelay: `${i * -.8}s` }} />)}
    <svg className="cc-edge-plant cc-edge-plant--left" viewBox="0 0 100 300"><path d="M4 300Q70 149 21 0" fill="none" stroke="currentColor" strokeWidth="9" /><path d="M32 250Q-20 208 0 172q41 9 39 55m5-38q58-38 50-79-49-3-51 51m-4-57Q-6 81 0 47q38 0 36 41m-5-37q46-11 42-44-35 1-43 28" fill="currentColor" /></svg>
    <svg className="cc-edge-plant cc-edge-plant--right" viewBox="0 0 100 300"><path d="M4 300Q70 149 21 0" fill="none" stroke="currentColor" strokeWidth="9" /><path d="M32 250Q-20 208 0 172q41 9 39 55m5-38q58-38 50-79-49-3-51 51m-4-57Q-6 81 0 47q38 0 36 41m-5-37q46-11 42-44-35 1-43 28" fill="currentColor" /></svg>
  </div>;
}
