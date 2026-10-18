import {DepthObstruction} from './sceneDepth';

interface Mask {src:string;width:number;height:number;alpha:Uint8Array}
interface Obstacle {left:number;top:number;width:number;height:number;px:number;py:number;flipped:boolean;half:number;mask:Mask}
const masks=new WeakMap<HTMLImageElement,Mask>();
const sourceMasks=new Map<string,Mask>();
const SELECTOR='img[data-scene-depth="foreground"]:not([data-lantern-surface]),.f-flower-plant img,.f-angler-body:not(.f-lantern-relit),.f-rod > img,.f-lantern > img';
function imageMask(image:HTMLImageElement):Mask|undefined {
  const src=image.currentSrc||image.src,cached=masks.get(image);
  if(cached?.src===src)return cached;
  const shared=sourceMasks.get(src);
  if(shared){sourceMasks.delete(src);sourceMasks.set(src,shared);masks.set(image,shared);return shared;}
  // Bounded, shared alpha masks: decode once per loaded image/source. No
  // getImageData, canvas painting, or geometry reads during a flight step.
  const scale=Math.min(1,512/Math.max(image.naturalWidth,image.naturalHeight));
  const width=Math.max(1,Math.round(image.naturalWidth*scale)),height=Math.max(1,Math.round(image.naturalHeight*scale));
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)return;
  try {
    context.drawImage(image,0,0,width,height);
    const rgba=context.getImageData(0,0,width,height).data,alpha=new Uint8Array(width*height);
    for(let i=0;i<alpha.length;i++)alpha[i]=rgba[i*4+3];
    const mask={src,width,height,alpha};masks.set(image,mask);sourceMasks.set(src,mask);
    while(sourceMasks.size>64)sourceMasks.delete(sourceMasks.keys().next().value!);
    return mask;
  }catch{return;}
}

/** Snapshot static scenery only on layout/load. Hit tests follow camera drift
 * through inline custom properties, without forcing layout on animation frames. */
export function foregroundCollision(scene:HTMLElement) {
  let obstacles:Obstacle[]=[];
  const drift=()=>[parseFloat(scene.style.getPropertyValue('--scene-x'))||0,parseFloat(scene.style.getPropertyValue('--scene-y'))||0];
  const measure=(bounds:DOMRect)=>{
    obstacles=[];if(!bounds.width||!bounds.height)return;
    const [sceneX,sceneY]=drift();
    scene.querySelectorAll<HTMLImageElement>(SELECTOR).forEach(image=>{
      if(!image.complete||!image.naturalWidth||image.closest('[data-garden-ready="false"]'))return;
      const style=getComputedStyle(image),rect=image.getBoundingClientRect();
      if(style.display==='none'||style.visibility==='hidden'||parseFloat(style.opacity)===0||!rect.width||!rect.height)return;
      const mask=imageMask(image);if(!mask)return;
      const fit=style.objectFit==='contain'?Math.min(rect.width/image.naturalWidth,rect.height/image.naturalHeight):undefined;
      const width=fit?image.naturalWidth*fit:rect.width,height=fit?image.naturalHeight*fit:rect.height;
      let px=0,py=0;
      for(let node:HTMLElement|null=image;node&&node!==scene;node=node.parentElement){
        if(node!==image){const parent=getComputedStyle(node);if(parent.display==='none'||parent.visibility==='hidden'||parseFloat(parent.opacity)===0)return;}
        const number=(name:string)=>parseFloat(node!.style.getPropertyValue(name))||0;
        const parallax=number('--parallax')+number('--character-parallax');
        px+=parallax+number('--ground-parallax')+number('--flower-parallax-x');
        py+=parallax+number('--flower-parallax-y');
      }
      const half=style.clipPath&&style.clipPath!=='none'?(image.dataset.layer==='foreground-reeds'?-1:image.dataset.layer==='foreground-reeds-right'?1:0):0;
      obstacles.push({left:(rect.left-bounds.left+(rect.width-width)/2-sceneX*px)/bounds.width,
        top:(rect.top-bounds.top+(rect.height-height)/2-sceneY*py)/bounds.height,width:width/bounds.width,height:height/bounds.height,
        px:px/bounds.width,py:py/bounds.height,half,mask,
        flipped:style.getPropertyValue('--flip-x').trim()==='-1'||style.getPropertyValue('--flower-flip').trim()==='-1'});
    });
  };
  const hit:DepthObstruction=(x,y)=>{
    const [sceneX,sceneY]=drift();
    return obstacles.some(obstacle=>{
      let u=(x-obstacle.left-sceneX*obstacle.px)/obstacle.width;
      const v=(y-obstacle.top-sceneY*obstacle.py)/obstacle.height;
      if(u<0||u>=1||v<0||v>=1||(obstacle.half===-1&&u>=.5)||(obstacle.half===1&&u<.5))return false;
      if(obstacle.flipped)u=1-u;
      const mask=obstacle.mask,column=Math.min(mask.width-1,Math.floor(u*mask.width));
      return mask.alpha[Math.floor(v*mask.height)*mask.width+column]>32;
    });
  };
  return {measure,hit};
}
