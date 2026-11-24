import React from 'react';
import {act,render,screen} from '@testing-library/react';
import {collectCombatAnimations,CombatAnimationEvent} from './combatAnimation';
import useImpactShake,{impactShakeStrength} from './useImpactShake';
import {TypingBossProjectile} from './types';
declare const test:any,expect:any,jest:any,afterEach:any;
afterEach(()=>jest.useRealTimers());
const shot=(attack:TypingBossProjectile['bossAttack'],extra:Partial<TypingBossProjectile>={})=>({id:'hit',source:'boss',target:'hero',kind:'boss',bossAttack:attack,startedAt:300,impactAt:1000,resolvedAt:1000,result:'hit',amount:12,...extra} as TypingBossProjectile);
test('landed dragon attacks keep their move for input feedback; dodges and full blocks do not shake',()=>{
  for(const [attack,strength] of [['bite',12],['fireball',5],['tailWhip',5],['flamethrower',2]] as const){
    const event=collectCombatAnimations([shot(attack)]).get('hero')!.find(event=>event.state==='hit')!;
    expect(impactShakeStrength(event,false)).toBe(strength);
  }
  for(const extra of [{result:'evade',amount:null},{amount:0,blockedAmount:12}]){
    expect(collectCombatAnimations([shot('bite',extra as any)]).get('hero')!.some(event=>event.state==='hit')).toBe(false);
  }
});
test('host criticals shake harder, expire locally, and new impacts preserve the input and focus',()=>{
  jest.useFakeTimers('modern');jest.setSystemTime(1100);
  const event:CombatAnimationEvent={id:'first',state:'hit',at:1000,duration:460,channel:'reaction'};
  function Input({events}:{events:CombatAnimationEvent[]}) {const shake=useImpactShake(events,undefined,true);return <div data-testid="area" {...shake}><input aria-label="Words"/></div>;}
  const view=render(<Input events={[event]}/>),input=screen.getByRole('textbox') as HTMLInputElement;input.focus();
  expect(screen.getByTestId('area').getAttribute('data-shake-strength')).toBe('2');
  const firstName=screen.getByTestId('area').style.animationName;
  view.rerender(<Input events={[{...event,id:'second',critical:true}]}/>);
  expect(screen.getByTestId('area').getAttribute('data-shake-strength')).toBe('9');
  expect(screen.getByTestId('area').style.animationName).not.toBe(firstName);
  expect(screen.getByRole('textbox')).toBe(input);expect(document.activeElement).toBe(input);
  act(()=>jest.advanceTimersByTime(330));expect(screen.getByTestId('area').getAttribute('data-impact-id')).toBeNull();
});
