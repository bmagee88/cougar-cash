import { pruneSavedCredentials, readSavedCredential, removeSavedCredential, saveCredential } from "./credentials";

declare const test: any, expect: any, jest: any, beforeEach: any, afterEach: any;
const started = 1000000;
let clock: any;
beforeEach(() => { localStorage.clear(); clock = jest.spyOn(Date, "now").mockReturnValue(started); });
afterEach(() => { jest.restoreAllMocks(); });

test("credentials survive reconnects and expire after the room's retention plus removal grace", () => {
  const expiry = started + 3600000;
  saveCredential("bossABC", "host", "host-token", new Date(expiry).toISOString());
  expect(readSavedCredential("bossABC", "host")).toBe("host-token");
  clock.mockReturnValue(expiry + 59999);
  expect(readSavedCredential("bossABC", "host")).toBe("host-token");
  clock.mockReturnValue(expiry + 60000);
  expect(readSavedCredential("bossABC", "host")).toBe("");
  expect(localStorage.getItem("typingBossHost:bossABC")).toBeNull();
});

test("finished-game snapshots shorten credential expiry and old entries are pruned without touching other apps", () => {
  localStorage.setItem("other-app", "keep");
  localStorage.setItem("typingBossHost:bossBAD", "broken");
  localStorage.setItem("typingBossPlayer:bossBAD", JSON.stringify({value:"old",expiresAt:started}));
  saveCredential("bossABC", "player", "heroABCD", new Date(started+7200000).toISOString());
  saveCredential("bossABC", "player", "heroABCD", new Date(started+900000).toISOString());
  clock.mockReturnValue(started+960000);
  pruneSavedCredentials();
  expect(localStorage.length).toBe(1);
  expect(localStorage.getItem("other-app")).toBe("keep");
});

test("legacy uppercase host tokens and player codes migrate once without a sliding lifetime", () => {
  const token="ABCDEF0123456789ABCDEF0123456789";
  localStorage.setItem("typingBossHost:bossABC",token);
  localStorage.setItem("typingBossPlayer:bossABC","heroABCD");
  expect(readSavedCredential("bossABC","host")).toBe(token);
  expect(readSavedCredential("bossABC","player")).toBe("heroABCD");
  clock.mockReturnValue(started+599999);
  expect(readSavedCredential("bossABC","host")).toBe(token);
  clock.mockReturnValue(started+600000);
  expect(readSavedCredential("bossABC","host")).toBe("");
  expect(readSavedCredential("bossABC","player")).toBe("");
});

test("verified legacy credentials adopt the actual room expiry; stale requests cannot delete a replacement", () => {
  localStorage.setItem("typingBossPlayer:bossABC","heroABCD");
  readSavedCredential("bossABC","player");
  clock.mockReturnValue(started+300000);
  saveCredential("bossABC","player","hero1234",new Date(started+3600000).toISOString());
  removeSavedCredential("bossABC","player","heroABCD");
  clock.mockReturnValue(started+600000);
  expect(readSavedCredential("bossABC","player")).toBe("hero1234");
  removeSavedCredential("bossABC","player","hero1234");
  expect(readSavedCredential("bossABC","player")).toBe("");
});

test("a bad far-future expiry cannot retain credentials indefinitely", () => {
  saveCredential("bossABC","host","token","2100-01-01T00:00:00.000Z");
  clock.mockReturnValue(started+121*60000);
  expect(readSavedCredential("bossABC","host")).toBe("");
});

test("cleanup tolerates browsers that block local storage", () => {
  jest.spyOn(window,"localStorage","get").mockImplementation(()=>{throw new Error("Storage blocked");});
  expect(()=>pruneSavedCredentials()).not.toThrow();
  expect(readSavedCredential("bossABC","host")).toBe("");
  expect(()=>saveCredential("bossABC","host","token",new Date(started+100000).toISOString())).not.toThrow();
  expect(()=>removeSavedCredential("bossABC","host")).not.toThrow();
});
