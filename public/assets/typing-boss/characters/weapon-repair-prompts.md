# Weapon frame repair

Generated with the built-in image_gen tool, transparent_background: true. These four PNGs replace only the weapon/cast row of the matching existing atlas. Each master has six frames in a 3-column, 2-row layout. Original masters are retained.

## Exact shared prompt

Use case: precise-object-edit. Repair a game animation using the reference atlas. Output ONLY SIX weapon/cast animation frames, arranged in EXACTLY THREE COLUMNS and TWO ROWS, left-to-right then top-to-bottom, on a truly TRANSPARENT 1536x1024 canvas. Six equal 512x512 SQUARE CELLS. No drawn grid, text or labels. Match the EXACT existing character design, palette, crisp pixel density and outlines in the reference. Recreate ONLY the weapon/cast action from the reference atlas's SECOND ROW; the other reference rows are design context, not requested output. Frame order: 1 ready; 2 windup; 3 weapon lift/channel; 4 strike/release; 5 follow-through; 6 ready matching frame 1. Keep the body planted with the midpoint of the feet at the horizontal center of EACH cell, with feet at 91% of cell height; standing body height about 72% of cell height. Preserve real limb/weapon pose changes. Every character AND every weapon/spell effect must stay FULLY INSIDE its own square, with AT LEAST 32px of completely transparent padding on ALL FOUR SIDES of EVERY cell. Use a compact attack effect rather than allowing it to escape its frame. Absolutely NO stray fragments, duplicate limbs, weapon tips, glow, sparkles or parts of any neighboring frame in a cell. First and final ready frames have NO particles or residual effects. No background, shadows, platforms or scenery. No detached projectiles: the game draws those separately. Face RIGHT throughout. The existing approved style and character identity must be preserved; this is a technical cleanup, not a redesign.

## paladin

The shared prompt was followed by: `\nCharacter: ` and this paragraph:

PALADIN: silver enclosed helmet and steel armor, gold trim, ivory/white tabard, gold-cross shield and steel sword. Slash with the sword while retaining the shield. Compact silver slash only in the impact/follow-through frames.

Edit reference: `paladin-combat.png`.
Saved master: `paladin-weapon-v2.png`.
Runtime atlas: `paladin-combat-v2.webp`.

## cleric

The shared prompt was followed by: `\nCharacter: ` and this paragraph:

CLERIC: ivory hood and robe, gold trim, dark armor, gold staff with cross/star finial. Lift and thrust the staff to cast. A compact gold light around the staff tip only, with no floating fragment left at either edge.

Edit reference: `cleric-combat.png`.
Saved master: `cleric-weapon-v2.png`.
Runtime atlas: `cleric-combat-v2.webp`.

## rogue

The shared prompt was followed by: `\nCharacter: ` and this paragraph:

ROGUE: charcoal hood and dark brown leather, shadowed face, cape/scarf and paired short steel daggers. A crisp dagger slash with a very small pale slash arc. Keep the same hood, outfit, proportions and daggers as the reference.

Edit reference: `rogue-combat.png`.
Saved master: `rogue-weapon-v2.png`.
Runtime atlas: `rogue-combat-v2.webp`.

## necromancer

The shared prompt was followed by: `\nCharacter: ` and this paragraph:

NECROMANCER: dark hood and black ragged robe, skull belt/bone ornaments, skull-topped staff with green light. Raise and aim the staff with compact green energy around its tip. NO traveling green bolt or detached green marks; those are separate in-game projectiles.

Edit reference: `necromancer-combat.png`.
Saved master: `necromancer-weapon-v2.png`.
Runtime atlas: `necromancer-combat-v2.webp`.

## Packing and checks

Run `node scripts/prepare-typing-boss-weapon-repair.cjs`. The script sizes each character to the existing ready pose, adds horizontal room with 128×96 cells, and replaces only row 1 of the atlas. It canonicalizes alpha values at or below 2/255 and requires a four-pixel transparent gutter on every repaired frame; visible pixels at the gutter or outside the cell fail the check. Unrelated rows retain identical decoded visible pixels, centered with 16px of padding on either side. Footing offsets are generated in `src/TypingBoss/weaponRepairAnchors.ts`. Other poses keep their existing artwork and proportions. The manifest records all 24 frame checks and runtime sizes.

