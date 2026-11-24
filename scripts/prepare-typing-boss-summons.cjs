// Mechanical atlas registration only. Artwork is created with built-in imagegen.
const sharp=require('sharp');
const fs=require('node:fs/promises');
const path=require('node:path');
const root=path.resolve(__dirname,'..','public/assets/typing-boss');
async function pack(source,destination,rows,bodyHeight) {
  const input=path.join(root,source),meta=await sharp(input).metadata();
  const cell=128,frames=[];
  for(let row=0;row<rows;row++) {
    const crops=[];
    for(let col=0;col<6;col++) {
      const left=Math.round(col*meta.width/6),top=Math.round(row*meta.height/rows);
      const width=Math.round((col+1)*meta.width/6)-left,height=Math.round((row+1)*meta.height/rows)-top;
      const {data,info}=await sharp(input).extract({left,top,width,height}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      let x0=width,y0=height,x1=0,y1=0;
      for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>24) {
        x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
      }
      crops.push({data,info,left:x0,top:y0,width:x1-x0+1,height:y1-y0+1});
    }
    // One scale across the atlas keeps a collapsed zombie short on the ground.
    const scale=bodyHeight/(rows===8?meta.height/rows*.86:Math.max(...crops.map(c=>c.height)));
    for(let col=0;col<6;col++) {
      const c=crops[col],factor=Math.min(scale,116/c.width);
      const width=Math.round(c.width*factor),height=Math.round(c.height*factor);
      const input=await sharp(c.data,{raw:c.info}).extract({left:c.left,top:c.top,width:c.width,height:c.height})
        .resize(width,height,{kernel:'nearest'}).png().toBuffer();
      frames.push({input,left:col*cell+Math.round((cell-width)/2),top:row*cell+116-height});
    }
  }
  await sharp({create:{width:cell*6,height:cell*rows,channels:4,background:'#00000000'}}).composite(frames).webp({lossless:true}).toFile(path.join(root,destination));
}
async function main() {
  await pack('summons/zombie-source.png','summons/zombie-combat.webp',8,96);
  await pack('kneeling/party-source.png','kneeling/party-kneeling.webp',6,78);
  await sharp(path.join(root,'kneeling/party-kneeling.webp')).flatten({background:'#142033'}).png().toFile(path.resolve(__dirname,'../output/kneeling-atlas-preview.png'));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
