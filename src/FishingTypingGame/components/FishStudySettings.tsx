import React from 'react';
import { Checkbox, FormControlLabel, MenuItem, TextField } from '@mui/material';
import { MeasurementSystem, SaveData } from '../engine/types';

export default function FishStudySettings({settings,onChange}:{settings:SaveData['settings'];onChange:(patch:Partial<SaveData['settings']>)=>void}) {
  return <><FormControlLabel control={<Checkbox checked={settings.hideFishDetails!==false} onChange={e=>onChange({hideFishDetails:e.target.checked})}/>} label="Hide automatic fish details"/>
    <p className="f-study-settings-help">Hide automatic names, quality, weight and length on catches and in your records. Discovered fish names stay visible in the field guide. Use the ruler and scale, then write your own observations in the notebook.</p>
    <TextField select label="Measurements" value={settings.measurements??'imperial'} onChange={e=>onChange({measurements:e.target.value as MeasurementSystem})}><MenuItem value="imperial">Imperial · lb / in</MenuItem><MenuItem value="metric">Metric · kg / cm</MenuItem></TextField>
  </>;
}
