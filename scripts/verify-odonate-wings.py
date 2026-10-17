"""Check packed wing alpha, opaque bodies and all animation poses without edits."""
from pathlib import Path
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
print('PASS: 16 translucent poses; opaque bodies; matching sheets, stills and animations.')
