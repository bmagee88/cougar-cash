# Night lighting and lantern artwork

Generated using the built-in image_gen tool, with the existing autumn angler as a style reference only. The PNG master retains alpha. The existing optimization settings produce a 128 × 192 runtime WebP (14,904 bytes), enough for this small scene prop.

- Master: public/assets/fishing/effects/lantern-painted.png
- Runtime: public/assets/fishing/optimized/effects/lantern-painted.webp

## Final prompt

```text
Use case: stylized-concept.
Asset type: small transparent game prop, a lantern placed on a fishing dock just behind a seated angler.
Input image: style reference only, the painted seated fisherman. Do not reproduce the fisherman.
Primary request: one old-fashioned compact kerosene hurricane lantern, upright, with dark weathered olive-bronze metal base, two protective side rails, clear glass globe enclosing a tiny warm amber flame, a capped vented top and a curved wire handle raised above it.
Style: match the detailed naturalistic hand-painted gouache / storybook game illustration of the reference. Realistic proportions and subtle brush texture, readable small silhouette, restrained material highlights.
Composition: isolated single complete lantern centered, three-quarter view looking slightly down at its base, matching a shoreline viewed from a slightly elevated camera. Lantern fills 85% of the canvas height with small even padding. Tall narrow aspect. The lantern is roughly shin-high to an adult, not a giant object.
Lighting: tiny bright golden flame and warm glass core; metal stays dark, with amber edge highlights. Do not paint an external glow or light pool: the game adds that separately.
Constraints: actual transparent background, clean alpha edges, no ground, no dock, no fisherman, no scenery, no text, no frame, no opaque black background. Only the lantern.
```

## Research and interpretation

- [NPS / Neal Herbert: Yellowstone lake at night](https://npgallery.nps.gov/LAVO/AssetDetail/2ef91b9f-ad6d-4c60-9a57-d2386724aeb7): nearly black shoreline silhouettes and restrained water reflections. This is a 25-second, ISO-3200 exposure; its recorded sky detail is not treated as naked-eye brightness.
- [NPS: Dark adaptation and night vision](https://www.nps.gov/articles/dark-adaptation-of-the-human-eye-and-the-value-of-red-flashlights.htm): rods dominate in low light, with much less perceived color. This informs strong distance desaturation.
- [NPS: Stargazing in Zion](https://www.nps.gov/zion/planyourvisit/sunset-stargazing.htm): new-moon nights are darkest; moonlight reveals terrain and washes out fainter stars. This informs phase/elevation/cloud-sensitive cool illumination.

The cool moonlight color, exposure curve and lantern reach are artistic approximations for a readable painted game, not a calibrated physical renderer. Moonlight lifts the distance behind the foreground. A separate warm light pass uses the original foreground alpha and a steep spatial falloff, preserving paint texture and avoiding a glowing lake or uniformly bright angler. The lantern shares the angler's seated anchor on both dock and rock bank. Mask coordinates are measured only on layout/image-load changes, with reads batched before writes. Night-only light passes disappear after the daylight fade; no per-frame lighting measurements or timers are added.

