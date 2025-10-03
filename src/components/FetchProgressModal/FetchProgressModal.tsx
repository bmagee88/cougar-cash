import React, { useEffect, useRef, useState } from "react";
import { computeRating } from "./entities/math";

type Props<T = unknown> = {
  action?: () => Promise<T>;
  onSuccess?: (value: T) => void;
  onError?: (err: unknown) => void;
  title?: string;

  /** Progress simulation */
  simulate?: boolean; // if no action is provided, simulate using planned duration
  plannedDurationMs?: number; // if provided, progress reaches 100% at this time
  modeSec?: number; // most-likely duration (used for sampling when not provided); default 40
  medianSec?: number; // deprecated alias for modeSec
  maxSec?: number; // long tail cap for sampling; default 500

  /** Timeout modulation (per-run) */
  timeoutRandom?: boolean; // enable random per-run timeout (bell curve in log-space). Default: true
  timeoutMedianSec?: number; // default 40
  timeoutMinSec?: number; // default 3.5
  timeoutMaxSec?: number; // default 500
  timeoutMs?: number; // used only if timeoutRandom === false

  /** Tooltip override (else we compose one) */
  hoverHint?: string;
};

/* --------------------------------------------------------- */
/* Calibrated log curve: ~5s from 50→60, ~20s from 80→90     */
/* --------------------------------------------------------- */
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
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

