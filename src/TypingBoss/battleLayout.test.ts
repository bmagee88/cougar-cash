import {BATTLE_HEIGHT,BATTLE_WIDTH,battleScale} from './battleLayout';
declare const test:any,expect:any;
test.each([[390,220],[1024,400],[1366,550],[1920,800],[2560,1100]])('camera contains the entire scene at %i by %i without stretching', (width:number,height:number)=>{
  const scale=battleScale(width,height);
  expect(BATTLE_WIDTH*scale).toBeLessThanOrEqual(width+.001);
  expect(BATTLE_HEIGHT*scale).toBeLessThanOrEqual(height+.001);
  expect(64*scale/(300*scale)).toBeCloseTo(64/300);
});
test('larger screens enlarge the whole scene instead of capping characters at fixed pixel sizes',()=>{
  expect(battleScale(2000,BATTLE_HEIGHT*2)).toBe(2);
  expect(battleScale(1000,BATTLE_HEIGHT)).toBe(1);
});
