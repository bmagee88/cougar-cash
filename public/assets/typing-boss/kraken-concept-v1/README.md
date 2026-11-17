# Kraken arena assets

Generated with the built-in image_gen tool from the supplied Kraken concept. The original game has not been switched to these assets.

| File | Dimensions | Background | Purpose |
| --- | --- | --- | --- |
| kraken.png | 1671 × 941 | Transparent RGBA | Static creature pose; closed hooked beak matches the supplied reference |
| background.png | 1672 × 941 | Opaque RGB | Moonlit ocean, cliffs and distant ruins |
| ship-platform.png | 1672 × 941 | Transparent RGBA | Clear wooden deck and low hull |
| foreground.png | 1672 × 941 | Transparent RGBA | Low waves and corner spray |

## Compositing

Use a roughly 16:9 scene. Draw the background, then platform, then characters and Kraken, then foreground. Environment layers share a full-frame canvas; do not tightly crop them. Scale them together. The Kraken is a separately positioned sprite.

The usable deck is roughly x=8–92%, y=64–82%. Keep heroes mostly in the left 55–60%, with the Kraken on the right. In preview.html the Kraken is 43% scene width, right 3%, bottom 19%; adjust it to match the actual roster and character scale. The front hull and foreground waves should be below character feet. No animation frames or hitboxes are included.

Open preview.html to toggle layers. The preview is a placement example, not a game integration. Full generation prompts are saved in prompts.json.


## Clean artwork revision

The game and previews now use `kraken-clean-v2.png` (1670 x 941, transparent RGBA), with smooth fantasy-game shading and normal browser image interpolation. The first cutout is retained as `kraken.png`. The cleaned sprite and its glow overlay share the same source. See `cleanup-prompt.json` for the exact built-in imagegen edit prompt.
