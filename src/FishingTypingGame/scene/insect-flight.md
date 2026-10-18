# Insect flight and plant destinations

The flight behaviors are game interpretations of the references below, with
individual variation; their timing is tuned for observing and clicking insects,
not a claim to reproduce measured wingbeats or exact species aerodynamics.

## Behavior

- Monarchs and swallowtails use broad, gently steered flap-and-glide flights.
  Two superimposed vertical waves give powered flight its floating rise and dip;
  gliding holds the wings and gently loses height. Smaller butterflies flutter
  more tightly; the skipper makes quicker changes. Body turns ease into each
  new course instead of changing direction instantaneously.
- The hummingbird clearwing can hover at flower anchors with its wings moving.
  Non-feeding adult moths use foliage for rest rather than nectar destinations.
- The green darner makes longer patrols, hovers, darts and short backward
  corrections. Mapped stems provide rest stops, followed by hunting loops and
  two returns to the same home. This return cadence is an artistic choice:
  strict favorite-perch hunting is especially characteristic of other groups
  such as skimmers and darters, while darners are strong patrol fliers.
- Ebony jewelwings make smaller, slower fluttering trips near leaves and stems.
  They fold their wings when resting; the darner rests with wings spread.
- Approaches brake near their destination. Butterflies can then visit another
  compatible plant. A scare cancels a planned return and takes priority over
  feeding, landing and patrol behavior.
- An occupied flower can cause a visitor to wait nearby for 2.2–4 seconds. If
  the resident leaves, the approach resumes; otherwise the waiting insect
  chooses another plant. In 35% of encounters the resident is displaced and
  curves away toward another perch. A shared scene registry prevents double
  landings across butterfly and dragonfly/damselfly visitors.
- Cursor escapes retain each group's steering rhythm, vertical waves and
  wingbeats. Their course bends around an away bearing, with broad butterfly
  curves, dragonfly darts and gentler damselfly flutter.

`plantMap.ts` keeps painted leaf anchors per location, each with an ID, visual label,
artwork layer, source-art x/y, relative depth z and compatible visitor groups.
Names describe the painted habitat rather than assert a botanical identity.
Projection reads the actual responsive cutout rectangle, handles the desktop
split reeds, and excludes hidden or cropped-out anchors. Resize updates both
the map and active plant destinations. The developer's **Show tree and plant
maps** checkbox displays the visible anchors; **Inspect plant map** shows the
complete source coordinates.

`ShorePlants` adds small cattail, rush and sedge/twig cutouts in each shore's
own coordinate frame. Traced tip and leaf pixels provide dedicated dragonfly
or damselfly perches; both groups may also use actual flower heads and leaves.
Estimated scenery stem points are retired. Resting sprites rotate around a
painted foot-contact pixel, and cached projection follows the existing camera
drift without per-frame geometry reads. Reed occupancy is shared across visitors.
Three floating-plant layers hold fixed, seeded five-pad groups near the bank.
Their foliage matures with the season; ordinary perennials retain autumn leaves
in winter. Subtle CSS water movement is independent of weather and growth.

`plantLifecycle.ts` lazily reconstructs the visited location from its persistent
world seed and date. Species, roots and five stem slots stay fixed for the
spring-to-winter cycle. Each stem advances independently through stem, bud,
bloom, seed and withering; removal releases only that stem's perch. The next
spring resets all foliage and stems. Foliage and stage artwork are rendered
separately, with loaded opaque contacts traced in `data/plant-art-v1.json`.
Perspective, species height, root-centered rotation and mirroring are applied
to both artwork and map points. Layout, stage changes and image loads refresh
destinations; removed anchors release their insects. Only blooms offer nectar.
See `plant-lifecycle.md` for exact seed, calendar, winter, artwork and cache rules.

The movement retains the doubled flight volume, side entrances/exits, depth
scaling, water/horizon floor, reversible foreground depth crossing and individual
pointer tolerances. It uses the existing capped visitor RAF loop. Plant geometry
is read on layout, image load, scroll and resize, never on every animation frame.
Hidden/offscreen scenes pause; timers, observers and listeners are released.

All fourteen butterfly/moth species have eight-pose side-view GIFs,
full-alpha WebP sheets and individual pose stills at 96 × 112 pixels per frame.
The game loads these only for
visitors that use them and samples the same canvas for painting and pixel picking.
Glides use the level-wing pose. Notebook captures persist the side-view flag,
frame, angle and facing; older journal entries retain their original artwork.
The bounded sprite cache holds at most six source sheets, including directional
dragonfly views. See `scene-depth.md` for shared perspective and distance units.

Art was generated with the built-in imagegen tool. The first two species'
original atlases and prompts are in `output/insect-flight-art/`. The remaining
twelve species and the earlier foliage atlases, with exact prompts, are in
`output/garden-art/`. Repack the small side sprites with
`scripts/pack-garden-art.py`; it reuses the first two species' original frames.
The current individual plant cutouts use `scripts/pack-plant-lifecycle.py` and
live in `public/assets/fishing/plants/v1/`. Exact species prompts and original
atlases are in `output/plant-lifecycle-art/`; earlier plant assets are preserved.

## Research references

- Johansson & Henningsson (2021), *Butterflies fly using efficient propulsive clap
  mechanism owing to flexible wings*, Journal of the Royal Society Interface.
  Free-flight measurements distinguish forward thrust at the upstroke/clap
  from weight support on the downstroke:
  https://lup.lub.lu.se/record/39de965f-ff1e-48d2-9c95-a4478340a8d0
- Le Roy et al. (2021), *Adaptive evolution of flight in Morpho butterflies*,
  Science. High-speed field observations and aerodynamic models examine
  flap-gliding and differences in glide efficiency:
  https://edepot.wur.nl/559137
- Missouri Department of Conservation, *Dragonflies*. Includes a photographed
  common green darner on a dried stalk and descriptions of perching and patrol:
  https://mdc.mo.gov/discover-nature/field-guide/dragonflies
- Maryland DNR, *Common Dragonflies in Maryland*. Specifically describes slaty
  skimmers making short patrols and returning to a favored perch:
  https://dnr.maryland.gov/wildlife/Pages/habitat/wadragonflies.aspx
- Worthen (2023), *Differences in perch height and response to intruders for
  territorial and non-territorial Calopteryx maculata*, International Journal of
  Odonatology. Site fidelity and lower vegetation perches in territorial males:
  https://www.worlddragonfly.org/article/tijo20-v026-a17worthen
- UF/IFAS, *Ebony Jewelwing*. Leaf/branch resting, folded wings and fluttering
  flight, with dorsal and lateral photographic references:
  https://ask.ifas.ufl.edu/publication/IN1193
- British Dragonfly Society, identification guidance on strong direct dragonfly
  flight versus fluttering damselflies:
  https://british-dragonflies.org.uk/recording/bds-recording-scheme/
