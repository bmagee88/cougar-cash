import "./promotion.css";
import {KrakenStatus} from './KrakenVisuals';
import {useBattleCountdown} from './BattleCountdown';
import {combatNumber} from './combatNumbers';
import RecoveryBar from './RecoveryBar';
import BossHealthFill from './BossHealthFill';
import React, { useEffect, useRef, useState } from "react";
import CombatCharacter, { useCombatAnimation, useCombatClock } from "./CombatCharacter";
import { CombatAnimation, CombatAnimationEvent } from "./combatAnimation";
import { TypingBossPlayer, TypingBossTypingState } from "./types";
import { portraitDefense } from "./typingFeedback";
import DragonCombatSprite from "./DragonCombatSprite";
import { useDragonCombatAnimation } from "./useDragonCombatAnimation";
import { TypingBossBoss } from "./types";
import "./typingPortrait.css";
import {playerVictoryPose} from './victoryAnimation';
import {promotionLevel,promotionDamageMultiplier,promotionVisualClass} from './promotion';
import SummonParty from './SummonSprites';
import {bossPortraitWidth} from './bossPortraitLayout';

export type TypingPortraitProps = {
  battleDefeatPose?:CombatAnimation;
  victoryAt?:number;
  teamMode?: boolean;
  player: TypingBossPlayer;
  events: readonly CombatAnimationEvent[];
  serverNow?: number;
  anchorRef?: React.Ref<HTMLDivElement>;
};

export type DragonPortraitProps = {
  boss: TypingBossBoss;
  events: readonly CombatAnimationEvent[];
  serverNow?: number;
  anchorRef?: React.Ref<HTMLDivElement>;
};

// A fixed-width glyph box scales long values down without truncation or layout reads.
function FittedNumber({children}:{children:string}) {
  return <svg className="portrait-fitted-number" viewBox={`0 0 ${Math.max(1,children.length)*64} 120`} preserveAspectRatio="xMinYMid meet" aria-hidden="true">
    <text x="0" y="96" fontSize="100" fontFamily="monospace" fill="currentColor">{children}</text>
  </svg>;
}

function PortraitPower({state}:{state?:Partial<TypingBossTypingState>}) {
  if(!state)return null;
  if(state.balanced && state.ability==='cleric')return null;
  const power=state.balanced ? (state.balancedOrangePower || 0)*promotionDamageMultiplier(state) : ((state.orange || 0)+(state.growth || 0))*100;
  const label=`+${state.balanced ? combatNumber(power) : Number(power.toFixed(2))}${state.balanced?'':'%'}`;
  return <span className="portrait-power" aria-label={`Power bonus: +${state.balanced ? combatNumber(power) : Number(power.toFixed(2))}${state.balanced?'':'%'}`}>
    <FittedNumber>{label}</FittedNumber>
  </span>;
}

function PortraitHealth({hp,maxHp,name,boss=false}:{hp:number;maxHp:number;name:string;boss?:boolean}) {
  const ratio=maxHp>0?Math.max(0,Math.min(1,hp/maxHp)):0;
  const color=hp<=0?'#64748b':ratio<.15?'#ef4444':ratio<.5?'#f97316':'#22c55e';
  return <><div className="portrait-health" role="progressbar" aria-label={`${name} health`}
    aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio*100)}>
    {boss?<BossHealthFill hp={hp} maxHp={maxHp} color={color}/>:<span style={{width:`${ratio*100}%`,backgroundColor:color}}/>}
  </div><span className="portrait-health-value" aria-label={`${name} HP: ${combatNumber(hp)} / ${combatNumber(maxHp)}`}><FittedNumber>{`${combatNumber(hp)} / ${combatNumber(maxHp)}`}</FittedNumber></span></>;
}

