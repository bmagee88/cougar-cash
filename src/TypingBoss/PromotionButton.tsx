import React,{useState} from 'react';
import {Alert,Box,Button,Dialog,DialogActions,DialogContent,DialogTitle,TextField,Typography} from '@mui/material';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import {promoteTypingBossPlayer} from './api';
import {saveDevicePromotion} from './promotion';
export default function PromotionButton({sessionId,playerToken,promoted,disabled=false}:{sessionId:string;playerToken:string;promoted?:boolean;disabled?:boolean}) {
  const [open,setOpen]=useState(false),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirmed,setConfirmed]=useState(false);
  const close=()=>{if(busy)return;setOpen(false);setPassword('');setError('');};
  const done=promoted || confirmed;
  return <><Button startIcon={<WorkspacePremiumIcon/>} disabled={disabled || done} onClick={()=>setOpen(true)} sx={{color:done?'#facc15':undefined}}>{done?'Promoted · 2× damage':'Promote character'}</Button>
    <Dialog open={open} onClose={close} fullWidth maxWidth="xs"><DialogTitle>Promote this hero</DialogTitle>
      <Box component="form" onSubmit={async event=>{event.preventDefault();if(!password || busy)return;setBusy(true);setError('');
        try {const response=await promoteTypingBossPlayer(sessionId,playerToken,password);setConfirmed(true);
          if(!saveDevicePromotion(response.promotionToken)){setError('Promoted for this battle, but browser storage is blocked. This device cannot remember the promotion.');setPassword('');return;}
          setPassword('');setOpen(false);
        }catch(caught){setError(caught instanceof Error?caught.message:'Could not promote this hero.');}finally{setBusy(false);}}}>
        <DialogContent><Typography sx={{mb:2}}>For steady home-row typing. This hero deals twice the damage, and the boss gains one extra hero’s HP contribution. Promotion is remembered in this browser for future battles.</Typography>
          <Box sx={{position:'relative'}}><TextField fullWidth autoFocus type="password" label="Host password" value={password} disabled={busy || confirmed} onChange={event=>setPassword(event.target.value)} autoComplete="off"
            InputLabelProps={{shrink:true}} inputProps={{maxLength:64}} sx={{'& input':{color:'transparent',WebkitTextFillColor:'transparent',caretColor:'#fff'}}}/>
            <Box aria-hidden="true" data-testid="promotion-password-mask" sx={{position:'absolute',left:14,right:14,top:16,overflow:'hidden',whiteSpace:'nowrap',pointerEvents:'none',font:'20px/24px monospace'}}>{'••'.repeat(password.length)}</Box></Box>
          {error && <Alert severity={confirmed?'warning':'error'} sx={{mt:2}}>{error}</Alert>}
        </DialogContent><DialogActions><Button onClick={close} disabled={busy}>Close</Button><Button type="submit" variant="contained" disabled={busy || !password || confirmed}>{busy?'Promoting…':'Promote hero'}</Button></DialogActions>
      </Box></Dialog>
  </>;
}
