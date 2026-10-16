# Lake night sky

The scene projects real J2000 star coordinates into local altitude/azimuth
for a fictional south-facing Great Lakes shore at 45 degrees north. Stars
rise on the left, follow curved tracks, and set on the right, consistent with
the existing illustrated Sun/Moon arc. The northern celestial pole is behind
this view, so Polaris does not appear in this south-facing sky. Stars below
the horizon are culled and those low in the sky fade. Magnitude controls point
size/visibility and B-V gives restrained warm/cool star colors. Moonlight
reduces the visibility of faint stars. The new moon has no visible disc.

The sidereal angle advances **360.985647 degrees per solar game day**. The
Moon's mean westward sweep is **347.809289 degrees per solar game day**:
Earth's spin minus its roughly 13.176-degree daily orbital drift. Both move
in the same apparent direction; the stars move faster. The 48-minute clock
compresses this motion. The illustrated lunar arc remains centered on
midnight with the game's existing eight-phase cycle. This preserves game
lighting and is not a full lunar ephemeris. Atmospheric refraction, precession
and a real-date sky at the player's location are not simulated.

Aurora and meteor showers have independent deterministic schedules. Each
observing night rolls a 7% aurora chance and a separate 14% shower chance.
Aurora starts between 20:00 and 23:00, showers between 21:00 and midnight;
each lasts four to seven game hours. The observing night keeps its identity
through midnight. Reloading does not reroll it. Both can overlap. These are
game event probabilities, not a space-weather forecast or an annual calendar
of named showers. Each shower uses one rotating celestial radiant: every
streak travels outward from it. They are occasional short streaks, not star
trails. Strong auroral curtains use mostly green oxygen emission with a
fainter reddish upper edge. At this latitude and south-facing view these
represent rare displays extending high across the sky.

These events are separate SVG layers and do not belong to the weather enum.
They remain scheduled during every weather, while the cloud layer and fog
obscure them naturally. Both sky layers sit behind clouds and terrain. They
do not illuminate the entire lake or add fictional nebulae.

The 85.6 KB local star catalog fetches only on a night mount, using the
browser's HTTP cache. The request aborts on unmount and the catalog/circle
nodes are released after the daylight fade. Only stars above the horizon
within the painted sky frame have SVG nodes. There is no new animation-frame
or timer loop: the existing world
clock sets coordinates, CSS interpolates ordinary one-second samples, and
the existing timed-render setting pauses/seeks ambient event timelines.
Hidden/offscreen scene animations pause. Reduced motion removes meteor
streaks and keeps the aurora still. Development controls offer independent
Automatic/Active/Off previews for each event.

## References

- [NASA: sidereal rotation](https://www.grc.nasa.gov/WWW/k-12/Numbers/Math/Mathematical_Thinking/telling_time_by_the_stars.htm)
- [NASA: Moon motion and later moonrise](https://science.nasa.gov/skywatching/faq/)
- [NASA: Perseid meteors and the radiant](https://science.nasa.gov/solar-system/meteors-meteorites/perseids/)
- [NOAA: auroral gases and colors](https://www.nesdis.noaa.gov/about/k-12-education/optical-phenomena/what-aurora)
- [Star catalog source, coordinates and license](https://github.com/ofrohn/d3-celestial)

## Validation

All 190 fishing tests passed across 27 suites, including catalog validity,
sidereal continuity, relative star/Moon rates, independent overlapping events,
every weather combination, common-radiant trails, lazy loading/cancellation
and sampled animation timelines. The production build passed with `CI=true`
and `GENERATE_SOURCEMAP=false`; the copied catalog, license and sky styles
were verified in the build output. Browser checks covered the normal desktop
viewport and a 390 x 844 phone viewport, both events together during wind,
proper occlusion behind clouds/terrain, no horizontal overflow and advancing
live star/Moon positions. No browser errors were reported. The original live
conditions and viewport were restored after previewing.
