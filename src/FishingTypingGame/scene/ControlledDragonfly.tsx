import React,{RefObject,useEffect,useRef,useState} from 'react';
import {createFlight,flightBottom,flightMovementScale} from './butterflyFlight';
import {stepDragonflyView} from './dragonflyView';
import {loadVisitorSprite,paintVisitor,RenderedVisitor,Visitor} from './ButterflyVisitors';
import {advanceSceneDepth,changeSceneDepth,DepthObstruction,foregroundDepth,reframeSceneDepth,sceneDepthFrame,SCENE_DEPTH} from './sceneDepth';
import {foregroundCollision} from './foregroundCollision';
import {GARDEN_READY_EVENT} from './gardenEvents';

const CONTROL_KEYS=new Set(['arrowleft','arrowright','arrowup','arrowdown','r','f']);
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

/** The manual visitor uses the same sprite renderer and direction selector as
 * wild dragonflies, but no autonomous travel, perching, or journal rewards. */
export function stepControlledDragonfly(visitor:Visitor,keys:ReadonlySet<string>,dt:number,width:number,height:number,horizon=.5,obstructed?:DepthObstruction) {
  const flight=visitor.flight;
  let x=Number(keys.has('arrowright'))-Number(keys.has('arrowleft'));
  let y=Number(keys.has('arrowdown'))-Number(keys.has('arrowup'));
  const length=Math.hypot(x,y);if(length>1){x/=length;y/=length;}
  const beforeZ=flight.z;
  changeSceneDepth(flight,Math.min(.98,advanceSceneDepth(flight.z,(Number(keys.has('r'))-Number(keys.has('f')))*.22*(keys.has('shift')?.01:1),dt,flight.perspective)),horizon,obstructed,flight.perspective);
  // Two scene spans per second at z=0, independent of viewport resolution.
  const speed=2*flightMovementScale(flight.z,flight.perspective);
  flight.vz=dt?(flight.z-beforeZ)/dt:0;
  flight.vx=flight.motionVx=x*speed*Math.max(1,width);flight.vy=flight.motionVy=y*speed*Math.max(1,height);
  flight.x=clamp(flight.x+flight.vx*dt/Math.max(1,width),.07,.93);
  flight.y=clamp(flight.y+flight.vy*dt/Math.max(1,height),.08,flightBottom(flight.z,horizon,flight.perspective));
  flight.age+=dt;flight.wingFrame=Math.floor(flight.age/.03)%8;
  flight.heading=y*.18;flight.mode='flap';
  flight.behindForeground=flight.z>=foregroundDepth(flight.perspective);
  // A deliberate key press can select its view immediately; wild flights use
  // the selector's debounce to suppress vector jitter. Idle holds the last view.
  visitor.direction=!x&&!y&&flight.vz?{view:flight.vz>0?'back':'front'}:
    stepDragonflyView(flight.vx||flight.vy||flight.vz?undefined:visitor.direction,flight,dt);
}

