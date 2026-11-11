import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import HostBattleLog from "./HostBattleLog";
import { captureBattleLog, emptyBattleLog, MAX_BATTLE_LOG_ENTRIES } from "./battleLog";
import { TypingBossProjectile, TypingBossSessionSnapshot } from "./types";

declare const test: any, expect: any;
function shot(values: Partial<TypingBossProjectile> = {}): TypingBossProjectile {
  return { id:"hit",source:"cleric",target:"ally",kind:"heal",moveLabel:"Golden Heal",startedAt:1000,
    impactAt:1700,resolvedAt:1700,result:"hit",amount:25,targetName:"Ada",...values };
}
function session(projectiles: TypingBossProjectile[] = []): TypingBossSessionSnapshot {
  return { id:"bossABC",name:"Test",mode:"proportional",status:"active",createdAt:new Date(1000).toISOString(),
    expiresAt:new Date(7201000).toISOString(),closedAt:null,remainingSeconds:7200,serverNow:2000,
    boss:{id:"infernalDragon",name:"Dragon",difficulty:"hard",hp:200,maxHp:200,attackIntervalMs:12000,
      lastAttackAt:1000,nextAttackAt:13000,currentMoveLabel:"Bite",color:"#f00",glow:"#f00"},
    players:[],projectiles,log:[] };
}

test("resolved events log once; pending projectiles and repeated updates do not add rows", () => {
  const pending=session([shot({resolvedAt:null,result:"pending",amount:null})]);
  const initial=captureBattleLog(emptyBattleLog(pending.id),pending);
  expect(initial.entries.filter(entry=>entry.category==="Healing")).toHaveLength(0);
  const resolved=session([shot()]);
  const history=captureBattleLog(initial,resolved);
  expect(history.entries.filter(entry=>entry.category==="Healing")).toHaveLength(1);
  expect(captureBattleLog(history,{...resolved,projectiles:[{...shot()}]})).toBe(history);
});

test("local history survives removal from the live snapshot and resets for a new room", () => {
  let history=captureBattleLog(emptyBattleLog("bossABC"),session([shot()]));
  history=captureBattleLog(history,session());
  expect(history.entries.some(entry=>entry.message.includes("healed Ada"))).toBe(true);
  expect(history.seen.size).toBe(0);
  history=captureBattleLog(history,{...session(),id:"bossDEF"});
  expect(history.entries.some(entry=>entry.message.includes("healed Ada"))).toBe(false);
});

test("history caps at 200 rows even when older events are still in the snapshot", () => {
  const snapshot=session(Array.from({length:250},(_,index)=>shot({id:String(index),resolvedAt:1000+index})));
  const history=captureBattleLog(emptyBattleLog(snapshot.id),snapshot);
  expect(history.entries).toHaveLength(MAX_BATTLE_LOG_ENTRIES);
  expect(history.entries.some(entry=>entry.id==="combat:0")).toBe(false);
  expect(captureBattleLog(history,snapshot)).toBe(history);
  expect(captureBattleLog(history,session()).seen.size).toBe(0);
});

test("clearing history does not replay known events and later events still appear", () => {
  const snapshot=session([shot()]);
  const history=captureBattleLog(emptyBattleLog(snapshot.id),snapshot);
  const cleared={...history,entries:[]};
  expect(captureBattleLog(cleared,snapshot).entries).toHaveLength(0);
  const next=captureBattleLog(cleared,session([shot(),shot({id:"new",amount:10})]));
  expect(next.entries).toHaveLength(1);
  expect(next.entries[0].message).toBe("Player healed Ada for 10 HP.");
});

test("damage, partial blocks, dodges and game results have separate readable entries", () => {
  const snapshot=session([
    shot({id:"damage",source:"boss",target:"ally",kind:"boss",amount:15,blockedAmount:10,critical:true,moveLabel:"Bite",multiplier:2}),
    shot({id:"dodge",source:"boss",target:"ally",kind:"boss",result:"evade",evadeType:"dodge",amount:0}),
  ]);
  const history=captureBattleLog(emptyBattleLog(snapshot.id),snapshot);
  expect(history.entries.some(entry=>entry.message==="Dragon dealt 15 damage to Ada.")).toBe(true);
  expect(history.entries.some(entry=>entry.message==="Ada blocked 10 damage from Dragon.")).toBe(true);
  expect(history.entries.some(entry=>entry.message==="Ada dodged Dragon's attack.")).toBe(true);
  expect(history.entries.find(entry=>entry.category==="Damage")!.detail).toContain("Critical hit");
  const ended=captureBattleLog(history,{...snapshot,status:"victory",closedAt:new Date(2100).toISOString()});
  expect(ended.entries[0].message).toBe("Players won. The dragon was defeated.");
});

test("Old Mode uses the server's readable messages instead of duplicating projectile events", () => {
  const snapshot={...session([shot()]),mode:"old" as const,
    log:[{id:"old",tone:"heal" as const,message:"Cleric restored 25 HP to Ada.",createdAt:new Date(1700).toISOString()}]};
  const history=captureBattleLog(emptyBattleLog(snapshot.id),snapshot);
  expect(history.entries.filter(entry=>entry.category==="Healing")).toHaveLength(1);
  expect(history.entries.some(entry=>entry.id==="legacy:old")).toBe(true);
});

test("host accordion opens, filters by name or event, uses combat colors, and clears", () => {
  const snapshot=session([shot({sourceName:"Cleric"}),shot({id:"damage",kind:"damage",target:"boss",sourceName:"Cleric",amount:12})]);
  render(<HostBattleLog session={snapshot} />);
  const accordion=screen.getByRole("button",{name:/Battle log/});
  expect(accordion.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(accordion);
  expect(accordion.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByText("Cleric healed Ada for 25 HP.")).toBeTruthy();
  expect(window.getComputedStyle(screen.getByText("Cleric healed Ada for 25 HP.")).color).toBe("rgb(250, 204, 21)");
  expect(window.getComputedStyle(screen.getByText("Cleric dealt 12 damage to Dragon.")).color).toBe("rgb(248, 113, 113)");
  const filter=screen.getByRole("textbox",{name:"Filter battle log"});
  fireEvent.change(filter,{target:{value:"Ada"}});
  expect(screen.queryByText("Cleric dealt 12 damage to Dragon.")).toBeNull();
  fireEvent.change(filter,{target:{value:"damage"}});
  expect(screen.getByText("Cleric dealt 12 damage to Dragon.")).toBeTruthy();
  expect(screen.queryByText("Cleric healed Ada for 25 HP.")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Clear log"}));
  expect(screen.getByText("No events yet. New battle events will appear here.")).toBeTruthy();
});
