# Fishing performance changes

Implemented in the requested order: 2, 4, 1, 3, then the remaining items.

| Item | Change |
| --- | --- |
| 2. Scene rendering | Stable world/weather props and seasonal manifests; memoized scenery, clouds, particles, sky and character. Keyboard updates reach the rig without rebuilding unchanged painted layers. |
| 4. Line layout | Cache scene bounds until resize/scroll/visibility changes. Read animated tip/hand/float geometry together before style writes. Avoid resending unchanged grass-path variables. Pause line updates in hidden tabs. |
| 1. Artwork | Runtime WebP copies of all 54 painted PNGs. Keep landscape resolution; resize small sprites for their actual display size. Preserve every PNG master. |
| 3. Heavy rain | One canvas per storm replaces 544 thunderstorm or 856 hurricane drop/impact elements. Keep the same near/distant/impact counts, weather intensity and outgoing fades. Draw at up to 30 fps and one device pixel per CSS pixel; pause hidden/offscreen surfaces. Reduced motion draws a still frame. |
| 5. Timers | Schedule rule boundaries instead of polling every frame. Idle/results have no rule timer. Retain immediate keyboard handling, one-second pauses, five-second rhythm/dead-stick checks, nibble resolution and absolute typing deadlines. Countdown text updates in its own small component at 10 Hz; CSS animates the bar continuously. |
| 6. Inactive weather | Defer unused cloud images and daytime stars; retain outgoing art until its fade finishes. Preload approaching storm decks. Pause empty cloud decks, dormant fog/mist/heat and offscreen scene animations. |
| 7. Sky sampler | Sample backgrounds into a 96-pixel-wide canvas; bound retained pixel maps to four. A typical lake sample uses 18 KiB instead of 6 MiB. |
| 8. Diagnostics | Record full fish checks only while the developer inspector is open or lure pulses are enabled. Mount the inspector controls only when expanded. Gameplay RNG and fish selection are unchanged. |
| 9. Filter/mask work | Contain scene layout/painting and blending. The Cedar mountain image and haze share one ridge mask and one color-filter pass, retaining their depth above the sun/moon and below foreground art. |

## Measured reductions

`public/assets/fishing/optimized/manifest.json` records source/runtime bytes
and dimensions for each asset. The complete runtime image set is 14,877,090
bytes versus 90,974,089 bytes for its PNG masters: **83.6% fewer bytes**.
These totals cover the library; an individual visit loads its current assets.

| Asset | PNG master | Runtime WebP |
| --- | --- | --- |
| Moon | 2,296,973 bytes, 1254 × 1254 | 6,892 bytes, 96 × 96 |
| Grass cover | 1,271,803 bytes, 1273 × 1236 | 23,976 bytes, 192 × 186 |
| Bobber | 1,548,800 bytes, 1024 × 1536 | 4,050 bytes, 85 × 128 |

Rebuild copies after adding/changing a painted master with:

```powershell
python scripts/optimize-fishing-artwork.py
```

The script requires Pillow, retains alpha, uses high-quality WebP encoding and
never changes source PNGs. The asset-existence test checks runtime paths.

## Validation

- 112 fishing tests passed, including deadline scheduling, background-tab
  expiry, stable clock props, cloud fade reversal, rain drawing density,
  countdown cleanup and the existing 110 directed weather transitions.
- TypeScript passed; browser verification covered clear weather, mature
  thunderstorms, fullscreen, both locations, live fish checks, a completed
  interactive catch and the optimized art. No browser errors were reported.
- Production build succeeded. Its source maps match all 50 current game
  source files; the existing MediaPipe dependency source-map warning remains.
- Fullscreen cove markers aligned within 0.02 CSS pixels of their calculated
  water positions. Screenshot: `output/fishing-performance-cove.png`.

These are byte counts, drawing/DOM counts and functional/visual checks.
They are not an FPS or GPU-time benchmark; speed gains depend on the device.
The ridge consolidation removes a redundant mask/filter surface without
lowering the resolution of the landscape or changing the scene depth order.
