# Stillwater fishing typing game

Open `/typing/fishing`, or choose **Stillwater Fishing** in the home screen's typing activities. This is a browser-local, single-player vertical slice integrated with the existing React, TypeScript, MUI, lazy routes, and Create React App build.

## Play

Cast with the button, Space, or Enter while the cast button is focused. Standard mode waits for a bite after casting. Bite waits use the current activity and tackle, doubled from the former range: generally 6–50 seconds, 12–100 in winter, and a 25% reduction for spring moving-lure presentations. The challenge starts when its input mounts, receives focus, and becomes visible. Type the whole lowercase phrase within exactly 10 seconds. Spaces count. A wrong character blocks further progress until removed with Backspace. Completion before the monotonic deadline guarantees the generated fish; Enter and a second catch roll are unnecessary. Paste and dropped text are disabled.

Catch results reveal species, rarity, individual quality, albino status, size, weight, typing speed, accuracy, and remaining time. An escape never includes the hidden encounter in its result data. All nine character presentation states are interruptible; the engine advances independently of animation completion.

The 60-fish livewell supports inspection and release. Each new catch retains the exact typing phrase; haiku also retain a snapshot of their original lines, poet and translator. Inspect a fish to read the poem and expand “Text you typed” for its normalized challenge text. Older saves stay compatible and show that typing text was not recorded for older catches. The catch result offers **Keep in livewell** or **Release now**, and **Manage fish** in the livewell supports individual selection, select all, clear selection and a single batch release. Lifetime discoveries, albino discoveries, largest sizes/weights, rarity and quality totals, streaks, typing statistics, and earned coins survive release. Best and average typing speed include both caught and escaped attempts. Saves use the versioned `cougar-fishing-v1` localStorage key. Active casts do not resume after reload. A storage failure produces a visible notice. Clearing browser data clears progress.

The old dock is free. Willow cove costs 25 lake coins per visit and adds a willow, waterfall, and shoreline layers. Each catch earns 5 coins. Neither location is passed to encounter or difficulty generation, so both share identical populations and challenges. One rod, red float lure, angler, and livewell are available.

## Standard and Interactive modes

Settings → **Fishing mode** defaults to Interactive for new saves and saves without a mode preference; an explicitly saved Standard choice is preserved. Standard uses the original timed waiting/battle game. Interactive casts immediately enter a complete, untimed haiku retrieve. Even typing swims the lure; bursts and pauses work it in a stop-and-go pattern; five seconds without typing produces dead stick. The last five seconds of input drive the lure-specific action and its fish preference weights. Tackle forecasts assume the selected presentation; typing controls the actual presentation during an interactive cast.

Each new correct character rolls no fish, a nibble or a bite using the existing season/time/moon/weather/gear weights. Waiting on a nibble for 5–10 seconds can turn it into a bite or lose the nibble. Typing releases it. Dead stick rerolls after five seconds and every five seconds thereafter, with no hidden-tab backlog. Grass letters have a 5% seed trial with 25% left/right growth, separated into runs of at most three. A candidate in cover advances one species rarity tier (Ultra-Rare is capped); dead sticking in cover adds a contact bonus. Quality/albino draws stay independent.

Reeling in lowers contact chances toward shore while reducing the remaining battle text, to a minimum 15% budget. Corrections cannot repeatedly roll the same completed letter or reel line out again. A completed or voluntarily reeled-in empty cast can be recast and is not counted as a fish escape. Fish-on retains the 10-second battle, accuracy tracking, landing animation and livewell release flow. Caught fish save both the retrieve haiku and battle phrase.

Wind casts 20% farther and increases battle text 20%; thunderstorms add 35%, blizzards 50% and hurricanes 65%. Cast distance stays fixed through weather changes. All bite timing doubles globally; winter doubles it again; spring swimming/fast moving-lure presentations reduce it by 25%. See [interactive rules and primary research](engine/interactive-research.md) for formulas, presentation mapping and evidence limits.

## Modules and content

