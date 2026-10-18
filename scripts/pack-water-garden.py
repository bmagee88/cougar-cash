"""Crop/resize ImageGen modular leaves and blooms, preserving generated alpha.
No artwork is painted or recolored. Originals remain in generated_images.
"""
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('C:/Users/Kathleen Dippyolito/.codex/generated_images/01a149bf-9559-7c21-bd97-ac31ba63fa62')
OUTPUT = ROOT / 'public/assets/fishing/shore-plants/modular'
OUTPUT.mkdir(parents=True, exist_ok=True)
metadata = {}
for kind, name in [('leaf', 'exec-aa545eed-a2bf-48d5-bc52-cd47bde6dff1.png'),
                   ('bloom', 'exec-37e48749-37cf-4971-8195-a363f9e2e4f0.png')]:
    atlas = Image.open(SOURCE / name).convert('RGBA')
    records = []
    for n in range(6):
        row, col = divmod(n, 3)
        # Flowers have irregular widths: the rose's outer petal extends past
        # the nominal first third. Cut in the actual transparent gutters.
        xs = [0, 638, 1230, 1672] if kind == 'bloom' and row == 1 else [0, 570, 1135, 1672] if kind == 'bloom' else [0, 560, 1145, 1672]
        ys = [0, 472, 941]
        cell = atlas.crop((xs[col], ys[row], xs[col+1], ys[row+1]))
        box = cell.getchannel('A').point(lambda a: 255 if a > 96 else 0).getbbox()
        assert box
        cell = cell.crop((max(0, box[0]-2), max(0, box[1]-2), min(cell.width, box[2]+2), min(cell.height, box[3]+2)))
        cell.thumbnail((180, 180), Image.Resampling.LANCZOS)
        frame = Image.new('RGBA', (cell.width+8, cell.height+8))
        frame.alpha_composite(cell, (4, 4))
        relative = f'shore-plants/modular/{kind}-{n}.webp'
        frame.save(ROOT/'public/assets/fishing'/relative, quality=90, method=6)
        records.append({'image': relative, 'width': frame.width, 'height': frame.height})
        print(relative, frame.size)
    metadata[kind] = records
(ROOT/'src/FishingTypingGame/data/water-garden.json').write_text(json.dumps(metadata, indent=2)+'\n')
print('Runtime bytes:', sum(p.stat().st_size for p in OUTPUT.glob('*.webp')))
