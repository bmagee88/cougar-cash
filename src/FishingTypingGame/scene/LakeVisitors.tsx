import React, { CSSProperties, RefObject, useEffect, useRef, useState } from 'react';
import { DayPeriod, Season, Weather } from '../engine/types';
import { artwork } from '../engine/artwork';
import { nextSantaCheck, santaSkyAsset, santaVisit, SANTA_SPRITE, SANTA_VISIT_MS, splashScale } from '../engine/visitors';
import { ObserveButterfly, paintedVisitorButton } from './ButterflyVisitors';
import { paintedPixelAt } from './butterflyFlight';
import { LakeSoundControls, PlayWaterSound } from '../audio/sounds';
import GooseVisitors from './GooseVisitors';

export type WildlifePreview={santa?:number;odonates?:number;controlledDragonfly?:number;geese?:number;splashes?:number;treeBirds?:number;treeFlock?:number};
export function LanternInsects(){
  return <span className="f-lantern-insects" data-layer="lantern-insects" aria-hidden="true">{Array.from({length:7},(_,i)=><span key={i} className="f-lantern-orbit" style={{'--insect-radius':`${13+i*3}px`,'--insect-tilt':`${i*47}deg`,animationDuration:`${1.9+i*.43}s`,animationDelay:`-${i*.37}s`} as CSSProperties}><i style={{animationDelay:`-${i*.17}s`}}/></span>)}</span>;
}

/** A single wall-clock flight, with a long sleeping timer for the rest of the year.
 * Preview changes only the current developer visit, never the real-day schedule. */
export function SantaVisitor({sceneRef,period,years=[],preview=0,onObserve,reducedMotion,intervalMs=0}:{sceneRef:RefObject<HTMLDivElement>;period:DayPeriod;years?:readonly number[];preview?:number;onObserve?:ObserveButterfly;reducedMotion:boolean;intervalMs?:number}){
  const [active,setActive]=useState(false),button=useRef<HTMLButtonElement>(null),canvas=useRef<HTMLCanvasElement>(null);
  const observe=useRef(onObserve);observe.current=onObserve;
  const collected=useRef(new Set<string>()),visitKey=useRef(''),lastPreview=useRef(0);
  const yearKey=years.join(',');
  useEffect(()=>{
    if(period!=='late-night'){setActive(false);return;}
    const scene=sceneRef.current;if(!scene)return;
    let timer:ReturnType<typeof setTimeout>|undefined,frame:number|undefined,image:HTMLImageElement|undefined,painted:HTMLCanvasElement|undefined,visible=true,disposed=false,previewAt:number|undefined;
    if(preview!==lastPreview.current){lastPreview.current=preview;if(preview)previewAt=Date.now()-SANTA_VISIT_MS*.40;}
    const draw=()=>{
      if(!image?.complete||!image.naturalWidth||!canvas.current||painted===canvas.current)return;
      const context=canvas.current.getContext('2d',{willReadFrequently:true});if(!context)return;
      const height=SANTA_SPRITE.width*image.naturalHeight/image.naturalWidth;
      context.clearRect(0,0,SANTA_SPRITE.width,SANTA_SPRITE.height);context.drawImage(image,0,(SANTA_SPRITE.height-height)/2,SANTA_SPRITE.width,height);
      // Match the silhouette's alpha exactly when picking, with no lit detail.
      context.globalCompositeOperation='source-in';context.fillStyle='#080c10';context.fillRect(0,0,SANTA_SPRITE.width,SANTA_SPRITE.height);context.globalCompositeOperation='source-over';
      painted=canvas.current;if(button.current)button.current.dataset.painted='true';
    };
    const tick=()=>{
      if(disposed||document.hidden||!visible)return;
      const now=Date.now(),visit=previewAt!==undefined&&now-previewAt<SANTA_VISIT_MS?{progress:(now-previewAt)/SANTA_VISIT_MS}:santaVisit(now,years);
      visitKey.current=previewAt===undefined?`christmas-${new Date(now).getFullYear()}`:`preview-${preview}`;
      if(visit&&!collected.current.has(visitKey.current)){
        setActive(true);
        if(!image){image=new Image();image.onload=()=>{if(!disposed)draw();};image.src=santaSkyAsset();}
        const progress=reducedMotion?.5:visit.progress;
        scene.style.setProperty('--santa-x',`${-32+progress*164}%`);scene.style.setProperty('--santa-y',`${16-Math.sin(progress*Math.PI)*6}%`);draw();
        if(intervalMs||reducedMotion)timer=setTimeout(tick,intervalMs||1000);else frame=requestAnimationFrame(tick);
      }else {setActive(false);image=undefined;timer=setTimeout(tick,nextSantaCheck(now));}
    };
    const visibility=()=>{clearTimeout(timer);if(frame!==undefined)cancelAnimationFrame(frame);frame=undefined;tick();};
    const observer=typeof IntersectionObserver==='undefined'?undefined:new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;visibility();});observer?.observe(scene);
    document.addEventListener('visibilitychange',visibility);tick();
    return ()=>{disposed=true;clearTimeout(timer);if(frame!==undefined)cancelAnimationFrame(frame);if(image)image.onload=null;observer?.disconnect();document.removeEventListener('visibilitychange',visibility);};
    // The calendar schedule changes only when an annual sighting is collected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[sceneRef,period,yearKey,preview,reducedMotion,intervalMs]);
  return active?<button ref={button} style={{left:'var(--santa-x)',top:'var(--santa-y)'}} className="f-santa-visit" type="button" aria-label="Observe Santa Claus" data-layer="santa" disabled={!onObserve} onClick={event=>{
    const keyboard=event.detail===0&&event.clientX===0&&event.clientY===0;
    if(!keyboard&&sceneRef.current){const top=paintedVisitorButton(sceneRef.current,event.clientX,event.clientY);if(!top)return;if(top!==event.currentTarget){top.click();return;}}
    if(!canvas.current||(!keyboard&&!paintedPixelAt(canvas.current,event.clientX,event.clientY)))return;
    collected.current.add(visitKey.current);observe.current?.(event.currentTarget,'santa',0);setActive(false);
  }}><canvas ref={canvas} width={SANTA_SPRITE.width} height={SANTA_SPRITE.height}/></button>:null;
}

