# Night-sky star data

`stars.json` contains 2,851 stars to visual magnitude 5.5, reduced from
Olaf Frohn's d3-celestial `data/stars.6.json`:
https://github.com/ofrohn/d3-celestial/blob/master/data/stars.6.json

Upstream identifies the source as **XHIP: An Extended Hipparcos Compilation**,
Anderson & Francis (2012), VizieR V/137D. Coordinates are J2000 equatorial
coordinates. Each tuple is `[rightAscensionDegrees, declinationDegrees,
visualMagnitude, bvColorIndex]`. Negative RA wraps through 360 degrees.
The game retains these measurements and strips GeoJSON metadata; it does not
invent star positions. Faint stars beyond magnitude 5.5 are omitted.

Data snapshot retrieved October 15, 2026. The upstream source SHA-256 was
`0297b8fa3adfbce1dc26566f61c4abcc1df4f29c6a28729ca06b56d1c6d25602`. The derived file is 85,599 bytes. The upstream BSD license is
preserved in `LICENSE-d3-celestial.txt` and ships beside the data.
