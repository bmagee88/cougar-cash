import { useEffect, useState } from "react";
import FetchProgressModal from "./FetchProgressModal";
import Bunny from "./creatures/Bunny";
import Grass from "./creatures/Grass";
import {
  AnyEntity,
  BunnyEntity,
  GrassEntity,
  deserializeEntities,
  serializeEntities,
  SerializedEntity,
  FoxEntity,
  WolfEntity,
} from "./entities/Entity";
import Fox from "./creatures/Fox";
import Wolf from "./creatures/Wolf";

const DEBUG = true; // flip to false to hide debug buttons
const MAX_ENTITIES = 1000;

type PersistShape = {
  currentZ: number;
  list: AnyEntity[]; // in-memory = class instances
};

type StorageShape = {
  currentZ: number;
  list: SerializedEntity[]; // on-disk = plain objects
};

const LS_KEY = "serene_bunnies_v2"; // bump key because schema now includes "kind"

function rowLiftFromZ(z: number) {
  const row = Math.floor(Math.log2(Math.max(1, z))) + 1;
  return Math.max(1, row); // at least 1
}

function loadPersist(): PersistShape {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { currentZ: 1, list: [] };

    const parsed = JSON.parse(raw) as StorageShape;
    if (
      !parsed ||
      typeof parsed.currentZ !== "number" ||
      !Array.isArray(parsed.list)
    ) {
      return { currentZ: 1, list: [] };
    }

    const trimmed =
      parsed.list.length > MAX_ENTITIES
        ? parsed.list.slice(-MAX_ENTITIES)
        : parsed.list;

    return { currentZ: parsed.currentZ, list: deserializeEntities(trimmed) };
  } catch {
    return { currentZ: 1, list: [] };
  }
}

function savePersist(p: PersistShape) {
  try {
    const out: StorageShape = {
      currentZ: p.currentZ,
      list:
        p.list.length > MAX_ENTITIES
          ? serializeEntities(p.list.slice(-MAX_ENTITIES))
          : serializeEntities(p.list),
    };
    localStorage.setItem(LS_KEY, JSON.stringify(out));
  } catch {}
}

