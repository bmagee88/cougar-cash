"""Freeze artist-selected habitat candidates for generation v1 (no random layout)."""
import json, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
habitats=json.loads((ROOT/'src/FishingTypingGame/data/flower-habitats.json').read_text())
targets={
 'dock':[('near-shore',.70,.78),('near-shore',.40,.66),('near-shore',.82,.82),('near-shore',.30,.78),('right-grassy-bank',.85,.91),('right-grassy-bank',.93,.93)],
 'cove':[('cove-seat',.41,.95),('cove-seat',.48,.90),('cove-seat',.35,.96),('cove-seat',.16,.67),('cove-seat',.43,.94),('cove-seat',.12,.62)],
 'birch':[('birch-seat',.37,.77),('birch-seat',.35,.96),('birch-seat',.40,.80),('birch-seat',.10,.80),('birch-right-plants',.85,.96),('birch-right-plants',.94,.92)]}
reeds={'dock':[(.10,.79,.095),(.405,.96,.085)],'cove':[(.449,.69,.055),(.43,.90,.060),(.57,.92,.066)],'birch':[(.352,.917,.046),(.478,.86,.060),(.478,1.02,.056)]}
edges={
 'dock':[[[354,466,65,115,84],[175,414,35,100]],[[397,497,70,145,85],[354,466,58,105,70],[397,497,45,110,55]],[[397,497,60,170,50],[217,431,32,150],[378,483,55,140,90]]],
 'cove':[[[451,385,28,95],[587,438,20,105]],[[640,453,22,125],[715,475,22,145],[884,515,24,140]],[[548,425,22,135],[793,495,23,170],[947,551,35,175]]],
 'birch':[[[379,364,35,90],[413,392,29,100]],[[474,424,38,125],[385,445,167,100],[445,484,38,140]],[[369,460,-3,130],[390,380,33,125],[458,411,36,150]]]}
result={}
for location in targets:
 common=set.intersection(*[{(p['layer'],p['x'],p['y']) for p in habitats[location][season]} for season in ('spring','summer','autumn')])
 anchors=[]
 for i,(layer,x,y) in enumerate(targets[location]):
  nearby=sorted((p for p in common if p[0]==layer),key=lambda p:math.hypot(p[1]-x,(p[2]-y)*.6))
  choices=[]
  for p in nearby:
   if not choices or all(math.hypot(p[1]-q['x'],p[2]-q['y'])>=.012 for q in choices):choices.append(dict(layer=layer,x=p[1],y=p[2]))
   if len(choices)==3:break
  assert choices
  anchors.append(dict(id=f'{location}-flower-base-{i}',kind='flower',choices=choices))
 frame='water-frame' if location=='dock' else ('cove-seat' if location=='cove' else 'birch-seat')
 for i,(x,y,width) in enumerate(reeds[location]):anchors.append(dict(id=f'{location}-reed-base-{i}',kind='reed',choices=[dict(layer=frame,x=x,y=y)],width=width))
 frame_height=1000*941/1672 if location=='cove' else 500
 for depth,rows in enumerate(edges[location]):
  for i,row in enumerate(rows):
   bx,by,angle,size=row[:4];reach=max(12,row[4]-22) if len(row)>4 else 6+size*.04;r=angle*math.pi/180
   anchors.append(dict(id=f'{location}-lily-base-{depth}-{i}',kind='lily',choices=[dict(layer=frame,x=round((bx+math.sin(r)*reach)/1000,6),y=round((by-math.cos(r)*reach)/frame_height,6))],width=size/1000,floatingLayer=depth,angle=angle))
 result[location]=anchors
dest=ROOT/'src/FishingTypingGame/data/plant-anchors-v1.json'
dest.write_text(json.dumps(result,indent=2)+'\n')
print({location:len(anchors) for location,anchors in result.items()})
