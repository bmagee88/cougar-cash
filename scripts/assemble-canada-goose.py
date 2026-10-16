"""Pack the generated 4x3 wingbeat master into registered transparent GIFs.

Requires Pillow; the illustration is never redrawn by this packer.
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter
from statistics import median

source = Path('output/wildlife-sources/canada-goose.png')
destination = Path('public/assets/fishing/visitors/canada-goose')
destination.mkdir(parents=True, exist_ok=True)
master = Image.open(source).convert('RGBA')
frames = []
# The generated horizontal recovery pose is cell 4. Register at the beak tip:
# wing extents change throughout the stroke and cannot be used as an anchor.
order = [0, 1, 2, 4, 3, 5, 6, 7, 8, 9, 10, 11]
for index in order:
    column, row = index % 4, index // 4
    # A small extraction gutter preserves long feather tips that cross a cell
    # edge. Keep the main connected silhouette to discard neighboring tips.
    cell = master.crop((round(column * master.width / 4) - 16, round(row * master.height / 3) - 16,
                        round((column + 1) * master.width / 4) + 16, round((row + 1) * master.height / 3) + 16))
    alpha = cell.getchannel('A')
    remaining = {i for i, value in enumerate(alpha.tobytes()) if value > 80}
    largest = set()
    while remaining:
        component = {remaining.pop()}
        pending = list(component)
        while pending:
            pixel = pending.pop()
            y, x = divmod(pixel, cell.width)
            for dy in [-1, 0, 1]:
                for dx in [-1, 0, 1]:
                    nx, ny = x + dx, y + dy
                    neighbor = ny * cell.width + nx
                    if 0 <= nx < cell.width and 0 <= ny < cell.height and neighbor in remaining:
                        remaining.remove(neighbor); component.add(neighbor); pending.append(neighbor)
        if len(component) > len(largest):
            largest = component
    mask = Image.new('L', cell.size)
    mask.putdata([255 if i in largest else 0 for i in range(cell.width * cell.height)])
    cell.putalpha(ImageChops.multiply(alpha, mask.filter(ImageFilter.MaxFilter(3))))
    opaque = cell.getchannel('A').point(lambda value: 255 if value > 150 else 0)
    bounds = opaque.getbbox()
    if not bounds:
        raise ValueError(f'Empty goose frame {index}')
    beak_x = bounds[2] - 1
    beak_y = median(y for y in range(cell.height) for x in range(max(0, beak_x - 5), beak_x + 1)
                    if opaque.getpixel((x, y)))
    scale = 106 / (master.width / 4)
    resized = cell.resize((round(cell.width * scale), round(cell.height * scale)), Image.Resampling.LANCZOS)
    frame = Image.new('RGBA', (128, 128))
    frame.alpha_composite(resized, (round(117 - beak_x * scale), round(66 - beak_y * scale)))
    frames.append(frame)

def pack_lod(size, folder, colors):
    folder.mkdir(parents=True, exist_ok=True)
    tiles = [frame.resize((size, size), Image.Resampling.LANCZOS) for frame in frames]
    sheet = Image.new('RGBA', (size * len(tiles), size))
    for index, frame in enumerate(tiles):
        sheet.alpha_composite(frame, (index * size, 0))
    sheet.save(folder / 'flight-sheet.webp', quality=80, method=6)
    tiles[0].save(folder / 'still.webp', quality=80, method=6)
    # Shared palette prevents color flicker. Reserve entry 255 for transparency.
    palette = sheet.convert('RGB').quantize(colors=colors)
    indexed = []
    for frame in tiles:
        image = frame.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE)
        image.putpalette(image.getpalette()[:765] + [0, 0, 0])
        image.paste(255, mask=frame.getchannel('A').point(lambda value: 255 if value < 64 else 0))
        image.info['transparency'] = 255
        indexed.append(image)
    for phase in [0, 4, 8]:
        cycle = indexed[phase:] + indexed[:phase]
        path = folder / f'flight-{phase}.gif'
        cycle[0].save(path, save_all=True, append_images=cycle[1:], duration=50, loop=0,
                      disposal=2, transparency=255, optimize=False)
        animation = Image.open(path)
        assert animation.size == (size, size) and animation.n_frames == 12
        assert sum(animation.seek(i) or animation.info['duration'] for i in range(12)) == 600
        print(f'{path}: {size} px, {animation.n_frames} frames, {path.stat().st_size:,} bytes')


pack_lod(64, destination, 128)
pack_lod(32, destination / 'far', 64)

preview = Image.new('RGBA', (128 * 4, 128 * 3))
for index, frame in enumerate(frames):
    preview.alpha_composite(frame, (index % 4 * 128, index // 4 * 128))
preview.save('output/canada-goose-frames.png')
