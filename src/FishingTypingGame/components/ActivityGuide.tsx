import React, { useState } from 'react';
import { MenuItem, TextField } from '@mui/material';
import { SPECIES } from '../engine/config';
import { encounterOdds, FEEDING_NOTES, FEEDING_SOURCES, feedingMultiplier } from '../engine/feeding';
import { DAY_PERIODS, FishingConditions, MOON_PHASES, MoonPhase, SEASONS, Season, Weather, WEATHERS, WorldConditions } from '../engine/types';
import { gameClock, MOON_LABELS, PERIOD_LABELS, SEASON_LABELS } from '../engine/world';
import { setupLabel, weatherMultiplier } from '../engine/tackle';
import { WEATHER_NAMES } from '../engine/weather';
import { BiteForecast } from './TackleBox';

export default function ActivityGuide({ world, conditions = world }: { world: WorldConditions; conditions?: FishingConditions }) {
  const [season, setSeason] = useState<Season>(world.season);
  const [moon, setMoon] = useState<MoonPhase>(world.moonPhase);
  const [weather, setWeather] = useState<Weather>(conditions.weather ?? 'sunny');
  return <div className="f-activity-guide">
    <p className="f-guide-intro">{SEASON_LABELS[world.season]} · {PERIOD_LABELS[world.period]} · {gameClock(world.hour)} · {MOON_LABELS[world.moonPhase]}</p>
    <h3>Your next bite</h3><p>These are the current game encounter odds. Every species remains possible; quality and albino rolls stay independent.</p>
    {conditions.tackle && <p>{setupLabel(conditions.tackle)} · {WEATHER_NAMES[conditions.weather ?? 'sunny']}</p>}
    <BiteForecast conditions={conditions} />
    <div className="f-odds-grid">{encounterOdds(conditions).map(({ species, chance }) => <div key={species.id}><span>{species.name}</span><strong>{(chance * 100).toFixed(2)}%</strong></div>)}</div>
    <h3>Plan your next cast</h3><p>Explore relative feeding activity. A larger number means more activity compared with that fish’s baseline. These research-informed game weights are estimates, rather than measured feeding percentages.</p>
    <div className="f-activity-selects"><TextField select size="small" label="Explore season" value={season} onChange={e => setSeason(e.target.value as Season)}>{SEASONS.map(s => <MenuItem key={s} value={s}>{SEASON_LABELS[s]}</MenuItem>)}</TextField><TextField select size="small" label="Explore moon" value={moon} onChange={e => setMoon(e.target.value as MoonPhase)}>{MOON_PHASES.map(p => <MenuItem key={p} value={p}>{MOON_LABELS[p]}</MenuItem>)}</TextField><TextField select size="small" label="Explore weather" value={weather} onChange={e => setWeather(e.target.value as Weather)}>{WEATHERS.map(w => <MenuItem key={w} value={w}>{WEATHER_NAMES[w]}</MenuItem>)}</TextField></div>
    <div className="f-activity-table-wrap"><table className="f-activity-table"><caption>{SEASON_LABELS[season]} · {MOON_LABELS[moon]} · {WEATHER_NAMES[weather]} · activity before tackle</caption><thead><tr><th scope="col">Species</th>{DAY_PERIODS.map(p => <th scope="col" key={p}>{PERIOD_LABELS[p]}</th>)}</tr></thead><tbody>{SPECIES.map(s => <tr key={s.id}><th scope="row">{s.name}</th>{DAY_PERIODS.map(period => { const explored = { season, period, moonPhase: moon, weather }; const value = feedingMultiplier(s.id, explored) * weatherMultiplier(s.id, explored); return <td key={period} data-activity={value >= 1.2 ? 'high' : value < .6 ? 'low' : 'normal'}>{value.toFixed(2)}×</td>; })}</tr>)}</tbody></table></div>
    <p className="f-footnote">A lake day lasts 48 minutes; each period lasts eight minutes. Seasons change at New York midnight, and the moon advances one phase per lake day. Time, season, moon, weather and your tackle affect both the wait and species odds. Explore controls change this table only.</p>
    <details className="f-feeding-references"><summary>Species notes and research</summary>{SPECIES.map(s => <p key={s.id}><strong>{s.name}:</strong> {FEEDING_NOTES[s.id]}</p>)}<p>Lunar effects are modest for walleye, pike and muskellunge. The other species use neutral moon weights where clear feeding evidence is unavailable. Catch and movement studies help estimate activity but also reflect habitat and fishing effort.</p><ul>{FEEDING_SOURCES.map(s => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></li>)}</ul></details>
  </div>;
}
