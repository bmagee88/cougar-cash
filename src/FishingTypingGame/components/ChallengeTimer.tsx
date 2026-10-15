import React, { CSSProperties, memo, useEffect, useMemo, useState } from 'react';

const secondsLeft = (deadline: number) => Math.max(0, Math.min(10, (deadline - performance.now()) / 1000));

/** Only the small clock updates; the phrase and keyboard never render on ticks. */
export default memo(function ChallengeTimer({ deadline }: { deadline: number }) {
  const [remaining, setRemaining] = useState(() => secondsLeft(deadline));
  const fillStyle = useMemo(() => {
    const seconds = secondsLeft(deadline);
    return { '--countdown-start': seconds / 10, animationDuration: `${seconds}s` } as CSSProperties;
  }, [deadline]);
  useEffect(() => {
    const update = () => setRemaining(secondsLeft(deadline));
    update(); const timer = window.setInterval(update, 100);
    document.addEventListener('visibilitychange', update);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, [deadline]);
  return <>
    <div className="f-challenge-top"><span id="f-challenge-title">● Fish on! Type to reel it in</span><span className={remaining < 3 ? 'f-time-urgent' : ''}>{remaining.toFixed(1)}<small> s</small></span></div>
    <div className="f-countdown" role="progressbar" aria-label="Time remaining" aria-valuemin={0} aria-valuemax={10} aria-valuenow={remaining}><div className="f-countdown-fill" style={{ ...fillStyle, transform: `scaleX(${remaining / 10})` }} /></div>
  </>;
});
