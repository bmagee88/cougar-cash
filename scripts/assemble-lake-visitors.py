from pathlib import Path
from PIL import Image, ImageDraw
import math, random, sys
root=Path('public/assets/fishing/visitors'); root.mkdir(parents=True,exist_ok=True)
sources=Path('output/wildlife-sources'); sources.mkdir(parents=True,exist_ok=True)
sky_source=sources/'santa-sky.png'
if sky_source.exists():
    sky=Image.open(sky_source).convert('RGBA')
    sky=sky.crop(sky.getbbox()); sky.thumbnail((64,28),Image.Resampling.LANCZOS)
    sky.save(root/'santa-sky.webp',lossless=True,method=6)
if '--santa-sky-only' in sys.argv:
    if not sky_source.exists(): raise FileNotFoundError(sky_source)
    print('Packed the low-resolution Santa sky silhouette.'); sys.exit(0)
for species in (['green-darner','ebony-jewelwing'] if '--odonates-only' in sys.argv else ['green-darner','ebony-jewelwing','santa']):
    transparent=sources/(species+'-transparent.png')
    im=Image.open(transparent if transparent.exists() else sources/(species+'.png')).convert('RGBA')
    if species=='santa':
        im=im.crop(im.getbbox()); im.thumbnail((960,400),Image.Resampling.LANCZOS); im.save(root/'santa.webp',quality=88,method=6); continue
    dest=root/species; dest.mkdir(exist_ok=True); frames=[]
    for n in range(8):
        c,r=n%4,n//4; cell=im.crop((round(c*im.width/4),round(r*im.height/2),round((c+1)*im.width/4),round((r+1)*im.height/2)))
        # Register the saturated thorax, so changing wing angles do not shift the body.
        points=[(x,y) for y in range(cell.height) for x in range(int(cell.width*.6),int(cell.width*.92)) if (lambda p:p[3]>180 and p[1]>p[0]*1.35 and p[1]>p[2]*.85)(cell.getpixel((x,y)))]
        anchor=(sum(x for x,y in points)/len(points),sum(y for x,y in points)/len(points)) if points else (cell.width*.8,cell.height*.58)
        factor=86/cell.width
        resized=cell.resize((round(cell.width*factor),round(cell.height*factor)),Image.Resampling.LANCZOS)
        frame=Image.new('RGBA',(96,112)); frame.alpha_composite(resized,(round(75-anchor[0]*factor),round(56-anchor[1]*factor)))
        frame.save(dest/f'pose-{n}.webp',quality=88,method=6); frames.append(frame)
    frames[0].save(dest/'adult.webp',quality=90,method=6)
    strip=Image.new('RGBA',(96*8,112))
    for n,frame in enumerate(frames):strip.alpha_composite(frame,(96*n,0))
    strip.save(dest/'flight-sheet.webp',quality=88,method=6)
    # Animated WebP preserves the generated partial alpha, unlike binary-alpha GIF.
    frames[0].save(dest/'flight.webp',save_all=True,append_images=frames[1:],duration=30 if species=='green-darner' else 65,loop=0,lossless=True,method=6)
    gifs=[]
    for frame in frames:
        pal=frame.convert('RGB').quantize(colors=255); pal.putpalette(pal.getpalette()[:765]+[0,0,0])
        # Ordered alpha dithering approximates translucency in the legacy GIF.
        # Runtime canvases, guide images and journal poses use full-alpha WebP.
        bayer=((0,8,2,10),(12,4,14,6),(3,11,1,9),(15,7,13,5))
        mask=Image.new('L',frame.size); mask.putdata([255 if a <= (bayer[y%4][x%4]+.5)*16 else 0 for y in range(frame.height) for x in range(frame.width) for a in [frame.getpixel((x,y))[3]]])
        pal.paste(255,mask=mask); pal.info['transparency']=255; gifs.append(pal)
    gifs[0].save(dest/'flight.gif',save_all=True,append_images=gifs[1:],duration=30 if species=='green-darner' else 65,loop=0,disposal=2,transparency=255)
if '--odonates-only' in sys.argv:
    print('Packed two eight-pose odonates with full-alpha WebP stills, sheets and animations, plus dithered GIF fallbacks.'); sys.exit(0)
# Native geometry for water drops/ripple rings; no painted input is redrawn.
frames=[]; rng=random.Random(741); drops=[(rng.uniform(-1,1),rng.uniform(24,62),rng.uniform(1,2.4)) for _ in range(17)]
for n in range(20):
    t=n/19; im=Image.new('RGBA',(256*2,160*2)); d=ImageDraw.Draw(im)
    def ellipse(box,color,width=1): d.ellipse(tuple(round(v*2) for v in box),outline=color,width=width*2)
    for delay in [0,.19,.38]:
        age=t-delay
        if age<0:continue
        radius=18+age*103; alpha=int(155*max(0,1-age/1.1)*max(0,1-t))
        ellipse((128-radius,116-radius*.14,128+radius,116+radius*.14),(185,220,213,alpha))
        ellipse((128-radius+3,118-radius*.14,128+radius-3,118+radius*.14),(64,100,97,alpha//2))
    for dx,peak,size in drops:
        u=t*2.0; y=115-peak*4*u*(1-u); x=128+dx*75*u
        if u<=1.15 and y<118:
            alpha=int(225*min(1,(1.15-u)*4)); ellipse((x-size,y-size*2,x+size,y+size*2),(216,238,229,alpha),1)
    if .02<t<.33:
        h=math.sin(t/.33*math.pi)*14
        d.polygon([(224,231),(245,round((115-h)*2)),(267,round((114-h)*2)),(286,230)],fill=(123,153,144,175))
    im=im.resize((256,160),Image.Resampling.LANCZOS); frames.append(im)
strip=Image.new('RGBA',(256*20,160))
for n,frame in enumerate(frames):strip.alpha_composite(frame,(n*256,0))
strip.save(root/'fish-splash-sheet.webp',quality=85,method=6); frames[4].save(root/'fish-splash.webp',quality=85)
gifs=[]
for frame in frames:
    pal=frame.convert('RGB').quantize(colors=255); pal.putpalette(pal.getpalette()[:765]+[0,0,0]); pal.paste(255,mask=frame.getchannel('A').point(lambda a:255 if a<35 else 0)); gifs.append(pal)
gifs[0].save(root/'fish-splash.gif',save_all=True,append_images=gifs[1:],duration=80,loop=0,disposal=2,transparency=255)
print('Created two eight-frame insect animations, Santa cutout, and 20-frame fish splash GIF / sheet.')
