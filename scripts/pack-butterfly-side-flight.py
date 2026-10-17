"""Pack eight generated side-view poses without redrawing or warping the art."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'output/insect-flight-art'
# Measured thorax anchors on the generated 1280px atlases, in local 320x640 cells.
ANCHORS = {
    'monarch': [(223, 491), (221, 492), (217, 491), (226, 496),
                (225, 283), (225, 294), (220, 278), (223, 300)],
    'eastern-tiger-swallowtail': [(235, 405), (232, 407), (229, 409), (238, 417),
                                (230, 278), (229, 282), (231, 280), (231, 287)],
}

for species, anchors in ANCHORS.items():
    source = Image.open(SOURCE / f'{species}-side-atlas.png').convert('RGBA')
    assert source.getchannel('A').getextrema() == (0, 255), 'Real alpha required'
    folder = ROOT / 'public/assets/fishing/butterflies' / species
    frames = []
    for index, (anchor_x, anchor_y) in enumerate(anchors):
        column, row = index % 4, index // 4
        cell = source.crop((column * 320, row * 640, (column + 1) * 320, (row + 1) * 640))
        # One scale for every pose; the body stays planted while the wings move.
        scale = .245 if species == 'monarch' else .285
        cell = cell.resize((round(cell.width * scale), round(cell.height * scale)), Image.Resampling.LANCZOS)
        frame = Image.new('RGBA', (192, 224))
        frame.alpha_composite(cell, (96 - round(anchor_x * scale), 112 - round(anchor_y * scale)))
        frame.save(folder / f'side-pose-{index}.webp', lossless=True, method=6)
        frames.append(frame)
    strip = Image.new('RGBA', (192 * 8, 224))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (192 * index, 0))
    strip.save(folder / 'flight-side-sheet.webp', lossless=True, method=6)
    # GIF is a portable preview; the game samples full-alpha WebP poses instead.
    palette = strip.convert('RGB').quantize(colors=255)
    indexed = []
    for frame in frames:
        image = frame.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE)
        image.paste(255, mask=frame.getchannel('A').point(lambda a: 255 if a < 100 else 0))
        indexed.append(image)
    indexed[0].save(folder / 'flight-side.gif', save_all=True, append_images=indexed[1:],
                    duration=35, loop=0, transparency=255, disposal=2, optimize=False)
    with Image.open(folder / 'flight-side.gif') as gif:
        assert gif.n_frames == 8 and gif.size == (192, 224)
    print(species, '8 side poses, transparent WebP sheet and GIF,', (folder / 'flight-side-sheet.webp').stat().st_size, 'bytes', flush=True)
