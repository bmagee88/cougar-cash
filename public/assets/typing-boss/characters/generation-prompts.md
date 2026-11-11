# Combat sprite generation

Generated with the built-in image_gen tool, transparent_background: true, on 2026-11-11. No CLI/API fallback was used.

Each request used the common prompt below followed by `\nCharacter design: ` and the matching character paragraph. Reference 1 was `../paladin-idle-sprite.png`; reference 2 was the matching existing character's idle or static sprite. The paladin used its idle and static sprite references.

## Common prompt

Production game sprite atlas on a truly transparent background. EXACTLY 6 columns and 8 rows, 48 equal square cells, aligned grid with no gridlines or text. Each row is ONE six-frame action played LEFT TO RIGHT. Uniform cell sizes, consistent character scale, same feet baseline, ample padding to avoid clipping in any cell. Small crisp 48x64 logical-pixel retro RPG character, upscaled nearest-neighbor; match the approved paladin idle reference's pixel density, outline and detail. Face toward the RIGHT throughout. No background, floor, cast shadow, labels, watermarks or new props unrelated to the class. Exact row order from TOP: 1 idle breathing; 2 weapon attack/cast windup strike recovery; 3 support magic casting, hands/weapon gathering and releasing power (also used for healing/shielding/revival); 4 receiving healing, straighten and regain energy, subtle YELLOW sparkles; 5 dodge, step/lean backward then recover; 6 taking damage, recoil/bracing and recover, no gore; 7 being revived, start collapsed on ground, rise to kneeling then standing; 8 dying, standing stagger collapse, end lying down with the last two frames a stable collapsed pose. Keep the SAME outfit and weapons in every cell. Genuine pose changes, not just translated or rotated copies. First and last frames of idle/attack/dodge/hit must transition naturally to the standing idle. Reviving ends standing; death ends down.

## paladin

The character is the existing PALADIN: enclosed silver helmet, gold-trimmed steel armor, white tabard, gold cross shield on the right and sword. Preserve this exact character design and the reference idle appearance; animate the sword and shield with clear follow-through. Support casting uses raised shield and pale blue/gold light.

Saved master: `paladin-combat.png`. Runtime atlas: `paladin-combat.webp`.

## barbarian

The character is the existing BARBARIAN in the second reference: sturdy muscular warrior in brown/orange leather armor with an axe. Use the first reference only for the crisp pixel-art production style. Preserve the barbarian silhouette, armor, axe and palette from the second reference. Attack is a clear axe swing; support gesture briefly raises a hand or the axe.

Saved master: `barbarian-combat.png`. Runtime atlas: `barbarian-combat.webp`.

## cleric

The existing CLERIC in reference 2: ivory hood and robes, dark gold-trimmed armor, golden staff with a small cross/star finial. Reference 1 supplies the crisp paladin pixel-art production style only. Preserve reference 2's silhouette and outfit. Attack raises and thrusts the staff to release a small golden bolt. Support casting channels yellow-white light from the raised staff.

Saved master: `cleric-combat.png`. Runtime atlas: `cleric-combat.webp`.

## rogue

The existing ROGUE in reference 2: charcoal hood with face mostly shadowed, dark brown leather armor, scarf/cloak, paired short steel daggers. Reference 1 supplies the crisp paladin pixel-art production style only. Preserve the rogue's silhouette, hood, daggers and restrained palette. Attack uses a clear dagger slash; dodge is a quick sidestep with cloak follow-through. Support casting is a small raised-hand gesture.

Saved master: `rogue-combat.png`. Runtime atlas: `rogue-combat.webp`.

## necromancer

The existing NECROMANCER from reference 2: black hooded robes and ragged cape, subtle bone ornaments, skull belt, dark staff with a green skull/orb. Reference 1 supplies the crisp paladin pixel-art production style only. Preserve reference 2's design. Attack releases a small green spectral bolt from the staff; support casting raises the staff. Receiving healing is still YELLOW, not green, to follow the game's combat-color scheme. No gore or frightening extra creatures.

Saved master: `necromancer-combat.png`. Runtime atlas: `necromancer-combat.webp`.

## monk

The existing MONK from reference 2: bald head, orange tunic, dark brown trousers, pale cloth wraps around hands and shins. Reference 1 supplies the crisp paladin pixel-art production style only. Preserve reference 2's design. No weapon: the attack row is an expressive martial-arts punch sequence; support casting gathers warm light between the hands; dodge is a quick crouch/sidestep; receiving healing uses yellow sparkles. Keep the same costume and proportions across every cell.

Saved master: `monk-combat.png`. Runtime atlas: `monk-combat.webp`.

## Runtime packing

Masters retain the tool's transparent 1086×1448 output. `node scripts/prepare-typing-boss-animation.cjs` packs each 6-column, 8-row atlas into 96px cells (576×768), using nearest-neighbor scaling and lossless WebP. It verifies decoded visible RGBA against the resized source. `manifest.json` records dimensions and byte sizes. Existing paladin, cleric and barbarian idle strips remain in use. Other classes use the extracted first-row `*-idle.webp`.

Rows: idle; weapon/cast; support casting; receiving healing; dodge; hit/brace; revival; death. Each row has six frames. Shield and buff distinctions use local CSS effects on the shared casting/brace rows.

