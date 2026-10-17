# Birch Point asset generation prompts

Generated with the built-in `image_gen` tool. The approved reference is `reference-v1.png` in this folder. PNG masters are in `public/assets/fishing/locations/birch-point`; WebP runtime copies are under `public/assets/fishing/optimized/locations/birch-point`.

## shared/sky-painted.png

Edit target: the approved reference. Transparent background: false.

```text
Edit the approved Birch Point environment reference into ONE precisely registered game layer. Preserve the original full 1774×887 canvas and 2:1 aspect ratio; never crop, zoom, recenter, rescale, move the camera, add labels or add scenery. The far land/water contact stays at y=50% of the canvas. Retain the same painted style, positions, contours, detail scale, neutral daylight and autumn palette. This is an aligned layer extraction for recomposition over the other layers, not a new composition. No sun, moon, stars, fog, rain, wildlife, UI or text.

Keep ONLY clean pale blue daylight sky with a subtle warm horizon gradient, expanded seamlessly across the ENTIRE opaque canvas. Remove the birches, foreground, all land, trees, mountains, water, reflections and the faint cloud streaks. Fill all removed areas with sky. No clouds: the game supplies moving cloud layers. Every pixel must be opaque.
```

## autumn/mountains-painted.png

Edit target: the approved reference. Transparent background: true.

```text
Edit the approved Birch Point environment reference into ONE precisely registered game layer. Preserve the original full 1774×887 canvas and 2:1 aspect ratio; never crop, zoom, recenter, rescale, move the camera, add labels or add scenery. The far land/water contact stays at y=50% of the canvas. Retain the same painted style, positions, contours, detail scale, neutral daylight and autumn palette. This is an aligned layer extraction for recomposition over the other layers, not a new composition. No sun, moon, stars, fog, rain, wildlife, UI or text.

Keep ONLY the mountain ranges and their distant wooded slopes in their exact original positions between roughly y=22% and 50%. Remove all sky, clouds, nearer forest trees, shoreline, water, reflections and all foreground birches/rocks/plants. Carefully reconstruct the mountains behind the removed trees and foreground, matching the ridge's existing rocky shapes and painted color. Mountain slopes can extend down to y=52% beneath the future forest layer. Everything above the mountain ridge and everything below y=52% must be truly transparent alpha. No soft rectangular fill and no water.
```

## autumn/far-trees-painted.png

Edit target: the approved reference. Transparent background: true.

```text
Edit the approved Birch Point environment reference into ONE precisely registered game layer. Preserve the original full 1774×887 canvas and 2:1 aspect ratio; never crop, zoom, recenter, rescale, move the camera, add labels or add scenery. The far land/water contact stays at y=50% of the canvas. Retain the same painted style, positions, contours, detail scale, neutral daylight and autumn palette. This is an aligned layer extraction for recomposition over the other layers, not a new composition. No sun, moon, stars, fog, rain, wildlife, UI or text.

Keep ONLY the farther dark-green forest belt at the foot of the mountains, behind the distinctly larger individual shoreline trees. Preserve its gently uneven treetop contour at roughly y=34–45%, filling continuously down to y=51.5% so the closer shoreline will overlap it. Remove mountain peaks/slopes, sky, water, reflections, foreground, and the tall nearer individual trees. Reconstruct the forest band where those taller trees used to overlap it. All pixels outside this forest band must be truly transparent alpha, including the entire upper sky and the entire area below y=52%. This is a separate distant forest cutout, not the full landscape.
```

## autumn/treeline-water-painted.png

Edit target: the approved reference. Transparent background: true.

```text
Edit the approved Birch Point environment reference into ONE precisely registered game layer. Preserve the original full 1774×887 canvas and 2:1 aspect ratio; never crop, zoom, recenter, rescale, move the camera, add labels or add scenery. The far land/water contact stays at y=50% of the canvas. Retain the same painted style, positions, contours, detail scale, neutral daylight and autumn palette. This is an aligned layer extraction for recomposition over the other layers, not a new composition. No sun, moon, stars, fog, rain, wildlife, UI or text.

Keep ONLY the closer far-shore treeline with its individual pines and gold birches, rocks at the far waterline, and ALL the lake water/reflections below that shoreline. Preserve every closer tree's exact top, trunk, base and x position. The waterline across the central view remains y=50%. Remove ALL sky, mountains, the farther forest behind the closer trees, and ALL foreground (large left birches, left fishing rocks, grass, right corner shrubs). Upper empty areas between the closer tree crowns must be actually transparent alpha. Reconstruct the lake behind the removed foreground so there is continuous opaque water across the FULL width from y=52% to the entire bottom edge. Preserve subtle broken reflections and small lake ripples. No pale blank holes in the water, no foreground objects.
```

