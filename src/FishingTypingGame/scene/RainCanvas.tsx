import React, { memo, useEffect, useRef } from 'react';

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
    for (let i = 0; i < count; i++) {
      const duration = distant ? .45 + i % 5 * .035 : (hurricane ? .27 : .38) + i % 5 * .025;
      const phase = ((time / 1000 + i * (distant ? .073 : .137)) / duration) % 1;
      const x = (i * (distant ? 31.73 : 37.17) % 116 - 8) / 100 * width + phase * (hurricane ? 230 : 110);
      const y = (i * (distant ? 17.19 : 23.41) % 100) / 100 * height - 60 + phase * 270;
      context.moveTo(x, y); context.lineTo(x + Math.sin(angle) * length, y + Math.cos(angle) * length);
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

export default memo(function RainCanvas({ weather, reducedMotion, intensity }: { weather: HeavyRain; reducedMotion: boolean; intensity: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const enabled = intensity > 0;
  useEffect(() => {
    const surface = canvas.current;
    if (!surface || typeof CanvasRenderingContext2D === 'undefined') return;
    const context = surface.getContext('2d'); if (!context) return;
    let width = 0, height = 0, frame = 0, last = -Infinity, elapsed = 0, previous = 0, onScreen = true;
    const paint = () => drawRain(context, width, height, reducedMotion ? 1700 : elapsed, weather);
    const animate = (now: number) => {
      if (now - last >= 1000 / 30) {
        elapsed += previous ? Math.min(100, now - previous) : 0; previous = now;
        last = now; paint();
      }
      frame = requestAnimationFrame(animate);
    };
    const update = () => {
      cancelAnimationFrame(frame); frame = 0; previous = 0;
      if (!enabled || document.hidden || !onScreen) return;
      if (reducedMotion) paint(); else frame = requestAnimationFrame(animate);
    };
    const resize = () => {
      const box = surface.getBoundingClientRect(); width = box.width; height = box.height;
      // Rain is atmospheric; DPR > 1 adds fill cost without useful detail.
      surface.width = Math.max(1, Math.round(width)); surface.height = Math.max(1, Math.round(height));
      paint();
    };
    resize();
    const size = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : undefined;
    size?.observe(surface); window.addEventListener('resize', resize);
    const visibility = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => { onScreen = entries[0]?.isIntersecting ?? true; update(); }) : undefined;
    visibility?.observe(surface); document.addEventListener('visibilitychange', update); update();
    return () => { cancelAnimationFrame(frame); size?.disconnect(); visibility?.disconnect(); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', update); };
  }, [weather, reducedMotion, enabled]);
  const density = rainDensity(weather);
  return <canvas ref={canvas} className="f-rain-canvas" data-testid="storm-rain-canvas" data-near-drops={density.near} data-distant-drops={density.distant} data-water-impacts={density.rings} aria-hidden="true" />;
});
