import {combatNumber} from './combatNumbers';
declare const test:any,expect:any;
test('combat amounts use whole hundredfold display units without changing the source precision',()=>{
  const bank=1/3;
  expect(combatNumber(100)).toBe('10,000');
  expect(combatNumber(bank)).toBe('33');
  expect(combatNumber(bank*3)).toBe('100');
  expect(bank).toBe(1/3);
});
