import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Checkbox, createTheme, FormControlLabel, IconButton, MenuItem, Snackbar, TextField, ThemeProvider, Tooltip, useMediaQuery } from '@mui/material';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import PhishingOutlinedIcon from '@mui/icons-material/PhishingOutlined';
import { Link } from 'react-router-dom';
import { BALANCE, LOCATIONS, SPECIES } from './engine/config';
import { releaseFish, releaseFishes, travel } from './engine/storage';
import { CharacterState, EncounterOverrides, FishingMode, SaveData, WeatherChoice, WEATHERS, WorldOverrides } from './engine/types';
import { gameClock, MOON_LABELS, PERIOD_LABELS, SEASON_LABELS, worldAt } from './engine/world';
import FishingScene from './scene/FishingScene';
import { ASSET_BASE, sceneForLocation } from './scene/manifest';
import TypingChallenge from './components/TypingChallenge';
import RetrieveChallenge from './components/RetrieveChallenge';
import { observedPresentation } from './engine/interactive';
import { CollectionIndex, FishBadges, FishingDialog, Livewell, PerformanceRow } from './components/CollectionPanels';
import { useFishingGame } from './useFishingGame';
import { useWorldClock } from './useWorldClock';
import ActivityGuide from './components/ActivityGuide';
import TackleBox from './components/TackleBox';
import { COLORS, lureFor, normalizeTackle } from './engine/tackle';
import { StormStage, WEATHER_NAMES } from './engine/weather';
import { useWeatherVisuals } from './useWeatherVisuals';
import { useNaturalWeather } from './useNaturalWeather';
import { advanceNaturalWeather, nextNaturalWeather, seasonAtTime, startNaturalWeather } from './engine/naturalWeather';
import WeatherReport from './components/WeatherReport';
import SceneControls from './components/SceneControls';
import { useSceneFullscreen } from './useSceneFullscreen';
import { useScreenWakeLock } from './useScreenWakeLock';
import ScreenAwakeSetting from './components/ScreenAwakeSetting';
import FishInspection from './components/FishInspection';
import FishArtwork from './components/FishArtwork';
import { NotebookEditor, RecordedMeasurements, SaveNote } from './components/CatchNotebook';
import { addNotebookEntry, notebookEntries, saveNotebookEntry } from './engine/notebook';
import { formatLength, formatWeight } from './engine/specimens';
import FishStudySettings from './components/FishStudySettings';
import './fishing.css';

