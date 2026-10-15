import React from 'react';
import { FishSpecies, MeasurementSystem } from '../engine/types';
import { fishDisplaySize, lengthUnit, lengthValue } from '../engine/specimens';
import bounds from '../scene/fish-art-bounds';

export interface Specimen { species:FishSpecies; lengthCm:number; weightKg:number; isAlbino:boolean }
export default function FishArtwork({fish,ruler=false,units='imperial',label='Your catch'}:{fish:Specimen;ruler?:boolean;units?:MeasurementSystem;label?:string}) {
  const crop=(bounds as Record<string,number[]>)[`${fish.species.id}${fish.isAlbino?'-albino':''}`]??[0,0,1774,887];
  const [left,top,right,bottom]=crop, size=fishDisplaySize(fish.species,fish.lengthCm,fish.weightKg);
  const width=560*size.width;
  const height=Math.min(190,350*(bottom-top)/(right-left))*size.thickness;
  const length=lengthValue(fish.lengthCm,units), pixelsPerUnit=width/length;
  const major=units==='imperial'?(pixelsPerUnit<25?5:1):(pixelsPerUnit<8?10:5);
  const minor=units==='imperial'?(pixelsPerUnit<12?1:.25):1, count=Math.floor(560/pixelsPerUnit/minor);
  return <svg className={`f-specimen-art ${ruler?'f-specimen-ruler':''}`} viewBox={`0 0 600 ${ruler?300:230}`} role="img" aria-label={ruler?`${label} beside a ruler in ${units==='imperial'?'inches':'centimeters'}`:label} data-fish-width={size.width.toFixed(4)} data-fish-thickness={size.thickness.toFixed(4)}>
    {ruler&&<><path d="M20 28v201" stroke="#e1c893" strokeWidth="3"/><path d={`M${20+width} 204v25`} stroke="#e1c893" strokeDasharray="3 4"/></>}
    <svg x="20" y={218-height} width={width} height={height} viewBox={`${left} ${top} ${right-left} ${bottom-top}`} preserveAspectRatio="none">
      <image href={fish.isAlbino?fish.species.albinoArtwork:fish.species.artwork} width="1774" height="887"/>
    </svg>
    {ruler&&<><rect x="16" y="233" width="574" height="54" rx="3" fill="#d8bb7d"/><path d="M20 235h560" stroke="#644d29"/>
      {Array.from({length:Math.min(240,count)+1},(_,i)=>{const value=i*minor,x=20+value*pixelsPerUnit,isMajor=value%major===0,isMiddle=units==='imperial'?value%1===0:value%5===0;return <g key={i} data-ruler-tick={value}><path d={`M${x} 235v${isMajor?22:isMiddle?15:9}`} stroke="#59452b" strokeWidth={isMajor?1.4:.8}/>{isMajor&&<text x={x+(i?0:2)} y="278" textAnchor={i?'middle':'start'} fill="#59452b" fontSize="15" fontFamily="Georgia,serif">{value}</text>}</g>;})}
      <text x="580" y="228" textAnchor="end" fill="#e1c893" fontSize="14">{lengthUnit(units)}</text>
    </>}
  </svg>;
}
