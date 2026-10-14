# Reel-path grass cover

Generated with the built-in imagegen tool on October 14, 2026.

Final project asset: `public/assets/fishing/effects/grass-cover-painted.png`
(1273 × 1236 RGBA, genuine alpha). The original generated image is retained
under `.codex/generated_images/01a13070-4fa8-73d0-b21c-87af0d94cb43/exec-4a68360b-ec1a-4fb8-81f4-b8bd76c57d37.png`.

Style reference: `public/assets/fishing/locations/cedar/spring/reeds-painted.png`.
This reference was inspected and supplied to the built-in generation tool.

## Final generation prompt

Use case: stylized-concept. Asset type: transparent cutout sprite for the Stillwater painted fishing game. Input image: style reference only, the existing hand-painted shoreline reeds. Generate ONE small isolated tuft of emergent aquatic grass poking out of the lake water. 12–18 thin curved sedge blades, soft painterly texture, olive and fresh green leaves with restrained warm highlights, same detailed naturalistic storybook landscape painting style as the reference. View from an angler on shore looking slightly down across the water, not overhead. Compact, sparse, roughly as tall as wide. Blades converge to a narrow flat waterline at the bottom center of the sprite, no ground, no roots, no rocks, no cattails, no flowers, no water scene, no horizon, no sun, no text, no border, no glow. Clean genuinely transparent background and transparent gaps between the blades. The leaf silhouettes should remain legible when rendered at 35–70 pixels tall. Centered tuft fills the canvas with a small even transparent margin, tips and base fully in frame. Match the reference brushwork and natural green colors.

## Scene behavior

Interactive retrieval uses the actual rolled cover mask. Each contiguous run
of green letters becomes one clump, centered on its covered letter positions
along the same measured reel path as the bobber. The path accounts for cast
distance, the seated angler, the viewport and ambient drift. A small waterline
ripple and a faint compressed reflection seat the tuft in the lake. Its ripple
brightens only while the current retrieve cursor is on that cover run. The
clumps remain through the battle and landing, then clear at the end of the
cast. Standard fishing has no cover-letter indicators. Fullscreen uses the
same geometry. Scene lighting, weather tint, wind sway and reduced-motion
preferences apply to the tufts.
