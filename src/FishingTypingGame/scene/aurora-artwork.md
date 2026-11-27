# Painted aurora overlay

The aurora uses newly generated transparent artwork in place of the procedural
SVG ribbons. Only the auroral light is in the image: the live star field, moon,
clouds and location silhouettes remain independent layers.

- PNG master: `public/assets/fishing/sky/aurora-painted.png` (2172 × 724, RGBA).
- Runtime: `public/assets/fishing/optimized/sky/aurora-painted.webp` (same size).
- Built-in ImageGen was used with `transparent_background: true`.
- The generated alpha is preserved byte-for-byte in the runtime copy. WebP was
  encoded with Pillow at quality 94, method 4, `exact=True`; no artwork pixels
  were repainted or background-keyed. The general fishing artwork optimizer can
  also rebuild this file from the master.

`Aurora` in `SkyEvents.tsx` loads the image only while the scheduled event is
mounted at night. It shares the existing painted lake crop, sky/terrain mask,
moonlight attenuation and event strength. One image drifts and breathes on the
existing ambient timelines; sampled rendering, hidden/offscreen pausing and
reduced motion still apply. The event probabilities and meteor artwork are
unchanged.

## Exact generation prompt

```text
Use case: stylized-concept.
Asset type: a production-quality transparent northern lights sky overlay for Stillwater, a tranquil painterly 2D lake fishing game.
Primary request: create a NEW beautiful aurora borealis artwork, with the convincing organic structure and fine detail of real northern lights. This must look like luminous atmospheric light, gracefully folded translucent silk curtains in the sky, softly painterly and richly detailed, never a vector graphic.
Composition: wide panoramic 3:1 canvas. A broad, sweeping, asymmetric emerald auroral curtain meanders across the central width, folding back on itself in places with natural perspective and many delicate closely spaced vertical rays stretching upward from its luminous, finely rippled lower hem. Two softer, more distant arcs add depth. The major curtain and its fine vertical rays occupy roughly the middle 75 percent of the canvas height, with generous fully transparent breathing room above and below. Keep the display interesting in the central half as it is cropped on portrait phones. Each end softly dissipates to full transparency before the image boundary; no visibly cut-off edges.
Light/color: saturated but elegant oxygen emerald and mint green along the crisp luminous lower folds, softly fading through teal up the vertical striations, with a restrained, faint violet and rose blush at the highest tips. Some folds glow brilliantly while others fall into delicate translucent wisps. Rich contrast and a sense of vastness. Avoid flat solid ribbons, opaque green smoke, uniform repeated waves or a comb of identical straight lines.
Background: GENUINELY TRANSPARENT ALPHA everywhere except the auroral light. Interior gaps between the curtains are also transparent; preserve luminous translucent fringe and wisps. This image is composited over an existing navy night sky and real star field.
Constraints: ONLY the aurora light itself. No sky fill, no black or blue background, no checkerboard painted into the image, no stars, no moon, no mountains, no trees, no landscape, no horizon, no lake, no reflection, no clouds, no text, no border, no watermark. Deliver polished finished bitmap game artwork on transparency, not a diagram or concept sheet.
```
