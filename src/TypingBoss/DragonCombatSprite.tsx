import visualRegistration from './bossVisualRegistration';
import WyrmSprite from './WyrmVisuals';
import BossIdleSprite from './BossIdleSprite';
import {TypingBossBoss} from './types';
import {KrakenSprite} from './KrakenVisuals';
import React, { useMemo, useRef, useState } from "react";
import { Box } from "@mui/material";
import { CombatAnimation } from "./combatAnimation";
import { CombatEffects } from "./CombatCharacter";
import { DRAGON_ATTACK_ROWS, dragonSpriteAction, dragonSpriteDelay } from "./dragonAnimation";
import { TypingBossId } from "./types";
import registration from "./dragonRegistration";
import DragonHurtSprite from "./DragonHurtSprite";
import DragonFlameSprite from "./DragonFlameSprite";
import DragonCollapseSprite from './DragonCollapseSprite';
import { DRAGON_HURT, DRAGON_FLAME } from "./dragonHurtRules";
import "./dragonAnimation.css";

const ASSETS = `${(process.env.PUBLIC_URL || "").replace(/\/$/, "")}/assets/typing-boss`;
const DRAGONS = {
  infernalDragon: { atlas: "ancient-red-dragon-attacks", fallback: "ancient-red-dragon-sprite.png" },
  cindermaw: { atlas: "cindermaw-attacks", fallback: "red-dragon-sprite.png" },
  emberWhelp: { atlas: "ember-whelp-attacks", fallback: "ember-whelp-sprite.png" },
};

