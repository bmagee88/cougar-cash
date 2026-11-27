import React from 'react';
import {act,render,screen,within} from '@testing-library/react';
import WyrmSprite,{wyrmVisual} from './WyrmVisuals';
import {DragonPortrait} from './TypingPortrait';
import {BattleScene,PlayerTypingBattle} from './TypingBossApp';
import {CombatAnimation} from './combatAnimation';
import {createTypingState} from './proportionalRules';
import {TypingBossSessionSnapshot} from './types';
declare const test:any,expect:any,jest:any,afterEach:any;
jest.mock('react-router-dom',()=>({Link:'a'}),{virtual:true});
afterEach(()=>jest.useRealTimers());
const idle:CombatAnimation={id:'idle',state:'idle',at:0,duration:1500};
function room():TypingBossSessionSnapshot{return {id:'wyrmtest',mode:'proportional',status:'active',teamMode:true,serverNow:1000,
  boss:{id:'giantSandWyrm',name:'Giant Sand Wyrm',hp:300,maxHp:300,color:'#d6a44c',glow:'#d6a44c'},
  typing:createTypingState(1,'paladin'),players:[{code:'hero',name:'Hero',classId:'paladin',color:'gold',hp:100,maxHp:100,defeated:false}],projectiles:[]} as TypingBossSessionSnapshot;}
test('Overrun moves out, waits offscreen, and bursts back into its spot on the same timeline',()=>{
  jest.useFakeTimers();jest.setSystemTime(1000);
  const boss={wyrmAction:{id:'run',kind:'overrun' as const,at:1000,until:9000}};
  render(<WyrmSprite boss={boss} pose={idle} width={300}/>);
  const sprite=screen.getByTestId('wyrm-animation');expect(sprite.getAttribute('data-animation')).toBe('overrun');
  act(()=>jest.advanceTimersByTime(2010));expect(sprite.getAttribute('data-animation')).toBe('offscreen');
  act(()=>jest.advanceTimersByTime(3500));expect(sprite.getAttribute('data-animation')).toBe('emerge');
  act(()=>jest.advanceTimersByTime(2500));expect(sprite.getAttribute('data-animation')).toBe('idle');
});
test.each([['basic',8],['power',9],['critical',10]])('Wyrm %s hits use a distinct drawn hurt row',(tier:any,row:number)=>{
  const visual=wyrmVisual({}, {...idle,state:'hit',hurtTier:tier,at:1000,duration:1000},1100);
  expect(visual.row).toBe(row);expect(visual.state).toBe(`hurt-${tier}`);
});
test('Burrow holds underground after its animation, then Consume owns the profile sprite',()=>{
  const visual=wyrmVisual({wyrmBurrowed:true,wyrmAction:{id:'dig',kind:'burrow',at:1000,until:2600}},idle,3000);
  expect(visual.state).toBe('underground');expect(visual.held).toBe(true);
  jest.useFakeTimers();jest.setSystemTime(1000);
  const session=room();session.boss.wyrmAction={id:'eat',kind:'consume',at:1000,until:3600};
  render(<DragonPortrait boss={session.boss} events={[]}/>);
  expect(within(screen.getByTestId('dragon-portrait')).getByTestId('wyrm-animation').getAttribute('data-animation')).toBe('consume');
});
test('swallowed players disappear from the field and only their scene darkens; typing stays enabled',()=>{
  jest.useFakeTimers();jest.setSystemTime(1000);
  const session=room(),player=session.players[0];player.consumedAt=1000;player.consumedUntil=31000;
  const view=render(<PlayerTypingBattle session={session} me={player} code="hero" active/>);
  expect(screen.getByRole('region',{name:'Player battle scene'}).className).toContain('consumed-player-scene');
  expect(view.container.querySelector('.wyrm-consumed-actor')).toBeTruthy();
  expect((screen.getByRole('textbox') as HTMLInputElement).disabled).toBe(false);
  expect(screen.getByText(/Consumed · 30s/)).toBeTruthy();
  view.rerender(<BattleScene session={session}/>);
  expect(screen.getByRole('region',{name:'Host battle scene'}).className).not.toContain('consumed-player-scene');
});
test('Consume vortex is drawn on the target slot and expiry stops its animation',()=>{
  jest.useFakeTimers();jest.setSystemTime(1000);const session=room();
  session.boss.wyrmAction={id:'eat',kind:'consume',at:1000,until:3600,targetCode:'hero'};
  render(<BattleScene session={session}/>);expect(screen.getByTestId('sand-vortex')).toBeTruthy();
  act(()=>jest.advanceTimersByTime(2610));expect(screen.queryByTestId('sand-vortex')).toBeNull();
});

test('a spit-out briefly shows the boss mouth even during a later burrow, without ending that burrow',()=>{
  const boss={wyrmBurrowed:true,wyrmSpitAt:1000};
  expect(wyrmVisual(boss,idle,1500).state).toBe('spitOut');
  expect(wyrmVisual(boss,idle,2801).state).toBe('underground');expect(boss.wyrmBurrowed).toBe(true);
});

test('a swallowed survivor is visible for the party victory celebration',()=>{
  jest.useFakeTimers();jest.setSystemTime(1000);const session=room();
  session.status='victory';session.closedAt=new Date(1000).toISOString();session.boss.hp=0;session.players[0].consumedUntil=31000;
  const view=render(<BattleScene session={session}/>);
  expect(view.container.querySelector('.wyrm-consumed-actor')).toBeNull();
  expect(screen.getByTestId('combat-character').getAttribute('data-animation')).toBe('victory');
});
