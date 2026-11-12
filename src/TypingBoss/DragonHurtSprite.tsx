import React from "react";
import { DragonHurtTier, TypingBossId } from "./types";
import registration from "./dragonHurtRegistration";
import "./dragonHurt.css";

export default function DragonHurtSprite({ bossId, tier, src, duration, delay, inspectFrame }: {
  bossId: TypingBossId; tier: DragonHurtTier; src: string; duration: number; delay: number; inspectFrame?: number;
}) {
  const geometry = registration[bossId], camera = geometry.camera, frames = geometry.tiers[tier];
  const transform = (index: number) => {
    const frame = frames[index];
    return `translate(${frame.x / geometry.cell * 100}%,${frame.y / geometry.cell * 100}%) scale(${frame.scaleX},${frame.scaleY})`;
  };
  const variables = Object.fromEntries(frames.map((_, index) => [`--hurt-transform-${index}`, transform(index)]));
  const frozen = inspectFrame === undefined ? undefined : Math.min(frames.length - 1, Math.max(0, Math.trunc(inspectFrame)));
  const peak = tier === "basic" ? 1 : tier === "power" ? 2 : 4;
  return <span className="dragon-sprite-viewport dragon-hurt-viewport"><span
    data-testid="dragon-sprite-cell" data-frame-count={frames.length} aria-hidden="true"
    className={`dragon-hurt-cell dragon-hurt-${tier}`} style={{
      ...variables, "--hurt-still-position": `${peak / 9 * 100}%`, "--hurt-still-transform": transform(peak),
      width: `${geometry.cell / camera.size * 100}%`, height: `${geometry.cell / camera.size * 100}%`,
      left: `${-camera.left / camera.size * 100}%`, top: `${-camera.top / camera.size * 100}%`,
      backgroundImage: `url("${src}")`, backgroundPositionY: `${tier === "basic" ? 0 : tier === "power" ? 50 : 100}%`,
      backgroundPositionX: frozen === undefined ? undefined : `${frozen / 9 * 100}%`,
      animationName: frozen === undefined ? undefined : "none", transform: frozen === undefined ? undefined : transform(frozen),
      animationDuration: `${duration}ms`, animationDelay: `${delay}ms`,
    } as React.CSSProperties} /></span>;
}
