import { useEffect, useMemo, useState } from 'react';
import { worldAt } from './engine/world';
import { WorldOverrides } from './engine/types';

export function useWorldClock(overrides: WorldOverrides = {}, intervalMs = 1000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer:number|undefined;
    const update = () => setNow(Date.now());
    const visible=()=>{
      window.clearInterval(timer);timer=undefined;
      if(document.hidden)return;
      update();timer=window.setInterval(update,intervalMs);
    };
    visible();document.addEventListener('visibilitychange',visible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange',visible); };
  }, [intervalMs]);
  const { season, hour, moonPhase } = overrides;
  return useMemo(() => worldAt(now, process.env.NODE_ENV === 'development' ? { season, hour, moonPhase } : {}), [now, season, hour, moonPhase]);
}
