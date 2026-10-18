"""Crop ImageGen stalk atlases, retain proportions/alpha, and trace anchors.
Also sample safe planted habitat from the actual seasonal shoreline masters.
No artwork is drawn or recolored. Usage: python scripts/pack-flower-stalks.py
"""
from pathlib import Path
from statistics import median
import json, math
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'public/assets/fishing'
GENERATED=Path('C:/Users/Kathleen Dippyolito/.codex/generated_images/01a149bf-9559-7c21-bd97-ac31ba63fa62')
SOURCES={'dock':'exec-db4b39a0-1a0e-43bb-808e-a202a266b59e.png','cove':'exec-d1bafa96-1201-4b21-ab88-b338deb711cc.png','birch':'exec-ca1f2259-080a-4d18-8954-c4512d53384a.png'}
LABELS={
 'dock':['Buttercup','Violet','Wood anemone','Daisy','Loosestrife','Blue vervain','Lavender aster','Goldenrod','White aster'],
 'cove':['Wood anemone','Woodland violet','Columbine','Woodland aster','Jewelweed','Bellflower','White aster','Goldenrod','Lavender aster'],
 'birch':['Violet','Saxifrage','Rock cress','Harebell','Yarrow','Fireweed','White aster','Lavender aster','Goldenrod'],
}
COLORS={'dock':['yellow','blue','white','white','pink','blue','blue','yellow','white'],
 'cove':['white','blue','pink','white','pink','blue','white','yellow','blue'],
 'birch':['blue','white','pink','blue','white','pink','white','blue','yellow']}
HEIGHTS={'dock':[.62,.48,.62,.98,1.17,1.1,.95,1.06,.88],
 'cove':[.6,.48,.82,.82,.96,.93,.8,1.02,.88],
 'birch':[.45,.57,.52,.88,.82,1.14,.75,.86,1.0]}
HEADS={'dock':[1,2,1,1,3,2,2,3,1],'cove':[1,2,1,2,2,2,1,3,2],'birch':[1,3,2,2,1,3,1,2,3]}
SEASONS=['spring','summer','autumn']

def components(points):
    remaining=set(points)
    while remaining:
        queue=[remaining.pop()];group=[]
        while queue:
            point=queue.pop();group.append(point);x,y=point
            for other in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
                if other in remaining:remaining.remove(other);queue.append(other)
        if len(group)>=3:yield group

metadata={}
for location,filename in SOURCES.items():
    atlas=Image.open(GENERATED/filename).convert('RGBA');records={}
    for n,label in enumerate(LABELS[location]):
        row,col=divmod(n,3)
        # The cove's tallest stems slightly cross the nominal thirds; cuts in
        # the actual gaps keep neighboring goldenrod tips out of another plant.
        rows=[[0,362,719,1086],[0,365,711,1086],[0,372,711,1086]][col] if location=='cove' else [round(y*atlas.height/3) for y in range(4)]
        cell=atlas.crop((round(col*atlas.width/3),rows[row],round((col+1)*atlas.width/3),rows[row+1]))
        box=cell.getchannel('A').point(lambda a:255 if a>96 else 0).getbbox()
        assert box,(location,n)
        # Keep the original translucent edge pixels; only empty margin is cropped.
        cell=cell.crop((max(0,box[0]-3),max(0,box[1]-3),min(cell.width,box[2]+3),min(cell.height,box[3]+3)))
        cell.thumbnail((180,220),Image.Resampling.LANCZOS)
        frame=Image.new('RGBA',(cell.width+12,cell.height+12));frame.alpha_composite(cell,(6,6))
        w,h=frame.size;pixels=frame.load()
        solid=[(x,y) for y in range(h) for x in range(w) if pixels[x,y][3]>150]
        bottom=max(y for x,y in solid)
        roots=[x for x,y in solid if y>=bottom-3]
        root={'x':round(median(roots)/w,5),'y':round(bottom/h,5)}
        green=[(x,y) for x,y in solid if pixels[x,y][1]>pixels[x,y][0]*1.05 and pixels[x,y][1]>pixels[x,y][2]*1.2]
        leaf=min(green,key=lambda p:(p[0]-root['x']*w)**2+(p[1]-h*.69)**2)
        colored=[]
        for x,y in solid:
            if y>h*.73:continue
            r,g,b,a=pixels[x,y];color=COLORS[location][n]
            matches=(min(r,g,b)>160 and max(r,g,b)-min(r,g,b)<70) if color=='white' else (b>g*1.12 and b>75) if color=='blue' else (r>g*1.2 and r>115) if color=='pink' else (r>g*1.07 and g>b*1.6 and r>145)
            if matches:colored.append((x,y))
        groups=sorted(components(colored),key=len,reverse=True);flowers=[]
        for group in groups:
            x=sum(p[0] for p in group)/len(group);y=sum(p[1] for p in group)/len(group)
            if all(math.hypot(x-point['x']*w,y-point['y']*h)>h*.13 for point in flowers):flowers.append({'x':round(x/w,5),'y':round(y/h,5)})
            if len(flowers)==HEADS[location][n]:break
        assert flowers,(location,n,'Missing bloom anchor')
        season=SEASONS[row];relative=f'foliage/{location}/{season}/stalk-{col}.webp'
        frame.save(ART/relative,quality=88,method=6)
        records.setdefault(season,[]).append({'image':relative,'label':label,'width':w,'height':h,'relativeHeight':HEIGHTS[location][n],'root':root,'flowers':flowers,'leaf':{'x':round(leaf[0]/w,5),'y':round(leaf[1]/h,5)}})
        print(location,season,label,frame.size,len(flowers),'nectar anchors')
    metadata[location]=records
