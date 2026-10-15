"""Assemble the requested GIF from generated wing poses; never redraw the art."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'public/assets/fishing'
sheet = Image.open(ART / 'effects/butterfly-wingbeat-sheet.png').convert('RGBA')
# Generated poses have slightly uneven margins. These nonoverlapping cells
# retain each complete butterfly; align the antenna/wing envelopes afterward.
cells = [(0,0,528,440),(528,0,956,440),(956,0,1396,440),(1396,0,1774,440),
         (0,443,443,887),(443,443,854,887),(854,443,1293,887),(1293,443,1774,887)]
frames=[]
for box in cells:
    pose=sheet.crop(box)
    bounds=pose.getchannel('A').point(lambda a:255 if a>70 else 0).getbbox()
    pose=pose.crop(bounds)
    pose=pose.resize((round(pose.width*94/pose.height),94),Image.Resampling.LANCZOS)
    frame=Image.new('RGBA',(160,112))
    frame.alpha_composite(pose,((160-pose.width)//2,8))
    frames.append(frame)
# GIF has binary transparency: reserve index 255, including palette images
# where fewer colors would otherwise allow the transparent slot to be reused.
palette=Image.new('RGB',(160*8,112))
for i,frame in enumerate(frames):palette.paste(frame.convert('RGB'),(i*160,0))
palette=palette.quantize(colors=255)
indexed=[]
for frame in frames:
    image=frame.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE)
    image.paste(255,mask=frame.getchannel('A').point(lambda a:255 if a<110 else 0))
    image.info['transparency']=255
    indexed.append(image)
indexed[0].save(ART/'effects/butterfly-flutter.gif',save_all=True,append_images=indexed[1:],duration=30,loop=0,transparency=255,disposal=2,optimize=False)
frames[3].save(ART/'effects/butterfly-perched.png')
(ART/'optimized/effects').mkdir(parents=True,exist_ok=True)
frames[3].save(ART/'optimized/effects/butterfly-perched.webp',quality=94,method=6)
print('Butterfly GIF:', (ART/'effects/butterfly-flutter.gif').stat().st_size,'bytes, 8 frames, 160 x 112')
