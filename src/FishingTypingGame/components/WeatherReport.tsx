import React from 'react';
import { WEATHER_DURATIONS, WEATHER_SPECIAL_ROWS, transitionOdds } from '../engine/naturalWeather';
import { NaturalWeatherState, Season, WEATHERS } from '../engine/types';
import { WEATHER_NAMES } from '../engine/weather';
import { SEASON_LABELS } from '../engine/world';

export default function WeatherReport({ season, state }: { season: Season; state?: NaturalWeatherState }) {
  return <div className="f-natural-weather-info">
    {state && <><p><strong>Natural weather · {WEATHER_NAMES[state.weather]}</strong> · {Math.max(0,Math.ceil((state.endsAt-Date.now())/60000))} min remaining · sampled {state.durationMs/60000} min event</p><p>Recent events: {state.history.map(w=>WEATHER_NAMES[w]).join(' → ')}</p><p>Next event: {transitionOdds(state.weather,season,state.history).filter(row=>row.chance>0).map(row=>`${WEATHER_NAMES[row.weather]} ${(row.chance*100).toFixed(1)}%`).join(' · ')}</p></>}
    <details><summary>Weather duration ranges and transition tables</summary>
      <p>One real-world day becomes 48 minutes of play. Bell-shaped durations with rare longer events are calibrated to the averages below. Times are real minutes spent playing. The transition percentages are game estimates informed by weather lifecycles.</p>
      <div className="f-activity-table-wrap"><table className="f-activity-table"><caption>Weather durations</caption><thead><tr><th scope="col">Weather</th><th scope="col">Average</th><th scope="col">Minimum</th><th scope="col">Maximum</th></tr></thead><tbody>{WEATHERS.map(w=>{ const d=WEATHER_DURATIONS[w]; return <tr key={w}><th scope="row">{WEATHER_NAMES[w]}</th><td>{d.mean} min</td><td>{d.min} min</td><td>{d.max} min</td></tr>; })}</tbody></table></div>
      <div className="f-activity-table-wrap"><table className="f-activity-table"><caption>{SEASON_LABELS[season]} · base next-event probabilities (%)</caption><thead><tr><th scope="col">From ↓ / To →</th>{WEATHERS.map(w=><th scope="col" key={w}>{WEATHER_NAMES[w]}</th>)}</tr></thead><tbody>{WEATHERS.map(current=><tr key={current} data-current={state?.weather===current}><th scope="row">{WEATHER_NAMES[current]}</th>{transitionOdds(current,season).map(row=><td key={row.weather} data-probability={row.chance ? 'active' : 'zero'}>{row.chance ? (row.chance*100).toFixed(1) : '0'}</td>)}</tr>)}</tbody></table></div>
      <p>Conditional rows replace the base row when the exact chain matches:</p><ul>{WEATHER_SPECIAL_ROWS.map(row=><li key={row.label}><strong>{row.label}:</strong> {Object.entries(row.weights).map(([w,p])=>`${WEATHER_NAMES[w as keyof typeof WEATHER_NAMES]} ${p}%`).join(' · ')}</li>)}</ul>
      <p>Heat waves are blocked in winter, and their entry weight is one-fifth as large in spring and autumn as in summer. Hurricanes represent rare inland remnants in summer and autumn. Snowfall requires winter plus cold front → rain; blizzard requires winter plus wind → cold front → rain. Thunderstorms require heat wave → cold front and cannot clear directly into sunshine. Excluded probabilities are redistributed among allowed destinations.</p>
      <p>Natural events keep their timing and sequence across reloads and background tabs. A daily season change can end an incompatible event early. Manual weather selections are development/scene previews and bypass natural sequence restrictions.</p>
      <p>Sources: <a href="https://www.weather.gov/spotterguide/life" target="_blank" rel="noreferrer">NWS storm lifecycle</a> · <a href="https://forecast.weather.gov/glossary.php?word=heat+wave" target="_blank" rel="noreferrer">NWS heat waves</a> · <a href="https://www.weather.gov/safety/winter-snow" target="_blank" rel="noreferrer">NWS winter weather</a> · <a href="https://www.aoml.noaa.gov/our-research/hurricane-research-division/extra-tropical-transition/" target="_blank" rel="noreferrer">NOAA hurricane remnants</a></p>
    </details>
  </div>;
}
