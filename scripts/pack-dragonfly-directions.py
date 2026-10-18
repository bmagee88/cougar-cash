"""Pack generated front/rear atlases; only crop, register, resize and encode.

python scripts/pack-dragonfly-directions.py FRONT.png BACK.png
Creative artwork and wing-alpha edits are performed by built-in imagegen.
"""
from pathlib import Path
from statistics import median
import sys
from PIL import Image

destination = Path('public/assets/fishing/visitors/green-darner')
# Source layouts have slightly uneven spacing. These cuts fall in empty gaps
# between insects, preserving wings which extend past nominal grid boundaries.
cuts = {'front': [(0, 483, 900, 1328, 1774), (0, 483, 900, 1328, 1774)],
        'back': [(0, 526, 945, 1280, 1774), (0, 505, 902, 1315, 1774)]}
for view, filename in zip(('front', 'back'), sys.argv[1:]):
    source = Image.open(filename).convert('RGBA')
    assert source.size == (1774, 887), 'Check frame cuts for a new source layout'
    cells = []
    for n in range(8):
        column, row = n % 4, n // 4
        cell = source.crop((cuts[view][row][column], row * 500,
                            cuts[view][row][column + 1], 500 if row == 0 else 887))
        # Saturated green identifies the opaque thorax, independently of wings.
        points = [(x, y) for y in range(cell.height) for x in range(cell.width)
                  if (lambda p: p[3] > 200 and p[1] > p[0] * 1.35 and p[1] > p[2] * .85)(cell.getpixel((x, y)))]
        assert len(points) > 20, (view, n, 'Missing thorax')
        anchor = (median(x for x, y in points), median(y for x, y in points))
        cells.append((cell, anchor))
    # Use a single scale across the whole cycle; wings must not resize the body.
    extent = max(max(anchor[0], cell.width - anchor[0]) for cell, anchor in cells)
    factor = 43 / extent
    strip = Image.new('RGBA', (768, 112))
    for n, (cell, anchor) in enumerate(cells):
        resized = cell.resize((round(cell.width * factor), round(cell.height * factor)), Image.Resampling.LANCZOS)
        frame = Image.new('RGBA', (96, 112))
        frame.alpha_composite(resized, (round(48 - anchor[0] * factor), round(56 - anchor[1] * factor)))
        frame.save(destination / f'{view}-pose-{n}.webp', quality=90, method=6)
        strip.alpha_composite(frame, (96 * n, 0))
        if n == 0:
            frame.save(destination / f'{view}-adult.webp', quality=90, method=6)
    strip.save(destination / f'{view}-flight-sheet.webp', quality=88, method=6)
    print(view, 'packed eight 96 x 112 frames, 768 x 112 sheet')