## autumn/shore-seat-painted.png

Edit target: the approved reference. Transparent background: true.

```text
Edit the approved Birch Point environment reference into ONE precisely registered game layer. Preserve the original full 1774×887 canvas and 2:1 aspect ratio; never crop, zoom, recenter, rescale, move the camera, add labels or add scenery. The far land/water contact stays at y=50% of the canvas. Retain the same painted style, positions, contours, detail scale, neutral daylight and autumn palette. This is an aligned layer extraction for recomposition over the other layers, not a new composition. No sun, moon, stars, fog, rain, wildlife, UI or text.

Keep ONLY the lower-left foreground granite fishing ledge, its rock faces, moss, roots, fallen leaves, low bank plants and grasses. Preserve the actual flat stone sitting surface and exact shoreline contour/rock-to-water contact. Reconstruct small bank patches hidden by the two big birch trunks, but REMOVE those trunks and their overhead branches/foliage for a separate tree layer. Remove ALL sky, mountains, distant trees, distant shore, lake water, reflections and the separate plants at the far-right corner. The result is just the lower-left fishing bank on genuine transparent alpha, at its ORIGINAL position. No contact-shadow haze outside the rock/plant silhouettes. Preserve rock detail through the rightmost point of the ledge near x=45%, y=85%.
```

## autumn/birches-painted.png

Edit target: the approved reference. Transparent background: true.

```text
Edit the approved Birch Point environment reference into ONE precisely registered game layer. Preserve the original full 1774×887 canvas and 2:1 aspect ratio; never crop, zoom, recenter, rescale, move the camera, add labels or add scenery. The far land/water contact stays at y=50% of the canvas. Retain the same painted style, positions, contours, detail scale, neutral daylight and autumn palette. This is an aligned layer extraction for recomposition over the other layers, not a new composition. No sun, moon, stars, fog, rain, wildlife, UI or text.

Keep ONLY the two large close white-barked birch trunks on the LEFT, their upper branches and gold leaf canopy, and their attached roots down to the original bank root contact around y=64–70%. Preserve every trunk bend, original silhouette and branch attachment at exact original x/y coordinates. Remove all ground/rocks/moss carpeting, water, mountains, sky, distant trees, far shore and right corner shrubs. All empty space between leaves, branches, roots and outside these TWO foreground birches must be genuine transparent alpha, without scenery halos. Do not crop to the trees: maintain the FULL unchanged landscape-size canvas so they register with the separate ledge.
```

## autumn/right-plants-painted.png

Edit target: the approved reference. Transparent background: true.

```text
Edit the approved Birch Point environment reference into ONE precisely registered game layer. Preserve the original full 1774×887 canvas and 2:1 aspect ratio; never crop, zoom, recenter, rescale, move the camera, add labels or add scenery. The far land/water contact stays at y=50% of the canvas. Retain the same painted style, positions, contours, detail scale, neutral daylight and autumn palette. This is an aligned layer extraction for recomposition over the other layers, not a new composition. No sun, moon, stars, fog, rain, wildlife, UI or text.

Keep ONLY the small right-bottom corner foreground conifer sprigs, shoreline shrubs, low grasses, moss and the little corner stones they grow from, in exactly their original positions. Remove the rest of the scene including ALL water, sky, mountains, far forest, far shoreline, left foreground rock ledge and large left birches. Preserve crisp plant/rock silhouettes with genuine transparent gaps between leaves, and zero-alpha background everywhere else. Do not enlarge this corner or grow a new tree. Maintain the full original landscape canvas.
```

## spring/mountains-painted.png

Edit target: autumn/mountains-painted.png. Transparent background: true.

