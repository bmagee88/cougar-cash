"""Pack ImageGen bird cutouts into aligned GIFs and the game's WebP sheets.

Requires Pillow, numpy and opencv-python. No artwork is drawn here. The right
views mirror the generated left views; originals and exact prompts are retained
in output/painted-tree-birds-v2. Run with --check to validate saved deliverables.
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'output/painted-tree-birds-v2'
DEST = ROOT / 'public/assets/fishing/visitors/tree-birds'
DIRECTIONS = ['front', 'front-left', 'front-right', 'back', 'back-left', 'back-right']
SIZE = 192
RUNTIME_SIZE = 128


def extract(job):
    rgba = np.array(Image.open(ROOT / job['source']).convert('RGBA'))
    height, width = rgba.shape[:2]
    count, labels, stats, centers = cv2.connectedComponentsWithStats((rgba[:, :, 3] > 100).astype('uint8'), 8)
    # The generated wing tips can cross the nominal grid. Extract entire opaque
    # connected birds instead of cutting at grid boundaries and clipping wings.
    birds = [i for i in range(1, count) if stats[i, 4] > 1500]
    birds.sort(key=lambda i: (int(centers[i, 1] // (height / 3)), centers[i, 0]))
    assert len(birds) == 12, (job['id'], len(birds))
    result = []
    for index, component in enumerate(birds):
        x, y, w, h, _ = stats[component]
        mask = cv2.dilate((labels == component).astype('uint8'), np.ones((7, 7), 'uint8'))
        alpha = np.where(mask, rgba[:, :, 3], 0).astype('uint8')
        alpha[alpha < 25] = 0
        cutout = rgba.copy()
        cutout[:, :, 3] = alpha
        # Anchor the torso above the central tail. Wings never determine the
        # anchor, so expanding a wing does not move the body around the frame.
        cx = (index % 4 + .5) * width / 4
        strip = alpha[:, max(0, round(cx - 25)):min(width, round(cx + 25))]
        ys = np.where(strip > 100)[0]
        bottom = int(np.quantile(ys, .995))
        ay = bottom - height / 3 * .205
        y0, y1 = max(0, round(ay - 18)), min(height, round(ay + 18))
        x0, x1 = max(0, round(cx - 65)), min(width, round(cx + 65))
        body = alpha[y0:y1, x0:x1]
        weights = (body > 150).sum(axis=0)
        ax = x0 + float(np.average(np.arange(len(weights)), weights=weights))
        box = Image.fromarray(alpha).getbbox()
        result.append((Image.fromarray(cutout).crop(box), (ax - box[0], ay - box[1]), box))
    return result


def gif(path, frames, durations):
    # One shared palette prevents color flicker. Reserve index 255 for alpha;
    # disposal=2 clears each previous pose so wide wings leave no trails.
    strip = Image.new('RGBA', (SIZE * len(frames), SIZE))
    for i, frame in enumerate(frames):
        strip.alpha_composite(frame, (SIZE * i, 0))
    palette = strip.convert('RGB').quantize(colors=255)
    indexed = []
    for frame in frames:
        item = frame.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE)
        item.paste(255, mask=frame.getchannel('A').point(lambda a: 255 if a < 100 else 0))
        indexed.append(item)
    indexed[0].save(path, save_all=True, append_images=indexed[1:], duration=durations,
                    loop=0, transparency=255, disposal=2, optimize=False)
    with Image.open(path) as saved:
        return {'file': path.name, 'frames': saved.n_frames, 'width': SIZE, 'height': SIZE,
                'durationMs': sum(saved.seek(i) or saved.info['duration'] for i in range(saved.n_frames)),
                'bytes': path.stat().st_size}


def validate():
    metadata = json.loads((DEST / 'painted-assets.json').read_text())
    assert metadata['directions'] == DIRECTIONS
    for species, record in metadata['species'].items():
        folder = DEST / species
        with Image.open(folder / 'flight-sheet.webp') as sheet:
            assert sheet.size == (RUNTIME_SIZE * 12, RUNTIME_SIZE * 6)
            assert sheet.mode == 'RGBA'
            for row in range(6):
                for column in range(12):
                    frame = sheet.crop((column * RUNTIME_SIZE, row * RUNTIME_SIZE,
                                        (column + 1) * RUNTIME_SIZE, (row + 1) * RUNTIME_SIZE))
                    box = frame.getchannel('A').point(lambda a: 255 if a > 100 else 0).getbbox()
                    assert box and min(box[:2]) >= 1 and max(box[2:]) < RUNTIME_SIZE
        for direction, states in record['animations'].items():
            assert direction in DIRECTIONS
            for state, info in states.items():
                with Image.open(folder / info['file']) as animation:
                    assert animation.format == 'GIF' and animation.size == (SIZE, SIZE)
                    assert animation.n_frames == info['frames']
                    assert animation.info.get('loop') == 0
                    assert animation.info.get('transparency') == 255
                    assert animation.n_frames >= (8 if state == 'wingbeat' else 3)
    print('Validated 144 painted poses and 48 transparent directional GIFs.', flush=True)


def main():
    if '--check' in sys.argv:
        validate()
        return
    manifest = json.loads((SOURCE / 'sources.json').read_text())
    jobs = {job['id']: extract(job) for job in manifest['sources']}
    metadata = {'generator': 'built-in image_gen', 'gifFrameSize': SIZE,
                'runtimeFrameSize': RUNTIME_SIZE, 'columns': 12, 'rows': 6,
                'directions': DIRECTIONS, 'wingFrames': list(range(8)), 'glideFrame': 8,
                'brakeFrames': [9, 10, 11], 'mirroredDirections': manifest['mirroredDirections'], 'species': {}}
    alignment = {}
    review = Image.new('RGB', (SIZE * 12, (SIZE + 24) * 12), '#334d49')
    draw = ImageDraw.Draw(review)
    for species_index, species in enumerate(['cardinal', 'sparrow']):
        folder = DEST / species
        folder.mkdir(parents=True, exist_ok=True)
        original = [pose for view in ['front', 'front-left', 'back', 'back-left'] for pose in jobs[f'{species}-{view}']]
        scale = min(min(89 / max(ax, image.width - ax), 96 / max(ay, 1), 78 / max(image.height - ay, 1))
                    for image, (ax, ay), _ in original)
        sheet = Image.new('RGBA', (RUNTIME_SIZE * 12, RUNTIME_SIZE * 6))
        record = {'sheet': f'{species}/flight-sheet.webp', 'animations': {}}
        for row, direction in enumerate(DIRECTIONS):
            source_direction = manifest['mirroredDirections'].get(direction, direction)
            poses = jobs[f'{species}-{source_direction}']
            frames = []
            for image, (ax, ay), box in poses:
                resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
                frame = Image.new('RGBA', (SIZE, SIZE))
                frame.alpha_composite(resized, (96 - round(ax * scale), 104 - round(ay * scale)))
                if direction in manifest['mirroredDirections']:
                    frame = frame.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
                frames.append(frame)
            alignment[f'{species}-{direction}'] = {'scale': scale, 'sourceBoxes': [box for _, _, box in poses],
                                                  'anchors': [anchor for _, anchor, _ in poses]}
            for column, frame in enumerate(frames):
                sheet.alpha_composite(frame.resize((RUNTIME_SIZE, RUNTIME_SIZE), Image.Resampling.LANCZOS), (column * RUNTIME_SIZE, row * RUNTIME_SIZE))
                y = (species_index * 6 + row) * (SIZE + 24)
                review.paste(frame, (column * SIZE, y + 24), frame)
            draw.text((4, y + 5), f'{species} / {direction}: 8 wingbeats | glide | 3 landing poses', fill='white')
            # The exported glide gently banks the generated level-wing pose.
            # The live game gets that motion from its original curved path.
            rolls = [0, .5, 1, 1.5, 2, 1.5, 1, .5, 0, -.5, -1, -1.5, -2, -1.5, -1, -.5]
            glide = [frames[8].rotate(angle, Image.Resampling.BICUBIC) for angle in rolls]
            record['animations'][direction] = {
                'wingbeat': gif(folder / f'{direction}-wingbeat.gif', frames[:8], [50] * 8),
                'glide': gif(folder / f'{direction}-glide.gif', glide, [80] * 16),
                'slowdown': gif(folder / f'{direction}-slowdown.gif', frames[9:], [160, 220, 600]),
                'flight': gif(folder / f'{direction}.gif', frames[:8] * 2 + frames[8:], [50] * 16 + [750, 160, 220, 600]),
            }
        sheet.save(folder / 'flight-sheet.webp', quality=88, method=6, alpha_quality=100)
        record['sheetBytes'] = (folder / 'flight-sheet.webp').stat().st_size
        metadata['species'][species] = record
        print(species, '72 poses;', record['sheetBytes'], 'runtime bytes;', 'scale', round(scale, 4), flush=True)
    (DEST / 'painted-assets.json').write_text(json.dumps(metadata, indent=2) + '\n')
    (SOURCE / 'alignment.json').write_text(json.dumps(alignment, indent=2) + '\n')
    review.resize((1536, 1728), Image.Resampling.LANCZOS).save(SOURCE / 'directional-review.jpg', quality=93)
    validate()


if __name__ == '__main__':
    main()
