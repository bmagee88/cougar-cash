# Butterfly and diffuse daylight artwork

The original generic butterfly described below is retained for older notebook entries. Current visitors use fourteen species-specific asset sets; see [species research](butterfly-species-research.md) and [the current generation prompts](butterfly-artwork-prompts.md). Night moths now have a separate nighttime visitor pool.

The butterfly sheet was generated with the built-in ImageGen tool (transparent background), then cropped, aligned and encoded by `scripts/assemble-fishing-butterfly.py`. It preserves the eight generated wing poses. Runtime GIF: `public/assets/fishing/effects/butterfly-flutter.gif` (160 × 112, eight frames, 55 KB). The perched pose uses an optimized WebP; the PNG master and full generated sheet remain beside the GIF.

## Generation prompt

Use case: stylized-concept. Asset type: transparent 4 by 2 animation sprite sheet for a small butterfly in a polished hand-painted realistic fishing lake game. Primary request: exactly EIGHT evenly spaced frames in a regular 4-column, 2-row grid, each cell same size, no borders, labels, ground or shadows. The SAME natural orange-gold butterfly with fine brown veins, dark brown wing edges with tiny cream spots, slim dark body and antennae, viewed slightly from above, head up, body centered at the same point and same scale in every cell. All eight cells show progressive wingbeat poses: row1 wings fully spread, 65% spread, 30% spread, wings folded nearly upright; row2 15% spread, 40% spread, 70% spread, fully spread. Wings fold upward symmetrically about the long body, do NOT rotate the whole butterfly or change its identity. Wings and body have delicate painterly texture, believable anatomy, softly lit and no glow or saturated cartoon look. Butterfly fits entirely inside each cell with generous empty margin. Actual transparent background with clean alpha edges, NO checkerboard drawn, no text, no other objects. Output a wide sheet, aspect ratio 2:1.

## Weather references

- National Park Service, [Low clouds over Lake Chelan](https://npgallery.nps.gov/AssetDetail/5c249b3d1a6a4c609f5a29682cc178ce): bright diffuse gray sky, gray sky reflection on the lake, dark green foreground, softened distant ridges.
- National Park Service, [Lightning over south Lake Chelan](https://npgallery.nps.gov/AssetDetail/664bc3189da54f0cbf113b2b14e294c7): dense dark cloud deck and subdued landscape; lightning belongs in the background clouds.

These are visual references, not source textures. The game's painted assets retain their colors. Weather compresses contrast, reduces brightness moderately and applies a neutral gray veil. Only the actual lake clock invokes the dark, desaturated nighttime grade and lantern. Existing cloud, fog, rain, lighting and wind fades are retained.

Butterflies check for visits after 8–18 seconds, then every 42–72 seconds. Visit probabilities are 70% spring, 40% summer, 12% autumn and 0% winter per check; overcast multiplies by 0.45, heat by 0.7. They appear 07:00–18:00 in fair/cloudy weather, with one (70%), two (24%) or three (6%) visitors. Current visitors fly irregular paths through a doubled scene area, vary their depth, and react to mouse proximity and speed; see [flight and picking behavior](butterfly-species-research.md#rendering-and-discovery). Hidden/offscreen scenes pause; reduced-motion scenes omit visits. The developer preview respects day/season/weather eligibility.
