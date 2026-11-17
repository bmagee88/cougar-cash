import React from 'react';
import {TypingBossPlayer} from './types';
import {useBattleCountdown} from './BattleCountdown';
import './kraken.css';
const ASSETS=`${(process.env.PUBLIC_URL || '').replace(/\/$/,'')}/assets/typing-boss/kraken-concept-v1`;
export function KrakenScenery({foreground=false}:{foreground?:boolean}) {
  return foreground?<img className="kraken-arena-foreground" src={`${ASSETS}/foreground.png`} alt="" aria-hidden="true"/>:
    <div className="kraken-arena" aria-hidden="true"><img src={`${ASSETS}/background.png`} alt=""/><img src={`${ASSETS}/ship-platform.png`} alt=""/></div>;
}
function Spiral(){return <svg viewBox="0 0 100 100" aria-hidden="true"><path d="M49 49c-9-11 7-24 19-11 15 16-5 41-27 28C12 49 27 11 58 14c39 4 46 53 14 73C33 111-9 72 8 34" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/></svg>;}
export function KrakenStatus({player,serverNow}:{player:TypingBossPlayer;serverNow?:number}) {
  const prone=useBattleCountdown(player.proneUntil,serverNow),curse=useBattleCountdown(player.curseUntil,serverNow);
  return <>{curse>0 && <div className="kraken-curse-symbol" role="status" aria-label={`Ink Hex: ${curse} seconds`}><Spiral/></div>}
    {prone>0 && <span className="kraken-prone-label" role="status">Prone · {prone}s</span>}</>;
}
export {default as KrakenSprite} from './KrakenAtlasSprite';