```text
Use case: lighting-weather. Asset: spring version of a registered transparent mountains game scene layer. Image 1 is the edit target. Change only the season: Spring: fresh young pale-green birch leaves, lush new ground growth, restrained tiny wildflowers, green mixed woodland, lingering snow only on the highest mountain crags; open blue lake. Preserve the original hand-painted style, 1774 by 887 canvas, every object's position, scale, perspective, outlines of mountains/rocks/trunks, shoreline and all empty transparent areas. Do not crop, recenter, zoom, move the waterline, add terrain, sun, fog, lighting effects, people or text. Preserve real alpha transparency. For a treeline-water layer, the lower lake remains fully opaque and continuous to the bottom edge; for all other layers, retain transparent surroundings and do not add water or scenery. Only depict the content already in this specific layer. This is a precise seasonal material/foliage edit, NOT a new composition.
```

## spring/far-trees-painted.png

Edit target: autumn/far-trees-painted.png. Transparent background: true.

```text
Use case: lighting-weather. Asset: spring version of a registered transparent far-trees game scene layer. Image 1 is the edit target. Change only the season: Spring: fresh young pale-green birch leaves, lush new ground growth, restrained tiny wildflowers, green mixed woodland, lingering snow only on the highest mountain crags; open blue lake. Preserve the original hand-painted style, 1774 by 887 canvas, every object's position, scale, perspective, outlines of mountains/rocks/trunks, shoreline and all empty transparent areas. Do not crop, recenter, zoom, move the waterline, add terrain, sun, fog, lighting effects, people or text. Preserve real alpha transparency. For a treeline-water layer, the lower lake remains fully opaque and continuous to the bottom edge; for all other layers, retain transparent surroundings and do not add water or scenery. Only depict the content already in this specific layer. This is a precise seasonal material/foliage edit, NOT a new composition.
```

## spring/treeline-water-painted.png

Edit target: autumn/treeline-water-painted.png. Transparent background: true.

```text
Use case: lighting-weather. Asset: spring version of a registered transparent treeline-water game scene layer. Image 1 is the edit target. Change only the season: Spring: fresh young pale-green birch leaves, lush new ground growth, restrained tiny wildflowers, green mixed woodland, lingering snow only on the highest mountain crags; open blue lake. Preserve the original hand-painted style, 1774 by 887 canvas, every object's position, scale, perspective, outlines of mountains/rocks/trunks, shoreline and all empty transparent areas. Do not crop, recenter, zoom, move the waterline, add terrain, sun, fog, lighting effects, people or text. Preserve real alpha transparency. For a treeline-water layer, the lower lake remains fully opaque and continuous to the bottom edge; for all other layers, retain transparent surroundings and do not add water or scenery. Only depict the content already in this specific layer. This is a precise seasonal material/foliage edit, NOT a new composition.
```

## spring/shore-seat-painted.png

Edit target: autumn/shore-seat-painted.png. Transparent background: true.

```text
Use case: lighting-weather. Asset: spring version of a registered transparent shore-seat game scene layer. Image 1 is the edit target. Change only the season: Spring: fresh young pale-green birch leaves, lush new ground growth, restrained tiny wildflowers, green mixed woodland, lingering snow only on the highest mountain crags; open blue lake. Preserve the original hand-painted style, 1774 by 887 canvas, every object's position, scale, perspective, outlines of mountains/rocks/trunks, shoreline and all empty transparent areas. Do not crop, recenter, zoom, move the waterline, add terrain, sun, fog, lighting effects, people or text. Preserve real alpha transparency. For a treeline-water layer, the lower lake remains fully opaque and continuous to the bottom edge; for all other layers, retain transparent surroundings and do not add water or scenery. Only depict the content already in this specific layer. This is a precise seasonal material/foliage edit, NOT a new composition.
```

## spring/birches-painted.png

Edit target: autumn/birches-painted.png. Transparent background: true.

```text
Use case: lighting-weather. Asset: spring version of a registered transparent birches game scene layer. Image 1 is the edit target. Change only the season: Spring: fresh young pale-green birch leaves, lush new ground growth, restrained tiny wildflowers, green mixed woodland, lingering snow only on the highest mountain crags; open blue lake. Preserve the original hand-painted style, 1774 by 887 canvas, every object's position, scale, perspective, outlines of mountains/rocks/trunks, shoreline and all empty transparent areas. Do not crop, recenter, zoom, move the waterline, add terrain, sun, fog, lighting effects, people or text. Preserve real alpha transparency. For a treeline-water layer, the lower lake remains fully opaque and continuous to the bottom edge; for all other layers, retain transparent surroundings and do not add water or scenery. Only depict the content already in this specific layer. This is a precise seasonal material/foliage edit, NOT a new composition.
```