export default function ControlledDragonfly({sceneRef,spawn,reducedMotion=false,location='dock'}:{sceneRef:RefObject<HTMLDivElement>;spawn:number;reducedMotion?:boolean;location?:string}) {
  const [active,setActive]=useState(false),[failed,setFailed]=useState(false);
  const buttonRef=useRef<HTMLButtonElement>(null),readout=useRef<HTMLOutputElement>(null);
  useEffect(()=>{if(spawn){setFailed(false);setActive(true);}},[spawn]);
  useEffect(()=>{
    const scene=sceneRef.current,button=buttonRef.current;
    if(!active||!scene||!button)return;
    scene.scrollIntoView?.({block:'center',behavior:reducedMotion?'auto':'smooth'});
    const obstacles=foregroundCollision(scene);
    let camera=sceneDepthFrame(scene,location,scene.getBoundingClientRect()),horizon=camera.horizon;
    obstacles.measure(scene.getBoundingClientRect());
    const arrival=Math.min(SCENE_DEPTH.arrival,foregroundDepth(camera)*.65);
    const visitor:Visitor={id:-1,speciesId:'green-darner',wingspanMm:90,size:20,
      flight:{...createFlight(()=>.5),perspective:camera,x:.55,y:horizon+(flightBottom(arrival,horizon,camera)-horizon)*.75,z:arrival,age:0,vx:0,vy:0,vz:0,heading:0,perch:undefined,behindForeground:false,departAt:Infinity}};
    const target:RenderedVisitor={button,canvas:button.querySelector('canvas')!};
    let disposed=false,frame:number|undefined,previous:number|undefined;
    let width=scene.clientWidth,height=scene.clientHeight;
    const keys=new Set<string>();
    const paint=()=>{
      paintVisitor(visitor,target);
      const groundY=flightBottom(visitor.flight.z,horizon,camera).toFixed(4),anglerGroundY=camera.feet?.y.toFixed(4)??'';
      if(button.dataset.groundY!==groundY)button.dataset.groundY=groundY;
      if(button.dataset.anglerGroundY!==anglerGroundY)button.dataset.anglerGroundY=anglerGroundY;
      const anglerDepth=foregroundDepth(camera).toFixed(4);if(button.dataset.anglerDepth!==anglerDepth)button.dataset.anglerDepth=anglerDepth;
      const status=`X ${visitor.flight.x.toFixed(2)} · Y ${visitor.flight.y.toFixed(2)} · Z ${visitor.flight.z.toFixed(4)} · ${visitor.direction?.view??'right'} · Angler Z ${foregroundDepth(camera).toFixed(4)}`;
      if(readout.current&&readout.current.textContent!==status)readout.current.textContent=status;
    };
    (['front','back',undefined] as const).forEach(view=>{
      void loadVisitorSprite('green-darner',view).then(sprite=>{
        if(disposed)return;
        if(view==='front')target.frontSprite=sprite;else if(view==='back')target.backSprite=sprite;else target.sprite=sprite;
        paint();
      }).catch(()=>{if(!disposed&&view===undefined)setFailed(true);});
    });
    const animate=(now:number)=>{
      const dt=previous===undefined?0:Math.min(.05,(now-previous)/1000);previous=now;
      stepControlledDragonfly(visitor,keys,dt,width,height,horizon,obstacles.hit);
      if(reducedMotion)visitor.flight.wingFrame=0;
      paint();frame=requestAnimationFrame(animate);
    };
    const clear=()=>keys.clear();
    const editable=(event:KeyboardEvent)=>event.target instanceof Element&&!!event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="combobox"],[role="textbox"]');
    const keydown=(event:KeyboardEvent)=>{
      const key=event.key.toLowerCase();
      if(editable(event)||event.ctrlKey||event.metaKey||event.altKey){clear();return;}
      if(key!=='escape'&&!CONTROL_KEYS.has(key))return;
      event.preventDefault();event.stopImmediatePropagation();
      if(key==='r'||key==='f'){if(event.shiftKey)keys.add('shift');else keys.delete('shift');}
      if(key==='escape'){clear();setActive(false);}else keys.add(key);
    };
    const keyup=(event:KeyboardEvent)=>{keys.delete(event.key.toLowerCase());};
    const visibility=()=>{
      clear();if(frame!==undefined)cancelAnimationFrame(frame);frame=undefined;previous=undefined;
      if(!document.hidden)frame=requestAnimationFrame(animate);
    };
    const measure=()=>{
      width=scene.clientWidth;height=scene.clientHeight;const bounds=scene.getBoundingClientRect(),next=sceneDepthFrame(scene,location,bounds);
      reframeSceneDepth(visitor.flight,camera,next);camera=next;horizon=camera.horizon;visitor.flight.perspective=camera;
      visitor.flight.y=Math.min(visitor.flight.y,flightBottom(visitor.flight.z,horizon,camera));obstacles.measure(bounds);paint();
    };
    const resize=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(measure);resize?.observe(scene);
    scene.addEventListener('load',measure,true);scene.addEventListener(GARDEN_READY_EVENT,measure);window.addEventListener('resize',measure);
    document.addEventListener('keydown',keydown,true);document.addEventListener('keyup',keyup,true);
    document.addEventListener('visibilitychange',visibility);window.addEventListener('blur',clear);
    if(!document.hidden)frame=requestAnimationFrame(animate);
    return ()=>{
      disposed=true;clear();if(frame!==undefined)cancelAnimationFrame(frame);resize?.disconnect();
      scene.removeEventListener('load',measure,true);scene.removeEventListener(GARDEN_READY_EVENT,measure);window.removeEventListener('resize',measure);
      document.removeEventListener('keydown',keydown,true);document.removeEventListener('keyup',keyup,true);
      document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',clear);
    };
  },[active,spawn,sceneRef,reducedMotion,location]);
  if(!active)return null;
  return <div className="f-controlled-dragonfly" data-layer="controlled-dragonfly">
    <button ref={buttonRef} type="button" tabIndex={-1} className="f-butterfly-visit f-controlled-dragonfly-sprite" aria-label="Controlled dragonfly" aria-describedby="f-dragonfly-controls"><canvas width="160" height="160"/></button>
    <div className="f-dragonfly-controls" id="f-dragonfly-controls">
      <span>{failed?'Dragonfly artwork could not load. Try spawning again.':'Arrows: steer · R/F: depth · Shift+R/F: fine depth · Esc: remove'}</span>
      <output ref={readout} aria-label="Controlled dragonfly depth" aria-live="off"/>
      <button type="button" onClick={()=>setActive(false)}>Remove dragonfly</button>
    </div>
  </div>;
}