/* --------------------------------------------------------- */
/* Timeout modulation helpers (bell curve in log-space)      */
/* --------------------------------------------------------- */
function randn() {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function sampleTimeoutSecLogNormal(
  medianSec = 40,
  minSec = 3.5,
  maxSec = 500,
  sigmaK = 3
) {
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

/** Mirror the failure timeout across 40s to be on the same side as success */
function remapTimeoutAcross40(
  failSec: number,
  successSec: number,
  minSec: number,
  maxSec: number
) {
  const s = successSec - 40;
  const f = failSec - 40;
  if (s === 0 || f === 0 || s * f > 0) return clamp(failSec, minSec, maxSec);
  const diff = Math.abs(f);
  const newFail = 40 + Math.sign(s) * diff;
  return clamp(newFail, minSec, maxSec);
}

/* --------------------------------------------------------- */
/* UI Bits: sinister overlay + 10-block bar                  */
/* --------------------------------------------------------- */
const AnxietyStyles = () => (
  <style>{`
    :root {
      --anx-bg: rgba(0,0,0,0.60);
      --anx-card: #0f1014;
      --anx-border: #ff3b30;
      --anx-border-warn: #ff9800;
      --anx-border-calm: #2a2d33;
      --anx-text: #eaeef5;
      --anx-muted: #97a2b3;
      --anx-green: #29c46f;
      --anx-red: #e53935;
      --anx-amber: #ffc107;

      --stripeSpeed: .9s;
      --flickerSpeed: 2.6s;
      --scanSpeed: 3.6s;
    }

    @keyframes bgStripes { 0%{background-position:0 0} 100%{background-position:80px 0} }
    @keyframes flicker { 0%,100%{opacity:1} 92%{opacity:.95} 95%{opacity:.82} 98%{opacity:.9} }
    @keyframes jitter { 0%{transform:translate(0,0) rotate(0)} 30%{transform:translate(-.3px,.4px) rotate(-.06deg)} 60%{transform:translate(.4px,-.3px) rotate(.06deg)} 100%{transform:translate(0,0) rotate(0)} }
    @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-2px)} 40%{transform:translateX(2px)} 60%{transform:translateX(-1px)} 80%{transform:translateX(1px)} }
    @keyframes glowPulse { 0%{box-shadow:0 0 0 rgba(46,204,113,0)} 50%{box-shadow:0 0 12px rgba(46,204,113,.5)} 100%{box-shadow:0 0 0 rgba(46,204,113,0)} }
    @keyframes redPulse { 0%{box-shadow:0 0 0 rgba(229,57,53,0)} 50%{box-shadow:0 0 14px rgba(229,57,53,.6)} 100%{box-shadow:0 0 0 rgba(229,57,53,0)} }
    @keyframes textGlitch { 0%{text-shadow:1px 0 #ff3b30,-1px 0 #00e1ff} 50%{text-shadow:0 1px #ff3b30,0 -1px #00e1ff} 100%{text-shadow:-1px 0 #ff3b30,1px 0 #00e1ff} }
    @keyframes scanSweep { 0%{transform:translateY(-110%)} 100%{transform:translateY(110%)} }

    .anx-overlay {
      position: fixed; inset: 0;
      display: grid; place-items: center;
      z-index: 9999;
      overflow: hidden;

      background:
        repeating-linear-gradient(
          -45deg,
          rgba(255, 59, 48, 0.10) 0px,
          rgba(255, 59, 48, 0.10) 12px,
          rgba(0,0,0,0.0) 12px,
          rgba(0,0,0,0.0) 24px
        ),
        repeating-linear-gradient(
          0deg,
          rgba(255,255,255,.03) 0 1px,
          rgba(0,0,0,0) 1px 3px
        ),
        radial-gradient(
          100% 110% at 70% 30%,
          rgba(255, 50, 50, .08) 0%,
          rgba(255, 50, 50, 0) 60%
        ),
        radial-gradient(
          120% 120% at 50% 50%,
          rgba(0,0,0,0) 40%,
          rgba(0,0,0,.35) 62%,
          rgba(0,0,0,.78) 100%
        ),
        var(--anx-bg);

      animation-name: bgStripes, flicker;
      animation-timing-function: linear, linear;
      animation-iteration-count: infinite, infinite;
      animation-duration: var(--stripeSpeed), var(--flickerSpeed);
    }
    .anx-overlay::before {
      content: "";
      position: absolute; inset: -25% 0 -25% 0;
      background: linear-gradient(180deg, transparent 0%, rgba(255,80,80,.12) 50%, transparent 100%);
      mix-blend-mode: screen;
      animation: scanSweep var(--scanSpeed) linear infinite;
      pointer-events: none;
    }
    .anx-overlay::after {
      content: "";
      position: absolute; inset: 0;
      pointer-events: none;
      background:
        repeating-linear-gradient(0deg, rgba(255,255,255,.018) 0 1px, transparent 1px 2px),
        repeating-linear-gradient(90deg, rgba(255,255,255,.01) 0 1px, transparent 1px 3px);
      opacity: .6;
      animation: flicker 2.8s linear infinite;
    }
    .anx-overlay.warn { --stripeSpeed: .7s;  --scanSpeed: 3.1s; }
    .anx-overlay.panic { --stripeSpeed: .55s; --scanSpeed: 2.4s; }

    .anx-card {
      position: relative;
      z-index: 1;
      width: min(640px, 92vw);
      background: var(--anx-card);
      color: var(--anx-text);
      border-radius: 18px;
      padding: 24px 22px 18px;
      border: 2px solid var(--anx-border-calm);
      box-shadow: 0 20px 50px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.02);
      user-select: none;
      transition: border-color 160ms ease, box-shadow 160ms ease, transform 120ms ease;
    }
    .anx-card.warn { border-color: var(--anx-border-warn); }
    .anx-card.panic { border-color: var(--anx-border); animation: jitter 280ms infinite; }

    .anx-title {
      margin: 0 0 6px 0;
      font-size: 14px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--anx-amber);
      display: flex; align-items: center; gap: 8px;
      animation: textGlitch 1.6s infinite;
    }
    .anx-subtle { color: var(--anx-muted); font-size: 13px; margin-bottom: 14px; }

    .bar-grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 8px; margin-top: 10px; }
    .bar-cell { height: 22px; border-radius: 6px; border: 1px solid #3a3f46; background: transparent; }
    .bar-cell.filled { background: linear-gradient(180deg, #29b765 0%, #1e8f4f 100%); border-color: rgba(255,255,255,0.06); animation: glowPulse 1.2s ease-in-out infinite; }
    .bar-cell.red { background: linear-gradient(180deg, #e53935 0%, #b52320 100%); border-color: rgba(255,255,255,0.06); animation: redPulse 0.8s ease-in-out infinite, shake 320ms ease-in-out; }

    .readout { margin-top: 10px; display: flex; justify-content: space-between; align-items: center; font-variant-numeric: tabular-nums; font-size: 14px; }
    .readout .timer { padding: 4px 8px; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); }
    .readout .percent { font-weight: 700; letter-spacing: 0.02em; }
    .readout.warn .timer, .readout.warn .percent { color: var(--anx-amber); }
    .readout.panic .timer, .readout.panic .percent { color: var(--anx-red); }

    .blackout {
      position: fixed; inset: 0;
      background: #000;
      opacity: 0;
      z-index: 10000;
      pointer-events: none;
    }
    .blackout.active { opacity: 1; }
  `}</style>
);

function BlockingModal(props: {
  children: React.ReactNode;
  title?: string;
  level: "calm" | "warn" | "panic";
}) {
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
      className={`anx-overlay ${props.level}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div
        className={`anx-card ${props.level}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {props.title && <h2 className="anx-title">⚠ {props.title}</h2>}
        {props.children}
      </div>
    </div>
  );
}

function TenBlockBar({
  percent,
  flashRedIndex,
  maxFullBlocks,
}: {
  percent: number;
  flashRedIndex?: number | null;
  maxFullBlocks?: number | null; // freeze cap after red
}) {
  const currentFull = Math.floor(percent / 10);
  const fullBlocks =
    maxFullBlocks != null ? Math.min(currentFull, maxFullBlocks) : currentFull;

  return (
    <div className="bar-grid">
      {Array.from({ length: 10 }).map((_, i) => {
        const isFilled = i < fullBlocks;
        const isRed = flashRedIndex === i;
        const cls = `bar-cell ${isRed ? "red" : isFilled ? "filled" : ""}`;
        return <div key={i} className={cls} />;
      })}
    </div>
  );
}

function lastGreenIndex(pct: number) {
  const full = Math.floor(pct / 10);
  return Math.max(0, Math.min(9, full - 1)); // current last green
}

/* --------------------------------------------------------- */
/* Main Component                                            */
/* --------------------------------------------------------- */
export default function FetchProgressModal<T = unknown>({
  action,
  onSuccess,
  onError,
  title = "Do not close this window",

  simulate,
  plannedDurationMs,
  modeSec,
  medianSec,
  maxSec = 500,

  timeoutRandom = true,
  timeoutMedianSec = 40,
  timeoutMinSec = 3.5,
  timeoutMaxSec = 500,
  timeoutMs,

  hoverHint,
}: Props<T>) {
  const [visible, setVisible] = useState(true);
  const [percent, setPercent] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [flashRedIndex, setFlashRedIndex] = useState<number | null>(null);
  const [plannedMs, setPlannedMs] = useState<number | undefined>(undefined);

  const [warnFrac, setWarnFrac] = useState(0.7);
  const [panicFrac, setPanicFrac] = useState(0.9);

  const [effectiveTimeoutMs, setEffectiveTimeoutMs] = useState<number>(
    timeoutMs ?? 40000
  );

  const [maxFullBlocks, setMaxFullBlocks] = useState<number | null>(null);
  const [blackout, setBlackout] = useState(false);
  const [fadeMs, setFadeMs] = useState(3500);
  const [blackHoldMs, setBlackHoldMs] = useState(3000);

  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const closedRef = useRef(false);
  const percentRef = useRef(0);
  const timedOutRef = useRef(false);

const { rating, multiplier } = React.useMemo(() => {return computeRating(Math.floor(plannedMs/1000), Math.floor(effectiveTimeoutMs/1000))}, [plannedMs, effectiveTimeoutMs]);

  const cleanup = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  useEffect(() => {
    let cancelled = false;

    const mode = modeSec ?? medianSec ?? 40;

    // Planned success duration: sample in log-space (triangular-like) if not provided
    const minSec = Math.max(0.5, (mode * mode) / (maxSec || 500));
    const a = Math.log(minSec),
      b = Math.log(maxSec || 500),
      c = (a + b) / 2;
    const u = Math.random();
    const x =
      u < 0.5
        ? a + Math.sqrt(u * (b - a) * (c - a))
        : b - Math.sqrt((1 - u) * (b - a) * (b - c));
    const selPlannedMs =
      plannedDurationMs && plannedDurationMs > 0
        ? plannedDurationMs
        : Math.exp(x) * 1000;
    setPlannedMs(selPlannedMs);

    // Pre-sample visual timings for tooltip and for failure use
    const sampledFade = Math.round(3500 + Math.random() * (10000 - 3500)); // 3.5–10s
    const sampledHold = Math.round(3000 + Math.random() * (10000 - 3000)); // 3–10s
    setFadeMs(sampledFade);
    setBlackHoldMs(sampledHold);

    // Per-run warn/panic thresholds (fractions of total time)
    const minWarn = 0.1;
    const maxWarn = 0.9;

    // Yellow anywhere from 10% to 90%
    const wf = minWarn + Math.random() * (maxWarn - minWarn);

    // Midpoint between yellow and 100%
    const m = 0.5 * (wf + 1.0);

    // 25% variation toward yellow (down) and toward 100% (up)
    const down = 0.25 * (m - wf); // e.g., 6.25% when wf=50%
    const up = 0.25 * (1.0 - m); // e.g., 6.25% when wf=50%

    // Red chosen uniformly inside [m - down, m + up]
    const pf = m - down + Math.random() * (down + up);

    setWarnFrac(wf);
    setPanicFrac(pf);

    // Compute effective timeout (randomized + mirrored), keep a local copy for this run
    const pickedTimeoutMs = timeoutRandom
      ? Math.round(
          sampleTimeoutSecLogNormal(
            timeoutMedianSec,
            timeoutMinSec,
            timeoutMaxSec
          ) * 1000
        )
      : timeoutMs ?? 40000;

    const successSec = selPlannedMs / 1000;
    const adjustedFailSec = remapTimeoutAcross40(
      pickedTimeoutMs / 1000,
      successSec,
      timeoutMinSec,
      timeoutMaxSec
    );
    const pickedEffectiveTimeoutMs = Math.round(adjustedFailSec * 1000);
    setEffectiveTimeoutMs(pickedEffectiveTimeoutMs);

    // Decide whether to simulate
    const shouldSimulate = simulate ?? !action;
    const runAction: () => Promise<T | void> = shouldSimulate
      ? async () => {
          await new Promise((r) => setTimeout(r, selPlannedMs));
          return;
        }
      : (action as () => Promise<T>);

    // RAF: drive elapsed + percent (freeze after red)
    startRef.current = performance.now();
    const tick = () => {
      if (cancelled) return;
      const now = performance.now();
      const elapsedSec = (now - (startRef.current ?? now)) / 1000;
      setElapsed(elapsedSec);

      if (maxFullBlocks != null) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      setPercent((prev) => {
        const next = Math.max(
          prev,
          normalizedPercent(elapsedSec, selPlannedMs)
        );
        percentRef.current = next;
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    // Timeout path: last green -> red, freeze, fade-to-black, hold, then cleanup
    timeoutRef.current = window.setTimeout(() => {
      timedOutRef.current = true;

      const idx = lastGreenIndex(percentRef.current);
      setFlashRedIndex(idx);
      setMaxFullBlocks(Math.floor(percentRef.current / 10));

      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;

      setBlackout(true);
      window.setTimeout(() => {
        cleanup();
        onError?.(new Error("timeout"));
      }, sampledFade + sampledHold);
    }, pickedEffectiveTimeoutMs);

    // Run (or simulate) the async action
    (async () => {
      try {
        const result = await runAction();
        if (cancelled || timedOutRef.current) return;

        if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
        setPercent(100);
        percentRef.current = 100;

        setTimeout(() => {
          cleanup();
          onSuccess?.(result as T);
        }, 200);
      } catch (err) {
        if (cancelled || timedOutRef.current) return;

        if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);

        const idx = lastGreenIndex(percentRef.current);
        setFlashRedIndex(idx);
        setMaxFullBlocks(Math.floor(percentRef.current / 10));

        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;

        setBlackout(true);
        window.setTimeout(() => {
          cleanup();
          onError?.(err);
        }, sampledFade + sampledHold);
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
    timeoutMedianSec,
    timeoutMinSec,
    timeoutMaxSec,
    timeoutMs,
    onError,
    onSuccess,
    maxFullBlocks,
  ]);

  if (!visible) return null;

  // Stress level → UI level, using per-run warn/panic fractions
  const stress = clamp(elapsed / ((effectiveTimeoutMs || 1) / 1000), 0, 1);
  const level: "calm" | "warn" | "panic" =
    stress >= panicFrac ? "panic" : stress >= warnFrac ? "warn" : "calm";

  // Tooltip
  const minutes = Math.floor(elapsed / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(elapsed % 60)
    .toString()
    .padStart(2, "0");
  const warnPct = Math.round(warnFrac * 100);
  const panicPct = Math.round(panicFrac * 100);

  const computedHint =
    hoverHint ??
    (plannedMs
      ? `Planned: ${(plannedMs / 1000).toFixed(1)}s • Timeout: ${(
          effectiveTimeoutMs / 1000
        ).toFixed(1)}s • Yellow ~${warnPct}% • Red ~${panicPct}% • Fade ${(
          fadeMs / 1000
        ).toFixed(1)}s • Black hold ${(blackHoldMs / 1000).toFixed(
          1
        )}s • Rating ${rating.toLocaleString()} (×${multiplier.toFixed(2)})`
      : undefined);

  return (
    <>
      <AnxietyStyles />
      <BlockingModal title={title} level={level}>
        <div className="anx-subtle">
          System is processing your request. This may take a moment…
        </div>
        <TenBlockBar
          percent={percent}
          flashRedIndex={flashRedIndex}
          maxFullBlocks={maxFullBlocks}
        />
        <div className={`readout ${level}`}>
          <span className="timer" title={computedHint}>
            ⏱ {minutes}:{seconds}
          </span>
          <span className="percent">{Math.floor(percent)}%</span>
        </div>
      </BlockingModal>

      {/* Fade-to-black layer: transition uses per-run fadeMs; cleanup happens after fade+hold */}
      <div
        className={`blackout ${blackout ? "active" : ""}`}
        style={{ transition: `opacity ${fadeMs}ms ease` }}
      />
    </>
  );
}
