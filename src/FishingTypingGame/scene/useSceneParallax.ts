import { RefObject, useEffect } from 'react';

// One calm left/right cycle per minute. Depth keeps the background nearly still.
export const SCENE_DRIFT = { amplitudePx: 8, periodMs: 64000 };

/** Ambient horizontal movement, independent of pointer or touch input. */
export function useSceneParallax(sceneRef: RefObject<HTMLDivElement>, reducedMotion: boolean) {
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const reset = () => {
      scene.style.setProperty('--scene-x', '0px');
      scene.style.setProperty('--scene-y', '0px');
    };
    reset();
    if (reducedMotion) return;
    let frame: number | undefined;
    let previousTime: number | undefined;
    let elapsed = 0;
    let onScreen = true;
    const animate = (now: number) => {
      if (previousTime !== undefined) elapsed += Math.min(100, now - previousTime);
      previousTime = now;
      const x = Math.sin(elapsed / SCENE_DRIFT.periodMs * Math.PI * 2) * SCENE_DRIFT.amplitudePx;
      scene.style.setProperty('--scene-x', `${x.toFixed(3)}px`);
      frame = requestAnimationFrame(animate);
    };
    const update = () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
      previousTime = undefined;
      if (!document.hidden && onScreen) frame = requestAnimationFrame(animate);
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
      observer?.disconnect();
      document.removeEventListener('visibilitychange', update);
      reset();
    };
  }, [sceneRef, reducedMotion]);
}
