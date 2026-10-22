import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { DictionaryEntry, normalize, Relation, VocabularyGraph, WebSnapshot, WordEdge } from "./graph";
import { lookupWord, rememberEntries } from "./dictionary";
import { STARTER_ENTRIES } from "./starterEntries";
import { cameraForFocus, Point, worldEdgePath } from "./layout";
import { isStopWord } from "./stopWords";
import { wordVariants } from "./wordForms";
import { useDelayedWorking, useDrawingProgress } from "./workProgress";
import { buildDrawingFrame, buildRenderScene } from "./renderScene";
import { createFrameQueue } from "./frameQueue";
import { restoreStudentWeb } from "./studentSnapshot";
import "./WordWeb.css";

const STORAGE_KEY = "word-web-student-web-v1";
const COLORS_KEY = "word-web-student-relationship-colors";
const DOWNLOAD_KEY = "word-web-student-download-state";
const MOODS = [
  { name: "Forest", color: "#7caa85", bg: "#101715", panel: "#1b2420", accent: "#c4e6b0" },
  { name: "Ocean", color: "#559fa8", bg: "#0d191d", panel: "#172b30", accent: "#a0dce0" },
  { name: "Midnight", color: "#668ac2", bg: "#101522", panel: "#1b2539", accent: "#b2caff" },
  { name: "Violet", color: "#9a7cc4", bg: "#181222", panel: "#291e38", accent: "#d7bcf5" },
  { name: "Plum", color: "#b57799", bg: "#20131c", panel: "#342131", accent: "#edbad6" },
  { name: "Ember", color: "#bf8964", bg: "#201711", panel: "#33271d", accent: "#eac5a1" },
  { name: "Slate", color: "#929ca9", bg: "#15181c", panel: "#252b32", accent: "#d0dae4" },
];
const relationNames: Record<Relation, string> = { definition: "Definition", synonym: "Synonym", antonym: "Antonym" };

const canBeNoun = (entry: DictionaryEntry) => entry.meanings.some(meaning => /\bnoun\b/i.test(meaning.partOfSpeech));

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    back: <path d="m10 5-7 7 7 7M3 12h18" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" /></>,
    settings: <><path d="m10 3-1 3-3 1-3 3 2 2-1 3 3 3 3-1 2 2 3-1 1-3 3-1 1-3-2-2 1-3-3-3-3 1-2-2Z" /><circle cx="12" cy="12" r="3" /></>,
    fit: <><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /><circle cx="12" cy="12" r="3" /></>,
    labels: <><path d="M3 7V3h4m10 0h4v4M3 17v4h4m10 0h4v-4M8 16l4-9 4 9M9.5 13h5" /></>,
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
      const graph = restoreStudentWeb(JSON.parse(saved));
      rememberEntries(graph.snapshot().nodes.map(node => node.entry));
      return graph;
    }
  } catch { /* A damaged or unavailable browser store must not prevent a new trail. */ }
  return new VocabularyGraph(STARTER_ENTRIES[0]);
}

function ExploreButton({ onExplore, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { onExplore: (stayOnCurrent: boolean) => void }) {
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const held = useRef(false);
  const cancel = () => { if (press.current) clearTimeout(press.current.timer); press.current = null; };
  useEffect(() => () => { if (press.current) clearTimeout(press.current.timer); }, []);
  return <button {...props} type="button" onPointerDown={event => {
    if (props.disabled || event.button !== 0 || event.isPrimary === false) return;
    cancel(); held.current = false;
    press.current = { x: event.clientX, y: event.clientY, timer: setTimeout(() => { press.current = null; held.current = true; onExplore(true); }, 500) };
  }} onPointerMove={event => { if (press.current && Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y) > 10) cancel(); }}
    onPointerUp={cancel} onPointerCancel={cancel} onPointerLeave={cancel} onContextMenu={event => event.preventDefault()}
    onClick={event => { if (held.current) { held.current = false; event.preventDefault(); return; } onExplore(false); }}>{children}</button>;
}

