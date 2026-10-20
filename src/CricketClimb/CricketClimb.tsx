import { CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { CRICKET_CHIRP_DURATION, GardenAudio, cancelSpeech, speak, wait } from "./audio";
import { Cricket, CricketMood, GardenBackdrop, LeafArt, Spider } from "./characters";
import { DEFAULT_SETTINGS, Run, SCORES_KEY, SETTINGS_KEY, Settings, createRun, gradeFor, prepareRow, resolveAttempt, sanitizeSettings, scoreKey, segmentFor, spiderLaneFor, withoutMutedListening } from "./engine";
import { GRADE_LEVELS, Grade, SKILLS } from "./resources";
import { PROGRESS_KEY, parseProgress, restoreProgress, snapshotProgress } from "./progress";
import SettingsDialog from "./SettingsDialog";
import { QuestionClues, TokenArt } from "./QuestionClues";
import { displayReading, questionPrompt, questionReading } from "./reading";
import "./CricketClimb.css";

type Phase = "welcome" | "charging" | "superjump" | "arriving" | "reading" | "thinking" | "ready" | "jumping" | "suspense" | "reveal" | "falling" | "landing" | "celebrating";
type Visual = { level: number; lane: number; camera: number; lift: number };
type SpiderPosition = { level: number; lane: number; visible: boolean; laughing: boolean };
const seed = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const ANSWER_PAUSE_MS = 1500;
const THINKING_MS = 500;
function readStored<T,>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || "null") || fallback; } catch { return fallback; }
}
function storeValue(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
function loadPreferences(): Settings {
  const stored = readStored<Partial<Settings>>(SETTINGS_KEY, DEFAULT_SETTINGS);
  // Defaults apply only to missing fields, never replace saved choices on reload.
  const next = sanitizeSettings({ ...stored, preferences: 2 });
  storeValue(SETTINGS_KEY, next);
  return next;
}
function savedScores(): Record<string, number> {
  const raw = readStored<Record<string, number>>(SCORES_KEY, {});
  return Object.fromEntries(Object.entries(raw).filter(([, value]) => Number.isSafeInteger(value) && value >= 0));
}

// Question-bank updates must not hide an earned best for the same game rules.
function bestForRules(scores: Record<string, number>, rules: Settings) {
  return Math.max(...([undefined, 2, 3] as const).map(questions => scores[scoreKey({ ...rules, questions })] || 0));
}

function animate(from: Visual, to: Visual, duration: number, style: "jump" | "superjump" | "fall" | "pan", signal: AbortSignal, onFrame: (visual: Visual) => void) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Cancelled", "AbortError")); return; }
    let request = 0, started: number | null = null;
    const abort = () => { cancelAnimationFrame(request); reject(new DOMException("Cancelled", "AbortError")); };
    const frame = (time: number) => {
      if (started === null) started = time;
      const fraction = Math.min(1, (time - started) / duration);
      const eased = style === "superjump" ? (fraction < .5 ? 8 * fraction ** 4 : 1 - (-2 * fraction + 2) ** 4 / 2)
        : style === "fall" ? fraction * fraction : fraction * fraction * (3 - 2 * fraction);
      onFrame({ level: from.level + (to.level - from.level) * eased, lane: from.lane + (to.lane - from.lane) * eased,
        camera: from.camera + (to.camera - from.camera) * eased,
        lift: Math.sin(fraction * Math.PI) * (style === "superjump" ? 1.45 : style === "jump" ? .65 : 0) });
      if (fraction < 1) request = requestAnimationFrame(frame);
      else { signal.removeEventListener("abort", abort); resolve(); }
    };
    signal.addEventListener("abort", abort, { once: true }); request = requestAnimationFrame(frame);
  });
}

const phaseText: Record<Phase, string> = {
  welcome: "A little courage. A lovely climb.", charging: "One teeny cricket. One GIANT hop!", superjump: "Up, up, up to your leaf!", arriving: "Right where you left off!",
  reading: "Listen to the question…", thinking: "Take a little thinking time…",
  ready: "Tap your answer leaf!", jumping: "Here comes a little hop!", suspense: "Will your leaf hold?",
  reveal: "The leaves are opening…", falling: "Wheee! Find a soft landing.", landing: "A soft landing. Try again!", celebrating: "Lovely hop, little cricket!",
};