// Every landed hit gets its own short impact, including hits that cannot
// interrupt the body sprite's protected attack or stronger hurt animation.
function HostHitFeedback({events,clock}:{events:readonly CombatAnimationEvent[];clock:React.MutableRefObject<number>}) {
  const [,redraw]=useState(0),now=Date.now()+clock.current;
  const hits=events.filter(event=>event.state==="hit" && event.at<=now && now<event.at+460);
  const deadline=hits.length?Math.min(...hits.map(hit=>hit.at+460)):undefined;
  useEffect(()=>{
    if(deadline===undefined)return;
    const timer=setTimeout(()=>redraw(value=>value+1),Math.max(1,deadline-Date.now()-clock.current)+8);
    return ()=>clearTimeout(timer);
  },[deadline,clock]);
  return <>{hits.map(hit=><span key={hit.id} data-testid="host-profile-hit" aria-hidden="true"
    className={`host-profile-hit host-profile-hit-${hit.hurtTier || "basic"}`}
    style={{animationDelay:`-${Math.max(0,now-hit.at)}ms`}}><i/><b/></span>)}</>;
}

export function DragonPortrait({ boss, events, serverNow, anchorRef, state, letters: localLetters }: DragonPortraitProps & { state?: TypingBossTypingState; letters?: number }) {
  const clock = useCombatClock(serverNow);
  const profileState=state || boss.profile;
  const pose = useDragonCombatAnimation(events, boss.hurt, boss.hp <= 0, clock, boss.id==='kraken'?boss.krakenWave:boss.flameBreath);
  const letters = localLetters ?? boss.attackCharacters ?? 0;
  const crit = profileState?.balanced ? (profileState.balancedCritBonus || 0) * 100 : 0;
  const special = (profileState?.gold || 0) > 0;
  const defense = profileState ? portraitDefense(profileState,boss.maxHp) : null;
  return <div ref={anchorRef} className={`typing-portrait typing-dragon-portrait${special ? " typing-portrait-charged" : ""}`} data-testid={state ? "host-dragon-portrait" : "dragon-portrait"} aria-label={`${boss.name} ${state ? "host typing" : "personal opponent"} profile`}>
    <div className="portrait-scenery" aria-hidden="true" />
    {crit > 0 && <div className="portrait-crit-aura" aria-hidden="true"><i/><i/><i/></div>}
    {special && <div className="portrait-special" aria-hidden="true"><i/><i/><i/></div>}
    {defense && <div className="portrait-dodge" style={{opacity:Math.sqrt(defense.dodge)}} aria-hidden="true"/>}
    <div className="portrait-dragon"><DragonCombatSprite bossId={boss.id} bossState={boss} krakenCast={boss.krakenCast} width={bossPortraitWidth(boss.id)} glow={boss.glow} pose={pose} clock={clock} /></div>
    <HostHitFeedback events={events} clock={clock}/>
    {defense && <div className="portrait-shield" style={{opacity:Math.sqrt(defense.shield)}} aria-hidden="true"/>}
    <div className="portrait-attack" title="Dragon attack charge" aria-label={`Dragon attack power: ${combatNumber(letters)}`}>
      <span>ATK</span><strong style={{ fontSize: `${21 + Math.min(22, letters * .24)}px` }}><FittedNumber>{combatNumber(letters)}</FittedNumber></strong>
      <PortraitPower state={profileState}/>
    </div>
    {crit > 0 && <div className="portrait-crit-badge" role="status" aria-label={`Crit ready: +${Number(crit.toFixed(2))}%`}><span>CRIT</span><strong><FittedNumber>{`+${Number(crit.toFixed(2))}%`}</FittedNumber></strong></div>}
    {special && <span className="portrait-special-label">SPECIAL</span>}
    <span className="portrait-name" title={boss.name}>{boss.name}</span>
    <PortraitHealth hp={boss.hp} maxHp={boss.maxHp} name={boss.name} boss/>
  </div>;
}

