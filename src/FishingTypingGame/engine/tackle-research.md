# Lure and condition model

Research checked October 13, 2026. Cedar Lake is a fictional temperate freshwater lake with assumed clear water and an unfrozen winter fishing area. Species feeding sources and lunar evidence are in [feeding-research.md](feeding-research.md). Seasonal temperature and depth are proxies; the game does not measure temperature, turbidity, pressure, habitat or moonrise.

## Supported starting presentations

| Species | Lure / bait and presentation | Primary source |
| --- | --- | --- |
| Bluegill | Small worm pieces beneath a float, tiny jigs or spinners; shallow in spring, deeper in summer | [Minnesota DNR](https://www.dnr.state.mn.us/gofishing/how-catch-sunfish.html) |
| Yellow perch | Worm pieces, small jigs and small spinners; gentle lifts for cold-water presentations | [MinnAqua species profile](https://www.dnr.state.mn.us/minnaqua/speciesprofile/yellowperch.html), [DNR winter perch guide](https://www.dnr.state.mn.us/gofishing/ice-fishing-perch.html) |
| Black crappie | Small live minnow beneath a float; 1/32–1/8 oz plastic jigs, slowly retrieved with occasional lifts; suspended near cover | [Minnesota DNR](https://www.dnr.state.mn.us/gofishing/how-catch-crappie.html), [winter crappie guide](https://www.dnr.state.mn.us/gofishing/ice-fishing-crappie.html) |
| Largemouth bass | Plastic worms with weedless hooks, jigs, spinners and surface lures; surface action particularly around morning and dusk | [Minnesota DNR](https://www.dnr.state.mn.us/gofishing/how-catch-largemouth-bass.html) |
| Walleye | Spring minnow-tipped 1/8–3/8 oz jigs; summer slip-sinker crawler/minnow; autumn baitfish crankbaits; slip floats above structure | [Minnesota DNR](https://www.dnr.state.mn.us/gofishing/how-catch-walleye.html) |
| Northern pike | Perch-like prey imitations and injured-minnow jerkbaits, with a tooth-resistant leader; primarily daylight | [Minnesota DNR](https://www.dnr.state.mn.us/gofishing/how-catch-northern-pike.html) |
| Muskellunge | Large bucktails, spinners and diving crankbaits, commonly 5–10 inches or longer; heavy leader and finishing figure eight; larger autumn prey | [Minnesota DNR](https://www.dnr.state.mn.us/gofishing/how-catch-muskellunge.html) |
| Lake sturgeon | Fresh nightcrawlers presented on bottom; lure paint has no sturgeon bonus | [Wisconsin DNR 2026 report, Lower Red Cedar River section](https://dnr.wisconsin.gov/topic/Fishing/outreach/wifishingreport) |

The catalog separates live bait from artificial lures. Live bait has its natural color. Size is described with each lure; worm presentation uses small pieces for panfish and whole crawlers / a fresh bundle on a bottom rig for larger bottom feeders. The choices are shore presentations: boat trolling is not offered. Incompatible combinations are prevented, including a motionless cast jighead, a dragging shallow float, and a Texas-rigged crankbait. Tooth-resistant leaders are compulsory for the dedicated large muskie lures and available on smaller predator lures. The model does not simulate line breakage from leader selection.

## Environmental interpretation

| Condition | Starting approach used in the game | Evidence / confidence |
| --- | --- | --- |
| Spring | Shallow float or small jig; minnow jig for walleye; restrained cadence | DNR seasonal shore and jig guidance; exact multipliers estimated |
| Summer bright daytime | Adjustable deeper float, bottom rig or weighted plastic; moving prey for active predators | DNR depth guidance; no exact water-temperature measurement |
| Summer morning / dusk | Surface popper for bass in quieter water, baitfish presentations for predators | DNR bass and feeding guides |
| Autumn | Baitfish crankbait for walleye; larger baitfish profile for muskie; moderate or slow cadence | DNR walleye and muskie guides |
| Winter | Gentle jig lifts, slow bottom movement, slow rolling, longer jerkbait pauses; surface poppers strongly penalized | DNR winter guides; [Rapala's first-hand pro guidance](https://blog.rapala.com/tips/rapala-pros-provide-cool-tips-for-best-cold-water-baits/) |
| Bright light | Natural perch, silver/pearl or green pumpkin as appropriate to lure shape | [Berkley softbait guidance](https://berkleyfishing.eu/pages/sick-softbaits); rule of thumb |
| Dim light / clouds / fog | Modest black silhouette or chartreuse/white contrast preference; moving blades get a small cloudy/windy bonus | Manufacturer guidance; exact bonuses and weather transfer to other species are game inferences |
| Rain | Dimmer light, modest predator effect; clarity stays clear | No assumed immediate muddy-water or universal rain feeding boost |
| Thunderstorm | Daylight thunderhead buildup, then cloud-limited light; conservative reduction during heavy storm | Entire storm bite response is a balance estimate, not measured biology |
| Moon | Existing small species activity effects; moon illumination only affects artificial color visibility at night and is reduced by clouds | Existing lunar studies; visibility coefficients estimated; no moon-specific universal lure |

Color is a secondary modifier (mostly 0.94–1.18), not a guaranteed solution. [Berkley's color discussion](https://www.berkley-fishing.com/blogs/news/do-bass-have-a-favorite-color) emphasizes that vision and context matter and no universal favorite has been established. No primary source supplies a validated “best lure” table for every combination requested. No exact catch probabilities are claimed.

## Transparent game calculation

`species weight = baseline abundance × seasonal/time feeding × supported moon activity × weather × lure affinity × rig × retrieve × color × presentation season factor`.

The eight resulting weights are normalized for the fish roll and for the displayed encounter odds. All remain positive, including deliberately very unlikely incidental catches on unsuitable tackle. Quality, albino status and typing difficulty retain their independent rolls.

The sum of unnormalized weights drives bite rate. `rate = clamp(sqrt(sum / 100), 0.4, 1.65)`. The real-time wait range starts with rounded `[5 / rate, 10 / rate]` seconds and is multiplied by two globally, by another two in winter, and by 0.75 for spring fast-moving-lure presentations. Typical nonwinter bounds are 6–50 seconds before the spring reduction; winter bounds are 12–100 seconds. A uniform random wait is drawn inside that range after the 0.85-second cast. Scarce predator targeting can take longer even with good gear. Matching tackle to the conditions improves both the relative target odds and the wait compared with the same lure presented poorly. All numerical coefficients are balance estimates.

Wait and tackle are fixed at cast. Actual world/weather conditions are sampled at bite, allowing a clock boundary or storm ending to affect the next fish without resetting the wait or typing. The setup and bite conditions are copied to the encounter and saved with the catch. Reload restores the selected gear and existing catches; legacy catches have no invented setup.

Recommendations enumerate valid type/color/rig/retrieve combinations and rank their presentation score for the chosen species in the current conditions, then offer three distinct lure types. They do not force that species or change the clock/weather. The live forecast uses exactly the same engine weights as the actual roll.

Interactive mode uses observed keyboard rhythm in place of the selected retrieve for actual contact rolls. See [interactive rules](interactive-research.md) for the action mapping, candidate promotion, nibble logic and distance-scaled battle. The static pre-cast forecast assumes the selected presentation.
