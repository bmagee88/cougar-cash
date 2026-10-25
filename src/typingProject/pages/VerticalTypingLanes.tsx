import React, { useEffect, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import { keyframes } from "@emotion/react";
import { VERTICAL_COLUMNS, VERTICAL_ROW_POSITIONS, VerticalHomeKey } from "./verticalMode";

type Size = { xs: number; sm: number; md: number };
type Props = {
  homeKey: VerticalHomeKey;
  homeKeys: { key: string; label: string; color: string }[];
  columns: { xs: string; sm: string; md: string };
  getColumn: (key: string) => string;
  notes: { id: number; key: string; rowIndex?: number; animationDelayMs: number }[];
  running: boolean;
  showKeyLetters: boolean;
  targetSize: Size;
  noteWidth: Size;
  noteHeight: Size;
  durationMs: number;
  travelMs: number;
  pulse: { key?: string; token: number } | null;
};

const slide = keyframes`
  0% { opacity: 0; transform: translate3d(calc(-50% + var(--note-start-x)), -50%, 0); }
  8% { opacity: 1; }
  100% { opacity: 1; transform: translate3d(calc(-50% + var(--note-end-x)), -50%, 0); }
`;
const pulse = keyframes`
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  40% { transform: translate(-50%, -50%) scale(1.18); box-shadow: 0 0 28px currentColor; }
`;

export default function VerticalTypingLanes(props: Props) {
  const { homeKey, homeKeys, columns, getColumn, notes, running, showKeyLetters, targetSize, noteWidth, noteHeight, durationMs, travelMs } = props;
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [startX, setStartX] = useState(1000);
  const column = VERTICAL_COLUMNS[homeKey];
  const entrySide = column.hand === "left" ? "right" : "left";
  const selectedKey = homeKeys.find((key) => key.key === homeKey)!;
  const endX = -startX * (durationMs - travelMs) / travelMs;

  useEffect(() => {
    const measure = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const center = rect.left + rect.width / 2;
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      setStartX(entrySide === "right" ? viewportWidth - center + 60 : -center - 60);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (fieldRef.current) observer.observe(fieldRef.current);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [entrySide, homeKey]);

  return (
    <Box ref={fieldRef} aria-label="Vertical game lanes" data-entry-side={entrySide} sx={{
      position: "absolute", inset: 0, display: "grid", gridTemplateColumns: columns,
      columnGap: "inherit", pointerEvents: "none",
    }}>
      <Box sx={{ gridColumn: getColumn(homeKey), gridRow: 1, bgcolor: `${selectedKey.color}0c`, borderLeft: `1px solid ${selectedKey.color}22`, borderRight: `1px solid ${selectedKey.color}22` }} />
      {VERTICAL_ROW_POSITIONS.map((top, row) => (
        <Box key={top} aria-hidden sx={{ position: "absolute", top: `${top}%`, left: "calc(50% - 50vw)", width: "100vw", height: "1px", bgcolor: row === 1 ? "#ffffff33" : "#ffffff12" }} />
      ))}
      {homeKeys.filter((key) => key.key !== " " && key.key !== homeKey).map((key) => (
        <Box key={key.key} aria-hidden sx={{
          position: "absolute", gridColumn: getColumn(key.key), left: "50%", top: "74%", transform: "translate(-50%, -50%)",
          width: targetSize, height: targetSize, display: "grid", placeItems: "center", borderRadius: 1,
          border: "2px solid #ffffff12", color: "#ffffff1f", fontSize: { xs: 12, sm: 15 }, fontWeight: 900,
        }}>{showKeyLetters ? key.label : ""}</Box>
      ))}
      {column.keys.map((key, row) => (
        <Box key={`${key}-${props.pulse?.key === key ? props.pulse.token : "idle"}`}
          ref={row === 1 ? anchorRef : undefined}
          role="img" aria-label={`${key.toUpperCase()} hit target`} data-testid="vertical-hit-target" data-key={key}
          sx={{ position: "absolute", gridColumn: getColumn(homeKey), left: "50%", top: `${VERTICAL_ROW_POSITIONS[row]}%`,
            transform: "translate(-50%, -50%)", width: targetSize, height: targetSize, display: "grid", placeItems: "center",
            border: `3px solid ${selectedKey.color}`, borderRadius: 1, bgcolor: "#07110f", color: selectedKey.color, zIndex: 3,
            boxShadow: `0 0 20px ${selectedKey.color}55`, animation: props.pulse?.key === key ? `${pulse} 260ms ease-out` : "none",
          }}>
          {showKeyLetters && <Typography component="span" sx={{ fontSize: { xs: 13, sm: 16, md: 18 }, fontWeight: 900, color: "inherit" }}>{key.toUpperCase()}</Typography>}
        </Box>
      ))}
      {notes.map((note) => (
        <Box key={note.id} data-testid="vertical-note" data-key={note.key} data-entry-side={entrySide} sx={{
          "--note-start-x": `${startX}px`, "--note-end-x": `${endX}px`,
          position: "absolute", gridColumn: getColumn(homeKey), left: "50%", top: `${VERTICAL_ROW_POSITIONS[note.rowIndex ?? 1]}%`,
          width: noteWidth, height: noteHeight, borderRadius: 1, bgcolor: selectedKey.color, zIndex: 2,
          transform: `translate3d(calc(-50% + ${startX}px), -50%, 0)`, willChange: "transform, opacity",
          animation: `${slide} ${durationMs}ms linear ${note.animationDelayMs}ms both`, animationPlayState: running ? "running" : "paused",
        }} />
      ))}
    </Box>
  );
}
