import React, { useEffect, useRef, useState } from "react";
import CombatCharacter, { useCombatAnimation, useCombatClock } from "./CombatCharacter";
import { CombatAnimationEvent } from "./combatAnimation";
import { TypingBossPlayer, TypingBossTypingState } from "./types";
import { portraitDefense } from "./typingFeedback";
import DragonCombatSprite from "./DragonCombatSprite";
import { useDragonCombatAnimation } from "./useDragonCombatAnimation";
import { TypingBossBoss } from "./types";
import "./typingPortrait.css";

export type TypingPortraitProps = {
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

function PortraitPower({state}:{state?:Partial<TypingBossTypingState>}) {
  if(!state)return null;
  if(state.balanced && state.ability==='cleric')return null;
  const power=state.balanced ? state.balancedOrangePower || 0 : ((state.orange || 0)+(state.growth || 0))*100;
  return <span className="portrait-power" aria-label={`Power bonus: +${Number(power.toFixed(2))}${state.balanced?'':'%'}`}>
    +{Number(power.toFixed(2))}{state.balanced?'':'%'}
  </span>;
}

function PortraitHealth({hp,maxHp,name}:{hp:number;maxHp:number;name:string}) {
  const ratio=maxHp>0?Math.max(0,Math.min(1,hp/maxHp)):0;
  const color=hp<=0?'#64748b':ratio<.15?'#ef4444':ratio<.5?'#f97316':'#22c55e';
  return <div className="portrait-health" role="progressbar" aria-label={`${name} health`}
    aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio*100)}>
    <span style={{width:`${ratio*100}%`,backgroundColor:color}}/>
  </div>;
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
  const pose = useDragonCombatAnimation(events, boss.hurt, boss.hp <= 0, clock, boss.flameBreath);
  const letters = localLetters ?? boss.attackCharacters ?? 0;
  const crit = profileState?.balanced ? (profileState.balancedCritBonus || 0) * 100 : 0;
  const special = (profileState?.gold || 0) > 0;
  const defense = profileState ? portraitDefense(profileState,boss.maxHp) : null;
  return <div ref={anchorRef} className={`typing-portrait typing-dragon-portrait${special ? " typing-portrait-charged" : ""}`} data-testid={state ? "host-dragon-portrait" : "dragon-portrait"} aria-label={`${boss.name} ${state ? "host typing" : "personal opponent"} profile`}>
    <div className="portrait-scenery" aria-hidden="true" />
    {crit > 0 && <div className="portrait-crit-aura" aria-hidden="true"><i/><i/><i/></div>}
    {special && <div className="portrait-special" aria-hidden="true"><i/><i/><i/></div>}
    {defense && <div className="portrait-dodge" style={{opacity:Math.sqrt(defense.dodge)}} aria-hidden="true"/>}
    <div className="portrait-dragon"><DragonCombatSprite bossId={boss.id} width={{xs:98,md:136}} glow={boss.glow} pose={pose} clock={clock} /></div>
    <HostHitFeedback events={events} clock={clock}/>
    {defense && <div className="portrait-shield" style={{opacity:Math.sqrt(defense.shield)}} aria-hidden="true"/>}
    <div className="portrait-attack" title="Dragon attack charge" aria-label={`Dragon attack letters: ${letters}`}>
      <span>ATK</span><strong style={{ fontSize: `${21 + Math.min(22, letters * .24)}px` }}>{letters}</strong>
      <PortraitPower state={profileState}/>
    </div>
    {crit > 0 && <div className="portrait-crit-badge" role="status" aria-label={`Crit ready: +${Number(crit.toFixed(2))}%`}><span>CRIT</span><strong>+{Number(crit.toFixed(2))}%</strong></div>}
    {special && <span className="portrait-special-label">SPECIAL</span>}
    <span className="portrait-name" title={boss.name}>{boss.name}</span>
    <PortraitHealth hp={boss.hp} maxHp={boss.maxHp} name={boss.name}/>
  </div>;
}

export default function TypingPortrait({ player, events, serverNow, anchorRef, state, letters }: TypingPortraitProps & {
  state: TypingBossTypingState; letters: number;
}) {
  const clock = useCombatClock(serverNow);
  const pose = useCombatAnimation(events, player.defeated, clock);
  const defense = portraitDefense(state, player.maxHp);
  const previous = useRef(letters);
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    if (letters > previous.current) setPulse(value => value + 1);
    previous.current = letters;
  }, [letters]);
  const special = (state.gold || 0) > 0;
  const crit = state.balanced ? (state.balancedCritBonus || 0) * 100 : 0;
  return <div ref={anchorRef} className={`typing-portrait${special ? " typing-portrait-charged" : ""}`}
    data-testid="typing-portrait" aria-label={`${player.name} typing profile`}>
    <div className="portrait-scenery" aria-hidden="true" />
    {crit > 0 && <div className="portrait-crit-aura" data-testid="portrait-crit-aura" aria-hidden="true"><i /><i /><i /></div>}
    <div className="portrait-special" data-testid="portrait-special" data-charged={special}
      style={{ opacity: special ? 1 : 0 }} aria-hidden="true"><i /><i /><i /></div>
    <div className="portrait-dodge" data-testid="portrait-dodge" style={{ opacity: Math.sqrt(defense.dodge) }}
      title={state.balanced && !state.balancedRandomColors ? 'Active Dodge' : `Dodge: ${Math.round(defense.dodge * 100)}%`} aria-hidden="true" />
    <div className="portrait-character"><CombatCharacter classId={player.classId} color={player.color} size={78} pose={pose} clock={clock} /></div>
    <div className="portrait-shield" data-testid="portrait-shield" style={{ opacity: Math.sqrt(defense.shield) }}
      title={state.balanced && !state.balancedRandomColors ? 'Active Block' : `Block: ${Math.round(defense.shield * 100)}%`} aria-hidden="true" />
    <div key={pulse} className={`portrait-attack${pulse ? " portrait-attack-pulse" : ""}`} data-testid="portrait-attack"
      title="Earned attack charge" aria-label={`Attack letters: ${letters}`}>
      <span>ATK</span><strong style={{ fontSize: `${21 + Math.min(22, letters * .12)}px` }}>{letters}</strong>
      <PortraitPower state={state}/>
    </div>
    {special && <span className="portrait-special-label">SPECIAL</span>}
    {crit > 0 && <div className="portrait-crit-badge" data-testid="portrait-crit-badge" role="status" aria-label={`Crit ready: +${Number(crit.toFixed(2))}%`}>
      <span>CRIT</span><strong>+{Number(crit.toFixed(2))}%</strong>
    </div>}
    <span className="portrait-name" title={player.name}>{player.name}</span>
    <PortraitHealth hp={player.hp} maxHp={player.maxHp} name={player.name}/>
  </div>;
}
