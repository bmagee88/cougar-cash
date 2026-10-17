import React, { CSSProperties, memo, useLayoutEffect, useRef } from 'react';
import { SceneAsset } from '../engine/types';

/** One ground receiver for every seated rig. Multiply is applied to the whole
 * masked group so its children blend with the actual dock/rock texture below. */
export default memo(function AnglerShadow({ surface, outfit, characterStyle }: {
  surface?: SceneAsset; outfit: string; characterStyle: CSSProperties;
}) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const shadow = root.current, parent = shadow?.parentElement;
    if (!shadow || !parent || !surface) return;
    const ground = Array.from(parent.querySelectorAll<HTMLImageElement>('img[data-layer]'))
      .find(image => image.dataset.layer === surface.id);
    if (!ground) return;
    const measure = () => {
      // Both siblings use the same containing block. Offset geometry excludes
      // ambient transforms; CSS adds their shared parallax without any JS loop.
      shadow.style.setProperty('--shadow-ground-x', `${ground.offsetLeft}px`);
      shadow.style.setProperty('--shadow-ground-y', `${ground.offsetTop}px`);
      shadow.style.setProperty('--shadow-ground-w', `${ground.offsetWidth}px`);
      shadow.style.setProperty('--shadow-ground-h', `${ground.offsetHeight}px`);
      shadow.style.setProperty('--shadow-ground-parallax', ground.style.getPropertyValue('--parallax') || String(surface.parallax));
      shadow.dataset.ready = String(ground.offsetWidth > 0 && ground.offsetHeight > 0);
    };
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(parent); observer?.observe(ground);
    ground.addEventListener('load', measure);
    window.addEventListener('resize', measure); measure();
    return () => {
      observer?.disconnect(); ground.removeEventListener('load', measure);
      window.removeEventListener('resize', measure);
    };
  }, [surface]);
  if (!surface) return null;
  const seated = Object.prototype.hasOwnProperty.call(characterStyle, '--seat-x');
  return <div ref={root} className="f-angler-shadow" data-layer="angler-shadow" data-shadow-surface={surface.id} data-ready="false" aria-hidden="true" style={{
    '--shadow-ground-mask': `url("${surface.src}")`, '--shadow-ground-parallax': surface.parallax,
    '--shadow-outfit': `url("${outfit}")`,
  } as CSSProperties}>
    <div className={`f-angler-shadow-rig ${seated ? 'f-character-seated' : ''}`} style={characterStyle}>
      <i className="f-angler-shadow-cast" />
      <i className="f-angler-shadow-seat" />
      <i className="f-angler-shadow-boot f-angler-shadow-boot-far" />
      <i className="f-angler-shadow-boot" />
    </div>
  </div>;
});
