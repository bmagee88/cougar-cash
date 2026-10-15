import React, { memo, useLayoutEffect, useRef } from 'react';
import { TypingState } from '../engine/types';
import { HAIKU_BY_TEXT, HAIKU_SOURCE } from '../engine/haiku';
import ChallengeTimer from './ChallengeTimer';
import PromptInput from './PromptInput';

export default memo(function TypingChallenge({ typing, onKey, onReady }: { typing: TypingState; onKey: (key: string) => void; onReady: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    // A phone may focus programmatically without opening its keyboard. Wait
    // for a real tap before arming the battle's deadline on touch devices.
    if(!window.matchMedia?.('(pointer: coarse)').matches)input.current?.focus({preventScroll:true});
  }, []);
  const mistake = typing.typed !== typing.phrase.slice(0, typing.typed.length);
  const poem = HAIKU_BY_TEXT.get(typing.phrase);
  return <section className="f-challenge" aria-labelledby="f-challenge-title" onClick={() => input.current?.focus()}>
    <ChallengeTimer deadline={typing.deadline} />
    <div className="f-phrase" aria-hidden="true">{Array.from(typing.phrase).map((char, i) => {
      const typed = i < typing.typed.length;
      const wrong = typed && typing.typed[i] !== char;
      return <span key={i} className={`${typed ? wrong ? 'f-char-wrong' : 'f-char-correct' : ''} ${i === typing.typed.length ? 'f-caret' : ''}`}>{char}</span>;
    })}</div>
    <PromptInput ref={input} label={`Type this phrase: ${typing.phrase}`} value={typing.typed} onKey={onKey} onFocus={onReady}/>
    {poem && <div className="f-haiku-credit">Haiku · {poem.author} <span>translated by {HAIKU_SOURCE.translator}</span></div>}
    <div className="f-challenge-help" role="status">{mistake ? 'Wrong key — press Backspace to correct it' : 'Type every character · spaces count · no Enter needed'}</div>
  </section>;
});
