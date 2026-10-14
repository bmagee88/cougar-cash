import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import FishingGame from '../FishingGame';
import * as encounters from '../engine/encounters';
import { awardCatch, emptySave, SAVE_KEY } from '../engine/storage';
import { BALANCE, SPECIES } from '../engine/config';
import { HAIKU, HAIKU_SOURCE } from '../engine/haiku';
import { STORM_TIMING } from '../engine/weather';
import { WORLD, worldAt } from '../engine/world';
import { biteWaitRange } from '../engine/feeding';
import { startNaturalWeather, WEATHER_DURATIONS } from '../engine/naturalWeather';

declare const test: (name: string, fn: () => void, timeout?: number) => void;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const jest: any;

// CRA's Jest 27 resolver predates router v7 package exports. The navigation
// link is outside these gameplay tests; keep the real game and engine intact.
jest.mock('react-router-dom', () => ({ Link: ({ children, to, ...props }: any) => require('react').createElement('a', { ...props, href: to }, children) }), { virtual: true });

beforeEach(() => {
  jest.useFakeTimers('modern'); localStorage.clear();
  Object.defineProperty(window, 'matchMedia', { writable: true, value: jest.fn().mockImplementation(query => ({ matches: false, media: query, onchange: null, addListener: jest.fn(), removeListener: jest.fn(), addEventListener: jest.fn(), removeEventListener: jest.fn(), dispatchEvent: jest.fn() })) });
  const fish = encounters.generateEncounter(encounters.seededRandom(5), { speciesId: 'sturgeon', quality: 'SS', isAlbino: true, targetWpm: 8 });
  jest.spyOn(encounters, 'generateEncounter').mockImplementation(() => ({ ...fish, phrase: 'calm lake' }));
  jest.spyOn(Math, 'random').mockReturnValue(0);
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
function mount() { return render(<FishingGame />); }
function bite() {
  fireEvent.click(screen.getByRole('button', { name: /Cast your line/ }));
  const minimum = Number(screen.getByText(/^Expected bite wait:/).textContent!.match(/(\d+)–/)![1]);
  act(() => { jest.advanceTimersByTime(BALANCE.castMs + minimum * 1000 + 50); });
}

test('mode setting persists and an interactive haiku focuses, tracks rhythm and saves with a catch',()=>{
  const view=mount();fireEvent.click(screen.getByRole('button',{name:'Settings'}));
  fireEvent.mouseDown(screen.getByRole('combobox',{name:/^Fishing mode/}));
  fireEvent.click(screen.getByRole('option',{name:'Interactive'}));
  expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).settings.fishingMode).toBe('interactive');
  fireEvent.click(screen.getByRole('button',{name:'Close Make yourself at home'}));
  act(()=>jest.advanceTimersByTime(300));view.unmount();
  const {container}=mount();jest.spyOn(Math,'random').mockReturnValue(.99);
  fireEvent.click(screen.getByRole('button',{name:/Cast your line/}));
  act(()=>jest.advanceTimersByTime(900));
  const input=screen.getByRole('textbox',{name:/^Retrieve this haiku:/});
  expect(input).toHaveFocus();const poem=input.getAttribute('aria-label')!.replace('Retrieve this haiku: ','');
  expect(HAIKU.some(haiku=>haiku.text===poem)).toBe(true);
  fireEvent.keyDown(input,{key:poem[0]});act(()=>jest.advanceTimersByTime(200));
  fireEvent.keyDown(input,{key:poem[1]});act(()=>jest.advanceTimersByTime(200));
  expect(screen.getByRole('progressbar',{name:'Line reeled in'}).getAttribute('aria-valuenow')).not.toBe('0');
  act(()=>jest.advanceTimersByTime(5000));expect(screen.getByText('Dead stick',{exact:true})).toBeInTheDocument();
  jest.spyOn(Math,'random').mockReturnValue(0);act(()=>jest.advanceTimersByTime(5000));
  const battle=screen.getByRole('textbox',{name:'Type this phrase: calm lake'});expect(battle).toHaveFocus();
  expect(Number(container.querySelector('.f-water-action')!.getAttribute('data-reel-progress'))).toBeGreaterThan(0);
  'calm lake'.split('').forEach(key=>fireEvent.keyDown(battle,{key}));act(()=>jest.advanceTimersByTime(900));
  const record=JSON.parse(localStorage.getItem(SAVE_KEY)!).livewell[0];
  expect(record.retrieve.phrase).toBe(poem);expect(record.typing.phrase).toBe('calm lake');
  expect(record.retrieve.rhythm).toBe('dead-stick');
});
test('reeling in an empty interactive cast permits mode switching and does not count an escape',()=>{
  const saved=emptySave();saved.settings.fishingMode='interactive';localStorage.setItem(SAVE_KEY,JSON.stringify(saved));
  mount();fireEvent.click(screen.getByRole('button',{name:/Cast your line/}));act(()=>jest.advanceTimersByTime(900));
  expect(screen.getByRole('button',{name:'Settings'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Reel in & recast'}));
  expect(screen.getByRole('heading',{name:'Your lure is back.'})).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Settings'})).toBeEnabled();
  expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).stats.escaped).toBe(0);
  fireEvent.click(screen.getByRole('button',{name:/Cast again/}));
  expect(screen.getByRole('button',{name:/Cast your line/})).toHaveFocus();
});

test('scenic mode hides the HUD, blocks hidden casts and restores the same scenery and save', () => {
  const { container } = mount();
  const scene = container.querySelector('.f-scene');
  const saved = localStorage.getItem(SAVE_KEY);
  fireEvent.click(screen.getByRole('button', { name: 'Scenic mode — hide HUD' }));
  expect(screen.getByRole('button', { name: 'Show HUD' })).toHaveAttribute('aria-pressed', 'true');
  expect(container.querySelector('.f-scene-hud')).toHaveAttribute('hidden');
  expect(screen.queryByRole('button', { name: /Cast your line/ })).toBeNull();
  expect(screen.queryByRole('navigation', { name: 'Fishing menus' })).toBeNull();
  fireEvent.keyDown(window, { code: 'Space', key: ' ' });
  act(() => jest.advanceTimersByTime(30000));
  expect(container.querySelector('.f-lake-frame')).toHaveClass('f-lake-idle');
  fireEvent.click(screen.getByRole('button', { name: 'Show HUD' }));
  expect(screen.getByRole('button', { name: /Cast your line/ })).toBeVisible();
  expect(container.querySelector('.f-scene')).toBe(scene);
  expect(localStorage.getItem(SAVE_KEY)).toBe(saved);
});

test('embedded fullscreen exits with Escape and dialogs stay inside the fullscreen game', async () => {
  const { container, unmount } = mount();
  const originalOverflow = document.body.style.overflow;
  const main = container.querySelector('main')!;
  Object.defineProperty(main, 'requestFullscreen', { configurable: true, value: jest.fn().mockRejectedValue(new Error('Embedded browser')) });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Enter fullscreen' })); });
  expect(main).toHaveClass('f-game-fullscreen');
  expect(document.body.style.overflow).toBe('hidden');
  expect(screen.getByRole('button', { name: 'Exit fullscreen' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'What’s biting?' }));
  expect(screen.getByRole('dialog').closest('main')).toBe(main);
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(main).toHaveClass('f-game-fullscreen');
  act(() => jest.advanceTimersByTime(250));
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(main).not.toHaveClass('f-game-fullscreen');
  expect(document.body.style.overflow).toBe(originalOverflow);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Enter fullscreen' })); });
  unmount(); expect(document.body.style.overflow).toBe(originalOverflow);
});

test('native fullscreen follows browser exits without interrupting an active typing challenge', async () => {
  const { container, unmount } = mount();
  const main = container.querySelector('main')!;
  let fullscreenElement: Element | null = null;
  const originalElement = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');
  const originalExit = Object.getOwnPropertyDescriptor(document, 'exitFullscreen');
  const exit = jest.fn(async () => { fullscreenElement = null; fireEvent(document, new Event('fullscreenchange')); });
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreenElement });
  Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exit });
  Object.defineProperty(main, 'requestFullscreen', { configurable: true, value: jest.fn(async () => { fullscreenElement = main; fireEvent(document, new Event('fullscreenchange')); }) });
  try {
    bite(); const input = screen.getByRole('textbox', { name: 'Type this phrase: calm lake' });
    'calm'.split('').forEach(key => fireEvent.keyDown(input, { key }));
    expect(screen.getByRole('button', { name: 'Scenic mode — hide HUD' })).toBeDisabled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Enter fullscreen' })); });
    expect(fullscreenElement).toBe(main);
    expect(screen.getByRole('textbox', { name: 'Type this phrase: calm lake' })).toBe(input);
    expect(input).toHaveValue('calm');
    act(() => { fullscreenElement = null; fireEvent(document, new Event('fullscreenchange')); });
    expect(screen.getByRole('button', { name: 'Enter fullscreen' })).toBeInTheDocument();
    ' lake'.split('').forEach(key => fireEvent.keyDown(input, { key }));
    act(() => jest.advanceTimersByTime(900));
    expect(screen.getByRole('heading', { name: 'Lake sturgeon' })).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Enter fullscreen' })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Exit fullscreen' })); });
    expect(exit).toHaveBeenCalledTimes(1);
    unmount();
  } finally {
    if (originalElement) Object.defineProperty(document, 'fullscreenElement', originalElement); else delete (document as any).fullscreenElement;
    if (originalExit) Object.defineProperty(document, 'exitFullscreen', originalExit); else delete (document as any).exitFullscreen;
  }
}, 20000);
test('tackle selectors keep valid combinations, persist across reload and lock during a cast', () => {
  const first = mount(); fireEvent.click(screen.getByRole('button', { name: 'Tackle' }));
  const choose = (label: string, option: string) => {
    fireEvent.mouseDown(screen.getByRole('combobox', { name: new RegExp(`^${label}`) }));
    fireEvent.click(screen.getByRole('option', { name: option }));
  };
  expect(screen.getByRole('combobox', { name: /^Lure color/ })).toHaveAttribute('aria-disabled','true');
  choose('Lure or bait type','Spinnerbait'); choose('Lure color','Chartreuse / white'); choose('Rig','Tooth-resistant leader'); choose('Retrieve','Fast retrieve');
  const setup = { lure: 'spinnerbait', color: 'chartreuse', rig: 'leader', retrieve: 'burn' };
  expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).tackle).toEqual(setup);
  expect(screen.getByRole('region', { name: 'Current bite forecast' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close Your tackle box' }));
  first.unmount(); mount();
  fireEvent.click(screen.getByRole('button', { name: 'Tackle' }));
  expect(screen.getByRole('combobox', { name: /^Lure or bait type/ })).toHaveTextContent('Spinnerbait');
  expect(screen.getByRole('combobox', { name: /^Retrieve/ })).toHaveTextContent('Fast retrieve');
  choose('Suggest tackle for','Lake sturgeon');
  fireEvent.click(screen.getByRole('button', { name: 'Use Earthworm / nightcrawler suggestion' }));
  expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).tackle).toMatchObject({ lure: 'worm', rig: 'bottom', color: 'natural' });
  fireEvent.click(screen.getByRole('button', { name: 'Close Your tackle box' }));
  act(() => jest.advanceTimersByTime(300));
  fireEvent.click(screen.getByRole('button', { name: /Cast your line/ }));
  expect(screen.getByRole('button', { name: 'Tackle' })).toBeDisabled();
  expect(screen.getByText(/^Expected bite wait:/)).toBeInTheDocument();
  const minimum = Number(screen.getByText(/^Expected bite wait:/).textContent!.match(/(\d+)–/)![1]);
  act(() => jest.advanceTimersByTime(BALANCE.castMs + minimum * 1000 + 50));
  expect(encounters.generateEncounter).toHaveBeenCalledWith(expect.any(Function), { castDistance: 1 }, expect.objectContaining({ weather: 'sunny', tackle: expect.objectContaining({ lure: 'worm', rig: 'bottom' }) }));
});
test('a storm settling during active typing preserves the challenge and its progress', () => {
  const saved = emptySave(); saved.settings.weather = 'thunderstorm';
  localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
  const { container } = mount(); act(() => jest.advanceTimersByTime(75000)); bite();
  const input = screen.getByRole('textbox', { name: 'Type this phrase: calm lake' });
  'calm'.split('').forEach(key => fireEvent.keyDown(input, { key }));
  act(() => jest.advanceTimersByTime(6500));
  expect(container.querySelector('.f-cloud-system')).toHaveAttribute('data-weather-stage', 'storm');
  expect(screen.getByRole('textbox', { name: 'Type this phrase: calm lake' })).toBe(input);
  expect((input as HTMLInputElement).value).toBe('calm');
  ' lake'.split('').forEach(key => fireEvent.keyDown(input, { key }));
  act(() => jest.advanceTimersByTime(900));
  expect(screen.getByRole('heading', { name: 'Lake sturgeon' })).toBeInTheDocument();
});
test('a natural event changes during typing without resetting the phrase, deadline, gear or lifetime save', () => {
  jest.setSystemTime(Date.parse('2026-10-11T10:00:00-04:00'));
  const save=startNaturalWeather(emptySave(),Date.now(),{},41);
  const wait=biteWaitRange({...worldAt(Date.now()),weather:'sunny',tackle:save.tackle})[0];
  const durationMs=WEATHER_DURATIONS.sunny.min*60000;
  save.settings.naturalWeather={...save.settings.naturalWeather!,durationMs,startedAt:Date.now()-durationMs+BALANCE.castMs+wait+2000,endsAt:Date.now()+BALANCE.castMs+wait+2000};
  localStorage.setItem(SAVE_KEY,JSON.stringify(save));
  mount(); bite(); const input=screen.getByRole('textbox',{name:'Type this phrase: calm lake'});
  'calm'.split('').forEach(key=>fireEvent.keyDown(input,{key}));
  act(()=>jest.advanceTimersByTime(2200));
  expect(input).toHaveValue('calm'); expect(screen.getByRole('textbox',{name:'Type this phrase: calm lake'})).toBe(input);
  const saved=JSON.parse(localStorage.getItem(SAVE_KEY)!);
  expect(saved.settings.weatherMode).toBe('natural'); expect(saved.settings.weather).not.toBe('sunny'); expect(saved.tackle).toEqual(save.tackle);
  expect(saved.balance).toBe(save.balance); expect(saved.stats).toEqual(save.stats);
  ' lake'.split('').forEach(key=>fireEvent.keyDown(input,{key})); act(()=>jest.advanceTimersByTime(900));
  expect(screen.getByRole('heading',{name:'Lake sturgeon'})).toBeInTheDocument();
});

