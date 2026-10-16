# Lake visitors

Santa and the two insect masters were created with the built-in imagegen tool.
The original transparent masters and exact prompts are in `output/wildlife-sources/`.
`python scripts/assemble-lake-visitors.py` (Pillow) registers the eight wing poses,
exports WebP stills and sheets, and assembles animated GIFs. It also draws the
native water-drop/ripple geometry for the 20-frame fish splash GIF and sheet.
The scene samples the same splash frames from the WebP sheet so pause, reduced
motion, visibility, and the environmental render cadence can control playback.
Assets are local and respect PUBLIC_URL; no runtime third-party requests.

Canada geese use actual transparent, twelve-frame GIF illustrations rather than
the earlier SVG birds. `canada-goose/flight-0.gif`, `flight-4.gif`, and `flight-8.gif`
start at different points in the same 600 ms wingbeat so the flock is staggered.
The master was created with built-in imagegen; its exact prompt is
`output/wildlife-sources/canada-goose-prompt.txt`. Repack with
`python scripts/assemble-canada-goose.py` (Pillow). The packer registers the beak
position and exports 64×64 GIFs and a matching WebP sheet. Distant flocks use
32×32 versions from `canada-goose/far/`, reducing decode and texture memory. Natural rendering displays the GIFs; interval rendering samples the same
frames from the sheet to honor the environmental cadence. Visitors unload when
the scene leaves the viewport or the tab is hidden. Reduced motion omits flocks.

Natural-history references used to design the motion (interpretive game motion,
not a numerical biomechanical simulation):

- Smithsonian: https://howthingsfly.si.edu/ask-an-explainer/how-do-dragonflies-fly
  Hover, dart, and backward flight; independently controlled wing pairs.
- Missouri Department of Conservation:
  https://mdc.mo.gov/discover-nature/field-guide/common-green-darner
  Large, strong patrol flier; green thorax and blue abdomen.
- Missouri Department of Conservation:
  https://mdc.mo.gov/discover-nature/field-guide/ebony-jewelwing
  Short, weak, butterfly-like fluttering flight near waterside vegetation.
- Cornell Lab: https://www.allaboutbirds.org/guide/Canada_Goose/lifehistory
  Migrating flocks in staggered formations. Spring flies left to right and fall
  right to left as requested; screen direction does not represent a compass.
- Fabian et al., Nature Communications (2024):
  https://doi.org/10.1038/s41467-024-44785-3
  Artificial light disrupts dorsal orientation; modeled as uneven orbits and stalls.

Game wingspan ranges: green darner 80–100 mm; ebony jewelwing 58–76 mm. These
provide plausible relative visual scale and are separate from user-entered notes.
Size references: https://ucanr.edu/blog/bug-squad/article/find-green-darner and
https://www.si.edu/object/common-green-darner-green-darner-dragonfly%3Anmnheducation_10003103
(darner); https://edis.ifas.ufl.edu/publication/IN1193/pdf (jewelwing wingspan,
distinct from its 39–57 mm body length).

Santa uses the browser's real local calendar: one stable pseudorandom 90-second
window per December 25, chosen to fit completely inside a natural late-night
game-sky period (00:00–04:00). Preview sky settings also require Late night.
His sky silhouette is packed at no more than 64×28 pixels (`santa-sky.webp`),
drawn into a 64×28 picking canvas, and shares the moon's responsive size cap.
The journal illustration remains separate from the tiny distant sky sprite.
Reloading preserves that year's schedule and elapsed progress. Collecting him
on Christmas stores that year; merely discovering his art in a developer preview
on another date does not consume the upcoming Christmas visit.

Developer tackle box has separate previews. Insect previews need warm-season
daylight and fair weather; geese need spring or autumn. Reduced motion disables
ambient flocks, splashes and insect flight; Santa remains a stationary collectible
only within his late-night scheduled visit window (or an explicit late-night
developer preview).

Geese have one or two deterministic visit windows per 48-minute lake day in spring
and autumn. Weather changes, reopening the scene, or reloading do not reroll the
schedule. Storms may suppress a visit. Preview visits are separate. Each flock has
4–13 birds in a V or a left/right echelon; inverse-distance projection couples
size, crossing speed, height, and optional call volume. Approaching flocks grow,
descend, and accelerate; receding flocks shrink, rise, and slow down. The entire
formation stays within the upper third even on short or narrow screens. Per-bird
skyline samples darken backlit birds further than birds against the mountains;
time and weather exposure apply on top. No per-flock JavaScript animation loop
is used; the existing stepped environmental clock also controls the wing frames.