## spring/right-plants-painted.png

Edit target: autumn/right-plants-painted.png. Transparent background: true.

```text
Use case: lighting-weather. Asset: spring version of a registered transparent right-plants game scene layer. Image 1 is the edit target. Change only the season: Spring: fresh young pale-green birch leaves, lush new ground growth, restrained tiny wildflowers, green mixed woodland, lingering snow only on the highest mountain crags; open blue lake. Preserve the original hand-painted style, 1774 by 887 canvas, every object's position, scale, perspective, outlines of mountains/rocks/trunks, shoreline and all empty transparent areas. Do not crop, recenter, zoom, move the waterline, add terrain, sun, fog, lighting effects, people or text. Preserve real alpha transparency. For a treeline-water layer, the lower lake remains fully opaque and continuous to the bottom edge; for all other layers, retain transparent surroundings and do not add water or scenery. Only depict the content already in this specific layer. This is a precise seasonal material/foliage edit, NOT a new composition.
```

## summer/mountains-painted.png

Edit target: autumn/mountains-painted.png. Transparent background: true.

```text
Use case: lighting-weather. Asset: summer version of a registered transparent mountains game scene layer. Image 1 is the edit target. Change only the season: Summer: full healthy deep-green birch foliage and lush green understory, evergreen and deciduous forests differentiated, exposed gray mountain rock, open blue lake. Preserve the original hand-painted style, 1774 by 887 canvas, every object's position, scale, perspective, outlines of mountains/rocks/trunks, shoreline and all empty transparent areas. Do not crop, recenter, zoom, move the waterline, add terrain, sun, fog, lighting effects, people or text. Preserve real alpha transparency. For a treeline-water layer, the lower lake remains fully opaque and continuous to the bottom edge; for all other layers, retain transparent surroundings and do not add water or scenery. Only depict the content already in this specific layer. This is a precise seasonal material/foliage edit, NOT a new composition.
```

## summer/far-trees-painted.png

Edit target: autumn/far-trees-painted.png. Transparent background: true.

```text
Use case: lighting-weather. Asset: summer version of a registered transparent far-trees game scene layer. Image 1 is the edit target. Change only the season: Summer: full healthy deep-green birch foliage and lush green understory, evergreen and deciduous forests differentiated, exposed gray mountain rock, open blue lake. Preserve the original hand-painted style, 1774 by 887 canvas, every object's position, scale, perspective, outlines of mountains/rocks/trunks, shoreline and all empty transparent areas. Do not crop, recenter, zoom, move the waterline, add terrain, sun, fog, lighting effects, people or text. Preserve real alpha transparency. For a treeline-water layer, the lower lake remains fully opaque and continuous to the bottom edge; for all other layers, retain transparent surroundings and do not add water or scenery. Only depict the content already in this specific layer. This is a precise seasonal material/foliage edit, NOT a new composition.
```

## summer/treeline-water-painted.png

Edit target: autumn/treeline-water-painted.png. Transparent background: true.

```text
Use case: lighting-weather. Asset: summer version of a registered transparent treeline-water game scene layer. Image 1 is the edit target. Change only the season: Summer: full healthy deep-green birch foliage and lush green understory, evergreen and deciduous forests differentiated, exposed gray mountain rock, open blue lake. Preserve the original hand-painted style, 1774 by 887 canvas, every object's position, scale, perspective, outlines of mountains/rocks/trunks, shoreline and all empty transparent areas. Do not crop, recenter, zoom, move the waterline, add terrain, sun, fog, lighting effects, people or text. Preserve real alpha transparency. For a treeline-water layer, the lower lake remains fully opaque and continuous to the bottom edge; for all other layers, retain transparent surroundings and do not add water or scenery. Only depict the content already in this specific layer. This is a precise seasonal material/foliage edit, NOT a new composition.
```

## summer/shore-seat-painted.png

Edit target: autumn/shore-seat-painted.png. Transparent background: true.

