import React, { RefObject, useEffect, useRef, useState } from 'react';
import { ButterflyPose, Season, Weather } from '../engine/types';
import { butterflyAsset, butterflyDisplayWidth, butterflyTime, butterflyWingspan, chooseButterfly, eligibleButterflies } from '../engine/butterflies';
import { butterflyCount, visitorActivity } from './butterflies';
import { createFlight, FlightPointer, FlightState, flightExpired, flightOpacity, flightScale, isPerched, paintedPixelAt, planPerch, stepFlight } from './butterflyFlight';

type Visitor={id:number;speciesId:string;wingspanMm:number;size:number;flight:FlightState};
type Sprite={image:HTMLImageElement;frameMs:number};
type RenderedVisitor={button:HTMLButtonElement;canvas:HTMLCanvasElement;sprite?:Sprite;frameKey?:string;pose?:ButterflyPose};
export type ObserveButterfly=(target:HTMLButtonElement,speciesId:string,wingspanMm:number,pose?:ButterflyPose)=>void;
const sprites=new Map<string,Promise<Sprite>>();
function loadSprite(id:string):Promise<Sprite> {
  let pending=sprites.get(id);
  if(!pending){
    pending=new Promise((resolve,reject)=>{
      const image=new Image();image.onload=()=>resolve({image,frameMs:id==='hummingbird-clearwing'?30:65});image.onerror=reject;
      // Extracted from the GIF: painting and picking share the exact wing frame.
      image.src=butterflyAsset(id,'flight').replace('flight.gif','flight-sheet.webp');
    });
    sprites.set(id,pending);
  }
  return pending;
}
const foregroundMasks=new WeakMap<HTMLImageElement,{src:string;context:CanvasRenderingContext2D}>();
function foregroundOccludes(scene:HTMLElement,x:number,y:number):boolean {
  return Array.from(scene.querySelectorAll<HTMLImageElement>('img[data-scene-depth="foreground"]:not([data-lantern-surface]), .f-angler-body:not(.f-lantern-relit), .f-rod > img, .f-lantern > img')).some(image=>{
    if(!image.complete||!image.naturalWidth)return false;
    const rect=image.getBoundingClientRect(),style=getComputedStyle(image);
    if(x<rect.left||x>=rect.right||y<rect.top||y>=rect.bottom||Number(style.opacity)===0)return false;
    const fit=style.objectFit==='contain'?Math.min(rect.width/image.naturalWidth,rect.height/image.naturalHeight):undefined;
    const width=fit?image.naturalWidth*fit:rect.width,height=fit?image.naturalHeight*fit:rect.height;
    let u=(x-rect.left-(rect.width-width)/2)/width;
    const v=(y-rect.top-(rect.height-height)/2)/height;
    if(u<0||u>=1||v<0||v>=1)return false;
    // Desktop uses the two halves of the same reed artwork at opposite edges.
    if(style.clipPath&&style.clipPath!=='none'&&((image.dataset.layer==='foreground-reeds'&&u>=.5)||(image.dataset.layer==='foreground-reeds-right'&&u<.5)))return false;
    if(style.getPropertyValue('--flip-x').trim()==='-1')u=1-u;
    const cached=foregroundMasks.get(image),src=image.currentSrc||image.src;
    let context=cached?.src===src?cached.context:undefined;
    if(!context){
      const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
      context=canvas.getContext('2d',{willReadFrequently:true})??undefined;
      if(!context)return true;
      context.drawImage(image,0,0);foregroundMasks.set(image,{src,context});
    }
    return context.getImageData(Math.min(image.naturalWidth-1,Math.floor(u*image.naturalWidth)),Math.floor(v*image.naturalHeight),1,1).data[3]>0;
  });
}
function paint(visitor:Visitor,rendered:RenderedVisitor):void {
  const flight=visitor.flight,scale=flightScale(flight.z),size=visitor.size*320/192*scale;
  const style=rendered.button.style;
  style.left=`${flight.x*100}%`;style.top=`${flight.y*100}%`;style.width=`${size}px`;style.height=`${size}px`;
  style.opacity=String(flight.age<0?0:flightOpacity(flight.z));style.zIndex=flight.behindForeground?'4':'11';
  rendered.button.dataset.depth=flight.z.toFixed(3);rendered.button.dataset.flightState=flight.fleeing?'fleeing':isPerched(flight)?'perched':flight.behindForeground?'distant':'flying';
  if(!rendered.sprite)return;
  const frame=isPerched(flight)?flight.perch!.frame:Math.floor(Math.max(0,flight.age)*1000/rendered.sprite.frameMs)%8;
  const angle=Math.round(flight.heading*24)/24,flip=flight.vx<0?-1:1,key=`${frame}:${angle}:${flip}`;
  if(rendered.frameKey===key)return;
  const context=rendered.canvas.getContext('2d',{willReadFrequently:true});if(!context)return;
  context.clearRect(0,0,320,320);context.save();context.translate(160,160);context.rotate(angle);context.scale(flip,1);
  context.drawImage(rendered.sprite.image,frame*192,0,192,224,-96,-112,192,224);context.restore();rendered.frameKey=key;
  rendered.pose={frame,rotation:angle,flipped:flip<0};rendered.button.dataset.wingFrame=String(frame);
}

