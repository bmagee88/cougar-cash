# Feeding model and research

Research checked October 12, 2026. The game represents a fictional connected Great Lakes freshwater lake. The eight species use literature-informed **relative encounter weights**, not measured probabilities that a wild fish will feed. The numerical coefficients in `feeding.ts` are authored game estimates. None of these sources publishes the complete four-season × six-period × eight-moon-phase table requested for all eight species.

## Evidence used

| Species | Evidence | Game interpretation and limits |
|---|---|---|
| Bluegill | [Minnesota DNR sunfish guidance](https://www.dnr.state.mn.us/gofishing/how-catch-sunfish.html) recommends early and late daylight in spring/summer and warmer autumn afternoons. | Higher daylight activity; autumn midday emphasis. Winter and night coefficients are conservative estimates. |
| Yellow perch | [Michigan DNR species profile](https://www.michigan.gov/dnr/education/michigan-species/fish-species/yellow-perch) describes daytime feeding, morning/evening shore activity, and reduced night feeding. [Wisconsin DNR winter guidance](https://dnr.wisconsin.gov/topic/Fishing/outreach/hookyourcatch.html) includes winter perch fishing. | Daylight preference; active winter profile. Summer midday reduction is a game estimate. |
| Black crappie | [Minnesota DNR crappie guidance](https://www.dnr.state.mn.us/gofishing/how-catch-crappie.html) describes spring shore fishing and later dawn/dusk activity. Wisconsin DNR includes winter crappie. | Strong spring and twilight weights; winter remains productive. Night and detailed seasonal coefficients are estimates. |
| Largemouth bass | [Minnesota DNR bass guidance](https://www.dnr.state.mn.us/gofishing/how-catch-largemouth-bass.html) describes morning/evening shallows and spring/fall activity. [Hanson et al. 2008 telemetry](https://doi.org/10.1111/j.1365-2400.2008.00634.x) found seasonal movement differences and no repeatable lunar relationship. | Morning/dusk and spring/fall emphasis, lower winter activity. Movement is a proxy, not a direct feeding measurement. Neutral lunar weights. |
| Walleye | [Minnesota DNR walleye guidance](https://www.dnr.state.mn.us/gofishing/how-catch-walleye.html) supports low-light feeding. [2021 lunar catch study](https://doi.org/10.1371/journal.pone.0257882) found comparatively small phase effects, with greater trip success around gibbous phases. | Dawn/dusk/night preference. Small gibbous bonuses; no claim that study catch success measures feeding probability. Night phase coefficients remain estimates. |
| Northern pike | [Minnesota DNR pike guidance](https://www.dnr.state.mn.us/gofishing/how-catch-northern-pike.html) supports early/late daylight fishing. [Seasonal and diel telemetry](https://pure.au.dk/portal/en/publications/seasonal-and-diel-effects-on-the-activity-of-northern-pike-studie/) supports day activity and winter activity. [Kuparinen et al. 2010](https://www.agrar.hu-berlin.de/de/institut/departments/dntw/jp_bfm/publ_html/kuparinen-et-al-2010) associates catch rates with lunar phase under controlled fishing. | Daylight and cool-season weighting, modest full/new bonuses. Results are habitat- and effort-dependent, not universal feeding percentages. |
| Muskellunge | [Minnesota DNR muskellunge guidance](https://www.dnr.state.mn.us/gofishing/how-catch-muskellunge.html) emphasizes seasonal and light conditions. [Vinson & Angradi 2014](https://doi.org/10.1371/journal.pone.0098046) analyzed reported catches with a stronger full-moon night association. [2021 study](https://doi.org/10.1371/journal.pone.0257882) also examined lunar catch associations. | Summer/autumn, dawn/dusk and cool-season afternoon emphasis. Small daylight full/new bonuses and a capped full-moon night bonus. Fishing effort confounds causal interpretation. |
| Lake sturgeon | [Kough et al. 2018](https://doi.org/10.1016/j.jglr.2017.10.008) documents nocturnal adult movement in a small tag sample. [Peterson et al. 2007 ecology review](https://doi.org/10.1007/s11160-006-9018-6) discusses feeding and seasonal ecology. | Night emphasis and slower winter feeding are estimates informed by ecology and movement. [Lunar spawning cues](https://doi.org/10.1111/j.1095-8649.2012.03308.x) are not treated as feeding evidence; neutral lunar weights. |

## Calculating encounter odds

For each species: `base population weight × season/time activity × moon multiplier`. Normalize all eight weights to sum to 100%. The same function generates fish and displays current odds in **What’s biting?**. Quality, albino status, and WPM adjustment remain independent. All weights are positive, so every species stays possible in every condition. Both fishing spots share this model.

The exact four-season/six-period activity arrays are in `feeding.ts`. The in-game activity table exposes all six periods for any selected season and moon phase. Exploring the guide does not change the actual clock or conditions.

Lunar multipliers, ordered full → ¾ waning → ½ waning → ¼ waning → new → ¼ waxing → ½ waxing → ¾ waxing:

| Species | Multipliers |
|---|---|
| Walleye | 1.02, 1.08, 0.97, 1.00, 1.02, 1.00, 0.97, 1.08 |
| Pike | 1.08, 1.04, 1.00, 1.04, 1.08, 1.04, 1.00, 1.04 |
| Muskellunge, daylight | 1.05, 1.025, 1.00, 1.025, 1.05, 1.025, 1.00, 1.025 |
| Muskellunge, night | 1.20, 1.10, 1.00, 1.00, 1.03, 1.00, 1.00, 1.10 |
| Bluegill, perch, crappie, bass, sturgeon | 1.00 at every phase |

Neutral moon weights are intentional where research does not justify a feeding relationship. Moonlight also gently brightens the scene. Weather and tackle now contribute separate game estimates to encounter weights and bite waiting time; see [tackle-research.md](tackle-research.md) for the sources, assumptions and formula.

## Clock conventions

One lake day is 48 real minutes. Periods are eight real minutes each: late night 00:00–04:00, dawn 04:00–08:00, morning 08:00–12:00, afternoon 12:00–16:00, dusk 16:00–20:00, early night 20:00–24:00. The moon advances one phase at each game-day boundary, completing eight phases in 384 minutes. These are stylized gameplay periods and sky arcs, not astronomical predictions.

Real calendar dates rotate spring → summer → autumn → winter at America/New_York midnight, using October 10, 2026 as the spring anchor. October 12 therefore retains the existing autumn scene. The absolute clock survives reloads and background tabs; real calendar-day arithmetic handles daylight saving changes. Encounter conditions are recorded at bite and remain fixed for the challenge, even as scene lighting continues to change.

## Difficulty replacement

Every challenge samples an integer adjustment from a split Gaussian bell: mode 0, left endpoint −50, right endpoint +10. Each side uses a width of one third of its endpoint distance, so both tails taper at three standard deviations. Final WPM is `max(1, rarity base + quality bonus + albino bonus + adjustment)`. The long easier side gives more total probability to reductions; zero is the most likely single adjustment. The former separate lucky roll and ordinary random deviation are removed. The maximum reduction is 50 even for the most difficult fish.

