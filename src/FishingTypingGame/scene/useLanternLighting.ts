import { RefObject, useEffect } from 'react';

/** Cache local light coordinates on layout changes, never on animation frames. */
export function useLanternLighting(sceneRef: RefObject<HTMLDivElement>, enabled: boolean, layout: unknown) {
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !enabled) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const lamp = scene.querySelector<HTMLElement>('[data-asset="lantern"]');
      const station = scene.querySelector<HTMLElement>('.f-lantern-station');
      if (!lamp || !station) return;
      const light = lamp.getBoundingClientRect();
      const rig = station.getBoundingClientRect();
      const surfaces = Array.from(scene.querySelectorAll<HTMLElement>('[data-lantern-surface]'));
      // Batch all geometry reads before writing masks; alpha from each painted
      // image clips the illumination to real surfaces, leaving water/air dark.
      const bounds = surfaces.map(surface => surface.getBoundingClientRect());
      // A light pass can mount hours after its base foliage. Match that base
      // animation's phase and wind speed so the two painted edges stay aligned.
      const timelines = surfaces.map(surface => {
        const base = surface.previousElementSibling;
        const originals = base?.getAnimations?.() ?? [];
        return (surface.getAnimations?.() ?? []).flatMap(animation => {
          const name = (animation as CSSAnimation).animationName;
          const original = name && originals.find(other => (other as CSSAnimation).animationName === name);
          return original ? [{ animation, time: original.currentTime, rate: original.playbackRate }] : [];
        });
      });
      surfaces.forEach((surface, i) => {
        surface.style.setProperty('--local-light-x', `${light.left + light.width * .5 - bounds[i].left}px`);
        surface.style.setProperty('--local-light-y', `${light.top + light.height * .60 - bounds[i].top}px`);
        surface.style.setProperty('--local-light-rx', `${rig.width * 2.15}px`);
        surface.style.setProperty('--local-light-ry', `${rig.height * .95}px`);
        timelines[i].forEach(({animation,time,rate}) => { animation.currentTime=time; animation.playbackRate=rate; });
      });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(schedule);
    observer?.observe(scene);
    const station = scene.querySelector('.f-lantern-station');
    if (station) observer?.observe(station);
    scene.addEventListener('load', schedule, true);
    window.addEventListener('resize', schedule);
    schedule();
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); scene.removeEventListener('load', schedule, true); window.removeEventListener('resize', schedule); };
  }, [sceneRef, enabled, layout]);
}
