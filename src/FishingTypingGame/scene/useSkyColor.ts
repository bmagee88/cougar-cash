import { useEffect, useState } from 'react';

type SkyPixels = { data: Uint8ClampedArray; width: number; height: number };
const cache = new Map<string, SkyPixels>();

/** Read the sky's color only; the source artwork is never altered. */
export function useSkyColor(src: string, xPercent: number, yPercent: number) {
  const [pixels, setPixels] = useState<SkyPixels | undefined>(() => cache.get(src));
  useEffect(() => {
    const cached = cache.get(src);
    setPixels(cached);
    if (cached) return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return;
        context.drawImage(image, 0, 0);
        const value = { data: context.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height };
        cache.set(src, value); setPixels(value);
      } catch { /* A custom cross-origin manifest can fall back to the sky palette. */ }
    };
    image.src = src;
    return () => { cancelled = true; image.onload = null; };
  }, [src]);
  if (!pixels) return '#becfb4';
  // The backdrop has one percent overscan on all sides.
  const x = Math.max(0, Math.min(pixels.width - 1, Math.round((xPercent + 1) / 102 * pixels.width)));
  const y = Math.max(0, Math.min(pixels.height - 1, Math.round((yPercent + 1) / 102 * pixels.height)));
  const offset = (y * pixels.width + x) * 4;
  return `rgb(${pixels.data[offset]}, ${pixels.data[offset + 1]}, ${pixels.data[offset + 2]})`;
}
