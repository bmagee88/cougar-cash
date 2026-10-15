import { useEffect, useState } from 'react';

/** Defer first use; retain outgoing art until its CSS opacity fade has ended. */
export function useLayerPresence(visible: boolean, fadeMs = 16000) {
  const [retained, setRetained] = useState(visible);
  useEffect(() => {
    if (visible) { setRetained(true); return; }
    if (!retained) return;
    if (!fadeMs) { setRetained(false); return; }
    const timer = window.setTimeout(() => setRetained(false), fadeMs);
    return () => window.clearTimeout(timer);
  }, [visible, retained, fadeMs]);
  return visible || (fadeMs > 0 && retained);
}
