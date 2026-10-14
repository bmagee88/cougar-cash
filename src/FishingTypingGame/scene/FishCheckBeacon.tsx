import React, { useEffect, useState } from 'react';
import { FishCheck } from '../engine/types';
import { SPECIES } from '../engine/config';

export default function FishCheckBeacon({check}:{check?:FishCheck}) {
  const [visible,setVisible]=useState(false);
  useEffect(()=>{
    if(!check){setVisible(false);return;}
    const remaining=1500-(performance.now()-check.at);
    setVisible(remaining>0);
    if(remaining<=0)return;
    const timer=setTimeout(()=>setVisible(false),remaining);
    return ()=>clearTimeout(timer);
  },[check]);
  if(!check || !visible)return null;
  const fish=SPECIES.find(f=>f.id===check.speciesId)?.name;
  return <div key={check.id} className={`f-check-beacon f-check-${check.outcome}`} aria-hidden="true" data-fish-check={check.id}><i /><span>#{check.id} · {check.outcome==='none' ? 'no fish' : check.outcome}{fish && ` · ${fish}`}</span></div>;
}
