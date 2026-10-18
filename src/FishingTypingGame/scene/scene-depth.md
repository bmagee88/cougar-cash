# Scene distance and perspective

`sceneDepth.ts` defines one distance convention for flying insects, manual
dragonflies, plant destinations and tree-bird routes. X and Y are normalized
projected coordinates in the visible scene (or the explicitly named artwork
frame for a static map). Z is normalized camera distance: 0 near the viewer,
1 at the far-shore limit. CSS z-index remains a separate paint order.

The perspective ratio is `1 / (1 + 24*z)`. The foreground Z is measured by
inverting the water projection at the nearer boot's ground contact (80% x,
93% y in the shared outfit frame). Dock, Cove and Birch use their own rendered
seat, shore and background geometry, including responsive crops. The shadow
rig supplies the stable seated frame, so breathing/casting does not move the
depth reference. Scenes without an angler fall back to Z .14.

On a depth change, projected X/Y
contract about `(0.5, shorelineY)` by the ratio of new and old camera scales.
Insect size and movement use that same calibrated distance curve. An insect below the shoreline moves
up as it recedes; an insect above it moves down toward it. Coming closer reverses
the projection. The finite far limit leaves a small gap above/below the shoreline
rather than placing a finite object at the mathematical point at infinity.

Screen travel uses `(min(1, ratio(z)/ratio(.06)))^1.65`: close visitors keep
their existing lively pace; far-shore horizontal/vertical travel becomes much
slower. The exponent intentionally emphasizes distance in the painted
scene. It applies to both axes and the natural wingbeat bob, not to wing speed.
Manual arrows use the same multiplier as wild visitors.

The water surface is `shorelineY + (1-shorelineY)*ratio`. Its calibrated inverse estimates
the distance of visible plant roots. Both natural and controlled insects stop
descending at that surface. The closest depth permits Y=1 at the screen bottom;
farther depths raise the maximum Y toward the shoreline. At the measured angler Z, lateral
travel over open water remains level with the angler's boots instead of
appearing near the far bank. The near endpoint stays at the screen bottom;
the far endpoint retains the 25:1 distance ratio. Tall flower heads inherit their root's
distance, rather than receiving a larger distance because their tip is higher.
Foreground plant anchors stay on the near side of the painted bank. Hanging
branches use authored depth because their canopy height is not a ground point.
Plants use the same calibration for inverse ground depth and visual scale, so
their existing screen sizes, painted root contacts and daily placements remain
consistent. Changing distance
units does not reroll the garden. Landscape tree depths occupy the distant band;
close tree trunks occupy the foreground band. Tree birds retain their authored
route-depth sizing and exact mapped endpoints.

The shoreline is measured from each location's actual background rectangle,
including responsive cover cropping: Dock/Birch use 50% source height and Cove
55.5%. Boot calibration is measured on layout/load/resize, not during each
animation frame. A camera change reprojects flying insects reversibly; perched
insects continue following their measured plant contacts.
Flight updates add only scalar arithmetic to their existing capped RAF loop.

At the measured angler Z visitors move behind the foreground cutouts (CSS layer 4); returning
nearer moves them in front (layer 11). The manual glow follows the same paint
order. Transparent water remains visible; opaque shore, plants and angler art
hide the visitor. This is a 2.5D camera over painted layers, so the reference
represents the foreground as one compositing band rather than a full 3D terrain mesh.
Depth travel also tests the projected ray's crossing of that band against the
foreground's painted pixels. A solid crossing stops just before the measured
plane in either direction, with at most .001 Z clearance. Steering around the
silhouette or crossing a transparent gap
allows depth travel again. Clearance is capped at a quarter of the foreground
distance when the boots are especially close to the viewer, avoiding negative Z.
Long simulation steps cannot jump through the plane.
Wild insects cancel a blocked depth course and choose a new course.

Depth travel also eases down after the foreground plane. `advanceSceneDepth`
integrates in `z + 1.5*max(0,z-foregroundZ)^2` and uses its analytic inverse.
Consequently equal inputs cover less Z farther away, in addition to the natural
reduction in apparent motion from perspective. The result is independent of
frame rate and reverses without drift. Near R/F speed remains .22 units/second;
Shift+R/F uses 1% of that for precise ground-reference comparisons.

`foregroundCollision.ts` caches alpha masks bounded to 512 pixels on their
longest side, shared by image/source across the visitor families. Geometry is
refreshed on layout/image load; hit tests follow existing camera drift using
inline custom properties. The normal flight path performs no canvas readback
or layout measurement. The mask follows the static painted silhouette; it is
an approximation for independently swaying leaves or an animated rod.
Picking retains the existing foreground alpha masks so covered wild visitors
cannot be collected through opaque art.

## Reference

Pharr, Jakob & Humphreys, *Physically Based Rendering*, 4th edition,
[Projective Camera Models](https://www.pbr-book.org/4ed/Cameras_and_Film/Projective_Camera_Models).
The projective-camera and foreshortening discussion supplies the perspective
principle. The camera constants, shoreline estimates and foreground band above
are artistic choices fitted to this game's painted locations.

## Validation

Focused tests cover reversible position/size projection without accumulated
drift, both sides of the shoreline, inverse water depth, location measurements,
normalized maps, natural flight, landing and evasion, manual input/draw order,
distance-scaled movement on both axes, a depth-dependent bottom edge, swept
collisions in both directions, transparent gaps, mirrored/clipped art, mask
reuse and continuous bird growth on approach. Browser checks exercise R/F depth travel
and shore-art occlusion; viewport checks verify location-specific horizons.
