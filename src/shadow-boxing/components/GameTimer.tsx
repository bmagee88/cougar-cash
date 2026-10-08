import { LinearProgress, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { formatSeconds, nowMs } from "../engine/timing";

interface GameTimerProps {
  mode: "attack" | "defense" | "idle";
  startedAtMs?: number;
  deadlineMs?: number;
  limitMs?: number;
  attackTimeMs?: number;
}

export default function GameTimer({
  mode,
  startedAtMs,
  deadlineMs,
  limitMs,
  attackTimeMs,
}: GameTimerProps) {
  const [now, setNow] = useState(() => nowMs());

  useEffect(() => {
    if (mode === "idle") return undefined;

    const id = window.setInterval(() => setNow(nowMs()), 50);
    return () => window.clearInterval(id);
  }, [mode]);

  if (mode === "idle") {
    return null;
  }

  if (mode === "attack" && typeof startedAtMs === "number") {
    const elapsedMs =
      typeof attackTimeMs === "number" ? attackTimeMs : Math.max(0, now - startedAtMs);

    return (
      <Stack spacing={0.75} sx={{ minWidth: { xs: "100%", sm: 220 } }}>
        <Typography variant="caption" sx={{ fontWeight: 800, color: "#475569" }}>
          ATTACK TIME
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 900, color: "#0f172a" }}>
          {formatSeconds(elapsedMs)}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={100}
          sx={{
            height: 8,
            borderRadius: 2,
            bgcolor: "rgba(15,23,42,0.12)",
            "& .MuiLinearProgress-bar": { bgcolor: "#f97316" },
          }}
        />
      </Stack>
    );
  }

  if (
    mode === "defense" &&
    typeof deadlineMs === "number" &&
    typeof limitMs === "number"
  ) {
    const remainingMs = Math.max(0, deadlineMs - now);
    const value = Math.max(0, Math.min(100, (remainingMs / limitMs) * 100));
    const urgent = value <= 35;

    return (
      <Stack spacing={0.75} sx={{ minWidth: { xs: "100%", sm: 260 } }}>
        <Typography variant="caption" sx={{ fontWeight: 800, color: "#475569" }}>
          DEFENSE WINDOW
        </Typography>
        <Typography
          variant="h5"
          sx={{ fontWeight: 900, color: urgent ? "#be123c" : "#0f172a" }}
        >
          {formatSeconds(remainingMs)}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={value}
          sx={{
            height: 12,
            borderRadius: 2,
            bgcolor: "rgba(15,23,42,0.12)",
            "& .MuiLinearProgress-bar": {
              bgcolor: urgent ? "#e11d48" : "#0ea5e9",
              transition: "transform 80ms linear",
            },
            "@media (prefers-reduced-motion: reduce)": {
              "& .MuiLinearProgress-bar": { transition: "none" },
            },
          }}
        />
      </Stack>
    );
  }

  return null;
}

