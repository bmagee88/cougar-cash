# Seasonal artwork

Generated with the built-in **imagegen** tool, then copied into `public/assets/fishing/`. All original autumn assets remain available. The dock, seated fisherman, rod, and bobber remain separate and use their existing painted assets. The seasonal layers retain the existing very low background parallax and mostly horizontal foreground parallax.

## Final saved paths

Saved under `C:/Users/Kathleen Dippyolito/Documents/Clemente Projects/cougar-cash/`. Paths below are relative to that workspace root:

| Season | Background | Bank | Reeds |
|---|---|---|---|
| Spring | `public/assets/fishing/locations/cedar/spring/lake-background-painted.png` | `public/assets/fishing/locations/cedar/spring/grass-bank-painted.png` | `public/assets/fishing/locations/cedar/spring/reeds-painted.png` |
| Summer | `public/assets/fishing/locations/cedar/summer/lake-background-painted.png` | `public/assets/fishing/locations/cedar/summer/grass-bank-painted.png` | `public/assets/fishing/locations/cedar/summer/reeds-painted.png` |
| Winter | `public/assets/fishing/locations/cedar/winter/lake-background-painted.png` | `public/assets/fishing/locations/cedar/winter/grass-bank-painted.png` | `public/assets/fishing/locations/cedar/winter/reeds-painted.png` |

Moon: `public/assets/fishing/weather/moon-painted.png`. Backgrounds are 1774×887; banks 1536×1024; reeds 2172×724; moon 1254×1254. Banks, reeds and moon preserve transparent alpha. Each seasonal directory also contains an edited native `willow.svg` for the cove: green spring/summer palettes and bare winter branches with snow accents.

## Background edit prompt set

Use case: lighting-weather. Edit target: the existing combined painted lake background. Produce the requested season as one clean panoramic bitmap game background. Keep exactly the same camera, panorama proportions, mountain silhouettes, tree placement, shoreline at 50 percent, rock locations, ripple layout and reflection alignment. Match the same polished painterly quality. Change only seasonal foliage and terrain. Use neutral daylight so runtime color grading can create dawn, dusk and night. Keep the sky clear of sun and moon. No foreground bank, dock, person, rod, bobber, text, watermark or collage.

Season-specific instructions:

- Spring: fresh light green budding trees, subtle pale blossom accents within the existing tree shapes, new green grass, fresh leaves and snowmelt hints on distant peaks.
- Summer: rich dense green forest, lush shoreline vegetation, healthy green foliage in the existing tree silhouettes, calm blue-green open lake.
- Winter: snow on mountains, rocks and evergreens, bare deciduous branches, cool icy blue atmosphere; thin ice only at distant edges, central fishing lake stays open liquid water.

## Transparent bank and reeds edit prompt set

Use case: lighting-weather. Edit target: the original transparent painted bank or reeds asset. Create the requested seasonal variant with the exact same canvas, silhouette, plant and rock positions, empty alpha areas, camera and polished painterly style. Preserve transparency outside the objects and inside the central clear fishing opening. No cutout glow, solid background, water, dock, person or text.

- Spring: bright new green grass and reeds; tiny restrained wildflower accents in the grassy bank.
- Summer: lush full green grasses and reeds, warm healthy summer vegetation, same rock arrangement.
- Winter: frosted tan dormant grasses/reeds, snow on rocks, ground and plant clumps, muted evergreen accents. Preserve all transparent openings.

## Moon generation prompt

Use case: stylized-concept. Asset type: separate transparent game sky sprite. Create a full circular painterly moon in ivory and silver with softly rendered craters and maria, subtle blue-gray texture, matching the tranquil hand-painted fishing lake artwork. Orthographic front view, centered, occupying approximately 85 percent of the square canvas. The full disc must be evenly readable so procedural phase masks can create waning and waxing variants. Clean genuine alpha outside the disc. No baked glow, sky, stars, landscape, text or watermark.

The one moon bitmap is masked at runtime into all eight phases. No generated raster was modified programmatically.
