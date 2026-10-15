import React from 'react';
import { BUTTERFLIES, butterflyAsset, caterpillarAnimation } from '../engine/butterflies';

export default function ButterflyGuide({discovered=[]}:{discovered?:readonly string[]}) {
  return <section aria-label="Butterfly and moth field guide"><p className="f-guide-intro">Tap a butterfly or moth at the lake to reveal its three life stages. Butterflies and hummingbird clearwings visit by day; luna moths and the other night moths arrive after dark.</p>
    <div className="f-butterfly-guide-grid">{BUTTERFLIES.map(species=>{
      const found=discovered.includes(species.id);
      const stages=[{id:'caterpillar' as const,label:'Caterpillar',description:species.caterpillar},{id:'pupa' as const,label:species.pupaLabel,description:species.pupa},{id:'adult' as const,label:species.kind==='moth'?'Moth':'Butterfly',description:species.description}];
      return <article key={species.id} className={`f-butterfly-guide-card ${found?'f-butterfly-discovered':'f-butterfly-unknown'}`} aria-label={found?species.name:'Undiscovered butterfly or moth'}>
        <header><h3>{found?species.name:'Undiscovered'}</h3><small>{found?species.scientificName:'A visitor waiting to be found'}</small></header>
        <div className="f-life-cycle">{stages.map(stage=><figure key={stage.id}><picture>{found&&stage.id==='caterpillar'&&<source media="(prefers-reduced-motion: reduce)" srcSet={butterflyAsset(species.id,stage.id)}/>}<img src={found&&stage.id==='caterpillar'?caterpillarAnimation(species.id):butterflyAsset(species.id,stage.id)} alt={found?`${species.name}: ${stage.label.toLowerCase()}`:`Undiscovered ${stage.label.toLowerCase()} silhouette`} title={found?stage.description:undefined} loading="lazy"/></picture><figcaption>{stage.label}</figcaption></figure>)}</div>
        <footer>{found?<><span>Wingspan {species.wingspanMm[0]}–{species.wingspanMm[1]} mm · {species.active==='night'?'Night':'Day'}</span><p>{species.description}</p><a href={species.source} target="_blank" rel="noreferrer">Species reference ↗</a></>:<span>Find this visitor to reveal its story.</span>}</footer>
      </article>;
    })}</div>
  </section>;
}
