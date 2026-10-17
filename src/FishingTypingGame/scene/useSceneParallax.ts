import { RefObject, useEffect } from 'react';
import { environmentTransitionMs } from '../engine/environment';

// One calm left/right cycle per minute. Depth keeps the background nearly still.
export const SCENE_DRIFT = { amplitudePx: 8, periodMs: 64000 };
const ENVIRONMENT_SCOPE = '[data-scene-depth="background"], .f-celestial-sky, .f-weather, .f-lake-fog, .f-rain-mist, .f-heat-haze';
const AMBIENT_ANIMATIONS = new Set(['f-sprite','f-drift','f-sway','f-shimmer','f-star-glimmer','f-star-scintillation','f-aurora-drift','f-aurora-breathe','f-cloud-life','f-cloud-deck-drift','f-fog','f-lake-fog-drift','f-rain-mist-drift','f-heat','f-rain','f-ripple','f-snow-fall','f-snow-blow','f-wind-gust']);
const KEYFRAME_METADATA = new Set(['offset', 'computedOffset', 'easing', 'composite']);

/** Seek paused backgrounds, then blend their painted properties with native
 * animations. This avoids both fast-forwarding rain through ten seconds of
 * motion and running a JS frame loop throughout the interval. */
export function stepAmbientAnimations(scene: HTMLElement, delta: number, duration = 0): Animation[] {
  const animations = (scene.getAnimations?.({ subtree: true }) ?? []).filter(animation => {
    const target = (animation.effect as KeyframeEffect | null)?.target;
    return AMBIENT_ANIMATIONS.has((animation as CSSAnimation).animationName) && animation.playState === 'paused' &&
      typeof animation.currentTime === 'number' && target instanceof Element && !!target.closest(ENVIRONMENT_SCOPE);
  });
  const groups = new Map<Element, Map<string, Set<string>>>();
  if (duration) animations.forEach(animation => {
    const effect = animation.effect as KeyframeEffect & { pseudoElement?: string };
    const target = effect.target!, pseudo = effect.pseudoElement || '';
    if (!groups.has(target)) groups.set(target, new Map());
    const pseudos = groups.get(target)!;
    if (!pseudos.has(pseudo)) pseudos.set(pseudo, new Set());
    effect.getKeyframes().forEach(keyframe => Object.keys(keyframe).forEach(property => {
      if (!KEYFRAME_METADATA.has(property)) pseudos.get(pseudo)!.add(property);
    }));
  });
  const read = (target: Element, pseudo: string, properties: Set<string>): Keyframe => {
    const style = getComputedStyle(target, pseudo || null);
    return Object.fromEntries(Array.from(properties, property => [property, (style as unknown as Record<string, string>)[property]]));
  };
  // Batch reads, seeks and reads so seeking hundreds of stars flushes styles once.
  const snapshots = Array.from(groups).flatMap(([target, pseudos]) => Array.from(pseudos, ([pseudo, properties]) =>
    ({ target, pseudo, properties, from: read(target, pseudo, properties) })));
  animations.forEach(animation => { animation.currentTime = (animation.currentTime as number) + delta * animation.playbackRate; });
  const frames = snapshots.map(sample => ({ ...sample, to: read(sample.target, sample.pseudo, sample.properties) }));
  return frames.flatMap(({ target, pseudo, from, to }) => {
    if (!target.animate || Object.keys(from).every(property => from[property] === to[property])) return [];
    return [target.animate([from, to], { duration, easing: 'ease-in-out', ...(pseudo ? { pseudoElement: pseudo } : {}) })];
  });
}

/** Ambient horizontal movement, independent of pointer or touch input. */
export function useSceneParallax(sceneRef: RefObject<HTMLDivElement>, reducedMotion: boolean, intervalMs = 0) {
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const reset = () => {
      scene.style.setProperty('--scene-x', '0px');
      scene.style.setProperty('--scene-y', '0px');
      scene.style.setProperty('--environment-x', '0px');
    };
    reset();
    if (reducedMotion) return;
    let frame: number | undefined;
    let timer: number | undefined;
    let previousTime: number | undefined;
    let previousPaint = -Infinity;
    let previousSample = 0;
    let elapsed = 0;
    let onScreen = true;
    const bridges = new Set<Animation>();
    const cancelBridges = () => { bridges.forEach(animation => animation.cancel()); bridges.clear(); };
    const drift = () => `${(Math.sin(elapsed / SCENE_DRIFT.periodMs * Math.PI * 2) * SCENE_DRIFT.amplitudePx).toFixed(3)}px`;
    const animate = (now: number) => {
      const delta = previousTime === undefined ? 0 : Math.min(100, now - previousTime);
      elapsed+=delta;
      previousTime = now;
      // Camera drift is extremely slow; 30 updates/sec preserves its appearance.
      if (now - previousPaint >= 1000 / 30) {
        scene.style.setProperty('--scene-x', drift());
        previousPaint = now;
      }
      frame = requestAnimationFrame(animate);
    };
    const sample = () => {
      cancelBridges();
      const now = performance.now(), delta = Math.min(intervalMs, now - previousSample);
      previousSample = now;
      stepAmbientAnimations(scene, delta, environmentTransitionMs(intervalMs)).forEach(animation => {
        bridges.add(animation);
        animation.onfinish = animation.oncancel = () => { bridges.delete(animation); };
      });
      scene.style.setProperty('--environment-x', drift());
      timer = window.setTimeout(sample, intervalMs);
    };
    const update = () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      window.clearTimeout(timer);timer=undefined;
      cancelBridges();
      frame = undefined;
      previousTime = undefined;
      previousPaint = -Infinity;
      scene.classList.toggle('f-scene-paused', document.hidden || !onScreen);
      if (!document.hidden && onScreen) {
        frame = requestAnimationFrame(animate);
        if (intervalMs) { previousSample = performance.now(); timer = window.setTimeout(sample, intervalMs); }
      }
    };
    const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => {
      onScreen = entries[0]?.isIntersecting ?? true;
      update();
    }) : undefined;
    observer?.observe(scene);
    document.addEventListener('visibilitychange', update);
    update();
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      cancelBridges();
      observer?.disconnect();
      document.removeEventListener('visibilitychange', update);
      scene.classList.remove('f-scene-paused');
      reset();
    };
  }, [sceneRef, reducedMotion, intervalMs]);
}
