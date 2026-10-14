import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TypingState } from '../engine/types';
import { HAIKU_BY_TEXT, HAIKU_SOURCE } from '../engine/haiku';

export default function TypingChallenge({ typing, onKey, onReady }: { typing: TypingState; onKey: (key: string) => void; onReady: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [remaining, setRemaining] = useState(10);
  useLayoutEffect(() => { input.current?.focus(); onReady(); }, [onReady]);
  useEffect(() => {
    let frame: number;
    const render = () => { setRemaining(Math.max(0, (typing.deadline - performance.now()) / 1000)); frame = requestAnimationFrame(render); };
    frame = requestAnimationFrame(render); return () => cancelAnimationFrame(frame);
  }, [typing.deadline]);
  const mistake = typing.typed !== typing.phrase.slice(0, typing.typed.length);
  const poem = HAIKU_BY_TEXT.get(typing.phrase);
  return <section className="f-challenge" aria-labelledby="f-challenge-title" onClick={() => input.current?.focus()}>
    <div className="f-challenge-top"><span id="f-challenge-title">● Fish on! Type to reel it in</span><span className={remaining < 3 ? 'f-time-urgent' : ''}>{remaining.toFixed(1)}<small> s</small></span></div>
    <div className="f-countdown" role="progressbar" aria-label="Time remaining" aria-valuemin={0} aria-valuemax={10} aria-valuenow={remaining}><div style={{ transform: `scaleX(${remaining / 10})` }} /></div>
    <div className="f-phrase" aria-hidden="true">{Array.from(typing.phrase).map((char, i) => {
      const typed = i < typing.typed.length;
      const wrong = typed && typing.typed[i] !== char;
      return <span key={i} className={`${typed ? wrong ? 'f-char-wrong' : 'f-char-correct' : ''} ${i === typing.typed.length ? 'f-caret' : ''}`}>{char}</span>;
    })}</div>
    <input ref={input} className="f-keyboard-input" aria-label={`Type this phrase: ${typing.phrase}`} value={typing.typed} onChange={() => { /* All edits are validated in onKeyDown. */ }} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
      onPaste={e => e.preventDefault()} onDrop={e => e.preventDefault()} onKeyDown={e => {
        if (e.ctrlKey || e.metaKey || e.altKey || e.nativeEvent.isComposing) return;
        if (e.key.length === 1 || e.key === 'Backspace') { e.preventDefault(); onKey(e.key); }
      }} />
    {poem && <div className="f-haiku-credit">Haiku · {poem.author} <span>translated by {HAIKU_SOURCE.translator}</span></div>}
    <div className="f-challenge-help" role="status">{mistake ? 'Wrong key — press Backspace to correct it' : 'Type every character · spaces count · no Enter needed'}</div>
  </section>;
}
