import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { DictionaryEntry, normalize, Relation, VocabularyGraph, WebSnapshot, WordEdge } from "./graph";
import { lookupWord, rememberEntries } from "./dictionary";
import { STARTER_ENTRIES } from "./starterEntries";
import { cameraForFocus, Point, worldEdgePath } from "./layout";
import { isStopWord } from "./stopWords";
import { wordVariants } from "./wordForms";
import "./WordWeb.css";

const STORAGE_KEY = "rabbit-hole-web-v1";
const relationNames: Record<Relation, string> = { definition: "Definition", synonym: "Synonym", antonym: "Antonym" };

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    back: <path d="m10 5-7 7 7 7M3 12h18" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    fit: <><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /><circle cx="12" cy="12" r="3" /></>,
    minimize: <><path d="M3 8h5V3m13 5h-5V3M3 16h5v5m13-5h-5v5" /><path d="m3 3 5 5m13-5-5 5M3 21l5-5m13 5-5-5" /></>,
    restore: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16" /></>,
    branch: <><path d="m6 5 6 7m0 0 7-6m-7 6v7" /><circle cx="5" cy="4" r="2" /><circle cx="20" cy="5" r="2" /><circle cx="12" cy="20" r="2" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.5-2.5 2-2.5 3.5m0 3v.1" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.arrow}</svg>;
}

function initialGraph(): VocabularyGraph {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const graph = VocabularyGraph.restore(JSON.parse(saved));
      rememberEntries(graph.snapshot().nodes.map(node => node.entry));
      return graph;
    }
  } catch { /* A damaged or unavailable browser store must not prevent a new trail. */ }
  return new VocabularyGraph(STARTER_ENTRIES[0]);
}

