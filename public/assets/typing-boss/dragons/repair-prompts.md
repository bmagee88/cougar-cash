# Dragon clipping repair

Built-in image_gen editing, transparent_background: true. Each dragon has two 3-column × 4-row PNG masters, with twelve frames in each. The runtime atlas is `*-attacks-v2.webp`, six columns × four rows. Original masters are retained.

The exact prompt for each master is the shared prompt, `\nDragon: ` plus the corresponding identity, and `\nActions: ` plus its action pair.

## Shared prompt

Use case: precise-object-edit. Technical repair of the reference dragon game sprite atlas. Preserve EXACTLY its dragon identity, pixel-art style, palette, anatomy and details. Return TWELVE animation frames in EXACTLY THREE COLUMNS and FOUR ROWS on a truly TRANSPARENT 1536x2048 canvas. 12 equal SQUARE 512x512 cells. Two complete six-frame attack sequences, each occupying two rows, read left-to-right then top-to-bottom. No labels, drawn grid, floor, shadow, background, checkerboard, bloom or colored fog. One COMPLETE dragon in each cell, facing LEFT. Keep the main pelvis at 60% of cell width and 65% cell height, with planted feet at 83% height in every frame. Body/wing/tail silhouette should use about 72% of each cell width, at a consistent scale. Every wing tip, horn, claw, tail AND flame must remain INSIDE ITS OWN CELL with at least 48px completely TRANSPARENT margin on all four sides. No neighboring-cell fragments, detached body parts, orphan sparks or particles near the cell edges. Compact mouth-local fire only: the game draws traveling projectiles separately. Fire must not extend beyond the left padding. Frames 1 and 6 of EACH sequence are the same quiet ready stance, with NO residual fire or particles. Show real jaw, neck, wing and tail pose changes, not just shifted/rotated copies. This is a cleanup, not a redesign.

## Dragon identity paragraphs

### ancient-red-dragon

Huge detailed dark crimson ancient red dragon from the reference: four legs, long swept horns, ochre belly plates, black-red bat wings, orange eyes, claw feet and a curled spiked tail. Retain the mature intricate pixel-art design; do not make it cute or simplify it.

Reference: `ancient-red-dragon-attacks.png`. Saved masters: `ancient-red-dragon-bite-fireball-v2.png`, `ancient-red-dragon-tail-flame-v2.png`. Runtime: `ancient-red-dragon-attacks-v2.webp`.

### cindermaw

Cindermaw from the reference: stocky red cartoon pixel dragon, dark gray horns, yellow/orange belly, bat wings, large expressive eyes, chunky white claws and curled tail. Preserve the bold low-resolution pixel style exactly.

Reference: `cindermaw-attacks.png`. Saved masters: `cindermaw-bite-fireball-v2.png`, `cindermaw-tail-flame-v2.png`. Runtime: `cindermaw-attacks-v2.webp`.

### ember-whelp

Ember Whelp from the reference: small cute orange/gold baby dragon, flame-shaped head spines, huge expressive dark eyes, short bat wings, tiny claw feet and a curled tail. Preserve the crisp cute pixel art and small-dragon proportions.

Reference: `ember-whelp-attacks.png`. Saved masters: `ember-whelp-bite-fireball-v2.png`, `ember-whelp-tail-flame-v2.png`. Runtime: `ember-whelp-attacks-v2.webp`.

## Action paragraphs

### bite-fireball

FIRST SIX FRAMES (top two rows): BITE. 1 ready, 2 crouch/neck coil with jaw opening, 3 head extends LEFT with jaws wide open, 4 strong jaw SNAP with front claws braced, 5 recoil/recover, 6 ready. SECOND SIX FRAMES (bottom two rows): FIREBALL CAST. 1 ready, 2 inhale/head tilt back, 3 head lowers with a bright throat, 4 release a SMALL ATTACHED mouth-flame while jaws open, 5 close jaws/recover, 6 ready. No detached fireball or flying sparks.

### tail-flame

FIRST SIX FRAMES (top two rows): TAIL WHIP. 1 ready, 2 coil body and lift tail, 3 hips twist and tail curls behind, 4 articulated tail sweeps across the lower LEFT side while wings counterbalance, 5 follow-through with tail still left, 6 ready. Keep the entire tail INSIDE its cell. SECOND SIX FRAMES (bottom two rows): FLAMETHROWER. 1 ready, 2 inhale deeply/head tilt back, 3 open jaws/bright throat, 4 neck stretches LEFT and exhales a SHORT COMPACT attached cone of orange-yellow flame, 5 another distinct sustained compact flame shape, 6 extinguished/ready. The cone must fit fully inside the cell with at least 48px transparent left padding, no detached specks.

## Packaging and validation

`node scripts/prepare-typing-boss-dragon-repair.cjs` checks all 72 source frames for opaque artwork on source boundaries, adds a 12px empty guard band on all sides of each 256px runtime cell, checks opacity and distinct poses, and verifies lossless decoded RGBA. Alpha values at or below 2/255 are canonicalized as transparent. The packaged frame area contains 232×232 pixels of complete source artwork. No frames are drawn through a neighbor. The renderer now uses fixed-foot registration and one padded camera per dragon, fitted inside its layout box. Re-run scripts/register-typing-boss-dragon-feet.cjs after packing to regenerate the CSS geometry and footing-manifest.json. `repair-manifest.json` records every frame, its empty gutter, hash, and runtime byte size. A dragon frame inspector in the development preview permits checking all 12 attack rows at each of their six frame positions.

