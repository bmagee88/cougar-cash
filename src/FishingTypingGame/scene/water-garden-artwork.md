# Modular water garden — 2026-10-17

Historical artwork and behavior notes. The live garden now uses the species
assets and deterministic lifecycle described in [plant-lifecycle.md](plant-lifecycle.md).
These earlier assets are preserved for provenance.

Built-in ImageGen mode was used for two transparent atlases. The original PNGs remain intact; `scripts/pack-water-garden.py` only crops, downsizes and WebP-encodes their generated pixels and alpha.

Runtime assets: `public/assets/fishing/shore-plants/modular/leaf-{0..5}.webp` and `bloom-{0..5}.webp` (12 cutouts, 154,734 bytes total). Dimensions and paths are in `data/water-garden.json`.

## References

- [Lost Lake shoreline photograph](https://www.americansouthwest.net/wyoming/yellowstone/lost-lake3_l.html) — visually inspected: irregular overlapping growth follows the bank with uneven edges and open-water gaps.
- [NPS freshwater plants](https://www.nps.gov/acad/learn/nature/freshwater-plants.htm) — aquatic plants occupy the sunlit shallow littoral zone.
- [Mississippi State University American lotus](https://extension.msstate.edu/publications/american-lotus-nelumbo-lutea) — round unnotched disk leaves, full yellow flowers and emergent stems. The painted set also includes pink lotus and white water-lily variants requested for visual variety.

Reference photos were researched and viewed, not copied into the game. The local summer Willow Cove foreground was the style reference for both generated atlases.

## Source assets and prompts

Leaves: `C:/Users/Kathleen Dippyolito/.codex/generated_images/01a149bf-9559-7c21-bd97-ac31ba63fa62/exec-aa545eed-a2bf-48d5-bc52-cd47bde6dff1.png`

Use case: stylized-concept. Asset type: a production sprite atlas of MODULAR INDIVIDUAL floating leaves for a painted lake game. Input image 1 is STYLE REFERENCE ONLY: match its crisp detailed brushwork, strong dark outlines/shadows and bright natural highlights, realistic botanical proportions. Create a transparent landscape atlas, exactly 3 columns by 2 rows, six isolated leaves, one leaf centered in each cell with ample fully transparent gutters. TOP ROW: (1) broad deep forest-green water-lily pad with narrow V notch and radial veins, (2) asymmetric olive jade lily pad with scalloped edge and deeper notch, (3) round unnotched blue-green lotus disk with central vein dimple. BOTTOM ROW: (4) small fresh yellow-green notched pad with curled rim, (5) broad dark emerald pad with a small weathered split and copper edge, (6) slightly cupped round sage-green lotus leaf with wavy edge. All leaves seen nearly from above so the game can flatten them for perspective. Each single leaf has an organically different silhouette and vein pattern; do not draw precomposed clusters. Fully opaque, richly colored high contrast leaf surfaces and crisp alpha edges. No water, ripples, backdrop, drop shadows outside leaves, flowers, text, labels, grid lines or framing. Every part of each leaf must fit in its own cell. Genuine alpha transparency.

Blooms: `C:/Users/Kathleen Dippyolito/.codex/generated_images/01a149bf-9559-7c21-bd97-ac31ba63fa62/exec-37e48749-37cf-4971-8195-a363f9e2e4f0.png`

Use case: stylized-concept. Asset type: transparent sprite atlas of six individual lotus and water-lily blossoms for a painted lake game. Input image 1 is a STYLE REFERENCE ONLY: crisp richly painted botanical detail, strong dark petal folds, bright clean highlights, high contrast readable small game art. Landscape atlas exactly 3 columns by 2 rows, six different isolated full flowers, each centered in its own cell with generous transparent gutters. TOP ROW: (1) large FULLY OPEN ivory-white water lily, many pointed petals around a golden center, slightly elevated three-quarter view; (2) FULLY OPEN blush pink lotus with broad cupped overlapping petals, visible yellow seed receptacle and a very short curved green stalk; (3) FULLY OPEN pale yellow American lotus with broad bowl petals and a short green stalk. BOTTOM ROW: (4) deeper rose-pink open lotus in side-three-quarter view with a short stem; (5) creamy white open lotus in side-three-quarter view with broad round petals and visible center, short stem; (6) small pink lotus bud, two sepals and a gently curved short stem. Mostly open full blooms, NOT all buds. Different silhouettes, proportions, petal counts, and orientations. Each entire flower and stem must fit inside its cell. No pads, leaves, water, reflections, ground, hazy background, shadows outside the subject, labels, text, grid or border. Genuine transparent alpha background, opaque crisp petals. Lighting upper left matching the reference.

## Behavior

Eight rooted patch stations per location follow traced shoreline contours (including the dock's adjacent shallow pocket). Each patch assembles 7–16 independently sized, rotated and mirrored leaves from six silhouettes, with at least one fully open bloom and occasional buds. Leaf planes flatten from .30 to .58 with increasing foreground depth; upright flowers retain more volume. Different patch footprints and leaf counts replace the repeated precomposed bouquets. One tiny native CSS rocking animation per patch moves the whole water plant family; there is no new JavaScript frame loop and no per-leaf animation. Motion pauses with the scene, pauses hidden growth, and respects reduced-motion preferences. Foreground lighting filters cover the small animated patches rather than three full-screen layers.

Three independent weather-free density layers still update at game midnight. Each has a full-opacity core on every spring, summer and autumn day, with denser summer growth. Winter removes the extra flowers, reeds and floating plants, as previously requested. Runtime art is shared between locations, but its layout uses each location's actual shore frame and is generated only when visited.

Land flowers were too small or outside the phone crop. New gardens have more summer stalks; verified habitat pockets in the desktop/phone camera corridor guarantee visible planted flower patches. Existing saved roots retain their positions, IDs and species: repair patches are appended to the same daily cache without rerolling old roots. The flower map and insect perches use the resulting actual stalk geometry. Flower and reed contrast was strengthened to match the painted foreground. An extra traced reed station beside Willow Cove's visible ledge shares the existing exact odonate anchors.

## Verification

Follow-up refinement: patch cores sit closer to the bank so inner leaves can
continue underneath the opaque foreground. Dock floating plants now have their
own depth-4 shore frame, below the grass bank; reeds retain a separate depth-6
frame with the same camera parallax and traced perch coordinates. Leaf-only
runtime grading uses brightness .72, saturation .68 and contrast 1.12 to soften
the yellow-green highlights into darker natural greens. Blossom colors and
source images are preserved. This refinement edits layout and rendering code;
it does not generate or repaint bitmap assets. All 18 aquatic-plant and insect
regression tests passed after this follow-up; all three shores were visually
checked for the darker leaves and foreground occlusion.

Initial implementation: browser review covered all three locations on desktop and 390×844 phone views, plus spring Dock and autumn Birch Point; the Willow Cove near-ledge pocket was adjusted after the phone crop hid its original pads. Regression tests covered persistence, additive garden repair, fuller summer planting, shore distance, modular variation, perspective, guaranteed floating cores, seasonal cleanup and existing insect perches. All 34 tests across six relevant suites passed; the 12 planting tests passed again after that implementation's last rendering changes. Its production build passed with the existing MediaPipe missing source-map warning. The output CSS and JavaScript included the hidden-growth motion handling.
