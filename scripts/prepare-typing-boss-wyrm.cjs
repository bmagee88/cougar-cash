// Register generated artwork into fixed cells without changing the artwork.
const sharp=require('sharp'),path=require('node:path');
const root=path.resolve(__dirname,'../public/assets/typing-boss');
async function bounds(input) {
  const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let left=info.width,top=info.height,right=0,bottom=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>45){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  return {left,top,width:right-left+1,height:bottom-top+1};
}
async function main(){
  const source=path.join(root,'wyrm/transparent-source.png'),meta=await sharp(source).metadata();
  const bands=[0,124,245,383,502,620,730,895,1003,1100,1198,1300,meta.height],cell=256,frames=[];
  for(let row=0;row<12;row++)for(let col=0;col<6;col++){
    const left=Math.round(col*meta.width/6),right=Math.round((col+1)*meta.width/6);
    const image=await sharp(source).extract({left,top:bands[row],width:right-left,height:bands[row+1]-bands[row]}).png().toBuffer();
    const b=await bounds(image),scale=Math.min(1.25,240/b.width,228/b.height),width=Math.round(b.width*scale),height=Math.round(b.height*scale);
    const input=await sharp(image).extract(b).resize(width,height,{kernel:'nearest'}).png().toBuffer();
    frames.push({input,left:col*cell+Math.round((cell-width)/2),top:row*cell+240-height});
  }
  await sharp({create:{width:1536,height:3072,channels:4,background:'#00000000'}}).composite(frames).webp({lossless:true}).toFile(path.join(root,'wyrm/combat.webp'));
  await sharp(path.join(root,'wyrm/combat.webp')).extract({left:0,top:0,width:cell,height:cell}).webp({lossless:true}).toFile(path.join(root,'wyrm/portrait.webp'));
  await sharp(path.join(root,'wyrm/desert-source.png')).resize(1536,864,{fit:'cover'}).webp({quality:90}).toFile(path.join(root,'wyrm/desert.webp'));
  const idleSource=path.join(root,'idles/source.png'),im=await sharp(idleSource).metadata();
  for(const [row,id] of ['emberWhelp','cindermaw','infernalDragon','kraken'].entries()) {
    const crops=[];
    for(let col=0;col<6;col++){
      const left=Math.round(col*im.width/6),top=Math.round(row*im.height/4),width=Math.round((col+1)*im.width/6)-left,height=Math.round((row+1)*im.height/4)-top;
      const image=await sharp(idleSource).extract({left,top,width,height}).png().toBuffer();crops.push({image,b:await bounds(image)});
    }
    const height=id==='kraken'?144:256,scale=Math.min(240/Math.max(...crops.map(c=>c.b.width)),(height-20)/Math.max(...crops.map(c=>c.b.height)));
    const layers=[];
    for(let col=0;col<6;col++){const c=crops[col],width=Math.round(c.b.width*scale),h=Math.round(c.b.height*scale);layers.push({input:await sharp(c.image).extract(c.b).resize(width,h,{kernel:'nearest'}).png().toBuffer(),left:col*256+Math.round((256-width)/2),top:height-10-h});}
    await sharp({create:{width:1536,height,channels:4,background:'#00000000'}}).composite(layers).webp({lossless:true}).toFile(path.join(root,`idles/${id}.webp`));
  }
  await sharp(path.join(root,'wyrm/combat.webp')).resize(768,1536,{kernel:'nearest'}).flatten({background:'#273849'}).png().toFile(path.resolve(__dirname,'../output/wyrm-sheet-preview.png'));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