```text
Use case: lighting-weather. Asset: summer version of a registered transparent shore-seat game scene layer. Image 1 is the edit target. Change only the season: Summer: full healthy deep-green birch foliage and lush green understory, evergreen and deciduous forests differentiated, exposed gray mountain rock, open blue lake. Preserve the original hand-painted style, 1774 by 887 canvas, every object's position, scale, perspective, outlines of mountains/rocks/trunks, shoreline and all empty transparent areas. Do not crop, recenter, zoom, move the waterline, add terrain, sun, fog, lighting effects, people or text. Preserve real alpha transparency. For a treeline-water layer, the lower lake remains fully opaque and continuous to the bottom edge; for all other layers, retain transparent surroundings and do not add water or scenery. Only depict the content already in this specific layer. This is a precise seasonal material/foliage edit, NOT a new composition.
```

## summer/birches-painted.png

Edit target: autumn/birches-painted.png. Transparent background: true.

```text
Use case: lighting-weather. Asset: summer version of a registered transparent birches game scene layer. Image 1 is the edit target. Change only the season: Summer: full healthy deep-green birch foliage and lush green understory, evergreen and deciduous forests differentiated, exposed gray mountain rock, open blue lake. Preserve the original hand-painted style, 1774 by 887 canvas, every object's position, scale, perspective, outlines of mountains/rocks/trunks, shoreline and all empty transparent areas. Do not crop, recenter, zoom, move the waterline, add terrain, sun, fog, lighting effects, people or text. Preserve real alpha transparency. For a treeline-water layer, the lower lake remains fully opaque and continuous to the bottom edge; for all other layers, retain transparent surroundings and do not add water or scenery. Only depict the content already in this specific layer. This is a precise seasonal material/foliage edit, NOT a new composition.
```

## summer/right-plants-painted.png

Edit target: autumn/right-plants-painted.png. Transparent background: true.

```text
Use case: lighting-weather. Asset: summer version of a registered transparent right-plants game scene layer. Image 1 is the edit target. Change only the season: Summer: full healthy deep-green birch foliage and lush green understory, evergreen and deciduous forests differentiated, exposed gray mountain rock, open blue lake. Preserve the original hand-painted style, 1774 by 887 canvas, every object's position, scale, perspective, outlines of mountains/rocks/trunks, shoreline and all empty transparent areas. Do not crop, recenter, zoom, move the waterline, add terrain, sun, fog, lighting effects, people or text. Preserve real alpha transparency. For a treeline-water layer, the lower lake remains fully opaque and continuous to the bottom edge; for all other layers, retain transparent surroundings and do not add water or scenery. Only depict the content already in this specific layer. This is a precise seasonal material/foliage edit, NOT a new composition.
```

## winter/mountains-painted.png

Edit target: autumn/mountains-painted.png. Transparent background: true.

```text
Use case: lighting-weather. Asset: winter version of a registered transparent mountains game scene layer. Image 1 is the edit target. Change only the season: Winter: bare fine birch branches retaining exactly the existing trunks and roots, conifers still green with light snow, snow dusts rock ledges and mountain slopes, dormant ground plants. Keep the lake OPEN unfrozen, cool blue water with subtle appropriate reflections. Preserve the original hand-painted style, 1774 by 887 canvas, every object's position, scale, perspective, outlines of mountains/rocks/trunks, shoreline and all empty transparent areas. Do not crop, recenter, zoom, move the waterline, add terrain, sun, fog, lighting effects, people or text. Preserve real alpha transparency. For a treeline-water layer, the lower lake remains fully opaque and continuous to the bottom edge; for all other layers, retain transparent surroundings and do not add water or scenery. Only depict the content already in this specific layer. This is a precise seasonal material/foliage edit, NOT a new composition.
```

## winter/far-trees-painted.png

Edit target: autumn/far-trees-painted.png. Transparent background: true.

```text
Use case: lighting-weather. Asset: winter version of a registered transparent far-trees game scene layer. Image 1 is the edit target. Change only the season: Winter: bare fine birch branches retaining exactly the existing trunks and roots, conifers still green with light snow, snow dusts rock ledges and mountain slopes, dormant ground plants. Keep the lake OPEN unfrozen, cool blue water with subtle appropriate reflections. Preserve the original hand-painted style, 1774 by 887 canvas, every object's position, scale, perspective, outlines of mountains/rocks/trunks, shoreline and all empty transparent areas. Do not crop, recenter, zoom, move the waterline, add terrain, sun, fog, lighting effects, people or text. Preserve real alpha transparency. For a treeline-water layer, the lower lake remains fully opaque and continuous to the bottom edge; for all other layers, retain transparent surroundings and do not add water or scenery. Only depict the content already in this specific layer. This is a precise seasonal material/foliage edit, NOT a new composition.
```

