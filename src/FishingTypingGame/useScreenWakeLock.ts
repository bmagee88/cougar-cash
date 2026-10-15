import { useCallback, useEffect, useState } from 'react';

export interface ScreenLock extends EventTarget {
  readonly released: boolean;
  release(): Promise<void>;
}
interface ScreenWakeLock { request(type: 'screen'): Promise<ScreenLock> }
export type ScreenWakeStatus = 'off' | 'requesting' | 'active' | 'paused' | 'blocked' | 'unsupported';

/** A visible-page preference, independent of fishing phase and HUD visibility. */
export function useScreenWakeLock(enabled: boolean) {
  const api = (navigator as Navigator & { wakeLock?: ScreenWakeLock }).wakeLock;
  const supported = typeof api?.request === 'function' && window.isSecureContext !== false;
  const [status, setStatus] = useState<ScreenWakeStatus>('off');
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);

  useEffect(() => {
    if (!enabled) { setStatus('off'); return; }
    if (!supported) { setStatus('unsupported'); return; }
    let disposed = false, pending = false, revision = 0;
    let held: ScreenLock | undefined;
    let detach = () => {};
    const release = () => {
      const previous = held; held = undefined; detach(); detach = () => {};
      if (previous) void previous.release().catch(() => {});
    };
    const acquire = async () => {
      if (disposed || document.hidden || pending || (held && !held.released)) return;
      pending = true; const requestRevision = ++revision;
      setStatus('requesting');
      try {
        const lock = await api.request('screen');
        if (disposed || document.hidden || requestRevision !== revision) {
          void lock.release().catch(() => {}); return;
        }
        if (lock.released) { setStatus('blocked'); return; }
        held = lock;
        const released = () => {
          if (held !== lock) return;
          held = undefined; detach(); detach = () => {};
          if (!disposed) setStatus(document.hidden ? 'paused' : 'blocked');
        };
        lock.addEventListener('release', released);
        detach = () => lock.removeEventListener('release', released);
        setStatus('active');
      } catch {
        if (!disposed && requestRevision === revision) setStatus(document.hidden ? 'paused' : 'blocked');
      } finally {
        pending = false;
        // A hidden->visible cycle can finish while a request is still pending.
        // Release that stale grant and acquire for the current visible page.
        if (!disposed && !document.hidden && requestRevision !== revision) void acquire();
      }
    };
    const visibility = () => {
      if (document.hidden) { revision++; release(); setStatus('paused'); }
      else void acquire();
    };
    document.addEventListener('visibilitychange', visibility);
    if (document.hidden) setStatus('paused'); else void acquire();
    return () => { disposed = true; revision++; document.removeEventListener('visibilitychange', visibility); release(); };
  }, [enabled, supported, api, attempt]);

  return { supported, status, retry };
}
