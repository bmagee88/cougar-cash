import { useEffect, useRef } from 'react';
import { advanceNaturalWeather } from './engine/naturalWeather';
import { SaveData, WorldOverrides } from './engine/types';

export function useNaturalWeather(save: SaveData, updateSave: (change: (save: SaveData) => SaveData) => void, overrides: WorldOverrides = {}) {
  const latest=useRef(save); latest.current=save;
  const preview=useRef(overrides); preview.current=overrides;
  useEffect(() => {
    if (save.settings.weatherMode !== 'natural') return;
    const update=() => {
      const now=Date.now(); const options=process.env.NODE_ENV==='development' ? preview.current : {};
      if (advanceNaturalWeather(latest.current,now,options) !== latest.current) updateSave(current=>advanceNaturalWeather(current,now,options));
    };
    update(); const timer=window.setInterval(update,1000);
    document.addEventListener('visibilitychange',update);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange',update); };
  }, [save.settings.weatherMode, updateSave]);
}
