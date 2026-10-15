import React from 'react';
import { Button, Checkbox, FormControlLabel } from '@mui/material';
import { ScreenWakeStatus } from '../useScreenWakeLock';

const messages: Record<ScreenWakeStatus, string> = {
  off: 'Keep the display on while this game is visible, including Scenic mode.',
  requesting: 'Requesting permission to keep the screen awake…',
  active: 'Screen is staying awake while this game is visible.',
  paused: 'Paused while the page is hidden. It will resume when you return.',
  blocked: 'Your browser or device released the wake lock. Try again, or check battery-saving settings.',
  unsupported: 'Screen wake lock is unavailable here. Try a supported browser over HTTPS.',
};
export default function ScreenAwakeSetting({ enabled, supported, status, onChange, retry }: {
  enabled: boolean; supported: boolean; status: ScreenWakeStatus; onChange: (value: boolean) => void; retry: () => void;
}) {
  return <div>
    <FormControlLabel control={<Checkbox checked={enabled} disabled={!supported && !enabled} onChange={event => onChange(event.target.checked)} />} label="Keep screen awake" />
    <p className="f-footnote" role="status">{messages[supported ? status : 'unsupported']}</p>
    {enabled && supported && status === 'blocked' && <Button size="small" onClick={retry}>Try keeping screen awake again</Button>}
  </div>;
}