- `engine/types.ts`: discriminated game phases and explicit content, save, and scene types.
- `engine/config.ts`: base encounter weights, quality weights, albino rate, bell-curve limits, speed limits, timing, currency, species, and locations.
- `engine/encounters.ts`: feeding-weighted species and independent quality/albino draws, a per-challenge split bell curve from −50 to +10 WPM with its mode at zero, a 1 WPM floor, correlated plausible sizes, injectable RNG, and seeded testing.
- `engine/world.ts` and `useWorldClock.ts`: daily calendar seasons, a reload-stable 48-minute clock, eight moon phases, sky positions and smoothly interpolated lighting.
- `engine/feeding.ts`: research-informed season/time/moon weights and normalized encounter odds shared with the in-game activity guide. Sources and limitations are documented in [feeding research](engine/feeding-research.md).
- `engine/phrases.ts`: over 1,000 natural lowercase phrases plus 122 sourced haiku, indexed once by length; matching stays within three characters of the requested target over the supported speed range.
- `engine/haiku.ts`: complete public-domain poems with poet, translator, original poem number and printed page. See the [collection and sources](engine/haiku-sources.md).
- `engine/game.ts`: pure cast, bite, input, timeout, and landing transitions.
- `engine/storage.ts`: versioned persistence, defensive loading, idempotent awards, travel, release, and lifetime statistics.
- `useFishingGame.ts`: synchronous state refs prevent rapid-button/stale-callback races; requestAnimationFrame checks monotonic deadlines and awards each result once.
- `scene/manifest.ts`: replaceable image/procedural layers with position, scale, z-index, opacity, parallax, weather/interaction behavior, animation, and optional spot restrictions. PNG, SVG, GIF, WebP, and stepped spritesheets are supported.
- `scene/FishingScene.tsx`: independent scenery, water, reflection, clouds, weather, rod/line/bobber, character, and interaction effects. Rod-tip measurements update at most 25 times per second while fishing.
- `scene/useFishBattle.ts`: presentation progress from the correct typed prefix, a brief surge on each typing error, and a persistent struggle while the wrong character remains.
- `components/`: keyboard challenge, reveal shared badges/performance, livewell, guide, statistics, and development tools.