## winter/treeline-water-painted.png

Edit target: autumn/treeline-water-painted.png. Transparent background: true.

```text
Use case: lighting-weather. Asset: winter version of a registered transparent treeline-water game scene layer. Image 1 is the edit target. Change only the season: Winter: bare fine birch branches retaining exactly the existing trunks and roots, conifers still green with light snow, snow dusts rock ledges and mountain slopes, dormant ground plants. Keep the lake OPEN unfrozen, cool blue water with subtle appropriate reflections. Preserve the original hand-painted style, 1774 by 887 canvas, every object's position, scale, perspective, outlines of mountains/rocks/trunks, shoreline and all empty transparent areas. Do not crop, recenter, zoom, move the waterline, add terrain, sun, fog, lighting effects, people or text. Preserve real alpha transparency. For a treeline-water layer, the lower lake remains fully opaque and continuous to the bottom edge; for all other layers, retain transparent surroundings and do not add water or scenery. Only depict the content already in this specific layer. This is a precise seasonal material/foliage edit, NOT a new composition.
```

## winter/shore-seat-painted.png

Edit target: autumn/shore-seat-painted.png. Transparent background: true.

```text
Use case: lighting-weather. Asset: winter version of a registered transparent shore-seat game scene layer. Image 1 is the edit target. Change only the season: Winter: bare fine birch branches retaining exactly the existing trunks and roots, conifers still green with light snow, snow dusts rock ledges and mountain slopes, dormant ground plants. Keep the lake OPEN unfrozen, cool blue water with subtle appropriate reflections. Preserve the original hand-painted style, 1774 by 887 canvas, every object's position, scale, perspective, outlines of mountains/rocks/trunks, shoreline and all empty transparent areas. Do not crop, recenter, zoom, move the waterline, add terrain, sun, fog, lighting effects, people or text. Preserve real alpha transparency. For a treeline-water layer, the lower lake remains fully opaque and continuous to the bottom edge; for all other layers, retain transparent surroundings and do not add water or scenery. Only depict the content already in this specific layer. This is a precise seasonal material/foliage edit, NOT a new composition.
```

## winter/birches-painted.png

Edit target: autumn/birches-painted.png. Transparent background: true.

```text
Use case: lighting-weather. Asset: winter version of a registered transparent birches game scene layer. Image 1 is the edit target. Change only the season: Winter: bare fine birch branches retaining exactly the existing trunks and roots, conifers still green with light snow, snow dusts rock ledges and mountain slopes, dormant ground plants. Keep the lake OPEN unfrozen, cool blue water with subtle appropriate reflections. Preserve the original hand-painted style, 1774 by 887 canvas, every object's position, scale, perspective, outlines of mountains/rocks/trunks, shoreline and all empty transparent areas. Do not crop, recenter, zoom, move the waterline, add terrain, sun, fog, lighting effects, people or text. Preserve real alpha transparency. For a treeline-water layer, the lower lake remains fully opaque and continuous to the bottom edge; for all other layers, retain transparent surroundings and do not add water or scenery. Only depict the content already in this specific layer. This is a precise seasonal material/foliage edit, NOT a new composition.
```

## winter/right-plants-painted.png

Edit target: autumn/right-plants-painted.png. Transparent background: true.

```text
Use case: lighting-weather. Asset: winter version of a registered transparent right-plants game scene layer. Image 1 is the edit target. Change only the season: Winter: bare fine birch branches retaining exactly the existing trunks and roots, conifers still green with light snow, snow dusts rock ledges and mountain slopes, dormant ground plants. Keep the lake OPEN unfrozen, cool blue water with subtle appropriate reflections. Preserve the original hand-painted style, 1774 by 887 canvas, every object's position, scale, perspective, outlines of mountains/rocks/trunks, shoreline and all empty transparent areas. Do not crop, recenter, zoom, move the waterline, add terrain, sun, fog, lighting effects, people or text. Preserve real alpha transparency. For a treeline-water layer, the lower lake remains fully opaque and continuous to the bottom edge; for all other layers, retain transparent surroundings and do not add water or scenery. Only depict the content already in this specific layer. This is a precise seasonal material/foliage edit, NOT a new composition.
```


