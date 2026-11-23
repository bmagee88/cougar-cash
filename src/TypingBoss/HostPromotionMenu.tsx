import React,{useState} from 'react';
import {Alert,Box,Button,Dialog,DialogActions,DialogContent,DialogTitle,FormControlLabel,Stack,Switch,Typography} from '@mui/material';
import {setTypingBossPlayerPromotion} from './api';
import {TypingBossSessionSnapshot} from './types';

export default function HostPromotionMenu({session,hostToken,onUpdate}:{session:TypingBossSessionSnapshot;hostToken:string;onUpdate:(session:TypingBossSessionSnapshot)=>void}) {
  const [open,setOpen]=useState(false);
  const [pending,setPending]=useState<string|null>(null);
  const [error,setError]=useState('');
  async function toggle(code:string,promoted:boolean) {
    setPending(code);setError('');
    try {
      const result=await setTypingBossPlayerPromotion(session.id,hostToken,code,promoted);
      onUpdate(result.session);
    } catch(caught) {
      setError(caught instanceof Error?caught.message:'Could not update promotion. Try again.');
    } finally {setPending(null);}
  }
  return <>
    <Box sx={{position:'fixed',top:12,right:12,zIndex:1200}}>
      <Button variant="contained" onClick={()=>setOpen(true)} aria-haspopup="dialog">Player promotions</Button>
    </Box>
    <Dialog open={open} onClose={()=>setOpen(false)} fullWidth maxWidth="sm" aria-labelledby="player-promotions-title">
      <DialogTitle id="player-promotions-title">Player promotions</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{mb:2}}>{error}</Alert>}
        {!session.players.length && <Typography>No players have joined yet.</Typography>}
        <Stack spacing={1}>
          {session.players.map(player=><Stack key={player.code} direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
            <Box><Typography fontWeight={700}>{player.name}</Typography><Typography variant="body2" color="text.secondary">{player.promoted?'Promoted':'Not promoted'}</Typography></Box>
            <FormControlLabel label="Promoted" control={<Switch checked={Boolean(player.promoted)} disabled={pending!==null || !['setup','active'].includes(session.status)} inputProps={{'aria-label':`Promote ${player.name}`}} onChange={(_event,checked)=>toggle(player.code,checked)}/>}/>
          </Stack>)}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={()=>setOpen(false)}>Close</Button></DialogActions>
    </Dialog>
  </>;
}