Species represent a fictional Great Lakes connected freshwater lake: Bluegill, Yellow perch, Black crappie, Largemouth bass, Walleye, Northern pike, Muskellunge, and Lake sturgeon. The rarity tiers are game balance classifications, **not conservation status**. Species descriptions and biome selection were checked against the [Michigan DNR fish guide](https://www.michigan.gov/dnr/education/michigan-species/fish-species), [muskellunge information](https://www.michigan.gov/dnr/education/michigan-species/fish-species/muskie), and [Central Lake Michigan fisheries](https://www.michigan.gov/dnr/managing-resources/fisheries/units/c-michigan). Lengths/weights are illustrative game ranges, not an authoritative biological distribution or real fishing advice.

## Typing poems

When a complete haiku fits within three characters of a challenge's target, there is a 50% chance to choose uniformly from the eligible poems. Otherwise the normal phrase pool applies. Poems are never cut off, padded or joined to another poem. The ten-second deadline, WPM calculation and correction rules are unchanged. Haiku targets range from 51 to 84 characters after normalization, including spaces.

The 122 poems come from Basil Hall Chamberlain's 1902 English translations of classical Japanese hokku, now commonly called haiku. The original translations mostly use two English lines rather than an English 5–7–5 form. Typing joins those lines with spaces, uses lowercase, removes punctuation and expands historical elisions such as “flow'r” and “o'er.” The challenge shows the poet and translator separately from the required text. Original line breaks, source references and all poems are retained in the [collection](engine/haiku-sources.md).

## Assets

All assets are bundled in `public/assets/fishing/`, including retained reference/vector alternatives; there is no third-party image hosting or font dependency. The subfolders contain seasonal locations, character art, rod, lure, normal/albino fish illustrations, cloud/weather/moon artwork, ripple effects, and a UI mark.

The transparent distant shore at `locations/cedar/distant-shore.png` was created using the built-in imagegen tool. Final prompt: “Wide panoramic transparent distant scenery layer for a layered 2D fishing game: tranquil temperate North American lake shore, blue-green rolling mountains behind pine and deciduous forest, a few golden autumn trees, atmospheric depth; polished painterly vector-like game illustration, muted teal and sage, golden highlights. Only distant mountains and trees, transparent sky and lower area; no water, character, rod, foreground, text, or watermark.”

The lake, rocky far shoreline, forest, mountains, and sky are combined in `locations/cedar/lake-background-painted.png`, now painted in autumn copper, orange and gold. A 64-second ambient left/right cycle moves each layer according to depth: the combined background travels at most 0.16 pixels, and foreground reeds at most 7.5 pixels. Vertical travel is zero. Pointer and touch movement do not control the scene. Reflections remain aligned with their trees. Two views of the same combined image place the sky below the celestial layer and a traced mountain/forest silhouette above it; no seasonal raster files are split or modified. Earlier split-water and distant scenery assets remain as source alternatives. See [the fish/autumn prompts and saved paths](scene/fish-autumn-artwork-prompts.md).

Foreground depth remains reduced by 25 percent: grassy banks use 0.54–0.7125, reeds 0.9375, and the cove willow 0.675. Dock, fisherman, rod, and bobber remain separate matching painted PNGs. The fisherman’s hips are anchored to the dock planks; his position and width derive from dock bounds, with a shared responsive dock-width override on small screens. Pose rotation pivots around the seat so his hips stay planted during casting and reeling. The manifest defines normalized hand/grip/tip points for the separate animated rod. The line follows the measured rod tip and bobber position during ambient drift, casting, fighting, and escape. Bobber/water interactions follow the gentle background depth. Overscan hides image boundaries. Ambient movement pauses in hidden tabs and when the scene is off screen, and stops entirely for reduced motion. See [artwork prompts and saved paths](scene/artwork-prompts.md).

All eight species now use separate normal and albino painted PNGs, based on real species anatomy and identification references. Albino counterparts preserve each normal fish's pose and details, using ivory/cream bodies, softly pink fins and pink/red eyes. Where reliable species-specific albino color photos were unavailable, the palette is a documented reconstruction. Original vector/reference assets remain as alternatives; `node scripts/generate-fishing-assets.cjs` regenerates only those SVGs and leaves painted PNGs intact. The full-body painted fisherman uses CSS pose/lean animations alongside the independent painted rod. Rain, wind/leaves, fog, ripples, splashes, and the fish jump are procedural. Reduced-motion settings and the system preference suppress animation and ambient drift without changing gameplay deadlines. Sun and moon are one-third their earlier size; the moon's unlit portion remains fully opaque and samples the local sky color, receiving the same lighting and weather grading as the backdrop.

The typing panel sits above the action at the upper right, with a full-width upper panel on narrow screens. Phrase spaces remain normal, preserved spaces so wrapping breaks at word boundaries. The bobber, ripples and splashes share one moving anchor. Distance from the casting point toward water beside the measured angler is proportional to the fraction of correctly completed characters, including spaces; wrong characters do not reel in. Correcting or deleting text updates that fraction. Mistakes briefly tighten and tremble the line, pull the rod harder, and add 16 splash particles at the bobber. An uncorrected mistake keeps that struggle visible. This feedback does not alter deadlines or guaranteed catches on phrase completion. Reduced-motion settings keep the positional progress and static tension cue while suppressing shaking and splashes.

On a successful catch, `scene/FishLanding.tsx` measures the bobber and arcs the species artwork into the angler's lap. The normalized lap point in `ANGLER_RIG` scales with the seated character and follows his ambient movement. The fish rests across his knees through the catch result and clears when returning to the water. Reduced motion places the catch in his lap immediately.

Autumn Willow Cove now follows the supplied golden willow reference with an opaque sky, the shared painted cloud system, a combined mountains/forest/rocks/water layer, a close shoreline with a stone sitting ledge, and two willow canopies. The moving sun and moon sit between sky and clouds, behind the transparent mountain silhouette. The shoreline and existing angler share an undistorted responsive canvas, keeping his hips on the ledge and boots on the lower stone. Separate willow branches sway by ±0.35 degrees on independent 14/18-second cycles. Location previews use the same scene layers. The new cove currently covers autumn; other seasons retain the existing scenery. See [the built-in imagegen prompt set and saved paths](scene/willow-cove-autumn-artwork.md).

When a fish escapes, the bobber launches from its last position in a 1.25-second spinning arc toward the rod. The rod recoils, the measured line follows the airborne float, and a one-time splash and ripples stay at the water origin. The escape panel fades in after the initial flight. Animation completion or a fallback timer removes the float and line; casting again resets the effect. Reduced motion shows the result immediately without the launch.

## Seasons, sky and feeding

Spring, summer, autumn and winter rotate at midnight each real day in America/New_York. October 10, 2026 anchors spring; October 12 uses the existing autumn artwork. Spring, summer and winter each have a new painted combined background, transparent bank and transparent reeds. The cove willow also changes season. See [the final seasonal artwork paths and built-in imagegen prompt set](scene/season-artwork-prompts.md).

One lake day lasts 48 minutes. Late night (00–04), dawn (04–08), morning (08–12), afternoon (12–16), dusk (16–20) and early night (20–24) each last eight real minutes. The sun crosses the sky from 06 to 18 and the moon from 18 to 06. Scene grading blends between lighting keyframes and combines with weather. Stars become strongest in late night. The separate painted moon is clipped into full, ¾ waning, ½ waning, ¼ waning, new, ¼ waxing, ½ waxing and ¾ waxing phases, advancing once per game day (384 minutes per complete cycle). These are stylized sky arcs rather than astronomical predictions.

The clock uses absolute time and catches up when a background tab returns. Daily season arithmetic respects New York midnight and daylight saving changes. Reduced motion suppresses sky transitions and twinkling while the clock and gameplay continue. Conditions are sampled at bite and saved with caught fish; a season/time/moon transition does not reroll the active fish or reset typing.

Nighttime foreground grading preserves full saturation and normal contrast, darkening the angler, dock, banks, reeds and fishing effects through brightness alone. Distant scenery uses 86% contrast and 88–90% saturation before weather grading. The sky tint and vignette sit behind foreground artwork, and the moon's opaque shadow receives the same filter as the sky. Dawn and dusk blend smoothly between daytime and nighttime grading.

The shared cloud system uses six painted alpha assets informed by [National Weather Service cloud classification](https://www.weather.gov/lmk/cloud_classification): cirrus, fair-weather cumulus, thin broken stratus, cumulonimbus, a grey overcast carpet and a darker rain deck. Individual fair-weather clouds drift and fade over independent 137–211-second lifetimes; weather cover blends over 12–16 seconds, and images fade in after loading. Clouds sit above the moving sun/moon and below the terrain in both locations and all seasons. Thunderstorm is a saved weather choice: sunlit thunderheads grow first, cloud cover starts arriving at 40 seconds, rain builds from 65 seconds and settles at 85 seconds, within a variable natural event of 15–96 minutes (the manual preview defaults to 15 minutes). Cloud flashes begin 90 seconds apart, tighten toward 30 seconds at the event midpoint, then slow toward 90 seconds before stopping at three-quarters of its duration. The final quarter retains rain, clouds and fog without lightning. Natural weather advances to a weighted rain/cloud/wind successor at expiry; the manual 15-minute storm preview still transitions to rain. Saved timing survives reload and hidden tabs. Each flash is a brief double pulse contained inside the background cloud layer. Reduced motion keeps the weather stages and static cloud cover while suppressing drift, rainfall streaks and lightning. Weather affects future bites and does not reset an active challenge. See [the built-in imagegen prompts and final saved paths](scene/cloud-artwork-prompts.md).

**What’s biting?** shows current encounter odds, an explorable eight-species/six-period activity table, and research links. All eight species remain possible. Walleye, pike and muskellunge get modest lunar effects where catch studies support them; the others use neutral moon weights. Exact activity coefficients are game estimates, since published research does not supply a complete conditional feeding probability table. Time, season, supported lunar patterns, weather and tackle change species weights and bite wait; quality and albino rolls remain independent.

Fog sits at depth 4, over the distant landscape but behind banks, dock, angler and foreground foliage. Thunderstorms add a thicker bank from 8% to 72% of scene height plus uneven wisps over the mountains; this fog builds with the storm cloud deck and receives background lighting. Rain remains independently above the foreground. Cloudy, rainy and storm conditions add a translucent grey gradient over the upper mountains, fading toward the lake. The old dock's seasonal skyline mask trims the original bright sky pixels with a small vertical erosion and soft feather; autumn Willow Cove uses the terrain's painted alpha. Gradient opacity follows cloud cover and storm buildup with eight-second transitions. Cloudy and rainy weather use the early-night lighting preset (22:00), and thunderstorms blend from the actual daytime lighting to late-night lighting (02:00) only as fog arrives, overriding the daytime appearance while the actual clock, sun/moon positions and fish feeding conditions continue normally. Foreground saturation and contrast remain normal under these night presets. Clear skies have no grey mountain overlay.

Night exposure is very low, with nearly colorless distant silhouettes and smooth dusk/dawn transitions. A cool moonlight pass gently lifts the background sky, mountains and water, behind foreground foliage and the angler. Its intensity follows lunar phase, elevation, actual night and weather visibility; new moons and daytime weather overrides add no moonlight. A separate painted lantern sits behind the angler on the same seat anchor at both locations. Warm illumination falls away across nearby ground and the angler, retaining local color and normal contrast. Foreground light passes reuse cached artwork, clip to its alpha, and only measure coordinates on resize or image load. Daytime drops the passes after their fade. See [night references, artwork paths and built-in imagegen prompt](scene/night-lighting-artwork.md).

## Tackle and bite forecasts

**Tackle** equips one of twelve real lure/bait types with an applicable color, compatible rig and retrieve. Live bait keeps its natural color. Sizes, rig explanations and retrieve instructions accompany the selection. Species-specific suggestions search valid combinations for the current season, real time of day, moon and weather, offering three distinct lure types. The target selector changes suggestions; it does not guarantee that species. The live forecast and **What’s biting?** show the same weights used by encounters, plus an expected wait using the doubled timing, winter penalty and spring moving-lure bonus. The activity table explores season, moon and weather before tackle effects. All gear is available without a coin cost.

Baseline abundance, seasonal/time feeding, supported lunar patterns, weather and tackle presentation determine the species weights. Their sum also adjusts bite waiting time; larger predator lures can draw fewer bites and favor scarce fish. Color is a small visibility modifier, and rain does not automatically change water clarity. The waiting time and equipment are fixed when casting; current environmental conditions are sampled at bite. Setup selection saves across reloads, is locked during a cast and is remembered with each new livewell fish. Legacy catches retain their records without invented gear. The red float remains a stylized strike indicator for all presentations, rather than a literal rig illustration.

See [tackle research and balance assumptions](engine/tackle-research.md) for the primary-source guide, full formula and evidence limits. Tests check all 25,344 condition/type combinations, normalized probabilities, bounded waits, changing species preferences, independent quality/albino rates, incompatible gear correction, recommendations, cast snapshots, save migration, selectors and lock/focus behavior.

## Natural weather

Choose **Natural weather** in the developer Weather dropdown or Settings to run the saved weather schedule. All eleven event types have their own bell-shaped duration distribution with rare persistence tails. The entire distribution is calibrated to its displayed average: a 12-hour rain event scales to a 24-minute mean and rain can last up to 192 minutes (four game days). Heat waves average 144 minutes with a 96–240-minute range. All nominal ranges remain within 10–240 minutes; thunderstorms retain a 15-minute minimum.

The transition matrix, duration ranges, remaining time, recent event history and conditional next-weather probabilities appear under **Weather duration ranges and transition tables** in the developer panel and What’s biting?. Heat waves are blocked in winter and have one-fifth summer entry weight in spring/autumn. Thunderstorms require heat wave → cold front; snowfall requires winter cold front → rain; blizzards require winter wind → cold front → rain. Thunderstorms never directly become clear skies. Hurricanes represent rare inland remnants in summer/autumn. The corresponding response coefficients change bite waits, species odds and tackle recommendations; new scene effects include heat haze, cooling gusts, heavy hurricane rain and wind, snowfall and blowing snow with background fog.

Heat waves add a subtle orange-red color wash, while cold fronts, snowfall and blizzards add a subtle blue wash. The tint covers the complete scene, including foreground foliage, dock and angler, and preserves luminance through color blending. It fades over eight seconds; reduced motion applies it immediately. Interface controls keep their own colors. The saved event seed, duration and four-state history survive reload and background tabs. Catch-up uses the original event boundaries rather than restarting a timer. Incompatible weather ends at a daily season boundary; this and developer next-event previews can shorten a sampled event below its nominal minimum. Weather changes preserve an active typing challenge. Manual scene previews bypass season and chain rules. Developer **Next natural event (preview)** advances through the same weighted and gated transitions while skipping the wait. See [weather research, tables and assumptions](engine/weather-research.md).

## Wind, heavy rain and angler outfits

Thunderstorms render 320 near rain streaks plus 160 finer distant streaks; hurricanes render 520 near plus 240 distant streaks. They retain the existing buildup opacity and use faster, longer, slanted rain, 64/96 lake impacts, and a low spray haze behind foreground scenery. Ordinary rain retains 42 streaks and 12 impacts.

Wind strength speeds up reeds and foreground willow branches, with independent sway amplitudes and cycles. Thin white gust wisps cross the lake while seasonal leaves tumble along the ground, pause at shoreline/dock anchors for random intervals, then continue blowing. Arrival and release animations drive the leaf state, with queued/held timers paused in hidden or offscreen scenes and cleared on unmount. Reduced motion suppresses the moving litter, streaks and wisps. The far shore retains its very low automatic horizontal drift.

The original fisherman is spring attire. Summer, autumn and winter each use a new transparent painted outfit that preserves the same person, seated pose, hand, rod and lap anchors. Seasons change the body image automatically, including developer previews; the dock, rod and bobber remain separate assets. See [the saved artwork and built-in imagegen prompt specifications](scene/angler-outfit-artwork.md).

## Weather transitions

All eleven weather types share smooth presentation changes. Incoming rain, snow and gust particles fade in over twelve seconds; outgoing particles keep their current positions and animation timelines until their fade completes. Rapid changes retain existing layers and reverse from the currently displayed opacity. Finished outgoing layers and their timers are removed. Fog, spray, heat haze, mountain grading, thermal washes, moonlight and the sky tint also fade, with graded base-sky and moon-shadow colors. Foreground sway and gust speeds ramp over twelve seconds through playback-rate changes, preserving animation phase and leaving lighting transitions at their normal speed. Active lightning pulses finish when weather changes; the storm's quiet final quarter still suppresses flashes.

Reduced motion applies the selected weather immediately and clears outgoing effects. Presentation blending does not delay the saved weather schedule, alter transition probabilities, or restart an active cast or typing deadline. Tests cover all 110 directed weather pairings, interrupted rain/snow fades, particle reuse and cleanup, reduced-motion changes, uninterrupted animation time and lightning handover.

## Scene viewing

The upper-right scene controls provide fullscreen and a Scenic HUD toggle. Scenic mode hides menus, labels, counters and game panels while scenery keeps animating; its button fades to 12% opacity and returns to full visibility on hover or keyboard focus. Fullscreen expands the scene to the display, with a viewport-sized fallback for embedded browsers. The exit icon and Escape restore the previous view; dialogs remain inside the fullscreen game. Scenic mode is available between casts so a hidden challenge cannot expire, and Space does not cast while the HUD is hidden. View changes are temporary and do not alter the saved game.

## Developer controls

The expandable **Developer tackle box** exists only under `NODE_ENV=development`; production builds eliminate its lazy import and controls. It can force a species, rarity, quality, albino status, target speed or bell-curve adjustment; trigger a bite during casting/waiting; select weather; preview all character states; preview seasons, periods and moon phases; return to live conditions; preview the quiet final quarter and a single cloud flash; and inspect the scene manifest. A species override takes precedence over a rarity override. Encounter overrides apply to the next bite. World previews update the scene and next encounter but are not persisted. Developer catches use the preview origin's local save.

## Verification

```sh
npm run test:fishing
npm run simulate:fishing
npx tsc --noEmit
npm run build
```

The 131 fishing tests cover weighted populations; independent quality/albino modifiers; all attribute combinations; the bell curve and its endpoints; one-character challenges; guaranteed success; deadline expiration and hidden escape data; strict correction; reload/release persistence and idempotent awards; identical sublocation probabilities; animation-independent phase transitions; seasonal asset existence; calendar midnight and DST; all moon phases; normalized feeding odds in all 192 environmental combinations; and rendered keyboard/focus/catch/escape/livewell behavior. Clock-boundary and thunderstorm integration tests verify that active typing continues without resetting progress or the deadline. Weather tests also cover the storm buildup, smooth rain onset, timer cleanup, saved weather choices, cloud assets, independent storm fog, weather lighting overrides without changing the clock, daylight buildup, the lightning interval curve and rendered flash schedule, reduced motion, saved storm timing and storm expiry into rain during active typing. Haiku tests check 122 distinct, traceable, typeable poems, normalization, whole-poem selection at each matching difficulty, selection frequency, short-challenge fallback and author credits outside the required text. Catch-memory and livewell tests cover complete poem snapshots and exact typing text after reload, legacy and malformed saves, immediate release, individual and batch selection, retained rewards and idempotent awards after release.

The UI tests isolate the navigation link because the repository's CRA/Jest 27 resolver predates the installed React Router v7 package exports. The rest of the game and engine are real in these tests. Browser checks additionally cover route loading, catch/escape play, reload/livewell inspection, responsive layout, travel, weather, and asset loading.

## Balance sample

`npm run simulate:fishing` uses seed 20261012 and 250,000 natural encounters, plus a separate 250,000-encounter conditional Ultra-Rare SS albino sample. It prints encounter counts, completion percentages, and expected catches for every rarity/quality and albinos. Passing a number runs a different sample size, e.g. `npm run simulate:fishing -- 1000000`. Players are modeled with steady speed and perfect accuracy; real mistakes and reaction time reduce results. Length comparisons respect completion strictly before the deadline.

| Player WPM | Expected catches / 250,000 casts | Overall completion | Ultra-Rare SS albino completion, conditional |
|---:|---:|---:|---:|
| 20 | 137,205 | 54.88% | 0.0000% |
| 35 | 223,473 | 89.39% | 0.0000% |
| 50 | 245,180 | 98.07% | 0.0000% |
| 70 | 249,745 | 99.90% | 1.8208% |
| 100 | 250,000 | 100.00% | 47.3296% |
| 120 | 250,000 | 100.00% | 99.9444% |

The natural sample encountered 150,135 Common, 77,233 Uncommon, 20,062 Rare, 2,203 Mythic-Rare, 367 Ultra-Rare, and 494 albinos. Quality counts were C 119,747; B 75,010; A 37,749; S 13,762; SS 3,732. This baseline simulation omits environmental weighting; actual gameplay applies current feeding weights. The extreme-combination column is the chance of completing **that already-encountered combination**, not its global chance per cast. The new bounded −50 adjustment lowers a 110 WPM Ultra-Rare SS albino only to 60 WPM. These seed-specific estimates verify monotonic performance and the requested bounded curve; rare natural categories have sampling noise.

No upgrades, quests, multiplayer, server accounts, or additional biomes are implemented, in keeping with the requested MVP scope.






Interactive tests cover the five-second rhythm window, no-fish/nibble/bite rolls, nibble conversion and loss, idle rerolls, bounded grass clusters and probability trials, exactly one-tier promotion, distance-scaled difficulty, doubled winter waits, spring moving-lure bonuses, new/legacy mode saves, real input focus, reel-in cancellation and recording both typing texts with a catch.

## Developer fish checks

Open **Developer tackle box → Live fish checks**. Each new correct retrieve letter, five-second dead-stick roll, nibble decision, Standard bite and developer-triggered bite records a snapshot. The latest 40 checks stay in memory for this session. The selector follows the latest check or freezes a previous one for inspection. The table shows unnormalized weights, base species roll bands, conditional species probabilities after cover promotion, and absolute nibble/bite probabilities for that check. No-fish probability, random draws, environment, observed presentation, cursor and reeled distance are recorded alongside the outcome. Nibble decisions retain their candidate rather than rerolling species, and forced checks are explicitly marked.

Enable **Show checks at the lure** for a brief pulse and outcome label at the exact current bobber position. This is a check indicator, not a map of hidden resident fish: the model selects fish when contacts occur. Diagnostics do not consume additional RNG draws, change fish odds, pause gameplay, or persist in catch saves. The controls and capture are restricted to development builds. Test coverage checks normalized tables, cover promotion, forced and Standard checks, nibble decisions, RNG transparency and inspector controls.

## Water cover indicators

In Interactive mode, the rolled green-letter cover mask places small painted aquatic grass clumps along the bobber’s reel-in path. Each adjacent run forms one clump; its ripple brightens while the current cursor is within that cover run. A faint reflection and a softened waterline seat the reeds in the lake. The markers use the same measured angler endpoints and wind cast distance as the float, including fullscreen and narrow screens. Weather/night grading and smooth wind sway affect them. Clumps remain during an interactive fish battle and landing, then clear when the cast ends. Standard casts have no cover-letter indicators.

See [grass cover artwork and the built-in imagegen prompt](scene/grass-cover-artwork.md). Coverage tests verify grouped letter positions, measured path alignment, wind distance, active-cover highlighting and retention through the battle.

## Performance

See [performance changes and measured reductions](performance.md) for the nine optimizations, asset rebuild command and verification notes. Runtime artwork uses optimized WebP copies; painted PNG masters remain intact.

## Keep screen awake

**Settings → Keep screen awake** is enabled by default to request the browser's Screen Wake Lock while this game is visible. The preference is saved and applies during gameplay, Scenic mode and fullscreen. Switching tabs/apps releases it; returning requests a fresh lock. Leaving the game or disabling the setting releases it, including requests that finish late.

The setting shows whether the screen is staying awake, paused, unavailable or released by the device. A retry button handles device/browser rejection without repeated background requests. Published/mobile access needs HTTPS and a supporting browser; battery-saving settings can override the request. New saves and saves without this preference default on; an explicitly saved off choice is preserved.

See [browser wake-lock documentation](https://developer.chrome.com/docs/capabilities/web-apis/wake-lock). Eight lifecycle tests cover opt-in, visibility, pending-request races, cleanup, device rejection, unsupported contexts and saved preferences.

## Fish measurements and the field notebook

Hide automatic fish details is on by default, including for older saves without a preference. It removes automatic catch names, quality labels, weight and length from the catch screen, livewell, latest-catch summary, discovered-species labels and personal-best tables. Manually written names and measurements remain visible. Imperial (decimal pounds and inches) is the default; Metric uses kilograms and centimeters. Explicit preferences survive reload.

Each species has five non-overlapping weight bands within its own configured range:

| Quality | Fraction of that species' weight range |
| --- | --- |
| C | 0–8% |
| B | 8–22% |
| A | 22–45% |
| S | 45–72% |
| SS | 72–100% |

Bounds are quantized to grams before sampling. The size mixture retains the former 48/30/15/5.5/1.5 quality frequencies, and quality is derived from sampled weight before calculating difficulty. Length follows the correlated size curve. Thus a heavier fish cannot have a lower quality than a lighter fish of the same species. Albino and environmental species rolls remain independent. Older held fish are reclassified once from their existing weights, adjusting their tracked quality counts without changing physical measurements, rewards or catch totals. Released historical fish retain their old aggregate counts because their weights are no longer available.

Fish photographs use the same bounded display scale across species: length increases horizontal extent, and weight increases both width and body thickness. Original painted pixels remain unchanged. Sprite alpha bounds align the snout and tail with the ruler; ruler graduation spacing is derived from the displayed fish width and its actual length, so changing image size does not change the measurement.

Catches and livewell details include the ruler and a Weigh fish button. The latter opens a screen overlay showing the actual scale reading in the chosen units. It does not record a measurement. The parchment form accepts your fish identification, weight, length and notes; untouched fields remain Unweighed / Unmeasured. Valid field edits save on blur, and Save entry saves the complete edited form. Blank measurement fields clear an observation; invalid or nonpositive input does not overwrite a saved value. User observations never change the actual fish, its quality, artwork size or lifetime records.

Journal → My notebook presents two facing parchment pages with animated page turns, editable observations and extra blank entries. On narrow screens the facing page can be swiped into view. Entries are stored separately from livewell fish and remain after individual, immediate or batch release. Legacy catches receive blank notebook entries rather than invented measurements. Canonical numeric values are stored in kilograms/centimeters; display unit changes and untouched rounded fields do not alter those values.

Additional tests cover weight-band boundaries across every species, quality migration, independent image dimensions, preference defaults, unit conversion, manual-only recording, invalid entries, field blur, preserved canonical values, hidden identities, page navigation, malformed saves and retained notes after release.