function ClickableDefinition({ text, current, busy, limited, blocked, onExplore }: {
  text: string; current: DictionaryEntry; busy: boolean; limited: boolean; blocked: (word: string) => boolean; onExplore: (word: string, kind: Relation) => void;
}) {
  const currentForms = new Set(wordVariants(current));
  return <>{text.split(/([a-zA-Z]+(?:['’-][a-zA-Z]+)*)/g).map((part, index) =>
    /^[a-zA-Z]/.test(part) && !isStopWord(part)
      ? <button key={index} type="button" className="rh-definition-word" disabled={busy || currentForms.has(normalize(part)) || blocked(part)}
        title={blocked(part) ? limited ? "Trail limit reached. Backtrack to continue." : "Already on your trail. Select its blue word or breadcrumb to backtrack." : undefined}
        aria-label={`Explore ${part}`} onClick={() => onExplore(part, "definition")}>{part}</button>
      : <React.Fragment key={index}>{part}</React.Fragment>
  )}</>;
}

function NewWebDialog({ busy, error, hasTrail, onClose, onStart }: {
  busy: boolean; error: string; hasTrail: boolean; onClose: () => void; onStart: (word: string) => void;
}) {
  const [word, setWord] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const submit = (event: FormEvent) => { event.preventDefault(); if (word.trim() && !busy) onStart(word); };
  return <dialog ref={dialog} className="rh-dialog" aria-labelledby="rh-new-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <button className="rh-icon-button rh-dialog-close" aria-label="Close new web" onClick={onClose} disabled={busy}><Icon name="close" /></button>
    <span className="rh-eyebrow">EVERY RABBIT HOLE STARTS SOMEWHERE</span>
    <h2 id="rh-new-title">Pick your first word.</h2>
    <p>A small beginning. A thousand possible directions.</p>
    <form onSubmit={submit}>
      <label htmlFor="rh-seed">Starting word</label>
      <div className="rh-seed-input"><input id="rh-seed" autoFocus value={word} onChange={event => setWord(event.target.value)} placeholder="e.g. serendipity" maxLength={100} required disabled={busy} autoComplete="off" /><button className="rh-primary-button" type="submit" disabled={busy || !word.trim()}>{busy ? "Looking up…" : "Begin"}<Icon name="arrow" size={16} /></button></div>
      <div className="rh-seed-suggestions"><span>Try</span>{["curiosity", "wonder", "serendipity"].map(seed => <button key={seed} type="button" onClick={() => setWord(seed)} disabled={busy}>{seed}</button>)}</div>
      {error && <p className="rh-error" role="alert">{error}</p>}
      {hasTrail && <p className="rh-replace-note">Starting a new web replaces the one saved on this device. You can export your current web first.</p>}
    </form>
  </dialog>;
}

function HelpDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="rh-dialog rh-help-dialog" aria-labelledby="rh-help-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <button className="rh-icon-button rh-dialog-close" aria-label="Close help" onClick={onClose}><Icon name="close" /></button>
    <span className="rh-eyebrow">FOLLOW YOUR CURIOSITY</span>
    <h2 id="rh-help-title">One word leads to another.</h2>
    <ol><li><b>Follow a word.</b> Click an underlined vocabulary word in the definition, or a synonym or antonym, to grow your web. Common stop words stay plain text.</li><li><b>Discover the connections.</b> New words automatically link to existing words whose definitions or relationships match.</li><li><b>Walk your web.</b> Follow connections to words outside your current trail. Click any canvas word once to highlight its connections and neighboring words in orange. Click that same word again to follow an available connection, or to backtrack if it is blue. Earlier words in the scrollable trail return there with one click; Back removes one step. Connections that would loop into the trail stay locked. A word from an earlier branch becomes available again once it is off your trail.</li><li><b>Leave a trail.</b> Your active path glows blue. Purple dashed connections would repeat a trail word and cannot be followed. Backtracking removes later steps and their glow. Faded lines are discovered connections; walked connections are thin, bright white lines.</li></ol>
    <p>Black lines connect definitions; green lines connect synonyms; red lines connect antonyms. Your web saves automatically in this browser.</p>
    <p>Establish the first branch of a new web freely. After your first backtrack, new discoveries and forward connections stop when your trail reaches the longest discovery branch. Select an earlier trail word to continue. New web always starts an independent web and reuses cached dictionary entries.</p>
    <button className="rh-primary-button" onClick={onClose}>Let’s wander<Icon name="arrow" size={16} /></button>
  </dialog>;
}

export default function WordWeb() {
  const graphRef = useRef<VocabularyGraph | null>(null);
  const previousGraph = graphRef.current as { snapshot: () => WebSnapshot } | null;
  if (!previousGraph) graphRef.current = initialGraph();
  else if (!(previousGraph instanceof VocabularyGraph)) graphRef.current = VocabularyGraph.restore(previousGraph.snapshot());
  const [web, setWeb] = useState<WebSnapshot>(() => graphRef.current!.snapshot());
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [failedLookup, setFailedLookup] = useState<{ word: string; kind: Relation } | null>(null);
  const [modal, setModal] = useState<"new" | "help" | null>(null);
  const [newError, setNewError] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);
  const [zoom, setZoom] = useState(0.85);
  const [cardMinimized, setCardMinimized] = useState(false);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [meaningCount, setMeaningCount] = useState(1);
  const [expandedRelations, setExpandedRelations] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 1200, height: 720 });
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointer: number; start: Point; origin: Point; moved: boolean } | null>(null);
  const suppressPanClick = useRef(false);
  const busyRef = useRef(false);
  const requestId = useRef(0);
  const cardTitle = useRef<HTMLHeadingElement>(null);
  const breadcrumbs = useRef<HTMLDivElement>(null);
  const previousFocus = useRef(web.focus);
  const focused = web.nodes.find(node => node.id === web.focus)!;
  const walked = web.edges.filter(edge => edge.traversed).length;
  const deepest = graphRef.current!.longestDiscoveryPath();
  const atTrailLimit = graphRef.current!.atTrailLimit();
  const incident = useMemo(() => web.edges.filter(edge => edge.from === web.focus || edge.to === web.focus), [web]);
  const neighbors = useMemo(() => new Set(incident.map(edge => edge.from === web.focus ? edge.to : edge.from)), [incident, web.focus]);
  const previousWord = web.walk.length > 1 ? web.walk[web.walk.length - 2] : null;
  const trailWords = useMemo(() => new Set(web.walk), [web.walk]);
  const trailEdges = useMemo(() => new Set(web.trailEdges || []), [web.trailEdges]);
  const onTrail = (word: string) => graphRef.current!.isOnTrail(word);
  const blocked = (word: string) => atTrailLimit || onTrail(word);
  const camera = useMemo(() => cameraForFocus(web, stageSize, zoom, pan), [web, stageSize, zoom, pan]);
  const worldNodes = useMemo(() => new Map(web.nodes.map(node => [node.id, node])), [web.nodes]);
  const { connectionCounts, wordNeighbors } = useMemo(() => {
    const counts = new Map<string, number>();
    const adjacent = new Map<string, Set<string>>();
    web.edges.forEach(edge => {
      counts.set(edge.from, (counts.get(edge.from) || 0) + 1);
      counts.set(edge.to, (counts.get(edge.to) || 0) + 1);
      if (!adjacent.has(edge.from)) adjacent.set(edge.from, new Set());
      if (!adjacent.has(edge.to)) adjacent.set(edge.to, new Set());
      adjacent.get(edge.from)!.add(edge.to); adjacent.get(edge.to)!.add(edge.from);
    });
    return { connectionCounts: counts, wordNeighbors: adjacent };
  }, [web.edges]);
  const selectedNeighbors = selectedWord ? wordNeighbors.get(selectedWord) : undefined;

  useEffect(() => {
    const snapshot = graphRef.current!.snapshot();
    rememberEntries(snapshot.nodes.map(node => node.entry));
    setWeb(snapshot);
  }, []);

  useEffect(() => {
    if (!focused.entry.needsLookup || busyRef.current) return;
    const graph = graphRef.current!;
    const request = ++requestId.current;
    busyRef.current = true; setPending(web.focus);
    lookupWord(web.focus).then(entry => {
      if (request === requestId.current && graph === graphRef.current) setWeb(graph.refreshEntry(entry));
    }).catch(cause => {
      if (request === requestId.current) setError((cause as Error).message);
    }).finally(() => {
      if (request === requestId.current) { setPending(""); busyRef.current = false; }
    });
  }, [web.focus, focused.entry.needsLookup]);

  useEffect(() => {
    const oldTitle = document.title;
    document.title = "Rabbit Hole · A web of words";
    return () => { document.title = oldTitle; requestId.current += 1; };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(web)); setSaveFailed(false); }
    catch { setSaveFailed(true); }
    if (breadcrumbs.current) breadcrumbs.current.scrollLeft = breadcrumbs.current.scrollWidth;
  }, [web]);

  useEffect(() => {
    setMeaningCount(1);
    setExpandedRelations(false);
    if (previousFocus.current !== web.focus) cardTitle.current?.focus({ preventScroll: true });
    previousFocus.current = web.focus;
  }, [web.focus]);

  useEffect(() => {
    if (!stage.current) return;
    const update = () => {
      const bounds = stage.current!.getBoundingClientRect();
      if (bounds.width && bounds.height) setStageSize({ width: bounds.width, height: bounds.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);

  const stopPan = () => {
    const gesture = drag.current;
    drag.current = null;
    setDragging(false);
    if (!gesture) return;
    if (gesture.moved) suppressPanClick.current = true;
    if (stage.current?.hasPointerCapture?.(gesture.pointer)) stage.current.releasePointerCapture(gesture.pointer);
  };

  const revealWord = () => {
    stopPan(); setPan({ x: 0, y: 0 }); setCardMinimized(false); setSelectedWord(null);
  };

  const beginPan = (event: React.PointerEvent<HTMLDivElement>) => {
    suppressPanClick.current = false;
    if (!cardMinimized || event.button !== 0 || event.isPrimary === false || drag.current) return;
    drag.current = { pointer: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin: pan, moved: false };
  };

  const movePan = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = drag.current;
    if (!gesture || gesture.pointer !== event.pointerId) return;
    if (event.pointerType !== "touch" && event.buttons === 0) { stopPan(); return; }
    const dx = event.clientX - gesture.start.x, dy = event.clientY - gesture.start.y;
    if (!gesture.moved && Math.hypot(dx, dy) < 5) return;
    if (!gesture.moved) {
      gesture.moved = true; setDragging(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    event.preventDefault();
    setPan({ x: gesture.origin.x + dx / zoom, y: gesture.origin.y + dy / zoom });
  };

  const endPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointer === event.pointerId) stopPan();
  };

  const explore = async (word: string, kind: Relation) => {
    if (busyRef.current || isStopWord(word)) return;
    try { graphRef.current!.assertCanExplore(word); }
    catch (cause) { setError((cause as Error).message); setFailedLookup(null); return; }
    busyRef.current = true;
    const request = ++requestId.current;
    setError(""); setFailedLookup(null); setPending(word);
    try {
      const existing = graphRef.current!.getEntry(word);
      const entry = existing && !existing.needsLookup ? existing : await lookupWord(word);
      if (request !== requestId.current) return;
      const next = graphRef.current!.explore(entry, kind, word);
      revealWord(); setWeb(next);
    } catch (cause) {
      if (request === requestId.current) {
        setError(cause instanceof Error ? cause.message : "That word could not be loaded. Try again.");
        setFailedLookup({ word, kind });
      }
    } finally {
      if (request === requestId.current) { setPending(""); busyRef.current = false; }
    }
  };

  const traverse = (word: string, kind?: Relation) => {
    if (busyRef.current || !neighbors.has(word) || blocked(word)) return;
    try { const next = graphRef.current!.traverse(word, kind); revealWord(); setWeb(next); setError(""); setFailedLookup(null); }
    catch (cause) { setError((cause as Error).message); }
  };

  const backtrack = (word?: string) => {
    if (busyRef.current) return;
    const next = graphRef.current!.backtrack(word);
    revealWord(); setWeb(next); setError(""); setFailedLookup(null);
  };

  const inspectWord = (word: string, kind?: Relation) => {
    if (busyRef.current) return;
    if (selectedWord !== word) { setSelectedWord(word); return; }
    if (onTrail(word) && word !== web.focus) backtrack(word);
    else traverse(word, kind);
  };

  const startWeb = async (word: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    const request = ++requestId.current;
    setNewError(""); setPending(word);
    try {
      const entry = await lookupWord(word);
      if (request !== requestId.current) return;
      graphRef.current = new VocabularyGraph(entry);
      revealWord();
      setWeb(graphRef.current.snapshot()); setModal(null); setError(""); setFailedLookup(null); setZoom(0.85);
    } catch (cause) {
      if (request === requestId.current) setNewError((cause as Error).message);
    } finally {
      if (request === requestId.current) { setPending(""); busyRef.current = false; }
    }
  };

  const fitWeb = () => {
    stopPan(); setPan({ x: 0, y: 0 });
    const maxX = Math.max(340, ...web.nodes.map(node => Math.abs(node.x - focused.x) + 85));
    const maxY = Math.max(250, ...web.nodes.map(node => Math.abs(node.y - focused.y) + 70));
    setZoom(Math.max(0.12, Math.min(1, (stageSize.width - 60) / (maxX * 2), (stageSize.height - 70) / (maxY * 2))));
  };

  const exportWeb = () => {
    const blob = new Blob([JSON.stringify(web, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `rabbit-hole-${web.root}.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importWeb = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || busyRef.current) return;
    try {
      const restored = VocabularyGraph.restore(JSON.parse(await file.text()));
      rememberEntries(restored.snapshot().nodes.map(node => node.entry));
      graphRef.current = restored; revealWord(); setWeb(restored.snapshot()); setError(""); setFailedLookup(null);
    } catch { setError("That file is not a valid Rabbit Hole web. Your current web is unchanged."); }
    event.target.value = "";
  };

  const edgePath = (edge: WordEdge) => worldEdgePath(edge, worldNodes.get(edge.from)!, worldNodes.get(edge.to)!);
  const relationCount = focused.entry.synonyms.length + focused.entry.antonyms.length;

  return <main className="rh-app">
    <header className="rh-header">
      <div className="rh-brand"><span className="rh-brand-mark"><Icon name="branch" size={26} /></span><div><span className="rh-brand-name">rabbit hole<span className="rh-brand-period">.</span></span><span className="rh-brand-tagline">A WEB OF WORDS</span></div></div>
      <div className="rh-header-center"><span className="rh-live-dot" />Follow a word. Find a world.</div>
      <div className="rh-header-actions"><button className="rh-new-button" disabled={!!pending} onClick={() => { setModal("new"); setNewError(""); }}><Icon name="plus" size={17} />New web</button></div>
    </header>

    <section className="rh-workspace" aria-label="Vocabulary explorer">
      <div className="rh-intro"><span className="rh-eyebrow">YOUR CURIOSITY, CONNECTED</span><h1>Go down the rabbit hole.</h1><p>Every definition is a doorway. See where a word takes you.</p></div>
      <div className="rh-stats" aria-label="Web statistics">
        <div><strong>{web.nodes.length.toString().padStart(2, "0")}</strong><span>words discovered</span></div>
        <div className="rh-walked-stat" title="Unique connections walked out of all discovered connections. Walking one again does not count twice.">
          <strong>{walked}<span className="rh-stat-total"> / {web.edges.length}</span></strong>
          <span>connections walked</span>
        </div>
        <div><strong>{deepest.toString().padStart(2, "0")}</strong><span>levels deep</span></div>
      </div>

      <div ref={stage} className={`rh-stage${cardMinimized ? " is-pannable" : ""}${dragging ? " is-dragging" : ""}`} aria-label="Word connection web"
        tabIndex={cardMinimized ? 0 : undefined} aria-describedby={cardMinimized ? "rh-pan-help" : undefined}
        onPointerDown={beginPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan} onLostPointerCapture={endPan}
        onPointerLeave={() => { if (drag.current && !drag.current.moved) stopPan(); }}
        onClickCapture={event => {
          if (suppressPanClick.current && event.detail > 0) { event.preventDefault(); event.stopPropagation(); }
          suppressPanClick.current = false;
        }}
        onClick={event => {
          if (event.target instanceof Element && !event.target.closest(".rh-node, .rh-edge-target, .rh-word-card")) setSelectedWord(null);
        }}
        onKeyDown={event => {
          if (event.key === "Escape" && selectedWord) { event.preventDefault(); setSelectedWord(null); return; }
          if (!cardMinimized || event.target !== event.currentTarget) return;
          const directions: Record<string, Point> = { ArrowLeft: { x: 60, y: 0 }, ArrowRight: { x: -60, y: 0 }, ArrowUp: { x: 0, y: 60 }, ArrowDown: { x: 0, y: -60 } };
          const direction = directions[event.key];
          if (direction) { event.preventDefault(); setPan(value => ({ x: value.x + direction.x / zoom, y: value.y + direction.y / zoom })); }
          else if (event.key === "Escape") { event.preventDefault(); revealWord(); }
        }}>
        <div className="rh-world" style={{ transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})` }}>
        <div className="rh-orbit rh-orbit-one" aria-hidden="true" /><div className="rh-orbit rh-orbit-two" aria-hidden="true" /><div className="rh-orbit rh-orbit-three" aria-hidden="true" />
        <svg className="rh-lines" width="100%" height="100%" aria-label="Word relationships">
          {web.edges.map(edge => {
            const active = edge.from === web.focus || edge.to === web.focus;
            const destination = edge.from === web.focus ? edge.to : edge.from;
            const repeatsTrail = active && onTrail(destination);
            const reachable = active && !blocked(destination);
            const inspected = edge.from === selectedWord || edge.to === selectedWord;
            return <g key={edge.id} className={`rh-edge rh-edge-${edge.kind}${edge.traversed ? " is-walked" : ""}${active ? " is-incident" : ""}${trailEdges.has(edge.id) ? " is-on-trail" : ""}${repeatsTrail ? " is-blocked" : ""}${active && atTrailLimit && !repeatsTrail ? " is-limited" : ""}${inspected ? " is-selected-connection" : ""}`}>
              {trailEdges.has(edge.id) && <path className="rh-edge-trail-glow" d={edgePath(edge)} />}
              {inspected && <path className="rh-edge-selection-glow" d={edgePath(edge)} />}
              <path className="rh-edge-line" d={edgePath(edge)} />
              {active && <path className="rh-edge-target" d={edgePath(edge)} tabIndex={pending || !reachable ? -1 : 0} role="button" aria-disabled={!!pending || !reachable}
                aria-label={`Follow ${edge.kind} connection to ${destination}`} onClick={() => traverse(destination, edge.kind)}
                onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); traverse(destination, edge.kind); } }}><title>{relationNames[edge.kind]} → {destination}{repeatsTrail ? " · already on your trail; select its blue word or breadcrumb to backtrack" : atTrailLimit ? " · trail limit reached; backtrack to continue" : edge.traversed ? " · walked" : " · unexplored"}</title></path>}
            </g>;
          })}
        </svg>

        {web.nodes.map(node => {
          const isFocused = node.id === web.focus;
          const onTrail = trailWords.has(node.id);
          const canBacktrack = onTrail && !isFocused;
          const connected = neighbors.has(node.id) && !onTrail && !atTrailLimit;
          const primary = incident.find(edge => edge.from === node.id || edge.to === node.id);
          const selected = selectedWord === node.id;
          const secondAction = canBacktrack ? `Click again to return to ${node.id} and remove later trail steps` : isFocused ? "Your current word" : atTrailLimit ? "Trail limit reached. Backtrack to continue." : connected ? `Click again to follow a connection to ${node.id}` : "Reach this word through connections from your current word";
          return <button key={node.id} className={`rh-node${connected ? " is-reachable" : ""}${isFocused && !cardMinimized ? " is-focused" : ""}${onTrail ? " is-on-trail" : ""}${canBacktrack ? " is-backtrackable" : ""}${selected ? " is-selected" : ""}${selectedNeighbors?.has(node.id) ? " is-selection-neighbor" : ""} rh-node-${primary?.kind || "definition"}`} style={{ left: node.x, top: node.y, "--rh-node-connections": connectionCounts.get(node.id) || 0 } as React.CSSProperties}
            disabled={!!pending} aria-hidden={(isFocused && !cardMinimized) || undefined} aria-label={isFocused && cardMinimized ? `Inspect current word ${node.id}` : `Inspect ${node.id}`} aria-pressed={selected}
            title={selected ? secondAction : `Highlight connections to ${node.id}`}
            onClick={() => inspectWord(node.id, primary?.kind)}><span className="rh-node-dot" />{node.id}<Icon name={canBacktrack ? "back" : "arrow"} size={13} /></button>;
        })}
        </div>

        <article id="rh-current-word" hidden={cardMinimized} className={`rh-word-card is-on-trail${selectedNeighbors?.has(web.focus) ? " is-selection-neighbor" : ""}`} aria-label={`Definition of ${web.focus}`} aria-busy={!!pending}>
          {atTrailLimit && <p className="rh-limit-notice" role="status"><b>Trail limit reached</b>{web.walk.length - 1} steps · longest branch: {deepest}. Select an earlier trail word to continue, or start a new web.</p>}
          <div className="rh-card-topline"><span className="rh-eyebrow"><span className="rh-live-dot" />YOU ARE HERE</span><span className="rh-word-number">{(web.nodes.findIndex(node => node.id === web.focus) + 1).toString().padStart(2, "0")} / {web.nodes.length.toString().padStart(2, "0")}</span></div>
          <div className="rh-word-heading"><h2 ref={cardTitle} tabIndex={-1}>{focused.entry.word}</h2><span className="rh-phonetic">{focused.entry.phonetic}</span></div>
          <div className="rh-card-scroll" key={web.focus}>
            <ol className="rh-meanings">{focused.entry.meanings.slice(0, meaningCount).map((meaning, index) => <li key={`${web.focus}-${index}`}><span className="rh-part-of-speech">{meaning.partOfSpeech}<span>{String(index + 1).padStart(2, "0")}</span></span><p><ClickableDefinition text={meaning.definition} current={focused.entry} busy={!!pending} limited={atTrailLimit} blocked={blocked} onExplore={explore} /></p></li>)}</ol>
            {meaningCount < focused.entry.meanings.length && <button className="rh-text-button rh-more-definitions" disabled={!!pending} onClick={() => setMeaningCount(count => count + 3)}>+ {focused.entry.meanings.length - meaningCount} more definitions</button>}
          </div>
            <div className="rh-related">
              {(["synonym", "antonym"] as const).map(kind => {
                const terms = kind === "synonym" ? focused.entry.synonyms : focused.entry.antonyms;
                return <div className={`rh-related-row rh-related-${kind}`} key={kind}><span className="rh-related-label">{kind === "synonym" ? "Synonyms" : "Antonyms"}</span><div>{terms.length ? terms.slice(0, expandedRelations ? undefined : 5).map(term => isStopWord(term) ? <span key={term} className="rh-related-stop-word">{term}</span> : <button key={term} disabled={!!pending || blocked(term)} title={blocked(term) ? atTrailLimit ? "Trail limit reached. Backtrack to continue." : "Already on your trail. Select its blue word or breadcrumb to backtrack." : undefined} onClick={() => explore(term, kind)} aria-label={`Explore ${kind} ${term}`}>{term}<span>↗</span></button>) : <span className="rh-none">None listed</span>}</div></div>;
              })}
              {!expandedRelations && (focused.entry.synonyms.length > 5 || focused.entry.antonyms.length > 5) && <button className="rh-text-button" onClick={() => setExpandedRelations(true)}>Show all {relationCount} related words</button>}
            </div>
          <div className="rh-card-footer"><span>{pending ? <><span className="rh-spinner" />Looking up “{pending}”…</> : <><Icon name="branch" size={15} />Click an underlined word to follow it</>}</span></div>
        </article>

        {web.nodes.length === 1 && !cardMinimized && <div className="rh-first-hint"><span className="rh-hint-line" /><p>Your web begins with one word.<br /><b>Click a word above to make your first connection.</b></p></div>}
      </div>

      <div className={`rh-overlay-footer${cardMinimized && selectedWord ? " has-selected-word" : ""}`}>
        <div className="rh-legend"><span className="rh-eyebrow">THE THREADS</span><div><span><i className="rh-swatch rh-swatch-definition" />Definition</span><span><i className="rh-swatch rh-swatch-synonym" />Synonym</span><span><i className="rh-swatch rh-swatch-antonym" />Antonym</span></div><p><span className="rh-faded-line" />Discovered<span className="rh-solid-line" />Walked<span className="rh-trail-line" />Your path<span className="rh-blocked-line" />Would repeat<span className="rh-selection-line" />Selected</p></div>
        <div className="rh-map-tools">
          {cardMinimized && <span id="rh-pan-help" className="rh-pan-hint">Drag to pan<span className="rh-sr-only">. Focus the canvas and use arrow keys to pan, or Escape to restore the current word.</span></span>}
          <div className="rh-word-dock">
            {cardMinimized && selectedWord && <span className="rh-selected-word" role="status" title={`Selected word: ${selectedWord}`}>
              <span className="rh-sr-only">Selected word: </span><span className="rh-selected-word-text">{selectedWord}</span>
            </span>}
            <button className={`rh-card-toggle${cardMinimized ? " is-minimized" : ""}`} aria-label={cardMinimized ? `Restore current word ${web.focus}` : "Minimize current word"}
              aria-expanded={!cardMinimized} aria-controls="rh-current-word" title={cardMinimized ? "Restore the definition and center this word" : "Minimize the definition to pan the web"}
              onClick={() => { if (cardMinimized) revealWord(); else setCardMinimized(true); }}>
              <Icon name={cardMinimized ? "restore" : "minimize"} size={16} /><span>{cardMinimized ? focused.entry.word : "Minimize word"}</span>
            </button>
          </div>
          <div className="rh-view-controls">
            <button className="rh-icon-button" onClick={() => setZoom(value => Math.max(0.12, value - 0.15))} aria-label="Zoom out" disabled={zoom <= 0.12}><Icon name="minus" size={17} /></button>
            <span>{Math.round(zoom * 100)}%</span>
            <button className="rh-icon-button" onClick={() => setZoom(value => Math.min(1.5, value + 0.15))} aria-label="Zoom in" disabled={zoom >= 1.5}><Icon name="plus" size={17} /></button>
            <span className="rh-controls-divider" /><button className="rh-icon-button" onClick={fitWeb} aria-label="Fit web in view" title="Fit web in view"><Icon name="fit" size={17} /></button>
          </div>
        </div>
      </div>
    </section>

    {error && <div className="rh-error-toast" role="alert"><span>{error}</span>{failedLookup && <button className="rh-text-button" disabled={!!pending} onClick={() => explore(failedLookup.word, failedLookup.kind)}>Retry</button>}<button className="rh-icon-button" aria-label="Dismiss message" onClick={() => { setError(""); setFailedLookup(null); }}><Icon name="close" size={16} /></button></div>}

    <footer className="rh-bottom-bar"><div className="rh-trail"><button className="rh-back-button" disabled={!previousWord || !!pending} onClick={() => backtrack()} aria-label="Go back one connection" title="Walk back to the previous word"><Icon name="back" size={17} /></button><span className="rh-eyebrow">YOUR TRAIL</span><span className="rh-trail-length" aria-label="Trail length" title={`Longest discovery branch: ${deepest} steps`}>{web.walk.length - 1} steps</span><div ref={breadcrumbs} className="rh-breadcrumbs" aria-label="Your walking trail">{web.walk.map((word, index, list) => <React.Fragment key={word}><button className={index === list.length - 1 ? "is-current" : ""} aria-current={word === web.focus ? "step" : undefined} aria-label={`Backtrack to ${word}`} disabled={!!pending || word === web.focus} onClick={() => backtrack(word)} title={`Return to ${word} and remove ${list.length - index - 1} later steps`}>{word}</button>{index < list.length - 1 && <span className="rh-trail-separator">/</span>}</React.Fragment>)}</div></div><div className="rh-bottom-actions"><span className={`rh-save-state${saveFailed ? " is-error" : ""}`}><Icon name={saveFailed ? "help" : "check"} size={14} />{saveFailed ? "Couldn’t save · export your web" : "Saved on this device"}</span><button className="rh-icon-button" onClick={exportWeb} aria-label="Export your web" title="Export your web"><Icon name="download" size={17} /></button><label className={`rh-import-button${pending ? " is-disabled" : ""}`} title="Import a saved web">Import<input type="file" accept="application/json,.json" aria-label="Import a saved web" onChange={importWeb} disabled={!!pending} /></label><button className="rh-icon-button" onClick={() => setModal("help")} aria-label="How to explore" title="How to explore"><Icon name="help" size={19} /></button></div></footer>
    <div className="rh-sr-only" role="status" aria-live="polite">{pending ? `Looking up ${pending}` : `${web.focus}. ${web.nodes.length} words discovered. ${web.edges.length} connections, ${walked} walked.`}</div>
    {modal === "new" && <NewWebDialog busy={!!pending} error={newError} hasTrail={web.nodes.length > 1} onClose={() => setModal(null)} onStart={startWeb} />}
    {modal === "help" && <HelpDialog onClose={() => setModal(null)} />}
    <div className="rh-attribution">Definitions: FreeDictionaryAPI / Wiktionary · {focused.entry.license?.name || "CC BY-SA"}</div>
  </main>;
}
