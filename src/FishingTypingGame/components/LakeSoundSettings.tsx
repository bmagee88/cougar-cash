import React, { useEffect, useRef, useState } from 'react';
import { Button, Checkbox, FormControlLabel, MenuItem, Slider, TextField } from '@mui/material';
import VolumeUpOutlinedIcon from '@mui/icons-material/VolumeUpOutlined';
import { LakeSoundControls, readSoundVolume, WaterSound, WATER_SOUNDS } from '../audio/sounds';

export default function LakeSoundSettings({ enabled, volume, audio, onChange }: {
  enabled: boolean; volume?: number; audio: LakeSoundControls; onChange: (patch: { sound?: boolean; soundVolume?: number }) => void;
}) {
  const [sample, setSample] = useState<WaterSound>('cast');
  const [feedback, setFeedback] = useState(''), [previewing, setPreviewing] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const preview = async () => {
    setPreviewing(true); setFeedback('');
    const played = await audio.preview(sample).catch(() => false);
    if (!mounted.current) return;
    setPreviewing(false);
    setFeedback(played ? `${WATER_SOUNDS[sample].label} preview played.` : 'Sound could not play. Try Play preview again.');
  };
  const level = readSoundVolume(volume);
  return <section className="f-sound-settings" aria-label="Lake sounds">
    <FormControlLabel control={<Checkbox checked={enabled} onChange={event => {
      if (event.target.checked) audio.unlock();
      onChange({ sound: event.target.checked });
    }} />} label="Lake sounds" />
    <p className="f-footnote">Water sounds for casts, nibbles, bites, fish fights, catches, releases, lake splashes and rain, plus passing geese. Sounds vary a little in pitch; distant splashes and flocks are quieter.</p>
    <label id="f-sound-volume-label">Volume <span>{Math.round(level * 100)}%</span></label>
    <Slider aria-labelledby="f-sound-volume-label" aria-label="Lake sound volume" min={0} max={100} value={Math.round(level * 100)} disabled={!enabled}
      onChange={(_event, value) => onChange({ soundVolume: Number(value) / 100 })} valueLabelDisplay="auto" />
    <div className="f-sound-preview"><TextField select size="small" label="Preview lake sound" value={sample} onChange={event => { setSample(event.target.value as WaterSound); setFeedback(''); }}>
      {(Object.keys(WATER_SOUNDS) as WaterSound[]).map(kind => <MenuItem key={kind} value={kind}>{WATER_SOUNDS[kind].label}</MenuItem>)}
    </TextField><Button variant="outlined" startIcon={<VolumeUpOutlinedIcon />} disabled={!enabled || level === 0 || previewing} onClick={preview}>{previewing ? 'Loading sound…' : 'Play preview'}</Button></div>
    {feedback && <p role="status" className="f-footnote">{feedback}</p>}
  </section>;
}
