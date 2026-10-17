# Distant tree birds

`treeMap.ts` records ten recognizable near-shore landscape trees at each location,
plus two foreground birches at Birch Point and the foreground willow at Willow
Cove. Each has a bottom and top `{x, y, z}`, plus crown width and an artwork frame.
x/y run from 0 to 1 in the painted landscape, before its responsive cover crop;
z is an approximate relative scene distance, with larger values farther away.
It is an art/animation map, not surveyed geographic distance. Seasonal artwork
retains the same tree geometry, so the same location map applies in every season.
Foreground tree routes connect to the distant bank in either direction. Their
endpoints use the actual seated foreground frame, including desktop/mobile crop
and parallax. Where the canopy is cropped, they use the top third of the visible
trunk. Reeds are insect perches, not bird destinations.

Developer tackle box offers **Show tree and plant maps**, an expandable coordinate
listing, **Preview tree bird**, and **Preview tree flock**. The overlay highlights
each tree's upper third and marks its top/bottom; only developers see these tools.
Perches vary within 10–30% down from the canopy top and stay inside crown width.

Two independent solo clocks use 10–30 game-minute departure gaps. A game minute
is two real seconds at the current 48-minute day, so each clock produces a bird
every 20–60 real seconds. A third clock releases exactly ten birds every 24–48
real minutes. Absolute seeded jitter makes these schedules stable across reloads,
weather changes, and visibility changes. Gaps vary around their midpoint, with
no missed-flight backlog. Each location has its own schedule and source trees.

Solos travel between different trees. Flocks leave one tree in a loose, staggered
group, then land at another tree or exit the frame. Routes use perspective
interpolation of x/y/z, a broad lift-and-settle arc, and smaller rise/dip bounds.
Depth controls projected size. Small variations in timing, arcs, and wing phase
keep the flock from looking like a repeated row. Birds fade into the crown on
arrival and despawn. They are decorative, distant silhouettes, not collectibles.

The 1 KB local SVG sheet contains eight poses drawn on 16×16 grids with crisp
edges. Distant birds stay around 2–12 pixels; nearby birds grow smoothly up to
about 29 pixels while approaching foreground trunks, with a fixed upper size cap;
there are no high-resolution textures, animated GIF decoders, or outside downloads.
CSS alternates rapid flap poses and tucked-wing bounds. Day/weather lighting and
fog shade the birds. Their layer is below all foreground artwork and below lake
fog, so branches and mist naturally obscure them.

One sleeping timeout services all three schedules and departure cleanup. Travel
and wing animation use CSS and the existing environment cadence, without another
requestAnimationFrame loop. Hidden/offscreen flights unload and release the timer;
returning resumes only current flights at their elapsed position. Reduced motion
omits them. Natural schedules allow at most two solos and one ten-bird flock.
Preview flights are separate and do not consume or shift those schedules.

## References

- Cornell Lab, American Goldfinch behavior:
  https://www.allaboutbirds.org/guide/American_Goldfinch/lifehistory
  Describes the characteristic bouncy flight of small finches.
- Cornell Chronicle, small-bird flight (2024):
  https://news.cornell.edu/stories/2024/05/wing-skeleton-evolution-may-be-less-restricted-small-birds
  Describes flapping followed by travel with folded wings in bounding flight.
- Rayner, *Bounding and undulating flight in birds*, Journal of Theoretical Biology (1985):
  https://doi.org/10.1016/S0022-5193(85)80164-8
  Distinguishes flapping bursts, folded-wing bounds, and flap-gliding phases.

The game interprets these behaviors with readable small-scale motion, rather than
modeling one species' precise aerodynamics. Reference photographs informed loose
group spacing; no third-party photography or silhouettes were copied into assets.
