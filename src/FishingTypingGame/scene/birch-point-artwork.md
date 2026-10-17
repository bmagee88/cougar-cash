# Birch Point layered scene

Created with the built-in `image_gen` tool from the approved painting at
`output/location-references/birch-point/reference-v1.png`. No external artwork.
The exact extraction prompts are in that folder's `prompts/autumn-*.txt` files;
all spring, summer and winter edit prompts are in `seasonal-prompts.json`.

## Assets

All 25 PNG masters retain the reference's 1774 × 887 canvas:

- `public/assets/fishing/locations/birch-point/shared/sky-painted.png`
- In each of `spring`, `summer`, `autumn`, `winter`: `mountains-painted.png`,
  `far-trees-painted.png`, `treeline-water-painted.png`, `shore-seat-painted.png`,
  `birches-painted.png`, and `right-plants-painted.png`.

Each compositing layer has genuine alpha, including the fine birch branches.
Water fills the lower canvas, with the generated artwork's slight painterly
translucency preserved. The sky is fully opaque. Snow, foliage and corresponding
reflections change with the season; winter retains an open lake for fishing.
Sun, moon, clouds, fog, weather, wildlife, and light beams remain runtime layers.

`scripts/optimize-birch-point-artwork.py` verifies dimensions, alpha, the seated
attachment point and lake coverage, then encodes WebP copies under the matching
`public/assets/fishing/optimized/locations/birch-point/` paths. It verifies that
the WebP alpha matches the PNG exactly. Total runtime artwork is 4,518,186 bytes
for all four seasons; a scene loads its current season and the shared sky.
The script also creates the four-season review sheet and `birch-ridges.json`,
sampling the combined landscape alpha edge for sunrise/sunset and goose backlight.
It does not repaint the generated images.

## Placement and behavior

The sky, mountains, distant forest and nearer treeline/water share the 2:1 lake
cover frame. Their edges stay registered. Lake shoreline y is 0.50. Foreground
rock, birch trunks and the right-hand plants share the seated angler's separate
2:1 ground frame. His hip attachment is (0.24, 0.76), source width 0.13; the
existing desktop character scale and mobile frame apply independently. Foreground
map markers use exactly this same frame and parallax. There are no extra
animation loops or full-scene canvases for this location.

`treeMap.ts` stores ten nearer landscape trees plus two foreground birches, each
with top and bottom x/y/z. Coordinates are normalized to the named `frame`:
`landscape` or `foreground`. Larger z means farther away. Distant bird routes
use the ten landscape trees and their top-third perches. The two close birches
are included in the developer map and its JSON inspector.

The scene shares all existing clouds, time and night grading, moonlight,
sunrise/sunset mountain contrast, Sailor's Delight, aurora, meteors, independent
lake fog, seasonal weather, birds, geese, splashes, visitor collection, lantern
light, sound, fishing line and seasonal angler outfits. Butterflies can perch on
the granite bank and right plants. Splash placement and insect depth floors use
the Birch Point waterline after responsive cropping.

Birch Point is the third travel destination, at 50 lake coins. Development builds
also offer an unsaved Preview location dropdown in the Developer tackle box.
This only previews the scenery; catches and journal observations still belong
to the saved fishing location. Reloading clears the preview.

## Validation

Use the optimizer above, the `birchPoint`, `scene`, `treeBirds`, `solarLighting`,
`lakeFog`, `lakeVisitors`, `mobile-and-butterflies`, `FishingGame`, `lantern` and
`waterAudio` Jest suites, and a production build. Browser proof images and the
four-season composite are saved under `output/location-references/birch-point/`.
