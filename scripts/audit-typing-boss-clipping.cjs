// Read-only atlas and viewport audit. Writes QA reports, never changes artwork.
const fs=require('node:fs/promises'),path=require('node:path'),sharp=require('sharp');
const root=path.resolve(__dirname,'../public/assets/typing-boss'),out=path.resolve(__dirname,'../output/animation-audit');
const parse=async file=>{const s=await fs.readFile(path.resolve(__dirname,'../src/TypingBoss',file),'utf8');return JSON.parse(s.slice(s.indexOf('{'),s.lastIndexOf('}')+1));};
async function audit(file,cols,rows,options={}){
  const {data,info}=await sharp(path.join(root,file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const w=info.width/cols,h=info.height/rows,result=[];
  if(!Number.isInteger(w)||!Number.isInteger(h))throw Error(`Fractional cells: ${file}`);
  for(let row=0;row<rows;row++)for(let col=0;col<(options.counts?.[row] ?? cols);col++){
    let left=w,right=-1,top=h,bottom=-1,edge=0,pixels=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[((row*h+y)*info.width+col*w+x)*4+3]>=128){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);pixels++;if(!x||x===w-1||!y||y===h-1)edge++;}
    const transform=options.transforms?.[row]?.[col],camera=options.camera;
    let clipped=false,bounds,worldBounds;
    if(transform&&camera){const sx=transform.scaleX ?? 1,sy=transform.scaleY ?? 1;
      worldBounds={left:left*sx+(transform.x || 0),right:right*sx+(transform.x || 0),top:top*sy+(transform.y || 0),bottom:bottom*sy+(transform.y || 0)};
      bounds={left:worldBounds.left-camera.left,right:worldBounds.right-camera.left,top:worldBounds.top-camera.top,bottom:worldBounds.bottom-camera.top};
      clipped=!options.allowOverflow && (bounds.left<0||bounds.top<0||bounds.right>=(camera.width ?? camera.size)||bounds.bottom>=(camera.height ?? camera.size));
    }
    result.push({file,row,frame:col,cell:{w,h},pixels,edge,margin:Math.min(left,top,w-right-1,h-bottom-1),bounds:{left,top,right,bottom},worldBounds,viewport:bounds,allowOverflow:Boolean(options.allowOverflow),clipped});
  }
  return result;
}
(async()=>{
  await fs.mkdir(out,{recursive:true});const results=[];
  const characters=await parse('characterRegistration.ts');
  for(const c of Object.values(characters)){
    const transforms=Array.from({length:8},(_,row)=>Array.from({length:6},(_,frame)=>{
      const stable=row===0||row===2||row===3||(row===1&&c.repairedWeapon),standing=((row===4||row===5)&&(frame===0||frame===5))||(row===6&&frame===5);
      return {x:c.cellWidth/2-c.anchors[stable||standing?row:0][frame],y:0};
    }));
    results.push(...await audit('characters/'+c.filename,6,8,{transforms,camera:{left:-c.cellWidth/3,top:0,width:c.cellWidth*5/3,height:c.cellHeight}}));
  }
  for(const file of ['cleric-idle-sprite.png','paladin-idle-sprite.png','characters/barbarian-school-idle.webp','characters/rogue-school-idle.webp','characters/necromancer-idle.webp','characters/monk-idle.webp'])results.push(...await audit(file,6,1));
  const dr=await parse('dragonRegistration.ts');
  let visual;try{visual=await parse('bossVisualRegistration.ts');}catch{}
  const camera=id=>visual?.cameras[id] || dr[id].camera;
  const names={infernalDragon:'ancient-red-dragon',cindermaw:'cindermaw',emberWhelp:'ember-whelp'};
  for(const [id,name]of Object.entries(names))results.push(...await audit(`dragons/${name}-attacks-v2.webp`,6,4,{transforms:dr[id].rows,camera:camera(id)}));
  const hr=await parse('dragonHurtRegistration.ts');
  for(const [id,name]of Object.entries(names))results.push(...await audit(`dragons/${name}-hurt.webp`,10,3,{counts:[3,6,10],transforms:['basic','power','critical'].map(k=>hr[id].tiers[k]),camera:camera(id)}));
  const flame=await parse('dragonFlameRegistration.ts');
  for(const [id,name]of Object.entries(names))results.push(...await audit(`dragons/${name}-flame-20-v2.webp`,5,4,{transforms:Array.from({length:4},(_,r)=>flame[id].frames.slice(r*5,r*5+5)),camera:camera(id)}));
  for(const [kind,c]of Object.entries(require('../src/TypingBoss/krakenAnimationRules').KRAKEN_ANIMATIONS))results.push(...await audit(`kraken/${c.file}.webp`,c.columns,c.rows));
  for(const id of [...Object.keys(names),'kraken']){
    const file=`idles/${id}.webp`,meta=await sharp(path.join(root,file)).metadata(),g=visual.idles[id];
    results.push(...await audit(file,6,1,{transforms:[Array.from({length:6},()=>({scaleX:g.scaleX/(meta.width/6),scaleY:g.scaleY/meta.height,x:g.left/100,y:g.top/100}))],camera:{size:1,left:0,top:0}}));
  }
  results.push(...await audit('wyrm/combat-v2.webp',6,12),...await audit('summons/zombie-combat.webp',6,8),...await audit('kneeling/party-kneeling.webp',6,6));
  for(const [id,row]of [['infernalDragon',0],['cindermaw',1],['emberWhelp',2]]){
    const collapse=await audit('dragons/forward-collapse.webp',6,3,{transforms:Array.from({length:3},()=>Array.from({length:6},()=>({scaleX:1,x:0,y:0}))),camera:camera(id)});
    results.push(...collapse.filter(f=>f.row===row));
  }
  const problems=results.filter(f=>f.edge || f.clipped || !f.pixels);
  await fs.writeFile(path.join(out,'clipping.json'),JSON.stringify({frames:results.length,problems,results},null,2));
  console.log(JSON.stringify({frames:results.length,edgeFrames:results.filter(f=>f.edge).length,viewportClips:results.filter(f=>f.clipped).length,problems:problems.map(({file,row,frame,edge,viewport})=>({file,row,frame,edge,viewport}))},null,2));
  if(problems.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
