import React, { useId } from 'react';
import { Checkbox, FormControlLabel } from '@mui/material';

export default function CameraDriftSetting({ enabled, onChange }: {
  enabled: boolean; onChange: (enabled: boolean) => void;
}) {
  const helpId = useId();
  return <div>
    <FormControlLabel control={<Checkbox checked={enabled} onChange={event => onChange(event.target.checked)} inputProps={{ 'aria-describedby': helpId }} />} label="Camera drift" />
    <p id={helpId} className="f-footnote">Gently moves the scenery from side to side. Turn off to keep the camera still on large displays.</p>
  </div>;
}
