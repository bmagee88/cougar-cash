import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@mui/material';

export const PREVIEW_REPEAT_MS=10000;

/** Developer event previews repeat until stopped, disabled, or unmounted. */
export default function RepeatPreviewButton({onTrigger,disabled=false,variant='text',children}:{onTrigger:()=>void;disabled?:boolean;variant?:'text'|'outlined'|'contained';children:React.ReactNode}) {
  const [active,setActive]=useState(false);
  const trigger=useRef(onTrigger);trigger.current=onTrigger;
  useEffect(()=>{
    if(disabled){setActive(false);return;}
    if(!active)return;
    const timer=setInterval(()=>trigger.current(),PREVIEW_REPEAT_MS);
    return ()=>clearInterval(timer);
  },[active,disabled]);
  return <Button disabled={disabled} variant={active?'contained':variant} aria-pressed={active&&!disabled}
    title={active?'Repeating every 10 seconds. Click to stop.':'Start now and repeat every 10 seconds.'}
    onClick={()=>{if(active)setActive(false);else{setActive(true);trigger.current();}}}>
    {children}{active&&<span aria-hidden="true">&nbsp;· on</span>}
  </Button>;
}
