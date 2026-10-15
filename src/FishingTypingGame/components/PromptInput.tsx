import React, { forwardRef, useRef, useState } from 'react';

/** Desktop keyboards send keydown; phone keyboards usually send input instead. */
export default forwardRef<HTMLInputElement, { value:string; label:string; onKey:(key:string)=>void; onFocus?:()=>void }>(function PromptInput({value,label,onKey,onFocus},ref) {
  const composing=useRef(false);
  const [composition,setComposition]=useState<string>();
  const applied=useRef(value);applied.current=value;
  const apply=(next:string)=>{
    const previous=applied.current;applied.current=next;
    let common=0;
    while(common<previous.length && common<next.length && previous[common]===next[common])common++;
    for(let i=previous.length;i>common;i--)onKey('Backspace');
    Array.from(next.slice(common)).forEach(onKey);
  };
  return <input ref={ref} className="f-keyboard-input" aria-label={label} value={composition??value} placeholder="Tap here to type" inputMode="text" enterKeyHint="done"
    autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} onFocus={onFocus}
    onPaste={e=>e.preventDefault()} onDrop={e=>e.preventDefault()}
    onCompositionStart={()=>{composing.current=true;setComposition(value);}}
    onCompositionEnd={e=>{composing.current=false;setComposition(undefined);apply(e.currentTarget.value);}}
    onInput={e=>{if(!composing.current && !(e.nativeEvent as InputEvent).isComposing)apply(e.currentTarget.value);}}
    onChange={e=>{if(composing.current || (e.nativeEvent as InputEvent).isComposing)setComposition(e.target.value);else apply(e.target.value);}}
    onKeyDown={e=>{
      if(e.ctrlKey||e.metaKey||e.altKey||e.nativeEvent.isComposing||composing.current)return;
      // Android's Unidentified/229 events are followed by a real input event.
      if(e.keyCode===229 || e.key==='Unidentified')return;
      if(e.key.length===1||e.key==='Backspace'){e.preventDefault();onKey(e.key);}
    }}/>;
});
