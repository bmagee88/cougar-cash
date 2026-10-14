import React from 'react';
import { Button, IconButton } from '@mui/material';
import LandscapeOutlinedIcon from '@mui/icons-material/LandscapeOutlined';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';

export default function SceneControls({ scenic, fullscreen, busy, onScenic, onFullscreen }: {
  scenic: boolean; fullscreen: boolean; busy: boolean; onScenic: () => void; onFullscreen: () => void;
}) {
  return <div className={`f-scene-controls ${scenic ? 'f-scene-controls-quiet' : ''}`} role="group" aria-label="Scene view controls">
    <Button className="f-scenic-button" startIcon={<LandscapeOutlinedIcon />} aria-label={scenic ? 'Show HUD' : 'Scenic mode — hide HUD'} aria-pressed={scenic} disabled={busy}
      title={busy ? 'Finish this cast to enter scenic mode' : scenic ? 'Show HUD' : 'Scenic mode — hide HUD'} onClick={onScenic}><span className="f-scenic-label">Scenic</span></Button>
    <IconButton className="f-fullscreen-button" aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} aria-pressed={fullscreen} title={fullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'} onClick={onFullscreen}>
      {fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
    </IconButton>
  </div>;
}
