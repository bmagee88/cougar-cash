import React, { useMemo, useRef, useState } from "react";
import { Box } from "@mui/material";
import { CombatAnimation } from "./combatAnimation";
import { CombatEffects } from "./CombatCharacter";
import { DRAGON_ATTACK_ROWS, dragonSpriteAction, dragonSpriteDelay } from "./dragonAnimation";
import { TypingBossId } from "./types";
import registration from "./dragonRegistration";
import "./dragonAnimation.css";

const ASSETS = `${(process.env.PUBLIC_URL || "").replace(/\/$/, "")}/assets/typing-boss`;
const DRAGONS = {
  infernalDragon: { atlas: "ancient-red-dragon-attacks", fallback: "ancient-red-dragon-sprite.png" },
  cindermaw: { atlas: "cindermaw-attacks", fallback: "red-dragon-sprite.png" },
  emberWhelp: { atlas: "ember-whelp-attacks", fallback: "ember-whelp-sprite.png" },
};

export default function DragonCombatSprite({ bossId, width, glow, pose, clock: providedClock, inspectFrame }: {
  bossId: TypingBossId;
  width: number | { xs: number; md: number };
  glow: string;
  pose: CombatAnimation;
  clock?: React.MutableRefObject<number>;
  inspectFrame?:number;
}) {
  const localClock = useRef(0), clock = providedClock || localClock;
  const [readyAtlas, setReadyAtlas] = useState("");
  const config = DRAGONS[bossId];
  const src = `${ASSETS}/dragons/${config.atlas}-v2.webp`;
  const ready = readyAtlas === src;
  const action = dragonSpriteAction(pose);
  const row = action ? DRAGON_ATTACK_ROWS[action.state]! : 0;
  const actionId = action?.id, actionAt = action?.at, actionDuration = action?.duration || 1;
  // Cache this delay for the event, so unrelated snapshots cannot restart the sheet.
  // Becoming ready catches up to the existing server timeline instead of replaying it.
  const delay = useMemo(() => !ready || !actionId || actionAt === undefined ? 0 : dragonSpriteDelay(actionAt, actionDuration, Date.now() + clock.current),
    [actionId, actionAt, actionDuration, clock, ready]);
  const frozen=inspectFrame===undefined?undefined:Math.min(5,Math.max(0,Math.trunc(inspectFrame)));
  const geometry=registration[bossId],camera=geometry.camera,frames=geometry.rows[row];
  const frameVariables=Object.fromEntries(frames.flatMap((frame,index)=>[
    [`--dragon-scale-${index}`,frame.scaleX],
    [`--dragon-x-${index}`,`${frame.x/geometry.cell*100}%`],
    [`--dragon-y-${index}`,`${frame.y/geometry.cell*100}%`],
  ])) as React.CSSProperties;
  const frozenPose=frozen===undefined?undefined:frames[frozen];
  return <Box data-testid="dragon-animation" data-animation={pose.state}
    data-sprite-state={ready ? action?.state || "idle" : "fallback"}
    data-dragon={bossId} data-sprite-row={ready ? row : undefined}
    className={`dragon-pose dragon-pose-${pose.state}${ready?" dragon-sheet-ready":""}${ready && action ? " dragon-sheet-attacking" : ""}${frozen===undefined?"":" dragon-inspecting"}`}
    sx={{ width, aspectRatio: "1", flexShrink: 0, filter: `drop-shadow(0 12px 20px ${glow}66)` }}
    style={{ "--pose-ms": `${pose.duration || 900}ms` } as React.CSSProperties}>
    <img data-testid="dragon-atlas-preload" className="dragon-atlas-preload" src={src} alt="" aria-hidden="true"
      onLoad={() => setReadyAtlas(src)} />
    {ready ? <span className="dragon-sprite-viewport"><span key={`${actionId || "idle"}:${row}`} className={`dragon-sprite-cell${action ? " dragon-sprite-playing" : ""}`}
      data-testid="dragon-sprite-cell" aria-hidden="true" style={{
        ...frameVariables,width:`${geometry.cell/camera.size*100}%`,height:`${geometry.cell/camera.size*100}%`,
        left:`${-camera.left/camera.size*100}%`,top:`${-camera.top/camera.size*100}%`,
        backgroundImage: `url("${src}")`, backgroundPositionY: `${row / 3 * 100}%`,
        backgroundPositionX:frozen===undefined?undefined:`${frozen/5*100}%`,animationName:frozen===undefined?undefined:"none",
        transform:frozenPose?`translate(${frozenPose.x/geometry.cell*100}%,${frozenPose.y/geometry.cell*100}%) scaleX(${frozenPose.scaleX})`:undefined,
        animationDuration: `${actionDuration}ms`, animationDelay: `${delay}ms`,
      }} /></span> : <img className="dragon-static-fallback" src={`${ASSETS}/${config.fallback}`} alt="" aria-hidden="true" draggable={false} />}
    <CombatEffects pose={pose} clock={clock} />
  </Box>;
}
