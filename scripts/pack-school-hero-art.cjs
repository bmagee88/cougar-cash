// Mechanical packing only: all character and projectile artwork is generated.
const sharp = require('sharp');
const path = require('node:path');
const fs = require('node:fs/promises');
const root = path.resolve(__dirname, '../public/assets/typing-boss');

async function packHero(id, source) {
  const metadata = await sharp(source).metadata();
  const cells = [];
  for (let row=0;row<8;row++) for (let column=0;column<6;column++) {
    const left=Math.round(column*metadata.width/6),top=Math.round(row*metadata.height/8);
    const width=Math.round((column+1)*metadata.width/6)-left,height=Math.round((row+1)*metadata.height/8)-top;
    const input=await sharp(source).extract({left,top,width,height})
      .resize(124,92,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
    cells.push({input,left:column*128+2,top:row*96+2});
  }
  const atlas = await sharp({create:{width:768,height:768,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
    .composite(cells).png().toBuffer();
  await sharp(atlas).webp({lossless:true}).toFile(path.join(root, 'characters', `${id}-combat-v3.webp`));
  const frames = [];
  for (let column=0; column<6; column++) {
    const frame = await sharp(atlas).extract({left:column*128, top:0, width:128, height:96})
      .resize(96,96,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
    frames.push({input:frame,left:column*96,top:0});
    if (!column) await fs.writeFile(path.join(root, `${id}-school-portrait.png`), frame);
  }
  await sharp({create:{width:576,height:96,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
    .composite(frames).webp({lossless:true}).toFile(path.join(root,'characters',`${id}-school-idle.webp`));
}

async function packProjectiles(source) {
  const sheet = await sharp(source).resize(1536,1024).png().toBuffer();
  for (const [row,name] of ['rogue-school-star','rogue-school-star-strong','barbarian-school-burst','barbarian-school-burst-strong'].entries()) {
    await sharp(sheet).extract({left:3*256,top:row*256,width:256,height:256})
      .resize(128,128).png().toFile(path.join(root,`${name}.png`));
  }
}

(async()=>{
  const [kind,source] = process.argv.slice(2);
  if (!source || !['rogue','barbarian','projectiles'].includes(kind)) throw Error('Usage: node scripts/pack-school-hero-art.cjs rogue|barbarian|projectiles source.png');
  if (kind==='projectiles') await packProjectiles(source);
  else await packHero(kind,source);
})().catch(error=>{console.error(error);process.exitCode=1;});
