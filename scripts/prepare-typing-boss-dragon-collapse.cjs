// Mechanical atlas packing only: preserve the generated artwork and alpha.
const fs = require('node:fs/promises'), path = require('node:path'), sharp = require('sharp');
const root = path.resolve(__dirname,'../public/assets/typing-boss/dragons');
(async()=>{
  const input = path.join(root,'forward-collapse-source.png');
  const meta = await sharp(input).metadata();
  if (!meta.hasAlpha) throw new Error('Collapse master must have transparency');
  const reference = JSON.parse(await fs.readFile(path.join(root,'footing-manifest.json'),'utf8'));
  const ids = ['infernalDragon','cindermaw','emberWhelp'], tiles = [], report = {};
  for (let row=0;row<3;row++) {
    const boss = ids[row], bounds = reference[boss].rows[0][0].bounds;
    let scale;
    const frames = [];
    for (let col=0;col<6;col++) {
      const left=Math.round(col*meta.width/6),top=Math.round(row*meta.height/3);
      const width=Math.round((col+1)*meta.width/6)-left,height=Math.round((row+1)*meta.height/3)-top;
      const cell = await sharp(input).extract({left,top,width,height}).png().toBuffer();
      const trimmed=await sharp(cell).trim({threshold:8}).png().toBuffer();
      const size=await sharp(trimmed).metadata();
      if (col===0) scale=Math.min((bounds.right-bounds.left)/size.width,(bounds.bottom-bounds.top)/size.height);
      const w=Math.round(size.width*scale),h=Math.round(size.height*scale);
      const x=Math.round(bounds.right-w),y=Math.round(bounds.bottom-h);
      if (x<0 || y<0 || x+w>256 || y+h>256) throw new Error(`Collapse frame outside cell: ${boss}:${col}`);
      tiles.push({input:await sharp(trimmed).resize(w,h,{kernel:'nearest'}).png().toBuffer(),left:col*256+x,top:row*256+y});
      frames.push({width:w,height:h,x,y});
    }
    report[boss]={row,frames};
  }
  await sharp({create:{width:1536,height:768,channels:4,background:'#00000000'}}).composite(tiles).webp({lossless:true,effort:6}).toFile(path.join(root,'forward-collapse.webp'));
  await fs.writeFile(path.join(root,'collapse-manifest.json'),JSON.stringify({columns:6,rows:3,cell:256,dragons:report},null,2)+'\n');
  console.log('Packed 18 forward-collapse frames, registered to the existing dragon camera and ground.');
})().catch(error=>{console.error(error);process.exitCode=1;});
