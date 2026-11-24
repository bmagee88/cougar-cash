import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@mui/material';
import { TypingBossSessionSnapshot } from './types';
import { useCombatClock } from './CombatCharacter';

const ASSETS = `${(process.env.PUBLIC_URL || '').replace(/\/$/, '')}/assets/typing-boss/music`;
export const MUSIC_VOLUME = .65;
export const MUSIC_FADE_MS = 3000;
// Player-victory music is deliberately an empty slot until its track is supplied.
export const ENDING_MUSIC: Record<'victory'|'defeat'|'draw', string|null> = {
  defeat:'the-final-bow.mp3', victory:null, draw:null,
};
const isResult = (status:TypingBossSessionSnapshot['status']):status is keyof typeof ENDING_MUSIC => status in ENDING_MUSIC;
export function battleMusicEnabled(session: TypingBossSessionSnapshot, host: boolean) {
  return Boolean(session.countdownEndsAt) && (host || session.networkMode === 'wan') &&
    (session.status === 'active' || isResult(session.status));
}

// Reuse the unlocked media element for combat, fading and the ending song.
export default function BattleMusic({ session, host }: {session: TypingBossSessionSnapshot; host: boolean}) {
  const policy = useRef({ session, host }), clock = useCombatClock(session.serverNow);
  policy.current = { session, host };
  const [blocked, setBlocked] = useState(false);
  const synchronize = useRef<() => void>(() => {});
  const battleTrack = session.boss.id === 'kraken' ? 'leviathans-roar.mp3' : 'dragons-roar.mp3';
  useEffect(() => {
    if (policy.current.session.status !== 'setup' && !policy.current.session.countdownEndsAt) return;
    const media = new Audio(`${ASSETS}/${battleTrack}`);
    media.loop = true; media.preload = 'auto'; media.volume = MUSIC_VOLUME;
    let disposed = false, priming = false, currentTrack:string|null = battleTrack;
    let fadeTimer:ReturnType<typeof setInterval>|undefined, resultKey = '', resultAt = 0;
    const now = () => Date.now()+clock.current;
    const cancelFade = () => { if(fadeTimer!==undefined)clearInterval(fadeTimer);fadeTimer=undefined; };
    const stop = () => { media.pause();setBlocked(false); };
    const setTrack = (track:string,loop:boolean) => {
      if(currentTrack!==track) { media.pause();media.src=`${ASSETS}/${track}`;currentTrack=track;media.load(); }
      media.loop=loop;
    };
    const seek = () => {
      const current = policy.current.session;
      if (!Number.isFinite(media.duration) || media.duration <= 0) return;
      const elapsed = currentTrack===battleTrack ? Math.max(0,now() - ((current.countdownEndsAt || now()+5000)-5000))/1000 : Math.max(0,now()-resultAt-MUSIC_FADE_MS)/1000;
      media.currentTime = media.loop ? elapsed%media.duration : Math.min(elapsed,media.duration);
    };
    const play = () => {
      if(disposed || !media.paused || media.ended)return;
      seek();
      if(!media.loop && Number.isFinite(media.duration) && media.currentTime>=media.duration)return;
      media.muted=false;
      media.play()?.then(()=>{if(!disposed)setBlocked(false);}).catch(()=>{if(!disposed)setBlocked(true);});
    };
    const playEnding = () => {
      cancelFade();
      const current=policy.current;
      if(!battleMusicEnabled(current.session,current.host) || !isResult(current.session.status)) {stop();return;}
      const track=ENDING_MUSIC[current.session.status];
      if(!track){stop();return;}
      setTrack(track,false);media.volume=MUSIC_VOLUME;play();
    };
    const sync = () => {
      const current=policy.current;
      if(disposed)return;
      if(!battleMusicEnabled(current.session,current.host)) {
        cancelFade();stop();resultKey='';
        if(current.session.status==='setup'){setTrack(battleTrack,true);media.currentTime=0;media.volume=MUSIC_VOLUME;}
        return;
      }
      if(current.session.status==='active') {
        cancelFade();resultKey='';setTrack(battleTrack,true);media.volume=MUSIC_VOLUME;play();return;
      }
      const key=`${current.session.status}:${current.session.closedAt || ''}`;
      if(resultKey!==key) {
        resultKey=key;
        const closedAt=Date.parse(current.session.closedAt || '');
        resultAt=Number.isFinite(closedAt)?closedAt:now();
      }
      if(now()-resultAt>=MUSIC_FADE_MS){playEnding();return;}
      const fade = () => {
        const progress=Math.max(0,Math.min(1,(now()-resultAt)/MUSIC_FADE_MS));
        media.volume=MUSIC_VOLUME*(1-progress);
        if(progress>=1)playEnding();
      };
      fade();play();
      if(fadeTimer===undefined && now()-resultAt<MUSIC_FADE_MS)fadeTimer=setInterval(fade,50);
    };
    const gesture = () => {
      const current=policy.current;
      if(battleMusicEnabled(current.session,current.host)){sync();return;}
      if(current.session.status!=='setup' || priming)return;
      priming=true;media.muted=true;
      media.play()?.then(()=>{
        if(disposed){media.pause();return;}
        if(battleMusicEnabled(policy.current.session,policy.current.host)){media.muted=false;sync();}
        else {media.pause();media.currentTime=0;media.muted=false;}
      }).catch(()=>{}).finally(()=>{priming=false;});
    };
    synchronize.current=sync;
    media.addEventListener('loadedmetadata',seek);
    document.addEventListener('pointerdown',gesture,true);
    document.addEventListener('keydown',gesture,true);
    sync();
    return () => {
      disposed=true;cancelFade();media.pause();media.removeEventListener('loadedmetadata',seek);
      media.removeAttribute('src');media.load();
      document.removeEventListener('pointerdown',gesture,true);
      document.removeEventListener('keydown',gesture,true);
    };
  }, [session.id,battleTrack,clock]);
  useEffect(()=>{synchronize.current();},[session.status,session.countdownEndsAt,session.closedAt,session.networkMode,host]);
  return battleMusicEnabled(session,host) && blocked ? <Button className="battle-music-enable" variant="contained" onClick={()=>synchronize.current()}>Enable battle music</Button> : null;
}
