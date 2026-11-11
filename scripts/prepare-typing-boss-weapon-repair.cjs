// Pack the six repaired frames into row 1; preserve every other decoded pixel.
// Artwork cleanup is performed by image_gen, not by this packing script.
const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");
const root = path.resolve(__dirname, "../public/assets/typing-boss/characters");
const classes = ["paladin", "cleric", "rogue", "necromancer"];
const CELL_W=128, CELL_H=96, ATLAS_W=CELL_W*6;
function opaqueBounds(pixels,width,height,left=0,top=0) {
  let x0=width,y0=height,x1=0,y1=0;
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) if(pixels[((top+y)*576+left+x)*4+3]>=230) {
    x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
  }
  return {x0,x1,y0,y1};
}

(async () => {
  const anchors = {}, report = [];
  for (const id of classes) {
    const source = path.join(root, `${id}-weapon-v2.png`);
    const meta = await sharp(source).metadata();
    if (!meta.hasAlpha || meta.width % 3 || meta.height % 2 || meta.width/3 !== meta.height/2) {
      throw new Error(`Expected transparent 3x2 square-cell repair: ${id}`);
    }
    const original = await sharp(path.join(root, `${id}-combat.webp`)).ensureAlpha().raw().toBuffer();
    const packed=Buffer.alloc(ATLAS_W*768*4),cell=meta.width/3,frames=[];
    // Add 16 transparent pixels on each side of the original 96px cells.
    for(let row=0;row<8;row++) for(let frame=0;frame<6;frame++) for(let y=0;y<96;y++) {
      const from=((row*96+y)*576+frame*96)*4;
      original.copy(packed,((row*96+y)*ATLAS_W+frame*CELL_W+16)*4,from,from+96*4);
    }
    const reference=opaqueBounds(original,96,96,0,96);
    const first=await sharp(source).extract({left:0,top:0,width:cell,height:cell}).ensureAlpha().raw().toBuffer();
    let firstTop=cell,firstBottom=0;
    for(let y=0;y<cell;y++)for(let x=0;x<cell;x++)if(first[(y*cell+x)*4+3]>=230){firstTop=Math.min(firstTop,y);firstBottom=Math.max(firstBottom,y);}
    const scaledSize=Math.round(cell*(reference.y1-reference.y0+1)/(firstBottom-firstTop+1));
    const offsetX=Math.round((CELL_W-scaledSize)/2),offsetY=Math.round(reference.y1-firstBottom*scaledSize/cell);
    anchors[id]={cellWidth:CELL_W,weaponAnchors:[]};
    for (let frame=0; frame<6; frame++) {
      const scaled=await sharp(source).extract({left:frame%3*cell,top:Math.floor(frame/3)*cell,width:cell,height:cell})
        .resize(scaledSize,scaledSize,{kernel:"nearest"}).ensureAlpha().raw().toBuffer();
      const pixels=Buffer.alloc(CELL_W*CELL_H*4);
      for(let y=0;y<scaledSize;y++)for(let x=0;x<scaledSize;x++) {
        const from=(y*scaledSize+x)*4,dx=x+offsetX,dy=y+offsetY;
        // Canonicalize sub-1% alpha left by the generated soft glow.
        if(scaled[from+3]<=2)continue;
        if(dx<0||dx>=CELL_W||dy<0||dy>=CELL_H) {
          if(scaled[from+3]>=16)throw new Error(`Visible artwork would be cropped: ${id} ${frame+1}`);
          continue;
        }
        scaled.copy(pixels,(dy*CELL_W+dx)*4,from,from+4);
      }
      let sum=0, count=0, visible=0;
      for (let y=0; y<CELL_H; y++) for (let x=0; x<CELL_W; x++) {
        const alpha=pixels[(y*CELL_W+x)*4+3];
        // An empty gutter is the key regression check: no neighboring-cell art.
        if (alpha>=16 && (x<4 || x>=CELL_W-4 || y<4 || y>=CELL_H-4)) throw new Error(`Nonempty frame gutter: ${id} frame ${frame+1} at ${x},${y}`);
        if(x<4 || x>=CELL_W-4 || y<4 || y>=CELL_H-4)pixels[(y*CELL_W+x)*4+3]=0;
        if (alpha) visible++;
        if (alpha>=230 && y>=72 && y<91) {sum+=x;count++;}
      }
      if (!count || visible<350 || visible>6500) throw new Error(`Invalid character frame: ${id} ${frame+1}`);
      const anchor=Number((sum/count).toFixed(4));
      anchors[id].weaponAnchors.push(anchor);
      for (let y=0; y<96; y++) pixels.copy(packed, ((96+y)*ATLAS_W+frame*CELL_W)*4, y*CELL_W*4, (y+1)*CELL_W*4);
      frames.push({frame:frame+1,anchor,visiblePixels:visible,transparentGutter:4});
    }
    const target=path.join(root,`${id}-combat-v2.webp`);
    await sharp(packed,{raw:{width:ATLAS_W,height:768,channels:4}}).webp({lossless:true,effort:6}).toFile(target);
    const encoded=await sharp(target).ensureAlpha().raw().toBuffer();
    for (let i=0; i<packed.length; i+=4) {
      if (packed[i+3]!==encoded[i+3] || (packed[i+3] && !packed.subarray(i,i+3).equals(encoded.subarray(i,i+3)))) throw new Error(`Lossless packing failed: ${id}`);
    }
    for(let row=0;row<8;row++)if(row!==1)for(let frame=0;frame<6;frame++)for(let y=0;y<96;y++)for(let x=0;x<96;x++) {
      const from=((row*96+y)*576+frame*96+x)*4,to=((row*96+y)*ATLAS_W+frame*CELL_W+16+x)*4;
      if(original[from+3]!==encoded[to+3] || (original[from+3] && !original.subarray(from,from+3).equals(encoded.subarray(to,to+3))))throw new Error(`Unrelated row changed: ${id} ${row}`);
    }
    report.push({id,sourceWidth:meta.width,sourceHeight:meta.height,cellWidth:CELL_W,cellHeight:CELL_H,scaledSize,offsetX,offsetY,runtimeBytes:(await fs.stat(target)).size,frames,unchangedOtherRows:true});
  }
  await fs.writeFile(path.resolve(root,"../../../../src/TypingBoss/weaponRepairAnchors.ts"),"// Generated by scripts/prepare-typing-boss-weapon-repair.cjs.\nconst weaponRepair = "+JSON.stringify(anchors,null,2)+";\nexport default weaponRepair;\n");
  await fs.writeFile(path.join(root,"weapon-repair-manifest.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({classes:report.length,frames:24,bytes:report.reduce((n,r)=>n+r.runtimeBytes,0),unchangedOtherRows:true}));
})().catch(error=>{console.error(error);process.exitCode=1;});
