import React,{CSSProperties,memo,RefObject,useEffect,useLayoutEffect,useState} from 'react';
import {GrowingPlant,PlantSnapshot} from '../engine/plantLifecycle';
import {plantSpecies} from '../engine/plantSpecies';
import {depthAtWaterline,foregroundClearance,foregroundDepth,sceneDepthFrame} from './sceneDepth';
import {GARDEN_READY_EVENT} from './gardenEvents';
import {plantBoxAspect,plantDepthScale,plantSprites} from './plantVisuals';
import PlantSprite from './PlantSprite';

interface Station {plant:GrowingPlant;left:number;top:number;width:number;height:number;px:number;py:number;z:number}
/** Fixed spring roots. Growth is resolved in a cached snapshot, never here. */
export default memo(function SeasonalFoliage({sceneRef,snapshot}:{sceneRef:RefObject<HTMLDivElement>;snapshot:PlantSnapshot}){
  const [measured,setMeasured]=useState<{key:string;stations:Station[]}>({key:'',stations:[]});
  useEffect(()=>{
    const scene=sceneRef.current;if(!scene)return;
    const plants=snapshot.plants.filter(plant=>plant.visible&&plant.kind==='flower');
    const measure=()=>{
      const sw=scene.clientWidth,sh=scene.clientHeight,bounds=scene.getBoundingClientRect(),camera=sceneDepthFrame(scene,snapshot.location,bounds),horizon=camera.horizon;
      const stations=plants.flatMap(plant=>{
        const bank=scene.querySelector<HTMLElement>(`[data-layer="${plant.layer}"]`);if(!bank||getComputedStyle(bank).display==='none')return [];
        let x=0,y=0,px=0,py=0;
        for(let node:HTMLElement|null=bank;node&&node!==scene;node=node.offsetParent as HTMLElement|null){
          x+=node.offsetLeft;y+=node.offsetTop;const p=Number(node.style.getPropertyValue('--parallax'))||0;
          px+=p+(Number(node.style.getPropertyValue('--ground-parallax'))||0);py+=p;
        }
        const flipped=bank.style.getPropertyValue('--flip-x')==='-1';
        const rootX=x+bank.offsetWidth*(flipped?1-plant.x:plant.x),rootY=y+bank.offsetHeight*plant.y;
        const visualDepth=depthAtWaterline(rootY/Math.max(1,sh),horizon,camera);
        const z=Math.min(foregroundDepth(camera)-foregroundClearance(camera),visualDepth);
        const size=snapshot.location==='dock'?(plant.layer==='right-grassy-bank'?.13:.075):.034;
        const height=bank.offsetWidth*size*plant.scale*plantSpecies(plant.speciesId).height*plantDepthScale(visualDepth,camera),width=height*plantBoxAspect(plant);
        const left=rootX-width*.5,top=rootY-height*.96;
        if(left+width*1.3<0||left-width*.3>sw||top+height<0||top-height*.3>sh)return [];
        return [{plant,left,top,width,height,px,py,z}];
      });
      setMeasured(previous=>previous.key===snapshot.key&&JSON.stringify(previous.stations)===JSON.stringify(stations)?previous:{key:snapshot.key,stations});
    };
    const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(measure);observer?.observe(scene);
    Array.from(new Set(plants.map(plant=>scene.querySelector<HTMLElement>(`[data-layer="${plant.layer}"]`)))).forEach(bank=>{if(bank)observer?.observe(bank);});
    const loaded=(event:Event)=>{if(!(event.target as HTMLElement)?.dataset.lifeArt)measure();};
    scene.addEventListener('load',loaded,true);window.addEventListener('resize',measure);measure();
    return ()=>{observer?.disconnect();scene.removeEventListener('load',loaded,true);window.removeEventListener('resize',measure);};
  },[sceneRef,snapshot]);
  useLayoutEffect(()=>{sceneRef.current?.dispatchEvent(new Event(GARDEN_READY_EVENT));},[sceneRef,measured]);
  // Daily growth changes the stalks, not their rooted layout. Retain matching
  // nodes while measuring the new snapshot so loaded foliage never blanks out.
  const currentPlants=new Map(snapshot.plants.filter(plant=>plant.visible).map(plant=>[plant.id,plant]));
  const stations=measured.stations.flatMap(station=>{
    const plant=currentPlants.get(station.plant.id);return plant?[{...station,plant}]:[];
  });
  return <div className="f-seasonal-foliage" data-layer="seasonal-foliage" data-garden-key={snapshot.key} aria-hidden="true">
    {stations.map(({plant,left,top,width,height,px,py,z})=><div key={plant.id} className="f-flower-plant f-life-base" data-life-base={plant.id}
      data-plant-species={plant.speciesId} data-plant-kind="flower" data-plant-maturity={plant.maturity} data-active-stems={plant.stems.length} data-plant-depth={z.toFixed(3)}
      style={{left,top,width,height,'--flower-parallax-x':px,'--flower-parallax-y':py} as CSSProperties}>
      {plantSprites(plant,snapshot).map(sprite=><PlantSprite key={`${sprite.id}:${sprite.art.image}`} sprite={sprite}/>)}</div>)}
  </div>;
});
