"""Validate the new seasonal layers and encode runtime WebP copies without resizing."""
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'public/assets/fishing'
SEASONS = ('spring', 'summer', 'winter')
NAMES = ('sky-painted', 'clouds-painted', 'landscape-water-painted', 'shore-seat-painted',
         'willow-left-painted', 'willow-right-painted')
rows = []
for season in SEASONS:
    for name in NAMES:
        relative = Path('locations/willow-cove') / season / f'{name}.png'
        source = ROOT / relative
        target = ROOT / 'optimized' / relative.with_suffix('.webp')
        target.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(source) as original:
            image = original.convert('RGBA')
            width, height = image.size
            assert abs(width / height - 16 / 9) < .015, (relative, image.size)
            alpha = image.getchannel('A')
            assert alpha.getextrema() == ((255, 255) if name == 'sky-painted' else (0, 255)), relative
            if name == 'landscape-water-painted':
                assert alpha.getpixel((width // 2, height // 10)) == 0, relative
                assert alpha.getpixel((width // 2, height * 9 // 10)) >= 245, relative
            if name == 'shore-seat-painted':
                assert alpha.getpixel((round(width * .29), round(height * .70))) >= 245, relative
            image.save(target, 'WEBP', quality=94, method=6, exact=True)
            rows.append(dict(file=relative.as_posix(), sourceBytes=source.stat().st_size,
                             runtimeBytes=target.stat().st_size, sourceSize=list(original.size), runtimeSize=list(image.size)))
            print(f'{season}/{name}: {width}x{height}, alpha {alpha.getextrema()}, {target.stat().st_size:,} bytes')

manifest_path = ROOT / 'optimized/manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
replaced = {row['file'] for row in rows}
manifest['images'] = sorted([row for row in manifest['images'] if row['file'] not in replaced] + rows, key=lambda row: row['file'])
manifest['sourceBytes'] = sum(row['sourceBytes'] for row in manifest['images'])
manifest['runtimeBytes'] = sum(row['runtimeBytes'] for row in manifest['images'])
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print('Verified and optimized all 18 seasonal files; PNG masters preserved.')
