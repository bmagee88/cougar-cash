import { RefObject, useEffect, useRef } from 'react';
import { WEATHER_FADE_MS } from './useWeatherLayers';

function applyWind(root: HTMLDivElement, value: number, reduced: boolean, force = false) {
  root.style.setProperty('--foliage-sway-angle', `${.6 + value * 1.4}deg`);
  root.style.setProperty('--willow-sway-angle', `${.35 + value * .9}deg`);
  root.style.setProperty('--wind-motion-strength', value.toFixed(4));
  root.querySelectorAll('.f-sway, .f-willow, .f-wind-wisps g').forEach(element => {
    const baseRate = element.closest('.f-wind-wisps') ? 12 / 5 : element.classList.contains('f-sway') ? 9 / 1.3 : element.getAttribute('data-layer') === 'willow-branches-right' ? 18 / 5 : 14 / 4;
    element.getAnimations?.().forEach(animation => {
      if (!['f-sway', 'f-willow-sway', 'f-wind-gust'].includes((animation as CSSAnimation).animationName)) return;
      const rate = 1 + value * (baseRate - 1);
      if (!reduced && animation.updatePlaybackRate && (force || Math.abs(animation.playbackRate - rate) > .001)) animation.updatePlaybackRate(rate);
    });
  });
}

/** Change speed without replacing an animation or resetting its current phase. */
export function useWeatherMotion(scene: RefObject<HTMLDivElement>, wind: number, reducedMotion: boolean) {
  const strength = useRef(wind);
  useEffect(() => {
    const root = scene.current; if (!root) return;
    applyWind(root, strength.current, reducedMotion);
    // Incoming gust layers adopt the current speed, including wind-to-wind changes.
    const observer = new MutationObserver(() => applyWind(root, strength.current, reducedMotion));
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [scene, reducedMotion]);
  useEffect(() => {
    const root = scene.current; if (!root) return;
    const from = strength.current;
    if (reducedMotion || Math.abs(from - wind) < .0001) {
      strength.current = wind; applyWind(root, wind, reducedMotion, true); return;
    }
    const started = performance.now(); let frame = 0;
    const move = (now: number) => {
      const progress = Math.max(0, Math.min(1, (now - started) / WEATHER_FADE_MS));
      const blend = progress * progress * (3 - 2 * progress);
      strength.current = from + (wind - from) * blend;
      applyWind(root, strength.current, reducedMotion, progress === 1);
      if (progress < 1) frame = requestAnimationFrame(move);
    };
    frame = requestAnimationFrame(move);
    return () => cancelAnimationFrame(frame);
  }, [scene, wind, reducedMotion]);
}
