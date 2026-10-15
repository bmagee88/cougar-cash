"""Assemble generated twelve-pose sheets without redrawing the caterpillars."""
import argparse
import importlib.util
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'public/assets/fishing/butterflies'
SPECIES = json.loads((ROOT / 'src/FishingTypingGame/data/butterflies.json').read_text(encoding='utf-8'))
spec = importlib.util.spec_from_file_location('lake_insect_assembly', ROOT/'scripts/assemble-lake-insects.py')
assembly = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assembly)
CANVAS = (320, 160)
DURATIONS = [160,110,110,100,110,120,140,100,110,110,100,160]


def assemble(species):
    folder = ART / species['id']
    with Image.open(folder/'caterpillar-crawl-sheet.png') as source:
        sheet = source.convert('RGBA')
    if sheet.getchannel('A').getextrema()[0] != 0:
        raise ValueError('A genuinely transparent source sheet is required.')
    cells = [assembly.trim(cell) for cell in assembly.crop_cells(sheet)]
    scale = min(288/max(cell.width for cell in cells), 136/max(cell.height for cell in cells))
    frames = []
    for cell in cells:
        cell = cell.resize((max(1,round(cell.width*scale)),max(1,round(cell.height*scale))),Image.Resampling.LANCZOS)
        frame = Image.new('RGBA',CANVAS)
        frame.alpha_composite(cell,((CANVAS[0]-cell.width)//2,148-cell.height))
        frames.append(frame)
    palette_strip = Image.new('RGB',(CANVAS[0]*len(frames),CANVAS[1]))
    for index,frame in enumerate(frames):
        palette_strip.paste(frame.convert('RGB'),(index*CANVAS[0],0))
    palette = palette_strip.quantize(colors=255)
    indexed = []
    for frame in frames:
        item = frame.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE)
        item.paste(255,mask=frame.getchannel('A').point(lambda a:255 if a<90 else 0))
        item.info['transparency']=255
        indexed.append(item)
    destination = folder/'caterpillar-crawl.gif'
    indexed[0].save(destination,save_all=True,append_images=indexed[1:],duration=DURATIONS,loop=0,transparency=255,disposal=2,optimize=False)
    with Image.open(destination) as gif:
        assert gif.is_animated and gif.n_frames == 12 and gif.info['loop'] == 0
    metadata={'id':species['id'],'frames':12,'canvas':list(CANVAS),'durationsMs':DURATIONS,'transparent':True,'gifBytes':destination.stat().st_size}
    (folder/'caterpillar-animation.json').write_text(json.dumps(metadata,indent=2)+'\n')
    return metadata


def preview():
    contact=Image.new('RGB',(1280,14*185),'#eadbb7')
    draw=ImageDraw.Draw(contact)
    font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',15)
    for row,species in enumerate(SPECIES):
        file=ART/species['id']/'caterpillar-crawl.gif'
        if not file.exists():
            continue
        draw.text((12,row*185+5),species['name'],font=font,fill='#51422d')
        with Image.open(file) as gif:
            for column,index in enumerate([0,3,6,9]):
                gif.seek(index)
                contact.paste(gif.convert('RGBA'),(column*320,row*185+25),gif.convert('RGBA'))
    contact.save(ROOT/'output/caterpillar-crawl-frames.png')


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--available',action='store_true')
    parser.add_argument('--id')
    args=parser.parse_args()
    for species in SPECIES:
        if args.id and species['id']!=args.id:
            continue
        if args.available and not (ART/species['id']/'caterpillar-crawl-sheet.png').exists():
            continue
        print(json.dumps(assemble(species)),flush=True)
    preview()
