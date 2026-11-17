// Mechanical slicing, registration and packing only. Generated artwork is unchanged.
const fs=require('node:fs/promises'),path=require('node:path'),sharp=require('sharp'),crypto=require('node:crypto');
const {KRAKEN_ANIMATIONS}=require('../src/TypingBoss/krakenAnimationRules');
const root=path.resolve(__dirname,'../public/assets/typing-boss/kraken');
const W=384,H=216;
function measure(data,width,height){
  // Locate the main connected silhouette. A generated gutter can contain a few
  // pixels from the neighboring row; exclude that other frame from registration.
  const seen=new Uint8Array(width*height),queue=new Int32Array(width*height);let main={size:0,left:0,right:width-1,top:0,bottom:height-1};
  for(let start=0;start<seen.length;start++){
    if(seen[start] || data[start*4+3]<128)continue;
    let head=0,tail=1,left=width,right=0,top=height,bottom=0;queue[0]=start;seen[start]=1;
    while(head<tail){const i=queue[head++],x=i%width,y=Math.floor(i/width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      for(const next of [x>0?i-1:-1,x+1<width?i+1:-1,y>0?i-width:-1,y+1<height?i+width:-1])if(next>=0 && !seen[next] && data[next*4+3]>=128){seen[next]=1;queue[tail++]=next;}
    }
    if(tail>main.size)main={size:tail,left,right,top,bottom};
  }
  const pad=Math.ceil(Math.max(width,height)*.1),crop={left:Math.max(0,main.left-pad),top:Math.max(0,main.top-pad)};
  crop.width=Math.min(width,main.right+pad+1)-crop.left;crop.height=Math.min(height,main.bottom+pad+1)-crop.top;
  let left=width,top=height,right=0,bottom=0,solid=0;const feet=[];
  for(let y=crop.top;y<crop.top+crop.height;y++)for(let x=crop.left;x<crop.left+crop.width;x++){
    const a=data[(y*width+x)*4+3];if(a<128)continue;
    left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);solid++;
    if(x>width*.66 && y>height*.6)feet.push(y);
  }
  if(solid<width*height*.08 || solid>width*height*.92)throw Error('Empty frame or missing transparency');
  feet.sort((a,b)=>a-b);const ground=feet.length?feet[Math.floor(feet.length*.98)]:bottom;
  return {left,top,right,bottom,ground,anchorX:width*.5,solid,crop};
}
(async()=>{
  const sources=[],manifest={cell:{width:W,height:H},animations:{}};
  for(const [kind,config] of Object.entries(KRAKEN_ANIMATIONS)){
    const source=await fs.readFile(path.join(root,`${config.file}-source.png`)),meta=await sharp(source).metadata();
    if(!meta.hasAlpha)throw Error(`${kind} requires alpha transparency`);
    const frames=[];
    for(let i=0;i<config.frames;i++){
      const col=i%config.columns,row=Math.floor(i/config.columns),left=Math.round(col*meta.width/config.columns),top=Math.round(row*meta.height/config.rows);
      const width=Math.round((col+1)*meta.width/config.columns)-left,height=Math.round((row+1)*meta.height/config.rows)-top;
      const buffer=await sharp(source).extract({left,top,width,height}).ensureAlpha().png().toBuffer();
      const raw=await sharp(buffer).raw().toBuffer(),measurement=measure(raw,width,height),crop=measurement.crop;
      const isolated=await sharp(buffer).extract(crop).extend({left:crop.left,top:crop.top,right:width-crop.left-crop.width,bottom:height-crop.top-crop.height,background:'#00000000'}).png().toBuffer();
      frames.push({buffer:isolated,width,height,measure:measurement,hash:crypto.createHash('sha256').update(raw).digest('hex')});
    }
    if(new Set(frames.map(f=>f.hash)).size!==config.frames)throw Error(`${kind} has duplicate frames`);
    const neutral=frames[0].measure;
    sources.push({kind,config,frames,sx:W*.90/(neutral.right-neutral.left+1),sy:H*.90/(neutral.ground-neutral.top+1)});
  }
  // Share one fit factor across all actions so the body does not change scale at a transition.
  let fit=1;
  for(const a of sources)for(const f of a.frames){const m=f.measure;
    fit=Math.min(fit,(W*.48)/((m.anchorX-m.left)*a.sx),(W*.48)/((m.right-m.anchorX)*a.sx),(H*.91)/((m.ground-m.top)*a.sy),(H*.06)/Math.max(1,(m.bottom-m.ground)*a.sy));
  }
  for(const a of sources){
    const tiles=[],frames=[];
    for(let i=0;i<a.frames.length;i++){
      const f=a.frames[i],m=f.measure,sx=a.sx*fit,sy=a.sy*fit;
      const width=Math.max(1,Math.round(f.width*sx)),height=Math.max(1,Math.round(f.height*sy));
      const x=Math.round(W*.5-m.anchorX*sx),y=Math.round(H*.94-m.ground*sy);
      let input=await sharp(f.buffer).resize(width,height,{fit:'fill',kernel:'lanczos3'}).png().toBuffer();
      const cropLeft=Math.max(0,-x),cropTop=Math.max(0,-y),cropWidth=Math.min(width-cropLeft,W-Math.max(0,x)),cropHeight=Math.min(height-cropTop,H-Math.max(0,y));
      input=await sharp(input).extract({left:cropLeft,top:cropTop,width:cropWidth,height:cropHeight}).png().toBuffer();
      const tile=await sharp({create:{width:W,height:H,channels:4,background:'#00000000'}}).composite([{input,left:Math.max(0,x),top:Math.max(0,y)}]).png().toBuffer();
      tiles.push({input:tile,left:i%a.config.columns*W,top:Math.floor(i/a.config.columns)*H});
      frames.push({sourceBounds:m,scaleX:sx,scaleY:sy,x,y,hash:f.hash});
    }
    const output=path.join(root,`${a.config.file}.webp`);
    await sharp({create:{width:W*a.config.columns,height:H*a.config.rows,channels:4,background:'#00000000'}}).composite(tiles).webp({lossless:true,effort:6}).toFile(output);
    manifest.animations[a.kind]={...a.config,source:`${a.config.file}-source.png`,runtime:`${a.config.file}.webp`,bytes:(await fs.stat(output)).size,frames};
    console.log(`${a.kind}: ${frames.length} registered frames, ${manifest.animations[a.kind].bytes} bytes`);
  }
  manifest.fit=fit;await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
})().catch(error=>{console.error(error);process.exitCode=1;});
