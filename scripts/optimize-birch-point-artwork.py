"""Validate registered Birch Point masters, encode WebP, and trace real skylines.

Does not repaint or change any pixels in the generated PNG masters.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw

PROJECT = Path(__file__).resolve().parents[1]
ROOT = PROJECT / 'public/assets/fishing'
BASE = Path('locations/birch-point')
SEASONS = ('spring', 'summer', 'autumn', 'winter')
NAMES = ('mountains', 'far-trees', 'treeline-water', 'shore-seat', 'birches', 'right-plants')
rows, ridges, composites = [], {}, []
files = [BASE / 'shared/sky-painted.png'] + [BASE / season / f'{name}-painted.png' for season in SEASONS for name in NAMES]
for relative in files:
    source = ROOT / relative
    target = ROOT / 'optimized' / relative.with_suffix('.webp')
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as original:
        image = original.convert('RGBA')
        assert image.size == (1774, 887), (relative, image.size)
        alpha = image.getchannel('A')
        assert alpha.getextrema() == ((255, 255) if relative.parent.name == 'shared' else (0, 255)), relative
        if 'treeline-water' in relative.name:
            assert alpha.getpixel((887, 80)) == 0, relative
            # ImageGen retains slight (245–254) painterly translucency in water.
            # Reject actual holes; preserve the supplied alpha in runtime copies.
            assert alpha.crop((0, 530, 1774, 887)).getextrema()[0] >= 245, relative
        if 'shore-seat' in relative.name:
            assert alpha.getpixel((round(1774 * .24), round(887 * .76))) > 240, relative
        image.save(target, 'WEBP', quality=91, method=6, exact=True)
        with Image.open(target) as runtime:
            assert runtime.size == image.size
            assert runtime.convert('RGBA').getchannel('A').tobytes() == alpha.tobytes(), relative
        rows.append(dict(file=relative.as_posix(), sourceBytes=source.stat().st_size,
                         runtimeBytes=target.stat().st_size, sourceSize=list(image.size), runtimeSize=list(image.size)))
        print(f'{relative}: alpha {alpha.getextrema()}, {target.stat().st_size:,} bytes')

for season in SEASONS:
    canvas = Image.open(ROOT / BASE / 'shared/sky-painted.png').convert('RGBA')
    skyline_alpha = Image.new('L', canvas.size)
    for name in NAMES:
        layer = Image.open(ROOT / BASE / season / f'{name}-painted.png').convert('RGBA')
        if name in NAMES[:3]:
            skyline_alpha = Image.composite(layer.getchannel('A'), skyline_alpha, layer.getchannel('A'))
        canvas = Image.alpha_composite(canvas, layer)
    points = []
    for index in range(129):
        x = min(1773, round(index / 128 * 1773))
        y = next(y for y in range(887) if skyline_alpha.getpixel((x, y)) >= 100)
        points.append(round(y / 887, 5))
    ridges[season] = points
    preview = canvas.convert('RGB').resize((800, 400), Image.Resampling.LANCZOS)
    ImageDraw.Draw(preview).text((12, 12), season.title(), fill='white', stroke_width=2, stroke_fill='black')
    composites.append(preview)

destination = PROJECT / 'src/FishingTypingGame/scene/birch-ridges.json'
destination.write_text(json.dumps(ridges, indent=2) + '\n', encoding='utf-8')
contact = Image.new('RGB', (1600, 800))
for index, preview in enumerate(composites):
    contact.paste(preview, ((index % 2) * 800, (index // 2) * 400))
contact.save(PROJECT / 'output/location-references/birch-point/seasons-review.jpg', quality=94)
manifest_path = ROOT / 'optimized/manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
replaced = {row['file'] for row in rows}
manifest['images'] = sorted([row for row in manifest['images'] if row['file'] not in replaced] + rows, key=lambda row: row['file'])
manifest['sourceBytes'] = sum(row['sourceBytes'] for row in manifest['images'])
manifest['runtimeBytes'] = sum(row['runtimeBytes'] for row in manifest['images'])
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(f'Validated {len(rows)} images; runtime total {sum(row["runtimeBytes"] for row in rows):,} bytes.')
