"""Pack generated cutouts and wing poses; derive flower anchors from their pixels.
No artwork is redrawn. Original atlases and prompts stay in output/garden-art.
"""
import json
import math
from pathlib import Path
from PIL import Image, ImageFilter, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'output/garden-art'
ART=ROOT/'public/assets/fishing'
JOBS=json.loads((SOURCE/'sources.json').read_text())

def cells(image,columns,rows):
    return [image.crop((round(x*image.width/columns),round(y*image.height/rows),
                        round((x+1)*image.width/columns),round((y+1)*image.height/rows)))
            for y in range(rows) for x in range(columns)]

def thorax(cell):
    # Thick alpha excludes antennae and feet. The forwardmost thick structure
    # is the head in these right-facing side views; anchor just behind it.
    solid=cell.getchannel('A').point(lambda a:255 if a>100 else 0).filter(ImageFilter.MinFilter(9))
    box=solid.getbbox()
    if not box: raise ValueError('Empty pose')
    right=box[2]-1; samples=[]
    for y in range(box[1],box[3]):
        score=sum(solid.getpixel((x,y))>0 for x in range(max(0,right-9),right+1))
        samples.extend([y]*score)
    return right-cell.width*.065, sorted(samples)[len(samples)//2]+cell.height*.012

def gif_and_sheet(folder,frames):
    sheet=Image.new('RGBA',(96*8,112))
    for i,frame in enumerate(frames):
        frame.save(folder/f'side-small-pose-{i}.webp',lossless=True,method=6)
        sheet.alpha_composite(frame,(i*96,0))
    sheet.save(folder/'flight-side-small-sheet.webp',lossless=True,method=6)
    palette=sheet.convert('RGB').quantize(colors=255)
    indexed=[]
    for frame in frames:
        item=frame.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE)
        item.paste(255,mask=frame.getchannel('A').point(lambda a:255 if a<95 else 0));indexed.append(item)
    indexed[0].save(folder/'flight-side-small.gif',save_all=True,append_images=indexed[1:],duration=35,loop=0,transparency=255,disposal=2,optimize=False)
    with Image.open(folder/'flight-side-small.gif') as result:
        assert result.n_frames==8 and result.size==(96,112)
    return sheet

strips=[];alignment={}
for name in ['monarch','eastern-tiger-swallowtail']:
    folder=ART/'butterflies'/name
    frames=[Image.open(folder/f'side-pose-{i}.webp').convert('RGBA').resize((96,112),Image.Resampling.LANCZOS) for i in range(8)]
    strips.append((name,gif_and_sheet(folder,frames)))
for job in [item for item in JOBS if item['kind']=='side']:
    name=job['id']; image=Image.open(ROOT/job['source']).convert('RGBA');poses=cells(image,4,2)
    anchors=[thorax(cell) for cell in poses];alignment[name]=anchors
    edges=[]
    for cell,(x,y) in zip(poses,anchors):
        box=cell.getchannel('A').point(lambda a:255 if a>55 else 0).getbbox()
        edges.append((x-box[0],box[2]-x,y-box[1],box[3]-y))
    scale=min([44/max(1,edge[n]) for edge in edges for n in [0,1]]+
              [52/max(1,edge[n]) for edge in edges for n in [2,3]])
    frames=[]
    for cell,(x,y) in zip(poses,anchors):
        small=cell.resize((round(cell.width*scale),round(cell.height*scale)),Image.Resampling.LANCZOS)
        frame=Image.new('RGBA',(96,112));frame.alpha_composite(small,(48-round(x*scale),56-round(y*scale)));frames.append(frame)
    strips.append((name,gif_and_sheet(ART/'butterflies'/name,frames)))
    print(name,'8 frames, 96x112',flush=True)
