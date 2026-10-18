# Painted bird animation sources

Generated with the built-in ImageGen tool using the existing monarch butterfly
art as a style reference. `prompts.json` preserves all eight exact prompts;
`sources.json` maps the generated originals to their workspace copies. The four
generated views per bird are front, front-left, back and back-left. Right views
mirror left views. The original PNG atlases are retained here.

Run `python scripts/pack-painted-tree-birds.py` from the project root to repack,
or add `--check` to validate the saved assets. Requires Pillow, numpy and OpenCV.
The script isolates complete birds across nominal cell boundaries, aligns their
torsos, then exports transparent GIFs and smooth WebP sheets without drawing art.
`alignment.json` records the source cutouts and anchors. `directional-review.jpg`
shows all 144 poses; `browser-preview.png` shows the animation gallery.

Final assets: `public/assets/fishing/visitors/tree-birds/{cardinal,sparrow}/`.
Each contains six full flight GIFs, six wingbeat GIFs, six glide GIFs, six slowdown
GIFs and one runtime WebP sheet. All GIFs are 192×192. Runtime frames are 128×128.
Open http://localhost:3001/assets/fishing/visitors/tree-birds/preview.html to switch
between states and compare every direction. The game samples matching WebP poses
under its existing movement and visibility clocks; far birds remain silhouettes.

Validation: 144 poses and 48 GIFs passed pixel/frame/alpha checks; all 27 targeted
bird, environment and performance tests passed; production build passed. All 12
full flight GIFs loaded in the browser, and a live close cardinal used the new
painted sheet. Logs are saved alongside this file.
