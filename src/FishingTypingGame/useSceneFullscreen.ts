import { RefObject, useCallback, useEffect, useRef, useState } from 'react';

/** Native fullscreen, with a viewport-sized scene for embedded browsers. */
export function useSceneFullscreen(root: RefObject<HTMLElement>) {
  const [native, setNative] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    const element = root.current;
    const sync = () => setNative(!!element && document.fullscreenElement === element);
    const escape = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.key === 'Escape' && !event.defaultPrevented && !(target instanceof HTMLElement && target.closest('[role="dialog"]'))) setExpanded(false);
    };
    document.addEventListener('fullscreenchange', sync);
    window.addEventListener('keydown', escape);
    sync();
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      window.removeEventListener('keydown', escape);
      if (element && document.fullscreenElement === element) void document.exitFullscreen().catch(() => {});
    };
  }, [root]);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [expanded]);
  const toggle = useCallback(async () => {
    if (pending.current || !root.current) return;
    if (expanded) { setExpanded(false); return; }
    pending.current = true;
    try {
      if (document.fullscreenElement === root.current) await document.exitFullscreen();
      else if (root.current.requestFullscreen) await root.current.requestFullscreen();
      else setExpanded(true);
    } catch {
      // Embedded previews may deny the native API; retain a usable scene view.
      if (document.fullscreenElement !== root.current) setExpanded(true);
    } finally { pending.current = false; }
  }, [expanded, root]);
  return { fullscreen: native || expanded, toggle };
}
