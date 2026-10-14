# Combined Cedar Lake background

Created with the built-in imagegen tool using the existing mountain/forest, rocky far bank, upper reflecting water, lower open water, and scene composition as references.

Saved asset: `public/assets/fishing/locations/cedar/lake-background-painted.png`.

The active manifest uses this single opaque image for sky, mountains, far-shore trees, rocks, shoreline, reflections, and open lake water. Earlier layers remain as source assets but are no longer rendered. Background parallax is 0.02, at most 0.64 pixels horizontally and 0.02 pixels vertically. It has no looping image animation. Pointer travel is primarily horizontal, capped at 32 pixels horizontally and 1 pixel vertically before layer depth scaling.

Foreground parallax was reduced by 25 percent: banks/dock/fisherman 0.72 → 0.54, right bank 0.95 → 0.7125, cove willow 0.9 → 0.675, reeds 1.25 → 0.9375. Dock, fisherman, rod, and bobber remain separate PNGs.

`ANGLER_RIG` defines the painted hips anchor and a seat point on the dock planks. The character’s position and width derive from the dock layer’s bounds, with matching parallax and pose rotation centered on the seat. This keeps his hips on the planks during resizing, pointer movement, casting, and reeling.

## Final generation prompt

Use case: compositing. Asset type: one opaque wide painterly background PNG for a 2D lake fishing game.
Primary request: combine the existing lake water, rocky grassy far shoreline, forest, and mountains into one coherent flattened landscape asset, preserving their established detailed painted style and color palette.
Input images: Image 1 is the mountain/forest source to preserve closely. Image 2 is the far rocky grassy shoreline source. Image 3 is the upper lake reflections source. Image 4 is the lower open water source. Image 5 is the game screenshot, COMPOSITION REFERENCE ONLY; exclude all its foreground objects and interface.
Composition: panoramic landscape around 2:1. Pale muted sage sky occupies the upper 25–30%; retain the varied blue-green mountain silhouettes and layered pine/golden deciduous forest from image 1 below. The fine grassy rocky shoreline is a continuous low strip at about 48% image height. The bottom 52% is entirely open teal lake water. Tree reflections directly below the shore must correspond to the actual trees above, gradually diffusing into quieter horizontal ripples in the lower water. Retain clear mountain forms and nuanced fine organic brush detail, muted sage, forest teal, golden afternoon highlights, matte painted textures and gentle atmospheric depth. Sky softly blends pale green and cream, no drawn sun disk or clouds because these remain separate game effects.
Constraints: one seamless fully opaque landscape painting, extend water to both bottom corners. No foreground land, plants, reeds, grasses, dock, person, fishing rod, line, bobber, boats, birds, text, labels, UI, watermark or border. Those are separate assets. The low rocky GRASSY FAR SHORE is required. Do not include screenshot UI or foreground. Avoid any hard horizontal compositing joins, duplicate forests/reflections, primitive vector shapes, cartoon outlines, photorealism or new scenery structures. Preserve existing source scenery character rather than inventing a different biome.