export default function ButterflyVisitors({sceneRef,season,hour,weather,location,reducedMotion,preview=0,onObserve}:{sceneRef:RefObject<HTMLDivElement>;season:Season;hour:number;weather:Weather;location:string;reducedMotion:boolean;preview?:number;onObserve?:ObserveButterfly}) {
  const [visitors,setVisitors]=useState<Visitor[]>([]);
  const live=useRef(visitors);live.current=visitors;
  const rendered=useRef(new Map<number,RenderedVisitor>()),pointer=useRef<(FlightPointer&{time:number})|undefined>(undefined);
  const sequence=useRef(0),lastPreview=useRef(0),observe=useRef(onObserve);observe.current=onObserve;
  const activity=visitorActivity(season,hour,weather),time=butterflyTime(hour);
  useEffect(()=>{
    if(!activity||reducedMotion){setVisitors([]);return;}
    const visitHour=time==='day'?12:22;
    const eligible=new Set(eligibleButterflies(season,visitHour,weather).map(species=>species.id));
    setVisitors(current=>current.filter(visitor=>eligible.has(visitor.speciesId)));
    const scene=sceneRef.current;if(!scene)return;
    let timer:ReturnType<typeof setTimeout>|undefined,frame:number|undefined,onScreen=true,previousTime:number|undefined;
    let bounds=scene.getBoundingClientRect();
    const arrive=(force=false)=>{
      if(document.hidden||!onScreen||(!force&&Math.random()>=activity))return;
      if(!bounds.width||!bounds.height)return;
      const count=force?2:butterflyCount(Math.random);
      const arrivals=Array.from({length:count},(_,i)=>{
        const species=chooseButterfly(Math.random,season,visitHour,weather)!;
        const wingspanMm=butterflyWingspan(species,Math.random);
        const flight=createFlight(Math.random,i*.5);
        flight.closeRadius*=Math.min(1,wingspanMm/65);
        const margin=Math.min(.45,butterflyDisplayWidth(wingspanMm)*320/192*flightScale(flight.z)/2/bounds.width+.015);
        flight.x=flight.x<0?-margin:1+margin;
        const foliageOptions=Array.from(scene.querySelectorAll<HTMLElement>(location==='cove'?'[data-layer="cove-seat"]':'[data-layer="foreground-reeds"], [data-layer="foreground-reeds-right"]')).filter(element=>getComputedStyle(element).display!=='none');
        const foliage=foliageOptions[Math.floor(Math.random()*foliageOptions.length)];
        const bank=foliage?.getBoundingClientRect();
        if(bank?.width&&bank.height){
          const split=getComputedStyle(foliage!).clipPath&&getComputedStyle(foliage!).clipPath!=='none';
          const points=location==='cove'?[[.43,.92],[.56,.95],[.31,.84]]:split?foliage!.dataset.layer==='foreground-reeds-right'?[[.88,.78]]:[[.12,.45],[.20,.70]]:[[.12,.45],[.88,.78],[.20,.70]];
          const point=points[Math.floor(Math.random()*points.length)];
          const x=(bank.left-bounds.left+bank.width*point[0])/bounds.width,y=(bank.top-bounds.top+bank.height*point[1])/bounds.height;
          if(x>.03&&x<.97&&y>.05&&y<.96)planPerch(flight,x,y,Math.random);
        }
        return {id:++sequence.current,speciesId:species.id,wingspanMm,size:butterflyDisplayWidth(wingspanMm),flight};
      });
      setVisitors(current=>[...current,...arrivals.slice(0,Math.max(0,5-current.length))]);
      if(frame===undefined)frame=requestAnimationFrame(animate);
    };
    const schedule=(initial=false)=>{clearTimeout(timer);if(!document.hidden&&onScreen)timer=setTimeout(()=>{arrive();schedule();},initial?8000+Math.random()*10000:42000+Math.random()*30000);};
    const animate=(now:number)=>{
      const dt=previousTime===undefined?0:Math.min(.05,(now-previousTime)/1000);previousTime=now;
      const mouse=pointer.current;
      const input=mouse?{...mouse,speed:now-mouse.time<100?mouse.speed:0}:undefined;
      const expired=new Set<number>();
      live.current.forEach(visitor=>{
        stepFlight(visitor.flight,dt,bounds.width,bounds.height,Math.random,input);
        if(flightExpired(visitor.flight))expired.add(visitor.id);
        else {const target=rendered.current.get(visitor.id);if(target)paint(visitor,target);}
      });
      if(expired.size)setVisitors(current=>current.filter(visitor=>!expired.has(visitor.id)));
      if(live.current.length)frame=requestAnimationFrame(animate);
      else {frame=undefined;previousTime=undefined;}
    };
    const visibility=()=>{
      if(frame!==undefined)cancelAnimationFrame(frame);frame=undefined;previousTime=undefined;pointer.current=undefined;
      if(!document.hidden&&onScreen)frame=requestAnimationFrame(animate);
      schedule();
    };
    const move=(event:PointerEvent)=>{
      if(event.pointerType==='touch')return;
      const now=performance.now(),previous=pointer.current;
      const x=event.clientX-bounds.left,y=event.clientY-bounds.top;
      const recent=previous&&now-previous.time<150;
      pointer.current={x,y,previousX:recent?previous.x:x,previousY:recent?previous.y:y,speed:recent?Math.hypot(x-previous.x,y-previous.y)/Math.max(.008,(now-previous.time)/1000):0,time:now};
    };
    const measure=()=>{bounds=scene.getBoundingClientRect();pointer.current=undefined;};
    const resize=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(measure);resize?.observe(scene);
    const observer=typeof IntersectionObserver==='undefined'?undefined:new IntersectionObserver(entries=>{onScreen=entries[0]?.isIntersecting??true;visibility();});
    observer?.observe(scene);document.addEventListener('visibilitychange',visibility);document.addEventListener('pointermove',move,{passive:true});
    window.addEventListener('scroll',measure,true);window.addEventListener('resize',measure);
    if(preview!==lastPreview.current){lastPreview.current=preview;arrive(true);}
    if(frame===undefined)frame=requestAnimationFrame(animate);schedule(true);
    return ()=>{clearTimeout(timer);if(frame!==undefined)cancelAnimationFrame(frame);observer?.disconnect();resize?.disconnect();document.removeEventListener('visibilitychange',visibility);document.removeEventListener('pointermove',move);window.removeEventListener('scroll',measure,true);window.removeEventListener('resize',measure);pointer.current=undefined;};
  },[activity,reducedMotion,preview,sceneRef,location,season,time,weather]);
  return <div className="f-butterfly-visitors" aria-hidden={onObserve?undefined:true} data-layer="butterflies">{visitors.map(visitor=><button type="button" key={visitor.id} ref={button=>{
    if(!button){rendered.current.delete(visitor.id);return;}
    const canvas=button.querySelector('canvas')!;const target:RenderedVisitor={button,canvas};rendered.current.set(visitor.id,target);paint(visitor,target);
    void loadSprite(visitor.speciesId).then(sprite=>{if(rendered.current.get(visitor.id)===target){target.sprite=sprite;paint(visitor,target);}}).catch(()=>{/* Unloaded artwork is never a catchable rectangle. */});
  }} className="f-butterfly-visit" aria-label="Observe butterfly" title="Add this visitor to your field guide" disabled={!onObserve} onClick={event=>{
    const scene=sceneRef.current;
    // Keyboard activation remains available; mouse/touch must hit painted pixels.
    const keyboard=event.detail===0&&event.clientX===0&&event.clientY===0;
    const caught=keyboard?visitor:[...live.current].sort((a,b)=>Number(a.flight.behindForeground)-Number(b.flight.behindForeground)||b.id-a.id).find(candidate=>{
      const target=rendered.current.get(candidate.id);
      return target?.sprite&&candidate.flight.age>=0&&flightOpacity(candidate.flight.z)>0&&paintedPixelAt(target.canvas,event.clientX,event.clientY)&&!(candidate.flight.behindForeground&&scene&&foregroundOccludes(scene,event.clientX,event.clientY));
    });
    if(!caught)return;
    const snapshot=rendered.current.get(caught.id)!;
    if(snapshot.pose)observe.current?.(snapshot.button,caught.speciesId,caught.wingspanMm,{...snapshot.pose});
    else observe.current?.(snapshot.button,caught.speciesId,caught.wingspanMm);
    setVisitors(current=>current.filter(item=>item.id!==caught.id));
  }} data-testid="butterfly-visitor" data-visitor-species={visitor.speciesId} data-wingspan-mm={visitor.wingspanMm}>
    <canvas className="f-butterfly-flight" width={320} height={320} aria-hidden="true"/>
  </button>)}</div>;
}
