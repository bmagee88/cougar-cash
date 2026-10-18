# Birch Point and Willow Cove shallows

Created with built-in image generation on 2026-10-17; no API or CLI fallback.

Runtime assets:
- `public/assets/fishing/locations/birch-point/shallow-lakebed.webp` — granite gravel and cool sand.
- `public/assets/fishing/locations/willow-cove/shallow-lakebed.webp` — organic silt, leaf fragments and small roots.

Sources retained at:
- `C:/Users/Kathleen Dippyolito/.codex/generated_images/01a149bf-9559-7c21-bd97-ac31ba63fa62/exec-50965254-86a9-473e-9a6c-11dd46cbfacc.png`
- `C:/Users/Kathleen Dippyolito/.codex/generated_images/01a149bf-9559-7c21-bd97-ac31ba63fa62/exec-05a5a64a-ae8d-4e8c-9073-80eadb5df054.png`

Encoded as 960×480 WebP at quality 80. Only the active location's bed is mounted. `ShoreShallows` sits inside the same responsive ground plane as its seasonal shore and angler, inheriting one shared foreground parallax transform. A slightly extended copy of the actual seasonal shore supplies the submerged granite/rock/root face, with a narrow shoreline mask and water tint. Depth masks fade that face into the separately painted bottom, then into the lake. This avoids a detached flat bottom underneath a cutout bank, and keeps seasonal swaps and mobile/desktop crops aligned.

The static bed and bank use one SVG. Shore waves and caustics use a separate small-path SVG, keeping the large images out of the animated layer. No new animation loop, timers, canvas sampling, per-frame geometry reads or turbulence/displacement filters. Native surface animation follows existing pause/reduced-motion rules and continues naturally at slower environment-render settings. The original dock implementation remains in place.

## Birch Point prompt

Use case: stylized-concept. Asset type: seamless-looking 2:1 landscape lake-bottom material for an illustrated freshwater fishing game, viewed from shore at a moderately downward oblique angle. Primary request: a distinctive northern lake bed at a rocky birch point: muted pale gray granite gravel, small rounded slate and granite stones, scattered low partly buried angular rocks, fine cool taupe sand in the gaps, occasional olive silt and tiny dark submerged twig fragments. Larger flat granite stones cluster gently at the lower-left foreground, becoming smaller loose pebbles toward upper-right, with broad quiet areas of sediment. Convincing detailed hand-painted natural materials matching a polished realistic storybook landscape, restrained contrast, diffuse even neutral daylight. Texture fills every edge; shallow perspective, not a deep scene. Constraints: ONLY the bottom material, no visible water surface, reflections, ripples, caustic lighting, foam, shore, grass, tree, sky, horizon, fish, people, text, border, large dramatic boulders or patterned grid. No blue/turquoise color wash; water tint and depth fade will be applied by the app.

## Willow Cove prompt

Use case: stylized-concept. Asset type: 2:1 landscape lake-bottom material for an illustrated freshwater fishing game, viewed from the bank at a moderately downward oblique angle. Primary request: a quiet sheltered willow-cove bottom, distinct from sand or gravel: soft dark umber and olive-brown silt, low undulating muck and fine sediment, a little scattered leaf litter partly decomposed and embedded, a few slender sunk twigs and root fibres, small partly buried smooth stones, slightly lighter silty sandy patches between darker organic deposits. Organic restrained irregular detail, broad quiet areas; no dense carpet of leaves. Materials slightly larger at lower-left and finer toward upper-right. Detailed natural hand-painted landscape style, softly modeled, muted low contrast, diffuse even neutral daylight. Texture fills every edge. Constraints: bottom material only, no visible shoreline, grass, standing trees, large roots arching above the bottom, sky, horizon, fish, animals, people, text, border, water surface, reflections, foam, ripples, caustic lighting or bright highlights. No tropical color. The app supplies water tint and depth fade.

