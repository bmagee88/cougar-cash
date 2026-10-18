"""Crop the generated shore-plant atlas and trace existing reed pixels.
No plants are drawn or recolored. Original ImageGen source is preserved.
"""
from pathlib import Path
from statistics import median
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('C:/Users/Kathleen Dippyolito/.codex/generated_images/01a149bf-9559-7c21-bd97-ac31ba63fa62/exec-7ca71e44-9edf-4318-9c1b-3ad7c5167bba.png')
atlas = Image.open(SOURCE).convert('RGBA')
tips = {
    'dock': [(180, 15, 'Cattail tip', 'dragonfly'), (150, 65, 'Lower cattail', 'damselfly'), (372, 149, 'Curved reed leaf', 'damselfly')],
    'cove': [(178, 380, 'Rush seed tip', 'dragonfly'), (305, 437, 'Side rush tip', 'dragonfly'), (81, 447, 'Low rush leaf', 'damselfly')],
    'birch': [(378, 718, 'Bare twig tip', 'dragonfly'), (146, 700, 'Sedge seed tip', 'damselfly'), (329, 813, 'Twig side branch', 'damselfly')],
}
metadata = {}
for row, location in enumerate(['dock', 'cove', 'birch']):
    target = ROOT / 'public/assets/fishing/shore-plants' / location
    target.mkdir(parents=True, exist_ok=True)
    records = {}
    for col, kind in enumerate(['reeds', 'lily-pads', 'pondweed']):
        rows = [0, 365, 694, 1024] if col == 0 else [0, 356, 687, 1024]
        origin = (col * 512, rows[row])
        cell = atlas.crop((*origin, (col + 1) * 512, rows[row + 1]))
        box = cell.getchannel('A').point(lambda a: 255 if a > 96 else 0).getbbox()
        assert box
        box = (max(0, box[0]-2), max(0, box[1]-2), min(cell.width, box[2]+2), min(cell.height, box[3]+2))
        cropped = cell.crop(box)
        scale = min(1, 340/cropped.width, 300/cropped.height)
        cropped = cropped.resize((round(cropped.width*scale), round(cropped.height*scale)), Image.Resampling.LANCZOS)
        frame = Image.new('RGBA', (cropped.width+8, cropped.height+8))
        frame.alpha_composite(cropped, (4,4))
        relative = f'shore-plants/{location}/{kind}.webp'
        frame.save(target / f'{kind}.webp', quality=88, method=6)
        record = {'image': relative, 'width': frame.width, 'height': frame.height}
        if kind == 'reeds':
            solid = [(x,y) for y in range(frame.height) for x in range(frame.width) if frame.getpixel((x,y))[3] > 110]
            bottom = max(y for x,y in solid)
            record['root'] = {'x': median(x for x,y in solid if y >= bottom-2)/frame.width, 'y': bottom/frame.height}
            anchors = []
            for x,y,label,use in tips[location]:
                px,py = (x-origin[0]-box[0])*scale+4, (y-origin[1]-box[1])*scale+4
                sx,sy = min(solid, key=lambda p: (p[0]-px)**2+(p[1]-py)**2)
                assert ((sx-px)**2+(sy-py)**2)**.5 < 12, (location,label)
                anchors.append({'x': sx/frame.width, 'y': sy/frame.height, 'label': label, 'use': use})
            record['anchors'] = anchors
        records[kind] = record
        print(location, kind, frame.size)
    metadata[location] = records
(ROOT/'src/FishingTypingGame/data/shore-plants.json').write_text(json.dumps(metadata, indent=2)+'\n')
