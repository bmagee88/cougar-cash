import React from "react";
import { render, screen, within } from "@testing-library/react";
import BattleLeaderboard from "./BattleLeaderboard";
import { TypingBossLeaderboardEntry } from "./types";

declare const test: any, expect: any;

test("ending leaderboard includes the boss and only combat totals plus typing skills", () => {
  const entries: TypingBossLeaderboardEntry[] = [
    { rank: 1, code: "a", name: "Ada", totalDamage: 500, dps: 12.5,
      typingStats: {accuracy:.96,wpm:42,meanIntervalMs:200,intervalStdDevMs:25}, strongestAttack: {
      base: 50, power: 192, actualDamage: 144, blockedDamage: 48, consistency: 1.5,
      multiplier: 3.84, orangeBonus: .2, greenBonus: .08, greenStacks: 2,
      criticalChance: .3, critical: true, moveId: "strong", attackNumber: 3, landedAt: 1000,
      blueShield: .1, meanIntervalMs: 200, intervalStdDevMs: 0,
    } },
    { rank: 2, code: "b", name: "Ben", totalDamage: 0, dps:0, strongestAttack: null },
    { rank:0,code:'boss',isBoss:true,name:'Ancient Red Dragon',totalDamage:300,dps:7.5,
      typingStats:{accuracy:1,wpm:60,meanIntervalMs:180,intervalStdDevMs:10},strongestAttack:null },
  ];
  render(<BattleLeaderboard entries={entries} />);
  const ada=within(screen.getByRole('article',{name:'Ada battle results'}));
  expect(ada.getByText('#1 Ada')).toBeTruthy();
  expect(ada.getByText('500')).toBeTruthy();expect(ada.getByText('12.5')).toBeTruthy();
  expect(ada.getByText('192 power')).toBeTruthy();
  expect(ada.getByText('Accuracy: 96%')).toBeTruthy();expect(ada.getByText('WPM: 42')).toBeTruthy();
  expect(ada.getByText('Mean key gap: 200 ms')).toBeTruthy();
  expect(ada.getByText('Timing variation: 25 ms')).toBeTruthy();
  const boss=within(screen.getByRole('article',{name:'Ancient Red Dragon battle results'}));
  expect(boss.getByText('Boss')).toBeTruthy();expect(boss.getByText('300')).toBeTruthy();
  expect(boss.getByText('7.5')).toBeTruthy();expect(boss.getByText('WPM: 60')).toBeTruthy();
  expect(screen.getAllByRole('article')[0]).toBe(screen.getByRole('article',{name:'Ancient Red Dragon battle results'}));
  expect(within(screen.getByRole('article',{name:'Ben battle results'})).getByText('No landed attack')).toBeTruthy();
  for(const removed of [/Orange:/,/Green:/,/Red:/,/Blocked:/,/Blue block/,/Magnitude:/,/Support used:/,/Total multiplier:/,/Critical:/,/attack #/]) {
    expect(screen.queryByText(removed)).toBeNull();
  }
});

test('older results without typing totals remain readable',()=>{
  render(<BattleLeaderboard entries={[{rank:1,code:'a',name:'Ada',totalDamage:0,strongestAttack:null}]}/>);
  expect(screen.getByText('Accuracy: —')).toBeTruthy();
  expect(screen.getByText('No landed attack')).toBeTruthy();
});
