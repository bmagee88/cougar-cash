import React from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import KrakenSprite,{krakenSpriteAction} from './KrakenAtlasSprite';
import {collectCombatAnimations,CombatAnimation} from './combatAnimation';
import {KRAKEN_ANIMATIONS,KrakenAction} from './krakenAnimationRules';
import {selectDragonCombatAnimation} from './useDragonCombatAnimation';

declare const test:any,expect:any,jest:any,afterEach:any;
afterEach(()=>jest.useRealTimers());
const pose=(kind:Exclude<KrakenAction,'special'>,at=1000):CombatAnimation=>({id:'attack',krakenAttack:kind,state:kind==='tentacleStrike'?'bite':kind==='tentacleSweep'?'tailWhip':'weakAttack',at,duration:KRAKEN_ANIMATIONS[kind].duration});

test.each(['tentacleStrike','tentacleSweep','tidalWave','special'] as KrakenAction[])('%s selects every drawn frame and clamps at recovery',kind=>{
  jest.useFakeTimers();jest.setSystemTime(10000);
  const config=KRAKEN_ANIMATIONS[kind],p=pose(kind==='special'?'tentacleStrike':kind),cast=kind==='special'?{id:'hex',at:1000,until:1000+config.duration}:undefined;
  const view=render(<KrakenSprite width={384} pose={p} cast={cast} inspectFrame={0}/>);
  fireEvent.load(screen.getByTestId(`kraken-preload-${kind}`));
  for(let frame=0;frame<config.frames;frame++) {
    view.rerender(<KrakenSprite width={384} pose={p} cast={cast} inspectFrame={frame}/>);
    const cell=screen.getByTestId('kraken-atlas-cell');
    expect(cell.getAttribute('data-action')).toBe(kind);expect(cell.getAttribute('data-frame-count')).toBe(String(config.frames));
    expect(cell.style.backgroundPosition).toBe(`${frame%config.columns/(config.columns-1)*100}% ${Math.floor(frame/config.columns)/(config.rows-1)*100}%`);
    expect(cell.style.animationName).toBe('none');
  }
  view.rerender(<KrakenSprite width={384} pose={p} cast={cast} inspectFrame={100}/>);
  expect(screen.getByTestId('kraken-atlas-cell').style.backgroundPosition).toBe('100% 100%');
});

test('late loading catches up; health snapshots and responsive resizing keep the same timeline',()=>{
  jest.useFakeTimers();jest.setSystemTime(1100);const p=pose('tentacleSweep'),clock={current:0};
  const view=render(<KrakenSprite width={384} pose={p} clock={clock}/>);
  act(()=>jest.advanceTimersByTime(400));fireEvent.load(screen.getByTestId('kraken-preload-tentacleSweep'));
  const cell=screen.getByTestId('kraken-atlas-cell');expect(cell.style.animationDelay).toBe('-500ms');
  expect(cell.style.backgroundImage).toContain('multi-tentacle.webp');expect(cell.style.animationDuration).toBe('1500ms');
  act(()=>jest.advanceTimersByTime(200));view.rerender(<KrakenSprite width={136} pose={{...p}} clock={clock}/>);
  expect(screen.getByTestId('kraken-atlas-cell')).toBe(cell);expect(cell.style.animationDelay).toBe('-500ms');
  fireEvent.load(screen.getByTestId('kraken-preload-tentacleStrike'));
  act(()=>jest.advanceTimersByTime(810));expect(screen.getByTestId('kraken-atlas-cell').getAttribute('data-action')).toBe('idle');
  expect(screen.getByTestId('kraken-atlas-cell').style.animationName).toBe('none');view.unmount();expect(jest.getTimerCount()).toBe(0);
});

test('quiet overviews stay at rest and never preload the three attack-only sheets',()=>{
  jest.useFakeTimers();jest.setSystemTime(1100);
  render(<KrakenSprite width={384} pose={pose('tidalWave')} cast={{id:'hex',at:1000,until:2600}} quiet/>);
  fireEvent.load(screen.getByTestId('kraken-preload-tentacleStrike'));
  expect(screen.queryByTestId('kraken-preload-special')).toBeNull();expect(screen.queryByTestId('kraken-preload-tidalWave')).toBeNull();
  expect(screen.getByTestId('kraken-atlas-cell').getAttribute('data-action')).toBe('idle');expect(screen.queryByTestId('kraken-special-glow')).toBeNull();
});

test('gold casting yields to the scheduled tentacle action; defeat overrides both',()=>{
  const p=pose('tentacleSweep',2600),cast={id:'hex',at:1000,until:2600};
  expect(krakenSpriteAction(p,1200,cast)?.kind).toBe('special');expect(krakenSpriteAction(p,2600,cast)?.kind).toBe('tentacleSweep');
  expect(krakenSpriteAction({...p,state:'death'},1200,cast)).toBeNull();expect(krakenSpriteAction(p,1200,cast,true)).toBeNull();
});

test('server projectile actions use their Kraken durations and a protected wave holds all twenty frames',()=>{
  for(const kind of ['tentacleStrike','tentacleSweep','tidalWave'] as const){
    const events=collectCombatAnimations([{id:'shot',source:'boss',target:'hero',kind:'boss',bossId:'kraken',bossAttack:kind,startedAt:1000,impactAt:1000+KRAKEN_ANIMATIONS[kind].impact,result:'pending'} as any]).get('boss')!;
    expect(events[0].duration).toBe(KRAKEN_ANIMATIONS[kind].duration);expect(events[0].krakenAttack).toBe(kind);
  }
  const wave={id:'wave',at:1000,until:3200,krakenAttack:'tidalWave' as const},hurt={id:'crit',tier:'critical' as const,at:1100,until:2300};
  const p=selectDragonCombatAnimation([],hurt,3199,false,wave);
  expect(p.krakenAttack).toBe('tidalWave');expect(p.nextAt).toBe(3200);expect(p.duration).toBe(2200);
  expect(selectDragonCombatAnimation([],hurt,3200,false,wave).state).toBe('idle');
});