export default function CricketClimb() {
  const [settings, setSettings] = useState<Settings>(loadPreferences);
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const [run, setRun] = useState(() => createRun(seed(), settings));
  const runRef = useRef(run);
  const [presentedRow, setPresentedRow] = useState(run.rows[1]);
  const [phase, setPhaseState] = useState<Phase>("welcome");
  const phaseRef = useRef<Phase>("welcome");
  const [visual, setVisual] = useState<Visual>({ level: 0, lane: run.standing.lane, camera: 1, lift: 0 });
  const visualRef = useRef(visual);
  const [scores, setScores] = useState(savedScores);
  const scoresRef = useRef(scores);
  const [savedProgress, setSavedProgress] = useState(() => parseProgress(readStored(PROGRESS_KEY, null)));
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(false);
  const playing = useRef(false);
  const controller = useRef(new AbortController());
  const audio = useRef<GardenAudio | null>(null);
  if (!audio.current) audio.current = new GardenAudio();
  audio.current.enabled = settings.sounds;
  const [selected, setSelected] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [newPatch, setNewPatch] = useState<{ segment: number; grade: Grade | null } | null>(null);
  const [spider, setSpider] = useState<SpiderPosition>({ level: 1, lane: 0, visible: false, laughing: false });
  const spiderLane = useRef<number | null>(null);
  const spiderPlacement = useRef<{ key: string; lane: number | null }>({ key: "", lane: null });
  const [speechUnavailable, setSpeechUnavailable] = useState(false);
  const [scoreUnavailable, setScoreUnavailable] = useState(false);
  const [chirping, setChirping] = useState(false);
  const chirpTimer = useRef<number | undefined>(undefined);
  const stopChirping = useCallback(() => { window.clearTimeout(chirpTimer.current); setChirping(false); }, []);
  const lastActivity = useRef(Date.now());
  const nextChirp = useRef(Date.now() + 15000);
  const garden = useRef<HTMLDivElement>(null);
  const [gardenHeight, setGardenHeight] = useState(650);
  const readyLeaf = useRef<HTMLButtonElement>(null);
  const keyboardChoice = useRef<(lane: number) => void>(() => {});
  const readingUntil = useRef(0);

  function setPhase(value: Phase) { phaseRef.current = value; setPhaseState(value); }
  function commitRun(value: Run) { runRef.current = value; setRun(value); }
  function move(value: Visual) { visualRef.current = value; setVisual(value); }
  function stopWork() { controller.current.abort(); cancelSpeech(); controller.current = new AbortController(); return controller.current.signal; }
  function recordActivity() { lastActivity.current = Date.now(); nextChirp.current = lastActivity.current + 15000; stopChirping(); }
  function rememberSettings(value: Settings) { settingsRef.current = value; setSettings(value); storeValue(SETTINGS_KEY, value); }
  function saveBest(best: number, rules: Settings) {
    const key = scoreKey(rules);
    if (best <= bestForRules(scoresRef.current, rules)) return;
    const next = { ...scoresRef.current, [key]: best }; scoresRef.current = next; setScores(next);
    if (!storeValue(SCORES_KEY, next)) setScoreUnavailable(true);
  }
  function saveProgress(current: Run, rules: Settings) {
    const saved = snapshotProgress(current, rules);
    setSavedProgress(saved);
    if (!storeValue(PROGRESS_KEY, saved)) setScoreUnavailable(true);
  }

  async function startTurn(current: Run, options: { prepare?: boolean; prefix?: string } = {}) {
    const signal = stopWork(), rules = settingsRef.current;
    current = withoutMutedListening(current, rules);
    const next = options.prepare === false ? current : prepareRow(current, rules);
    saveProgress(next, rules);
    commitRun(next); setPresentedRow(next.rows[next.level]); setSelected(null); setNewPatch(null); setSpeechUnavailable(false);
    move({ level: next.standing.level, lane: next.standing.lane, camera: Math.max(1, next.level), lift: 0 });
    const placementKey = `${next.seed}:${next.level}:${next.rows[next.level].visits}`;
    const lane = spiderPlacement.current.key === placementKey ? spiderPlacement.current.lane : spiderLaneFor(next, rules, spiderLane.current);
    spiderPlacement.current = { key: placementKey, lane };
    if (lane !== null) {
      spiderLane.current = lane; setSpider({ level: next.level, lane, visible: true, laughing: false });
    } else setSpider(currentSpider => ({ ...currentSpider, visible: false, laughing: false }));
    const question = next.rows[next.level].question;
    // Reading and thinking together make one 1.5-second answer pause.
    readingUntil.current = Date.now() + ANSWER_PAUSE_MS - THINKING_MS;
    await finishReading(signal, rules.voice ? questionReading(question, true) : undefined);
  }

  async function finishReading(signal: AbortSignal, text?: string) {
    setPhase("reading");
    try {
      if (text) {
        const success = await speak(text, signal);
        if (signal.aborted) return;
        if (!success) {
          setSpeechUnavailable(true);
          if (runRef.current.rows[runRef.current.level].question.listening) {
            const visual = withoutMutedListening(runRef.current, { ...settingsRef.current, voice: false });
            void startTurn(visual, { prepare: false });
            return;
          }
        }
      }
      const remaining = readingUntil.current - Date.now();
      if (remaining > 0) await wait(remaining, signal);
      setPhase("thinking"); await wait(THINKING_MS, signal);
      setPhase("ready");
    } catch (error) { if ((error as Error).name !== "AbortError") { setSpeechUnavailable(true); setPhase("ready"); } }
  }

  async function readText(text: string) {
    if (["charging", "superjump", "arriving", "jumping", "suspense", "reveal", "falling", "landing", "celebrating"].includes(phaseRef.current)) return;
    recordActivity(); audio.current.unlock();
    const signal = stopWork();
    if (playing.current && !menuRef.current) await finishReading(signal, text);
    else if (!await speak(text, signal)) setSpeechUnavailable(true);
  }

  async function returnToClimb(next: Run) {
    const signal = stopWork();
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const destination = { level: next.standing.level, lane: next.standing.lane, camera: Math.max(1, next.level), lift: 0 };
    commitRun(next); setPresentedRow(next.rows[next.level]); setSelected(null); setNewPatch(null);
    setSpider(currentSpider => ({ ...currentSpider, visible: false, laughing: false }));
    move({ level: 0, lane: next.standing.lane, camera: 1, lift: 0 });
    setPhase("charging");
    try {
      await wait(reducedMotion ? 200 : 700, signal);
      if (signal.aborted) return;
      setPhase("superjump"); audio.current.superJump();
      if (reducedMotion) {
        // Keep the welcome home moment without a rapid camera scroll.
        move(destination);
        await wait(180, signal);
      } else {
        const flightTime = Math.min(2200, 1300 + Math.log2(next.standing.level + 2) * 120);
        await animate(visualRef.current, { ...destination, level: destination.level + .6 }, flightTime, "superjump", signal, move);
        await animate(visualRef.current, destination, 240, "pan", signal, move);
      }
      if (signal.aborted) return;
      setPhase("arriving"); audio.current.land();
      await wait(reducedMotion ? 250 : 650, signal);
      if (!signal.aborted) void startTurn(next, { prepare: false });
    } catch (error) {
      if ((error as Error).name !== "AbortError" && !signal.aborted) void startTurn(next, { prepare: false });
    }
  }

  function beginGame(keepHopping = false) {
    if (phaseRef.current !== "welcome" || menuRef.current) return;
    audio.current.unlock(); recordActivity(); playing.current = true;
    let next: Run;
    if (keepHopping && savedProgress) {
      const preferences = settingsRef.current;
      rememberSettings({ ...savedProgress.settings, preferences: 2, voice: preferences.voice, sounds: preferences.sounds, theme: preferences.theme });
      next = restoreProgress(savedProgress);
    } else {
      if (settingsRef.current.questions !== 3) rememberSettings({ ...settingsRef.current, questions: 3 });
      next = createRun(seed(), settingsRef.current);
    }
    spiderLane.current = null; spiderPlacement.current = { key: "", lane: null };
    if (keepHopping && savedProgress) void returnToClimb(next);
    else void startTurn(next, { prepare: false, prefix: "A fresh little climb! Hello, I am Pip." });
  }

  async function choose(lane: number) {
    if (phaseRef.current !== "ready" || menuRef.current) return;
    const current = runRef.current, rules = settingsRef.current;
    if (!current.rows[current.level].choices[lane]) return;
    const signal = stopWork(); recordActivity(); setSelected(lane); setPhase("jumping"); audio.current.jump();
    const result = resolveAttempt(current, lane, rules);
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    try {
      await animate(visualRef.current, { level: current.level, lane, camera: current.level, lift: 0 }, reducedMotion ? 180 : 650, "jump", signal, move);
      setPhase("suspense");
      for (let seconds = 3; seconds >= 1; seconds--) {
        setCountdown(seconds); audio.current.suspense(); await wait(1000, signal);
      }
      setPhase("reveal");
      const nextTurn = prepareRow(result.run, rules);
      // A refresh during celebration or a fall resumes at the resolved landing, never mid-animation.
      saveProgress(nextTurn, rules);
      commitRun({ ...current, rows: { ...current.rows, [current.level]: { ...current.rows[current.level], open: true } } });
      if (result.correct) {
        setPhase("celebrating"); saveBest(result.run.best, rules);
        if (result.newSegment) {
          const patch = segmentFor(result.run.level).segment;
          const nextGrade = gradeFor(result.run.level, rules), gradeChanged = nextGrade.id !== current.rows[current.level].question.grade;
          setNewPatch({ segment: patch, grade: gradeChanged ? nextGrade.id : null }); audio.current.fanfare();
          await wait(2200, signal);
        } else {
          audio.current.correct();
          await wait(950, signal);
        }
        await animate(visualRef.current, { level: result.landing, lane, camera: result.run.level, lift: 0 }, reducedMotion ? 150 : 550, "pan", signal, move);
      } else {
        setSpider(currentSpider => ({ ...currentSpider, laughing: currentSpider.visible && currentSpider.lane === lane }));
        await wait(200, signal); setPhase("falling"); audio.current.fall();
        await animate(visualRef.current, { level: result.landing, lane, camera: Math.max(1, result.landing + 1), lift: 0 },
          reducedMotion ? 400 : Math.min(2600, 550 + Math.sqrt(result.drop) * 230), "fall", signal, move);
        commitRun(result.run); setPhase("landing"); audio.current.land();
        await wait(850, signal);
      }
      if (!signal.aborted) void startTurn(nextTurn, { prepare: false });
    } catch (error) { if ((error as Error).name !== "AbortError") { void startTurn(current, { prepare: false }); } }
  }
  keyboardChoice.current = choose;

  function restart() {
    recordActivity(); audio.current.unlock();
    if (settingsRef.current.questions !== 3) rememberSettings({ ...settingsRef.current, questions: 3 });
    const next = createRun(seed(), settingsRef.current); spiderLane.current = null;
    if (playing.current) void startTurn(next, { prepare: false, prefix: "A fresh little climb!" });
    else { stopWork(); commitRun(next); setPresentedRow(next.rows[1]); move({ level: 0, lane: next.standing.lane, camera: 1, lift: 0 }); }
  }
  function openSettings() {
    stopWork(); recordActivity(); menuRef.current = true; setMenu(true);
  }
  function closeSettings() {
    cancelSpeech(); menuRef.current = false; setMenu(false); recordActivity();
    if (playing.current) void startTurn(runRef.current, { prepare: false });
  }
  function applySettings(next: Settings) {
    const changedGame = scoreKey(settingsRef.current) !== scoreKey(next);
    if (changedGame) next = { ...next, questions: 3 };
    rememberSettings(next); menuRef.current = false; setMenu(false); recordActivity();
    const current = changedGame ? createRun(seed(), next) : runRef.current;
    if (changedGame) spiderLane.current = null;
    if (playing.current) void startTurn(current, { prepare: false });
    else { stopWork(); commitRun(current); setPresentedRow(current.rows[1]); move({ level: 0, lane: current.standing.lane, camera: 1, lift: 0 }); }
  }
  function toggleVoice() {
    const next = { ...settingsRef.current, voice: !settingsRef.current.voice };
    rememberSettings(next); recordActivity(); audio.current.unlock();
    if (playing.current) void startTurn(runRef.current, { prepare: false });
    else cancelSpeech();
  }
  function readInfo(text: string) {
    void readText(text);
  }

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Cricket Climb · Cougar Tech Lab";
    return () => { document.title = previousTitle; };
  }, []);
  useEffect(() => {
    const element = garden.current;
    if (!element) return;
    setGardenHeight(element.clientHeight);
    if (typeof ResizeObserver === "undefined") {
      const resize = () => setGardenHeight(element.clientHeight);
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }
    const observer = new ResizeObserver(entries => setGardenHeight(entries[0].contentRect.height));
    observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const activity = () => { lastActivity.current = Date.now(); nextChirp.current = Date.now() + 15000; stopChirping(); };
    const visibility = () => { if (document.visibilityState !== "visible") stopChirping(); };
    const key = (event: KeyboardEvent) => {
      if (menuRef.current || !playing.current || phaseRef.current !== "ready") return;
      if (/^[1-5]$/.test(event.key)) {
        event.preventDefault();
        const current = runRef.current, row = current.rows[current.level];
        keyboardChoice.current(row.question.options ? row.choices.findIndex(choice => choice.value === event.key) : Number(event.key) - 1);
      }
    };
    window.addEventListener("pointerdown", activity); window.addEventListener("keydown", activity); window.addEventListener("keydown", key);
    document.addEventListener("visibilitychange", visibility);
    const interval = window.setInterval(() => {
      if (playing.current && !menuRef.current && phaseRef.current === "ready" && settingsRef.current.sounds && document.visibilityState === "visible" && Date.now() >= nextChirp.current) {
        audio.current.cricket(); setChirping(true); nextChirp.current = Date.now() + 60000;
        window.clearTimeout(chirpTimer.current);
        chirpTimer.current = window.setTimeout(() => setChirping(false), CRICKET_CHIRP_DURATION);
      }
    }, 1000);
    return () => {
      window.clearInterval(interval); window.removeEventListener("pointerdown", activity); window.removeEventListener("keydown", activity); window.removeEventListener("keydown", key);
      window.clearTimeout(chirpTimer.current); document.removeEventListener("visibilitychange", visibility);
      controller.current.abort(); cancelSpeech(); audio.current.close();
    };
  }, [stopChirping]);
  useEffect(() => {
    if (phase !== "ready" || menu || !settings.sounds) stopChirping();
  }, [phase, menu, settings.sounds, stopChirping]);
  useEffect(() => {
    if (phase === "ready" && document.activeElement instanceof HTMLElement && document.activeElement.closest(".cc-question")) readyLeaf.current?.focus({ preventScroll: true });
  }, [phase]);

  const returning = phase === "charging" || phase === "superjump" || phase === "arriving";
  const busy = returning || ["jumping", "suspense", "reveal", "falling", "landing", "celebrating"].includes(phase);
  const best = bestForRules(scores, settings);
  const patch = segmentFor(presentedRow.level);
  const checkpointLevel = patch.start + patch.length - 1;
  const grade = GRADE_LEVELS.find(item => item.id === presentedRow.question.grade);
  const milestoneGrade = newPatch && newPatch.grade !== null ? GRADE_LEVELS.find(item => item.id === newPatch.grade) : undefined;
  const gap = Math.min(142, Math.max(104, gardenHeight * .205));
  const anchor = Math.max(370, gardenHeight * .56);
  const y = (level: number) => anchor + (visual.camera - level) * gap;
  const x = (lane: number) => `${(lane + .5) / settings.platforms * 100}%`;
  const low = Math.max(1, Math.floor(visual.camera - gardenHeight / gap));
  const high = Math.ceil(visual.camera + 3);
  const visibleLevels = Array.from({ length: high - low + 1 }, (_, i) => low + i);
  const mood: CricketMood = phase === "charging" ? "charging" : phase === "superjump" ? "superjump" : phase === "arriving" ? "landing"
    : phase === "jumping" ? "jumping" : phase === "falling" ? "falling" : phase === "suspense" ? "suspense" : phase === "celebrating" ? "celebrating" : phase === "landing" ? "landing" : chirping && phase === "ready" ? "chirping" : "waiting";
  const skill = SKILLS.find(item => item.id === presentedRow.question.skill);
  const prompt = questionPrompt(presentedRow.question, settings.voice);
  const showAnswers = phase !== "welcome" && !returning;
  const status = phase === "reading" && !settings.voice ? "Look closely at the question…" : phaseText[phase];

  return <main className={`cc-app cc-theme--${settings.theme}`}>
    <div className="cc-shell">
      <header className="cc-header">
        <div className="cc-brand" aria-label="Cricket Climb"><span className="cc-brand-mark"><Cricket decorative /></span><span>cricket<span>climb</span><small>LITTLE HOPS. BIG DISCOVERIES.</small></span></div>
        <div className="cc-header-right">
          <button className="cc-best" disabled={busy} onClick={() => readInfo(`Your best is level ${best}. Your current level is ${Math.floor(visual.level)}.`)} aria-label={`Best level ${best}. Read score aloud`}><span className="cc-trophy" aria-hidden="true">♛</span><span><small>PERSONAL BEST</small><strong>{best}<span>{best === 1 ? "level" : "levels"}</span></strong></span></button>
          <button className={`cc-icon-button cc-voice-button ${settings.voice ? "is-on" : ""}`} disabled={busy} aria-label={`Read aloud ${settings.voice ? "on. Turn off" : "off. Turn on"}`} aria-pressed={settings.voice} onClick={toggleVoice}>{settings.voice ? "♪" : "♩"}<span className="cc-sr-only">Read aloud</span>{!settings.voice && <i aria-hidden="true" />}</button>
          <button className="cc-icon-button" aria-label="Open garden settings" disabled={busy} onClick={openSettings}>⚙</button>
        </div>
      </header>
      <section className={`cc-garden ${returning ? "cc-garden--returning" : ""} ${phase === "welcome" && savedProgress ? "cc-garden--welcome-back" : ""}`} ref={garden} aria-label="Cricket Climb garden">
        <GardenBackdrop />
        <div className="cc-garden-topline">
          <button className="cc-patch" disabled={busy} onClick={() => readInfo(`Patch ${patch.segment}. ${grade.spoken} discoveries.`)} aria-label={`Patch ${patch.segment}, ${patch.progress} of ${patch.length} completed. ${grade.label}`}>
            <span className="cc-patch-icon" aria-hidden="true">✿</span><span><strong>Patch {patch.segment}</strong><small>{grade.label} discoveries</small></span>
            <span className="cc-patch-progress" aria-hidden="true">{Array.from({ length: Math.min(patch.length, 15) }, (_, i) => <i key={i} className={i / Math.min(patch.length, 15) < patch.progress / patch.length ? "is-filled" : ""} />)}</span>
            <span className="cc-patch-fraction">{patch.progress}/{patch.length}</span>
          </button>
          <button className="cc-restart" disabled={busy} onClick={restart} aria-label="Restart with new questions"><span aria-hidden="true">↻</span><span>New climb</span></button>
        </div>
        <div className={`cc-question ${presentedRow.question.curriculum ? "cc-question--curriculum" : ""} ${presentedRow.question.options ? "cc-question--scenario" : ""} ${presentedRow.question.grade === 2 ? "cc-question--second-grade" : ""} ${presentedRow.question.sequence ? "cc-question--instructions" : ""} ${!showAnswers ? "cc-question--hidden" : ""}`} aria-hidden={!showAnswers} aria-busy={phase === "reading"}>
          <div className="cc-question-top"><span className="cc-eyebrow">{skill?.label}<small className="cc-question-grade">{grade.label}</small></span><button className={`cc-listen ${phase === "reading" && settings.voice ? "is-reading" : ""}`} disabled={busy || !showAnswers} aria-label="Read the question" onClick={() => void readText(questionReading(presentedRow.question, settings.voice))}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Zm13-1q5 4 0 8M16 10q2 2 0 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg><span>Listen</span></button></div>
          <h1><button type="button" className="cc-read-text" disabled={busy || !showAnswers} aria-label={`Read question text: ${prompt}`} onClick={() => void readText(questionReading(presentedRow.question, settings.voice))}>{prompt}</button></h1>
          {(presentedRow.question.display || presentedRow.question.picture) && <div className={`cc-question-clue ${presentedRow.question.skill === "counting" && !/^\d/.test(presentedRow.question.display || "") ? "cc-question-clue--count" : ""}`}>
            {presentedRow.question.picture && <button type="button" className="cc-read-text cc-picture-clue" disabled={busy || !showAnswers} aria-label="Hear the picture name" onClick={() => void readText(presentedRow.question.pictureLabel)}>{presentedRow.question.picture}</button>}
            {presentedRow.question.display && <button type="button" disabled={busy || !showAnswers} aria-label="Read the clue" onClick={() => void readText(displayReading(presentedRow.question.display))} className={`cc-read-text ${presentedRow.question.skill === "spelling" || presentedRow.question.skill === "sightWords" ? "cc-word-clue" : ""}`}>{presentedRow.question.display}</button>}
          </div>}
          <QuestionClues question={presentedRow.question} onRead={text => void readText(text)} disabled={busy || !showAnswers} />
          <div className={`cc-reading-line ${phase === "reading" || phase === "thinking" ? "is-active" : ""}`}><i /></div>
        </div>
        <div className="cc-ruler" aria-label={`Current level ${Math.floor(visual.level)}`}>
          {visibleLevels.flatMap(level => [0, .25, .5, .75].map(part => <div key={`${level}-${part}`} className={`cc-ruler-tick ${part === 0 ? "is-major" : ""} ${level === presentedRow.level && part === 0 ? "is-current" : ""}`} style={{ top: y(level + part) }}>{part === 0 && <span>{level}</span>}</div>))}
          {y(0) < gardenHeight && <div className="cc-ruler-tick is-major" style={{ top: y(0) }}><span>0</span></div>}
        </div>
        <div className="cc-playfield" style={{ "--lane-count": settings.platforms } as CSSProperties}>
          {showAnswers && y(checkpointLevel) > 65 && y(checkpointLevel) < gardenHeight - 70 && <div className="cc-checkpoint" style={{ top: y(checkpointLevel) + 39 }} role="img" aria-label={`Patch ${patch.segment + 1} checkpoint at level ${checkpointLevel}. Complete this level to reach the next patch.`}>
            <span>⚑ Patch {patch.segment + 1} <small>Finish level {checkpointLevel}</small></span>
          </div>}
          {Array.from({ length: settings.platforms }, (_, lane) => <div key={lane} className="cc-stalk" style={{ left: x(lane), backgroundPositionY: `${visual.camera * gap}px` }}><i /><i /></div>)}
          {visibleLevels.map(level => {
            const row = run.rows[level], active = level === presentedRow.level, above = level > presentedRow.level;
            return <div className={`cc-row ${active ? "cc-row--active" : ""} ${above ? "cc-row--future" : ""}`} key={level} style={{ top: y(level) }}>
              {Array.from({ length: settings.platforms }, (_, lane) => {
                const open = row?.open && lane !== row.correctLane;
                const safe = row?.open && lane === row.correctLane;
                const label = row?.choices[lane];
                return <button key={lane} ref={active && lane === 0 ? readyLeaf : undefined} type="button" className={`cc-leaf ${open ? "cc-leaf--open" : ""} ${safe ? "cc-leaf--safe" : ""} ${active && selected === lane ? "cc-leaf--selected" : ""}`}
                  style={{ left: x(lane) }} disabled={!active || phase !== "ready" || menu} tabIndex={active && phase === "ready" ? 0 : -1}
                  aria-hidden={!active || !showAnswers}
                  aria-label={active && label ? row.question.options ? `Answer ${label.spoken}` : `Answer ${lane + 1}: ${label.spoken}` : `Level ${level} leaf ${lane + 1}`}
                  onClick={() => void choose(lane)}>
                  <span className="cc-leaf-surface"><LeafArt /><span className="cc-leaf-label" aria-hidden="true">{showAnswers && (active || row?.open) && label ? <TokenArt token={label} /> : ""}</span></span>
                  {active && phase === "ready" && !row.question.options && <span className="cc-leaf-key" aria-hidden="true">{lane + 1}</span>}
                </button>;
              })}
            </div>;
          })}
          <div className={`cc-spider ${spider.visible ? "is-visible" : ""}`} aria-hidden={!spider.visible} style={{ top: y(spider.level) - 63, left: x(spider.lane) }}><Spider laughing={spider.laughing} /></div>
          <div className={`cc-player ${phase === "superjump" ? "cc-player--superjump" : ""}`} style={{ top: y(visual.level) - visual.lift * gap - 6, left: x(visual.lane) }}>
            {phase === "superjump" && <div className="cc-boost-trail" aria-hidden="true"><i /><i /><i /><span><Cricket mood="superjump" decorative /></span><span><Cricket mood="superjump" decorative /></span></div>}
            <Cricket mood={mood} />
          </div>
          <div className="cc-ground" style={{ top: y(0) - 17 }} aria-label="Safe ground"><span>✿</span><span>✿</span><i /><b /></div>
        </div>
        {returning && <div className={`cc-return-flourish cc-return-flourish--${phase}`} aria-hidden="true">
          {phase === "superjump" && <div className="cc-speed-lines">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ "--i": i } as CSSProperties} />)}</div>}
          <div className="cc-return-bubble"><small>{phase === "charging" ? "WELCOME BACK, LITTLE HOPPER" : phase === "superjump" ? "ONE GIANT CRICKET HOP" : "HOME SWEET LEAF"}</small>
            <strong>{phase === "charging" ? "Ready… steady…" : phase === "superjump" ? "Wheeeee!" : "Ta-da!"}</strong></div>
        </div>}
        {phase === "suspense" && <div className="cc-suspense-counter" key={countdown} role="status" aria-label={`${countdown} seconds of suspense`}><span>{countdown}</span><i /><i /><i /></div>}
        {newPatch && <div className="cc-celebration" role="status"><span className="cc-celebration-flower">✿</span><small>LOOK HOW YOU'VE GROWN!</small><strong>Patch {newPatch.segment}!</strong><span>{milestoneGrade ? `${milestoneGrade.spoken} discoveries await.` : "A whole new patch to explore."}</span>
          {Array.from({ length: 20 }, (_, i) => <i key={i} style={{ "--i": i, "--rotation": `${i * 47}deg` } as CSSProperties} />)}</div>}
        <div className={`cc-status cc-status--${phase}`} role="status" aria-live="polite"><span className="cc-status-dot" aria-hidden="true" /><span>{speechUnavailable && phase === "ready" ? "Voice unavailable. Tap when you're ready." : status}</span>{chirping && <span className="cc-chirp" aria-label="Pip is chirping">♫</span>}</div>
        {phase === "welcome" && <div className="cc-welcome-wrap"><div className="cc-welcome cc-welcome--choices">
          <span className="cc-welcome-kicker"><span aria-hidden="true">✦</span> A GARDEN FULL OF POSSIBILITIES</span>
          <div className="cc-welcome-character"><Cricket mood="celebrating" decorative /></div>
          <h1>Small cricket.<br /><em>Big adventures.</em></h1>
          <p>Meet Pip! Listen, think, and tap<br className="cc-desktop-break" /> a leaf to hop a little higher.</p>
          <div className="cc-welcome-actions">
            <button className="cc-primary cc-start cc-continue" disabled={!savedProgress} onClick={() => beginGame(true)}
              aria-label={savedProgress ? `Keep hopping! Continue at level ${savedProgress.level}` : "Keep hopping! No saved climb yet"}
              >
              <span className="cc-start-copy">Keep hopping!<small>{savedProgress ? `Back to level ${savedProgress.level}` : "Your first adventure is waiting"}</small></span><span aria-hidden="true">↗</span>
            </button>
            <button className={`${savedProgress ? "cc-secondary" : "cc-primary"} cc-start`} onClick={() => beginGame(false)} aria-label="A fresh little climb! Start over at level 1"
              >
              <span className="cc-start-copy">A fresh little climb<small>New questions, from the ground up</small></span><span aria-hidden="true">↻</span>
            </button>
          </div>
          <button className="cc-welcome-settings" onClick={openSettings} aria-label="Grown-up settings. Choose skills, leaves, and themes"><span aria-hidden="true">⚙</span> Grown-up settings</button>
          <span className="cc-welcome-hint">No rush. Every tumble is another try.</span>
        </div></div>}
      </section>
      <footer className="cc-footer"><span><i aria-hidden="true">✿</i> Made for curious little minds.</span><span>{scoreUnavailable ? "Climb saved for this visit." : "Your best grows with you."}<span className="cc-footer-mode">{settings.platforms} leaves · {settings.fallMode === "limited" ? "Little tumbles" : "Wild tumbles"}</span></span></footer>
    </div>
    {menu && <SettingsDialog settings={settings} playing={playing.current} onClose={closeSettings} onSave={applySettings} />}
  </main>;
}
