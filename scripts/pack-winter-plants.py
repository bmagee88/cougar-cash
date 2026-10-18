"""Pack generated winter foliage; preserve painted pixels and generated alpha.

Only crop/rescale/encode, then trace actual root and perch contacts. Existing
season/stage cutouts and deterministic lifecycle data are left in place.
"""
import json, re, shutil
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'output/plant-lifecycle-art/winter'
METADATA=ROOT/'src/FishingTypingGame/data/plant-art-v1.json'
catalog=json.loads(METADATA.read_text())
report=[]
for species in catalog:
 record=json.loads((SOURCE/f'{species}.json').read_text())
 local=SOURCE/f'{species}-source.png'
 if not local.exists():
  source=record.get('source')
  if not source:
   hint=json.loads((SOURCE/f'{species}-result.json').read_text())['output_hint']
   # image_gen's saved-path hint is retained verbatim for provenance.
   matches=re.findall(r'[A-Za-z]:[\\/][^:\r\n]*?\.png',hint)
   source=next((candidate for candidate in matches if Path(candidate).is_file()),None)
  if not source:raise ValueError(f'Missing generated source for {species}')
  shutil.copy2(source,local)
  record['source']=source
 im=Image.open(local).convert('RGBA')
 mask=im.getchannel('A').point(lambda value:255 if value>48 else 0)
 box=mask.getbbox()
 if not box:raise ValueError(f'Empty winter foliage: {species}')
 box=(max(0,box[0]-5),max(0,box[1]-5),min(im.width,box[2]+5),min(im.height,box[3]+5))
 crop=im.crop(box);alpha=crop.getchannel('A');w,h=crop.size
 def opaque_point(y,lo=0,hi=None):
  xs=[x for x in range(lo,hi or w) if alpha.getpixel((x,y))>96]
  return min(xs,key=lambda x:abs(x-w/2)) if xs else None
 if species in ('water-lily','lotus'):root_x,root_y=w/2,h/2
 else:
  root_y=max(y for y in range(h) if opaque_point(y,int(w*.35),int(w*.65)) is not None)
  root_x=opaque_point(root_y,int(w*.35),int(w*.65))
 top=next(y for y in range(h) if opaque_point(y) is not None)
 perch_y=min(h-1,top+max(3,int(h*.10)));perch_x=opaque_point(perch_y)
 while perch_x is None and perch_y<h-1:perch_y+=1;perch_x=opaque_point(perch_y)
 factor=min(1,320/max(w,h));size=(max(1,round(w*factor)),max(1,round(h*factor)))
 target=ROOT/f'public/assets/fishing/plants/v1/{species}/foliage-winter.webp'
 crop.resize(size,Image.Resampling.LANCZOS).save(target,'WEBP',quality=91,method=6,exact=True)
 catalog[species]['foliage-winter']={'image':f'plants/v1/{species}/foliage-winter.webp','width':size[0],'height':size[1],
  'root':{'x':round(root_x/w,6),'y':round(root_y/h,6)},'perch':{'x':round(perch_x/w,6),'y':round(perch_y/h,6)}}
 record['runtime']=str(target.relative_to(ROOT)).replace('\\','/')
 (SOURCE/f'{species}.json').write_text(json.dumps(record,indent=2)+'\n')
 report.append({'species':species,'bytes':target.stat().st_size})
METADATA.write_text(json.dumps(catalog,indent=2)+'\n')
(SOURCE/'manifest.json').write_text(json.dumps({'tool':'built-in image_gen','assets':[json.loads((SOURCE/f"{item['species']}.json").read_text()) for item in report]},indent=2)+'\n')
print(f'{len(report)} winter cutouts, {sum(item["bytes"] for item in report):,} bytes')
