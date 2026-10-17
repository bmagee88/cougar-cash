# Side views and seasonal flower gardens

Generated with the built-in imagegen tool. `prompts.json` records the exact
requests and `sources.json` identifies the 21 copied source atlases: 12 side-view
species and 9 location/season foliage sets. Monarch and eastern tiger swallowtail
reuse the earlier art in `output/insect-flight-art/`.

Repack from the repository root with Python and Pillow:

```powershell
python scripts/pack-garden-art.py
```

Runtime outputs:

- All 14 species: 8-frame GIFs, 768 × 112 WebP sheets, and eight 96 × 112 pose
  stills in `public/assets/fishing/butterflies/<species>/`, using `side-small`
  filenames. Earlier artwork is preserved.
- 54 transparent 128 × 144 flower patches: six for each of dock, cove and birch,
  in spring, summer and autumn. Files live in `public/assets/fishing/foliage/`.
- `src/FishingTypingGame/data/foliage.json`: 160 flower-head anchors and 54 leaf
  rest points detected from the painted cutouts.

`side-flights-review.png` and `foliage-review.png` show the packed artwork. Scene
screenshots live one directory up in `output/garden-*.png`.

Verification: 52 tests across 9 targeted suites, direct ESLint checks, all runtime
asset dimensions/alpha/frame counts, and browser checks of all 9 variants. Desktop
1440 × 800 and mobile 375 × 740 layouts were inspected; winter removes the new
patches and their destinations. The final interaction/foliage suites were rerun
after the layout adjustment (8 tests). See `output/garden-*-tests.log` and the
build/lint logs for results. The final clean CI production build passed
(`output/garden-build-clean.log`). A prior rebuild reported a stale unused-import
warning in unchanged `engine/storage.ts`; direct ESLint passed, and clearing
`node_modules/.cache/.eslintcache` resolved the build warning.
