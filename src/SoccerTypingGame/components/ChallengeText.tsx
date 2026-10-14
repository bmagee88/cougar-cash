import React from "react";
import { Box } from "@mui/material";
import { TypingChallenge } from "../engine/types";

export default function ChallengeText({ challenge, compact = false }: { challenge: TypingChallenge; compact?: boolean }) {
  return (
    <Box aria-label="Typing challenge" sx={{
      display: "flex", flexWrap: "wrap", justifyContent: "center", gap: compact ? 0 : 0.25,
      p: compact ? 0.5 : 1, maxWidth: "100%", boxSizing: "border-box", borderRadius: 1,
      bgcolor: "rgba(6,24,22,0.95)", border: "1px solid rgba(255,255,255,0.4)",
    }}>
      {challenge.phrase.split("").map((char, index) => {
        const typed = challenge.typed[index];
        const correct = typed !== undefined && typed === char;
        const incorrect = typed !== undefined && typed !== char;
        const active = index === challenge.typed.length;
        return <Box component="span" key={index} sx={{
          flex: "0 0 auto", width: compact ? { xs: 8, sm: 12 } : 14, height: compact ? 22 : 28,
          display: "grid", placeItems: "center", fontFamily: "monospace", fontWeight: 900,
          fontSize: compact ? { xs: 12, sm: 18 } : 20, lineHeight: 1,
          color: correct ? "#052e16" : incorrect ? "#450a0a" : "#ffffff",
          bgcolor: correct ? "#86efac" : incorrect ? "#fca5a5" : active ? "#79551b" : "transparent",
          borderBottom: active ? "2px solid #facc15" : "2px solid transparent",
        }}>{char === " " ? "\u00b7" : char}</Box>;
      })}
    </Box>
  );
}
