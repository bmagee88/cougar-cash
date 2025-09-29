import React, { useEffect, useState } from "react";
import FetchProgressModal from "./FetchProgressModal";

export default function Demo() {
  const [show, setShow] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <>
      <SereneStyles />

      <div className="serene-shell">
        <div className="orb orb-1" />
        <div className="orb orb-2" />

        <main className="card">
          <header className="header">
            <h1>Take a breath.</h1>
            <p className="subtitle">
              This page will always be calm, no matter what happens.
            </p>
          </header>

          <button className="primary" onClick={() => setShow(true)}>
            Start
          </button>
        </main>

        {toast && (
          <div className={`toast ${toast.type}`}>
            {toast.type === "success" ? "✓" : "!"} {toast.msg}
          </div>
        )}
      </div>

      {show && (
  <FetchProgressModal
    title="Processing…"
    simulate
    modeSec={40}
    maxSec={500}
    timeoutMs={40000} // or your random timeout wiring
    onSuccess={() => {
      setShow(false);
      setToast({ type: "success", msg: "All set." });
    }}
    onError={() => {
      setShow(false);
      // green success style + message you requested:
      setToast({ type: "success", msg: "you made it back" });
    }}
  />
)}
    </>
  );
}

/* ——— serene palette & minimal UI ——— */
function SereneStyles() {
  return (
    <style>{`
      :root{
        /* serene palette */
        --bg1:#eaf3ff;   /* misty blue */
        --bg2:#f6fff6;   /* pale mint */
        --bg3:#f5f0ff;   /* soft lavender */
        --ink:#213047;   /* calm navy */
        --muted:#6e7f96; /* softened slate */
        --card:rgba(255,255,255,0.72);
        --glass:rgba(255,255,255,0.35);
        --ring:rgba(33,48,71,0.08);
        --accent1:#5a86f5;
        --accent2:#4a78ea;
      }

      /* NOTICEABLE background animation */
      @keyframes gradientShift {
        0%   { background-position:   0% 50%; }
        50%  { background-position: 100% 50%; }
        100% { background-position:   0% 50%; }
      }
      @keyframes drift {
        0%   { transform: translateY(0px)   scale(1); }
        50%  { transform: translateY(-14px) scale(1.03); }
        100% { transform: translateY(0px)   scale(1); }
      }
      @keyframes toastIn {
        from { transform: translateY(8px); opacity: 0; }
        to   { transform: translateY(0);   opacity: 1; }
      }

      .serene-shell{
        position:relative;
        min-height:100dvh;
        display:grid;
        place-items:center;
        overflow:hidden;
        color:var(--ink);

        /* animated gradient */
        background: linear-gradient(120deg, var(--bg1), var(--bg2), var(--bg3));
        background-size: 300% 300%;
        animation: gradientShift 18s ease-in-out infinite;
        will-change: background-position;
      }

      /* ORBS — clearer, above bg, below card */
      .orb{
        position:absolute;
        border-radius:50%;
        filter: blur(64px);
        opacity:0.55;
        pointer-events:none;
        z-index:1;              /* ensure they are visible */
        animation: drift 22s ease-in-out infinite;
        will-change: transform;
      }
      .orb-1{
        width:56vmax; height:56vmax;
        top:-14vmax; left:-12vmax;
        background: radial-gradient(circle at 35% 35%,
                    rgba(120,170,255,0.65) 0%,
                    rgba(120,170,255,0.00) 62%);
      }
      .orb-2{
        width:60vmax; height:60vmax;
        bottom:-18vmax; right:-14vmax;
        background: radial-gradient(circle at 60% 60%,
                    rgba(150,235,185,0.60) 0%,
                    rgba(150,235,185,0.00) 62%);
        animation-delay: -11s;
      }

      .card{
        position:relative;
        z-index:2;              /* sits above orbs */
        width:min(720px, 92vw);
        text-align: center;

        backdrop-filter: saturate(140%) blur(8px);
        -webkit-backdrop-filter: saturate(140%) blur(8px);
        background: var(--card);
        border-radius: 20px;
        padding: 28px 26px 22px;
        border: 1px solid var(--ring);
        box-shadow:
          0 18px 55px rgba(33,48,71,0.10),
          inset 0 0 0 1px var(--glass);
      }

      .header h1{
        margin: 0 0 8px 0;
        font-size: 28px;
        letter-spacing: 0.01em;
        font-weight: 700;
      }
      .subtitle{
        margin: 0 0 16px 0;
        color: var(--muted);
        font-size: 15px;
        line-height: 1.55;
      }

      .primary{
        appearance:none; border:none; cursor:pointer;
        background: linear-gradient(180deg, var(--accent1), var(--accent2));
        color:#fff; font-weight:600; letter-spacing:0.02em;
        padding: 12px 20px; border-radius: 12px;
        box-shadow: 0 10px 28px rgba(74,120,234,0.25);
        transition: transform .12s ease, box-shadow .12s ease, filter .12s ease;
      }
      .primary:hover{
        transform: translateY(-1px);
        box-shadow: 0 12px 32px rgba(74,120,234,0.28);
        filter: brightness(1.02);
      }
      .primary:active{
        transform: translateY(0);
        filter: brightness(0.98);
      }

      .toast{
        position: fixed; bottom: 18px; right: 18px;
        padding: 10px 14px; border-radius: 12px; color:#fff;
        box-shadow: 0 12px 30px rgba(0,0,0,0.16);
        animation: toastIn .18s ease-out;
        user-select:none;
        z-index: 3;
      }
      .toast.success{ background: linear-gradient(180deg, #43a047, #2e7d32); }
      .toast.error{ background: linear-gradient(180deg, #ef5350, #c62828); }
    `}</style>
  );
}

