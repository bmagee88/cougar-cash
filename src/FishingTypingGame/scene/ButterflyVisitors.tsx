import React, { memo, RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { ButterflyPose, Season, Weather } from '../engine/types';
import { butterflyAsset, butterflyDisplayWidth, butterflySideSheet, butterflyTime, chooseButterfly, eligibleButterflies, SIDE_BUTTERFLY_SPRITE, SIDE_FLIGHT_SPECIES } from '../engine/butterflies';
import { butterflyCount, visitorActivity } from './butterflies';
import { configureButterflyFlight, createFlight, FlightPointer, FlightState, flightExpired, flightOpacity, flightScale, isPerched, paintedPixelAt, stepFlight } from './butterflyFlight';
import { hasDirectionalVisitor, ODONATES, ODONATE_DISPLAY_SCALE, ODONATE_SPRITE, odonateActivity, visitorById, visitorPerchContact,visitorSheet } from '../engine/visitors';
import { stepOdonate } from './odonateFlight';
import { DragonflyDirection, stepDragonflyView } from './dragonflyView';
import { movePlantPerches,planPlantVisit,refreshPlantTargets, visiblePlantPerches } from './plantMap';
import { gardenFlights, registerGardenFlights, stepGardenEncounter } from './insectGarden';
import { GARDEN_READY_EVENT } from './gardenEvents';
import {foregroundDepth,reframeSceneDepth,sceneDepthFrame} from './sceneDepth';
import {foregroundCollision} from './foregroundCollision';

type Visitor={id:number;speciesId:string;wingspanMm:number;size:number;flight:FlightState;direction?:DragonflyDirection};
type Sprite={image:HTMLImageElement;frameMs:number};
type RenderedVisitor={button:HTMLButtonElement;canvas:HTMLCanvasElement;sprite?:Sprite;sideSprite?:Sprite;frontSprite?:Sprite;backSprite?:Sprite;frameKey?:string;pose?:ButterflyPose};
export type { Visitor, RenderedVisitor };
export type ObserveButterfly=(target:HTMLButtonElement,speciesId:string,wingspanMm:number,pose?:ButterflyPose)=>void;
const sprites=new Map<string,Promise<Sprite>>();
export const BUTTERFLY_SPRITE_CACHE_LIMIT=6;
const BUTTERFLY_SPRITE={width:192,height:224,canvasSize:320};
function loadSprite(id:string,view?:ButterflyPose['view']):Promise<Sprite> {
  const source=visitorById(id)?visitorSheet(id,view):view==='side'?butterflySideSheet(id):butterflyAsset(id,'flight').replace('flight.gif','flight-sheet.webp');
  let pending=sprites.get(source);
  if(pending){sprites.delete(source);sprites.set(source,pending);}
  if(!pending){
    pending=new Promise((resolve,reject)=>{
      const image=new Image();image.onload=()=>resolve({image,frameMs:visitorById(id)?.kind==='dragonfly'?30:id==='hummingbird-clearwing'?30:65});image.onerror=reject;
      // Extracted from the GIF: painting and picking share the exact wing frame.
      image.src=source;
    });
    pending=pending.catch(error=>{if(sprites.get(source)===pending)sprites.delete(source);throw error;});
    sprites.set(source,pending);
    while(sprites.size>BUTTERFLY_SPRITE_CACHE_LIMIT)sprites.delete(sprites.keys().next().value!);
  }
  return pending;
}
const foregroundMasks=new WeakMap<HTMLImageElement,{src:string;context:CanvasRenderingContext2D}>();
export function foregroundOccludes(scene:HTMLElement,x:number,y:number):boolean {
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
/** Resolve across visitor families: transparent canvas padding must not prevent
 * clicking a painted insect (or sleigh) underneath another visitor's button. */
export function paintedVisitorButton(scene:HTMLElement,x:number,y:number):HTMLButtonElement|undefined {
  const buttons=Array.from(scene.querySelectorAll<HTMLButtonElement>('.f-butterfly-visit,.f-santa-visit')).reverse();
  return buttons.sort((a,b)=>Number(b.style.zIndex||5)-Number(a.style.zIndex||5)).find(button=>{
    if(button.disabled||Number(button.style.opacity||1)<=0||(!button.dataset.wingFrame&&!button.dataset.painted))return false;
    const canvas=button.querySelector('canvas');
    return !!canvas&&paintedPixelAt(canvas,x,y)&&!(Number(button.style.zIndex||5)<=5&&foregroundOccludes(scene,x,y));
  });
}
function paint(visitor:Visitor,rendered:RenderedVisitor):void {
  const flight=visitor.flight,perched=isPerched(flight),perch=flight.perch;
  const directional=hasDirectionalVisitor(visitor.speciesId)&&!perched;
  const direction=directional?visitor.direction?.view:undefined;
  const depthSprite=direction==='front'?rendered.frontSprite:direction==='back'?rendered.backSprite:undefined;
  const sidewaysLanding=perch?.sideways&&!perch.finished&&!flight.fleeing&&!flight.behindForeground&&flight.age>=perch.startAt;
  const side=!!rendered.sideSprite&&(perched?perch?.sideways:sidewaysLanding||Math.abs(flight.vx)>35);
  const sprite=side?SIDE_BUTTERFLY_SPRITE:visitorById(visitor.speciesId)?ODONATE_SPRITE:BUTTERFLY_SPRITE;
  const scale=flightScale(flight.z,flight.perspective),size=visitor.size*sprite.canvasSize/sprite.width*scale;
  const style=rendered.button.style;
  style.left=`${flight.x*100}%`;style.top=`${flight.y*100}%`;style.width=`${size}px`;style.height=`${size}px`;
  style.opacity=String(flight.age<0?0:flightOpacity(flight.z));style.zIndex=flight.behindForeground?'4':'11';
  rendered.button.dataset.depth=flight.z.toFixed(4);rendered.button.dataset.flightState=flight.fleeing?'fleeing':isPerched(flight)?'perched':flight.behindForeground?'distant':'flying';
  rendered.button.dataset.flightMode=flight.mode??'flap';rendered.button.dataset.plant=flight.perch?.plantId??'';rendered.button.dataset.perchVisits=String(flight.perch?.visits??0);
  rendered.button.dataset.flowerBehavior=flight.flowerWait?'waiting':flight.age<(flight.evadeUntil??0)?'displaced':'';
  if(!rendered.sprite)return;
  if(rendered.canvas.width!==sprite.canvasSize){rendered.canvas.width=sprite.canvasSize;rendered.canvas.height=sprite.canvasSize;rendered.frameKey=undefined;}
  const image=depthSprite?.image??(side?rendered.sideSprite!.image:rendered.sprite.image);
  const frame=isPerched(flight)&&!flight.perch?.hoverFeed?flight.perch!.frame:flight.mode==='glide'?(side?3:0):flight.wingFrame??Math.floor(Math.max(0,flight.age)*1000/rendered.sprite.frameMs)%8;
  const view=depthSprite?direction as 'front'|'back':side?'side':undefined;
  const angle=depthSprite?0:Math.round(flight.heading*24)/24;
  const facingLeft=directional?direction==='left'||(direction!=='right'&&(flight.motionVx??flight.vx)<0):(perched&&side?perch?.facing??flight.facing??flight.vx:flight.facing??flight.vx)<0;
  const flip=!depthSprite&&facingLeft?-1:1;
  const key=`${frame}:${angle}:${flip}:${view??'dorsal'}:${isPerched(flight)?'rest':'flight'}`;
  if(rendered.frameKey===key)return;
  const context=rendered.canvas.getContext('2d',{willReadFrequently:true});if(!context)return;
  context.clearRect(0,0,sprite.canvasSize,sprite.canvasSize);context.save();context.translate(sprite.canvasSize/2,sprite.canvasSize/2);context.rotate(angle);context.scale(flip,1);
  // Rotate and flip around the thorax, so changing views does not move the body.
  const contact=isPerched(flight)?visitorPerchContact(visitor.speciesId):undefined;
  const originX=contact?-contact.x:-sprite.width/2-(hasDirectionalVisitor(visitor.speciesId)&&!depthSprite?27:0);
  const originY=contact?-contact.y:-sprite.height/2;
  context.drawImage(image,frame*sprite.width,0,sprite.width,sprite.height,originX,originY,sprite.width,sprite.height);context.restore();rendered.frameKey=key;
  rendered.pose={frame,rotation:angle,flipped:flip<0,...(view?{view}:{})};rendered.button.dataset.wingFrame=String(frame);rendered.button.dataset.wingView=view??'dorsal';
  if(directional)rendered.button.dataset.flightDirection=depthSprite?direction!:flip<0?'left':'right';
}
export { loadSprite as loadVisitorSprite, paint as paintVisitor };

/** Keep the canvas and loaded views attached across clock and sibling updates. */
function VisitorButton({visitor,rendered,family,enabled,onClick}:{visitor:Visitor;rendered:RefObject<Map<number,RenderedVisitor>>;family:'butterflies'|'odonates';enabled:boolean;onClick:React.MouseEventHandler<HTMLButtonElement>}) {
  const attach=useCallback((button:HTMLButtonElement|null)=>{
    if(!button){rendered.current?.delete(visitor.id);return;}
    const canvas=button.querySelector('canvas')!,target:RenderedVisitor={button,canvas};rendered.current!.set(visitor.id,target);paint(visitor,target);
    const load=(view?:ButterflyPose['view'])=>{
      void loadSprite(visitor.speciesId,view).then(sprite=>{
        if(rendered.current?.get(visitor.id)!==target)return;
        if(view==='side')target.sideSprite=sprite;else if(view==='front')target.frontSprite=sprite;else if(view==='back')target.backSprite=sprite;else target.sprite=sprite;
        paint(visitor,target);
      }).catch(()=>{/* Retain available artwork; missing pixels cannot be caught. */});
    };
    load();
    if(SIDE_FLIGHT_SPECIES.includes(visitor.speciesId))load('side');
    if(hasDirectionalVisitor(visitor.speciesId)){load('front');load('back');}
  },[visitor,rendered]);
  const size=family==='odonates'?ODONATE_SPRITE.canvasSize:BUTTERFLY_SPRITE.canvasSize;
  return <button type="button" ref={attach} className="f-butterfly-visit" aria-label={family==='odonates'?`Observe ${visitorById(visitor.speciesId)?.kind}`:'Observe butterfly'} title="Add this visitor to your field guide" disabled={!enabled} onClick={onClick}
    data-testid={family==='odonates'?'odonate-visitor':'butterfly-visitor'} data-visitor-species={visitor.speciesId} data-wingspan-mm={visitor.wingspanMm}>
    <canvas className="f-butterfly-flight" width={size} height={size} aria-hidden="true"/>
  </button>;
}

export default memo(function ButterflyVisitors({sceneRef,season,hour,weather,location,reducedMotion,preview=0,onObserve,family='butterflies'}:{sceneRef:RefObject<HTMLDivElement>;season:Season;hour:number;weather:Weather;location:string;reducedMotion:boolean;preview?:number;onObserve?:ObserveButterfly;family?:'butterflies'|'odonates'}) {
  const [visitors,setVisitors]=useState<Visitor[]>([]);
  const live=useRef(visitors);live.current=visitors;
  const rendered=useRef(new Map<number,RenderedVisitor>()),pointer=useRef<(FlightPointer&{time:number})|undefined>(undefined);
  const sequence=useRef(0),lastPreview=useRef(0),observe=useRef(onObserve);observe.current=onObserve;
  const previousLocation=useRef(location);
  const activity=family==='odonates'?odonateActivity(season,hour,weather):visitorActivity(season,hour,weather),time=butterflyTime(hour);
  const sprite=family==='odonates'?ODONATE_SPRITE:BUTTERFLY_SPRITE;
  useEffect(()=>{const scene=sceneRef.current;if(scene)return registerGardenFlights(scene,visitors.map(visitor=>visitor.flight));},[sceneRef,visitors]);
  useEffect(()=>{
    if(!activity||reducedMotion){setVisitors([]);return;}
    const visitHour=time==='day'?12:22;
    const eligible=new Set(family==='odonates'?ODONATES.map(species=>species.id):eligibleButterflies(season,visitHour,weather).map(species=>species.id));
    const moved=previousLocation.current!==location;previousLocation.current=location;
    setVisitors(current=>moved?[]:current.filter(visitor=>eligible.has(visitor.speciesId)));
    const scene=sceneRef.current;if(!scene)return;
    let timer:ReturnType<typeof setTimeout>|undefined,frame:number|undefined,measurement:number|undefined,onScreen=true,previousTime:number|undefined;
    let bounds=scene.getBoundingClientRect(),camera=sceneDepthFrame(scene,location,bounds),horizon=camera.horizon,plants=visiblePlantPerches(scene,location,bounds);
    const obstacles=foregroundCollision(scene);obstacles.measure(bounds);
    const measureHorizon=()=>{
      camera=sceneDepthFrame(scene,location,bounds);horizon=camera.horizon;
      live.current.forEach(({flight})=>{
        if(flight.perspective&&!isPerched(flight))reframeSceneDepth(flight,flight.perspective,camera);
        flight.perspective=camera;
      });
    };
    measureHorizon();
    const arrive=(force=false)=>{
      if(document.hidden||!onScreen||(!force&&Math.random()>=activity))return;
      if(!bounds.width||!bounds.height)return;
      if(force)lastPreview.current=preview;
      const count=force?2:butterflyCount(Math.random);
      const arrivals=Array.from({length:count},(_,i)=>{
        const choices=eligibleButterflies(season,visitHour,weather);
        const species=family==='odonates'?ODONATES[(i+(force?0:Math.floor(Math.random()*ODONATES.length)))%ODONATES.length]:force?choices[((preview-1)*2+i)%choices.length]:chooseButterfly(Math.random,season,visitHour,weather)!;
        const wingspanMm=species.wingspanMm[0]+Math.random()*(species.wingspanMm[1]-species.wingspanMm[0]);
        const flight=createFlight(Math.random,i*.5);
        flight.perspective=camera;
        if(family==='odonates'){flight.y=horizon+.10+Math.random()*.24;flight.z=.035+Math.random()*.065;flight.turnIn=0;flight.departAt=55+Math.random()*20;}
        else configureButterflyFlight(flight,species.id,Math.random);
        flight.z=Math.min(flight.z,foregroundDepth(camera)*.65);
        flight.closeRadius*=Math.min(1,wingspanMm/65);
        const size=butterflyDisplayWidth(wingspanMm)*(family==='odonates'?ODONATE_DISPLAY_SCALE:.5);
        const margin=Math.min(.45,size*sprite.canvasSize/sprite.width*flightScale(flight.z,camera)/2/bounds.width+.015);
        flight.x=flight.x<0?-margin:1+margin;
        const kind=visitorById(species.id)?.kind??('kind' in species&&species.kind==='moth'&&species.id!=='hummingbird-clearwing'?'moth':'butterfly');
        planPlantVisit(flight,plants,kind,Math.random);
        return {id:++sequence.current,speciesId:species.id,wingspanMm,size,flight};
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
      const peers=gardenFlights(scene);
      movePlantPerches(plants,parseFloat(scene.style.getPropertyValue('--scene-x'))||0,parseFloat(scene.style.getPropertyValue('--scene-y'))||0);
      live.current.forEach(visitor=>{
        const perch=visitor.flight.perch,plant=plants.find(candidate=>candidate.id===perch?.plantId);
        if(perch&&plant){
          perch.x=plant.x;perch.y=plant.y-(perch.hoverFeed?.018:0);
          if(isPerched(visitor.flight)){visitor.flight.x=perch.x;visitor.flight.y=perch.y;}
        }
        const odonate=visitorById(visitor.speciesId);
        if(!stepGardenEncounter(visitor.flight,dt,bounds.width,bounds.height,peers,Math.random,input)){
          if(odonate)stepOdonate(visitor.flight,odonate.kind,dt,bounds.width,bounds.height,Math.random,input,horizon,obstacles.hit);
          else stepFlight(visitor.flight,dt,bounds.width,bounds.height,Math.random,input,horizon,obstacles.hit);
        }
        if(hasDirectionalVisitor(visitor.speciesId))visitor.direction=stepDragonflyView(visitor.direction,visitor.flight,dt);
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
      if(!document.hidden&&onScreen&&preview!==lastPreview.current)arrive(true);
      schedule();
    };
    const move=(event:PointerEvent)=>{
      if(event.pointerType==='touch')return;
      const now=performance.now(),previous=pointer.current;
      const x=event.clientX-bounds.left,y=event.clientY-bounds.top;
      const recent=previous&&now-previous.time<150;
      pointer.current={x,y,previousX:recent?previous.x:x,previousY:recent?previous.y:y,speed:recent?Math.hypot(x-previous.x,y-previous.y)/Math.max(.008,(now-previous.time)/1000):0,time:now};
    };
    const measure=()=>{
      measurement=undefined;
      bounds=scene.getBoundingClientRect();measureHorizon();obstacles.measure(bounds);pointer.current=undefined;plants=visiblePlantPerches(scene,location,bounds);
      live.current.forEach(visitor=>{
        const use=visitorById(visitor.speciesId)?.kind??(visitor.flight.pattern==='moth'?'moth':'butterfly');
        refreshPlantTargets(visitor.flight,plants,use,Math.random);
      });
    };
    // A garden can load dozens of cutouts together. Snapshot it once per frame.
    const scheduleMeasure=()=>{if(measurement===undefined)measurement=requestAnimationFrame(measure);};
    const resize=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(scheduleMeasure);resize?.observe(scene);
    scene.addEventListener('load',scheduleMeasure,true);
    scene.addEventListener(GARDEN_READY_EVENT,scheduleMeasure);
    const observer=typeof IntersectionObserver==='undefined'?undefined:new IntersectionObserver(entries=>{onScreen=entries[0]?.isIntersecting??true;visibility();});
    observer?.observe(scene);document.addEventListener('visibilitychange',visibility);document.addEventListener('pointermove',move,{passive:true});
    window.addEventListener('scroll',scheduleMeasure,true);window.addEventListener('resize',scheduleMeasure);
    if(preview!==lastPreview.current)arrive(true);
    if(frame===undefined)frame=requestAnimationFrame(animate);schedule(true);
    return ()=>{clearTimeout(timer);if(frame!==undefined)cancelAnimationFrame(frame);if(measurement!==undefined)cancelAnimationFrame(measurement);observer?.disconnect();resize?.disconnect();scene.removeEventListener('load',scheduleMeasure,true);scene.removeEventListener(GARDEN_READY_EVENT,scheduleMeasure);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('pointermove',move);window.removeEventListener('scroll',scheduleMeasure,true);window.removeEventListener('resize',scheduleMeasure);pointer.current=undefined;};
  },[activity,reducedMotion,preview,sceneRef,location,season,time,weather,family,sprite]);
  return <div className="f-butterfly-visitors" aria-hidden={onObserve?undefined:true} data-layer={family}>{visitors.map(visitor=><VisitorButton key={visitor.id} visitor={visitor} rendered={rendered} family={family} enabled={!!onObserve} onClick={event=>{
    const scene=sceneRef.current;
    // Keyboard activation remains available; mouse/touch must hit painted pixels.
    const keyboard=event.detail===0&&event.clientX===0&&event.clientY===0;
    if(!keyboard&&scene){const top=paintedVisitorButton(scene,event.clientX,event.clientY);if(!top)return;if(top!==event.currentTarget){top.click();return;}}
    const caught=keyboard?visitor:[...live.current].sort((a,b)=>Number(a.flight.behindForeground)-Number(b.flight.behindForeground)||b.id-a.id).find(candidate=>{
      const target=rendered.current.get(candidate.id);
      return target?.sprite&&candidate.flight.age>=0&&flightOpacity(candidate.flight.z)>0&&paintedPixelAt(target.canvas,event.clientX,event.clientY)&&!(candidate.flight.behindForeground&&scene&&foregroundOccludes(scene,event.clientX,event.clientY));
    });
    if(!caught)return;
    const snapshot=rendered.current.get(caught.id)!;
    if(snapshot.pose)observe.current?.(snapshot.button,caught.speciesId,caught.wingspanMm,{...snapshot.pose});
    else observe.current?.(snapshot.button,caught.speciesId,caught.wingspanMm);
    setVisitors(current=>current.filter(item=>item.id!==caught.id));
  }}/>)}</div>;
});
