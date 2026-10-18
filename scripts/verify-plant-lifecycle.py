"""Verify all runtime cutouts, retained alpha, and traced opaque perch pixels."""
import json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
catalog=json.loads((ROOT/'src/FishingTypingGame/data/plant-art-v1.json').read_text())
count=0;size=0
for species,library in catalog.items():
 assert set(library)=={'foliage-spring','foliage-summer','foliage-autumn','foliage-winter','stem','bud','bloom','seed','withering'},(species,set(library))
 for stage,art in library.items():
  source=ROOT/'public/assets/fishing'/art['image'];im=Image.open(source).convert('RGBA');count+=1;size+=source.stat().st_size
  assert im.size==(art['width'],art['height']),(species,stage,im.size)
  assert max(im.size)<=320
  alpha=im.getchannel('A');lo,hi=alpha.getextrema()
  assert lo<=2 and hi>=240,(species,stage,'missing transparency')
  assert sum(alpha.histogram()[:6])>im.width*im.height*.05,(species,stage,'opaque backdrop')
  x=round(art['perch']['x']*im.width);y=round(art['perch']['y']*im.height)
  region=alpha.crop((max(0,x-2),max(0,y-2),min(im.width,x+3),min(im.height,y+3)))
  assert region.getextrema()[1]>96,(species,stage,'perch not on paint')
  for axis in ('x','y'):assert 0<=art['root'][axis]<=1
print(f'PASS: {count} RGBA cutouts; all perch pixels touch painted art; {size:,} runtime bytes')
