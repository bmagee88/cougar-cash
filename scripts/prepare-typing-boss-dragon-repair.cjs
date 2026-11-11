// Pack image_gen's isolated dragon frames and reject border bleed before use.
const fs=require("node:fs/promises"),path=require("node:path"),sharp=require("sharp"),crypto=require("node:crypto");
const root=path.resolve(__dirname,"../public/assets/typing-boss/dragons"),CELL=256,GUTTER=12;
const ids=["ancient-red-dragon","cindermaw","ember-whelp"];
(async()=>{
  const report=[];
  for(const id of ids){
    const packed=Buffer.alloc(CELL*6*CELL*4*4),frames=[];
    for(const [part,firstRow]of [["bite-fireball",0],["tail-flame",2]]){
      const source=path.join(root,`${id}-${part}-v2.png`),meta=await sharp(source).metadata(),side=meta.width/3;
      if(!meta.hasAlpha||!Number.isInteger(side)||meta.height/4!==side)throw new Error(`Expected 3x4 transparent dragon sheet: ${id} ${part}`);
      for(let f=0;f<12;f++){
        const frame=await sharp(source).extract({left:f%3*side,top:Math.floor(f/3)*side,width:side,height:side}).ensureAlpha().raw().toBuffer();
        // Reject already-cut artwork before packing. Guard bands cannot restore it.
        for(let q=0;q<side;q++)for(const index of [q,((side-1)*side+q),q*side,q*side+side-1]) {
          if(frame[index*4+3]>=128)throw new Error(`Generated dragon touches source boundary: ${id} ${part} ${f+1}`);
        }
        const inner=CELL-GUTTER*2;
        const content=await sharp(frame,{raw:{width:side,height:side,channels:4}})
          .resize(inner,inner,{kernel:"nearest"}).ensureAlpha().raw().toBuffer();
        const pixels=Buffer.alloc(CELL*CELL*4);
        for(let y=0;y<inner;y++)content.copy(pixels,((y+GUTTER)*CELL+GUTTER)*4,y*inner*4,(y+1)*inner*4);
        let solid=0,clear=0;
        for(let y=0;y<CELL;y++)for(let x=0;x<CELL;x++){
          const index=(y*CELL+x)*4,a=pixels[index+3],border=x<GUTTER||x>=CELL-GUTTER||y<GUTTER||y>=CELL-GUTTER;
          if(a<=2)pixels[index+3]=0;
          if(border){if(a>=16)throw new Error(`Dragon artwork crosses gutter: ${id} ${part} ${f+1} (${x},${y}) alpha ${a}`);pixels[index+3]=0;}
          if(pixels[index+3]>=180)solid++;
          if(!pixels[index+3])clear++;
        }
        if(solid<1800||clear<CELL*CELL*.35)throw new Error(`Missing or opaque dragon frame: ${id} ${part} ${f+1}`);
        const row=firstRow+Math.floor(f/6),column=f%6;
        for(let y=0;y<CELL;y++)pixels.copy(packed,((row*CELL+y)*(CELL*6)+column*CELL)*4,y*CELL*4,(y+1)*CELL*4);
        frames.push({row,column,solid,clear,transparentGutter:GUTTER,hash:crypto.createHash("sha256").update(pixels).digest("hex")});
      }
    }
    for(let row=0;row<4;row++)if(new Set(frames.filter(f=>f.row===row).map(f=>f.hash)).size<5)throw new Error(`Dragon action lacks distinct frames: ${id} ${row}`);
    const target=path.join(root,`${id}-attacks-v2.webp`);
    await sharp(packed,{raw:{width:CELL*6,height:CELL*4,channels:4}}).webp({lossless:true,effort:6}).toFile(target);
    const encoded=await sharp(target).ensureAlpha().raw().toBuffer();
    for(let i=0;i<packed.length;i+=4)if(packed[i+3]!==encoded[i+3]||(packed[i+3]&&!packed.subarray(i,i+3).equals(encoded.subarray(i,i+3))))throw new Error(`Lossless dragon packing failed: ${id}`);
    report.push({id,cell:CELL,columns:6,rows:["bite","fireball","tailWhip","flamethrower"],runtimeBytes:(await fs.stat(target)).size,frames});
  }
  await fs.writeFile(path.join(root,"repair-manifest.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({dragons:3,actions:12,frames:72,transparentGutter:GUTTER,bytes:report.reduce((n,r)=>n+r.runtimeBytes,0)}));
})().catch(error=>{console.error(error);process.exitCode=1;});
