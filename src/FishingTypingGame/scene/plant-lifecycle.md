# Seeded plant lifecycle, generation v1

The live scene uses `engine/plantLifecycle.ts`, `engine/plantSpecies.ts` and
the frozen `data/plant-anchors-v1.json`. The previous daily flower layouts and
floating-density rerolls are retired. Their old assets and local save entries
are preserved, but are not used to arrange the new world.

## Identity and time

`stillwater.plant-world.v1` stores a persistent seed and generation version,
separately from fishing progress and weather. Generation v1 uses stateless,
independently namespaced hashes for species, roots, slot shapes, stem births,
birth slots, individual stem shapes and individual daily advancement. A stem
identity contains its plant, slot and global game birth day. There is no runtime
chance roll, and no interaction/frame-rate input to growth.

The existing calendar is retained: a game day lasts 48 minutes; one real New
York calendar day is a season, in spring/summer/autumn/winter order. The plant
calendar reconstructs real New York midnights, including daylight-saving time,
and processes growth at the existing independent game-day boundaries. The
next midnight reveals another predetermined state. A season can change between
game-day boundaries around a daylight-saving transition.

Spring creates a fixed planting with zero stems. Every species resets at the
next winter-to-spring boundary, so a long absence can skip all completed cycles.
At most the current four-season cycle (under 130 game days) needs reconstruction.
Only the viewed location is generated. Travel-card thumbnails opt out entirely.

The generation version is stored rather than inferred from the current app.
Keep the v1 catalog, anchor table, seed namespaces and probabilities immutable
for established v1 worlds. A future algorithm needs a separate version/dispatch
branch. Unknown newer versions are preserved without overwriting their seed.

## Plants and stages

Each location has six flower bases, two or three reed bases, and eight modular
lily groups. Flower roots are chosen from artist-selected candidates verified
as habitat in all three growing-season foregrounds. Reed roots and lily groups
use the previously traced bank coordinates. Roots, species and slot variations
stay fixed throughout the cycle. Every lily group has exactly five leaf pads;
each pad is one stem slot. Reeds and flower bases also have five slots.

Every subsequent game day processes existing stems first: each has a seeded
65% opportunity to advance. Then the eligible base has one seeded 90% opportunity
to create one stem in a free slot. Newborns cannot advance on their birth day.
Withering stems count toward the five-stem cap. Removal deletes only that stem,
not its foliage; a replacement receives a different birth identity.

Stages: **stem → bud → bloom → seed → withering → removal**. The stem and bud
transitions wait for a permitted bloom season. Entering a season does not itself
advance a stem. A bloom already present can persist on a failed progression.

The nine species are violet, cornflower, New England aster, hellebore, cattail,
soft rush, shore sedge, white water lily and pink lotus. Their v1 catalog specifies
bloom seasons, perennial status, winter-blooming exceptions and artistic height.
Cornflowers are annual; other catalog plants are perennial. Ordinary perennials
retain their autumn foliage maturity in winter and stop producing stems. Dedicated
winter artwork adds frost, snow and dormant colors to that mature foliage. A successful
winter advancement from any earlier stage skips directly to withering; failures
stay put, and successful withering advancements remove the stem. Hellebores keep
normal winter births and progression. Nonperennials disappear for winter.