(SOURCE/'side-alignment.json').write_text(json.dumps(alignment,indent=2))
review=Image.new('RGB',(2*800,7*136),(45,63,65));draw=ImageDraw.Draw(review)
for i,(name,strip) in enumerate(strips):
    x=(i//7)*800;y=(i%7)*136;draw.text((x+4,y+2),name,fill='white');review.paste(strip,(x,y+20),strip.getchannel('A'))
review.save(SOURCE/'side-flights-review.png')

def components(mask,width,height):
    unseen=set(mask);groups=[]
    while unseen:
        start=unseen.pop();queue=[start];group=[]
        while queue:
            x,y=queue.pop();group.append((x,y))
            for point in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
                if point in unseen: unseen.remove(point);queue.append(point)
        if len(group)>=4:groups.append(group)
    return sorted(groups,key=len,reverse=True)

def flower_anchors(frame):
    pixels=frame.load();colored=[];green=[]
    for y in range(frame.height):
        for x in range(frame.width):
            r,g,b,a=pixels[x,y]
            if a<100:continue
            if g>r*1.05 and g>b*1.1:green.append((x,y))
            bloom=((r>g*1.20 and b>g*.95) or (b>g*1.15 and r>g*.85) or
                   (min(r,g,b)>175 and max(r,g,b)-min(r,g,b)<45))
            if bloom and y<frame.height*.73:colored.append((x,y))
    result=[]
    for group in components(colored,frame.width,frame.height):
        x=sum(p[0] for p in group)/len(group);y=sum(p[1] for p in group)/len(group)
        if all(math.hypot(x-point['x']*frame.width,y-point['y']*frame.height)>frame.width*.18 for point in result):
            result.append({'x':round(x/frame.width,4),'y':round(y/frame.height,4)})
        if len(result)==3:break
    if len(result)<2:
        # Fall includes yellow composite flowers. Restrict this fallback to the
        # upper canopy so golden basal leaves do not become flower stations.
        yellow=[(x,y) for y in range(round(frame.height*.55)) for x in range(frame.width)
                if pixels[x,y][3]>100 and pixels[x,y][0]>160 and pixels[x,y][1]>115
                and pixels[x,y][0]>pixels[x,y][1]*1.05 and pixels[x,y][1]>pixels[x,y][2]*1.6]
        for group in components(yellow,frame.width,frame.height):
            x=sum(p[0] for p in group)/len(group);y=sum(p[1] for p in group)/len(group)
            if all(math.hypot(x-point['x']*frame.width,y-point['y']*frame.height)>frame.width*.18 for point in result):
                result.append({'x':round(x/frame.width,4),'y':round(y/frame.height,4)})
            if len(result)==3:break
    if len(result)<2:raise ValueError('Need at least two readable flower heads')
    leaf=min(green,key=lambda p:(p[0]-frame.width*.55)**2+(p[1]-frame.height*.70)**2) if green else (frame.width*.5,frame.height*.72)
    return result,{'x':round(leaf[0]/frame.width,4),'y':round(leaf[1]/frame.height,4)}

metadata={};foliage_review=Image.new('RGB',(3*768,3*310),(53,67,61));draw=ImageDraw.Draw(foliage_review)
for job in [item for item in JOBS if item['kind']=='foliage']:
    location,season=job['id'].split('-');image=Image.open(ROOT/job['source']).convert('RGBA')
    folder=ART/'foliage'/location/season;folder.mkdir(parents=True,exist_ok=True)
    records=[];column=['spring','summer','autumn'].index(season);row=['dock','cove','birch'].index(location)
    draw.text((column*768+4,row*310+2),job['id'],fill='white')
    for index,cell in enumerate(cells(image,3,2)):
        box=cell.getchannel('A').point(lambda a:255 if a>50 else 0).getbbox()
        cell=cell.crop(box);cell.thumbnail((116,128),Image.Resampling.LANCZOS)
        frame=Image.new('RGBA',(128,144));frame.alpha_composite(cell,((128-cell.width)//2,round(144*.90)-cell.height))
        blooms,leaf=flower_anchors(frame)
        relative=f'foliage/{location}/{season}/cluster-{index}.webp';frame.save(ART/relative,quality=88,method=6)
        records.append({'image':relative,'flowers':blooms,'leaf':leaf})
        qx=column*768+index*128;qy=row*310+28
        foliage_review.paste(frame,(qx,qy),frame.getchannel('A'))
        for point in blooms:
            x=qx+point['x']*128;y=qy+point['y']*144;draw.ellipse((x-2,y-2,x+2,y+2),outline='#fffb88')
    metadata.setdefault(location,{})[season]=records
    print(job['id'],sum(len(record['flowers']) for record in records),'flower stations',flush=True)
(ROOT/'src/FishingTypingGame/data/foliage.json').write_text(json.dumps(metadata,indent=2))
foliage_review.save(SOURCE/'foliage-review.png')
print('All side sprites and seasonal foliage packed.',flush=True)
