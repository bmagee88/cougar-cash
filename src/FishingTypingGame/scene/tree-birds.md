# Tree birds

`treeMap.ts` records ten recognizable near-shore landscape trees at each location,
plus two foreground birches at Birch Point and the foreground willow at Willow
Cove. Both foreground locations also have a bush perch behind their close trunks
(z .10 at Birch Point, .11 at Willow Cove). These map existing painted shrubs;
they do not add a second piece of bush artwork. Each item has a bottom and top
`{x, y, z}`, plus crown width, optional kind and an artwork frame.
x/y run from 0 to 1 in the painted landscape, before its responsive cover crop;
z is an approximate relative scene distance, with larger values farther away.
It is an art/animation map, not surveyed geographic distance. Seasonal artwork
retains the same tree geometry, so the same location map applies in every season.
Foreground tree routes connect to the distant bank in either direction. Their
endpoints use the actual seated foreground frame, including desktop/mobile crop
and parallax. Where the canopy is cropped, they use the top third of the visible
trunk. Bush coordinates retain their actual position instead of being moved up
to a cropped trunk's visible crown. Reeds are insect perches, not bird destinations.

Every location has two hidden trees behind the viewer, at z = -.14. Their x/y
use a separate viewport frame, with x = -.24 and 1.24, so they remain offscreen
in landscape and portrait crops. They are routing anchors and never draw visible
trees or map markers. The coordinate inspector includes their `hidden: true`,
`frame: viewer`, signed depth and labels. Ordinary scenery and insect depth still
use their existing nonnegative depth system.

Developer tackle box offers **Show tree and plant maps**, an expandable coordinate
listing, **Preview tree bird**, **Preview tree flock**, and **Preview fly past
viewer**. Fly-past previews alternate approaches/returns and left/right trees.
The overlay highlights bushes in green and
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
arrival and despawn. Painted near birds can be clicked/tapped or activated with
the keyboard to unlock their species in the journal's Birds field guide and open
an illustrated notebook draft. Choose Record entry to keep personal notes. The
draft preserves the direction and current wing/glide/braking pose. Each bird can
be collected once per flight, including after hiding and returning to the scene;
collecting one flock member leaves its neighbors flying. Background silhouettes
remain decorative. Fishing phases disable observation as they do for insects,
and foreground branches/angler pixels block pointer collection through them.
Primary pointer presses collect immediately, so the bird cannot move away before
release. A small transparent margin makes tiny moving sprites easier to tap.
Keyboard/assistive clicks use the same guarded handler. Collection only samples
the current CSS pose on interaction; it adds no animation loop or polling timer.
Collected-flight IDs expire with their visits, while discovered species persist
in the existing visitor discoveries and recorded pages preserve validated poses.

`TREE_BIRD_SPECIES` gives cardinals `canFlock: false` and sparrows `canFlock: true`.
Either species can occupy a solo stream; the ten-bird stream selects only a
flock-capable species. Species selection uses an independent seeded value, so
it does not consume route random draws. The expanded perch list changes the
available destinations while preserving the three clocks, flock size, wingbeat
cadence and the existing projection/size curve for positive-depth routes.

Routes involving a foreground trunk, bush or behind-viewer tree use colored
species artwork. All routes
between landscape trees keep the original silhouette sheet and wing animation.
Near/behind-viewer endpoints always pair with a visible landscape tree, rather
than sending invisible flights between two hidden trees. Flocks headed behind
the viewer retain that destination instead of taking a generic sideways exit.

Signed-depth flights follow a calibrated perspective ray toward/away from the
camera. The hidden anchor selects the passing direction. Projection is bounded
near z=0 and fully clipped for z<=0, so birds cannot flip or reappear across the
lake. They grow smoothly up to scale 8 on a camera pass; normal flights retain
the original 3.2 cap. Below z=.03, passing birds draw in front of foreground
artwork and remain collectible without the behind-foreground occlusion test.
Positive-depth tree/bush arrivals still land under their painted crowns.

Each bird samples its existing CSS route plus depth/draw order at 61 points.
The bird containers do not create stacking contexts; lighting is applied to each
bird and the existing parallax is included in its sampled coordinates. This lets
one moving bird pass the foreground without duplicating it in two layers or
adding a JavaScript animation/measurement loop. Behind-camera collection is
rejected even when the hidden route is still scheduled.

The colored sheets have six rows: front, front left, front right, back, back
left and back right. Decreasing depth selects a front view, increasing depth
selects a back view, and the lateral course chooses straight/left/right. That
view remains stable through the bounding arc. Each row contains eight wingbeat
frames, one glide frame and three slowing/landing frames with raised wings,
spread tails and reaching feet. The original bounding cadence alternates flaps
and glides; the final 20% of a tree arrival uses braking poses while the original
eased path slows to its existing perch. Offscreen departures continue cruising.

The near birds use painted, transparent ImageGen artwork matched to the existing
butterflies: a red Northern cardinal and a warm brown, streaked song sparrow.
Eight original 4×3 atlases provide front, front-left, back and back-left views of
each species. Front-right and back-right mirror their corresponding left views.
Originals, exact prompts and provenance remain in `output/painted-tree-birds-v2`.
`python scripts/pack-painted-tree-birds.py` extracts complete connected cutouts
(even when wing tips cross a grid boundary), anchors each torso, removes detached
alpha noise and packs the images without redrawing them. Add `--check` to validate.

`public/assets/fishing/visitors/tree-birds/{cardinal,sparrow}/` contains a full
flight GIF for each of the six directions, plus separate `-wingbeat.gif`,
`-glide.gif` and `-slowdown.gif` exports. All 48 GIFs are 192×192, transparent and
looping. Wingbeats have eight 50 ms poses; glide exports gently bank the level
pose; slowing exports have three progressively spread-wing, tail-fanned poses
with reaching feet. Full flight exports show two wingbeat cycles, a held glide,
then slowing to land. Shared GIF palettes and cleared-frame disposal prevent
palette flicker and trails from the previous wing position.

The game samples those same painted poses from 128×128-frame WebP sheets to keep
wingbeats, glides and braking synchronized to the existing route and pause logic.
It does not run independent GIF playback on every flock member. Each sheet is
1536×768 (72 poses); cardinal is 221,032 bytes, sparrow 228,594 bytes, with about
4.5 MiB of decoded pixels per species. Only close flights reference these sheets.
The original small SVG silhouette and its pixel rendering stay on far routes.
Distant birds stay around 2–12 pixels; nearby birds grow smoothly up to about
29 pixels approaching foreground trunks, with the existing upper size cap.
Painted birds use smooth image resampling. Day/weather lighting shades both
kinds. Normal flights stay below foreground art and lake fog, so branches and
mist naturally obscure them; camera-passing birds move in front as described above.

One sleeping timeout services all three schedules and departure cleanup. Travel
and wing animation use CSS and the existing environment cadence, without another
requestAnimationFrame loop. Hidden/offscreen flights unload and release the timer;
returning resumes only current flights at their elapsed position. Reduced motion
omits them. Natural schedules allow at most two solos and one ten-bird flock.
Preview flights are separate and do not consume or shift those schedules.
Colored wingbeats, glides and braking use the same elapsed-time delays, remain
outside sampled background animation seeking, and pause with the existing scene
visibility class. There are no additional scheduling timers or JavaScript flight
loops. Targeted checks cover species eligibility, all 144 directional poses,
near/far art selection, route retention, visibility, timer disposal and reduced
motion.

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
