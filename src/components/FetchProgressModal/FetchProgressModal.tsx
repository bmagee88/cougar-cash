import React, { useEffect, useRef, useState } from "react";

type Props<T = unknown> = {
  action?: () => Promise<T>;
  onSuccess?: (value: T) => void;
  onError?: (err: unknown) => void;
  title?: string;

  /** If true, pick a random timeout via bell curve; otherwise use timeoutMs. */
  timeoutRandom?: boolean;
  timeoutMs?: number;                 // fallback when timeoutRandom = false
  timeoutMedianSec?: number;          // default 40
  timeoutMinSec?: number;             // default 3.5
  timeoutMaxSec?: number;             // default 500

  /** Optional tooltip override near the elapsed timer. */
  hoverHint?: string;

  /** If provided, force a specific planned duration (ms); otherwise sampled. */
  plannedDurationMs?: number;

  /** Simulate the fetch (default: true if no action is provided). */
  simulate?: boolean;

  /** Progress duration distribution (for simulated action). */
  modeSec?: number;    // default 40 (most likely duration in seconds)
  medianSec?: number;  // deprecated alias for modeSec
  maxSec?: number;     // default 500 (seconds)
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Logarithmic pacing constants shaping visual progress feel. */
const K = 30 / Math.log(4);
const A = (Math.exp(60 / K) - Math.exp(50 / K)) / 5;

function logRawPercent(secondsElapsed: number): number {
  return K * Math.log(1 + A * Math.max(0, secondsElapsed));
}
function normalizedPercent(secondsElapsed: number, plannedMs?: number): number {
  const raw = logRawPercent(secondsElapsed);
  if (!plannedMs || plannedMs <= 0) return Math.min(raw, 99);
  const T = plannedMs / 1000;
  const rawAtT = logRawPercent(T);
  if (rawAtT <= 0) return Math.min(raw, 99);
  const scaled = (raw / rawAtT) * 100;
  return secondsElapsed >= T ? 100 : Math.min(scaled, 99);
}

/** Standard normal via Box–Muller. */
function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Timeout ~ truncated log-normal: bell-shaped in log-space with median around 40, bounds near 3.5–500. */
function sampleTimeoutSecLogNormal(
  medianSec = 40,
  minSec = 3.5,
  maxSec = 500,
  sigmaK = 3
): number {
  const mu = Math.log(medianSec);
  const sigLeft = (mu - Math.log(minSec)) / sigmaK;
  const sigRight = (Math.log(maxSec) - mu) / sigmaK;
  const sigma = (sigLeft + sigRight) / 2;

  for (let i = 0; i < 8; i++) {
    const z = randn();
    const x = Math.exp(mu + sigma * z);
    if (x >= minSec && x <= maxSec) return x;
  }
  const z = randn();
  const x = Math.exp(mu + sigma * z);
  return clamp(x, minSec, maxSec);
}

/** Progress duration ~ symmetric log-triangular around mode (most likely), capped at maxSec. */
function sampleProgressMs(modeSec = 40, maxSec = 500): number {
  const minSec = Math.max(0.5, (modeSec * modeSec) / maxSec);
  const a = Math.log(minSec);
  const b = Math.log(maxSec);
  const c = (a + b) / 2;
  const u = Math.random();
  const Fc = 0.5; // symmetric
  let x: number;
  if (u < Fc) x = a + Math.sqrt(u * (b - a) * (c - a));
  else x = b - Math.sqrt((1 - u) * (b - a) * (b - c));
  return Math.exp(x) * 1000;
}

/** Remap timeout across 40 based on success/fail sides (applies in seconds). */
function remapTimeoutAcross40(failSec: number, successSec: number, minSec: number, maxSec: number) {
  const s = successSec - 40;
  const f = failSec - 40;
  if (s === 0 || f === 0 || s * f > 0) {
    // same side or exactly 40: no change
    return clamp(failSec, minSec, maxSec);
  }
  const diff = Math.abs(f);
  // Move fail to the same side as success, preserving distance from 40
  const newFail = 40 + Math.sign(s) * diff;
  return clamp(newFail, minSec, maxSec);
}

/** Block all interaction / ESC. */
function BlockingModal(props: { children: React.ReactNode; title?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("keydown", onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={props.title || "Loading"}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "grid",
        placeItems: "center",
        zIndex: 9999,
      }}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <div
        style={{
          width: "min(560px, 90vw)",
          background: "#fff",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      >
        {props.title && <h2 style={{ marginTop: 0 }}>{props.title}</h2>}
        {props.children}
      </div>
    </div>
  );
}

/** 10-square progress bar; can flash a specific square red. */
function TenBlockBar({ percent, flashRedIndex }: { percent: number; flashRedIndex?: number | null }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 8 }}>
      {Array.from({ length: 10 }).map((_, i) => {
        const isFilled = i < Math.floor(percent / 10);
        const isRed = flashRedIndex === i;
        const bg = isRed ? "#e53935" : isFilled ? "#2e7d32" : "transparent";
        const border = (isFilled || isRed) ? "1px solid rgba(0,0,0,0.1)" : "1px solid #bdbdbd";
        return (
          <div
            key={i}
            style={{ height: 22, borderRadius: 6, background: bg, border, transition: "background-color 180ms ease" }}
          />
        );
      })}
    </div>
  );
}

