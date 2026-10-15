import { useEffect, useMemo, useState } from 'react';
import { worldAt } from './engine/world';
import { WorldOverrides } from './engine/types';

export function useWorldClock(overrides: WorldOverrides = {}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = window.setInterval(update, 1000);
    document.addEventListener('visibilitychange', update);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, []);
  const { season, hour, moonPhase } = overrides;
  return useMemo(() => worldAt(now, process.env.NODE_ENV === 'development' ? { season, hour, moonPhase } : {}), [now, season, hour, moonPhase]);
}
