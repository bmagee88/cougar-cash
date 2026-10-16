# Low sun and Sailor’s Delight

Visual references inspected on October 16, 2026:

- [Yellow sunrise over a lake and mountain ridge, Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Yellow_sunrise.JPG): nearly white core, yellow forward-scattered glow, and a darker backlit ridge.
- [Met Office sunset photograph and explanation](https://weather.metoffice.gov.uk/learn-about/weather/optical-effects/why-is-the-sky-blue): amber light around a low sun, orange-red clouds, and silhouettes. Longer atmospheric paths preferentially scatter the shorter wavelengths out of the direct beam.
- [Randall J. Hodges, Sparks Lake sunset photograph](https://www.randalljhodges.com/photo/m407-crazy-cloud-sunset-sparks-lake-oregon/): localized orange-red cloud illumination against cooler surrounding sky and dark foreground ridges.
- [NOAA GML, Red Sky](https://gml.noaa.gov/grad/about/redsky/): the atmospheric optics and the regional limits of the sailor’s-delight weather proverb. The game event is an artistic sky occurrence, not a weather prediction.

The sun's clearance is measured against the painted skyline after the same responsive cover crop used by the lake. Its halo peaks at the ridge crossing and fades as it climbs; sunrise uses pale yellow and sunset uses amber. A separate shadow pass follows the sun across the existing land alpha mask and fades out above the water, preserving the lake and foreground exposure.

Sailor’s Delight is an independent, deterministic 18% roll per 48-minute game day. It runs from late afternoon into dusk (roughly 16:10–19:15 in game time), with smooth onset and afterglow. The event neither selects nor overrides weather, aurora, or meteors. Existing cloud artwork is recolored through an alpha-preserving SVG filter in the direction of the setting sun; cloud motion and texture are retained. Dense weather can occlude the optical effect without changing the event schedule.

No additional animation loop, cloud bitmap, or timer is introduced. Geometry is observed on resize, sunlight follows the existing world clock/render setting, and the cloud filter unmounts outside the event window. The developer tackle box has sunrise, sunset, and cloud-afterglow time previews plus an independent Sailor’s Delight control.
