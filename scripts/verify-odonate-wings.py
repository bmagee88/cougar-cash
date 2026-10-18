"""Check packed wing alpha, opaque bodies and all animation poses without edits."""
from pathlib import Path
import re
from statistics import median
from PIL import Image

root = Path('public/assets/fishing/visitors')
for species in ['green-darner', 'ebony-jewelwing']:
    for n in range(8):
        frame = Image.open(root / species / f'pose-{n}.webp').convert('RGBA')
        assert frame.size == (96, 112)
        wing = [frame.getpixel((x, y))[3] for y in range(frame.height)
                for x in range(frame.width) if (y < 45 or y > 69)
                and frame.getpixel((x, y))[3] > 8]
        body = [a for r, g, b, a in frame.get_flattened_data()
                if g > r * 1.35 and g > b * .85 and a > 220]
        assert len(body) > 15, (species, n, 'Body lost opacity')
        assert sum(a < 170 for a in wing) / len(wing) > .7, (species, n, 'Wings are opaque')
        print(f'{species} pose {n}: median wing alpha {median(wing):.0f}/255; {len(body)} opaque body pixels')
    sheet = Image.open(root / species / 'flight-sheet.webp').convert('RGBA')
    assert sheet.size == (768, 112)
    assert Image.open(root / species / 'adult.webp').size == (96, 112)
    for extension in ['webp', 'gif']:
        animation = Image.open(root / species / f'flight.{extension}')
        assert animation.n_frames == 8
        for n in range(8):
            animation.seek(n)
            if extension == 'webp':
                # The full-alpha animation must retain see-through wing pixels.
                partial = sum(8 < a < 170 for r, g, b, a in animation.convert('RGBA').get_flattened_data())
                assert partial > 25, (species, n, 'Animation flattened wing alpha')
    print(f'{species}: eight poses and both animations verified')
for view in ['front', 'back']:
    sheet = Image.open(root / 'green-darner' / f'{view}-flight-sheet.webp').convert('RGBA')
    assert sheet.size == (768, 112)
    assert Image.open(root / 'green-darner' / f'{view}-adult.webp').size == (96, 112)
    for n in range(8):
        frame = Image.open(root / 'green-darner' / f'{view}-pose-{n}.webp').convert('RGBA')
        assert frame.size == (96, 112)
        wing = [frame.getpixel((x, y))[3] for y in range(frame.height)
                for x in range(frame.width) if abs(x - 48) > 12
                and frame.getpixel((x, y))[3] > 8]
        body = sum(a > 220 and g > r * 1.35 and g > b * .85
                   for r, g, b, a in frame.get_flattened_data())
        assert body > 15, (view, n, 'Body lost opacity')
        assert wing and sum(a < 170 for a in wing) / len(wing) > .7, (view, n, 'Wings are opaque')
        # Picking uses this same alpha channel as the recorded journal frame.
        assert sheet.crop((96*n, 0, 96*(n+1), 112)).getchannel('A').tobytes() == frame.getchannel('A').tobytes()
        print(f'{view} pose {n}: median wing alpha {median(wing):.0f}/255; {body} opaque body pixels')
contacts = re.findall(r"id==='([^']+)'\?\{x:(\d+),y:(\d+)\}", Path('src/FishingTypingGame/engine/visitors.ts').read_text())
assert len(contacts) == 2
for species, x, y in contacts:
    n = 0 if species == 'green-darner' else 3
    sheet = Image.open(root / species / 'flight-sheet.webp').convert('RGBA')
    assert sheet.getpixel((n*96+int(x), int(y)))[3] > 60, (species, 'Perch contact must touch a painted foot')
    print(f'{species}: resting foot-contact pixel verified at {x}, {y}')
print('PASS: 32 translucent poses; opaque bodies; matching directional sheets and journal stills; painted perch contacts.')
