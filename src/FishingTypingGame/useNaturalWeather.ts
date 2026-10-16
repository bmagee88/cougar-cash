import { useEffect, useRef } from 'react';
import { advanceNaturalWeather } from './engine/naturalWeather';
import { SaveData, WorldOverrides } from './engine/types';

export function useNaturalWeather(save: SaveData, updateSave: (change: (save: SaveData) => SaveData) => void, overrides: WorldOverrides = {}, intervalMs = 1000) {
  const latest=useRef(save); latest.current=save;
  const preview=useRef(overrides); preview.current=overrides;
  useEffect(() => {
    if (save.settings.weatherMode !== 'natural') return;
    const update=() => {
      const now=Date.now(); const options=process.env.NODE_ENV==='development' ? preview.current : {};
      if (advanceNaturalWeather(latest.current,now,options) !== latest.current) updateSave(current=>advanceNaturalWeather(current,now,options));
    };
    let timer:number|undefined;
    const visible=()=>{window.clearInterval(timer);timer=undefined;if(document.hidden)return;update();timer=window.setInterval(update,intervalMs);};
    visible();document.addEventListener('visibilitychange',visible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange',visible); };
  }, [save.settings.weatherMode, updateSave, intervalMs]);
}
