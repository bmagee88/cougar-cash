// Mechanical sprite packing only; generated PNG masters are untouched.
const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");
const root = path.resolve(__dirname, "../public/assets/typing-boss/characters");
const classes = ["cleric", "barbarian", "paladin", "rogue", "necromancer", "monk"];
(async () => {
  const report = [];
  for (const id of classes) {
    const source = path.join(root, `${id}-combat.png`);
    const meta = await sharp(source).metadata();
    if (!meta.hasAlpha || meta.width % 6 || meta.height % 8) throw new Error(`Invalid 6×8 transparent atlas: ${id}`);
    const target = path.join(root, `${id}-combat.webp`);
    // 96px cells exceed the largest in-game character. Nearest-neighbor keeps pixel edges crisp.
    const packed = await sharp(source).resize(576,768,{kernel:"nearest"}).png().toBuffer();
    await sharp(packed).webp({ lossless: true, effort: 6 }).toFile(target);
    const [original, encoded] = await Promise.all([sharp(packed).ensureAlpha().raw().toBuffer(), sharp(target).ensureAlpha().raw().toBuffer()]);
    // Fully transparent RGB has no visible meaning and may be canonicalized by WebP.
    for (let i = 0; i < original.length; i += 4) {
      if (original[i+3] !== encoded[i+3] || (original[i+3] && !original.subarray(i,i+3).equals(encoded.subarray(i,i+3)))) throw new Error(`Pixel mismatch: ${id}`);
    }
    await sharp(packed).extract({left:0,top:0,width:576,height:96})
      .webp({lossless:true,effort:6}).toFile(path.join(root,`${id}-idle.webp`));
    report.push({ id, columns:6, rows:8, width:576, height:768, sourceWidth:meta.width,sourceHeight:meta.height,
      sourceBytes:(await fs.stat(source)).size, runtimeBytes:(await fs.stat(target)).size });
  }
  await fs.writeFile(path.join(root,"manifest.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({sourceBytes:report.reduce((n,r)=>n+r.sourceBytes,0),runtimeBytes:report.reduce((n,r)=>n+r.runtimeBytes,0),classes:report.length}));
})().catch(error=>{console.error(error);process.exitCode=1;});
