# Natural weather, durations and successor model

Research checked October 13, 2026. Natural weather is a local, fictional temperate-lake weather sequence. It is not a real-time forecast. A real-world day scales to 48 minutes of play (30:1 time compression). Events have saved absolute start/end times, their own random seed and the last four weather states. Manual choices are previews that bypass natural entry rules.

## Evidence and boundaries

- [NWS thunderstorm lifecycle](https://www.weather.gov/spotterguide/life): development, mature rain/lightning, then weakening rain and outflow. Individual cells commonly last 30–60 minutes. [NWS thunderstorm types](https://www.weather.gov/zme/safety_ts) distinguishes short individual cells from longer multi-cell clusters. The game represents a storm system and preserves the user's prior 15-minute minimum rather than compressing a single cell to 1–2 minutes.
- [NWS heat-wave glossary](https://forecast.weather.gov/glossary.php?word=heat+wave): heat waves typically last two or more days. The game minimum is therefore 96 minutes, with a chosen average of three days (144 minutes) and a five-day cap (240 minutes).
- [NWS frontal-process explanation](https://www.weather.gov/lmk/winterpt1) describes precipitation and convection around frontal systems. The game's separate cold-front stage is a stylized local passage and response period, not an entire continent-wide front.
- [NWS winter-weather definitions](https://www.weather.gov/safety/winter-snow): a blizzard is sustained strong wind and falling/blowing snow with prolonged low visibility; snowfall and blizzard are distinct effects. The specified wind → cold front → rain prerequisite is the user's game rule, not a meteorological definition. Snow does not universally require preceding rain, and thunderstorms do not universally require a preceding heat wave.
- [NOAA extratropical transition](https://www.aoml.noaa.gov/our-research/hurricane-research-division/extra-tropical-transition/): tropical cyclones can transition into midlatitude systems with continued rain and strong wind. For this inland lake, the hurricane event represents rare inland remnants, not a hurricane forming over freshwater.
- [Minnesota DNR pike profile](https://www.dnr.state.mn.us/minnaqua/speciesprofile/northern_pike.html) and [Indiana DNR pike guidance](https://www.in.gov/dnr/fish-and-wildlife/fishing/northern-pike-fishing) support cool-water/deeper-water preferences as surface waters warm. Other species and retrieval sources remain in [tackle-research.md](tackle-research.md).

Weather duration varies greatly by location, season and system type. These sources do not establish a universal empirical next-weather matrix or prove that most rain events last 12 hours. The rain calibration below follows the user's example: a 12-hour mean becomes 24 minutes, and a four-day maximum becomes 192 minutes. Other central durations are explicit game calibrations informed by the relative persistence of event types, not measured climatological averages.

## Duration distribution (real play minutes)

| Event | Mean | Minimum | Maximum |
| --- | ---: | ---: | ---: |
| Clear | 48 | 10 | 240 |
| Cloudy | 36 | 10 | 192 |
| Rain | 24 | 10 | 192 |
| Wind | 24 | 10 | 96 |
| Fog | 16 | 10 | 48 |
| Heat wave | 144 | 96 | 240 |
| Cold front | 20 | 10 | 48 |
| Thunderstorm system | 30 | 15 | 96 |
| Hurricane remnants | 48 | 24 | 144 |
| Snowfall | 24 | 10 | 192 |
| Blizzard | 36 | 15 | 96 |

Integer-minute distributions mix a truncated bell-shaped core with a small broad persistence tail (1–3% mixture weight). A binary search calibrates the core center so the *entire* distribution's expected duration equals the listed mean; the tail does not inflate a 24-minute rain mean. Every minute within the range has positive mass. The cap is four real play hours, representing five game days. Seasonal eligibility takes precedence: an incompatible daily season ends an event early, potentially below its nominal minimum. A developer next-event preview also intentionally skips the remaining time.

## Summer base transitions

Percentages below total 100% in each row. Omitted successors are zero. Spring/autumn multiply heat-wave entry weight by 0.2; winter removes heat-wave entries. Hurricane entry is restricted to summer/autumn. Removed weights are renormalized, not redirected to a prohibited successor.

| Current | Successors |
| --- | --- |
| Clear | cloudy 42, wind 28, fog 15, cold front 10, heat wave 5 |
| Cloudy | rain 38, clear 28, wind 20, cold front 12, fog 1, hurricane 1 |
| Rain | cloudy 55, wind 20, fog 20, cold front 4, hurricane 1 |
| Wind | cloudy 35, clear 30, cold front 25, rain 10 |
| Fog | clear 55, cloudy 35, wind 10 |
| Heat wave | cold front 60, clear 25, cloudy 10, wind 5 |
| Cold front | rain 45, wind 25, cloudy 20, clear 10 |
| Thunderstorm | rain 65, cloudy 30, wind 5 |
| Hurricane remnants | rain 65, wind 25, cloudy 10 |
| Snowfall | cloudy 60, wind 25, clear 15 |
| Blizzard | cloudy 70, wind 30 |

Conditional rows replace the base row:

| Exact predecessor sequence | Successors |
| --- | --- |
| heat wave → cold front | thunderstorm 55, rain 25, cloudy 10, wind 10 |
| winter: cold front → rain | snowfall 60, cloudy 25, fog 10, wind 5 |
| winter: wind → cold front → rain | blizzard 35, snowfall 35, cloudy 20, wind 10 |

The longer winter chain takes priority over the shorter one. Entry gates also independently prevent any unrelated row from producing thunderstorm, snowfall or blizzard. Blizzard does not directly become a new snowfall event, because that would violate the user's exact snowfall predecessor rule. It can end into cloudy or windy weather. All coefficients are game estimates; the table deliberately emphasizes storm remnants instead of instant sunshine.

## Fishing and scene effects

Heat waves suppress bright-time shore activity most strongly for pike/muskie/walleye, favor deeper rigs and reduce surface-lure fit; cooler hours remain more productive. Cold fronts modestly suppress activity and favor slow presentations. Snowfall modestly favors winter panfish/walleye relative to other species. Blizzards and hurricane remnants reduce overall bite activity, strengthen wind and obscure the sky; hurricane remnants use heavy rain and blizzards use dense blowing snow and fog behind the foreground. These are illustrative response coefficients, not measured catch-rate changes. Air weather is a proxy and does not instantaneously change an entire lake's water temperature.

The same weather coefficients feed displayed odds, actual species sampling, bite-wait calculations and tackle suggestions. Quality, albino chance and the ten-second typing deadline are unchanged. Weather changes during a challenge do not reroll its fish or reset its input. Catch conditions retain weather and sampled natural-event duration.

Storm lightning uses each natural event's sampled duration: 90-second spacing at the beginning, 30 seconds at its halfway point, then increasing toward 90 seconds, with no flashes during the final quarter. The first 40–85-second cloud/rain buildup remains readable and retains daylight until fog arrives. Manual storm previews retain the previous 15-minute fallback.

Reload/background catch-up advances at saved event boundaries with the saved random seed. Calendar seasons are checked at those boundaries and incompatible events are clipped to New York midnight. Corrupted natural state starts a fresh ordinary event without losing catches, coins or gear. A 10,000-transition recovery cap protects against extremely ancient saves; beyond that it starts a fresh cloudy event.
