# Support frame repair and full player audit

The built-in image_gen tool repaired three support strips with transparent_background: true. The shared prompt plus `\nCharacter: ` and the matching paragraph below is the exact prompt set. Original PNG masters and previous runtime versions are retained.

## Shared prompt

Use case: precise-object-edit. Technical cleanup of the reference pixel-art character animation. Return ONLY six SUPPORT CASTING poses, taken from the reference atlas's THIRD ROW, in EXACTLY THREE COLUMNS and TWO ROWS on a TRANSPARENT 1536x1024 canvas. Six equal square 512x512 cells. Read order left-to-right then top-to-bottom. No grid, labels, background, scenery, cast shadows, or floor. Preserve the EXACT reference character identity, costume, palette, proportions, pixel outlines and texture. Pose sequence: ready, gather magic, raise weapon/hands, release a compact aura, follow-through, ready matching frame 1. This action is used to cast healing, shields, buffs and revival. Body and midpoint of feet must remain planted at the horizontal center of each cell. All feet use the SAME baseline at about 83% cell height. Use the same visual scale as a ready pose in the reference. Keep every weapon and effect inside its own cell with at least 40px EMPTY TRANSPARENT padding on all four sides. Keep raised weapons compact: no staff tip more than 10% of the cell height above the helmet/head. NO detached effects, orphan fragments, duplicated limbs, neighboring frames or residual particles in ready frames. No large bloom or fog; only small attached magic at the hands/weapon. Face RIGHT. The game draws a separate projectile, so don't draw a traveling projectile.

## paladin

PALADIN: enclosed silver helmet, steel armor with gold trim, white tabard, steel sword and gold-cross shield. Preserve the approved appearance exactly. Raise the shield to channel a compact pale blue/gold light at its center.

Reference: `paladin-combat.png`. Saved generated master: `paladin-support-v3.png`. Runtime: `paladin-combat-v3.webp`.

## cleric

CLERIC: ivory hood and robes, dark gold-trimmed armor, golden staff with cross/star finial. Raise and channel the staff with compact yellow-white light at its tip. Avoid overlong staff or large rays escaping the cell.

Reference: `cleric-combat.png`. Saved generated master: `cleric-support-v3.png`. Runtime: `cleric-combat-v3.webp`.

## necromancer

NECROMANCER: black hooded robes and ragged cape, skull belt/bone ornaments, dark staff with a green skull/orb. Raise the staff slightly and channel compact GREEN light around the skull. Preserve the original design, no added creatures or skeletal limbs.

Reference: `necromancer-combat.png`. Saved generated master: `necromancer-support-v3.png`. Runtime: `necromancer-combat-v3.webp`.

## Reproducible audit

`node scripts/prepare-typing-boss-support-repair.cjs` replaces only support row 2, retains other decoded art pixels, and pads cells to 128×112 so raised staves fit. It validates every repaired frame's transparent gutter and prevents visible cropping. It sizes the character against the old ready pose, preserves the feet baseline, and uses lossless WebP. Sub-1% alpha noise is canonicalized; faint outer glow below 16/255 is excluded from the gutter. The manifest records 18 repaired frames.

`node scripts/audit-typing-boss-sprites.cjs --check` inspects all six classes, eight distinct source rows, six frames per row (288 frames), rejects opaque artwork at a cell boundary, and generates `src/TypingBoss/characterRegistration.ts` plus `sprite-audit.json`. Re-run it after replacing an atlas. It measures the lower body away from raised weapons and spell effects. Stable idle/buff, casts and receiving-heal rows are planted; moving reactions keep their intended travel while the underlying idle-strip drift is removed. Standing reaction/revival endpoints align to idle. Approved legacy idle strips retain their own geometry. Four previously repaired weapon rows remain in use.

The local `/typing-boss/animations` preview has an Inspect player frames control and a six-frame slider. Replay resumes native CSS playback. These controls are excluded from production.

