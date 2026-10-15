import React, { useRef, useState } from 'react';
import { Button, Dialog, DialogContent, DialogTitle, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ScaleOutlinedIcon from '@mui/icons-material/ScaleOutlined';
import { MeasurementSystem } from '../engine/types';
import { formatWeight } from '../engine/specimens';
import FishArtwork, { Specimen } from './FishArtwork';

export default function FishInspection({fish,units,label='Your catch'}:{fish:Specimen;units:MeasurementSystem;label?:string}) {
  const [weighing,setWeighing]=useState(false);const root=useRef<HTMLDivElement>(null);
  return <div className="f-fish-inspection" ref={root}><FishArtwork fish={fish} ruler units={units} label={label}/><div className="f-inspection-tools"><small>Read the ruler, then record your length.</small><Button startIcon={<ScaleOutlinedIcon/>} variant="outlined" onClick={()=>setWeighing(true)} aria-label="Weigh fish">Weigh fish</Button></div>
    <Dialog open={weighing} onClose={()=>setWeighing(false)} container={()=>root.current?.closest<HTMLElement>('.f-game')??document.body} className="f-dialog f-scale-dialog" aria-labelledby="f-scale-title" maxWidth="xs" fullWidth>
      <DialogTitle id="f-scale-title">Fishing scale<IconButton aria-label="Close fishing scale" onClick={()=>setWeighing(false)}><CloseIcon/></IconButton></DialogTitle><DialogContent><ScaleOutlinedIcon className="f-scale-symbol"/><span className="f-scale-readout" role="status">{formatWeight(fish.weightKg,units)}</span><p>This is the scale reading. Write it in your notebook to record it.</p><Button onClick={()=>setWeighing(false)}>Back to my catch</Button></DialogContent>
    </Dialog>
  </div>;
}
