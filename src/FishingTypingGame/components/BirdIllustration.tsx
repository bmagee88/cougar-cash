import React from 'react';
import { BirdPose, birdById, birdSheet, TREE_BIRD_DIRECTIONS, TreeBirdSpeciesId } from '../engine/birds';

export default function BirdIllustration({speciesId,pose={direction:'front',frame:8},label}:{speciesId:TreeBirdSpeciesId;pose?:BirdPose;label?:string}) {
  return <div className="f-bird-portrait" role="img" aria-label={label??birdById(speciesId)?.name}
    data-bird-direction={pose.direction} data-bird-frame={pose.frame}
    style={{backgroundImage:`url("${birdSheet(speciesId)}")`,backgroundSize:'1200% 600%',backgroundPosition:`${pose.frame/11*100}% ${TREE_BIRD_DIRECTIONS.indexOf(pose.direction)*20}%`}}/>;
}
