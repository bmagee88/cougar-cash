import React, { useState } from 'react';
import { Button, MenuItem, TextField } from '@mui/material';
import { SPECIES } from '../engine/config';
import { biteWaitRange, encounterOdds } from '../engine/feeding';
import { allowedRetrieves, ambientLight, COLORS, LURES, lureFor, normalizeTackle, recommendTackle, RETRIEVES, RIGS, setupLabel, TACKLE_SOURCES, tackleFactors } from '../engine/tackle';
import { FishingConditions, LineGear, LureColor, LureType, Retrieve, RigType, TackleSetup } from '../engine/types';
import { LINE_TESTS, readLineGear } from '../engine/fishFight';
import { MOON_LABELS, PERIOD_LABELS, SEASON_LABELS } from '../engine/world';
import { WEATHER_NAMES } from '../engine/weather';

export function BiteForecast({ conditions }: { conditions: FishingConditions }) {
  const range = biteWaitRange(conditions); const odds = encounterOdds(conditions).sort((a,b) => b.chance - a.chance);
  return <section className="f-bite-forecast" aria-label="Current bite forecast"><div><span>EXPECTED WAIT</span><strong>{range[0] / 1000}–{range[1] / 1000}<small> seconds</small></strong></div><p>Most likely: {odds.slice(0,3).map(row => `${row.species.name} ${(row.chance * 100).toFixed(1)}%`).join(' · ')}</p></section>;
}
export default function TackleBox({ conditions, setup, onChange, interactive = false, lineGear, onLineChange }: { conditions: FishingConditions; setup: TackleSetup; onChange: (setup: TackleSetup) => void; interactive?: boolean; lineGear?:LineGear; onLineChange?:(gear:LineGear)=>void }) {
  const gear=readLineGear(lineGear);
  const [target, setTarget] = useState('bass'); const lure = lureFor(setup.lure);
  const recommendations = recommendTackle(target, conditions); const selected = tackleFactors(target, conditions, setup);
  const match = selected.total / recommendations[0].score;
  const change = (patch: Partial<TackleSetup>) => onChange(normalizeTackle({ ...setup, ...patch }));
  return <div className="f-tackle-box">
    <p className="f-guide-intro">{SEASON_LABELS[conditions.season]} · {PERIOD_LABELS[conditions.period]} · {WEATHER_NAMES[conditions.weather ?? 'sunny']} · {MOON_LABELS[conditions.moonPhase]}</p>
    <p>Choose your presentation before casting. The bait, color, rig and retrieve affect the wait and the fish that bite.</p>
    {interactive && <p>In Interactive mode, your typing rhythm controls the actual retrieve. Type evenly to swim the lure, in bursts to twitch it, or stop for five seconds to dead stick. These forecasts assume the selected presentation; your rhythm changes them during the cast.</p>}
    <div className="f-tackle-selects">
      {onLineChange&&<TextField select label="Fishing line · lb test" value={gear.equipped} onChange={e=>onLineChange({...gear,equipped:Number(e.target.value)})}>{LINE_TESTS.map(lb=><MenuItem key={lb} value={lb}>{lb} lb · {gear.spools[lb].toFixed(0)} m remaining</MenuItem>)}</TextField>}
      <TextField select label="Lure or bait type" value={setup.lure} onChange={e => change({ lure: e.target.value as LureType })}>{LURES.map(l => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}</TextField>
      <TextField select label="Lure color" value={setup.color} disabled={lure.colors.length === 1} onChange={e => change({ color: e.target.value as LureColor })}>{lure.colors.map(color => <MenuItem key={color} value={color}><i className="f-color-swatch" style={{ background: COLORS[color].swatch }} />{COLORS[color].name}</MenuItem>)}</TextField>
      <TextField select label="Rig" value={setup.rig} onChange={e => change({ rig: e.target.value as RigType })}>{lure.rigs.map(rig => <MenuItem key={rig} value={rig}>{RIGS[rig].name}</MenuItem>)}</TextField>
      <TextField select label="Retrieve" value={setup.retrieve} onChange={e => change({ retrieve: e.target.value as Retrieve })}>{allowedRetrieves(setup.lure, setup.rig).map(r => <MenuItem key={r} value={r}>{RETRIEVES[r].name}</MenuItem>)}</TextField>
    </div>
    {onLineChange&&<p className="f-line-description">Fish Fight line: {gear.equipped} lb test · {gear.spools[gear.equipped].toFixed(1)} m remaining. Lighter line gets more nibbles; stronger line tolerates bigger jolts. A snap loses the cast length. Spools save separately; fresh provisions are coming to the shop.</p>}
    <div className="f-tackle-description"><strong>{lure.size}</strong><p>{lure.description}</p><p>{RIGS[setup.rig].detail} {RETRIEVES[setup.retrieve].detail}</p></div>
    <BiteForecast conditions={{ ...conditions, tackle: setup }} />
    <div className="f-tackle-target"><div><h3>Try for a particular fish</h3><p>A suggestion changes your tackle; it does not guarantee a species.</p></div><TextField select size="small" label="Suggest tackle for" value={target} onChange={e => setTarget(e.target.value)}>{SPECIES.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}</TextField></div>
    <p className="f-tackle-match">Your presentation: <strong>{match >= .85 ? 'Strong match' : match >= .5 ? 'Good starting point' : match >= .15 ? 'Less suited to this fish' : 'Try a different bait'}</strong></p>
    <div className="f-tackle-recommendations">{recommendations.map(({ setup: suggested, score }, i) => <article key={suggested.lure}><span className="f-memory-label">{i === 0 ? 'FIRST CHOICE TO TRY' : 'ANOTHER PRESENTATION'}</span><h3>{lureFor(suggested.lure).name}</h3><p>{COLORS[suggested.color].name} · {RIGS[suggested.rig].name}<br />{RETRIEVES[suggested.retrieve].name}</p><Button size="small" variant={i === 0 ? 'contained' : 'outlined'} disabled={setupLabel(setup) === setupLabel(suggested)} onClick={() => onChange(suggested)} aria-label={`Use ${lureFor(suggested.lure).name} suggestion`}>{setupLabel(setup) === setupLabel(suggested) ? 'Equipped' : 'Use this setup'}</Button><small>{score < .1 ? 'Occasional bite only' : 'Matched to these conditions'}</small></article>)}</div>
    <details className="f-feeding-references"><summary>Why these suggestions?</summary>
      <p>{conditions.season === 'winter' ? 'Cold water favors small movements, slow retrieves and longer jerkbait pauses.' : conditions.season === 'spring' ? 'Spring shore activity favors small bait and jigs; minnow-tipped jigs are a useful walleye starting point.' : conditions.season === 'autumn' ? 'Autumn favors baitfish presentations for walleye and larger prey profiles for muskie. Slow presentations still work.' : 'In summer, deeper rigs suit bright daytime fishing; surface lures work better around morning and dusk.'}</p>
      <p>{ambientLight(conditions) < .65 ? 'Dim light favors a modest contrast bonus: black silhouettes or chartreuse and white. Moonlight only affects lure visibility at night, and clouds reduce it.' : 'In brighter light, natural perch, pearl and green pumpkin are useful starting colors for this lake’s assumed clear water.'} Natural bait keeps its own color.</p>
      <p>Cloud cover modestly favors roaming predators; blade flash and vibration help moving lures. Wind and heavy storms make surface poppers less effective. Bottom bait is the useful choice for sturgeon; a leader suits pike and muskie.</p>
      <p>Heat waves favor deeper presentations and cooler hours, especially for pike, muskie and walleye. Cold fronts favor slower retrieves and pauses. Snowfall keeps perch, crappie and walleye comparatively active; blizzards and hurricane remnants reduce overall bites and make surface lures less suited. These responses are game estimates, with season used as a water-temperature proxy.</p>
      <p>These are research-informed game suggestions. The sources do not provide exact odds for every season, hour, moon, weather and lure combination. Water clarity and temperature are not measured here; rain does not automatically turn the lake muddy. Weather appearance uses artistic night filters, while fish activity follows the actual time of day.</p>
      <ul>{TACKLE_SOURCES.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.label}</a></li>)}</ul>
    </details>
    <p className="f-footnote">All tackle is available without spending coins. Your selection saves immediately and stays fixed during a cast.</p>
  </div>;
}
