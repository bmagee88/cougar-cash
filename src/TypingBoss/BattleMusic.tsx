import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@mui/material';
import { TypingBossSessionSnapshot } from './types';
import { useCombatClock } from './CombatCharacter';

const ASSETS = `${(process.env.PUBLIC_URL || '').replace(/\/$/, '')}/assets/typing-boss/music`;
export function battleMusicEnabled(session: TypingBossSessionSnapshot, host: boolean) {
  return session.status === 'active' && Boolean(session.countdownEndsAt) && (host || session.networkMode === 'wan');
}

// One media element per screen. Snapshot updates never restart the track.
export default function BattleMusic({ session, host }: {session: TypingBossSessionSnapshot; host: boolean}) {
  const audio = useRef<HTMLAudioElement | null>(null), policy = useRef({ session, host });
  const clock = useCombatClock(session.serverNow);
  policy.current = { session, host };
  const [blocked, setBlocked] = useState(false);
  const attempt = useRef<() => void>(() => {});
  const track = session.boss.id === 'kraken' ? 'leviathans-roar.mp3' : 'dragons-roar.mp3';
  useEffect(() => {
    if (policy.current.session.status !== 'setup' && !policy.current.session.countdownEndsAt) return;
    const media = new Audio(`${ASSETS}/${track}`);
    media.loop = true; media.preload = 'auto'; media.volume = .65;
    audio.current = media;
    let disposed = false, priming = false;
    const seek = () => {
      const current = policy.current.session;
      if (!current.countdownEndsAt || !Number.isFinite(media.duration) || media.duration <= 0) return;
      const elapsed = Math.max(0, Date.now()+clock.current - (current.countdownEndsAt - 5000)) / 1000;
      media.currentTime = elapsed % media.duration;
    };
    const play = () => {
      const current = policy.current;
      if (disposed || !battleMusicEnabled(current.session, current.host)) return;
      media.muted = false;
      if (!media.paused) return;
      seek();
      media.play()?.then(() => { if (!disposed) setBlocked(false); }).catch(() => { if (!disposed) setBlocked(true); });
    };
    const gesture = () => {
      const current = policy.current;
      if (battleMusicEnabled(current.session, current.host)) { play(); return; }
      // Prime during lobby interactions so Start can arrive over SSE on WAN devices.
      if (current.session.status !== 'setup' || priming) return;
      priming = true; media.muted = true;
      media.play()?.then(() => {
        if (disposed) { media.pause(); return; }
        if (battleMusicEnabled(policy.current.session, policy.current.host)) { media.muted = false; seek(); }
        else { media.pause(); media.currentTime = 0; media.muted = false; }
      }).catch(() => {}).finally(() => { priming = false; });
    };
    attempt.current = play;
    media.addEventListener('loadedmetadata', seek);
    document.addEventListener('pointerdown', gesture, true);
    document.addEventListener('keydown', gesture, true);
    play();
    return () => {
      disposed = true; media.pause(); media.removeEventListener('loadedmetadata', seek);
      media.removeAttribute('src'); media.load(); audio.current = null;
      document.removeEventListener('pointerdown', gesture, true);
      document.removeEventListener('keydown', gesture, true);
    };
  }, [session.id, track, clock]);
  const enabled = battleMusicEnabled(session, host);
  useEffect(() => {
    if (enabled) attempt.current();
    else { audio.current?.pause(); setBlocked(false); }
  }, [enabled, session.countdownEndsAt]);
  return enabled && blocked ? <Button className="battle-music-enable" variant="contained" onClick={() => attempt.current()}>Enable battle music</Button> : null;
}
