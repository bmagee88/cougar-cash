# Lake mist

`engine/lakeFog.ts` gives the lake its own deterministic daily fog roll, separate
from weather selection and the weather transition chain. Spring, summer, and
autumn have an 85% chance of a misty dawn; winter has a 22% chance. These are game
probabilities, not a weather forecast. Reloading or changing weather preserves
that lake day's roll, timing, and thickness.

Mist builds between approximately 02:12 and 05:24, peaks around dawn, then starts
thinning between 05:54 and 06:42. It clears between 09:18 and 11:24. Smooth curves
avoid jumps at the build, peak, and clearing boundaries. Each day also rolls a
peak thickness, from light mist to dense banks; autumn tends toward thicker fog.

Density controls opacity and bank height. As it falls, the banks become shallower
and the distance veil drops faster, revealing the ridges and far shoreline. The
natural surface mist uses less distance haze than the existing fog-weather effect.
The manually selected or natural Fog weather is retained, with its own slowly
varying thickness, and may outlast the dawn mist. The two contributions share one
rendered layer using their maximum density, avoiding doubled fog surfaces.

LakeFog still uses the background's cover crop at both locations and existing
day/night/moon lighting. Its texture children mount only while needed and release
after the natural fade (immediately with interval rendering or reduced motion).
The existing world clock drives the model; no timer, frame loop, download, new
dependency, or save migration is introduced. Ambient drift uses the existing
environment cadence and visibility controls.
