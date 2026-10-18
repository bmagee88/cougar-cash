# Manual dragonfly preview

In development, open **Developer tackle box → Spawn controlled dragonfly**.
Spawning again resets the single manual visitor. It is available in all seasons
and weather, including when natural dragonflies are inactive.

- Arrow keys move across the scene; diagonal movement has the same total speed.
- At Z 0, each axis covers two scene spans per second (roughly half a second
  from edge to edge), independent of screen resolution. The existing depth
  slowdown still applies. R/F starts at .066 depth units per second (30% of
  the previous .22) and slows
  progressively beyond the foreground. Shift+R/F gives 1% fine depth control.
- R increases depth, shrinking and projecting toward the far shoreline;
  F reverses that projection, moving closer and growing larger.
- Escape or **Remove dragonfly** removes it and releases keyboard listeners.
- A green glow identifies the manual visitor. Foreground art covers the glow
  and sprite when it flies behind the shore, plants, dock or angler.
- Movement stays inside the scene. Normalized depth runs from 0 (near) to
  1 (far shore); the preview stops at .98 to avoid automatic visitor retirement.
- Arrow movement slows strongly with depth. The bottom edge follows the water
  surface, from the screen bottom nearby to the far shoreline in the distance.
- R/F stops .001 before a solid foreground crossing, from either direction.
  Use the arrows to steer around it; transparent parts of a cutout stay open.
- The readout displays projected X/Y and distance Z in the same 0–1 range.
- The displayed Angler Z is the location's measured boot/ground reference. At this depth,
  the lower water boundary stays level with his feet when steering sideways.
  The boundary, projected movement and sprite size share that calibration.

Both wild odonate species and the manual preview render at half their previous
width and height, preserving their relative sizes and depth perspective.

The preview shares the wild green darner's sprite loader, canvas renderer,
perspective scale and vector-based front/rear/left/right selection. Deliberate
manual input selects a direction immediately, while idle retains the last view.
No assets are regenerated. The preview cannot perch, flee or award discoveries.

Typing fields keep their keys. Held controls clear on window blur or document
visibility changes. The frame loop stops when hidden or removed; reduced-motion
mode keeps the wing pose still while allowing deliberate movement. Scene size
is measured only on resize, and the depth readout changes only when necessary.

See `scene-depth.md` for camera conventions, reference material and depth
validation. Preview tests also cover typing protection, blur/key release,
removal and respawning. No keyboard listener remains after removal.