const DebugPanel = process.env.NODE_ENV === 'development' ? lazy(() => import('./components/DebugPanel')) : null;
const theme = createTheme({ palette: { mode: 'dark', primary: { main: '#e4c58b' }, background: { paper: '#153b36', default: '#0c2926' }, text: { primary: '#f4eddc', secondary: '#b4c6bb' } }, typography: { fontFamily: '"Segoe UI", Arial, sans-serif', button: { textTransform: 'none', fontWeight: 600 } }, shape: { borderRadius: 14 } });
function playBiteSound() {
  try {
    const ctx = new AudioContext(); const gain = ctx.createGain(); gain.connect(ctx.destination); gain.gain.setValueAtTime(0.04, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    const oscillator = ctx.createOscillator(); oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(660, ctx.currentTime); oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.13); oscillator.connect(gain); oscillator.start(); oscillator.stop(ctx.currentTime + 0.5); oscillator.onended = () => { void ctx.close(); };
  } catch { /* Sound is optional on browsers without Web Audio. */ }
}
export default function FishingGame() {
  const gameRoot = useRef<HTMLElement>(null);
  const [scenic, setScenic] = useState(false);
  const [showChecks,setShowChecks]=useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const { fullscreen, toggle: toggleFullscreen } = useSceneFullscreen(gameRoot);
  const dialogContainer = useCallback(() => gameRoot.current, []);
  const [worldOverrides, setWorldOverrides] = useState<WorldOverrides>({});
  const world = useWorldClock(worldOverrides);
  const conditionsAt = (currentSave: SaveData) => {
    const now=Date.now(); const options=process.env.NODE_ENV === 'development' ? worldOverrides : {};
    const current=advanceNaturalWeather(currentSave,now,options); const natural=current.settings.naturalWeather;
    return { ...worldAt(now,options), weather: current.settings.weather, tackle: current.tackle,
      ...(current.settings.weatherMode === 'natural' && natural ? { weatherDurationMs: natural.durationMs } : {}),
      ...(current.settings.weather === 'thunderstorm' ? { stormAgeMs: Math.max(0,now-(current.settings.weatherMode === 'natural' ? natural?.startedAt ?? now : current.settings.stormStartedAt ?? now)) } : {}) };
  };
  const { game, save, updateSave, castLine, key, again, reelIn, armChallenge, biteNow, overrides, storageError, checks, clearChecks } = useFishingGame(conditionsAt, inspectorOpen || showChecks);
  const screenAwake = useScreenWakeLock(save.settings.keepScreenAwake !== false);
  const hideFishDetails=save.settings.hideFishDetails!==false,units=save.settings.measurements??'imperial';
  const saveNote:SaveNote=useCallback((id,patch)=>updateSave(s=>saveNotebookEntry(s,id,patch)),[updateSave]);
  const conditions = conditionsAt(save);
  useNaturalWeather(save,updateSave,worldOverrides);
  const naturalMode=save.settings.weatherMode === 'natural';
  const naturalState=naturalMode ? save.settings.naturalWeather : undefined;
  const weatherChoice: WeatherChoice=naturalMode ? 'natural' : save.settings.weather;
  const [panel, setPanel] = useState<'livewell' | 'collection' | 'settings' | 'travel' | 'conditions' | 'tackle' | null>(null);
  const [releaseNotice, setReleaseNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<CharacterState | undefined>(); const [debugOverrides, setDebugOverrides] = useState<EncounterOverrides>({});
  const castButton = useRef<HTMLButtonElement>(null); const opener = useRef<HTMLElement | null>(null);
  const location = LOCATIONS.find(l => l.id === save.location)!;
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const reducedMotion = save.settings.reducedMotion || prefersReducedMotion;
  const [stormPreview, setStormPreview] = useState<StormStage | undefined>();
  const [lightningPreview, setLightningPreview] = useState(0);
  const endStorm = useCallback(() => updateSave(s => {
    if (s.settings.weather !== 'thunderstorm' || s.settings.weatherMode === 'natural') return s;
    const { stormStartedAt, ...settings } = s.settings;
    return { ...s, settings: { ...settings, weather: 'rain' } };
  }), [updateSave]);
  const weatherState = useWeatherVisuals(save.settings.weather, stormPreview, naturalState?.startedAt ?? save.settings.stormStartedAt, naturalMode ? undefined : endStorm, naturalState?.durationMs);
  useEffect(() => {
    if (!naturalMode && save.settings.weather === 'thunderstorm' && save.settings.stormStartedAt === undefined) {
      updateSave(s => s.settings.weatherMode !== 'natural' && s.settings.weather === 'thunderstorm' && s.settings.stormStartedAt === undefined ? { ...s, settings: { ...s.settings, stormStartedAt: Date.now() } } : s);
    }
  }, [save.settings.weather, save.settings.stormStartedAt, updateSave, naturalMode]);
  const busy = game.phase !== 'idle' && game.phase !== 'result' && game.phase !== 'retrieved';
  const interactive = save.settings.fishingMode === 'interactive';
  const full = save.livewell.length >= BALANCE.livewellCapacity;
  const previousPhase = useRef(game.phase);
  useEffect(() => { const title = document.title; document.title = 'Stillwater · Fishing Typing'; return () => { document.title = title; }; }, []);
  useEffect(() => {
    if (game.phase === 'typing' && previousPhase.current !== 'typing' && save.settings.sound) playBiteSound();
    previousPhase.current = game.phase;
    if (game.phase === 'idle') castButton.current?.focus({ preventScroll: true });
  }, [game.phase, save.settings.sound]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.code === 'Space' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !panel && !scenic && game.phase === 'idle' && !['INPUT','TEXTAREA','SELECT','BUTTON','SUMMARY','A'].includes(target.tagName) && !target.isContentEditable) { e.preventDefault(); castLine(); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [castLine, game.phase, panel, scenic]);
  const open = (value: typeof panel, target: HTMLElement) => { opener.current = target; setPanel(value); };
  const close = () => { setPanel(null); window.setTimeout(() => (opener.current || castButton.current)?.focus({ preventScroll: true }), 0); };
  const changeWeather = (weather: WeatherChoice) => {
    setStormPreview(undefined); setLightningPreview(0);
    updateSave(s => {
      if (weather === 'natural') return s.settings.weatherMode === 'natural' && s.settings.naturalWeather ? advanceNaturalWeather(s,Date.now(),process.env.NODE_ENV==='development' ? worldOverrides : {}) : startNaturalWeather(s,Date.now(),process.env.NODE_ENV==='development' ? worldOverrides : {});
      const { stormStartedAt, naturalWeather, weatherMode, ...settings } = s.settings;
      return { ...s, settings: { ...settings, weather, ...(weather === 'thunderstorm' ? { stormStartedAt: s.settings.weather === 'thunderstorm' ? stormStartedAt ?? Date.now() : Date.now() } : {}) } };
    });
  };
  const last = save.livewell[save.livewell.length - 1]; const lastSpecies = last && SPECIES.find(s => s.id === last.speciesId);
  const result = game.phase === 'result' ? game : null;
  const notes=notebookEntries(save),lastNote=last&&notes.find(e=>e.id===last.id);
  const caughtNote=result?.outcome==='caught'?notes.find(e=>e.id===result.encounter.id):undefined;
  const releaseCatch = () => {
    if (!result || result.outcome !== 'caught') return;
    updateSave(s => releaseFish(s, result.encounter.id));
    setReleaseNotice(`${hideFishDetails?'Fish':result.encounter.species.name} released. Your catch and coins stay in your journal.`);
    again();
  };
  return <ThemeProvider theme={theme}><main ref={gameRoot} className={`f-game ${reducedMotion ? 'f-reduced-motion' : ''} ${scenic ? 'f-game-scenic' : ''} ${fullscreen ? 'f-game-fullscreen' : ''}`}>
    <header className="f-header" hidden={scenic || fullscreen}><div className="f-brand"><Link to="/" className="f-home" aria-label="Back to Tech Lab"><ArrowBackIcon fontSize="small" /></Link><img src={`${ASSET_BASE}/ui/fishing-mark.svg`} alt="" /><div><strong>stillwater</strong><span>A TYPING ADVENTURE</span></div></div>
      <nav className="f-nav" aria-label="Fishing menus"><span className="f-coins"><i>◈</i> {save.balance}<small> lake coins</small></span><Button disabled={busy} startIcon={<PhishingOutlinedIcon />} onClick={e => open('tackle', e.currentTarget)}>Tackle</Button><Button disabled={busy} startIcon={<Inventory2OutlinedIcon />} onClick={e => open('livewell', e.currentTarget)}>Livewell <span className="f-counter">{save.livewell.length}</span></Button><Button disabled={busy} startIcon={<MenuBookOutlinedIcon />} onClick={e => open('collection', e.currentTarget)}>Journal</Button><Tooltip title="Settings"><span><IconButton disabled={busy} aria-label="Settings" onClick={e => open('settings', e.currentTarget)}><SettingsOutlinedIcon /></IconButton></span></Tooltip></nav>
    </header>
    {storageError && <Alert severity="warning">Your browser could not save this session. Keep this page open to retain your catches.</Alert>}
    <div className={`f-lake-frame f-lake-${game.phase}`}>
      <FishingScene checkPreview={process.env.NODE_ENV==='development' && showChecks ? checks[0] : undefined} game={game} location={save.location} weather={save.settings.weather} weatherState={weatherState} world={world} reducedMotion={reducedMotion} preview={preview} lightningPreview={lightningPreview} />
      <SceneControls scenic={scenic} fullscreen={fullscreen} busy={busy} onScenic={() => setScenic(value => !value)} onFullscreen={toggleFullscreen} />
      <div className="f-scene-hud" hidden={scenic}>
      <div className="f-scene-heading"><span className="f-eyebrow">THE FRESHWATER CHAPTER</span><h1>{location.name}</h1><Button size="small" disabled={busy} startIcon={<PlaceOutlinedIcon />} onClick={e => open('travel', e.currentTarget)}>{location.spot} <span>⌄</span></Button></div>
      <div className="f-weather-label"><div><strong>{SEASON_LABELS[world.season]} · {PERIOD_LABELS[world.period]} <time>{gameClock(world.hour)}</time></strong><small>{MOON_LABELS[world.moonPhase]}</small><span className="f-weather-copy">{weatherState.label}{naturalState && ` · natural · ${Math.max(0,Math.ceil((naturalState.endsAt-Date.now())/60000))}m left`}</span></div><Button size="small" disabled={busy} onClick={e => open('conditions', e.currentTarget)}>What’s biting?</Button></div>
      {game.phase === 'idle' && <section className="f-idle-panel"><span className="f-eyebrow">SLOW DOWN. CAST OUT.</span><h2>A little quiet. A new discovery.</h2><p>{interactive ? 'Type a haiku to retrieve. Vary your rhythm to tempt a fish.' : 'Cast your line, then type to land your catch.'}</p><Button ref={castButton} variant="contained" size="large" className="f-cast-button" onClick={castLine} disabled={full}>{full ? 'Livewell full — release a fish' : 'Cast your line'} <span>↗</span></Button><small className="f-key-hint">{full ? 'Open your livewell to make room' : <><kbd>space</kbd> to cast · {interactive ? 'Interactive retrieve' : 'Standard · 10 seconds to reel'}</>}</small></section>}
      {(game.phase === 'casting' || game.phase === 'waiting') && <section className="f-wait-panel" role="status"><div className="f-wait-dots"><i /><i /><i /></div><h2>{game.phase === 'casting' ? 'A perfect little splash.' : 'Something is out there.'}</h2><p>{game.phase === 'casting' ? 'Your line is on its way.' : 'Watch the strike indicator. Be ready to type.'}</p><span>Expected bite wait: {(game.waitRange?.[0] ?? 5000) / 1000}–{(game.waitRange?.[1] ?? 10000) / 1000} seconds</span></section>}
      {game.phase === 'typing' && <TypingChallenge typing={game.typing} onKey={key} onReady={armChallenge} />}
      {game.phase === 'retrieving' && <RetrieveChallenge retrieve={game.retrieve} presentation={observedPresentation(game.tackle,game.retrieve,performance.now())} onKey={key} onReelIn={reelIn} />}
      {game.phase === 'retrieved' && <section className="f-wait-panel" role="status"><h2>Your lure is back.</h2><p>No fish this cast. Try a different rhythm or pause in grass cover.</p><Button autoFocus variant="contained" onClick={again}>Cast again ↗</Button></section>}
      {game.phase === 'landing' && <section className="f-wait-panel" role="status"><h2>You’ve got it!</h2><p>Bringing your catch ashore…</p></section>}
      {result && <section className={`f-result f-result-${result.outcome} ${result.outcome === 'caught' ? `f-reveal-${result.encounter.species.rarity.toLowerCase()}` : ''}`} aria-labelledby="f-result-title">
        {result.outcome === 'caught' ? <><div className="f-catch-preview"><FishInspection fish={result.encounter} units={units} label={hideFishDetails?'Your catch':result.encounter.species.name}/><div className="f-result-copy"><span className="f-eyebrow">{result.encounter.isAlbino ? '✧ AN ALBINO DISCOVERY' : 'A LITTLE PATIENCE PAID OFF'}</span><h2 id="f-result-title">{hideFishDetails?(caughtNote?.name||'A catch to remember'):result.encounter.species.name}</h2><FishBadges rarity={result.encounter.species.rarity} quality={result.encounter.quality} albino={result.encounter.isAlbino} hideQuality={hideFishDetails}/>{hideFishDetails?<RecordedMeasurements entry={caughtNote} units={units}/>:<p>{formatLength(result.encounter.lengthCm,units)} · {formatWeight(result.encounter.weightKg,units)}</p>}<span className="f-earned">+{BALANCE.catchCoins} coins</span><PerformanceRow {...result.performance}/><div className="f-catch-actions"><Button autoFocus variant="contained" onClick={again}>Keep in livewell ↗</Button><Button variant="outlined" onClick={releaseCatch}>Release now</Button></div><small>Typing text saved with this catch · release anytime</small></div></div>{caughtNote&&<NotebookEditor key={`${caughtNote.id}-${units}`} entry={caughtNote} units={units} onSave={saveNote}/>}</> : <div className="f-result-copy"><span className="f-eyebrow">THERE’S ALWAYS ANOTHER CAST</span><h2 id="f-result-title">The fish got away!</h2><p>A ripple, a flash, and it was gone. Try again.</p><PerformanceRow {...result.performance} /><Button autoFocus variant="contained" onClick={again}>Cast again ↗</Button></div>}
      </section>}
      <div className="f-scene-bottom"><span><i className="f-status-dot" />{game.phase === 'typing' ? 'LINE TIGHT · KEEP TYPING' : interactive ? 'INTERACTIVE · YOUR RHYTHM MOVES THE LURE' : 'STANDARD · TAKE YOUR TIME BETWEEN CASTS'}</span><span>{lureFor(save.tackle.lure).name.toUpperCase()} <b> / </b> {COLORS[save.tackle.color].name.toUpperCase()}</span></div>
      </div>
    </div>
    <footer className="f-session-bar" hidden={scenic || fullscreen}><div><span className="f-footer-label">YOUR LAKE JOURNAL</span><p>Every catch tells a story.</p></div><div className="f-session-stat"><strong>{save.stats.caught}</strong><span>fish landed</span></div><div className="f-session-stat"><strong>{save.stats.discovered.length}<small> / {SPECIES.length}</small></strong><span>species discovered</span></div><div className="f-session-stat"><strong>{save.stats.bestWpm.toFixed(0)}<small> WPM</small></strong><span>personal best</span></div><div className="f-last-catch">{lastSpecies && last ? <><FishArtwork fish={{...last,species:lastSpecies}} label={hideFishDetails?'Latest catch':lastSpecies.name}/><div><span>LATEST CATCH</span><strong>{hideFishDetails?(lastNote?.name||'Unidentified catch'):lastSpecies.name}</strong>{hideFishDetails?<RecordedMeasurements entry={lastNote} units={units}/>:<small>Quality {last.quality} · {formatLength(last.lengthCm,units)}</small>}</div></> : <><span className="f-footer-wave">≈</span><div><span>A FRESH PAGE</span><strong>{save.stats.caught ? 'Another catch awaits' : 'Your first catch awaits'}</strong></div></>}</div></footer>
    <FishingDialog container={dialogContainer} title={panel === 'livewell' ? 'Your livewell' : panel === 'collection' ? 'Lake journal' : panel === 'travel' ? 'Find your quiet place' : panel === 'conditions' ? 'What’s biting?' : panel === 'tackle' ? 'Your tackle box' : 'Make yourself at home'} open={panel !== null} onClose={close}>
      {panel === 'conditions' && <><ActivityGuide world={world} conditions={conditions} /><WeatherReport season={world.season} state={naturalState} /></>}
      {panel === 'tackle' && <TackleBox interactive={interactive} conditions={conditions} setup={save.tackle} onChange={tackle => updateSave(s => ({ ...s, tackle: normalizeTackle(tackle) }))} />}
      {panel === 'livewell' && <Livewell save={save} onSaveNote={saveNote} onRelease={id => updateSave(s => releaseFish(s, id))} onReleaseMany={ids => updateSave(s => releaseFishes(s, ids))} />}
      {panel === 'collection' && <CollectionIndex save={save} onSaveNote={saveNote} onAddNote={()=>updateSave(addNotebookEntry)}/>}
      {panel === 'travel' && <><p className="f-guide-intro">Two views of the same lake. Travel pays for the scenery; both spots share the same fish, odds, and challenges.</p><div className="f-travel-grid">{LOCATIONS.map(l => <article className="f-travel-card" key={l.id}><div className={`f-travel-art f-travel-${l.id}`} aria-hidden="true"><FishingScene game={{ phase: 'idle' }} location={l.id} weather={save.settings.weather} weatherState={weatherState} world={world} reducedMotion manifest={sceneForLocation(world.season, l.id).filter(layer => !['angler', 'water-interactions'].includes(layer.id))} /></div><h3>{l.spot}</h3><p>{l.description}</p><Button variant="outlined" disabled={save.location === l.id || save.balance < l.cost} onClick={() => { updateSave(s => travel(s, l.id)); close(); }}>{save.location === l.id ? 'You are here' : l.cost ? `Visit · ${l.cost} coins` : 'Visit · free'}</Button></article>)}</div><p className="f-footnote">You have {save.balance} lake coins. Each landed fish earns {BALANCE.catchCoins}.</p></>}
      {panel === 'settings' && <div className="f-settings"><FishStudySettings settings={save.settings} onChange={patch=>updateSave(s=>({...s,settings:{...s.settings,...patch}}))}/><TextField select label="Fishing mode" value={save.settings.fishingMode ?? 'interactive'} onChange={e => updateSave(s => ({ ...s, settings: { ...s.settings, fishingMode: e.target.value as FishingMode } }))}><MenuItem value="standard">Standard</MenuItem><MenuItem value="interactive">Interactive</MenuItem></TextField><TextField select label="Weather" value={weatherChoice} onChange={e => changeWeather(e.target.value as WeatherChoice)}><MenuItem value="natural">Natural weather</MenuItem>{WEATHERS.map(w => <MenuItem value={w} key={w}>{WEATHER_NAMES[w]}</MenuItem>)}</TextField><ScreenAwakeSetting enabled={save.settings.keepScreenAwake !== false} {...screenAwake} onChange={keepScreenAwake => updateSave(s => ({ ...s, settings: { ...s.settings, keepScreenAwake } }))} /><FormControlLabel control={<Checkbox checked={save.settings.reducedMotion} onChange={e => updateSave(s => ({ ...s, settings: { ...s.settings, reducedMotion: e.target.checked } }))} /> } label="Reduce animation" /><FormControlLabel control={<Checkbox checked={save.settings.sound} onChange={e => updateSave(s => ({ ...s, settings: { ...s.settings, sound: e.target.checked } }))} />} label="Play a gentle sound when a fish bites" /><h3>How to fish</h3><p>Cast with the button or Space. Bite waits are doubled, with another doubling in winter. Fast moving lures shorten spring waits by 25%. Conditions and tackle still affect the wait. Open Tackle for lure, color, rig and retrieve suggestions. Type the complete lowercase phrase within 10 seconds to land it. Correct a wrong key with Backspace; spaces count, and you never need to press Enter.</p><p>Interactive mode always uses a haiku for retrieving, with no timer. Your last five seconds of typing determine steady, stop-and-go or dead-stick movement. Each new correct letter can draw a nibble or bite; pause for 5–10 seconds on a nibble. After five seconds without typing, dead-stick movement rolls again, then every five seconds while still. Green letters mark grass cover and promote a candidate by one species rarity tier, capped at Ultra-Rare. Moving toward shore lowers bite odds but shortens the eventual 10-second battle. Backspacing does not reel line back out.</p><p>Wind casts 20% farther; thunderstorms 35%, blizzards 50% and hurricanes 65%. Battle text increases by the same proportions. Interactive retrieval reduces the remaining battle to a minimum of 15%.</p><p>Every fish has a species rarity and an individual quality, from C to SS. Albino catches have pale colors and a special badge. All are possible at either spot.</p><p>Every challenge rolls a bell-shaped WPM adjustment. The most likely adjustment is zero; the tails reach −50 and +10 WPM, with a minimum of 1 WPM.</p><p>Spring, summer, autumn and winter rotate daily at midnight in New York. A lake day lasts 48 minutes, with six eight-minute periods. The moon advances one phase each lake day. Open What’s biting? to explore how these conditions affect the fish.</p><p className="f-footnote">Your livewell, discoveries, statistics, coins, tackle, and settings save in this browser. Clearing browser data clears your journal. System reduced-motion preferences are always respected.</p></div>}
    </FishingDialog>
    <Snackbar open={releaseNotice !== null} autoHideDuration={4500} onClose={() => setReleaseNotice(null)}><Alert severity="success" onClose={() => setReleaseNotice(null)}>{releaseNotice}</Alert></Snackbar>
    {DebugPanel && <Suspense fallback={null}><DebugPanel onInspect={setInspectorOpen} checks={checks} clearChecks={clearChecks} showChecks={showChecks} onShowChecks={setShowChecks} overrides={debugOverrides} onChange={v => { setDebugOverrides(v); overrides.current = v; }} biteNow={biteNow} canBite={game.phase === 'waiting' || game.phase === 'casting' || game.phase === 'retrieving'} onAnimation={setPreview} weather={save.settings.weather} weatherChoice={weatherChoice} naturalWeather={naturalState} season={world.season} onNextNatural={() => updateSave(s => { if (s.settings.weatherMode !== 'natural' || !s.settings.naturalWeather) return s; const next = nextNaturalWeather(s.settings.naturalWeather, Date.now(), seasonAtTime(worldOverrides)); return { ...s, settings: { ...s.settings, weather: next.weather, naturalWeather: next } }; })} onWeather={changeWeather} worldOverrides={worldOverrides} onWorldChange={setWorldOverrides} manifest={sceneForLocation(world.season, save.location)} stormPreview={stormPreview} onStormPreview={setStormPreview} onLightningPreview={() => setLightningPreview(n => n + 1)} /></Suspense>}
  </main></ThemeProvider>;
}




