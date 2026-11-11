import React from "react";
import { render, screen } from "@testing-library/react";
import { ProjectileMotion } from "./ProjectileMotion";
import { projectileEndpoints } from "./combatFeedback";
import { TypingBossProjectile } from "./types";

declare const test: any, expect: any;
const point = { x: 50, y: 60 };
function shot(values: Partial<TypingBossProjectile> = {}): TypingBossProjectile {
  const now=Date.now();
  return { id:"test",source:"me",target:"boss",kind:"damage",moveLabel:"Attack",startedAt:now-700,
    impactAt:now,resolvedAt:now,result:"hit",amount:25,...values };
}
function display(projectile: TypingBossProjectile, targetOffscreen = false) {
  return render(<ProjectileMotion projectile={projectile} from={point} to={point} art={null} serverOffset={0} targetOffscreen={targetOffscreen} />);
}

test.each([
  ["outgoing damage",{},"−25","rgb(248, 113, 113)"],
  ["incoming damage",{kind:"boss",source:"boss",target:"me"},"−25","rgb(248, 113, 113)"],
  ["healing",{kind:"heal",target:"me"},"HEAL +25","rgb(250, 204, 21)"],
  ["revival",{kind:"resurrect",target:"me"},"REVIVE +25","rgb(250, 204, 21)"],
  ["shield",{kind:"buff",moveId:"goldShield",target:"me"},"SHIELD +25","rgb(96, 165, 250)"],
  ["dodge",{result:"evade",evadeType:"dodge",amount:0},"DODGED!","rgb(74, 222, 128)"],
  ["fully shielded hit",{amount:0,blockedAmount:25},"SHIELD 25","rgb(96, 165, 250)"],
])("%s uses the requested combat color", (_name: string, values: Partial<TypingBossProjectile>, label: string, color: string) => {
  display(shot(values));
  expect(screen.getByText(label).style.color).toBe(color);
});

test("crit damage stays red and keeps its impact flash and large type", () => {
  display(shot({critical:true,moveId:"strong"}));
  expect(screen.getByText(/−25/).style.color).toBe("rgb(248, 113, 113)");
  expect(screen.getByText(/−25/).className).toContain("boss-impact-crit");
  expect(screen.getByText("CRIT!")).toBeTruthy();
  expect(screen.getByTestId("critical-impact-flash")).toBeTruthy();
});

test("a partial shield shows red damage and a separate blue blocked amount", () => {
  display(shot({amount:15,blockedAmount:10}));
  expect(screen.getByText("BLOCKED 10").style.color).toBe("rgb(96, 165, 250)");
  expect(screen.getByText("−15").style.color).toBe("rgb(248, 113, 113)");
});

test("an ally heal in a personal view names its recipient and avoids the dragon and caster positions", () => {
  const projectile=shot({kind:"heal",target:"ally",targetName:"Ada"});
  const bossPoint={x:80,y:20};
  const endpoints=projectileEndpoints(projectile,new Map([["me",point]]),bossPoint);
  expect(endpoints.targetOffscreen).toBe(true);
  expect(endpoints.to).not.toEqual(bossPoint);
  expect(endpoints.to).not.toEqual(point);
  display(projectile,endpoints.targetOffscreen);
  expect(screen.getByText("→ Ada")).toBeTruthy();
});

test("the host puts the heal on its real recipient and an incoming ally heal stays on the local player", () => {
  const allyPoint={x:20,y:55},bossPoint={x:80,y:20};
  const projectile=shot({kind:"heal",target:"ally"});
  const host=projectileEndpoints(projectile,new Map([["me",point],["ally",allyPoint]]),bossPoint);
  expect(host.to).toEqual(allyPoint);expect(host.targetOffscreen).toBe(false);
  const personal=projectileEndpoints(shot({kind:"heal",source:"ally",target:"me"}),new Map([["me",point]]),bossPoint);
  expect(personal.to).toEqual(point);expect(personal.from).not.toEqual(bossPoint);
});