test('a storm expires into rain during typing without changing the text, progress or deadline', () => {
  const save = emptySave();
  const wait = biteWaitRange({ ...worldAt(Date.now()), weather: 'thunderstorm', stormAgeMs: STORM_TIMING.durationMs, tackle: save.tackle })[0];
  save.settings = { ...save.settings, weather: 'thunderstorm', stormStartedAt: Date.now() - STORM_TIMING.durationMs + BALANCE.castMs + wait + 2250 };
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  mount(); bite(); const input = screen.getByRole('textbox', { name: 'Type this phrase: calm lake' });
  'calm'.split('').forEach(key => fireEvent.keyDown(input, { key }));
  act(() => jest.advanceTimersByTime(2500));
  expect(screen.getByRole('textbox', { name: 'Type this phrase: calm lake' })).toBe(input);
  expect(input).toHaveValue('calm');
  const saved = JSON.parse(localStorage.getItem(SAVE_KEY)!);
  expect(saved.settings.weather).toBe('rain'); expect(saved.settings.stormStartedAt).toBeUndefined();
  ' lake'.split('').forEach(key => fireEvent.keyDown(input, { key }));
  act(() => jest.advanceTimersByTime(900));
  expect(screen.getByRole('heading', { name: 'Lake sturgeon' })).toBeInTheDocument();
});
test('a playable cast focuses typing, accepts corrections, reveals and persists exactly one catch', () => {
  mount(); bite(); const input = screen.getByRole('textbox', { name: 'Type this phrase: calm lake' });
  expect(document.activeElement).toBe(input); expect(screen.queryByText('Lake sturgeon')).not.toBeInTheDocument();
  fireEvent.keyDown(input, { key: 'x' }); expect(screen.getByRole('status')).toHaveTextContent('Backspace');
  fireEvent.keyDown(input, { key: 'c' }); expect((input as HTMLInputElement).value).toBe('x');
  fireEvent.keyDown(input, { key: 'Backspace' });
  'calm lake'.split('').forEach(key => fireEvent.keyDown(input, { key }));
  const lapCatch = screen.getByTestId('fishing-lap-catch');
  expect(lapCatch.closest('.f-character')).toBeInTheDocument();
  expect(lapCatch.querySelector('img')).toHaveAttribute('src', expect.stringContaining('sturgeon-albino-painted.png'));
  act(() => { jest.advanceTimersByTime(900); });
  expect(screen.getByTestId('fishing-lap-catch')).toBe(lapCatch);
  expect(screen.getByRole('heading', { name: 'Lake sturgeon' })).toBeInTheDocument();
  expect(screen.getByText('✧ Albino')).toBeInTheDocument(); expect(screen.getByText('Quality SS')).toBeInTheDocument();
  const save = JSON.parse(localStorage.getItem(SAVE_KEY)!); expect(save.livewell).toHaveLength(1); expect(save.stats.caught).toBe(1); expect(save.stats.albinoDiscovered).toContain('sturgeon');
  fireEvent.click(screen.getByRole('button', { name: /Keep in livewell/ })); expect(screen.getByRole('button', { name: /Cast your line/ })).toHaveFocus();
  expect(screen.queryByTestId('fishing-lap-catch')).not.toBeInTheDocument();
});
test('an expired challenge launches the float from its final progress without leaking encounter attributes', () => {
  const { container } = mount(); bite(); const input = screen.getByRole('textbox');
  'calm'.split('').forEach(key => fireEvent.keyDown(input, { key }));
  const float = container.querySelector('.f-bobber')!;
  act(() => { jest.advanceTimersByTime(10100); });
  expect(screen.getByRole('heading', { name: 'The fish got away!' })).toBeInTheDocument();
  expect(container.querySelector('.f-water-escaped')).toHaveAttribute('data-reel-progress', '0.4444');
  expect(container.querySelector('.f-bobber')).toBe(float);
  expect(screen.getByTestId('fishing-escape-splash').children).toHaveLength(16);
  expect(screen.queryByText('Lake sturgeon')).not.toBeInTheDocument(); expect(screen.queryByText('Quality SS')).not.toBeInTheDocument(); expect(screen.queryByText('✧ Albino')).not.toBeInTheDocument();
  const save = JSON.parse(localStorage.getItem(SAVE_KEY)!); expect(save.stats.escaped).toBe(1); expect(save.livewell).toHaveLength(0);
  fireEvent.animationEnd(float);
  expect(container.querySelector('.f-float-group')).not.toBeInTheDocument();
  expect(container.querySelector('.f-fishing-line path')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Cast again/ })); bite();
  expect(container.querySelector('.f-water-action')).toHaveAttribute('data-reel-progress', '0.0000');
  act(() => { jest.advanceTimersByTime(10100); });
  expect(screen.getByTestId('fishing-escape-splash')).toBeInTheDocument();
  act(() => { jest.advanceTimersByTime(1400); });
  expect(container.querySelector('.f-float-group')).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).stats.escaped).toBe(2);
});

