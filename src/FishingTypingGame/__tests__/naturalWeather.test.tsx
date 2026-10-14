import React from 'react';
import { act, render } from '@testing-library/react';
import { biteWaitRange, encounterOdds } from '../engine/feeding';
import { advanceNaturalWeather, DURATION_DISTRIBUTIONS, nextNaturalWeather, readNaturalWeather, seasonAtTime, startNaturalWeather, transitionOdds, WEATHER_DURATIONS, weatherAllowed, weatherDuration } from '../engine/naturalWeather';
import { deserializeSave, emptySave } from '../engine/storage';
import { NaturalWeatherState, SEASONS, Weather, WEATHERS } from '../engine/types';
import { lightningIntervalAt, stormLightningTimes, weatherVisuals } from '../engine/weather';
import { useNaturalWeather } from '../useNaturalWeather';
import FishingScene from '../scene/FishingScene';
import { worldAt } from '../engine/world';

declare const test: any, expect: any, jest: any;
const minute=60000; const epoch=Date.parse('2026-10-11T12:00:00-04:00');
const chance=(current: Weather, target: Weather, season='summer' as typeof SEASONS[number], history: Weather[]=[current])=>transitionOdds(current,season,history).find(row=>row.weather===target)!.chance;
function fixture(weather: Weather, history: Weather[], season='summer' as typeof SEASONS[number]): NaturalWeatherState {
  const durationMs=WEATHER_DURATIONS[weather].mean*minute;
  return { weather,history,season,startedAt: epoch,durationMs,endsAt: epoch+durationMs,seed: 123 };
}
test('duration distributions have the exact scaled averages, bounded support, bell core and reachable long events', () => {
  WEATHERS.forEach(weather=>{
    const d=WEATHER_DURATIONS[weather]; const rows=DURATION_DISTRIBUTIONS[weather];
    expect(rows.reduce((sum,row)=>sum+row.chance,0)).toBeCloseTo(1,10);
    expect(rows.reduce((sum,row)=>sum+row.minutes*row.chance,0)).toBeCloseTo(d.mean,8);
    expect(weatherDuration(weather,()=>0)).toBe(d.min*minute); expect(weatherDuration(weather,()=>1-Number.EPSILON)).toBe(d.max*minute);
    const mode=rows.reduce((best,row)=>row.chance>best.chance ? row : best);
    expect(Math.abs(mode.minutes-d.mean)).toBeLessThan(d.spread+2);
    expect(rows.filter(row=>row.minutes >= d.max*.75).reduce((sum,row)=>sum+row.chance,0)).toBeGreaterThan(0);
  });
  expect(WEATHER_DURATIONS.rain).toMatchObject({ mean:24,max:192 });
  expect(WEATHER_DURATIONS.heatwave.min).toBe(48*2);
});
test('every transition row is normalized and forbidden season and sequence entries stay zero', () => {
  SEASONS.forEach(season=>WEATHERS.forEach(current=>{
    const rows=transitionOdds(current,season);
    expect(rows.reduce((sum,row)=>sum+row.chance,0)).toBeCloseTo(1,10);
    expect(rows.every(row=>Number.isFinite(row.chance) && row.chance>=0)).toBe(true);
    rows.filter(row=>!weatherAllowed(row.weather,season)).forEach(row=>expect(row.chance).toBe(0));
    expect(chance(current,'thunderstorm',season)).toBe(0);
    expect(chance(current,'snowfall',season)).toBe(0);
    expect(chance(current,'blizzard',season)).toBe(0);
  }));
  expect(chance('thunderstorm','sunny')).toBe(0); expect(chance('thunderstorm','rain')).toBe(.65);
  expect(chance('sunny','heatwave','winter')).toBe(0);
  expect(chance('sunny','heatwave','spring')).toBeLessThan(chance('sunny','heatwave','summer'));
});
test('exact predecessor chains activate only their conditional rows', () => {
  expect(chance('cold-front','thunderstorm','summer',['heatwave','cold-front'])).toBe(.55);
  expect(chance('cold-front','thunderstorm','summer',['heatwave','wind','cold-front'])).toBe(0);
  expect(chance('rain','snowfall','winter',['cold-front','rain'])).toBe(.6);
  expect(chance('rain','snowfall','winter',['cold-front','overcast','rain'])).toBe(0);
  expect(chance('rain','blizzard','winter',['wind','cold-front','rain'])).toBe(.35);
  expect(chance('rain','blizzard','winter',['wind','overcast','cold-front','rain'])).toBe(0);
  expect(chance('rain','snowfall','summer',['cold-front','rain'])).toBe(0);
  expect(chance('rain','blizzard','summer',['wind','cold-front','rain'])).toBe(0);
  expect(chance('blizzard','snowfall','winter',['wind','cold-front','rain','blizzard'])).toBe(0);
});
test('seeded natural sequences respect history and recover identically after reload and missed events', () => {
  const beginning=startNaturalWeather(emptySave(),epoch,{season:'summer'},12345);
  let state=beginning.settings.naturalWeather!;
  for (let i=0;i<800;i++) {
    const prior=state; state=nextNaturalWeather(prior,prior.endsAt,()=> 'summer');
    expect(chance(prior.weather,state.weather,'summer',prior.history)).toBeGreaterThan(0);
    expect(state.startedAt).toBe(prior.endsAt); expect(state.durationMs).toBeGreaterThanOrEqual(WEATHER_DURATIONS[state.weather].min*minute);
    expect(readNaturalWeather(state)).toEqual(state);
  }
  const later=epoch+10*24*60*minute;
  const direct=advanceNaturalWeather(beginning,later,{season:'summer'});
  let stepped=beginning;
  while (later>=stepped.settings.naturalWeather!.endsAt) stepped=advanceNaturalWeather(stepped,stepped.settings.naturalWeather!.endsAt,{season:'summer'});
  expect(stepped.settings.naturalWeather).toEqual(direct.settings.naturalWeather);
  expect(advanceNaturalWeather(deserializeSave(JSON.stringify(beginning)),later,{season:'summer'})).toEqual(direct);
  expect(advanceNaturalWeather(direct,later,{season:'summer'})).toBe(direct);
  expect(direct.stats).toEqual(beginning.stats); expect(direct.balance).toBe(beginning.balance);
});
test('winter chains produce valid saved snow and blizzard states, and malformed histories recover safely', () => {
  let snow=false,blizzard=false; let state=fixture('wind',['sunny','wind'],'winter');
  for (let i=0;i<2000;i++) {
    const prior=state; state=nextNaturalWeather(prior,prior.endsAt,()=> 'winter');
    expect(chance(prior.weather,state.weather,'winter',prior.history)).toBeGreaterThan(0);
    expect(readNaturalWeather(state)).toEqual(state);
    snow ||= state.weather==='snowfall'; blizzard ||= state.weather==='blizzard';
    expect(state.weather).not.toBe('heatwave'); expect(state.weather).not.toBe('hurricane'); expect(state.weather).not.toBe('thunderstorm');
  }
  expect(snow && blizzard).toBe(true);
  expect(readNaturalWeather({...fixture('blizzard',['cold-front','rain','blizzard'],'winter')})).toBeUndefined();
  const saved=emptySave(); saved.settings={...saved.settings,weatherMode:'natural',naturalWeather:{...state, durationMs:NaN}};
  const read=deserializeSave(JSON.stringify(saved)); expect(read.settings.naturalWeather).toBeUndefined();
  expect(advanceNaturalWeather(read,epoch).settings.naturalWeather).toBeDefined();
});
test('an autumn heat wave ends at New York winter midnight and cannot leak into winter', () => {
  const now=Date.parse('2026-10-12T23:50:00-04:00');
  const midnight=Date.parse('2026-10-13T00:00:00-04:00');
  let natural=startNaturalWeather(emptySave(),now,{},50); const heat=fixture('heatwave',['sunny','heatwave'],'autumn');
  // A legitimately sampled heat event uses the same seasonal deadline helper.
  let front=fixture('sunny',['sunny'],'autumn'); front.startedAt=now;front.endsAt=now;
  let heatStart: NaturalWeatherState | undefined;
  for (let seed=0;seed<10000&&!heatStart;seed++) { const candidate=nextNaturalWeather({...front,seed},now,seasonAtTime()); if(candidate.weather==='heatwave') heatStart=candidate; }
  expect(heatStart).toBeDefined(); expect(heatStart!.endsAt).toBe(midnight);
  natural={...natural,settings:{...natural.settings,weather:'heatwave',naturalWeather:heatStart!}};
  const next=advanceNaturalWeather(natural,midnight+1);
  expect(next.settings.weather).not.toBe('heatwave'); expect(next.settings.naturalWeather!.startedAt).toBe(midnight);
  expect(advanceNaturalWeather({...natural,settings:{...natural.settings,naturalWeather:heat}},now,{season:'winter'}).settings.weather).not.toBe('heatwave');
});
test('variable-duration thunderstorms preserve the flash curve and quiet final quarter', () => {
  const duration=30*minute;
  expect(lightningIntervalAt(0,duration)).toBe(90000); expect(lightningIntervalAt(duration/2,duration)).toBe(30000);
  expect(lightningIntervalAt(duration*.75,duration)).toBeUndefined();
  expect(stormLightningTimes(duration).every(t=>t<duration*.75)).toBe(true);
  expect(weatherVisuals('thunderstorm',duration*.8,duration)).toMatchObject({stage:'easing',lightning:false,complete:false});
  expect(weatherVisuals('thunderstorm',duration,duration).complete).toBe(true);
});
test('new weather affects bite forecasts, habitat presentation and distinct snow or severe-rain visuals', () => {
  const c={season:'summer' as const,period:'afternoon' as const,moonPhase:'full' as const,weather:'sunny' as const};
  expect(biteWaitRange({...c,weather:'heatwave'})[0]).toBeGreaterThan(biteWaitRange(c)[0]);
  expect(encounterOdds({...c,weather:'cold-front'})).not.toEqual(encounterOdds(c));
  expect(biteWaitRange({...c,weather:'hurricane'})[1]).toBeGreaterThan(biteWaitRange(c)[1]);
  expect(weatherVisuals('snowfall')).toMatchObject({snow:.4,rain:0,lightning:false});
  expect(weatherVisuals('blizzard')).toMatchObject({snow:1,wind:1,fog:1,lightning:false});
  expect(weatherVisuals('hurricane')).toMatchObject({rain:1,wind:1,snow:0,fog:1});
  const props={game:{phase:'idle' as const},location:'dock',world:worldAt(epoch,{season:'winter'}),reducedMotion:true};
  const view=render(<FishingScene {...props} weather="blizzard" />);
  expect(view.getByTestId('weather-snow').children).toHaveLength(90); expect(view.container.querySelector('.f-storm-fog')).toHaveStyle({opacity:'1'});
  view.rerender(<FishingScene {...props} weather="hurricane" />); expect(view.queryByTestId('weather-snow')).toBeNull(); expect(view.container.querySelectorAll('.f-raindrop')).toHaveLength(760);
});
test('the natural weather hook catches up on visibility, preserves state on rerender and removes its timer', () => {
  jest.useFakeTimers('modern'); jest.setSystemTime(epoch);
  const save=startNaturalWeather(emptySave(),epoch,{season:'summer'},7); const update=jest.fn();
  function Probe() { useNaturalWeather(save,update); return null; }
  try {
    const view=render(<Probe />); expect(jest.getTimerCount()).toBe(1); expect(update).not.toHaveBeenCalled();
    view.rerender(<Probe />); expect(jest.getTimerCount()).toBe(1);
    jest.setSystemTime(save.settings.naturalWeather!.endsAt+1);
    act(()=>document.dispatchEvent(new Event('visibilitychange'))); expect(update).toHaveBeenCalledTimes(1);
    const applied=update.mock.calls[0][0](save); expect(applied.settings.naturalWeather!.startedAt).toBe(save.settings.naturalWeather!.endsAt);
    view.unmount(); expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});
