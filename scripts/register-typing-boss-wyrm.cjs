// Recover complete source silhouettes, rather than cutting a guessed grid.
// This mechanically isolates/aligns existing artwork; no pixels are painted.
const sharp=require('sharp'),fs=require('node:fs/promises'),path=require('node:path');
const {components}=require('./sprite-components.cjs');
const root=path.resolve(__dirname,'../public/assets/typing-boss/wyrm');
(async()=>{
  const {data,info}=await sharp(path.join(root,'transparent-source.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const parts=components(data,info.width,info.height,128,true),actors=parts.filter(p=>p.size>=2500).sort((a,b)=>a.cy-b.cy);
  if(actors.length!==72)throw Error(`Expected 72 separate Wyrm silhouettes, found ${actors.length}`);
  const rows=Array.from({length:12},(_,r)=>actors.slice(r*6,r*6+6).sort((a,b)=>a.cx-b.cx));
  const owned=new Map(actors.map(p=>[p,[p]]));
  for(const part of parts.filter(p=>p.size<2500 && p.size>=5)) {
    const candidates=actors.filter(a=>part.left>=a.left-28&&part.right<=a.right+22&&part.top>=a.top-20&&part.bottom<=a.bottom+7);
    candidates.sort((a,b)=>Math.abs(part.cx-a.cx)+Math.abs(part.cy-(a.top+(a.bottom-a.top)*.35))*.45-(Math.abs(part.cx-b.cx)+Math.abs(part.cy-(b.top+(b.bottom-b.top)*.35))*.45));
    if(candidates[0])owned.get(candidates[0]).push(part);
  }
  const ref=rows[0][0],refW=ref.right-ref.left+1,refH=ref.bottom-ref.top+1,frames=[];
  for(let row=0;row<12;row++) {
    const neutral=rows[row][0],sx=[5,11].includes(row)?1:refW/(neutral.right-neutral.left+1),sy=[5,11].includes(row)?1:refH/(neutral.bottom-neutral.top+1);
    for(let col=0;col<6;col++) {
      const actor=rows[row][col],mask=new Uint8Array(info.width*info.height);
      for(const part of owned.get(actor))for(const i of part.indices)mask[i]=1;
      let left=info.width,top=info.height,right=0,bottom=0;
      for(const part of owned.get(actor)){left=Math.min(left,part.left);top=Math.min(top,part.top);right=Math.max(right,part.right);bottom=Math.max(bottom,part.bottom);}
      left=Math.max(0,left-2);top=Math.max(0,top-2);right=Math.min(info.width-1,right+2);bottom=Math.min(info.height-1,bottom+2);
      const width=right-left+1,height=bottom-top+1,raw=Buffer.alloc(width*height*4);
      for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++) {
        if(!data[(y*info.width+x)*4+3])continue;
        let keep=false;
        for(let dy=-2;dy<=2&&!keep;dy++)for(let dx=-2;dx<=2;dx++)if(x+dx>=0&&x+dx<info.width&&y+dy>=0&&y+dy<info.height&&mask[(y+dy)*info.width+x+dx]){keep=true;break;}
        if(keep)data.copy(raw,((y-top)*width+x-left)*4,(y*info.width+x)*4,(y*info.width+x)*4+4);
      }
      frames.push({row,col,actor,raw,width,height,left,top,right,bottom,sx,sy});
    }
  }
  let scale=1.2;
  for(const f of frames){scale=Math.min(scale,212/Math.max(1,(f.actor.right-f.left)*f.sx),28/Math.max(1,(f.right-f.actor.right)*f.sx),228/Math.max(1,(f.actor.bottom-f.top)*f.sy),10/Math.max(1,(f.bottom-f.actor.bottom)*f.sy));}
  const layers=[],manifest=[];
  for(const f of frames){
    const sx=f.sx*scale,sy=f.sy*scale,width=Math.round(f.width*sx),height=Math.round(f.height*sy);
    const left=Math.round(220-(f.actor.right-f.left)*sx),top=Math.round(238-(f.actor.bottom-f.top)*sy);
    if(left<6||top<6||left+width>250||top+height>250)throw Error(`Unsafe packing: ${f.row}:${f.col}`);
    const input=await sharp(f.raw,{raw:{width:f.width,height:f.height,channels:4}}).resize(width,height,{kernel:'nearest',fit:'fill'}).png().toBuffer();
    layers.push({input,left:f.col*256+left,top:f.row*256+top});
    manifest.push({row:f.row,frame:f.col,sourceBounds:{left:f.left,top:f.top,right:f.right,bottom:f.bottom},scaleX:sx,scaleY:sy,left,top,width,height,anchor:{right:220,ground:238}});
  }
  await sharp({create:{width:1536,height:3072,channels:4,background:'#00000000'}}).composite(layers).webp({lossless:true}).toFile(path.join(root,'combat-v2.webp'));
  await sharp(path.join(root,'combat-v2.webp')).extract({left:0,top:0,width:256,height:256}).webp({lossless:true}).toFile(path.join(root,'portrait-v2.webp'));
  await fs.writeFile(path.join(root,'registration-v2.json'),JSON.stringify({frames:72,scale,reference:{width:refW,height:refH},manifest},null,2));
  await sharp(path.join(root,'combat-v2.webp')).resize(768,1536,{kernel:'nearest'}).flatten({background:'#273849'}).png().toFile(path.resolve(__dirname,'../output/animation-audit/wyrm-clean.png'));
  console.log(`Registered 72 complete Wyrm silhouettes; global scale ${scale.toFixed(4)}; no frame-local resizing.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
