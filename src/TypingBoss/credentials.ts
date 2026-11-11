type Role = "host" | "player";
type SavedCredential = { value: string; expiresAt: number };
const MAX_AGE_MS = 121 * 60 * 1000;
const LEGACY_GRACE_MS = 10 * 60 * 1000;
const keyFor = (sessionId: string, role: Role) => `typingBoss${role === "host" ? "Host" : "Player"}:${sessionId}`;

function storage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

function decode(raw: string, now: number): SavedCredential | null {
  // Give existing raw credentials time to be verified and upgraded with the room's expiry.
  if (/^(?:[0-9a-fA-F]{32}|hero[0-9A-F]{4})$/.test(raw)) return { value: raw, expiresAt: now + LEGACY_GRACE_MS };
  try {
    const saved = JSON.parse(raw) as SavedCredential;
    if (saved && typeof saved.value === "string" && saved.value && Number.isFinite(saved.expiresAt) && saved.expiresAt > now) {
      return { value: saved.value, expiresAt: Math.min(saved.expiresAt, now + MAX_AGE_MS) };
    }
  } catch { /* Invalid or expired entries are removed by the caller. */ }
  return null;
}

export function pruneSavedCredentials() {
  const store = storage();
  if (!store) return;
  try {
    const now = Date.now();
    const keys = Array.from({ length: store.length }, (_, index) => store.key(index));
    for (const key of keys) {
      if (!key || !/^typingBoss(?:Host|Player):/.test(key)) continue;
      const saved = decode(store.getItem(key) || "", now);
      if (!saved) store.removeItem(key);
      else {
        const encoded = JSON.stringify(saved);
        if (encoded !== store.getItem(key)) store.setItem(key, encoded);
      }
    }
  } catch { /* Cleanup must tolerate disabled or full browser storage. */ }
}

export function readSavedCredential(sessionId: string, role: Role): string {
  pruneSavedCredentials();
  try { return decode(storage()?.getItem(keyFor(sessionId, role)) || "", Date.now())?.value || ""; }
  catch { return ""; }
}

export function saveCredential(sessionId: string, role: Role, value: string, roomExpiresAt: string) {
  const store = storage();
  if (!store) return;
  const now = Date.now();
  const roomExpiry = Date.parse(roomExpiresAt);
  const expiresAt = Math.min(now + MAX_AGE_MS, Number.isFinite(roomExpiry) ? roomExpiry + 60000 : now + LEGACY_GRACE_MS);
  try {
    if (expiresAt <= now) store.removeItem(keyFor(sessionId, role));
    else store.setItem(keyFor(sessionId, role), JSON.stringify({ value, expiresAt }));
  } catch { /* Reading the game must not fail when browser storage is unavailable. */ }
  pruneSavedCredentials();
}

export function removeSavedCredential(sessionId: string, role: Role, expectedValue?: string) {
  const store = storage();
  if (!store) return;
  try {
    const saved = decode(store.getItem(keyFor(sessionId, role)) || "", Date.now());
    if (!expectedValue || !saved || saved.value === expectedValue) store.removeItem(keyFor(sessionId, role));
  } catch { /* Storage may be blocked by the browser. */ }
}
