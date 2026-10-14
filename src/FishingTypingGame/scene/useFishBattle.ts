import { useEffect, useRef, useState } from 'react';
import { GameState } from '../engine/types';

/** Presentation only: correct characters reel in; mistakes never change the catch rules. */
export function useFishBattle(game: GameState) {
  const typing = game.phase === 'typing' ? game.typing : undefined;
  const isTyping = !!typing;
  const errors = typing?.errors ?? 0;
  let correct = 0;
  if (typing) while (correct < typing.typed.length && typing.typed[correct] === typing.phrase[correct]) correct++;
  const landed = game.phase === 'landing' || (game.phase === 'result' && game.outcome === 'caught');
  const escaped = game.phase === 'result' && game.outcome === 'escaped';
  const lastProgress = useRef(0);
  const start = game.phase === 'typing' ? game.encounter.retrieve?.reeled ?? 0 : 0;
  const progress = escaped ? lastProgress.current : game.phase === 'retrieving' ? game.retrieve.maxReeled / game.retrieve.typing.phrase.length
    : typing?.phrase.length ? start + (1-start)*correct/typing.phrase.length : Number(landed);
  // An escape starts at the last reeled-in position, before the typing state is discarded.
  if (!escaped) lastProgress.current = progress;
  const mistake = !!typing && correct < typing.typed.length;
  const previousErrors = useRef(0);
  const [surge, setSurge] = useState(false);
  const [splashBurst, setSplashBurst] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (errors > previousErrors.current) {
      setSurge(true); setSplashBurst(burst => burst + 1);
      timer = setTimeout(() => setSurge(false), 700);
    } else if (!isTyping) {
      setSurge(false); setSplashBurst(0);
    }
    previousErrors.current = errors;
    return () => { if (timer !== undefined) clearTimeout(timer); };
  }, [errors, isTyping]);
  return { progress, struggling: isTyping && (mistake || surge), splashBurst };
}
