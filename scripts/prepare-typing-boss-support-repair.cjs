// Mechanical packing of image_gen's repaired support frames; preserve other artwork.
const fs=require("node:fs/promises"),path=require("node:path"),sharp=require("sharp");
const root=path.resolve(__dirname,"../public/assets/typing-boss/characters");
const CW=128,CH=112,W=CW*6,H=CH*8;
(async()=>{
  const report=[];
  for(const id of ["paladin","cleric","necromancer"]){
    const input=path.join(root,`${id}-support-v3.png`),meta=await sharp(input).metadata(),cell=meta.width/3;
    if(!meta.hasAlpha||!Number.isInteger(cell)||meta.height/2!==cell)throw new Error(`Invalid support sheet: ${id}`);
    const old=await sharp(path.join(root,`${id}-combat-v2.webp`)).ensureAlpha().raw().toBuffer();
    const packed=Buffer.alloc(W*H*4),frames=[];
    for(let row=0;row<8;row++)for(let frame=0;frame<6;frame++)for(let y=0;y<96;y++){
      const from=((row*96+y)*W+frame*CW)*4;
      old.copy(packed,((row*CH+8+y)*W+frame*CW)*4,from,from+CW*4);
    }
    let refTop=96,refBottom=0;
    for(let y=0;y<96;y++)for(let x=0;x<CW;x++)if(old[((2*96+y)*W+x)*4+3]>=230){refTop=Math.min(refTop,y);refBottom=Math.max(refBottom,y);}
    const first=await sharp(input).extract({left:0,top:0,width:cell,height:cell}).ensureAlpha().raw().toBuffer();
    let firstTop=cell,firstBottom=0;
    for(let y=0;y<cell;y++)for(let x=0;x<cell;x++)if(first[(y*cell+x)*4+3]>=230){firstTop=Math.min(firstTop,y);firstBottom=Math.max(firstBottom,y);}
    const side=Math.round(cell*(refBottom-refTop+1)/(firstBottom-firstTop+1));
    const dx=Math.round((CW-side)/2),dy=Math.round(refBottom+8-firstBottom*side/cell);
    for(let frame=0;frame<6;frame++){
      const scaled=await sharp(input).extract({left:frame%3*cell,top:Math.floor(frame/3)*cell,width:cell,height:cell})
        .resize(side,side,{kernel:"nearest"}).ensureAlpha().raw().toBuffer();
      const pixels=Buffer.alloc(CW*CH*4);let visible=0;
      for(let y=0;y<side;y++)for(let x=0;x<side;x++){
        const from=(y*side+x)*4,a=scaled[from+3],tx=x+dx,ty=y+dy;
        if(a<=2)continue;
        if(tx<4||tx>=CW-4||ty<4||ty>=CH-4){if(a>=16)throw new Error(`Support effect would be clipped: ${id} frame ${frame+1} (${tx},${ty})`);continue;}
        scaled.copy(pixels,(ty*CW+tx)*4,from,from+4);visible++;
      }
      if(visible<350)throw new Error(`Empty support frame: ${id} ${frame+1}`);
      for(let y=0;y<CH;y++)pixels.copy(packed,((2*CH+y)*W+frame*CW)*4,y*CW*4,(y+1)*CW*4);
      frames.push({frame:frame+1,visiblePixels:visible,transparentGutter:4});
    }
    const output=path.join(root,`${id}-combat-v3.webp`);
    await sharp(packed,{raw:{width:W,height:H,channels:4}}).webp({lossless:true,effort:6}).toFile(output);
    const decoded=await sharp(output).ensureAlpha().raw().toBuffer();
    for(let i=0;i<packed.length;i+=4)if(packed[i+3]!==decoded[i+3]||(packed[i+3]&&!packed.subarray(i,i+3).equals(decoded.subarray(i,i+3))))throw new Error(`Encoding changed pixels: ${id}`);
    for(let row=0;row<8;row++)if(row!==2)for(let frame=0;frame<6;frame++)for(let y=0;y<96;y++)for(let x=0;x<CW;x++){
      const from=((row*96+y)*W+frame*CW+x)*4,to=((row*CH+8+y)*W+frame*CW+x)*4;
      if(old[from+3]!==decoded[to+3]||(old[from+3]&&!old.subarray(from,from+3).equals(decoded.subarray(to,to+3))))throw new Error(`Other pose changed: ${id} row ${row}`);
    }
    report.push({id,cellWidth:CW,cellHeight:CH,side,offsetX:dx,offsetY:dy,frames,otherRowsPreserved:true,runtimeBytes:(await fs.stat(output)).size});
  }
  await fs.writeFile(path.join(root,"support-repair-manifest.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({classes:3,repairedFrames:18,otherRowsPreserved:true}));
})().catch(error=>{console.error(error);process.exitCode=1;});
