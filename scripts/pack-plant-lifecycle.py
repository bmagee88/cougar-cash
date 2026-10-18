"""Pack generated RGBA atlas cells; preserve their painted pixels and alpha.

No recoloring, synthetic stems, or background replacement. The alpha threshold
only traces bounds/contact pixels; the saved cutout keeps the original alpha.
"""
import json, shutil
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'output/plant-lifecycle-art'
manifest=json.loads((SOURCE/'manifest.json').read_text())
names=['foliage-spring','foliage-summer','foliage-autumn','stem','bud','bloom','seed','withering']
metadata=ROOT/'src/FishingTypingGame/data/plant-art-v1.json'
existing=json.loads(metadata.read_text()) if metadata.exists() else {}
result={}
for row in manifest['atlases']:
 species=row['id'];source=SOURCE/f'{species}-atlas.png'
 if not source.exists():shutil.copy2(row['source'],source)
 im=Image.open(source).convert('RGBA');cw,ch=im.width//4,im.height//2
 images={key:art for key,art in existing.get(species,{}).items() if key=='foliage-winter'}
 for index,name in enumerate(names):
  col,line=index%4,index//4
  cell=im.crop((col*cw,line*ch,(col+1)*cw,(line+1)*ch))
  mask=cell.getchannel('A').point(lambda a:255 if a>48 else 0);box=mask.getbbox()
  if not box:raise ValueError(f'Missing sprite: {species}/{name}')
  box=(max(0,box[0]-5),max(0,box[1]-5),min(cw,box[2]+5),min(ch,box[3]+5))
  crop=cell.crop(box);trace=crop.getchannel('A');w,h=crop.size
  # Find an actual opaque contact and perch pixel, not transparent padding.
  def opaque_point(y,preference=.5):
   xs=[x for x in range(w) if trace.getpixel((x,y))>96]
   return min(xs,key=lambda x:abs(x-preference*w)) if xs else None
  root_y=max(y for y in range(h) if opaque_point(y) is not None)
  root_x=opaque_point(max(0,root_y-2))
  if root_x is None:root_x=opaque_point(root_y)
  target_y=next(y for y in range(h) if opaque_point(y) is not None)+max(3,int(h*.10))
  perch_y=min(h-1,target_y);perch_x=opaque_point(perch_y)
  while perch_x is None and perch_y<h-1:perch_y+=1;perch_x=opaque_point(perch_y)
  if species in ('water-lily','lotus') and name.startswith('foliage'):root_x,root_y=w/2,h/2
  factor=min(1,320/max(w,h));new_size=(max(1,round(w*factor)),max(1,round(h*factor)))
  packed=crop.resize(new_size,Image.Resampling.LANCZOS)
  target=ROOT/f'public/assets/fishing/plants/v1/{species}/{name}.webp';target.parent.mkdir(parents=True,exist_ok=True)
  packed.save(target,'WEBP',quality=91,method=6,exact=True)
  images[name]={'image':f'plants/v1/{species}/{name}.webp','width':new_size[0],'height':new_size[1],
   'root':{'x':round(root_x/w,6),'y':round(root_y/h,6)},'perch':{'x':round(perch_x/w,6),'y':round(perch_y/h,6)}}
 result[species]=images
(ROOT/'src/FishingTypingGame/data/plant-art-v1.json').write_text(json.dumps(result,indent=2)+'\n')
files=list((ROOT/'public/assets/fishing/plants/v1').rglob('*.webp'))
print(f'{len(files)} cutouts, {sum(p.stat().st_size for p in files):,} bytes; metadata written')