(ROOT/'src/FishingTypingGame/data/flower-stalks.json').write_text(json.dumps(metadata,indent=2)+'\n')

# Hand-chosen habitat envelopes avoid seating ledges, paths and open water.
# Actual local vegetation/alpha checks further restrict every candidate root.
ZONES={
 'dock':{'near-shore':[(.04,.45,.36,.8),(.34,.62,.72,.94),(.72,.76,.91,.94)],'right-grassy-bank':[(.16,.48,.57,.88),(.53,.65,.86,.91)]},
 'cove':{'cove-seat':[(.055,.59,.19,.79),(.035,.82,.21,.985),(.28,.915,.44,.985),(.43,.82,.59,.97),(.62,.93,.81,.985)]},
 'birch':{'birch-seat':[(.015,.63,.145,.9),(.02,.93,.185,.985),(.35,.72,.415,.825),(.32,.94,.43,.985)],'birch-right-plants':[(.80,.86,.975,.985)]},
}
def source_path(location,season,layer):
    if location=='dock':return ART/'locations/cedar'/('' if season=='autumn' else season)/'grass-bank-painted.png'
    name='right-plants-painted.png' if layer=='birch-right-plants' else 'shore-seat-painted.png'
    return ART/'locations'/('birch-point' if location=='birch' else 'willow-cove')/season/name

habitats={}
dock=Image.open(ART/'locations/cedar/dock-painted.png').convert('RGBA')
for location,layers in ZONES.items():
    for season in SEASONS:
        points=[]
        for layer,zones in layers.items():
            bank=Image.open(source_path(location,season,layer)).convert('RGBA');w,h=bank.size
            candidates=set()
            for left,top,right,bottom in zones:
                for iy in range(math.ceil(top*100),int(bottom*100)+1,2):
                    for ix in range(math.ceil(left*100),int(right*100)+1,2):candidates.add((ix/100,iy/100))
            for x,y in sorted(candidates):
                if location=='birch' and layer=='birch-seat' and .18<x<.35 and .66<y<.93:continue
                if location=='cove' and .21<x<.395 and .62<y<.905:continue
                px,py=round(x*(w-1)),round(y*(h-1))
                samples=[bank.getpixel((min(w-1,max(0,px+dx)),min(h-1,max(0,py+dy)))) for dx in [-7,0,7] for dy in [-5,0,5]]
                green=sum(a>210 and ((g>r*1.025 and g>b*1.16) or
                          (season=='autumn' and r>g*1.06 and r<g*1.65 and g>b*1.2 and r-b>28)) for r,g,b,a in samples)
                solid=sum(a>225 for r,g,b,a in samples)
                if green<4 or solid<8:continue
                if location=='dock' and layer=='near-shore':
                    # Project the root into the separately painted dock to reject
                    # grass hidden by planks. Both frames share ground geometry.
                    u=(-60+490*x+40)/420;v=(240+490/1.5*y-300)/280
                    if 0<u<1 and 0<v<1 and dock.getpixel((int(u*(dock.width-1)),int(v*(dock.height-1))))[3]>100:continue
                points.append({'layer':layer,'x':x,'y':y})
        assert len(points)>15,(location,season,'Too little habitat')
        habitats.setdefault(location,{})[season]=points
        print(location,season,len(points),'safe root positions')
(ROOT/'src/FishingTypingGame/data/flower-habitats.json').write_text(json.dumps(habitats,separators=(',',':'))+'\n')
