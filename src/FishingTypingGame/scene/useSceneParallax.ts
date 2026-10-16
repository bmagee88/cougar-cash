import { RefObject, useEffect } from 'react';

// One calm left/right cycle per minute. Depth keeps the background nearly still.
export const SCENE_DRIFT = { amplitudePx: 8, periodMs: 64000 };
const AMBIENT_ANIMATIONS=new Set(['f-tree-bird-flight','f-tree-bird-flap','f-geese-pass','f-goose-light','f-goose-flap','f-lantern-orbit','f-lantern-buzz','f-lake-splash','f-drift','f-sway','f-shimmer','f-birds','f-angler-breathe','f-willow-sway','f-lantern-breathe','f-star-glimmer','f-star-scintillation','f-aurora-drift','f-aurora-breathe','f-meteor-pass','f-cloud-life','f-cloud-deck-drift','f-fog','f-lake-fog-drift','f-rain-mist-drift','f-heat','f-rain','f-ripple','f-snow-fall','f-snow-blow','f-wind-gust','f-leaf-arrive','f-leaf-caught','f-leaf-release']);
/** CSS pauses only ambient layers; the selected timer advances their timelines. */
export function stepAmbientAnimations(scene:HTMLElement,delta:number){
  (scene.getAnimations?.({subtree:true})??[]).forEach(animation=>{
    if(AMBIENT_ANIMATIONS.has((animation as CSSAnimation).animationName)&&animation.playState==='paused'&&typeof animation.currentTime==='number')animation.currentTime+=delta*animation.playbackRate;
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
    };
    reset();
    if (reducedMotion) return;
    let frame: number | undefined;
    let timer: number | undefined;
    let previousTime: number | undefined;
    let elapsed = 0;
    let onScreen = true;
    const animate = (now: number) => {
      const delta=previousTime===undefined?0:Math.min(intervalMs||100,now-previousTime);
      elapsed+=delta;
      previousTime = now;
      const x = Math.sin(elapsed / SCENE_DRIFT.periodMs * Math.PI * 2) * SCENE_DRIFT.amplitudePx;
      scene.style.setProperty('--scene-x', `${x.toFixed(3)}px`);
      if(intervalMs){stepAmbientAnimations(scene,delta);timer=window.setTimeout(()=>animate(performance.now()),intervalMs);}
      else frame = requestAnimationFrame(animate);
    };
    const update = () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      window.clearTimeout(timer);timer=undefined;
      frame = undefined;
      previousTime = undefined;
      scene.classList.toggle('f-scene-paused', document.hidden || !onScreen);
      if (!document.hidden && onScreen) {
        if(intervalMs)animate(performance.now());else frame = requestAnimationFrame(animate);
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
      observer?.disconnect();
      document.removeEventListener('visibilitychange', update);
      scene.classList.remove('f-scene-paused');
      reset();
    };
  }, [sceneRef, reducedMotion, intervalMs]);
}