test('reduced motion shows the escape result without an airborne float or splash', () => {
  const save = emptySave(); save.settings.reducedMotion = true;
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  const { container } = mount(); bite(); act(() => { jest.advanceTimersByTime(10100); });
  expect(screen.getByRole('heading', { name: 'The fish got away!' })).toBeInTheDocument();
  expect(container.querySelector('.f-float-group')).not.toBeInTheDocument();
  expect(screen.queryByTestId('fishing-escape-splash')).not.toBeInTheDocument();
});
test('correct characters reel the float in, while an error triggers a recoverable struggle', () => {
  const { container } = mount(); bite(); const input = screen.getByRole('textbox');
  const water = () => container.querySelector('.f-water-action')!;
  expect(water()).toHaveAttribute('data-reel-progress', '0.0000');
  'calm'.split('').forEach(key => fireEvent.keyDown(input, { key }));
  expect(water()).toHaveAttribute('data-reel-progress', '0.4444');
  fireEvent.keyDown(input, { key: 'x' });
  expect(water()).toHaveAttribute('data-reel-progress', '0.4444');
  expect(water()).toHaveAttribute('data-line-tension', 'danger');
  expect(screen.getByTestId('fishing-error-splash')).toBeInTheDocument();
  fireEvent.keyDown(input, { key: 'Backspace' });
  act(() => { jest.advanceTimersByTime(720); });
  expect(water()).toHaveAttribute('data-line-tension', 'normal');
  expect(screen.queryByTestId('fishing-error-splash')).not.toBeInTheDocument();
  ' lake'.split('').forEach(key => fireEvent.keyDown(input, { key }));
  expect(water()).toHaveAttribute('data-reel-progress', '1.0000');
  expect(water()).toHaveAttribute('data-line-tension', 'normal');
  expect(container.querySelector('.f-character .f-landed-fish .f-fish-jump')).toBeInTheDocument();
  expect(container.querySelector('.f-float-group .f-fish-jump')).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});