function ClickableDefinition({ text, current, busy, blocked, visited, onExplore }: {
  text: string; current: DictionaryEntry; busy: boolean; blocked: (word: string) => boolean; visited: (word: string) => boolean; onExplore: (word: string, kind: Relation, stayOnCurrent?: boolean) => void;
}) {
  const currentForms = new Set(wordVariants(current));
  return <>{text.split(/([a-zA-Z]+(?:['’-][a-zA-Z]+)*)/g).map((part, index) =>
    /^[a-zA-Z]/.test(part) && !isStopWord(part)
      ? <ExploreButton key={index} className={`rh-definition-word${visited(part) ? " is-visited" : ""}`} disabled={busy || currentForms.has(normalize(part)) || blocked(part)}
        title={blocked(part) ? "Already on your trail. Select its blue word or breadcrumb to backtrack." : undefined}
        aria-label={`Explore ${part}`} onExplore={stay => onExplore(part, "definition", stay)}>{part}</ExploreButton>
      : <React.Fragment key={index}>{part}</React.Fragment>
  )}</>;
}

function NewWebDialog({ busy, error, hasTrail, unsaved, onSave, onClose, onStart }: {
  busy: boolean; error: string; hasTrail: boolean; unsaved: boolean; onSave: () => void; onClose: () => void; onStart: (word: string) => void;
}) {
  const [word, setWord] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const submit = (event: FormEvent) => { event.preventDefault(); if (word.trim() && !busy) onStart(word); };
  return <dialog ref={dialog} className="rh-dialog" aria-labelledby="rh-new-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <button className="rh-icon-button rh-dialog-close" aria-label="Close new web" onClick={onClose} disabled={busy}><Icon name="close" /></button>
    <span className="rh-eyebrow">EVERY WORD WEB STARTS SOMEWHERE</span>
    <h2 id="rh-new-title">Pick your first word.</h2>
    <p>A small beginning. A thousand possible directions.</p>
    <form onSubmit={submit}>
      <label htmlFor="rh-seed">Starting word</label>
      {unsaved && <button className="rh-save-unsaved" type="button" disabled={busy} onClick={onSave}>Save unsaved web first?<Icon name="download" size={16} /></button>}
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
  return <dialog ref={dialog} className="rh-dialog rh-help-dialog" aria-labelledby="rh-help-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }}>
    <button className="rh-icon-button rh-dialog-close" aria-label="Close help" onClick={onClose}><Icon name="close" /></button>
    <span className="rh-eyebrow">FOLLOW YOUR CURIOSITY</span>
    <h2 id="rh-help-title">One word leads to another.</h2>
    <ol>
      <li><b>Follow a word.</b> Click an underlined word in a definition, or a synonym or antonym, to grow your web. Hold a word to add it while staying on your current word. Common stop words stay plain text.</li>
      <li><b>Discover the connections.</b> New words automatically link to matching words already in your web, including matches within phrases. Click any word or dot once, at any zoom, to select it and highlight its paths and neighbors in orange without changing zoom. A grouped dot selects its most connected word. Zoomed out, the selected word keeps its name while its neighbors become separate orange markers. Click another word or dot to change the selection; click empty canvas or press Escape to clear it.</li>
      <li><b>Walk your web.</b> Click the orange-selected canvas word again to follow an available connection, or backtrack if it is an earlier trail word. With the definition minimized, click the orange word chip beside the current word to center your selection; click the chip again to zoom in on it. Selection also reveals a Delete button, which removes that word and its connections; disconnected parts can remain. Breadcrumbs return to earlier trail words in one click; Back removes one step. Dashed connections would repeat a trail word and stay locked. Backtracking opens earlier branches again.</li>
      <li><b>Leave a trail.</b> Discovered connections are dull, walked connections are bright, and your active trail glows blue by default. Turn on Relationship colors in the menu for green synonyms and red antonyms. Your trail stays unclustered at every zoom, and orange selections keep their highlighted paths and separate neighboring markers.</li>
    </ol>
    <section className="rh-help-section" aria-labelledby="rh-help-view">
      <h3 id="rh-help-view">Explore the view</h3>
      <p>Minimize the current definition to pan by dragging or using the arrow keys, and zoom with the mouse wheel or a two-finger pinch. Restore the minimized current word to center it and reopen its definition.</p>
      <p>Use − and + to zoom. The letter-in-corners icon beside + zooms out as far as possible without dots; the next icon fits the web in view. When zoomed out, nearby dots form clusters and larger clusters show their most connected word’s name. Selected words keep their labels, with connected words shown as separate orange markers.</p>
    </section>
    <section className="rh-help-section" aria-labelledby="rh-help-options">
      <h3 id="rh-help-options">Make it yours</h3>
      <p>Open the hamburger menu for Options. Trail focus shows your trail and words one connection away; hover over it for a reminder. The seven Mood circles change the dark palette and remember your choice. Forest is the original. Settings lets you show or hide breadcrumbs. Desktop headers show discovered words and explored connections.</p>
    </section>
    <section className="rh-help-section" aria-labelledby="rh-help-save">
      <h3 id="rh-help-save">Save and start again</h3>
      <p>Your web saves automatically in this browser. Download web in the menu saves a file you can import later. New web replaces the current web and reuses cached dictionary entries.</p>
      <p>If your web differs from its last download, the new-web dialog offers a red “Save unsaved web first?” button. Click it to download before starting again. Changes are tracked across reloads; panning, zooming, and mood changes do not count.</p>
    </section>
    <button className="rh-primary-button" onClick={onClose}>Let’s wander<Icon name="arrow" size={16} /></button>
  </dialog>;
}

function SettingsDialog({ showBreadcrumbs, onToggleBreadcrumbs, onClose }: { showBreadcrumbs: boolean; onToggleBreadcrumbs: (enabled: boolean) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="rh-dialog" aria-labelledby="rh-settings-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <button className="rh-icon-button rh-dialog-close" aria-label="Close settings" onClick={onClose}><Icon name="close" /></button>
    <h2 id="rh-settings-title">Settings</h2>
    <label className="rh-setting-toggle"><input type="checkbox" checked={showBreadcrumbs} onChange={event => onToggleBreadcrumbs(event.target.checked)} />Show breadcrumbs</label>
    <p>Show your walking trail at the bottom of the screen. The back button on the word card is always available.</p>
  </dialog>;
}

export default function WordWeb() {
  const graphRef = useRef<VocabularyGraph | null>(null);
  const previousGraph = graphRef.current as { snapshot: () => WebSnapshot } | null;
  if (!previousGraph) graphRef.current = initialGraph();
  else if (!(previousGraph instanceof VocabularyGraph)) graphRef.current = VocabularyGraph.restore(previousGraph.snapshot());
  const [web, setWeb] = useState<WebSnapshot>(() => graphRef.current!.snapshot());
  const webSnapshot = useMemo(() => JSON.stringify(web), [web]);
  const [downloadState, setDownloadState] = useState<{ downloadedSnapshot?: string; lastDownloadedAt?: string; lastChangedAt?: string; currentSnapshot?: string }>(() => {
    try { return JSON.parse(localStorage.getItem(DOWNLOAD_KEY) || "null") || {}; } catch { return {}; }
  });
  const unsaved = web.nodes.length > 0 && downloadState.downloadedSnapshot !== webSnapshot;
  useEffect(() => {
    if (downloadState.currentSnapshot === webSnapshot) return;
    const next = { ...downloadState, currentSnapshot: webSnapshot, lastChangedAt: new Date().toISOString() };
    setDownloadState(next);
    try { localStorage.setItem(DOWNLOAD_KEY, JSON.stringify(next)); } catch { /* Session tracking remains available. */ }
  }, [webSnapshot, downloadState]);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [failedLookup, setFailedLookup] = useState<{ word: string; kind: Relation; stayOnCurrent?: boolean } | null>(null);
  const [modal, setModal] = useState<"new" | "help" | "settings" | null>(() => web.nodes.length ? null : "new");
  const [showBreadcrumbs, setShowBreadcrumbs] = useState(() => {
    try { return localStorage.getItem("word-web-student-show-breadcrumbs") !== "false"; } catch { return true; }
  });
  const [newError, setNewError] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);
  const [zoom, setZoom] = useState(0.85);
  const [labelsOnly, setLabelsOnly] = useState(false);
  const zoomFrames = useMemo(() => createFrameQueue<React.SetStateAction<number>>(update => {
    setLabelsOnly(false); setZoom(update);
  }, undefined, undefined, (previous, next) => value => {
    const intermediate = typeof previous === "function" ? previous(value) : previous;
    return typeof next === "function" ? next(intermediate) : next;
  }), []);
  useEffect(() => () => zoomFrames.cancel(), [zoomFrames]);
  const adjustZoom = (value: React.SetStateAction<number>) => { zoomFrames.cancel(); setLabelsOnly(false); setZoom(value); };
  const [mood, setMood] = useState(() => {
    try { return MOODS.find(item => item.name === localStorage.getItem("word-web-student-mood")) || MOODS[0]; } catch { return MOODS[0]; }
  });
  const [relationshipColors, setRelationshipColors] = useState(() => {
    try { return localStorage.getItem(COLORS_KEY) === "true"; }
    catch { return false; }
  });
  const [trailFocus, setTrailFocus] = useState(() => {
    try { return localStorage.getItem("word-web-student-trail-focus") === "true"; } catch { return false; }
  });
  const [cardMinimized, setCardMinimized] = useState(false);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const panFrames = useMemo(() => createFrameQueue<Point>(setPan), []);
  useEffect(() => () => panFrames.cancel(), [panFrames]);
  const [dragging, setDragging] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [centeredSelection, setCenteredSelection] = useState<string | null>(null);
  useEffect(() => { setCenteredSelection(null); }, [selectedWord]);
  const [legendOpen, setLegendOpen] = useState(false);
  useEffect(() => {
    if (!legendOpen) return;
    const closeOutside = (event: MouseEvent) => {
      if (event.target instanceof Element && !event.target.closest(".rh-legend-drawer, .rh-legend-toggle")) setLegendOpen(false);
    };
    document.addEventListener("click", closeOutside, true);
    return () => document.removeEventListener("click", closeOutside, true);
  }, [legendOpen]);
  const [stageSize, setStageSize] = useState({ width: 1200, height: 720 });
  const stage = useRef<HTMLDivElement>(null);
  const touchPoints = useRef(new Map<number, Point>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const drag = useRef<{ pointer: number; start: Point; origin: Point; moved: boolean } | null>(null);
  const suppressPanClick = useRef(false);
  const busyRef = useRef(false);
  const requestId = useRef(0);
  const cardTitle = useRef<HTMLHeadingElement>(null);
  const breadcrumbs = useRef<HTMLDivElement>(null);
  const previousFocus = useRef(web.focus);
  const focused = web.nodes.find(node => node.id === web.focus) || { id: "", entry: STARTER_ENTRIES[0], parent: null, x: 0, y: 0 };
  const { visibleEdges, trailEdges } = useMemo(() => {
    const pairKey = (edge: WordEdge) => JSON.stringify([edge.from, edge.to].sort());
    const preferred = new Map<string, WordEdge>();
    web.edges.forEach(edge => {
      if (edge.kind !== "definition" && !preferred.has(pairKey(edge))) preferred.set(pairKey(edge), edge);
    });
    const active = new Set(web.trailEdges || []);
    const walkedDefinitions = new Set<string>();
    web.edges.forEach(edge => {
      const replacement = edge.kind === "definition" ? preferred.get(pairKey(edge)) : undefined;
      if (!replacement) return;
      if (edge.traversed) walkedDefinitions.add(replacement.id);
      if (active.delete(edge.id)) active.add(replacement.id);
    });
    return {
      visibleEdges: web.edges.filter(edge => edge.kind !== "definition" || !preferred.has(pairKey(edge)))
        .map(edge => walkedDefinitions.has(edge.id) ? { ...edge, traversed: true } : edge),
      trailEdges: active,
    };
  }, [web.edges, web.trailEdges]);
  const walked = visibleEdges.filter(edge => edge.traversed).length;
  const incident = useMemo(() => visibleEdges.filter(edge => edge.from === web.focus || edge.to === web.focus), [visibleEdges, web.focus]);
  const primaryConnections = useMemo(() => {
    const connections = new Map<string, WordEdge>();
    for (const edge of incident) {
      if (!connections.has(web.focus)) connections.set(web.focus, edge);
      const destination = edge.from === web.focus ? edge.to : edge.from;
      if (!connections.has(destination)) connections.set(destination, edge);
    }
    return connections;
  }, [incident, web.focus]);
  const neighbors = useMemo(() => new Set(incident.map(edge => edge.from === web.focus ? edge.to : edge.from)), [incident, web.focus]);
  const previousWord = web.walk.length > 1 ? web.walk[web.walk.length - 2] : null;
  const discoveredWords = useMemo(() => new Set(web.nodes.map(node => node.id)), [web.nodes]);
  const visited = (word: string) => discoveredWords.has(graphRef.current!.resolveWord(word));
  const trailWords = useMemo(() => new Set(web.walk), [web.walk]);
  const shownWords = useMemo(() => {
    if (!trailFocus) return new Set(web.nodes.map(node => node.id));
    const words = new Set(web.walk);
    // Match against the original trail only, never newly included neighbors.
    web.edges.forEach(edge => {
      if (trailWords.has(edge.from)) words.add(edge.to);
      if (trailWords.has(edge.to)) words.add(edge.from);
    });
    return words;
  }, [trailFocus, web.nodes, web.walk, web.edges, trailWords]);
  const shownNodes = useMemo(() => web.nodes.filter(node => shownWords.has(node.id)), [web.nodes, shownWords]);
  const shownEdges = useMemo(() => visibleEdges.filter(edge => shownWords.has(edge.from) && shownWords.has(edge.to)), [visibleEdges, shownWords]);
  const onTrail = (word: string) => graphRef.current!.isOnTrail(word);
  const blocked = onTrail;
  const camera = useMemo(() => cameraForFocus(web, stageSize, zoom, pan), [web, stageSize, zoom, pan]);
  const { connectionCounts, wordNeighbors } = useMemo(() => {
    const counts = new Map<string, number>();
    const adjacent = new Map<string, Set<string>>();
    visibleEdges.forEach(edge => {
      counts.set(edge.from, (counts.get(edge.from) || 0) + 1);
      counts.set(edge.to, (counts.get(edge.to) || 0) + 1);
      if (!adjacent.has(edge.from)) adjacent.set(edge.from, new Set());
      if (!adjacent.has(edge.to)) adjacent.set(edge.to, new Set());
      adjacent.get(edge.from)!.add(edge.to); adjacent.get(edge.to)!.add(edge.from);
    });
    return { connectionCounts: counts, wordNeighbors: adjacent };
  }, [visibleEdges]);
  const selectedNeighbors = selectedWord ? wordNeighbors.get(selectedWord) : undefined;
  const scene = useMemo(() => buildRenderScene(shownNodes, shownEdges, camera, stageSize, connectionCounts, trailWords, trailEdges,
    new Set([web.focus, ...(selectedWord ? [selectedWord, ...(selectedNeighbors || [])] : [])]), stageSize.width <= 650 ? 15 : 19, selectedWord, labelsOnly),
    [shownNodes, shownEdges, camera, stageSize, connectionCounts, trailWords, trailEdges, web.focus, selectedWord, selectedNeighbors, labelsOnly]);
  const { drawnNodes, drawnEdges, drawing } = useDrawingProgress(scene.nodes.length + scene.clusters.length, scene.edges.length, scene);
  const { nodes: drawingNodes, clusters: drawingClusters, edges: drawingEdges } = useMemo(
    () => buildDrawingFrame(scene, drawnNodes, drawnEdges), [scene, drawnNodes, drawnEdges]);
  const showWorking = useDelayedWorking(Boolean(pending) || drawing);

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
    document.title = "Word Web · A web of words";
    return () => { document.title = oldTitle; requestId.current += 1; };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(web)); setSaveFailed(false); }
    catch { setSaveFailed(true); }
    if (breadcrumbs.current) breadcrumbs.current.scrollLeft = breadcrumbs.current.scrollWidth;
  }, [web]);

  useEffect(() => {
    if (previousFocus.current !== web.focus) cardTitle.current?.focus({ preventScroll: true });
    previousFocus.current = web.focus;
  }, [web.focus]);

  useEffect(() => {
    if (!stage.current) return;
    const update = () => {
      const bounds = stage.current!.getBoundingClientRect();
      if (bounds.width && bounds.height) setStageSize(previous => previous.width === bounds.width && previous.height === bounds.height ? previous : { width: bounds.width, height: bounds.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);

  const stopPan = () => {
    panFrames.flush();
    zoomFrames.flush();
    const gesture = drag.current;
    drag.current = null;
    setDragging(false);
    if (!gesture) return;
    if (gesture.moved) suppressPanClick.current = true;
    if (stage.current?.hasPointerCapture?.(gesture.pointer)) stage.current.releasePointerCapture(gesture.pointer);
  };

  useEffect(() => {
    const canvas = stage.current;
    if (!canvas || !cardMinimized || modal || legendOpen) return;
    const wheelZoom = (event: WheelEvent) => {
      if (!event.deltaY || drag.current) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight || 720 : 1;
      const delta = Math.max(-1000, Math.min(1000, event.deltaY * unit));
      zoomFrames.schedule(value => Math.max(0.12, Math.min(1.5, value * Math.exp(-delta * 0.0015))));
    };
    canvas.addEventListener("wheel", wheelZoom, { passive: false });
    return () => { canvas.removeEventListener("wheel", wheelZoom); zoomFrames.cancel(); };
  }, [cardMinimized, modal, legendOpen, zoomFrames]);

  const revealWord = () => {
    touchPoints.current.clear(); pinch.current = null;
    stopPan(); setPan({ x: 0, y: 0 }); setCardMinimized(false); setSelectedWord(null);
  };

  const beginPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (cardMinimized && event.pointerType === "touch") {
      touchPoints.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touchPoints.current.size >= 2) {
        panFrames.flush();
        const [a, b] = Array.from(touchPoints.current.values());
        pinch.current = { distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), zoom };
        drag.current = null; setDragging(false); suppressPanClick.current = true;
        touchPoints.current.forEach((_, pointer) => event.currentTarget.setPointerCapture?.(pointer));
        return;
      }
    }
    suppressPanClick.current = false;
    if (!cardMinimized || event.button !== 0 || event.isPrimary === false || drag.current) return;
    drag.current = { pointer: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin: pan, moved: false };
  };

  const movePan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" && touchPoints.current.has(event.pointerId)) {
      touchPoints.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinch.current && touchPoints.current.size >= 2) {
        const [a, b] = Array.from(touchPoints.current.values());
        event.preventDefault(); suppressPanClick.current = true;
        zoomFrames.schedule(Math.max(0.12, Math.min(1.5, pinch.current.zoom * Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.distance)));
        return;
      }
    }
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
    panFrames.schedule({ x: gesture.origin.x + dx / zoom, y: gesture.origin.y + dy / zoom });
  };

  const endPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") {
      if (!touchPoints.current.delete(event.pointerId)) return;
      if (pinch.current) {
        zoomFrames.flush();
        pinch.current = null; suppressPanClick.current = true;
        const remaining = Array.from(touchPoints.current.entries())[0];
        drag.current = remaining ? { pointer: remaining[0], start: remaining[1], origin: pan, moved: true } : null;
        setDragging(Boolean(remaining));
        return;
      }
    }
    if (drag.current?.pointer === event.pointerId) stopPan();
  };

  const explore = async (word: string, kind: Relation, stayOnCurrent = false) => {
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
      const next = await graphRef.current!.exploreResponsive(entry, kind, word, stayOnCurrent);
      if (request !== requestId.current) return;
      if (!stayOnCurrent) revealWord();
      setWeb(next);
    } catch (cause) {
      if (request === requestId.current) {
        setError(cause instanceof Error ? cause.message : "That word could not be loaded. Try again.");
        setFailedLookup({ word, kind, stayOnCurrent });
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

  const backtrack = (word?: string, preserveMinimized = false) => {
    if (busyRef.current) return;
    const next = graphRef.current!.backtrack(word);
    if (preserveMinimized && cardMinimized) { stopPan(); setPan({ x: 0, y: 0 }); setSelectedWord(null); }
    else revealWord();
    setWeb(next); setError(""); setFailedLookup(null);
  };

  const deleteWord = (word: string) => {
    if (busyRef.current) return;
    try {
      const next = graphRef.current!.deleteWord(word);
      if (cardMinimized) { stopPan(); setSelectedWord(null); }
      else revealWord();
      setWeb(next); setError(""); setFailedLookup(null);
      if (!next.nodes.length) setModal("new");
    } catch (cause) { setError((cause as Error).message); }
  };

  const inspectWord = (word: string, kind?: Relation) => {
    if (busyRef.current) return;
    if (selectedWord !== word) { setSelectedWord(word); return; }
    if (word === web.focus && cardMinimized) revealWord();
    else if (onTrail(word) && word !== web.focus) backtrack(word);
    else traverse(word, kind);
  };

  const centerSelectedWord = () => {
    const node = web.nodes.find(node => node.id === selectedWord);
    if (!node || busyRef.current) return;
    const target = { x: focused.x - node.x, y: focused.y - node.y };
    stopPan();
    if (centeredSelection === selectedWord && Math.abs(pan.x - target.x) < .01 && Math.abs(pan.y - target.y) < .01) {
      adjustZoom(value => Math.min(1.5, Math.max(.85, value * 2)));
    }
    setPan(target);
    setCenteredSelection(selectedWord);
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
      setWeb(graphRef.current.snapshot()); setModal(null); setError(""); setFailedLookup(null); adjustZoom(0.85);
    } catch (cause) {
      if (request === requestId.current) setNewError((cause as Error).message);
    } finally {
      if (request === requestId.current) { setPending(""); busyRef.current = false; }
    }
  };

  const fitWeb = () => {
    stopPan(); setPan({ x: 0, y: 0 });
    const maxX = Math.max(340, ...shownNodes.map(node => Math.abs(node.x - focused.x) + 85));
    const maxY = Math.max(250, ...shownNodes.map(node => Math.abs(node.y - focused.y) + 70));
    adjustZoom(Math.max(0.12, Math.min(1, (stageSize.width - 60) / (maxX * 2), (stageSize.height - 70) / (maxY * 2))));
  };

  const exportWeb = () => {
    const blob = new Blob([JSON.stringify(web, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `word-web-student-${web.root}.json`; anchor.click();
    const next = { ...downloadState, downloadedSnapshot: webSnapshot, currentSnapshot: webSnapshot, lastDownloadedAt: new Date().toISOString() };
    setDownloadState(next);
    try { localStorage.setItem(DOWNLOAD_KEY, JSON.stringify(next)); } catch { /* Session tracking remains available. */ }
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importWeb = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || busyRef.current) return;
    try {
      const restored = restoreStudentWeb(JSON.parse(await file.text()));
      rememberEntries(restored.snapshot().nodes.map(node => node.entry));
      graphRef.current = restored; revealWord(); setWeb(restored.snapshot()); setError(""); setFailedLookup(null);
    } catch { setError("Only student Word Web files can be opened here. Your current web is unchanged."); }
    event.target.value = "";
  };

  const edgePath = (edge: WordEdge) => scene.lowDetail && edge.from !== selectedWord && edge.to !== selectedWord
    ? `M ${scene.positions.get(edge.from)!.x} ${scene.positions.get(edge.from)!.y} L ${scene.positions.get(edge.to)!.x} ${scene.positions.get(edge.to)!.y}`
    : worldEdgePath(edge, scene.positions.get(edge.from)!, scene.positions.get(edge.to)!);

  return <main className={`rh-app${relationshipColors ? "" : " rh-neutral-connections"}`} data-mood={mood.name} style={{ "--rh-bg": mood.bg, "--rh-panel": mood.panel, "--rh-mint": mood.accent, "--rh-mood-color": mood.color } as React.CSSProperties}>
    <header className="rh-header">
      <div className="rh-brand"><span className="rh-brand-mark"><Icon name="branch" size={26} /></span><div><span className="rh-brand-name">word web<span className="rh-brand-period">.</span></span><span className="rh-brand-tagline">A WEB OF WORDS</span></div></div>
      <div className="rh-header-stats rh-stats" aria-label="Desktop web statistics">
        <div><strong>{web.nodes.length.toString().padStart(2, "0")}</strong><span>words discovered</span></div>
        <div className="rh-walked-stat" title="Unique connections explored out of all discovered connections. Walking one again does not count twice.">
          <strong>{walked}<span className="rh-stat-total"> / {visibleEdges.length}</span></strong>
          <span>connections explored</span>
        </div>
      </div>
      <div className="rh-header-actions">
        <button className="rh-new-button" aria-label="New web" title="new web" disabled={!!pending} onClick={() => { setModal("new"); setNewError(""); }}><Icon name="plus" size={20} /></button>
        <button className="rh-legend-toggle" aria-label={legendOpen ? "Close menu" : "Menu"} title={legendOpen ? "Close menu" : "Menu"} aria-expanded={legendOpen} aria-controls="rh-map-legend" onClick={() => setLegendOpen(value => !value)}><Icon name={legendOpen ? "close" : "menu"} /></button>
      </div>
    </header>

        <div className={`rh-legend-drawer${legendOpen ? " is-open" : ""}`} onKeyDown={event => { if (event.key === "Escape") setLegendOpen(false); }}><div id="rh-map-legend" className="rh-legend"><span className="rh-eyebrow rh-menu-stats-heading">WEB STATS</span><div className="rh-stats" aria-label="Web statistics">
        <div><strong>{web.nodes.length.toString().padStart(2, "0")}</strong><span>words discovered</span></div>
        <div className="rh-walked-stat" title="Unique connections explored out of all discovered connections. Walking one again does not count twice.">
          <strong>{walked}<span className="rh-stat-total"> / {visibleEdges.length}</span></strong>
          <span>connections explored</span>
        </div>
        </div><span className="rh-eyebrow">THE THREADS</span><label className="rh-color-toggle"><input type="checkbox" checked={relationshipColors} onChange={event => { const enabled = event.target.checked; setRelationshipColors(enabled); try { localStorage.setItem(COLORS_KEY, String(enabled)); } catch { /* Keep the choice for this session. */ } }} />Relationship colors</label><div><span><i className="rh-swatch rh-swatch-definition" />Definition</span><span><i className="rh-swatch rh-swatch-synonym" />Synonym</span><span><i className="rh-swatch rh-swatch-antonym" />Antonym</span></div><p><span className="rh-faded-line" />Discovered<span className="rh-solid-line" title={relationshipColors ? "Walked connections brighten; synonyms stay green and antonyms stay red" : "Visited connections are white"} />Walked<span className="rh-trail-line" title={relationshipColors ? "Blue definitions, green synonyms, red antonyms" : "Your active trail is blue"} />Your path<span className="rh-blocked-line" />Would repeat<span className="rh-selection-line" />Selected</p><section className="rh-menu-options" aria-label="Options"><span className="rh-eyebrow">OPTIONS</span><label className="rh-color-toggle" title="Show your trail and words one connection away."><input type="checkbox" checked={trailFocus} onChange={event => { const enabled = event.target.checked; setTrailFocus(enabled); setSelectedWord(null); try { localStorage.setItem("word-web-student-trail-focus", String(enabled)); } catch { /* Keep the preference for this session. */ } }} />Trail focus</label><div className="rh-mood-section" role="group" aria-label="Mood"><span className="rh-eyebrow">MOOD</span><div className="rh-mood-swatches">{MOODS.map(item => <button key={item.name} className="rh-mood-swatch" aria-label={`${item.name} mood`} aria-pressed={mood.name === item.name} title={item.name} style={{ "--swatch": item.color } as React.CSSProperties} onClick={() => { setMood(item); try { localStorage.setItem("word-web-student-mood", item.name); } catch { /* Keep the mood for this session. */ } }} />)}</div></div></section><div className="rh-menu-actions"><button className="rh-menu-action rh-menu-settings" onClick={() => { setLegendOpen(false); setModal("settings"); }} aria-label="Settings"><Icon name="settings" size={18} />Settings</button>{saveFailed && <span className="rh-save-state is-error" role="status"><Icon name="help" size={14} />Could not save · export your web</span>}<button className="rh-menu-action" onClick={exportWeb} aria-label="Export your web" title="Export your web"><Icon name="download" size={17} />Download web</button><label className={`rh-import-button${pending ? " is-disabled" : ""}`} title="Import a saved web">Import<input type="file" accept="application/json,.json" aria-label="Import a saved web" onChange={importWeb} disabled={!!pending} /></label><button className="rh-icon-button" onClick={() => setModal("help")} aria-label="How to explore" title="How to explore"><Icon name="help" size={19} /></button></div></div></div>

    <section className="rh-workspace" aria-label="Vocabulary explorer">
          <div className="rh-view-controls">
            <button className="rh-icon-button" onClick={() => adjustZoom(value => Math.max(0.12, value - 0.15))} aria-label="Zoom out" disabled={zoom <= 0.12}><Icon name="minus" size={17} /></button>
            <span>{Math.round(zoom * 100)}%</span>
            <button className="rh-icon-button" onClick={() => adjustZoom(value => Math.min(1.5, value + 0.15))} aria-label="Zoom in" disabled={zoom >= 1.5}><Icon name="plus" size={17} /></button>
            <button className="rh-icon-button" onClick={() => {
              const baseFont = stageSize.width <= 650 ? 15 : 19;
              const minimum = shownNodes.reduce((value, node) => Math.max(value, 10 / (baseFont + (connectionCounts.get(node.id) || 0) * 4)), .12);
              setLabelsOnly(true);
              zoomFrames.cancel();
              setZoom(Math.min(1.5, minimum + .000001));
            }} aria-label="Zoom out without dots" title="Zoom out as far as possible while keeping word labels"><Icon name="labels" size={17} /></button>
            <span className="rh-controls-divider" /><button className="rh-icon-button" onClick={fitWeb} aria-label="Fit web in view" title="Fit web in view"><Icon name="fit" size={17} /></button>
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
          if (event.target instanceof Element && !event.target.closest(".rh-node, .rh-cluster, .rh-edge-target, .rh-word-card")) setSelectedWord(null);
        }}
        onKeyDown={event => {
          if (event.key === "Escape" && selectedWord) { event.preventDefault(); setSelectedWord(null); return; }
          if (!cardMinimized || event.target !== event.currentTarget) return;
          const directions: Record<string, Point> = { ArrowLeft: { x: 60, y: 0 }, ArrowRight: { x: -60, y: 0 }, ArrowUp: { x: 0, y: 60 }, ArrowDown: { x: 0, y: -60 } };
          const direction = directions[event.key];
          if (direction) { event.preventDefault(); setPan(value => ({ x: value.x + direction.x / zoom, y: value.y + direction.y / zoom })); }
          else if (event.key === "Escape") { event.preventDefault(); revealWord(); }
        }}>
        <div className={`rh-world${scene.lowDetail ? " rh-low-detail" : ""}`} style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`, "--rh-zoom": camera.zoom } as React.CSSProperties}>
        <div className="rh-orbit rh-orbit-one" aria-hidden="true" /><div className="rh-orbit rh-orbit-two" aria-hidden="true" /><div className="rh-orbit rh-orbit-three" aria-hidden="true" />
        <svg className="rh-lines" width="100%" height="100%" aria-label="Word relationships">
          {drawingEdges.map(edge => {
            const active = edge.from === web.focus || edge.to === web.focus;
            const destination = edge.from === web.focus ? edge.to : edge.from;
            const repeatsTrail = active && onTrail(destination);
            const reachable = active && !blocked(destination) && !destination.startsWith("cluster:");
            const inspected = edge.from === selectedWord || edge.to === selectedWord;
            const path = edgePath(edge);
            return <g key={edge.id} className={`rh-edge rh-edge-${edge.kind}${edge.traversed ? " is-walked" : ""}${active ? " is-incident" : ""}${edge.onTrail ? " is-on-trail" : ""}${repeatsTrail ? " is-blocked" : ""}${inspected ? " is-selected-connection" : ""}`}>
              {inspected && <path className="rh-edge-selection-glow" d={path} />}
              {edge.onTrail && !scene.lowDetail && <path className="rh-edge-trail-glow" d={path} />}
              <path className="rh-edge-line" d={path} />
              {active && <path className="rh-edge-target" d={path} tabIndex={pending || !reachable ? -1 : 0} role="button" aria-disabled={!!pending || !reachable}
                aria-label={`Follow ${edge.kind} connection to ${destination}`} onClick={() => traverse(destination, edge.kind)}
                onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); traverse(destination, edge.kind); } }}><title>{relationNames[edge.kind]} → {destination}{repeatsTrail ? " · already on your trail; select its blue word or breadcrumb to backtrack" : edge.traversed ? " · walked" : " · unexplored"}</title></path>}
            </g>;
          })}
        </svg>

        {drawingNodes.map(node => {
          const isFocused = node.id === web.focus;
          const onTrail = trailWords.has(node.id);
          const canBacktrack = onTrail && !isFocused;
          const connected = neighbors.has(node.id) && !onTrail;
          const primary = primaryConnections.get(node.id);
          const selected = selectedWord === node.id;
          const secondAction = canBacktrack ? `Click again to return to ${node.id} and remove later trail steps` : isFocused ? "Your current word" : connected ? `Click again to follow a connection to ${node.id}` : "Reach this word through connections from your current word";
          return <button key={node.id} className={`rh-node${scene.dots.has(node.id) ? " is-dot" : ""}${canBeNoun(node.entry) ? " is-noun" : ""}${connected ? " is-reachable" : ""}${isFocused && !cardMinimized ? " is-focused" : ""}${onTrail ? " is-on-trail" : ""}${canBacktrack ? " is-backtrackable" : ""}${selected ? " is-selected" : ""}${selectedNeighbors?.has(node.id) ? " is-selection-neighbor" : ""} rh-node-${primary?.kind || "definition"}`} style={{ left: node.x, top: node.y, "--rh-node-base": `${stageSize.width <= 650 ? 15 : 19}px`, ...(scene.lowDetail && selected ? { "--rh-node-base": `${Math.max(15, 14 / zoom - (connectionCounts.get(node.id) || 0) * 4)}px` } : {}), ...(scene.dots.has(node.id) ? { width: 8 / zoom, height: 8 / zoom } : {}), "--rh-node-connections": connectionCounts.get(node.id) || 0 } as React.CSSProperties}
            disabled={!!pending} aria-hidden={(isFocused && !cardMinimized) || undefined} aria-label={isFocused && cardMinimized ? `Inspect current word ${node.id}` : `Inspect ${node.id}`} aria-pressed={selected}
            title={selected ? secondAction : `Highlight connections to ${node.id}`}
            onClick={() => inspectWord(node.id, primary?.kind)}><span className="rh-node-dot" />{node.id}<Icon name={canBacktrack ? "back" : "arrow"} size={13} /></button>;
        })}
        {drawingClusters.map(cluster => <button key={cluster.id} className={`rh-cluster${cluster.radius >= 8 ? " has-label" : ""}${cluster.onTrail ? " is-on-trail" : ""}`} style={{ left: cluster.x, top: cluster.y, width: cluster.radius * 2 / zoom, height: cluster.radius * 2 / zoom }} disabled={!!pending} aria-label="Inspect grouped words" title={`Highlight connections to ${cluster.representative}`} onClick={() => inspectWord(cluster.representative)}>
          {cluster.radius >= 8 && <span className="rh-cluster-label">{cluster.representative}</span>}
        </button>)}
        </div>

        {web.nodes.length > 0 && <article id="rh-current-word" hidden={cardMinimized} className={`rh-word-card is-on-trail${canBeNoun(focused.entry) ? " is-noun" : ""}${selectedNeighbors?.has(web.focus) ? " is-selection-neighbor" : ""}`} aria-label={`Definition of ${web.focus}`} aria-busy={!!pending}>
          <button className="rh-card-back" disabled={!previousWord || !!pending} onClick={() => backtrack()} aria-label="Back one breadcrumb" title="Back one breadcrumb"><Icon name="back" size={18} /></button>
          <button className="rh-minimize-current" onClick={() => setCardMinimized(true)} aria-label="Minimize current word" aria-expanded="true" aria-controls="rh-current-word" title="Minimize word"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 19h14" /></svg></button>
          <button className="rh-delete-word rh-delete-current" disabled={!!pending} onClick={() => deleteWord(web.focus)} aria-label={`Delete word ${web.focus}`} title="Delete this word and its connections"><Icon name="trash" size={18} /></button>
          <div className="rh-card-topline"><span className="rh-word-number">{(web.nodes.findIndex(node => node.id === web.focus) + 1).toString().padStart(2, "0")} / {web.nodes.length.toString().padStart(2, "0")}</span></div>
          <div className="rh-word-heading"><h2 ref={cardTitle} tabIndex={-1}>{focused.entry.word}</h2><span className="rh-phonetic">{focused.entry.phonetic}</span></div>
          <div className="rh-card-scroll" key={web.focus}>
            <ol className="rh-meanings">{focused.entry.meanings.map((meaning, index) => <li key={`${web.focus}-${index}`}><span className="rh-part-of-speech">{meaning.partOfSpeech}<span>{String(index + 1).padStart(2, "0")}</span></span><p><ClickableDefinition text={meaning.definition} current={focused.entry} busy={!!pending} blocked={blocked} visited={visited} onExplore={explore} /></p></li>)}</ol>
          </div>
            <div className="rh-related">
              {(["synonym", "antonym"] as const).map(kind => {
                const terms = kind === "synonym" ? focused.entry.synonyms : focused.entry.antonyms;
                return terms.length ? <div className={`rh-related-row rh-related-${kind}`} key={kind} aria-label={kind === "synonym" ? "Synonyms" : "Antonyms"}><div>{ terms.map(term => isStopWord(term) ? <span key={term} className="rh-related-stop-word">{term}</span> : <ExploreButton key={term} className={visited(term) ? "is-visited" : undefined} disabled={!!pending || blocked(term)} title={blocked(term) ? "Already on your trail. Select its blue word or breadcrumb to backtrack." : undefined} onExplore={stay => explore(term, kind, stay)} aria-label={`Explore ${kind} ${term}`}>{term}<span>↗</span></ExploreButton>)}</div></div> : null;
              })}
            </div>
          <div className="rh-card-footer"><span>{pending ? <><span className="rh-spinner" />Looking up “{pending}”…</> : <><Icon name="branch" size={15} />Click an underlined word to follow it</>}</span></div>
        </article>}

        {web.nodes.length === 1 && !cardMinimized && <div className="rh-first-hint"><span className="rh-hint-line" /><p>Your web begins with one word.<br /><b>Click a word above to make your first connection.</b></p></div>}
        {web.nodes.length === 0 && <div className="rh-first-hint"><p>Your web is empty.<br /><b>Choose New web to begin.</b></p></div>}
      </div>

      <div className={`rh-overlay-footer${cardMinimized && selectedWord ? " has-selected-word" : ""}`}>
        <div className="rh-map-tools">
          {selectedWord && <button className="rh-delete-word" disabled={!!pending} onClick={() => deleteWord(selectedWord)} aria-label={`Delete selected word ${selectedWord}`}>Delete “{selectedWord}”</button>}
          {cardMinimized && <span id="rh-pan-help" className="rh-sr-only">Focus the canvas and use arrow keys to pan, or Escape to restore the current word.</span>}
          <div className="rh-word-dock">
            {cardMinimized && selectedWord && <button className="rh-selected-word" disabled={!!pending} aria-label={`Center selected word ${selectedWord}`} title="Click to center; click again to zoom in" onClick={centerSelectedWord}>
              <span className="rh-sr-only">Selected word: </span><span className="rh-selected-word-text">{selectedWord}</span>
            </button>}
            {web.nodes.length > 0 && cardMinimized && <button className={`rh-card-toggle${cardMinimized ? " is-minimized" : ""}`} aria-label={cardMinimized ? `Restore current word ${web.focus}` : "Minimize current word"}
              aria-expanded={!cardMinimized} aria-controls="rh-current-word" title={cardMinimized ? "Restore the definition and center this word" : "Minimize the definition to pan the web"}
              onClick={() => { if (cardMinimized) revealWord(); else setCardMinimized(true); }}>
              <Icon name={cardMinimized ? "restore" : "minimize"} size={16} /><span>{cardMinimized ? focused.entry.word : "Minimize word"}</span>
            </button>}
          </div>

        </div>
      </div>
    </section>

    {showWorking && <div className="rh-work-indicator" role="status" aria-live="polite"><span className="rh-spinner" />{pending ? "Looking up words and building connections…" : "Drawing your web…"}</div>}
    {error && <div className="rh-error-toast" role="alert"><span>{error}</span>{failedLookup && <button className="rh-text-button" disabled={!!pending} onClick={() => explore(failedLookup.word, failedLookup.kind, failedLookup.stayOnCurrent)}>Retry</button>}<button className="rh-icon-button" aria-label="Dismiss message" onClick={() => { setError(""); setFailedLookup(null); }}><Icon name="close" size={16} /></button></div>}

    <footer className="rh-bottom-bar" hidden={!showBreadcrumbs}><div className="rh-trail"><button className="rh-back-button" disabled={!previousWord || !!pending} onClick={() => backtrack(undefined, true)} aria-label="Go back one connection" title="Walk back to the previous word"><Icon name="back" size={17} /></button><span className="rh-eyebrow">YOUR TRAIL</span><span className="rh-trail-length" aria-label="Trail length">{web.walk.length - 1} steps</span><div ref={breadcrumbs} className="rh-breadcrumbs" aria-label="Your walking trail">{web.walk.map((word, index, list) => <React.Fragment key={word}><button className={index === list.length - 1 ? "is-current" : ""} aria-current={word === web.focus ? "step" : undefined} aria-label={`Backtrack to ${word}`} disabled={!!pending || word === web.focus} onClick={() => backtrack(word, true)} title={`Return to ${word} and remove ${list.length - index - 1} later steps`}>{word}</button>{index < list.length - 1 && <span className="rh-trail-separator">/</span>}</React.Fragment>)}</div></div></footer>
    <div className="rh-sr-only" role="status" aria-live="polite">{pending ? `Looking up ${pending}` : `${web.focus}. ${web.nodes.length} words discovered. ${visibleEdges.length} connections, ${walked} walked.`}</div>
    {modal === "new" && <NewWebDialog unsaved={unsaved} onSave={exportWeb} busy={!!pending} error={newError} hasTrail={web.nodes.length > 1} onClose={() => setModal(null)} onStart={startWeb} />}
    {modal === "help" && <HelpDialog onClose={() => setModal(null)} />}
    {modal === "settings" && <SettingsDialog showBreadcrumbs={showBreadcrumbs} onToggleBreadcrumbs={enabled => { setShowBreadcrumbs(enabled); try { localStorage.setItem("word-web-student-show-breadcrumbs", String(enabled)); } catch { /* Keep the preference for this session. */ } }} onClose={() => setModal(null)} />}
    <div className="rh-attribution">Definitions: {focused.entry.sourceName}{focused.entry.license && <> · {focused.entry.license.name}</>}</div>
  </main>;
}
