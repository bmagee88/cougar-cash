import { RefObject, useEffect, useMemo, useRef } from 'react';
import { LakeAudio } from './LakeAudio';
import { LakeSoundControls, readSoundVolume } from './sounds';

export function useLakeAudio(root: RefObject<HTMLElement>, enabled: boolean, volume?: number): LakeSoundControls {
  const player = useRef<LakeAudio | null>(null);
  const rainLevel = useRef(0), sceneVisible = useRef(true);
  const preferences = useRef({ enabled, volume: readSoundVolume(volume) });
  preferences.current = { enabled, volume: readSoundVolume(volume) };
  useEffect(() => {
    const audio = new LakeAudio(); player.current = audio;
    audio.configure(preferences.current.enabled, preferences.current.volume);
    audio.setVisible(sceneVisible.current); audio.setRain(rainLevel.current);
    const element = root.current;
    const gesture = () => { if (preferences.current.enabled && preferences.current.volume > 0) audio.unlock(); };
    const visibility = () => audio.visibilityChanged();
    element?.addEventListener('pointerdown', gesture, true); element?.addEventListener('keydown', gesture, true);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      element?.removeEventListener('pointerdown', gesture, true); element?.removeEventListener('keydown', gesture, true);
      document.removeEventListener('visibilitychange', visibility); audio.dispose(); player.current = null;
    };
  }, [root]);
  useEffect(() => { player.current?.configure(enabled, readSoundVolume(volume)); }, [enabled, volume]);
  return useMemo<LakeSoundControls>(() => ({
    play: (kind, options) => { void player.current?.play(kind, options); },
    unlock: () => player.current?.unlock(), preview: kind => player.current?.preview(kind) ?? Promise.resolve(false),
    rain: level => { rainLevel.current = level; player.current?.setRain(level); },
    visible: visible => { sceneVisible.current = visible; player.current?.setVisible(visible); },
  }), []);
}
