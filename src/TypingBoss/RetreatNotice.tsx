import React,{useEffect,useRef,useState} from 'react';
import {Alert,Snackbar} from '@mui/material';
import {TypingBossPlayer} from './types';

export default function RetreatNotice({players}:{players:TypingBossPlayer[]}) {
  const seen=useRef(new Set<string>());
  const [message,setMessage]=useState('');
  useEffect(()=>{
    const retreated=players.filter(player=>player.timedOut && !seen.current.has(player.code));
    for(const player of retreated)seen.current.add(player.code);
    if(retreated.length)setMessage(`${retreated.map(player=>player.name).join(', ')} ${retreated.length===1?'has':'have'} retreated due to inactivity and left this battle.`);
  },[players]);
  return <Snackbar open={Boolean(message)} autoHideDuration={6000} onClose={()=>setMessage('')} anchorOrigin={{vertical:'top',horizontal:'center'}}>
    <Alert severity="info" onClose={()=>setMessage('')} sx={{maxWidth:'80vw'}}>{message}</Alert>
  </Snackbar>;
}
