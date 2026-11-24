import React,{useState} from 'react';
import {Alert,Box,Button,Dialog,DialogActions,DialogContent,DialogTitle,Stack,TextField,Typography} from '@mui/material';
import {setTypingBossPlayerPromotion} from './api';
import {TypingBossSessionSnapshot,TypingBossPromotionLevel} from './types';
import {promotionLevel} from './promotion';

export default function HostPromotionMenu({session,hostToken,onUpdate}:{session:TypingBossSessionSnapshot;hostToken:string;onUpdate:(session:TypingBossSessionSnapshot)=>void}) {
  const [open,setOpen]=useState(false);
  const [pending,setPending]=useState<string|null>(null);
  const [error,setError]=useState('');
  async function toggle(code:string,level:TypingBossPromotionLevel) {
    setPending(code);setError('');
    try {
      const result=await setTypingBossPlayerPromotion(session.id,hostToken,code,level);
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
        <Typography variant="body2" sx={{mb:2}}>Promoted gives 2× damage. Double Promoted gives an upgraded appearance with normal damage.</Typography>
        {error && <Alert severity="error" sx={{mb:2}}>{error}</Alert>}
        {!session.players.length && <Typography>No players have joined yet.</Typography>}
        <Stack spacing={1}>
          {session.players.map(player=><Stack key={player.code} direction={{xs:'column',sm:'row'}} alignItems={{xs:'stretch',sm:'center'}} justifyContent="space-between" spacing={2}>
            <Box><Typography fontWeight={700}>{player.name}</Typography><Typography variant="body2" color="text.secondary">{promotionLevel(player)===1?'2× damage':'Normal damage'}</Typography></Box>
            <TextField select label="Promotion" value={promotionLevel(player)} disabled={pending!==null || !['setup','active'].includes(session.status)}
              SelectProps={{native:true}} InputLabelProps={{shrink:true}} inputProps={{'aria-label':`Promotion for ${player.name}`}} sx={{minWidth:220}}
              onChange={event=>toggle(player.code,Number(event.target.value) as TypingBossPromotionLevel)}>
              <option value={0}>Normal</option><option value={1}>Promoted</option><option value={2}>Double Promoted</option>
            </TextField>
          </Stack>)}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={()=>setOpen(false)}>Close</Button></DialogActions>
    </Dialog>
  </>;
}