test('reloading keeps individual catches, and release keeps discovery and albino distinctions', () => {
  const first = mount(); bite(); const input = screen.getByRole('textbox'); 'calm lake'.split('').forEach(key => fireEvent.keyDown(input, { key }));
  act(() => { jest.advanceTimersByTime(900); }); first.unmount(); mount();
  fireEvent.click(screen.getByRole('button', { name: /Livewell/ }));
  const fish = screen.getByRole('button', { name: /Lake sturgeon.*Quality SS/ }); fireEvent.click(fish);
  expect(screen.getByRole('heading', { name: 'Lake sturgeon' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Release this fish' })); expect(screen.getByText('Your livewell is empty.')).toBeInTheDocument();
  const save = JSON.parse(localStorage.getItem(SAVE_KEY)!); expect(save.stats.caught).toBe(1); expect(save.stats.albinoDiscovered).toContain('sturgeon');
  fireEvent.click(screen.getByRole('button', { name: 'Close Your livewell' })); act(() => { jest.advanceTimersByTime(300); });
  expect(screen.getByRole('button', { name: /Livewell/ })).toHaveFocus();
});

test('the world clock advances across a moon boundary without resetting an active typing challenge', () => {
  jest.setSystemTime(WORLD.epoch + WORLD.dayMs - 5000);
  const { container } = mount();
  expect(screen.getByTestId('fishing-moon')).toHaveAttribute('data-moon-phase', 'full');
  bite();
  expect(screen.getByTestId('fishing-moon')).toHaveAttribute('data-moon-phase', 'waning-three-quarter');
  const input = screen.getByRole('textbox');
  'calm'.split('').forEach(key => fireEvent.keyDown(input, { key }));
  act(() => { jest.advanceTimersByTime(3000); });
  expect(input).toHaveValue('calm');
  expect(container.querySelector('.f-water-action')).toHaveAttribute('data-reel-progress', '0.4444');
  expect(encounters.generateEncounter).toHaveBeenCalledWith(expect.any(Function), { castDistance: 1 }, expect.objectContaining({ period: 'late-night', moonPhase: 'waning-three-quarter' }));
  act(() => { jest.advanceTimersByTime(7200); });
  expect(screen.getByRole('heading', { name: 'The fish got away!' })).toBeInTheDocument();
});

test('a landed haiku stays with its fish after reload and shows both original lines and typed text', () => {
  const poem = HAIKU.find(p => p.number === 75)!;
  const fish = encounters.generateEncounter(Math.random);
  (encounters.generateEncounter as any).mockReturnValue({ ...fish, phrase: poem.text });
  const first = mount(); bite();
  const input = screen.getByRole('textbox', { name: `Type this phrase: ${poem.text}` });
  Array.from(poem.text).forEach(key => fireEvent.keyDown(input, { key }));
  act(() => jest.advanceTimersByTime(900));
  const saved = JSON.parse(localStorage.getItem(SAVE_KEY)!);
  expect(saved.livewell[0].typing.phrase).toBe(poem.text);
  expect(saved.livewell[0].typing.haiku.author).toBe(poem.author);
  fireEvent.click(screen.getByRole('button', { name: /Keep in livewell/ }));
  first.unmount(); mount();
  fireEvent.click(screen.getByRole('button', { name: /Livewell/ }));
  fireEvent.click(screen.getByRole('button', { name: /Lake sturgeon.*Quality SS/ }));
  expect(screen.getByRole('region', { name: 'The words that landed this fish' })).toBeInTheDocument();
  poem.lines.forEach(line => expect(screen.getByText(line, { exact: true })).toBeVisible());
  expect(screen.getByText(`${poem.author} · translated by ${HAIKU_SOURCE.translator}`)).toBeVisible();
  fireEvent.click(screen.getByText('Text you typed', { exact: true }));
  expect(screen.getByText(poem.text, { exact: true })).toBeVisible();
});

test('release now clears the landed fish and returns to casting while retaining its lifetime rewards', () => {
  mount(); bite(); const input = screen.getByRole('textbox');
  Array.from('calm lake').forEach(key => fireEvent.keyDown(input, { key }));
  act(() => jest.advanceTimersByTime(900));
  expect(screen.getByRole('button', { name: /Keep in livewell/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Release now' }));
  expect(screen.getByRole('button', { name: /Cast your line/ })).toHaveFocus();
  expect(screen.queryByTestId('fishing-lap-catch')).not.toBeInTheDocument();
  expect(screen.getByText('Lake sturgeon released. Your catch and coins stay in your journal.')).toBeInTheDocument();
  const saved = JSON.parse(localStorage.getItem(SAVE_KEY)!);
  expect(saved.livewell).toHaveLength(0);
  expect(saved.stats.caught).toBe(1); expect(saved.stats.albinoDiscovered).toContain('sturgeon');
  expect(saved.balance).toBe(BALANCE.initialBalance + BALANCE.catchCoins);
  expect(saved.awardedIds).toHaveLength(1);
});

test('livewell management selects catches individually or together and persists only the requested releases', () => {
  let saved = emptySave();
  const fish = encounters.generateEncounter(Math.random);
  const performance = { wpm: 45, accuracy: 100, timeRemaining: 2, correctCharacters: 9 };
  SPECIES.slice(0, 3).forEach((species, i) => {
    saved = awardCatch(saved, { ...fish, id: `management-${i}`, species }, performance, `2026-10-12T12:0${i}:00Z`);
  });
  localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
  mount(); fireEvent.click(screen.getByRole('button', { name: /Livewell/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Manage fish' }));
  expect(screen.getByRole('button', { name: 'Release selected' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
  screen.getAllByRole('checkbox').forEach(checkbox => expect(checkbox).toBeChecked());
  fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
  fireEvent.click(screen.getByRole('checkbox', { name: /^Select Bluegill,/ }));
  fireEvent.click(screen.getByRole('button', { name: /Yellow perch.*Quality SS/ }));
  expect(screen.getByRole('checkbox', { name: /^Select Yellow perch,/ })).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Release selected (2)' }));
  const reloaded = JSON.parse(localStorage.getItem(SAVE_KEY)!);
  expect(reloaded.livewell.map((c: any) => c.id)).toEqual(['management-2']);
  expect(reloaded.stats).toEqual(saved.stats); expect(reloaded.balance).toBe(saved.balance);
  expect(screen.getByText(/Released 2 fish/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Release selected' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Done managing' }));
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Black crappie.*Quality SS/ }));
  expect(screen.getByText('calm lake', { exact: true })).toBeVisible();
});
