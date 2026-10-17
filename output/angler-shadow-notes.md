# Shared angler ground shadow

Implemented in `src/FishingTypingGame/scene/AnglerShadow.tsx`, mounted once by
the existing `CharacterAnimator`. All three locations and seasonal outfits use
the same code. Shadow styling is in `fishing.css`; light response is in
`scene/anglerShadowLight.ts`.

The shadow group uses CSS `mix-blend-mode: multiply`. Soft radial contact patches
sit beneath the seated hips and both boots. A faint flattened upper-body mask
uses the existing outfit image, with direction, length, softness and opacity
derived from the existing environment clock. Contact shading remains under
overcast skies; direct casts soften with cloud cover. At night a small cast
responds to the lantern/moon lighting.

The group's mask is the existing support artwork's alpha (dock or shoreline).
Its dimensions follow the rendered surface via ResizeObserver and image-load
events. Both shadow rig and angler reuse the same seat, size and parallax values.
This keeps darkness on the support surface instead of painting onto transparent
air or lake pixels. The group blends above the ground and below the angler.

No new image assets, canvas pixel copying, animation loops or recurring timers.
Layout observers and load/resize listeners disconnect when the effect unmounts.
Stepped environment rendering and reduced motion disable shadow transitions.

References used to select the blend:

- https://www.w3.org/TR/compositing-1/#blendingmultiply
- https://www.w3.org/TR/compositing-1/#blendingcolorburn
- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/isolation

Multiply scales underlying color channels, which suits darkening painted ground
while retaining its texture. Color burn adds stronger contrast/color changes;
it was not selected for this shadow. The blend is applied to the complete masked
group, rather than to a child isolated from the ground by a transformed parent.

Validation: 20 tests in five suites cover scene/season reuse, matching geometry,
responsive mask updates, cleanup, weather and low-light response. Browser checks
verify actual multiply compositing, valid stacking order and desktop/mobile
alignment. Screenshots are saved as `output/angler-shadow-*.png`.
