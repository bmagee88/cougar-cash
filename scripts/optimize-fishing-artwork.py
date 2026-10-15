"""Build runtime WebP copies; never change the painted PNG masters."""
from pathlib import Path
import json
from PIL import Image

root = Path(__file__).resolve().parents[1] / 'public/assets/fishing'
rows = []
for source in sorted(root.rglob('*.png')):
    relative = source.relative_to(root)
    if relative.parts[0] == 'optimized':
        continue
    limit = (96 if relative.as_posix() == 'weather/moon-painted.png' else
             192 if relative.parts[0] == 'effects' else
             128 if relative.parts[0] == 'lures' else
             768 if relative.parts[0] in ('characters', 'rods') else
             1024 if relative.parts[0] == 'fish' else None)
    target = root / 'optimized' / relative.with_suffix('.webp')
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as original:
        image = original.convert('RGBA')
        if limit:
            image.thumbnail((limit, limit), Image.Resampling.LANCZOS)
        image.save(target, 'WEBP', quality=94, method=6, exact=True)
        rows.append(dict(file=relative.as_posix(), sourceBytes=source.stat().st_size,
                         runtimeBytes=target.stat().st_size, sourceSize=list(original.size), runtimeSize=list(image.size)))
report = dict(sourceBytes=sum(r['sourceBytes'] for r in rows), runtimeBytes=sum(r['runtimeBytes'] for r in rows), images=rows)
(root / 'optimized/manifest.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: v for k, v in report.items() if k != 'images'}))

