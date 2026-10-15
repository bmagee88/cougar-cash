"""Losslessly extract existing GIF frames for synchronized canvas drawing/picking."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent


def extract(folder):
    with Image.open(folder / 'flight.gif') as gif:
        width, height = gif.size
        strip = Image.new('RGBA', (width * gif.n_frames, height))
        for index in range(gif.n_frames):
            gif.seek(index)
            frame = gif.convert('RGBA')
            strip.paste(frame, (width * index, 0))
            frame.save(folder / f'pose-{index}.webp', lossless=True, method=6)
        strip.save(folder / 'flight-sheet.webp', lossless=True, method=6)
        return gif.n_frames


if __name__ == '__main__':
    for folder in sorted((ROOT / 'public/assets/fishing/butterflies').iterdir()):
        if (folder / 'flight.gif').is_file():
            print(f'{folder.name}: {extract(folder)} frames', flush=True)
