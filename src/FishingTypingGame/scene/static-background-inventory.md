# Static lake background inventory

Scope: one flattened image containing the sky, distant scenery and lake, behind
the separately rendered angler, fishing gear, foreground and visitors. Counts
assume one representative snapshot per time period and weather type. They do
not reproduce every moment of the current continuous lighting or animation.

## Base combinations

The app has three views: the old dock, Willow Cove and Birch Point.

- Four seasons: spring, summer, autumn, winter.
- Six periods: dawn (04–08), morning (08–12), afternoon (12–16), dusk (16–20),
  early night (20–24), late night (00–04), in game hours.
- Eleven selectable weathers: sunny, overcast, rain, thunderstorm, wind, fog,
  heatwave, cold front, hurricane, snowfall, blizzard.

All manual settings need **4 × 6 × 11 = 264 images per view**, or **792** for
all three views. Natural weather excludes some season/weather combinations:

| Season | Allowed natural weathers | Images per view |
| --- | ---: | ---: |
| Spring | 8 | 48 |
| Summer | 9 | 54 |
| Autumn | 9 | 54 |
| Winter | 9 | 54 |
| Total | 35 season/weather pairs | 210 |

Heatwaves exclude winter; hurricanes require summer or autumn; snowfall and
blizzards require winter. Thus natural-weather coverage is **210 per view** or
**630 across all views**. Manual selection permits all eleven in any season.
Natural weather is a selector, not a twelfth weather appearance.

## Independent background events

Aurora and meteor showers can overlap and are visible in darkness. Sailor's
Delight recolors sunset light/clouds during dusk. Morning lake mist is a separate
daily event from fog weather, developing in late night and lifting through dawn
and morning. Each has variable timing and strength.

Treating these four events as simple on/off flags gives 16 combinations including
none. A deliberately conservative, unfiltered asset budget would therefore be:

| Coverage, with all four event flags baked in | Per view | All three views |
| --- | ---: | ---: |
| Natural season/weather pairs × 6 periods × 16 flags | 3,360 | 10,080 |
| All manual season/weather pairs × 6 periods × 16 flags | 4,224 | 12,672 |

These are upper bounds for a binary event matrix, not counts of distinct visible
or naturally reachable scenes. They include impossible time/event pairings and
effects hidden by dense weather. Event intensity, exact hour and animation still
need discretization. Keeping these effects as separate layers avoids this
multiplier and preserves their independent schedules.

For a tighter binary planning budget, exclude events outside their visible time
windows. Count any event combination that can appear somewhere within a period:

| Period | Eligible flags | Combinations including none |
| --- | --- | ---: |
| Dawn | Aurora, meteors, lake mist | 8 |
| Morning | Lake mist | 2 |
| Afternoon | None | 1 |
| Dusk | Sailor's Delight | 2 |
| Early night | Aurora, meteors | 4 |
| Late night | Aurora, meteors, lake mist | 8 |
| Total per season/weather pair | | 25 |

That gives **35 × 25 = 875 per view / 2,625 total** for natural weather, or
**44 × 25 = 1,100 per view / 3,300 total** for all manual combinations. This
remains an artwork planning count: dense weather may hide an event and exact
hour/strength are represented by a chosen snapshot. It excludes moon-phase
variants and the visitor layers below.

## Other variables

- Eight moon phases, moon position and phase-dependent moonlight/reflections.
  Keep the moon and its lighting separate to avoid multiplying nighttime art.
- Continuous sun position, light direction, mountain backlight, color, shadows,
  sun glints and moving star positions; six snapshots approximate these.
- Weather age/intensity, cloud arrangement, lightning flashes, rain/snow,
  wind-driven water, fog density and transitions between weathers. Crossfading
  backgrounds covers broad transitions; particles and flashes can stay layered.
- Plant species/layout seeds, growth stages and blooms change within a season;
  the foreground plants and any surface lilies need their own layers.
- Tree birds, migrating geese, butterflies, odonates, fish splashes, lantern
  insects and the calendar Santa visit have independent appearances/schedules.
  These are visitor/effect assets, not base background combinations.
- Viewport aspect ratio, crop and parallax. One sufficiently wide image can
  serve desktop/mobile crops; dedicated portrait compositions would add assets.

## Practical asset budgets

- Bake season, time and weather: **630 natural backgrounds**, or **792** with
  full manual weather support, across all three views. Keep events layered.
- Bake season and time, keep weather/events/light effects layered: **72 base
  images** (3 views × 4 seasons × 6 periods).
- Bake season only and retain procedural lighting/weather/events: **12 base
  images** (3 views × 4 seasons). This is closest to the existing architecture.

These are planning options, not a change to the rendering implementation.

Source of counts: `engine/types.ts`, `engine/naturalWeather.ts`,
`engine/world.ts`, `engine/astronomy.ts`, `engine/lakeFog.ts`,
`engine/config.ts`, `engine/plantLifecycle.ts`, `scene/manifest.ts` and
`scene/FishingScene.tsx`.