function DragonSprite({ bossId, width, pose, clock: providedClock, inspectFrame }: {
  bossId: Exclude<TypingBossId,'kraken'|'giantSandWyrm'>;
  width: number | { xs: number; md: number };
  glow: string;
  pose: CombatAnimation;
  clock?: React.MutableRefObject<number>;
  inspectFrame?:number;
}) {
  const localClock = useRef(0), clock = providedClock || localClock;
  const [readyAtlas, setReadyAtlas] = useState("");
  const [readyHurt, setReadyHurt] = useState("");
  const [readyFlame, setReadyFlame] = useState("");
  const [readyCollapse, setReadyCollapse] = useState('');
  const collapseSrc = `${ASSETS}/dragons/forward-collapse.webp`;
  const collapsing = pose.state === 'death' || pose.state === 'defeated';
  const collapseReady = readyCollapse === collapseSrc;
  const config = DRAGONS[bossId];
  const src = `${ASSETS}/dragons/${config.atlas}-v2.webp`;
  const ready = readyAtlas === src;
  const action = dragonSpriteAction(pose);
  const isFlame = action?.state === "flamethrower";
  const flameSrc = `${ASSETS}/dragons/${config.atlas.replace("-attacks", "-flame-20-v2")}.webp`;
  const flameReady = readyFlame === flameSrc;
  const hurtTier = action ? undefined : pose.hurtTier;
  const hurtSrc = `${ASSETS}/dragons/${config.atlas.replace("-attacks", "-hurt")}.webp`;
  const hurtReady = readyHurt === hurtSrc;
  const row = action && !isFlame ? DRAGON_ATTACK_ROWS[action.state]! : 0;
  const animation = collapsing ? pose : hurtTier ? pose : action;
  const actionId = animation?.id, actionAt = animation?.at, actionDuration = animation?.duration || 1;
  const animationReady = collapsing ? collapseReady : isFlame ? flameReady : hurtTier ? hurtReady : ready;
  // Cache this delay for the event, so unrelated snapshots cannot restart the sheet.
  // Becoming ready catches up to the existing server timeline instead of replaying it.
  const delay = useMemo(() => !animationReady || !actionId || actionAt === undefined ? 0 : dragonSpriteDelay(actionAt, actionDuration, Date.now() + clock.current),
    [actionId, actionAt, actionDuration, clock, animationReady]);
  const frozen=inspectFrame===undefined?undefined:Math.min(isFlame ? DRAGON_FLAME.frames - 1 : hurtTier ? DRAGON_HURT[hurtTier].frames - 1 : 5,Math.max(0,Math.trunc(inspectFrame)));
  const geometry=registration[bossId],camera=visualRegistration.cameras[bossId],frames=geometry.rows[row];
  const frameVariables=Object.fromEntries(frames.flatMap((frame,index)=>[
    [`--dragon-scale-${index}`,frame.scaleX],
    [`--dragon-x-${index}`,`${frame.x/geometry.cell*100}%`],
    [`--dragon-y-${index}`,`${frame.y/geometry.cell*100}%`],
  ])) as React.CSSProperties;
  const attackFrozen=frozen===undefined?undefined:Math.min(5,frozen);
  const frozenPose=attackFrozen===undefined?undefined:frames[attackFrozen];
  return <Box data-testid="dragon-animation" data-animation={pose.state}
    data-sprite-state={collapsing && collapseReady ? pose.state==='defeated'?'collapsed':'forward-collapse' : isFlame && flameReady ? "flamethrower" : hurtTier && hurtReady ? `hurt-${hurtTier}` : ready ? (isFlame ? "idle" : action?.state) || "idle" : "fallback"}
    data-hurt-tier={hurtTier}
    data-dragon={bossId} data-sprite-row={ready ? row : undefined}
    className={`dragon-pose${pose.state==='idle'?' boss-is-idle':''} dragon-pose-${pose.state}${collapsing && collapseReady?' dragon-collapse-ready':''}${ready || flameReady?" dragon-sheet-ready":""}${animationReady && action ? " dragon-sheet-attacking" : ""}${frozen===undefined?"":" dragon-inspecting"}`}
    sx={{ width, aspectRatio: "1", flexShrink: 0 }}
    style={{ "--pose-ms": `${pose.duration || 900}ms` } as React.CSSProperties}>
    <img data-testid="dragon-atlas-preload" className="dragon-atlas-preload" src={src} alt="" aria-hidden="true"
      onLoad={() => setReadyAtlas(src)} />
    <img data-testid="dragon-hurt-preload" className="dragon-atlas-preload" src={hurtSrc} alt="" aria-hidden="true"
      onLoad={() => setReadyHurt(hurtSrc)} />
    <img data-testid="dragon-flame-preload" className="dragon-atlas-preload" src={flameSrc} alt="" aria-hidden="true"
      onLoad={() => setReadyFlame(flameSrc)} />
    <img data-testid="dragon-collapse-preload" className="dragon-atlas-preload" src={collapseSrc} alt="" aria-hidden="true" onLoad={()=>setReadyCollapse(collapseSrc)}/>
    {collapsing && collapseReady && <DragonCollapseSprite key={pose.id} bossId={bossId} src={collapseSrc} duration={actionDuration} delay={delay} held={pose.state==='defeated'} inspectFrame={frozen}/>}
    {!(collapsing && collapseReady) && (isFlame && flameReady ? <DragonFlameSprite key={actionId} bossId={bossId} src={flameSrc} duration={actionDuration} delay={delay} inspectFrame={frozen} /> : hurtTier && hurtReady ? <DragonHurtSprite key={pose.id} bossId={bossId} tier={hurtTier} src={hurtSrc} duration={actionDuration} delay={delay} inspectFrame={frozen} /> : ready ? <span className="dragon-sprite-viewport"><span key={`${actionId || "idle"}:${row}`} className={`dragon-sprite-cell${action && !isFlame ? " dragon-sprite-playing" : ""}`}
      data-testid="dragon-sprite-cell" aria-hidden="true" style={{
        ...frameVariables,width:`${geometry.cell/camera.size*100}%`,height:`${geometry.cell/camera.size*100}%`,
        left:`${-camera.left/camera.size*100}%`,top:`${-camera.top/camera.size*100}%`,
        backgroundImage: `url("${src}")`, backgroundPositionY: `${row / 3 * 100}%`,
        backgroundPositionX:attackFrozen===undefined?undefined:`${attackFrozen/5*100}%`,animationName:attackFrozen===undefined?undefined:"none",
        transform:frozenPose?`translate(${frozenPose.x/geometry.cell*100}%,${frozenPose.y/geometry.cell*100}%) scaleX(${frozenPose.scaleX})`:undefined,
        animationDuration: `${actionDuration}ms`, animationDelay: `${delay}ms`,
      }} /></span> : <img className="dragon-static-fallback" src={`${ASSETS}/${config.fallback}`} alt="" aria-hidden="true" draggable={false} />)}
    {pose.state==='idle' && <BossIdleSprite bossId={bossId} inspectFrame={inspectFrame}/>}
    <CombatEffects pose={pose} clock={clock} />
  </Box>;
}

export default function DragonCombatSprite(props:{bossId:TypingBossId;width:number|{xs:number;md:number};glow:string;pose:CombatAnimation;clock?:React.MutableRefObject<number>;inspectFrame?:number;krakenCast?:{id:string;at:number;until:number}|null;bossState?:TypingBossBoss}) {
  return props.bossId==='giantSandWyrm'?<WyrmSprite boss={props.bossState || {}} pose={props.pose} width={props.width} clock={props.clock}/>:props.bossId==='kraken'?<KrakenSprite width={props.width} pose={props.pose} clock={props.clock} cast={props.krakenCast} quiet={props.inspectFrame===0}/>:<DragonSprite {...props} bossId={props.bossId}/>;
}
