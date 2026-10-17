import React,{CSSProperties,memo,RefObject,useEffect,useState} from 'react';
import { ASSET_BASE } from '../engine/artwork';
import { Season } from '../engine/types';
import { foliageArt,foliageStations } from './foliage';

interface StationLayout {id:string;left:number;top:number;width:number;height:number;px:number;py:number;image:string}
/** Small cutouts follow the real bank geometry, with no extra animation loop.
 * Offscreen patches and inactive seasonal textures have no image elements. */
export default memo(function SeasonalFoliage({sceneRef,location,season}:{sceneRef:RefObject<HTMLDivElement>;location:string;season:Season}){
  const [layout,setLayout]=useState<StationLayout[]>([]);
  useEffect(()=>{
    const scene=sceneRef.current;
    if(!scene||season==='winter'){setLayout([]);return;}
    const art=foliageArt(location,season);
    const measure=()=>{
      const sw=scene.clientWidth,sh=scene.clientHeight;
      const stations=foliageStations(location).flatMap((station,index)=>{
        if(!art[index])return [];
        const bank=scene.querySelector<HTMLElement>(`[data-layer="${station.layer}"]`);
        if(!bank||getComputedStyle(bank).display==='none')return [];
        let x=0,y=0,px=0,py=0;
        for(let node:HTMLElement|null=bank;node&&node!==scene;node=node.offsetParent as HTMLElement|null){
          x+=node.offsetLeft;y+=node.offsetTop;
          const p=Number(node.style.getPropertyValue('--parallax'))||0;
          px+=p+(Number(node.style.getPropertyValue('--ground-parallax'))||0);py+=p;
        }
        const flipped=bank.style.getPropertyValue('--flip-x')==='-1';
        const width=bank.offsetWidth*station.width,height=width*144/128;
        const left=x+bank.offsetWidth*(flipped?1-station.x:station.x)-width*.5;
        const top=y+bank.offsetHeight*station.y-height*.90;
        if(left+width<0||left>sw||top+height<0||top>sh)return [];
        return [{id:station.id,left,top,width,height,px,py,image:art[index].image}];
      });
      setLayout(previous=>JSON.stringify(previous)===JSON.stringify(stations)?previous:stations);
    };
    const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(measure);
    observer?.observe(scene);
    const banks=Array.from(new Set(foliageStations(location).map(station=>scene.querySelector<HTMLElement>(`[data-layer="${station.layer}"]`)))).filter((bank):bank is HTMLElement=>!!bank);
    banks.forEach(bank=>observer?.observe(bank));
    const loaded=(event:Event)=>{if(!(event.target as HTMLElement)?.dataset.foliageStation)measure();};
    scene.addEventListener('load',loaded,true);window.addEventListener('resize',measure);measure();
    return ()=>{observer?.disconnect();scene.removeEventListener('load',loaded,true);window.removeEventListener('resize',measure);};
  },[sceneRef,location,season]);
  if(season==='winter')return null;
  return <div className="f-seasonal-foliage" data-layer="seasonal-foliage" data-foliage-season={season} aria-hidden="true">
    {layout.map(station=><img key={station.id} src={`${ASSET_BASE}/${station.image}`} alt="" draggable={false} data-layer={station.id} data-foliage-station={station.id} data-scene-depth="foreground" className="f-flower-cluster" style={{left:station.left,top:station.top,width:station.width,height:station.height,'--flower-parallax-x':station.px,'--flower-parallax-y':station.py} as CSSProperties}/>)}
  </div>;
});
