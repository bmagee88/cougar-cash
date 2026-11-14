import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, LinearProgress } from "@mui/material";
import { submitTypingBossProgress } from "./api";
import { TypingBossCredentials } from "./types";

const EVENT = "typing-boss-local-progress";

// Per-key updates stay in this tab. The server receives only the latest cursor,
// at most once per 400 ms, with at most one request in flight.
export function usePublishAttackProgress(sessionId: string, credentials: TypingBossCredentials, active: boolean) {
  const actor = credentials.hostToken ? "boss" : credentials.code || "";
  const latest = useRef<{ wordIndex: number; characters: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sending = useRef(false);
  const lastSent = useRef(0);
  const live = useRef(active);
  const auth = useRef(credentials);
  auth.current = credentials;
  live.current = active;

  useEffect(() => () => {
    live.current = false;
    if (timer.current) clearTimeout(timer.current);
  }, []);
  useEffect(() => {
    live.current = active;
    if (!active) {
      latest.current = null;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    }
  }, [active]);

  const publish = useCallback((wordIndex: number, characters: number, progress: number, released: boolean) => {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { key: `${sessionId}:${actor}`, progress } }));
    if (released) {
      // Word submissions already broadcast attack release. Avoid a duplicate POST.
      latest.current = null;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      return;
    }
    latest.current = { wordIndex, characters };
    function schedule() {
      if (timer.current || sending.current || !live.current || !latest.current) return;
      timer.current = setTimeout(async () => {
        timer.current = null;
        if (!live.current || !latest.current) return;
        const cursor = latest.current;
        latest.current = null;
        sending.current = true;
        lastSent.current = Date.now();
        try { await submitTypingBossProgress(sessionId, auth.current, cursor.wordIndex, cursor.characters); }
        catch { /* Cosmetic progress catches up on the next update or reconnect. */ }
        finally { sending.current = false; schedule(); }
      }, Math.max(0, 400 - (Date.now() - lastSent.current)));
    }
    schedule();
  }, [actor, sessionId]);
  return publish;
}

export function AttackProgressBar({ sessionId, actor, progress = 0, label, compact = false, dense = false }: {
  sessionId: string; actor: string; progress?: number; label: string; compact?: boolean; dense?: boolean;
}) {
  const [local, setLocal] = useState<number | null>(null);
  useEffect(() => {
    setLocal(null);
    const update = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string; progress: number }>).detail;
      if (detail.key === `${sessionId}:${actor}`) setLocal(detail.progress);
    };
    window.addEventListener(EVENT, update);
    return () => window.removeEventListener(EVENT, update);
  }, [actor, sessionId]);
  return <Box sx={{ mb: dense ? .25 : .5 }} title={`${label}: ${Math.round(local ?? progress)}%`}>
    <LinearProgress aria-label={label} variant="determinate" value={Math.min(100, Math.max(0, local ?? progress))}
      sx={{ height: dense ? 2 : compact ? 4 : 7, borderRadius: 1, bgcolor: "#312e81", "& .MuiLinearProgress-bar": { bgcolor: "#c4b5fd", transition: local === null ? "transform 400ms linear" : "transform 100ms linear", "@media (prefers-reduced-motion: reduce)": { transition: "none" } } }} />
  </Box>;
}
