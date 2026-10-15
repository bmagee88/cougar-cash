import React, { useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogContent, DialogTitle, IconButton, MenuItem, TextField, Tab, Tabs } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { BALANCE, LOCATIONS, RARITY_COLORS, SPECIES } from '../engine/config';
import { CatchRecord, QUALITIES, RARITIES, SaveData } from '../engine/types';
import { RETRIEVES, setupLabel } from '../engine/tackle';
import { HAIKU_BY_TEXT, HAIKU_SOURCE } from '../engine/haiku';
import { RHYTHM_LABELS } from '../engine/interactive';
import { MOON_LABELS, PERIOD_LABELS, SEASON_LABELS } from '../engine/world';
import { WEATHER_NAMES } from '../engine/weather';
import FishArtwork from './FishArtwork';
import FishInspection from './FishInspection';
import CatchNotebook, { NotebookEditor, RecordedMeasurements, SaveNote } from './CatchNotebook';
import { blankEntry, catchImage, notebookEntries } from '../engine/notebook';
import { formatLength, formatWeight } from '../engine/specimens';
import FieldGuide, { guideDiscoveries } from './FieldGuide';

export function FishingDialog({ title, open, onClose, children, container }: { title: string; open: boolean; onClose: () => void; children: React.ReactNode; container?: () => HTMLElement | null }) {
  return <Dialog container={container} open={open} onClose={onClose} fullWidth maxWidth="md" className="f-dialog" aria-labelledby="f-dialog-title">
    <DialogTitle id="f-dialog-title" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>{title}<IconButton onClick={onClose} aria-label={`Close ${title}`}><CloseIcon /></IconButton></DialogTitle>
    <DialogContent>{children}</DialogContent>
  </Dialog>;
}
export function FishBadges({ rarity, quality, albino, hideQuality=false }: { rarity: CatchRecord['rarity']; quality: CatchRecord['quality']; albino: boolean; hideQuality?:boolean }) {
  return <div className="f-fish-badges"><span style={{ color: RARITY_COLORS[rarity], borderColor: RARITY_COLORS[rarity] }}>{rarity}</span>{!hideQuality&&<span className={`f-quality f-quality-${quality}`}>Quality {quality}</span>}{albino && <span className="f-albino-badge">✧ Albino</span>}</div>;
}
export function PerformanceRow({ wpm, accuracy, timeRemaining }: { wpm: number; accuracy: number; timeRemaining: number }) {
  return <div className="f-performance"><div><strong>{wpm.toFixed(1)}</strong><span>WPM</span></div><div><strong>{accuracy}%</strong><span>accuracy</span></div><div><strong>{timeRemaining.toFixed(1)}s</strong><span>to spare</span></div></div>;
}
export function CatchMemory({ record }: { record: CatchRecord }) {
  const memory = record.typing;
  const retrievePoem=record.retrieve && HAIKU_BY_TEXT.get(record.retrieve.phrase);
  if (!memory) return <p className="f-footnote">Typing text wasn’t recorded for this older catch.</p>;
  return <section className="f-catch-memory" aria-label="The words that landed this fish">
    <span className="f-memory-label">{memory.haiku ? 'THE HAIKU THAT LANDED THIS FISH' : 'THE WORDS THAT LANDED THIS FISH'}</span>
    <blockquote>{memory.haiku ? memory.haiku.lines.map((line, i) => <span key={i}>{line}</span>) : memory.phrase}</blockquote>
    {memory.haiku && <><p className="f-memory-credit">{memory.haiku.author} · translated by {memory.haiku.translator}</p>
      <details><summary>Text you typed</summary><p className="f-memory-typed">{memory.phrase}</p></details></>}
    {retrievePoem && record.retrieve && <details className="f-retrieve-memory"><summary>The haiku you retrieved</summary><blockquote>{retrievePoem.lines.map((line,i)=><span key={i}>{line}</span>)}</blockquote><p className="f-memory-credit">{retrievePoem.author} · translated by {HAIKU_SOURCE.translator}</p><p>Interactive · {Math.round(record.retrieve.reeled*100)}% reeled · {RHYTHM_LABELS[record.retrieve.rhythm]}{record.retrieve.grass ? ' · grass cover' : ''}{record.conditions?.observedRetrieve && ` · ${RETRIEVES[record.conditions.observedRetrieve].name}`}</p></details>}
  </section>;
}
export function Livewell({ save, onRelease, onReleaseMany, onSaveNote }: { save: SaveData; onRelease: (id: string) => void; onReleaseMany: (ids: readonly string[]) => void; onSaveNote:SaveNote }) {
  const hidden=save.settings.hideFishDetails!==false,units=save.settings.measurements??'imperial',entries=notebookEntries(save);
  const [selected, setSelected] = useState<string | null>(null); const [sort, setSort] = useState('recent');
  const [managing, setManaging] = useState(false); const [marked, setMarked] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const markedIds = marked.filter(id => save.livewell.some(c => c.id === id));
  const toggle = (id: string) => setMarked(ids => ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]);
  const releaseNotice = (count: number) => setNotice(`Released ${count === 1 ? '1 fish' : `${count} fish`}. Your discoveries, catch totals and coins stay in your journal.`);
  const record = save.livewell.find(c => c.id === selected);
  if (record) {
    const species = SPECIES.find(s => s.id === record.speciesId)!;
    const note=(entries.find(e=>e.id===record.id)??blankEntry(record.id,record.caughtAt,record.location,catchImage(record))),label=hidden?(note.name||'Unidentified catch'):species.name;
    return <div className="f-fish-detail"><Button onClick={() => setSelected(null)}>← Back to livewell</Button>
      <div className="f-fish-detail-grid"><div className="f-fish-identity">
        <FishInspection fish={{...record,species}} units={units} label={label}/>
        <h2>{label}</h2>{!hidden&&<i>{species.scientificName}</i>}<FishBadges rarity={record.rarity} quality={record.quality} albino={record.isAlbino} hideQuality={hidden}/>
        {!hidden&&<><p>{species.description}</p><div className="f-measurements"><span>{formatLength(record.lengthCm,units)}</span><span>{formatWeight(record.weightKg,units)}</span></div></>}
        {hidden&&<RecordedMeasurements entry={note} units={units}/>}
        <PerformanceRow {...record} /><p className="f-muted">Caught at {LOCATIONS.find(l => l.id === record.location)?.spot || 'Cedar Lake'} · {new Date(record.caughtAt).toLocaleString()}</p>
      </div><div className="f-fish-story"><NotebookEditor key={`${note.id}-${units}`} entry={note} units={units} onSave={onSaveNote} discoveries={guideDiscoveries(save)}/><CatchMemory record={record} />
        {record.conditions && <section className="f-catch-setup" aria-label="Conditions and tackle for this catch"><span className="f-memory-label">THE CAST THAT LANDED THIS FISH</span><p>{SEASON_LABELS[record.conditions.season]} · {PERIOD_LABELS[record.conditions.period]} · {MOON_LABELS[record.conditions.moonPhase]}{record.conditions.weather && ` · ${WEATHER_NAMES[record.conditions.weather]}`}</p>{record.conditions.tackle && <p>{setupLabel(record.conditions.tackle)}</p>}</section>}
        <Button color="inherit" variant="outlined" onClick={() => { onRelease(record.id); setSelected(null); releaseNotice(1); }}>Release this fish</Button><p className="f-footnote">Your discovery, lifetime records and earned coins stay in your journal.</p>
      </div></div>
    </div>;
  }
  const catches = [...save.livewell].sort((a, b) => sort === 'rarity' ? RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity) : b.caughtAt.localeCompare(a.caughtAt));
  return <><div className="f-panel-toolbar f-livewell-toolbar"><p>{save.livewell.length} / {BALANCE.livewellCapacity} fish · a record of your time on the lake</p><div className="f-livewell-controls"><TextField select size="small" label="Sort catches" value={sort} onChange={e => setSort(e.target.value)}><MenuItem value="recent">Newest first</MenuItem><MenuItem value="rarity">Rarity</MenuItem></TextField><Button variant={managing ? 'contained' : 'outlined'} disabled={!catches.length && !managing} onClick={() => { setManaging(!managing); setMarked([]); }}>{managing ? 'Done managing' : 'Manage fish'}</Button></div></div>
    {notice && <Alert severity="success" role="status" onClose={() => setNotice(null)} className="f-release-notice">{notice}</Alert>}
    {managing && <div className="f-livewell-management"><div><strong>Select fish to release</strong><span>{markedIds.length} selected</span></div><Button disabled={!catches.length} onClick={() => setMarked(markedIds.length === catches.length ? [] : catches.map(c => c.id))}>{markedIds.length === catches.length && catches.length ? 'Clear selection' : 'Select all'}</Button><Button variant="contained" disabled={!markedIds.length} onClick={() => { onReleaseMany(markedIds); releaseNotice(markedIds.length); setMarked([]); }}>Release selected{markedIds.length ? ` (${markedIds.length})` : ''}</Button></div>}
    {!catches.length ? <div className="f-empty"><span>≈</span><h3>{save.stats.caught ? 'Your livewell is empty.' : 'Your first catch is out there.'}</h3><p>{save.stats.caught ? 'Cast again to keep a fish and the words that landed it.' : 'Cast a line and type the phrase before the clock runs out.'}</p></div> : <div className={`f-fish-grid ${managing ? 'f-managing' : ''}`}>{catches.map(c => {
      const s = SPECIES.find(f => f.id === c.speciesId)!;
      const ordinal=save.awardedIds.includes(c.id)?save.awardedIds.indexOf(c.id)+1:save.livewell.indexOf(c)+1;
      const note=entries.find(e=>e.id===c.id),label=hidden?(note?.name||`Catch ${ordinal}`):s.name;
      const checked = markedIds.includes(c.id);
      return <article className={`f-livewell-card ${checked ? 'f-livewell-card-selected' : ''}`} key={c.id}>
        {managing && <Checkbox className="f-fish-select" checked={checked} onChange={() => toggle(c.id)} inputProps={{ 'aria-label': hidden?`Select ${label}`:`Select ${s.name}, ${formatLength(c.lengthCm,units)}, quality ${c.quality}` }} />}
        <button className={`f-fish-card ${c.isAlbino ? 'f-albino-card' : ''}`} aria-pressed={managing ? checked : undefined} onClick={() => managing ? toggle(c.id) : setSelected(c.id)}><FishArtwork fish={{...c,species:s}} label={hidden?'Your catch':s.name}/><h3>{label}</h3><FishBadges rarity={c.rarity} quality={c.quality} albino={c.isAlbino} hideQuality={hidden}/>{hidden?<RecordedMeasurements entry={note} units={units}/>:<p>{formatLength(c.lengthCm,units)} · {formatWeight(c.weightKg,units)}</p>}{c.typing && <span className="f-memory-tag">{c.typing.haiku ? `Haiku · ${c.typing.haiku.author}` : 'Typing text saved'}</span>}<small>{managing ? checked ? 'Selected for release' : 'Select for release' : 'Inspect catch ↗'}</small></button>
      </article>;
    })}</div>}</>;
}
export function FishingStats({ save }: { save: SaveData }) {
  const s = save.stats;
  const hidden=save.settings.hideFishDetails!==false,units=save.settings.measurements??'imperial';
  const attempts = s.caught + s.escaped;
  const stats = [['Landed', s.caught], ['Escaped', s.escaped], ['Species discovered', `${s.discovered.length} / ${SPECIES.length}`], ['Albino catches', s.albinos], ['Best typing', `${s.bestWpm.toFixed(1)} WPM`], ['Average typing', `${(attempts ? s.totalWpm / attempts : 0).toFixed(1)} WPM`], ['Longest streak', s.longestStreak], ['Current streak', s.currentStreak]];
  return <><div className="f-stats-grid">{stats.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="f-stat-tables"><div><h3>Catches by rarity</h3>{RARITIES.map(r => <div className="f-stat-line" key={r}><span style={{ color: RARITY_COLORS[r] }}>{r}</span><b>{s.byRarity[r]}</b></div>)}</div>{!hidden&&<div><h3>Catches by quality</h3>{QUALITIES.map(q => <div className="f-stat-line" key={q}><span>Quality {q}</span><b>{s.byQuality[q]}</b></div>)}</div>}</div>
    {!hidden&&<><h3 className="f-section-label">Personal bests by species</h3>{s.discovered.length ? s.discovered.map(id => <div className="f-stat-line" key={id}><span>{SPECIES.find(f => f.id === id)?.name}</span><b>{formatLength(s.largest[id]?.lengthCm||0,units)} · {formatWeight(s.largest[id]?.weightKg||0,units)}</b></div>) : <p className="f-muted">Land a fish to start your record book.</p>}</>}
  </>;
}
export function CollectionIndex({ save, onSaveNote, onDeleteNote }: { save: SaveData; onSaveNote:SaveNote; onDeleteNote:(id:string)=>void }) {
  const [tab, setTab] = useState(0);
  return <><Tabs value={tab} onChange={(_, v) => setTab(v)} aria-label="Collection views" variant="scrollable" scrollButtons="auto"><Tab label={`Field guide · ${save.stats.discovered.length}/${SPECIES.length}`} /><Tab label="Lifetime statistics"/><Tab label="My notebook"/></Tabs>
    {tab===2?<CatchNotebook entries={notebookEntries(save)} units={save.settings.measurements??'imperial'} onSave={onSaveNote} onDelete={onDeleteNote} location={save.location} discoveries={guideDiscoveries(save)}/>:tab === 1 ? <FishingStats save={save} /> : <FieldGuide discoveries={guideDiscoveries(save)}/>}
  </>;
}
