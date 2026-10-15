"""Crop generated natural-history sheets and encode real wing-pose GIFs.

No artwork is redrawn. Alpha-projection gutters accommodate the small spacing
differences in ImageGen's 4-by-3 grids. Original sheets remain beside the assets.
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'public/assets/fishing/butterflies'
SPECIES = json.loads((ROOT / 'src/FishingTypingGame/data/butterflies.json').read_text(encoding='utf-8'))
CANVAS = (192, 224)


def gaps(projection):
    result, start = [], None
    for index, occupied in enumerate([*projection, 1]):
        if not occupied and start is None:
            start = index
        elif occupied and start is not None:
            if index-start >= 2:
                result.append((start, index))
            start = None
    return result


def divisions(projection, count):
    length = len(projection)
    empty = gaps(projection)
    positions = [0]
    for index in range(1, count):
        target = index*length/count
        candidates = [(a+b)//2 for a, b in empty if abs((a+b)/2-target) < length/count*.42]
        if not candidates:
            raise ValueError(f'No clear gutter near {target:.0f}; inspect source and supply a crop override.')
        positions.append(min(candidates, key=lambda value: abs(value-target)))
    return [*positions, length]


def crop_cells(sheet, override=None):
    if override:
        return [sheet.crop(tuple(box)) for box in override]
    mask = sheet.getchannel('A').point(lambda alpha: 255 if alpha > 55 else 0)
    try:
        rows = divisions(mask.getprojection()[1], 3)
        cells = []
        for top, bottom in zip(rows, rows[1:]):
            columns = divisions(mask.crop((0, top, sheet.width, bottom)).getprojection()[0], 4)
            cells.extend(sheet.crop((left, top, right, bottom)) for left, right in zip(columns, columns[1:]))
        return cells
    except ValueError:
        return connected_cells(sheet)


def connected_cells(sheet):
    """Separate disjoint silhouettes whose bounding boxes overlap a gutter."""
    occupied = np.asarray(sheet.getchannel('A')) > 55
    labels = np.zeros(occupied.shape, dtype=np.int32)
    parents, previous = [0], []

    def root(label):
        while parents[label] != label:
            parents[label] = parents[parents[label]]
            label = parents[label]
        return label

    for y, row in enumerate(occupied):
        edges = np.flatnonzero(np.diff(np.r_[False, row, False]))
        current = []
        for left, right in zip(edges[::2], edges[1::2]):
            adjacent = [label for start, end, label in previous if end >= left and start <= right]
            label = len(parents)
            parents.append(label)
            for other in adjacent:
                parents[root(other)] = root(label)
            labels[y, left:right] = label
            current.append((left, right, label))
        previous = current
    lookup = np.array([root(label) for label in range(len(parents))])
    labels = lookup[labels]
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    chosen = np.argsort(sizes)[-12:]
    if sizes[chosen].min() < 900:
        raise ValueError('Fewer than twelve separate complete specimens; inspect the sheet.')
    specimens = []
    for label in chosen:
        selected = labels == label
        ys, xs = np.where(selected)
        mask = Image.fromarray(selected.astype('uint8')*255).filter(ImageFilter.MaxFilter(3))
        isolated = sheet.copy()
        isolated.putalpha(ImageChops.multiply(sheet.getchannel('A'), mask))
        specimens.append(((float(xs.mean()), float(ys.mean())), isolated))
    specimens.sort(key=lambda item:item[0][1])
    result = []
    for row in range(3):
        result.extend(item[1] for item in sorted(specimens[row*4:(row+1)*4], key=lambda item:item[0][0]))
    return result


def trim(image):
    bounds = image.getchannel('A').point(lambda alpha: 255 if alpha > 55 else 0).getbbox()
    if not bounds:
        raise ValueError('An empty specimen cell was found.')
    return image.crop(bounds)


def fitted(image, canvas, scale=None):
    image = trim(image)
    if scale is None:
        scale = min((canvas[0]-24)/image.width, (canvas[1]-24)/image.height)
    size = (max(1, round(image.width*scale)), max(1, round(image.height*scale)))
    if size[0] > canvas[0]-4 or size[1] > canvas[1]-4:
        raise ValueError(f'Sprite would clip at {size}; inspect source poses.')
    image = image.resize(size, Image.Resampling.LANCZOS)
    output = Image.new('RGBA', canvas)
    output.alpha_composite(image, ((canvas[0]-size[0])//2, (canvas[1]-size[1])//2))
    return output


def encode_gif(frames, path, duration, alpha_threshold=110):
    strip = Image.new('RGB', (CANVAS[0]*len(frames), CANVAS[1]))
    for index, frame in enumerate(frames):
        strip.paste(frame.convert('RGB'), (CANVAS[0]*index, 0))
    palette = strip.quantize(colors=255)
    indexed = []
    for frame in frames:
        item = frame.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE)
        item.paste(255, mask=frame.getchannel('A').point(lambda alpha: 255 if alpha < alpha_threshold else 0))
        item.info['transparency'] = 255
        indexed.append(item)
    indexed[0].save(path, save_all=True, append_images=indexed[1:], duration=duration,
                    loop=0, transparency=255, disposal=2, optimize=False)


def assemble(species):
    folder = ART/species['id']
    source = folder/'source-sheet.png'
    sheet = Image.open(source).convert('RGBA')
    if sheet.getchannel('A').getextrema()[0] != 0:
        raise ValueError('Expected genuine transparent artwork.')
    overrides = json.loads((folder/'crop-overrides.json').read_text()) if (folder/'crop-overrides.json').exists() else None
    cells = crop_cells(sheet, overrides)
    poses = [trim(cell) for cell in cells[:8]]
    scale = 160/poses[0].width
    frames = [fitted(pose, CANVAS, scale) for pose in poses]
    clearwing = species['id']=='hummingbird-clearwing'
    # GIF has binary alpha: translucent clearwing membranes become transparent,
    # while the more opaque wing borders and veins remain visible.
    encode_gif(frames, folder/'flight.gif', 30 if clearwing else 65, 240 if clearwing else 110)
    for stage, cell in [('caterpillar', cells[8]), ('pupa', cells[9]), ('adult', cells[10])]:
        fitted(cell, (320, 256)).save(folder/f'{stage}.webp', quality=91, method=6)
    fitted(cells[11], CANVAS).save(folder/'rest.webp', quality=91, method=6)
    gif = Image.open(folder/'flight.gif')
    if not gif.is_animated or gif.n_frames < 4 or gif.info.get('loop') != 0:
        raise ValueError('The flight asset must be an endlessly looping multi-frame GIF.')
    strip = Image.new('RGBA', (CANVAS[0]*gif.n_frames, CANVAS[1]))
    for index in range(gif.n_frames):
        gif.seek(index)
        frame = gif.convert('RGBA')
        strip.paste(frame, (index*CANVAS[0], 0))
        frame.save(folder/f'pose-{index}.webp', lossless=True, method=6)
    strip.save(folder/'flight-sheet.webp', lossless=True, method=6)
    metadata = {'id':species['id'], 'frames':gif.n_frames, 'canvas':list(CANVAS), 'openWingspanPixels':160,
                'gifBytes':(folder/'flight.gif').stat().st_size, 'transparent':True}
    (folder/'asset.json').write_text(json.dumps(metadata, indent=2)+'\n')
    return metadata, frames


def previews():
    background = (234, 219, 183)
    contact = Image.new('RGB', (1680, 4*290), background)
    flights = Image.new('RGB', (8*100, len(SPECIES)*135), background)
    draw = ImageDraw.Draw(contact)
    font_path = Path('C:/Windows/Fonts/segoeui.ttf')
    font = ImageFont.truetype(str(font_path), 18) if font_path.exists() else ImageFont.load_default()
    small = ImageFont.truetype(str(font_path), 13) if font_path.exists() else ImageFont.load_default()
    for index, species in enumerate(SPECIES):
        folder = ART/species['id']
        if not (folder/'flight.gif').exists():
            continue
        x, y = index%4*420, index//4*290
        draw.text((x+12, y+10), species['name'], fill='#51422d', font=font)
        for column, stage in enumerate(['caterpillar','pupa','adult']):
            artwork = Image.open(folder/f'{stage}.webp').convert('RGBA')
            artwork.thumbnail((130,195), Image.Resampling.LANCZOS)
            contact.paste(artwork, (x+column*136+(136-artwork.width)//2, y+45+(195-artwork.height)//2), artwork)
            draw.text((x+column*136+12, y+245), ['Caterpillar',species['pupaLabel'],'Adult'][column],fill='#51422d',font=small)
        gif = Image.open(folder/'flight.gif')
        for frame_index in range(gif.n_frames):
            gif.seek(frame_index)
            frame = gif.convert('RGBA')
            frame.thumbnail((96,112), Image.Resampling.LANCZOS)
            flights.paste(frame, (frame_index*100,index*135),frame)
        ImageDraw.Draw(flights).text((8,index*135+113),species['name'],fill='#51422d',font=small)
    output = ROOT/'output'
    output.mkdir(exist_ok=True)
    contact.save(output/'butterfly-life-cycles.png')
    flights.save(output/'butterfly-flight-frames.png')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--id')
    parser.add_argument('--available', action='store_true')
    arguments = parser.parse_args()
    selected = [species for species in SPECIES if not arguments.id or species['id']==arguments.id]
    records = []
    for species in selected:
        if arguments.available and not (ART/species['id']/'source-sheet.png').exists():
            continue
        try:
            metadata, _ = assemble(species)
            records.append(metadata)
            print(json.dumps(metadata))
        except Exception as error:
            print(f"FAILED {species['id']}: {error}")
            raise
    previews()