export default function Demo() {
  const [show, setShow] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  const [{ currentZ, list }, setPersist] = useState<PersistShape>(() =>
    loadPersist()
  );
  const [bunnyKick, setBunnyKick] = useState(0);

  useEffect(() => {
    savePersist({ currentZ, list });
  }, [currentZ, list]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  /** Move *all* entities up 1px, FIFO trim to MAX_ENTITIES, then append new one */
  function bumpAllTrimThenAppend(newEnt: AnyEntity) {
    const bumped = list.map((e) => e.withPatch({ liftPx: e.liftPx + 1 }));
    const trimmed = bumped.length >= MAX_ENTITIES ? bumped.slice(1) : bumped;
    setPersist({ currentZ: newEnt.z, list: [...trimmed, newEnt] });
  }

  const addAliveBunny = () => {
    const newZ = (currentZ ?? 1) + 1;
    const lift = rowLiftFromZ(newZ);
    const bun = new BunnyEntity({
      id: Date.now() + Math.random(),
      dead: false,
      z: newZ,
      liftPx: lift,
    });
    bumpAllTrimThenAppend(bun);
  };

  const addGrass = () => {
    const newZ = (currentZ ?? 1) + 1;
    const lift = rowLiftFromZ(newZ);
    const g = new GrassEntity({
      id: Date.now() + Math.random(),
      dead: false,
      z: newZ,
      liftPx: lift,
    });
    bumpAllTrimThenAppend(g);
  };

  const addWolf = () => {
    const newZ = (currentZ ?? 1) + 1;
    const lift = rowLiftFromZ(newZ);
    const w = new WolfEntity({
      id: Date.now() + Math.random(),
      dead: false,
      z: newZ,
      liftPx: lift,
    });
    bumpAllTrimThenAppend(w);
  };

/** Returns true if something was killed */
function killRandomEntity(): boolean {
  const aliveIndices: number[] = [];
  list.forEach((e, i) => { if (!e.dead) aliveIndices.push(i); });
  if (aliveIndices.length === 0) return false;

  const pick = aliveIndices[Math.floor(Math.random() * aliveIndices.length)];
  const updated = [...list];
  updated[pick] = updated[pick].withPatch({ dead: true });
  setPersist({ currentZ, list: updated });
  return true;
}

/**
 * Random plan chooser:
 *  - Randomly select a plan (0=fox<-bunny, 1=wolf<-fox, 2=kill)
 *  - But ALWAYS try low-level replacement (fox<-bunny) first if applicable.
 *  - If that fails, try the chosen plan.
 *  - If that still fails, try the remaining ones in priority order:
 *      fox<-bunny, then wolf<-fox, then kill.
 */
function runRandomFailurePlan() {
  const plans = [
    () => replaceDeadBunnyWithFox(), // low-level
    () => replaceDeadFoxWithWolf(),  // higher-level
    () => killRandomEntity(),        // fallback
  ];

  const chosen = Math.floor(Math.random() * 3);

  // 1) Always attempt low-level first
  if (plans[0]()) return;

  // 2) Try the chosen plan (if not the same as low-level)
  if (chosen !== 0 && plans[chosen]()) return;

  // 3) Try remaining in priority order
  for (let i = 0; i < plans.length; i++) {
    if (i === 0 || i === chosen) continue;
    if (plans[i]()) return;
  }
}

  

function replaceDeadBunnyWithFox(): boolean {
  const deadBunnies: number[] = [];
  list.forEach((e, i) => {
    if (e instanceof BunnyEntity && e.dead) deadBunnies.push(i);
  });
  if (deadBunnies.length === 0) return false;

  const pick = deadBunnies[Math.floor(Math.random() * deadBunnies.length)];
  const b = list[pick] as BunnyEntity;

  const fox = new FoxEntity({
    id: Date.now() + Math.random(),
    dead: false,
    z: b.z,
    liftPx: b.liftPx,
  });

  const updated = [...list];
  updated.splice(pick, 1, fox);
  setPersist({ currentZ, list: updated });
  return true;
}

function replaceDeadFoxWithWolf(): boolean {
  const deadFoxes: number[] = [];
  list.forEach((e, i) => {
    if (e instanceof FoxEntity && e.dead) deadFoxes.push(i);
  });
  if (deadFoxes.length === 0) return false;

  const pick = deadFoxes[Math.floor(Math.random() * deadFoxes.length)];
  const f = list[pick] as FoxEntity;

  const wolf = new WolfEntity({
    id: Date.now() + Math.random(),
    dead: false,
    z: f.z,
    liftPx: f.liftPx,
  });

  const updated = [...list];
  updated.splice(pick, 1, wolf);
  setPersist({ currentZ, list: updated });
  return true;
}

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
            Begin
          </button>

          {DEBUG && (
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              <button
                className="primary"
                style={{ background: "linear-gradient(180deg, #888, #666)" }}
                onClick={addAliveBunny}
                title="Spawn Bunny (z-index + log lift)"
              >
                + Add Bunny (debug)
              </button>
              <button
                className="primary"
                style={{
                  background: "linear-gradient(180deg, #4e8c55, #2c6e36)",
                }}
                onClick={addGrass}
                title="Spawn Grass (z-index + log lift)"
              >
                + Add Grass (debug)
              </button>

              <button
                className="primary"
                style={{ background: "linear-gradient(180deg, #555, #333)" }}
                onClick={addWolf}
                title="Spawn Wolf"
              >
                + Add Wolf (debug)
              </button>
              <button
                className="primary"
                style={{
                  background: "linear-gradient(180deg, #9d2b2b, #7b1a1a)",
                }}
                onClick={killRandomEntity}
                title="Randomly mark one alive entity as dead"
              >
                ☠ Kill Random (debug)
              </button>
            </div>
          )}
        </main>

        {toast && (
          <div className={`toast ${toast.type}`}>
            {toast.type === "success" ? "✓" : "!"} {toast.msg}
          </div>
        )}
      </div>

      {/* Render all entities */}
      {list.map((e) =>
        e instanceof BunnyEntity ? (
          <Bunny
            key={e.id}
            active={!e.dead}
            dead={e.dead}
            kick={bunnyKick}
            z={e.z}
            liftPx={e.liftPx}
            stepMinVw={2.5}
            stepMaxVw={4.5}
          />
        ) : e instanceof GrassEntity ? (
          <Grass key={e.id} dead={e.dead} z={e.z} liftPx={e.liftPx} />
        ) : e instanceof FoxEntity ? (
          <Fox
            key={e.id}
            active={!e.dead}
            dead={e.dead}
            kick={bunnyKick}
            z={e.z}
            liftPx={e.liftPx}
            stepMinVw={6}
            stepMaxVw={12}
          />
        ) : e instanceof WolfEntity ? (
          <Wolf
            key={e.id}
            active={!e.dead}
            dead={e.dead}
            kick={bunnyKick}
            z={e.z}
            liftPx={e.liftPx}
            stepMinVw={4}
            stepMaxVw={8}
          />
        ) : null
      )}

      {show && (
        <FetchProgressModal
          title="Processing…"
          simulate
          modeSec={40}
          maxSec={500}
          onSuccess={() => {
            setShow(false);
            setToast({ type: "success", msg: "All set." });
            addAliveBunny();
            setBunnyKick((k) => k + 1);
          }}
          onError={() => {
            setShow(false);
            setToast({ type: "error", msg: "you made it back" });
              runRandomFailurePlan();
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
        --bg1:#eaf3ff; --bg2:#f6fff6; --bg3:#f5f0ff;
        --ink:#213047; --muted:#6e7f96;
        --card:rgba(255,255,255,0.72); --glass:rgba(255,255,255,0.35); --ring:rgba(33,48,71,0.08);
        --accent1:#5a86f5; --accent2:#4a78ea;
      }
      @keyframes gradientShift { 0%{background-position:0 50%} 50%{background-position:100% 50%} 100%{background-position:0 50%} }
      @keyframes drift { 0%{transform:translateY(0) scale(1)} 50%{transform:translateY(-14px) scale(1.03)} 100%{transform:translateY(0) scale(1)} }
      @keyframes toastIn { from{transform:translateY(8px);opacity:0} to{transform:translateY(0);opacity:1} }

      .serene-shell{ position:relative; min-height:100dvh; display:grid; place-items:center; overflow:hidden; color:var(--ink);
        background: linear-gradient(120deg, var(--bg1), var(--bg2), var(--bg3)); background-size:300% 300%; animation: gradientShift 18s ease-in-out infinite; }
      .orb{ position:absolute; border-radius:50%; filter: blur(64px); opacity:.55; pointer-events:none; z-index:1; animation: drift 22s ease-in-out infinite; }
      .orb-1{ width:56vmax; height:56vmax; top:-14vmax; left:-12vmax; background: radial-gradient(circle at 35% 35%, rgba(120,170,255,.65) 0%, rgba(120,170,255,0) 62%); }
      .orb-2{ width:60vmax; height:60vmax; bottom:-18vmax; right:-14vmax; background: radial-gradient(circle at 60% 60%, rgba(150,235,185,.60) 0%, rgba(150,235,185,0) 62%); animation-delay:-11s; }
      .card{ position:relative; z-index:2; width:min(720px,92vw); text-align:center; backdrop-filter: saturate(140%) blur(8px); -webkit-backdrop-filter: saturate(140%) blur(8px);
        background: var(--card); border-radius:20px; padding:28px 26px 22px; border:1px solid var(--ring);
        box-shadow:0 18px 55px rgba(33,48,71,0.10), inset 0 0 0 1px var(--glass); }
      .header h1{ margin:0 0 8px 0; font-size:28px; letter-spacing:.01em; font-weight:700; }
      .subtitle{ margin:0 0 16px 0; color:var(--muted); font-size:15px; line-height:1.55; }
      .primary{ appearance:none; border:none; cursor:pointer; background: linear-gradient(180deg, var(--accent1), var(--accent2));
        color:#fff; font-weight:600; letter-spacing:.02em; padding:12px 20px; border-radius:12px; box-shadow:0 10px 28px rgba(74,120,234,.25); transition: transform .12s, box-shadow .12s, filter .12s; }
      .primary:hover{ transform: translateY(-1px); box-shadow:0 12px 32px rgba(74,120,234,.28); filter: brightness(1.02); }
      .primary:active{ transform: translateY(0); filter: brightness(.98); }
      .toast{ position: fixed; bottom:18px; right:18px; padding:10px 14px; border-radius:12px; color:#fff; box-shadow:0 12px 30px rgba(0,0,0,.16); animation: toastIn .18s ease-out; user-select:none; z-index: 3; }
      .toast.success{ background: linear-gradient(180deg, #43a047, #2e7d32); }
      .toast.error{ background: linear-gradient(180deg, #43a047, #2e7d32); }
    `}</style>
  );
}
