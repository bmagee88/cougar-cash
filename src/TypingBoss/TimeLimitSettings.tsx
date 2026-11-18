import React from 'react';
import {Stack, TextField, Typography} from '@mui/material';

export function timeLimitSeconds(preset: string, customMinutes: string): number | null {
  if (preset === 'unlimited') return null;
  const seconds = preset === 'custom' ? Number(customMinutes) * 60 : Number(preset);
  return Number.isFinite(seconds) && seconds >= 60 && seconds <= 7200 ? Math.round(seconds) : NaN;
}

export default function TimeLimitSettings({preset, customMinutes, onPresetChange, onCustomChange, disabled}: {
  preset: string; customMinutes: string; onPresetChange: (value: string) => void;
  onCustomChange: (value: string) => void; disabled: boolean;
}) {
  const invalid = Number.isNaN(timeLimitSeconds(preset, customMinutes));
  return <Stack spacing={1.5}>
    <Stack direction={{xs: 'column', sm: 'row'}} spacing={2}>
      <TextField select label="Time limit" value={preset} disabled={disabled} SelectProps={{native: true}}
        InputLabelProps={{shrink: true}} onChange={event => onPresetChange(event.target.value)} sx={{minWidth: 200}}>
        <option value="unlimited">Unlimited</option>
        <option value="180">3 minutes</option>
        <option value="300">5 minutes</option>
        <option value="420">7 minutes</option>
        <option value="custom">Custom time</option>
      </TextField>
      {preset === 'custom' && <TextField label="Custom time (minutes)" type="number" value={customMinutes}
        disabled={disabled} inputProps={{min: 1, max: 120, step: 0.5}} error={invalid}
        helperText={invalid ? 'Enter a time from 1 to 120 minutes.' : 'Enter minutes, such as 4 or 4.5.'}
        onChange={event => onCustomChange(event.target.value)} />}
    </Stack>
    <Typography variant="body2" color="text.secondary">
      {preset === 'unlimited' ? 'Play until the boss or party is defeated.' :
        'The timer starts after the opening countdown. At time-up, the higher remaining HP percentage wins. Equal percentages are a draw.'}
    </Typography>
  </Stack>;
}