The calendar, thresholds, spring reset and winter survival behavior are game
rules, rather than a botanical growth model. Bloom-season references include
[NC State Extension's hellebores](https://plants.ces.ncsu.edu/plants/helleborus/)
and [New England asters](https://plants.ces.ncsu.edu/plants/symphyotrichum-novae-angliae/common-name/new-england-aster/).

## Rendering and maps

`SeasonalFoliage`, `ShorePlants` and `PlantSprite` render foliage and stems as
separate cutouts. Seasonal foliage uses the same species' spring/summer/autumn/winter
image. Winter keeps fall maturity and uses its own species-specific cutout. Stem art depends only on that stem's
stage. Size, lean, flip, root spacing and pad shapes are stable seeded variations.
Foliage has independent seeded tilt, height and width variations; individual
stalks also vary in lean and proportions. All transforms pivot around their
traced roots and the perch map uses the same transformed contact pixels.
Flowers, reeds and lily groups shrink with the camera's perspective curve using
their ground contact in the responsive scene. Visual distance is not capped by
the foreground collision band. Shore-group measurements run on layout, scenery
load or resize, batch reads before writes, and do not add a frame loop.
Lily pads stay dark and close to the traced shore, partly under the opaque bank,
with depth-dependent vertical flattening. Eight native CSS water motions add a
subtle 0.7-pixel bob; reduced-motion settings disable it.

Water leaves use a shallow 0.10–0.23 vertical projection, with distant leaves
flatter. Their width is about 43% smaller than the original lifecycle pads.
Pad centers and their flowering-stem roots share this water-plane projection,
so the five-pad clusters flatten together while the flower stalks stay upright.
Aquatic stalks are also smaller to fit the leaves. This affects display geometry
only; seeded plant anchors, slots, identities and lifecycle state stay fixed.

Plant cutouts retain their source resolution, detail and colors. Added blur,
contrast/saturation grading, autumn sepia and pad brightness grading have been
removed; seeded shape variations and perspective scaling remain. Plants use the foreground's shared time and weather
lighting, with no separate night brightness adjustment. No extra animation or
growth loop is used.

Dock surface plants draw at level 5, above the level-4 underwater light, tint,
fog and water veil. Their frame mounts before the level-5 opaque bank, so the
bank, dock and foreground reeds still cover shoreward pad edges naturally. Dock
leaves retain a subpixel contact shadow to separate from the sandy bottom.
Willow Cove projects its lily groups onto traced seasonal bank edges, leaving
only 6–12 shore-art pixels of water clearance. The far-right group stays within
the painted bank's reach. Pad centers, stalk contacts and perches all follow
that same frame. These art-alignment changes preserve seeded roots and IDs;
daily growth and travel do not move the groups. No runtime alpha tracing is used.

Perch coordinates come from traced opaque pixels in the same cutouts used by
the renderer. The map applies exactly the root-centered rotation, mirroring,
scaling and water flattening. Only loaded, visible artwork is targetable. Layout,
image load and lifecycle changes notify the existing insect/map listeners.
Removed or no-longer-compatible anchors release their visitor before retargeting.
Water contacts follow the same analytical bob in the existing insect loop.
These motion offsets do not perform generation, stage checks or chance work.

Generation work is memoized by location, cycle, selected season and game day;
ordinary clock/hour renders reuse the snapshot. Memory is bounded to 24 snapshots,
six base layouts and six checkpoint groups. Checkpoints are copied and validated
with an identity/schema/checksum before use. Four checkpoints per location are
persisted under `stillwater.plant-checkpoints.v1`; corrupt or missing caches replay
the current cycle and produce the same results. Storage failure uses a stable
fallback world seed. The fishing save is never modified by this subsystem.

## Artwork and reproduction

Created with the **built-in image_gen tool**, using the existing painted dock
flower and Birch Point shore as style references. Runtime assets are 72 RGBA
WebP cutouts, 320 pixels maximum dimension, with nine additional winter foliage
cutouts (81 total, 2,608,288 bytes; winter additions are 456,952 bytes):
`public/assets/fishing/plants/v1/{species}/{foliage-spring,foliage-summer,foliage-autumn,foliage-winter,stem,bud,bloom,seed,withering}.webp`.

The exact prompt for each species, source paths and tool name are saved in
`output/plant-lifecycle-art/manifest.json`. Original atlases are copied into that
same project folder. `scripts/pack-plant-lifecycle.py` crops/packs the cells,
preserves the generated alpha, and traces root/perch metadata into
`data/plant-art-v1.json`. `scripts/verify-plant-lifecycle.py` verifies all files,
alpha, dimensions and opaque perch contacts. `scripts/prepare-plant-anchors.py`
records the artist-selected habitat candidates; do not rerun it with changed
habitat data for already-established v1 worlds.

Winter variants use each existing autumn foliage cutout as an identity reference
and the snowy Birch Point shore as a painting reference. Their exact prompts,
original PNGs and runtime paths are in `output/plant-lifecycle-art/winter/`.
`scripts/pack-winter-plants.py` packs these nine separate sprites and traces
new opaque perch contacts. Repacking the original atlas preserves winter entries.
Winter appearance is selected at render time: seeds, species, roots, slot layouts,
fall maturity, checkpoints and advancement outcomes are unchanged. Cornflower
also has winter artwork for catalog completeness but remains hidden in winter
under the existing nonperennial rule. Hellebore retains its independent bloom stages.

Winter validation: 39 tests across six lifecycle, scene and insect suites passed;
all 81 runtime cutouts passed alpha, size and painted-contact checks. Dedicated
winter image paths and loaded artwork were verified at all three locations,
on desktop and at 390 × 844. The development build compiled without new lint or
type errors; the existing missing MediaPipe source-map warning remains.

## Review and validation

Development only: **Developer tackle box → Preview season → Plant day within
season**. Zero shows the first day; blank returns to the actual world date.
This preview does not change fishing progress, game time or weather. **Show tree
and plant maps** uses the actual mounted sprites, while **Inspect plant map**
also follows the selected plant day.

Lifecycle tests cover deterministic continuous/cold replay, visit order, reload,
checkpoints and corruption, birth/advance rates, capacity, newborn delay, seasonal
gates, winter exceptions, spring reset and both DST transitions. Scene tests cover
separate foliage/stages, exact five-pad groups, lazy images, root stability,
transformed loaded perches, removal/release and water contact motion.

The standalone Node microbenchmark is `scripts/benchmark-plant-lifecycle.cjs`;
it excludes module loading/transpilation and measures cold reconstruction,
1000 cached requests, checkpoint reload time and checkpoint size. Its report is
saved to `output/plant-lifecycle-art/benchmark.json` by default. No plant growth
or generation is added to an animation-frame loop.

Foreground collision masks also reuse alpha data across repeated instances of
the same sprite, with a 64-source cache. A cluster of five stems does not cause
five copies of the same artwork to be rasterized for collision checks. Seasonal
gates skip unnecessary advancement hashes; independent namespaces ensure the
optimization leaves every outcome unchanged.

### Measured cost (2026-10-17)

Five local Node 22.18 trials with seed `plant-performance-reference-v1`:

| Operation | Median | Observed range |
| --- | ---: | ---: |
| Cold dock, 119 game days | 31.43 ms | 23.79–42.46 ms |
| Cold cove, 119 game days | 19.49 ms | 13.55–25.64 ms |
| Cold birch, 119 game days | 26.25 ms | 16.00–28.36 ms |
| 1,000 cached dock requests | 33.56 ms total | 29.62–45.66 ms |
| Reload all three from checkpoints | 11.13 ms total | 7.02–15.47 ms |

The cold case processed 357 location-days / 5,950 plant-day steps across all
three locations. Reload processed zero growth days. Serialized checkpoints
for this case occupied 10,636 bytes. These are engine microbenchmarks, excluding
module loading, image decode, DOM layout and browser painting; they are not mobile
frame-time measurements. Artwork and up to 80–85 separately rendered stems per
location add normal image/DOM costs, while growth adds no per-frame work.
The actual scene requests only the selected location and memoizes the snapshot.

Validation includes the complete fishing suite plus focused reruns of affected
files (62 tests in eight focused suites), all 72 asset alpha/contact checks,
and desktop/390 × 844 visual checks at all three locations. Narrow views crop
the same habitat rather than moving roots to new positions. The map preview
was checked against the rendered Birch Point cutouts.

Final production compilation passed with no new lint warnings. The repository's
existing missing MediaPipe source-map warning remains. The last map timing
adjustment was rechecked in three scene/garden suites (14 tests, all passing).
The initial broad run's negative-zero assertion was corrected to a tolerant
numeric comparison; its unrelated fullscreen timeout passed in the isolated
focused rerun. No failing fishing tests remain from those runs.
