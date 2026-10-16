import React, { useId, useRef, useState } from 'react';
import { Button, Dialog, DialogContent, DialogTitle, IconButton, Tab, Tabs } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import { RARITY_COLORS, SPECIES } from '../engine/config';
import { FishingStats, SaveData } from '../engine/types';
import { BUTTERFLIES } from '../engine/butterflies';
import ButterflyGuide from './ButterflyGuide';
import { ODONATES, SANTA, santaAsset, visitorAsset } from '../engine/visitors';

export type Discoveries=Pick<FishingStats,'discovered'|'albinoDiscovered'>&{butterflies?:readonly string[];visitors?:readonly string[]};
export type GuideTab='fish'|'butterflies'|'odonates'|'special';
export const guideDiscoveries=(save:SaveData):Discoveries=>({...save.stats,butterflies:save.butterflyDiscoveries??[],visitors:save.visitorDiscoveries??[]});
const NO_DISCOVERIES:Discoveries={discovered:[],albinoDiscovered:[]};

export default function FieldGuide({discoveries=NO_DISCOVERIES,initialTab='fish'}:{discoveries?:Discoveries;initialTab?:GuideTab}) {
  const [tab,setTab]=useState<GuideTab>(initialTab);
  return <><Tabs value={tab} onChange={(_,next)=>setTab(next)} aria-label="Field guide categories" variant="scrollable" scrollButtons="auto"><Tab value="fish" label={`Fish · ${discoveries.discovered.length}/${SPECIES.length}`}/><Tab value="butterflies" label={`Butterflies · ${discoveries.butterflies?.length??0}/${BUTTERFLIES.length}`}/><Tab value="odonates" label={`Dragonflies & damselflies · ${ODONATES.filter(s=>discoveries.visitors?.includes(s.id)).length}/${ODONATES.length}`}/><Tab value="special" label="Special visitors"/></Tabs>
    {tab==='odonates'||tab==='special'?<><p className="f-guide-intro">{tab==='special'?'Some visitors only pass through on a special day.':'Watch the water’s edge. Click or tap a visitor to identify it and open a journal page. These insects grow from aquatic nymphs directly into adults, without a chrysalis.'}</p><div className="f-fish-grid">{(tab==='special'?[SANTA]:ODONATES).map(species=>{
      const found=discoveries.visitors?.includes(species.id);
      return <article className={`f-fish-card ${found?'':'f-undiscovered'}`} key={species.id}><img loading="lazy" decoding="async" src={species.id==='santa'?santaAsset():visitorAsset(species.id)} alt={found?species.name:'Undiscovered visitor silhouette'}/><h3>{found?species.name:'Undiscovered visitor'}</h3>{found&&<><p>{species.description}</p>{'source' in species&&<a href={species.source} target="_blank" rel="noreferrer">Species reference ↗</a>}</>}</article>;
    })}</div></>:tab==='butterflies'?<ButterflyGuide discovered={discoveries.butterflies}/>:<><p className="f-guide-intro">Eight species call these waters home. Every cast could be a new discovery.</p><div className="f-fish-grid">{SPECIES.map(species=>{
    const found=discoveries.discovered.includes(species.id);
    return <article className={`f-fish-card ${found?'':'f-undiscovered'}`} key={species.id}>
      <img loading="lazy" decoding="async" src={species.artwork} alt={found?species.name:'Undiscovered fish silhouette'}/>
      <h3>{found?species.name:'Undiscovered'}</h3>
      <span className="f-rarity-label" style={{color:RARITY_COLORS[species.rarity]}}>{species.rarity}</span>
      {found&&<><i>{species.scientificName}</i><p>{species.description}</p>{discoveries.albinoDiscovered.includes(species.id)&&<span className="f-albino-badge">✧ Albino discovered</span>}</>}
    </article>;
  })}</div><p className="f-footnote">Rarity tiers describe game encounter frequency, not conservation status. Individual quality is separate from species rarity. Species reference: <a href="https://www.michigan.gov/dnr/education/michigan-species/fish-species" target="_blank" rel="noreferrer">Michigan DNR fish guide ↗</a></p></>}</>;
}

export function FieldGuideButton({discoveries,initialTab='fish'}:{discoveries?:Discoveries;initialTab?:GuideTab}) {
  const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),titleId=useId();
  return <div className="f-notebook-guide" ref={root}>
    <Button type="button" size="small" startIcon={<MenuBookOutlinedIcon/>} onClick={()=>setOpen(true)}>Open field guide</Button>
    <Dialog open={open} onClose={()=>setOpen(false)} container={()=>root.current?.closest<HTMLElement>('.f-game')??document.body} fullWidth maxWidth="md" className="f-dialog f-guide-overlay" aria-labelledby={titleId}>
      <DialogTitle id={titleId} sx={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>Field guide<IconButton aria-label="Close field guide" onClick={()=>setOpen(false)}><CloseIcon/></IconButton></DialogTitle>
      <DialogContent><FieldGuide discoveries={discoveries} initialTab={initialTab}/></DialogContent>
    </Dialog>
  </div>;
}
