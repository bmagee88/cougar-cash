import React, { memo, useEffect, useRef } from 'react';
import { environmentTransitionMs } from '../engine/environment';

export type HeavyRain = 'thunderstorm' | 'hurricane';
export const rainDensity = (weather: HeavyRain) => weather === 'hurricane'
  ? { near: 520, distant: 240, rings: 96 } : { near: 320, distant: 160, rings: 64 };

/** Same layered storm density, drawn into one bounded-resolution surface. */
export function drawRain(context: CanvasRenderingContext2D, width: number, height: number, time: number, weather: HeavyRain) {
  const density = rainDensity(weather), hurricane = weather === 'hurricane';
  context.clearRect(0, 0, width, height);
  for (const distant of [true, false]) {
    const count = distant ? density.distant : density.near;
    context.beginPath();
    context.lineWidth = distant ? .65 : 1;
    context.strokeStyle = distant ? '#dce6ef55' : '#e1edf49a';
    const length = distant ? 16 : hurricane ? 46 : 36;
    const angle = (hurricane ? 42 : 22) * Math.PI / 180;
    const dx = Math.sin(angle) * length, dy = Math.cos(angle) * length;
    for (let i = 0; i < count; i++) {
      const duration = distant ? .45 + i % 5 * .035 : (hurricane ? .27 : .38) + i % 5 * .025;
      const phase = ((time / 1000 + i * (distant ? .073 : .137)) / duration) % 1;
      const x = (i * (distant ? 31.73 : 37.17) % 116 - 8) / 100 * width + phase * (hurricane ? 230 : 110);
      const y = (i * (distant ? 17.19 : 23.41) % 100) / 100 * height - 60 + phase * 270;
      context.moveTo(x, y); context.lineTo(x + dx, y + dy);
    }
    context.stroke();
  }
  context.lineWidth = .8;
  for (let i = 0; i < density.rings; i++) {
    const phase = ((time / 1000 + i * .32) / (.65 + i % 4 * .1)) % 1;
    context.globalAlpha = (1 - phase) * .5;
    context.strokeStyle = '#e4f3f1'; context.beginPath();
    context.ellipse((4 + i * 17.31 % 94) / 100 * width, (53 + i * 7.17 % 42) / 100 * height, 9.5 * (.4 + phase * 1.2), 2.5 * (.4 + phase * 1.2), 0, 0, Math.PI * 2);
    context.stroke();
  }
  context.globalAlpha = 1;
}

export default memo(function RainCanvas({ weather, reducedMotion, intensity, intervalMs = 0 }: { weather: HeavyRain; reducedMotion: boolean; intensity: number; intervalMs?:number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const snapshot = useRef<HTMLCanvasElement>(null);
  const enabled = intensity > 0;
  useEffect(() => {
    const surface = canvas.current;
    if (!surface || typeof CanvasRenderingContext2D === 'undefined') return;
    const context = surface.getContext('2d'); if (!context) return;
    const oldSurface = snapshot.current, oldContext = oldSurface?.getContext('2d');
    let blend: Animation | undefined, reveal: Animation | undefined;
    const cancelBlend = () => { blend?.cancel(); reveal?.cancel(); };
    let width = 0, height = 0, frame = 0, last = -Infinity, elapsed = 0, previous: number | undefined, onScreen = true;
    let timer:number|undefined;
    const paint = () => drawRain(context, width, height, reducedMotion ? 1700 : elapsed, weather);
    const animate = (now: number) => {
      if (intervalMs || now - last >= 1000 / 30) {
        const sampled = intervalMs > 0 && previous !== undefined;
        // Preserve the previous painted sample. Only opacity animates during the
        // blend; neither canvas needs another rain draw until the next deadline.
        cancelBlend();
        if (sampled && oldSurface && oldContext) {
          oldContext.clearRect(0, 0, width, height); oldContext.drawImage(surface, 0, 0);
        }
        elapsed += previous !== undefined ? Math.min(intervalMs||100, now - previous) : 0; previous = now;
        last = now; paint();
        if (sampled && oldContext && oldSurface?.animate) {
          const timing = { duration: environmentTransitionMs(intervalMs), easing: 'ease-in-out' };
          blend = oldSurface.animate([{ opacity: 1 }, { opacity: 0 }], timing);
          reveal = surface.animate?.([{ opacity: 0 }, { opacity: 1 }], timing);
        }
      }
      if(intervalMs)timer=window.setTimeout(()=>animate(performance.now()),intervalMs);
      else frame = requestAnimationFrame(animate);
    };
    const update = () => {
      cancelAnimationFrame(frame); frame = 0; previous = undefined; last = -Infinity; cancelBlend();
      window.clearTimeout(timer);timer=undefined;
      if (!enabled || document.hidden || !onScreen) return;
      if (reducedMotion) paint(); else if(intervalMs)animate(performance.now());else frame = requestAnimationFrame(animate);
    };
    const resize = () => {
      const box = surface.getBoundingClientRect();
      // Atmospheric detail needs neither retina pixels nor a 4K backing store.
      const scale = Math.min(1, 1440 / Math.max(1, box.width), 900 / Math.max(1, box.height));
      width = box.width; height = box.height;
      cancelBlend(); surface.width = Math.max(1, Math.round(width * scale)); surface.height = Math.max(1, Math.round(height * scale));
      // Keep streak lengths and lake impacts in CSS pixels as the backing store shrinks.
      context.setTransform(scale, 0, 0, scale, 0, 0);
      if (oldSurface) { oldSurface.width = surface.width; oldSurface.height = surface.height; }
      paint();
    };
    resize();
    const size = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : undefined;
    size?.observe(surface); window.addEventListener('resize', resize);
    const visibility = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => { onScreen = entries[0]?.isIntersecting ?? true; update(); }) : undefined;
    visibility?.observe(surface); document.addEventListener('visibilitychange', update); update();
    return () => { cancelAnimationFrame(frame); window.clearTimeout(timer); cancelBlend(); size?.disconnect(); visibility?.disconnect(); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', update); surface.width=1;surface.height=1;if(oldSurface){oldSurface.width=1;oldSurface.height=1;} };
  }, [weather, reducedMotion, enabled, intervalMs]);
  const density = rainDensity(weather);
  return <><canvas ref={canvas} className="f-rain-canvas" data-testid="storm-rain-canvas" data-near-drops={density.near} data-distant-drops={density.distant} data-water-impacts={density.rings} aria-hidden="true" />
    {intervalMs > 0 && !reducedMotion && <canvas ref={snapshot} className="f-rain-canvas" style={{ opacity: 0 }} data-testid="storm-rain-snapshot" aria-hidden="true" />}</>;
});
