import React, { CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react';

type Anchor = { x: number; y: number; width: number };
type LeafPhase = 'queued' | 'arriving' | 'caught' | 'leaving';
const randomBetween=(min: number,max: number)=>min+Math.random()*(max-min);

function GroundLeaf({ index, anchor, active, strength }: { index: number; anchor: Anchor; active: boolean; strength: number }) {
  const [phase,setPhase]=useState<LeafPhase>('queued');
  const wind=useRef(strength); wind.current=strength;
  const flight=useRef({phase,strength});
  if (flight.current.phase!==phase) flight.current={phase,strength};
  useEffect(()=>{
    if (!active || (phase !== 'queued' && phase !== 'caught')) return;
    const wait=phase==='caught' ? randomBetween(900,5200)/(1+wind.current) : randomBetween(300,7000)/(1+wind.current);
    const timer=window.setTimeout(()=>setPhase(phase==='queued' ? 'arriving' : 'leaving'),wait);
    return ()=>window.clearTimeout(timer);
  },[phase,active]);
  const startX=-anchor.width*(anchor.x>.7 ? .16 : anchor.x+.06);
  const endX=anchor.width*(anchor.x>.7 ? .18 : .25);
  return <div className="f-ground-leaf" data-leaf-phase={phase} style={{ left:`calc(${anchor.x*100}% + ${index%4*7-10}px)`,top:`calc(${anchor.y*100}% + ${index%3*3-3}px)` }}>
    <i className={`f-ground-leaf-particle f-ground-leaf-${phase}`} style={{
      '--leaf-start-x':`${startX}px`,'--leaf-start-y':`${-18-index%4*9}px`,'--leaf-end-x':`${endX}px`,
      '--leaf-turn':`${35+index*67}deg`,'--leaf-flight-time':`${(3.6+index%3*.4)/(1+flight.current.strength)}s`,
      animationPlayState:active ? 'running' : 'paused',
    } as CSSProperties} onAnimationEnd={event=>{
      if (event.target!==event.currentTarget) return;
      if (phase==='arriving') setPhase('caught'); else if (phase==='leaving') setPhase('queued');
    }} />
  </div>;
}

/** Gust wisps and shoreline litter, with a pause at measured dock/ground anchors. */
export default function WindSystem({ strength, location, reducedMotion = false }: { strength: number; location: string; reducedMotion?: boolean }) {
  const root=useRef<HTMLDivElement>(null);
  const [visible,setVisible]=useState(!document.hidden);
  const [anchors,setAnchors]=useState<Anchor[]>([{x:.12,y:.91,width:1200},{x:.27,y:.90,width:1200},{x:.90,y:.92,width:1200}]);
  useLayoutEffect(()=>{
    const scene=root.current?.closest('.f-scene'); if (!scene) return;
    const measure=()=>{
      const box=scene.getBoundingClientRect(); if (!box.width || !box.height) return;
      const dock=scene.querySelector('[data-layer="dock"]')?.getBoundingClientRect();
      setAnchors([{x:.12,y:.91,width:box.width},
        {x:dock ? (dock.left-box.left+dock.width*.8)/box.width : .25,y:dock ? (dock.top-box.top+dock.height*.62)/box.height : .91,width:box.width},
        {x:.90,y:.92,width:box.width}]);
    };
    measure(); const observer=typeof ResizeObserver!=='undefined' ? new ResizeObserver(measure) : undefined;
    observer?.observe(scene); return ()=>observer?.disconnect();
  },[location]);
  useEffect(()=>{
    let onScreen=true;
    const update=()=>setVisible(!document.hidden&&onScreen);
    const observer=typeof IntersectionObserver!=='undefined' ? new IntersectionObserver(entries=>{onScreen=entries[0]?.isIntersecting??true;update();}) : undefined;
    if (root.current) observer?.observe(root.current);
    document.addEventListener('visibilitychange',update); update();
    return ()=>{observer?.disconnect();document.removeEventListener('visibilitychange',update);};
  },[]);
  const active=visible&&!reducedMotion&&strength>0;
  return <div ref={root} className={`f-wind-system ${active ? 'f-wind-active' : 'f-wind-paused'}`} data-testid="weather-wind" data-wind-strength={strength.toFixed(3)} style={{'--gust-strength':strength,opacity:Math.min(1,strength/.45)} as CSSProperties} aria-hidden="true">
    <svg className="f-wind-wisps" viewBox="0 0 1200 700" preserveAspectRatio="none">
      {[0,1,2,3].map(i=><g key={i} style={{animationDelay:`${-i*2.7}s`}}><path d={`M-260 ${330+i*68} Q-130 ${300+i*68} 20 ${332+i*68} T270 ${330+i*68} q80 -22 55 -40 q-28 -16 -35 10 q-4 35 150 20`} /><path d={`M-210 ${350+i*68} Q-50 ${325+i*68} 155 ${350+i*68}`} /></g>)}
    </svg>
    {!reducedMotion && Array.from({length:strength>.8 ? 12 : 8},(_,i)=><GroundLeaf key={i} index={i} anchor={anchors[i%anchors.length]} active={active} strength={strength} />)}
  </div>;
}
