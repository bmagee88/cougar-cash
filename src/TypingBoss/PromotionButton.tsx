import React,{useEffect,useState} from 'react';
import {Alert,Box,Button,Dialog,DialogActions,DialogContent,DialogTitle,TextField,Typography} from '@mui/material';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import {promoteTypingBossPlayer} from './api';
import {saveDevicePromotion,promotionLevel as getPromotionLevel} from './promotion';
import {TypingBossPromotionLevel} from './types';
export default function PromotionButton({sessionId,playerToken,promoted,promotionLevel,disabled=false}:{sessionId:string;playerToken:string;promoted?:boolean;promotionLevel?:TypingBossPromotionLevel;disabled?:boolean}) {
  const [open,setOpen]=useState(false),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [confirmed,setConfirmed]=useState<TypingBossPromotionLevel>(()=>getPromotionLevel({promoted,promotionLevel}));
  const [selected,setSelected]=useState<TypingBossPromotionLevel>(1);
  useEffect(()=>{if(promotionLevel!==undefined || promoted!==undefined)setConfirmed(getPromotionLevel({promoted,promotionLevel}));},[promoted,promotionLevel]);
  const close=()=>{if(busy)return;setOpen(false);setPassword('');setError('');};
  const label=confirmed===2?'Double Promoted · Normal damage':confirmed===1?'Promoted · 2× damage':'Promote character';
  return <><Button startIcon={<WorkspacePremiumIcon/>} disabled={disabled || busy} onClick={()=>{setSelected(confirmed || 1);setOpen(true);}} sx={{color:confirmed===2?'#a5f3fc':confirmed===1?'#facc15':undefined}}>{label}</Button>
    <Dialog open={open} onClose={close} fullWidth maxWidth="xs"><DialogTitle>Hero promotion</DialogTitle>
      <Box component="form" onSubmit={async event=>{event.preventDefault();if(!password || busy)return;setBusy(true);setError('');
        try {const response=await promoteTypingBossPlayer(sessionId,playerToken,password,selected);setConfirmed(selected);
          if(!saveDevicePromotion(response.promotionToken)){setError('Promotion updated for this battle, but browser storage is blocked. This device cannot remember the selection.');setPassword('');return;}
          setPassword('');setOpen(false);
        }catch(caught){setError(caught instanceof Error?caught.message:'Could not update this hero.');}finally{setBusy(false);}}}>
        <DialogContent>
          <TextField fullWidth select label="Promotion tier" value={selected} disabled={busy} SelectProps={{native:true}} InputLabelProps={{shrink:true}} onChange={event=>setSelected(Number(event.target.value) as TypingBossPromotionLevel)} sx={{mb:2}}>
            <option value={0}>Normal</option><option value={1}>Promoted · 2× damage</option><option value={2}>Double Promoted · Normal damage</option>
          </TextField>
          <Typography sx={{mb:2}}>{selected===2?'A more powerful appearance with normal attack damage and the normal boss HP contribution.':selected===1?'Twice the attack damage. With Team mode off, this hero also adds an extra boss HP share.':'The original appearance and normal attack damage.'} This selection is remembered in this browser for future battles.</Typography>
          <Box sx={{position:'relative'}}><TextField fullWidth autoFocus type="password" label="Host password" value={password} disabled={busy} onChange={event=>setPassword(event.target.value)} autoComplete="off"
            InputLabelProps={{shrink:true}} inputProps={{maxLength:64}} sx={{'& input':{color:'transparent',WebkitTextFillColor:'transparent',caretColor:'#fff'}}}/>
            <Box aria-hidden="true" data-testid="promotion-password-mask" sx={{position:'absolute',left:14,right:14,top:16,overflow:'hidden',whiteSpace:'nowrap',pointerEvents:'none',font:'20px/24px monospace'}}>{'••'.repeat(password.length)}</Box></Box>
          {error && <Alert severity="error" sx={{mt:2}}>{error}</Alert>}
        </DialogContent><DialogActions><Button onClick={close} disabled={busy}>Close</Button><Button type="submit" variant="contained" disabled={busy || !password}>{busy?'Applying…':'Apply promotion'}</Button></DialogActions>
      </Box></Dialog>
  </>;
}
