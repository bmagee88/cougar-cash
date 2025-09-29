import React, { useEffect, useRef, useState } from "react";

type Props<T = unknown> = {
  action?: () => Promise<T>;
  onSuccess?: (value: T) => void;
  onError?: (err: unknown) => void;
  title?: string;

  // If you want a fixed timeout for now, pass timeoutMs. (Randomization can be wired elsewhere.)
  timeoutMs?: number;

  hoverHint?: string;

  // Progress normalization / simulation
  plannedDurationMs?: number;
  simulate?: boolean;
  modeSec?: number; // default 40 (most likely duration)
  medianSec?: number; // deprecated alias
  maxSec?: number; // default 500
};

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/* ====== Sinister Anxiety Styles + dynamic blackout fade ====== */
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

      /* speeds you can tweak per state below */
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

    /* OVERLAY — sinister backdrop (stripes + scanlines + vignette + red wash) */
    .anx-overlay {
      position: fixed; inset: 0;
      display: grid; place-items: center;
      z-index: 9999;
      overflow: hidden;

      background:
        /* diagonal red stripes */
        repeating-linear-gradient(
          -45deg,
          rgba(255, 59, 48, 0.10) 0px,
          rgba(255, 59, 48, 0.10) 12px,
          rgba(0,0,0,0.0) 12px,
          rgba(0,0,0,0.0) 24px
        ),
        /* horizontal scanlines */
        repeating-linear-gradient(
          0deg,
          rgba(255,255,255,.03) 0 1px,
          rgba(0,0,0,0) 1px 3px
        ),
        /* subtle red wash */
        radial-gradient(
          100% 110% at 70% 30%,
          rgba(255, 50, 50, .08) 0%,
          rgba(255, 50, 50, 0) 60%
        ),
        /* dark vignette */
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

    /* moving scan bar */
    .anx-overlay::before {
      content: "";
      position: absolute; inset: -25% 0 -25% 0;
      background: linear-gradient(180deg, transparent 0%, rgba(255,80,80,.12) 50%, transparent 100%);
      mix-blend-mode: screen;
      animation: scanSweep var(--scanSpeed) linear infinite;
      pointer-events: none;
    }

    /* subtle grain */
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

    /* escalate intensity with level */
    .anx-overlay.warn {
      --stripeSpeed: .7s;
      --scanSpeed: 3.1s;
    }
    .anx-overlay.panic {
      --stripeSpeed: .55s;
      --scanSpeed: 2.4s;
    }

    /* CARD */
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

    /* 10-block bar + states */
    .bar-grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 8px; margin-top: 10px; }
    .bar-cell { height: 22px; border-radius: 6px; border: 1px solid #3a3f46; background: transparent; }
    .bar-cell.filled { background: linear-gradient(180deg, #29b765 0%, #1e8f4f 100%); border-color: rgba(255,255,255,0.06); animation: glowPulse 1.2s ease-in-out infinite; }
    .bar-cell.red { background: linear-gradient(180deg, #e53935 0%, #b52320 100%); border-color: rgba(255,255,255,0.06); animation: redPulse 0.8s ease-in-out infinite, shake 320ms ease-in-out; }

    .readout { margin-top: 10px; display: flex; justify-content: space-between; align-items: center; font-variant-numeric: tabular-nums; font-size: 14px; }
    .readout .timer { padding: 4px 8px; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); }
    .readout .percent { font-weight: 700; letter-spacing: 0.02em; }
    .readout.warn .timer, .readout.warn .percent { color: var(--anx-amber); }
    .readout.panic .timer, .readout.panic .percent { color: var(--anx-red); }

    /* BLACKOUT layer (fade timing set inline) */
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

/* ====== Progress pacing ====== */
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

/* ====== Helpers ====== */
function lastGreenIndex(pct: number) {
  const full = Math.floor(pct / 10);
  return Math.max(0, Math.min(9, full - 1)); // current last green
}

/* ====== 10-block bar (supports freezing fill after red) ====== */
function TenBlockBar({
  percent,
  flashRedIndex,
  maxFullBlocks,
}: {
  percent: number;
  flashRedIndex?: number | null;
  maxFullBlocks?: number | null;
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

/* ====== Blocking Modal (now renders sinister orbs) ====== */
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

export default function FetchProgressModal<T = unknown>({
  action,
  onSuccess,
  onError,
  title = "Do not close this window",
  timeoutMs = 40000,
  hoverHint,
  plannedDurationMs,
  simulate,
  modeSec,
  medianSec,
  maxSec = 500,
}: Props<T>) {
  const [visible, setVisible] = useState(true);
  const [percent, setPercent] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [flashRedIndex, setFlashRedIndex] = useState<number | null>(null);
  const [plannedMs, setPlannedMs] = useState<number | undefined>(undefined);

  // per-run modulated warn/panic thresholds (fractions of timeout) in log-space
  const [warnFrac, setWarnFrac] = useState(0.7);
  const [panicFrac, setPanicFrac] = useState(0.9);

  // Effective timeout (ms). If you randomize elsewhere, just pass that value into timeoutMs.
  const [effectiveTimeoutMs, setEffectiveTimeoutMs] =
    useState<number>(timeoutMs);

  // Freeze/blackout state
  const [maxFullBlocks, setMaxFullBlocks] = useState<number | null>(null);
  const [blackout, setBlackout] = useState(false);
  const [fadeMs, setFadeMs] = useState(3500); // randomized on failure/timeout: 3.5s..10s
  const [blackHoldMs, setBlackHoldMs] = useState(3000);

  // Refs
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

    const mode = modeSec ?? medianSec ?? 40;

    // Planned success duration (log-triangular around mode/max)
    const minSec = Math.max(0.5, (mode * mode) / maxSec);
    const a = Math.log(minSec),
      b = Math.log(maxSec),
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

    // Pre-pick the visual timings so we can show them in the tooltip
    const sampledFade = Math.round(3500 + Math.random() * (10000 - 3500)); // 3.5–10s
    const sampledHold = Math.round(3000 + Math.random() * (10000 - 3000)); // 3–10s
    setFadeMs(sampledFade);
    setBlackHoldMs(sampledHold);

    setPlannedMs(selPlannedMs);
    setEffectiveTimeoutMs(timeoutMs);

    // Modulate warn/panic in log-space with same proportion (panic/warn ~ 0.9/0.7)
    const r = 0.9 / 0.7;
    const lnBase =
      Math.log(0.6) + Math.random() * (Math.log(0.8) - Math.log(0.6)); // ~[0.6, 0.8]
    const wf = Math.exp(lnBase);
    const pf = Math.min(0.96, wf * r);
    setWarnFrac(wf);
    setPanicFrac(pf);

    // Simulate if no action
    const shouldSimulate = simulate ?? !action;
    const runAction: () => Promise<T | void> = shouldSimulate
      ? async () => {
          await new Promise((r) => setTimeout(r, selPlannedMs));
          return;
        }
      : (action as () => Promise<T>);

    // RAF loop
    startRef.current = performance.now();
    const tick = () => {
      if (cancelled) return;
      const now = performance.now();
      const elapsedSec = (now - (startRef.current ?? now)) / 1000;
      setElapsed(elapsedSec);

      if (maxFullBlocks != null) {
        // frozen after red
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

    // Timeout handler — last filled green -> red, freeze; fade to black for random 3.5–10s, then close
    timeoutRef.current = window.setTimeout(() => {
      timedOutRef.current = true;

      const idx = lastGreenIndex(percentRef.current);
      setFlashRedIndex(idx);
      setMaxFullBlocks(Math.floor(percentRef.current / 10)); // freeze current greens

      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;

      // Timeout handler (inside setTimeout(...)):
      const fade = sampledFade;
      const hold = sampledHold;
      setBlackout(true);
      window.setTimeout(() => {
        cleanup();
        onError?.(new Error("timeout"));
      }, fade + hold);
    }, timeoutMs /* or timeoutMs, whichever you're using */);

    // Run (or simulate) the async action
    (async () => {
      try {
        const result = await runAction();
        if (cancelled || timedOutRef.current) return;

        setPercent(100);
        percentRef.current = 100;
        setTimeout(() => {
          cleanup();
          onSuccess?.(result as T);
        }, 200);
      } catch (err) {
        if (cancelled || timedOutRef.current) return;

        const idx = lastGreenIndex(percentRef.current);
        setFlashRedIndex(idx);
        setMaxFullBlocks(Math.floor(percentRef.current / 10)); // freeze

        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;

        const fade = sampledFade;
        const hold = sampledHold;
        setBlackout(true);
        window.setTimeout(() => {
          cleanup();
          onError?.(err);
        }, fade + hold);
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    action,
    simulate,
    plannedDurationMs,
    timeoutMs,
    modeSec,
    medianSec,
    maxSec,
    onError,
    onSuccess,
  ]);

  if (!visible) return null;

  // Dynamic stress level for UI state using per-run warn/panic thresholds
  const stress = clamp(elapsed / ((effectiveTimeoutMs || 1) / 1000), 0, 1);
  const level: "calm" | "warn" | "panic" =
    stress >= panicFrac ? "panic" : stress >= warnFrac ? "warn" : "calm";

  const minutes = Math.floor(elapsed / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(elapsed % 60)
    .toString()
    .padStart(2, "0");

  // NEW: include yellow/red thresholds in the tooltip
  const warnPct = Math.round(warnFrac * 100);
  const panicPct = Math.round(panicFrac * 100);

  const computedHint =
    hoverHint ??
    (plannedMs
      ? `Planned: ${(plannedMs / 1000).toFixed(1)}s • Timeout: ${(
          effectiveTimeoutMs / 1000
        ).toFixed(1)}s • Yellow ~${warnPct}% • Red ~${panicPct}% • Fade ${(
          fadeMs / 1000
        ).toFixed(1)}s • Black hold ${(blackHoldMs / 1000).toFixed(1)}s`
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

      {/* Fade-to-black layer: transition duration set inline per-run */}
      <div
        className={`blackout ${blackout ? "active" : ""}`}
        style={{ transition: `opacity ${fadeMs}ms ease` }} // fade duration
      />
    </>
  );
}