function lastGreenIndex(pct: number) {
  const full = Math.floor(pct / 10);
  return Math.max(0, Math.min(9, full - 1)); // current last green
}

export default function FetchProgressModal<T = unknown>({
  action,
  onSuccess,
  onError,
  title = "Processing…",

  timeoutRandom = false,
  timeoutMs = 40000,
  timeoutMedianSec = 40,
  timeoutMinSec = 3.5,
  timeoutMaxSec = 500,

  hoverHint,
  plannedDurationMs,
  simulate,
  modeSec,
  medianSec, // deprecated alias
  maxSec = 500,
}: Props<T>) {
  const [visible, setVisible] = useState(true);
  const [percent, setPercent] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [flashRedIndex, setFlashRedIndex] = useState<number | null>(null);
  const [plannedMs, setPlannedMs] = useState<number | undefined>(undefined);
  const [effectiveTimeoutMs, setEffectiveTimeoutMs] = useState<number>(timeoutMs);

  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const closedRef = useRef(false);
  const percentRef = useRef(0);
  const timedOutRef = useRef(false);

  const cleanup = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  useEffect(() => {
    let cancelled = false;

    // Choose mode for progress duration (back-compat: medianSec)
    const mode = modeSec ?? medianSec ?? 40;

    // Decide progress planned duration once
    const selPlannedMs =
      plannedDurationMs && plannedDurationMs > 0
        ? plannedDurationMs
        : sampleProgressMs(mode, maxSec);
    setPlannedMs(selPlannedMs);

    // Pick timeout (fixed or random bell), then apply your “mirror across 40” rule if they’re on opposite sides.
    const pickedTimeoutMs = timeoutRandom
      ? Math.round(sampleTimeoutSecLogNormal(timeoutMedianSec, timeoutMinSec, timeoutMaxSec) * 1000)
      : timeoutMs;

    const successSec = selPlannedMs / 1000;
    const initialFailSec = pickedTimeoutMs / 1000;
    const adjustedFailSec = remapTimeoutAcross40(initialFailSec, successSec, timeoutMinSec, timeoutMaxSec);
    const pickedEffectiveTimeoutMs = Math.round(adjustedFailSec * 1000);
    setEffectiveTimeoutMs(pickedEffectiveTimeoutMs);

    // Decide whether to simulate
    const shouldSimulate = simulate ?? !action;
    const runAction: () => Promise<T | void> = shouldSimulate
      ? async () => { await new Promise(r => setTimeout(r, selPlannedMs)); return; }
      : (action as () => Promise<T>);

    // Animation loop
    startRef.current = performance.now();
    const tick = () => {
      if (cancelled) return;
      const now = performance.now();
      const elapsedSec = (now - (startRef.current ?? now)) / 1000;
      setElapsed(elapsedSec);
      setPercent(prev => {
        const next = Math.max(prev, normalizedPercent(elapsedSec, selPlannedMs));
        percentRef.current = next;
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    // Timeout handler — flash the current last green block red, then close + alert after 2s
    timeoutRef.current = window.setTimeout(() => {
      timedOutRef.current = true;
      const idx = lastGreenIndex(percentRef.current);
      setFlashRedIndex(idx);
      window.setTimeout(() => {
        cleanup();
        alert(`Request timed out after ${Math.round(pickedEffectiveTimeoutMs / 1000)} seconds.`);
        onError?.(new Error("timeout"));
      }, 2000);
    }, pickedEffectiveTimeoutMs);

    // Run (or simulate) the async action
    (async () => {
      try {
        const result = await runAction();
        if (cancelled || timedOutRef.current) return;
        setPercent(100);
        percentRef.current = 100;
        setTimeout(() => { cleanup(); onSuccess?.(result as T); }, 200);
      } catch (err) {
        if (cancelled || timedOutRef.current) return;
        const idx = lastGreenIndex(percentRef.current);
        setFlashRedIndex(idx);
        window.setTimeout(() => { cleanup(); alert("Request failed."); onError?.(err); }, 2000);
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, [
    action,
    simulate,
    plannedDurationMs,
    modeSec,
    medianSec,
    maxSec,
    timeoutRandom,
    timeoutMs,
    timeoutMedianSec,
    timeoutMinSec,
    timeoutMaxSec,
    onError,
    onSuccess,
  ]);

  if (!visible) return null;

  const minutes = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const seconds = Math.floor(elapsed % 60).toString().padStart(2, "0");

  const minProgressSec = (modeSec ?? medianSec ?? 40) ** 2 / (maxSec || 500);
  const computedHint =
    hoverHint ??
    (plannedMs
      ? `Planned: ${(plannedMs / 1000).toFixed(1)}s • Timeout: ${(effectiveTimeoutMs / 1000).toFixed(1)}s (range ~${minProgressSec.toFixed(1)}–${(maxSec || 500).toFixed(0)}s)`
      : undefined);

  return (
    <BlockingModal title={title}>
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ fontSize: 14, color: "#616161" }}>Please wait while we complete your request.</div>
        <TenBlockBar percent={percent} flashRedIndex={flashRedIndex} />
        <div style={{ display: "flex", justifyContent: "space-between", fontVariantNumeric: "tabular-nums", fontSize: 14 }}>
          <span title={computedHint}>⏱ {minutes}:{seconds}</span>
          <span>{Math.floor(percent)}%</span>
        </div>
      </div>
    </BlockingModal>
  );
}