type Splash={id:number;x:number;y:number;scale:number;expires:number};
export function LakeWildlife({sceneRef,season,weather,reducedMotion,preview={},intervalMs=0,onSplash,frame,location,audio}:{sceneRef:RefObject<HTMLDivElement>;season:Season;weather:Weather;reducedMotion:boolean;preview?:WildlifePreview;intervalMs?:number;onSplash?:PlayWaterSound;frame?:{width:number;height:number};location?:string;audio?:LakeSoundControls}){
  const [splashes,setSplashes]=useState<Splash[]>([]);
  const splashSound=useRef(onSplash);splashSound.current=onSplash;
  const previewAction=useRef<(()=>void)|undefined>(undefined),last=useRef<WildlifePreview>({});
  const pendingPreviews=useRef(false);
  useEffect(()=>{
    const scene=sceneRef.current;if(!scene||reducedMotion)return;
    let timer:ReturnType<typeof setTimeout>|undefined,visible=true,sequence=0;
    let rings:Splash[]=[];
    let nextSplash=Date.now()+8000+Math.random()*12000;
    const storm=['hurricane','blizzard','thunderstorm'].includes(weather);
    const spawn=()=>{
      const now=Date.now();
        const bounds=scene.getBoundingClientRect(),background=scene.querySelector<HTMLElement>('[data-layer="lake-background"], [data-layer="cove-landscape"], [data-layer="birch-treeline-water"]')?.getBoundingClientRect();
        if(!bounds.height||!background)return;
        const waterline=scene.classList.contains('f-spot-cove')?.555:.5;
        const horizon=Math.max(.1,Math.min(.85,(background.top-bounds.top+background.height*waterline)/bounds.height));
        const depth=.08+Math.random()*.77;
        const splash={id:++sequence,x:10+Math.random()*80,y:(horizon+(1-horizon)*depth)*100,scale:splashScale(depth),expires:now+1700};
        rings=[...rings.filter(r=>r.expires>now),splash].slice(-3);setSplashes(rings);
        splashSound.current?.('lake',{depth:1-depth,pan:splash.x/50-1,weightKg:splash.scale*2.2});
    };
    const schedule=()=>{
      clearTimeout(timer);if(document.hidden||!visible)return;
      const now=Date.now();
      rings=rings.filter(r=>r.expires>now);setSplashes(current=>current.length===rings.length?current:rings);
      if(now>=nextSplash){if(!storm)spawn();nextSplash=now+10000+Math.random()*22000;}
      const deadlines=[nextSplash,...rings.map(r=>r.expires)];
      timer=setTimeout(schedule,Math.max(40,Math.min(...deadlines)-now));
    };
    previewAction.current=()=>{if(document.hidden||!visible)pendingPreviews.current=true;else{spawn();schedule();}};
    const visibility=()=>{
      clearTimeout(timer);rings=[];setSplashes([]);nextSplash=Date.now()+8000;
      if(!document.hidden&&visible&&pendingPreviews.current){spawn();pendingPreviews.current=false;}
      schedule();
    };
    const observer=typeof IntersectionObserver==='undefined'?undefined:new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;visibility();});observer?.observe(scene);
    document.addEventListener('visibilitychange',visibility);schedule();
    return ()=>{clearTimeout(timer);observer?.disconnect();document.removeEventListener('visibilitychange',visibility);previewAction.current=undefined;};
  },[sceneRef,season,weather,reducedMotion]);
  useEffect(()=>{if(preview.splashes!==last.current.splashes&&preview.splashes)previewAction.current?.();last.current=preview;},[preview]);
  if(reducedMotion)return null;
  return <><div className="f-lake-splashes" aria-hidden="true" data-layer="fish-splashes">{splashes.map(splash=><span key={splash.id} className="f-lake-splash" data-depth-scale={splash.scale} style={{left:`${splash.x}%`,top:`${splash.y}%`,width:`${150*splash.scale}px`,backgroundImage:`url("${artwork('visitors/fish-splash-sheet.webp')}")`}}/>)}</div>
    <GooseVisitors sceneRef={sceneRef} season={season} weather={weather} reducedMotion={reducedMotion} preview={preview.geese} intervalMs={intervalMs} frame={frame} location={location} audio={audio}/></>;
}
