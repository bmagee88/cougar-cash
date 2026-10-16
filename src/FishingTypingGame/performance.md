# Fishing performance changes

## Night sky

The sky now uses a local 85.6 KB catalog of 2,851 real stars, fetched only
at night and released with its SVG nodes in daylight. The request aborts
on unmount. Stars use the existing world clock and CSS interpolation;
aurora and meteor layers use the existing ambient animation sampler.
There are no additional JavaScript animation loops. Timed rendering,
hidden/offscreen animation pausing and reduced motion are preserved.
See [night-sky.md](scene/night-sky.md) for astronomy, event schedules, sources
and validation. All 190 fishing tests and the production build passed.

## Lake fog

Fog now uses distance haze to lower contrast and color separation in the far
ridge and tree line, then clears toward the near water. Three shallow banks
of textured mist drift horizontally above the water. They share the painted
landscape's cover frame and waterline, keeping their depth consistent on both
portrait and wide screens and at both locations. Foreground foliage, the
angler, fishing line and controls stay outside the fog layer.

The palette follows actual daylight, night, lunar phase and moon elevation;
night fog stays dark blue-grey, with subtle scattered light around a visible
moon. References: [daytime lake mist by Adrian Pelletier](https://pixnio.com/nature-landscapes/fog-mist/fog-mist-lake-scenic-lake-fog-trees-clouds),
[moonlit lake fog by davidiam](https://www.davidiam.com/about-me-pricing), and
the [National Weather Service fog tutorial](https://www.weather.gov/lmk/fog_tutorial).
This is a painted atmospheric effect, rather than a volumetric simulation.

The only added texture is a reusable 512 x 128 SVG mask. Its noise is static;
only shallow mist layers move. There is no animated noise, scene-sized blur,
new canvas or additional JavaScript animation loop. The existing environment
timer samples the fog's paused CSS animations. Reduced motion keeps it still,
hidden/offscreen scenes pause it, and inactive fog unmounts its textured layers
after the natural fade (immediately with timed rendering or reduced motion).

Fog validation: all 182 fishing tests passed across 26 suites, including
day/night lighting, lunar phase/elevation, shoreline-frame alignment, fade
cleanup and timed animation sampling. The production build passed with
`CI=true` and `GENERATE_SOURCEMAP=false`. Browser security blocked access to
the local preview during this change, so visual browser verification remains
pending.

## Environment rendering and idle audit

Settings now offers **Natural (smooth)** or sampled environment rendering every
1, 2, 5 or 10 seconds. Natural preserves the previous rendering behavior.
Timed choices sample the sky clock, daylight/color overlays, ambient CSS
animation timelines, scene drift and heavy-rain canvas. Their lighting filters
change without continuous interpolation. Wind strength changes are applied at
the sample instead of starting another frame-driven tween. Old weather
surfaces unmount immediately in timed mode. Game rules, keyboard input,
Fish Fight updates, bite/nibble cues and pixel-perfect butterfly interaction
keep their original timing. Higher intervals visibly trade smoothness for less
continuous work; they are not a global FPS limit.

The world clock, storm clock and natural-weather polling now stop when the
document is hidden, refresh from actual time on return, and dispose timers
when unmounted. Drift and rain also stop offscreen. Timed drift schedules one
timeout instead of an animation-frame loop. Paused ambient CSS timelines
advance on that timeout; gameplay animation timelines are excluded.

Other changes from the idle audit:

- Butterfly sprite promises use a four-species LRU cache instead of retaining
  every species visited for the rest of the session. Active butterflies keep
  their own sprites until they leave. Failed loads are removed so a later
  visitor can retry. The existing foreground pixel masks use weak image keys.
- Storm lightning schedules are capped at eight durations. This previously
  grew with each distinct natural-storm duration in a long session.
- The heavy-rain canvas releases its backing dimensions on cleanup.
- Developer controls are fetched and mounted only after expanding their
  summary, and unmount on collapse. They stay outside production builds.
- Fish field-guide images use native lazy loading and asynchronous decoding.
  Butterfly guide images already loaded lazily; closed panels already unmount.
  The small sky-color sampler already has a four-entry cache.

Read-only Windows process measurements during this audit separated development
tools from the browser: the React development server held roughly **1264 MiB**
of private committed memory, and two TypeScript workers held **541 + 50 MiB**.
Their resident working sets at that instant were about **160 + 7 + 12 MiB**.
Committed memory includes pages that may be paged out; these numbers are not
the browser page's JavaScript heap and do not demonstrate a game leak.
The incremental compiler remains running because the development server is
still needed. A deployed production build does not run those compiler workers.

Verification checks the selected cadence, zero timer accumulation after
unmount, hidden-tab suspension, immediate input and Fish Fight behavior at a
10-second environment interval, and removal of outgoing weather surfaces.
Browser inspection at five seconds confirmed paused cloud/fog timelines and
zero-duration layer transitions. This is a code/timer/resource audit, not a
browser heap snapshot or a measured whole-machine RAM/FPS improvement.

## Earlier performance work

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