export default function TypingPortrait({ player, events, serverNow, anchorRef, state, letters, teamMode, victoryAt, battleDefeatPose }: TypingPortraitProps & {
  state: TypingBossTypingState; letters: number;
}) {
  const clock = useCombatClock(serverNow);
  const combatPose = useCombatAnimation(events, player.defeated, clock);
  const pose = battleDefeatPose || playerVictoryPose(player,victoryAt) || combatPose;
  const knockedOut=pose.state==='death' || pose.state==='defeated';
  const level=promotionLevel(player);
  const defense = portraitDefense(state, player.maxHp);
  const prone=useBattleCountdown(player.proneUntil,serverNow)>0 && pose.state!=='victory' && !knockedOut;
  const previous = useRef(letters);
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    if (letters > previous.current) setPulse(value => value + 1);
    previous.current = letters;
  }, [letters]);
  const special = !knockedOut && (state.gold || 0) > 0;
  const crit = !knockedOut && state.balanced ? (state.balancedCritBonus || 0) * 100 : 0;
  return <div ref={anchorRef} className={`typing-portrait${knockedOut?' typing-portrait-ko':''}${battleDefeatPose?.state==='death'?' dragon-finishing-party':''}${level>0?" typing-portrait-promoted":""}${level===2?' typing-portrait-double-promoted':''}${prone?" typing-portrait-prone":""}${special ? " typing-portrait-charged" : ""}`}
    data-testid="typing-portrait" aria-label={`${player.name} typing profile`}>
    <div className="portrait-scenery" aria-hidden="true" />
    {crit > 0 && <div className="portrait-crit-aura" data-testid="portrait-crit-aura" aria-hidden="true"><i /><i /><i /></div>}
    <div className="portrait-special" data-testid="portrait-special" data-charged={special}
      style={{ opacity: special ? 1 : 0 }} aria-hidden="true"><i /><i /><i /></div>
    <div className="portrait-dodge" data-testid="portrait-dodge" style={{ opacity: knockedOut?0:Math.sqrt(defense.dodge) }}
      title="Active Dodge" aria-hidden="true" />
    {teamMode && <SummonParty portrait summons={player.summons} clock={clock} defeatPose={battleDefeatPose} victoryAt={victoryAt}/>}
    <div className={`portrait-character ${promotionVisualClass(player)}`}><CombatCharacter classId={player.classId} color={player.color} size={78} pose={pose} clock={clock} kneeling={Boolean(teamMode && (player.secondWindWordsRemaining || 0)>0)} /></div>
    {!knockedOut && (player.secondWindWordsRemaining || 0)>0 && <div className="portrait-recovery"><span>Second Wind</span><RecoveryBar player={player} clock={clock} profile/></div>}
    <div className="portrait-shield" data-testid="portrait-shield" style={{ opacity: knockedOut?0:Math.sqrt(defense.shield) }}
      title="Active Block" aria-hidden="true" />
    <div key={pulse} className={`portrait-attack${pulse ? " portrait-attack-pulse" : ""}`} data-testid="portrait-attack"
      title="Earned attack charge" aria-label={`Attack power: ${combatNumber(letters)}`}>
      <span>ATK</span><strong style={{ fontSize: `${21 + Math.min(22, letters * .12)}px` }}><FittedNumber>{combatNumber(letters)}</FittedNumber></strong>
      <PortraitPower state={state}/>
    </div>
    {special && <span className="portrait-special-label">SPECIAL</span>}
    {crit > 0 && <div className="portrait-crit-badge" data-testid="portrait-crit-badge" role="status" aria-label={`Crit ready: +${Number(crit.toFixed(2))}%`}>
      <span>CRIT</span><strong><FittedNumber>{`+${Number(crit.toFixed(2))}%`}</FittedNumber></strong>
    </div>}
    {level>0 && <span className="portrait-promotion" aria-label={level===2?'Double promoted hero':'Promoted hero'}>{level===2?'★★':'★'}</span>}
    {!knockedOut && <KrakenStatus player={player} serverNow={serverNow}/>}
    {knockedOut && <span className="portrait-ko-label" role="status" aria-label={`${player.name} knocked out`}>KO</span>}
    <span className="portrait-name" title={player.name}>{player.name}</span>
    <PortraitHealth hp={player.hp} maxHp={player.maxHp} name={player.name}/>
  </div>;
}
