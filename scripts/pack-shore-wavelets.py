"""Crop/encode generated wavelets and caustic overlay, preserving their alpha.
The original ImageGen sources remain untouched. No artwork is drawn/repainted.
"""
from pathlib import Path
import json
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
GENERATED=Path('C:/Users/Kathleen Dippyolito/.codex/generated_images/01a149bf-9559-7c21-bd97-ac31ba63fa62')
target=ROOT/'public/assets/fishing/effects/shore-wavelets'
target.mkdir(parents=True,exist_ok=True)
atlas=Image.open(GENERATED/'exec-d1357955-d4d1-4365-b43c-ef8d9718fc12.png').convert('RGBA')
records=[]
for n in range(6):
    row,col=divmod(n,2)
    cell=atlas.crop((col*768,round(row*1024/3),(col+1)*768,round((row+1)*1024/3)))
    box=cell.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox()
    assert box
    sprite=cell.crop((max(0,box[0]-5),max(0,box[1]-5),min(cell.width,box[2]+5),min(cell.height,box[3]+5)))
    sprite.thumbnail((384,128),Image.Resampling.LANCZOS)
    frame=Image.new('RGBA',(sprite.width+8,sprite.height+8));frame.alpha_composite(sprite,(4,4))
    highlights=[(y,a) for y in range(frame.height) for x in range(frame.width)
                for r,g,b,a in [frame.getpixel((x,y))] if a>80 and (r+g+b)/3>145]
    assert highlights
    crest_y=sum(y*a for y,a in highlights)/sum(a for y,a in highlights)/frame.height
    name=f'wavelet-{n}.webp';frame.save(target/name,quality=88,method=6)
    records.append({'image':f'effects/shore-wavelets/{name}','width':frame.width,'height':frame.height,'crestY':round(crest_y,5)})
    print(name,frame.size,'crest',round(crest_y,3))
caustic=Image.open(GENERATED/'exec-87722df2-bf0c-4f5d-b073-b3c47f38c87a.png').convert('RGBA')
caustic.thumbnail((512,384),Image.Resampling.LANCZOS)
caustic.save(target/'caustic-light.webp',quality=84,method=6)
(ROOT/'src/FishingTypingGame/data/shore-wavelets.json').write_text(json.dumps(records,indent=2)+'\n')
print('caustic-light.webp',caustic.size)
print('Total bytes:',sum(p.stat().st_size for p in target.glob('*.webp')))
