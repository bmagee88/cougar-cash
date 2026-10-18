import React from 'react';
import { MeasurementSystem, NotebookImage } from '../engine/types';
import { SPECIES } from '../engine/config';
import { artwork } from '../engine/artwork';
import FishArtwork from './FishArtwork';
import { butterflyAsset, butterflyById, butterflyPoseAsset } from '../engine/butterflies';
import { santaAsset, visitorAsset } from '../engine/visitors';

export default function NotebookIllustration({image,units}:{image:NotebookImage;units:MeasurementSystem}) {
  if(image.kind==='visitor')return <div className={`f-notebook-image f-notebook-butterfly ${image.speciesId==='santa'?'f-notebook-special':''}`}><img src={image.speciesId==='santa'?santaAsset():visitorAsset(image.speciesId,image.pose?.frame,image.pose?.view)} style={image.pose?{transform:`rotate(${image.pose.rotation}rad) scaleX(${image.pose.flipped?-1:1})`}:undefined} data-wing-frame={image.pose?.frame} data-wing-view={image.pose?.view} alt="The visitor you observed"/></div>;
  if(image.kind==='butterfly')return <div className="f-notebook-image f-notebook-butterfly"><img src={butterflyById(image.speciesId)?image.pose?butterflyPoseAsset(image.speciesId!,image.pose.frame,image.pose.view):butterflyAsset(image.speciesId!,'adult'):artwork('effects/butterfly-perched.png')} style={image.pose?{transform:`rotate(${image.pose.rotation}rad) scaleX(${image.pose.flipped?-1:1})`}:undefined} data-wing-frame={image.pose?.frame} data-wing-view={image.pose?.view} alt="The butterfly you observed"/></div>;
  const species=SPECIES.find(s=>s.id===image.speciesId);
  return species?<div className="f-notebook-image"><FishArtwork fish={{...image,species}} ruler units={units}/></div>:null;
}
