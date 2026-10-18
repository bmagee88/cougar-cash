# Dock shallows

Runtime artwork: `public/assets/fishing/locations/cedar/shallow-lakebed.webp`.
Generated with the built-in ImageGen tool, then encoded as WebP (quality 85).
The source artwork is stationary; SVG depth masks, a translucent water tint,
and small CSS animations supply depth, surface light, shore waves and post rings.
The dock and left bank share the existing ground frame; the right shallows
follow the right bank's scale and parallax. Only the dock location mounts these layers.
Animation pauses with the scene and respects reduced motion. Environment-render
sampling does not seek or pause these foreground water effects.

## Final generation prompt

Use case: stylized-concept. Asset type: a landscape 2:1 game texture for a freshwater lake bottom, to be composited beneath a translucent water layer in an illustrated fishing game. Primary request: paint an uninterrupted close view of a natural sandy and slightly mucky lake bed, seen looking downward at a gentle oblique angle from the shore. Fine warm taupe sand with subtle irregular sediment ridges, patches of darker olive-brown silt, a few small rounded grey and umber pebbles partly buried in the sand, a couple of tiny sunken twigs. Scattered and organic, mostly quiet sandy negative space. Small details, convincing delicate hand-painted brushwork, softly modeled material, restrained contrast and muted earthy palette. The foreground sediment and stones slightly larger than the background. Diffuse even daylight. Full frame bottom texture extends to every edge. Constraints: bottom material only; no shoreline, grass, reeds, dock, fish, people, sky, horizon, text, border, white background, bright glints, caustics, foam or water surface reflections. The application supplies the water tint, reflections and animation. No dramatic lighting, no large boulders, no repeated geometric pattern, no tropical turquoise.
