import React, { memo, useLayoutEffect, useRef } from 'react';
import { TypingState } from '../engine/types';
import { HAIKU_BY_TEXT, HAIKU_SOURCE } from '../engine/haiku';
import ChallengeTimer from './ChallengeTimer';

export default memo(function TypingChallenge({ typing, onKey, onReady }: { typing: TypingState; onKey: (key: string) => void; onReady: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => { input.current?.focus(); onReady(); }, [onReady]);
  const mistake = typing.typed !== typing.phrase.slice(0, typing.typed.length);
  const poem = HAIKU_BY_TEXT.get(typing.phrase);
  return <section className="f-challenge" aria-labelledby="f-challenge-title" onClick={() => input.current?.focus()}>
    <ChallengeTimer deadline={typing.deadline} />
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
});
